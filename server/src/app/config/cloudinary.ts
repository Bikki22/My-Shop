import { v2 as cloudinary } from "cloudinary";

import { env } from "./env.js";

/**
 * The Cloudinary SDK, configured once at import.
 *
 * The three credentials are optional as a group (see `env.ts`). When any
 * is missing the SDK is left unconfigured and `isCloudinaryConfigured` is
 * false, which the upload routes turn into a 503 — the same shape eSewa
 * and the Clerk webhook already use, so a half-provisioned environment
 * degrades one feature instead of refusing to boot.
 */
const {
  CLOUDINARY_CLOUD_NAME: cloudName,
  CLOUDINARY_API_KEY: apiKey,
  CLOUDINARY_API_SECRET: apiSecret,
} = env;

export const isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

// Destructured and tested inline rather than through `isCloudinaryConfigured`
// so the compiler narrows the three away from `string | undefined` — under
// `exactOptionalPropertyTypes` a possibly-undefined value is not a valid
// `ConfigOptions` field.
if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    // Always hand back https URLs. These get stored on documents and
    // rendered in a page that is itself https; an http URL would be
    // blocked as mixed content long after the upload looked successful.
    secure: true,
  });
} else {
  console.warn(
    "Cloudinary is not configured — image upload routes will answer 503. " +
      "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to enable them.",
  );
}

export { cloudinary };
