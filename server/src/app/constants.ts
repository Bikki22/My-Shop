/**
 * Cross-cutting constants — the literals that more than one module has to
 * agree on.
 *
 * Deliberately *not* a dumping ground for every magic number in the app.
 * Domain vocabularies (`USER_ROLES`, `ORDER_STATUSES`, `PAYMENT_STATES`,
 * `VENDOR_STATUSES`, …) stay next to the model that owns them, because the
 * Mongoose enum and the Zod schema both need to read them and splitting
 * them from the schema is how the two drift apart. Anything driven by
 * deployment — prices, commission, credentials — belongs in `config/env.ts`
 * so it can change without a code change.
 *
 * What lands here is the middle case: a value with no single owning model,
 * hardcoded identically in several places, where a change to one copy and
 * not the others is a bug. Pagination is the clearest example — six
 * validation schemas were each carrying their own `20` and `100`.
 */

/**
 * List endpoint defaults, shared by every `paginationQuerySchema`.
 *
 * `MAX_LIMIT` is a denial-of-service guard, not a preference: without it a
 * client can ask for `?limit=1000000` and make the server materialise the
 * whole collection.
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Longest accepted `?search=` term. Long inputs are worth capping because
 * they reach a regex or a text index, where cost grows with the pattern.
 */
export const SEARCH_MAX_LENGTH = 100;

/**
 * Limits enforced by `middlewares/upload.middleware.ts` before a single
 * byte reaches Cloudinary.
 *
 * The size cap is the important one. Uploads are buffered in memory (see
 * the middleware for why), so without a ceiling a handful of concurrent
 * requests can exhaust the heap. Multer counts the *raw* multipart bytes,
 * which run slightly above the file's own size.
 */
export const UPLOADS = {
  /** Per file. 5 MB comfortably fits a photo off a phone camera. */
  MAX_FILE_BYTES: 5 * 1024 * 1024,

  /** Per request, matched to `PRODUCT_IMAGES.MAX_PER_PRODUCT`. */
  MAX_FILES_PER_REQUEST: 8,

  /**
   * Checked against the browser-supplied `Content-Type`, which is a hint
   * and not proof — a client can label anything `image/png`. It is a
   * usability guard that rejects the obvious mistake early; Cloudinary
   * does the real validation when it decodes the bytes.
   */
  ALLOWED_IMAGE_MIME_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
  ] as readonly string[],

  /** The multipart field name every upload route reads. */
  IMAGE_FIELD: "images",
} as const;

/**
 * Where uploaded assets are filed in Cloudinary.
 *
 * Folders are a prefix on the public id, so they are effectively permanent:
 * renaming one here does not move the assets already stored under the old
 * name, and the URLs on existing documents keep pointing at the old path.
 */
export const CLOUDINARY_FOLDERS = {
  PRODUCTS: "my-shop/products",
  AVATARS: "my-shop/avatars",
  VENDORS: "my-shop/vendors",
} as const;

export type CloudinaryFolder =
  (typeof CLOUDINARY_FOLDERS)[keyof typeof CLOUDINARY_FOLDERS];

/** Product image rules shared by the model, the validation and the uploader. */
export const PRODUCT_IMAGES = {
  MIN_PER_PRODUCT: 1,
  MAX_PER_PRODUCT: 8,
} as const;

/**
 * The `typ` claim on tokens minted by `utils/jwt.ts`.
 *
 * Every token carries the kind it is, and verification refuses a token of
 * the wrong kind even when the signature checks out. Without it a refresh
 * token — long-lived by design — would be accepted anywhere an access
 * token is, quietly outliving its scope.
 */
export const TOKEN_TYPES = {
  ACCESS: "access",
  REFRESH: "refresh",
} as const;

export type TokenType = (typeof TOKEN_TYPES)[keyof typeof TOKEN_TYPES];

/**
 * Pinned into every token's `iss` claim and required on the way back, so a
 * token minted by some other service that happens to share a secret does
 * not verify here.
 */
export const TOKEN_ISSUER = "my-shop-api";
