import type { NextFunction, Request, RequestHandler, Response } from "express";
import multer, { MulterError } from "multer";

import { UPLOADS } from "../constants.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Multipart handling for image uploads.
 *
 * Files are buffered in memory rather than written to disk. Every upload
 * here is on its way to Cloudinary and is never read from the local
 * filesystem again, so `diskStorage` would mean a write and a read for
 * nothing — plus a temp file left behind on every request that fails
 * between multer and the upload, since multer does not clean those up
 * itself. The cost is that concurrent uploads live on the heap, which is
 * what `UPLOADS.MAX_FILE_BYTES` and `MAX_FILES_PER_REQUEST` bound.
 */
const storage = multer.memoryStorage();

const fileFilter: NonNullable<Parameters<typeof multer>[0]>["fileFilter"] = (
  _req,
  file,
  callback,
) => {
  if (!UPLOADS.ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    // Rejecting with an ApiError rather than `callback(null, false)`:
    // silently dropping the file would let the request reach the handler
    // with an empty `req.files` and produce a confusing "no images" error
    // instead of saying what was actually wrong.
    callback(
      ApiError.badRequest(
        `Unsupported file type "${file.mimetype}". Allowed: ${UPLOADS.ALLOWED_IMAGE_MIME_TYPES.join(", ")}.`,
      ),
    );
    return;
  }

  callback(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: UPLOADS.MAX_FILE_BYTES,
    files: UPLOADS.MAX_FILES_PER_REQUEST,
    // Without a field cap, a multipart body can carry unbounded non-file
    // fields that the file limits above say nothing about.
    fields: 20,
  },
});

const megabytes = (bytes: number): string =>
  `${String(Math.round((bytes / (1024 * 1024)) * 10) / 10)}MB`;

/**
 * Multer signals limit violations by calling `next(MulterError)`, whose
 * `message` is terse ("File too large") and whose default status in our
 * error handler would be 500. These are client mistakes, so translate
 * them into 4xx `ApiError`s that say which field and which limit.
 */
const toApiError = (error: MulterError): ApiError => {
  switch (error.code) {
    case "LIMIT_FILE_SIZE":
      return ApiError.badRequest(
        `Each file must be ${megabytes(UPLOADS.MAX_FILE_BYTES)} or smaller.`,
      );
    case "LIMIT_FILE_COUNT":
      return ApiError.badRequest(
        `You can upload at most ${String(UPLOADS.MAX_FILES_PER_REQUEST)} files at a time.`,
      );
    case "LIMIT_UNEXPECTED_FILE":
      return ApiError.badRequest(
        `Unexpected file field "${error.field ?? "unknown"}". Send files as "${UPLOADS.IMAGE_FIELD}".`,
      );
    default:
      return ApiError.badRequest(`Upload failed: ${error.message}`);
  }
};

/**
 * Wraps a multer handler so its own errors arrive at the error handler as
 * ApiErrors. `withTranslation` runs multer inline instead of passing it to
 * the router, which is what lets it see the error before Express does.
 */
const withTranslation =
  (handler: RequestHandler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (error: unknown) => {
      if (error instanceof MulterError) {
        next(toApiError(error));
        return;
      }
      next(error);
    });
  };

/**
 * Accepts up to `UPLOADS.MAX_FILES_PER_REQUEST` files under the
 * `images` field, exposed to the handler as `req.files`.
 *
 *   router.post("/:id/images", requireAuth, uploadImages, controller.addImages)
 */
export const uploadImages: RequestHandler = withTranslation(
  upload.array(UPLOADS.IMAGE_FIELD, UPLOADS.MAX_FILES_PER_REQUEST),
);

/**
 * Accepts a single file under the given field, exposed as `req.file`.
 * Used for one-of-a-kind images — an avatar, a shop logo.
 */
export const uploadSingle = (field: string): RequestHandler =>
  withTranslation(upload.single(field));

/**
 * Narrows `req.files` to the array form.
 *
 * Express types it as `File[] | { [field]: File[] } | undefined` because
 * `.array()` and `.fields()` produce different shapes, and there is no way
 * for the types to know which middleware ran. Returns an empty array when
 * no files were sent, so callers can enforce their own minimum with a
 * message that fits the route.
 */
export const filesFrom = (req: Request): Express.Multer.File[] => {
  const { files } = req;
  if (Array.isArray(files)) return files;
  return [];
};
