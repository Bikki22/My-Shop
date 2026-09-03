import type { UploadApiOptions, UploadApiResponse } from "cloudinary";

import { cloudinary, isCloudinaryConfigured } from "../config/cloudinary.js";
import type { CloudinaryFolder } from "../constants.js";
import { ApiError } from "./ApiError.js";

/** What a caller needs to keep: the URL to render, the id to delete by. */
export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

const assertConfigured = (): void => {
  if (!isCloudinaryConfigured) {
    throw new ApiError(
      503,
      "Image uploads are not available — the server has no Cloudinary credentials configured.",
    );
  }
};

const toUploadedImage = (result: UploadApiResponse): UploadedImage => ({
  url: result.secure_url,
  publicId: result.public_id,
  width: result.width,
  height: result.height,
  bytes: result.bytes,
  format: result.format,
});

/**
 * Sends one in-memory buffer to Cloudinary.
 *
 * `upload_stream` rather than `upload` because multer hands us a Buffer,
 * and the plain `upload` call takes a *path* — using it would mean writing
 * a temp file only to read it straight back, which also leaves litter
 * behind whenever a request fails between the two steps.
 *
 * The transformation is applied at upload time, so what is stored is
 * already bounded: an untouched 12-megapixel phone photo would otherwise
 * be served to every visitor for the life of the product.
 */
export const uploadImage = async (
  buffer: Buffer,
  folder: CloudinaryFolder,
  options: UploadApiOptions = {},
): Promise<UploadedImage> => {
  assertConfigured();

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        // `limit` only ever shrinks: a smaller original is left at its own
        // size rather than upscaled into blur.
        transformation: [{ width: 1600, height: 1600, crop: "limit" }],
        // Let Cloudinary pick the encoding and quality per image and per
        // requesting browser — that is where most of the byte savings are.
        fetch_format: "auto",
        quality: "auto",
        ...options,
      },
      (error, uploaded) => {
        if (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        if (!uploaded) {
          reject(new Error("Cloudinary returned no result for the upload"));
          return;
        }
        resolve(uploaded);
      },
    );

    stream.end(buffer);
  });

  return toUploadedImage(result);
};

/**
 * Uploads several buffers concurrently, and cleans up after itself.
 *
 * A partial failure is the case worth thinking about: four of six files
 * land, the fifth fails, and the caller aborts. Without the cleanup those
 * four are orphaned in Cloudinary — paid for, referenced by nothing, and
 * invisible to every part of the app. So the successes are destroyed
 * before the error is re-thrown.
 */
export const uploadImages = async (
  buffers: readonly Buffer[],
  folder: CloudinaryFolder,
  options: UploadApiOptions = {},
): Promise<UploadedImage[]> => {
  assertConfigured();

  const results = await Promise.allSettled(
    buffers.map((buffer) => uploadImage(buffer, folder, options)),
  );

  const uploaded = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

  const failure = results.find((result) => result.status === "rejected");
  if (failure) {
    await destroyImages(uploaded.map((image) => image.publicId));
    throw failure.reason instanceof Error
      ? failure.reason
      : new Error(String(failure.reason));
  }

  return uploaded;
};

/**
 * Removes an asset. Resolves to whether it was actually there.
 *
 * Never throws: deletion is almost always cleanup that runs *after* the
 * thing the user asked for has already succeeded. Failing the request
 * because the tidying failed would report a delete that did happen as an
 * error, and invite a retry that changes nothing.
 */
export const destroyImage = async (publicId: string): Promise<boolean> => {
  if (!isCloudinaryConfigured) return false;

  try {
    const result: unknown = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      // Cloudinary caches deletes on its CDN; without this a redisplay of
      // the same public id can serve the old bytes for hours.
      invalidate: true,
    });

    // "not found" is a success as far as the caller is concerned: the
    // asset is gone, which is all it wanted.
    const outcome = (result as { result?: unknown }).result;
    return outcome === "ok" || outcome === "not found";
  } catch (error) {
    console.error(`Failed to delete Cloudinary asset ${publicId}`, error);
    return false;
  }
};

export const destroyImages = async (
  publicIds: readonly string[],
): Promise<void> => {
  await Promise.all(publicIds.map((publicId) => destroyImage(publicId)));
};

/**
 * Recovers the public id from a delivery URL.
 *
 * Products store the URL, not the id, so deleting one means working
 * backwards. A Cloudinary URL looks like:
 *
 *   https://res.cloudinary.com/<cloud>/image/upload/v1712345678/my-shop/products/abc123.jpg
 *                                                 └ version ┘ └──── public id ────┘└ ext ┘
 *
 * The public id is everything after the version segment, minus the
 * extension — and it keeps its slashes, because the folder is part of it.
 * Returns null for anything that isn't a Cloudinary upload URL, which is
 * the normal answer for an image the client hosts elsewhere.
 */
export const publicIdFromUrl = (url: string): string | null => {
  let path: string;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("cloudinary.com")) return null;
    path = parsed.pathname;
  } catch {
    return null;
  }

  const segments = path.split("/").filter((segment) => segment.length > 0);

  const uploadAt = segments.indexOf("upload");
  if (uploadAt === -1) return null;

  let rest = segments.slice(uploadAt + 1);

  // Anything between `upload` and the version is a transformation applied
  // at delivery time; it is not part of the id. The version itself is
  // `v` followed by digits, and is optional.
  const versionAt = rest.findIndex((segment) => /^v\d+$/.test(segment));
  if (versionAt !== -1) {
    rest = rest.slice(versionAt + 1);
  }

  if (rest.length === 0) return null;

  const withExtension = rest.join("/");
  // Only strip a trailing extension — a dot inside a folder name is legal
  // and must survive.
  const lastDot = withExtension.lastIndexOf(".");
  const lastSlash = withExtension.lastIndexOf("/");

  return lastDot > lastSlash + 1
    ? withExtension.slice(0, lastDot)
    : withExtension;
};

/**
 * Deletes by delivery URL. A URL we did not host is a no-op, not an error:
 * a product may legitimately carry images from somewhere else.
 */
export const destroyImageByUrl = async (url: string): Promise<boolean> => {
  const publicId = publicIdFromUrl(url);
  if (!publicId) return false;
  return destroyImage(publicId);
};

export const destroyImagesByUrl = async (
  urls: readonly string[],
): Promise<void> => {
  await Promise.all(urls.map((url) => destroyImageByUrl(url)));
};
