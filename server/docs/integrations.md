# Integrations reference

Cloudinary, Multer, Resend, JWT, and the shared constants module — what
each one is, where it lives, and how to call it.

Every integration here is **optional at boot**. Missing credentials
degrade one feature and log a warning; they never stop the server from
starting. That is the same pattern eSewa and the Clerk webhook already
use, so a half-provisioned environment loses one thing instead of
everything.

| Integration | Config | Implementation | Degrades to |
| --- | --- | --- | --- |
| Cloudinary | `config/cloudinary.ts` | `utils/cloudinary.ts` | Upload routes answer `503` |
| Multer | — | `middlewares/upload.middleware.ts` | n/a (no credentials) |
| Resend | `config/mailer.ts` | `utils/email.ts` | Mail is logged, not sent |
| JWT | `config/env.ts` | `utils/jwt.ts` | Signing throws `500` |
| Constants | — | `constants.ts` | n/a |

---

## Environment

All new keys are optional. See `.env.example` for the annotated copy.

```env
# Cloudinary — unset means POST /products/:id/images answers 503
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Resend — unset means mail is logged instead of sent
RESEND_API_KEY=
EMAIL_FROM=My Shop <onboarding@resend.dev>

# App-signed tokens — NOT the login path, see the JWT section
ACCESS_TOKEN_SECRET=          # min 32 chars
REFRESH_TOKEN_SECRET=         # min 32 chars, different from the above
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## `constants.ts`

App-wide literals that more than one module has to agree on.

Deliberately narrow. Two categories stay out:

- **Domain vocabularies** (`USER_ROLES`, `ORDER_STATUSES`,
  `PAYMENT_STATES`, `VENDOR_STATUSES`) live next to the model that owns
  them, because the Mongoose enum and the Zod schema both read them and
  separating them from the schema is how the two drift apart.
- **Deployment-driven values** (prices, commission, credentials) live in
  `config/env.ts` so they change without a code change.

What is here is the middle case — no single owning model, hardcoded
identically in several places, where updating one copy and not the others
is a bug.

```ts
import { PAGINATION, SEARCH_MAX_LENGTH } from "../../constants.js";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional()
    .default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1)
    .max(PAGINATION.MAX_LIMIT).optional()
    .default(PAGINATION.DEFAULT_LIMIT),
});
```

| Export | Contents |
| --- | --- |
| `PAGINATION` | `DEFAULT_PAGE` 1, `DEFAULT_LIMIT` 20, `MAX_LIMIT` 100 |
| `SEARCH_MAX_LENGTH` | 100 |
| `UPLOADS` | `MAX_FILE_BYTES` 5MB, `MAX_FILES_PER_REQUEST` 8, `ALLOWED_IMAGE_MIME_TYPES`, `IMAGE_FIELD` `"images"` |
| `CLOUDINARY_FOLDERS` | `PRODUCTS`, `AVATARS`, `VENDORS` |
| `PRODUCT_IMAGES` | `MIN_PER_PRODUCT` 1, `MAX_PER_PRODUCT` 8 |
| `TOKEN_TYPES`, `TOKEN_ISSUER` | JWT `typ` and `iss` claims |

`MAX_LIMIT` is a denial-of-service guard, not a preference: without it a
client can ask for `?limit=1000000` and make the server materialise the
whole collection.

**Already applied** to the six validation schemas that each carried their
own copy of `1` / `20` / `100`: `category`, `orders`, `payouts`,
`products`, `users`, `vendors`.

---

## Cloudinary

`config/cloudinary.ts` configures the SDK once at import and exports
`isCloudinaryConfigured`. `utils/cloudinary.ts` has the operations.

```ts
import {
  uploadImage, uploadImages,
  destroyImage, destroyImageByUrl, destroyImages,
  publicIdFromUrl,
} from "../../utils/cloudinary.js";
import { CLOUDINARY_FOLDERS } from "../../constants.js";

const image  = await uploadImage(buffer, CLOUDINARY_FOLDERS.PRODUCTS);
const images = await uploadImages(buffers, CLOUDINARY_FOLDERS.PRODUCTS);
// -> { url, publicId, width, height, bytes, format }
```

Notes worth knowing before you call it:

- **Uploads throw, deletes don't.** `uploadImage` throws `ApiError` 503
  when unconfigured and rejects on a Cloudinary failure. `destroyImage`
  resolves `false` and logs instead — deletion is almost always cleanup
  running *after* the thing the user asked for already succeeded, and
  failing a request because the tidying failed reports a delete that did
  happen as an error.
- **`uploadImages` cleans up after a partial failure.** Four of six land
  and the fifth fails: the four successes are destroyed before the error
  is re-thrown, so nothing is orphaned in your Cloudinary account,
  referenced by nothing and invisible to the app.
- **Images are transformed at upload time** — capped at 1600×1600
  (`crop: "limit"`, which only ever shrinks) with `quality: auto` and
  `fetch_format: auto`. An untouched phone photo would otherwise be
  served to every visitor for the life of the product.
- **`publicIdFromUrl` works backwards from a stored URL**, since products
  store URLs rather than public ids. It handles delivery transformations
  and an absent version segment, and returns `null` for a non-Cloudinary
  URL — the normal answer for an image hosted elsewhere, which is why
  `destroyImageByUrl` treats it as a no-op rather than an error.

### Order of operations

Upload to Cloudinary **first**, then save the document. A save that fails
after the upload leaves orphaned assets, which the cleanup handles. The
reverse order leaves the product pointing at URLs that were never stored —
a broken image on the storefront, the worse of the two failures.

Deletion is the mirror: save the document **first**, then destroy. See
`ProductService.addImages` and `removeSubImage` for both.

---

## Multer

`middlewares/upload.middleware.ts`.

```ts
import { uploadImages, uploadSingle, filesFrom }
  from "../../middlewares/upload.middleware.js";

router.post(
  "/:id/images",
  requireAuth,                        // before the upload — see below
  validateParams(productIdParamSchema),
  uploadImages,                       // multipart, so no validateBody
  productController.addImages,
);
```

In the controller, `filesFrom(req)` narrows `req.files` to the array form
(Express types it as a union because `.array()` and `.fields()` produce
different shapes, and the types cannot know which middleware ran).

```ts
const files = filesFrom(req);
if (files.length === 0) throw ApiError.badRequest("No files received…");
const buffers = files.map((file) => file.buffer);
```

- **Memory storage, not disk.** Every upload is on its way to Cloudinary
  and is never read from the filesystem again, so `diskStorage` would be
  a write and a read for nothing — plus a temp file left behind on every
  request that fails in between, which multer does not clean up itself.
  The cost is heap pressure, which is what the size and count limits bound.
- **Put `requireAuth` before the upload middleware.** Otherwise an
  anonymous caller can make the server buffer 8 × 5MB before anything
  checks who they are.
- **Multer accepts a body with no files at all** — the controller has to
  make that check itself, as above.
- Limit violations arrive as 4xx `ApiError`s naming the field and the
  limit, not multer's terse `MulterError` rendered as a 500.

Verified behavior:

| Request | Response |
| --- | --- |
| 2 valid images | `200` |
| `application/pdf` | `400 Unsupported file type "application/pdf". Allowed: …` |
| 6MB file | `400 Each file must be 5MB or smaller.` |
| 9 files | `400 You can upload at most 8 files at a time.` |
| field `photo` | `400 Unexpected file field "photo". Send files as "images".` |

---

## Resend

`config/mailer.ts` builds the client; `utils/email.ts` has the senders.

**The contract: nothing here throws.** Every message this app sends
acknowledges something that already happened, so failing the request
because a receipt bounced would report a successful order as an error and
invite a retry that charges the customer twice. Each function returns or
logs; none propagates.

```ts
import { sendEmail, queueEmail, sendOrderConfirmationEmail }
  from "../../utils/email.js";

await sendEmail({ to, subject, html, text?, replyTo? });  // -> boolean
queueEmail({ to, subject, html });                        // fire-and-forget
```

- `sendEmail` returns whether Resend **accepted** the message. Resend
  delivers asynchronously, so `true` means handed over, not delivered —
  delivery failures show up in Resend's dashboard or webhooks.
- The SDK reports failures in its **result** rather than by throwing, so
  the `{ data, error }` check matters; without it every rejection reads
  as a success.
- `text` defaults to a tag-stripped rendering of `html`. Worth supplying
  your own: a message with no text part scores worse with spam filters.
- All interpolated values are HTML-escaped. Product names and addresses
  are user-supplied and land inside markup we mail out.
- Templates use inline styles and a table frame — email clients strip
  `<style>` blocks and have no reliable flexbox or grid.

### Wired in

| Trigger | Function |
| --- | --- |
| `OrderService.checkout` succeeds | `sendOrderConfirmationEmail` |
| `OrderService.applyPaymentOutcome` → `PAID` | `sendPaymentReceivedEmail` |

Both fire after the write is durable. The payment receipt sends exactly
once despite `applyPaymentOutcome` being replayable — the
`paymentStatus === outcome` guard returns early on every repeat, and the
conditional update means only the caller that won the race gets there.

---

## JWT

`utils/jwt.ts`.

> **This is not the login path.** Session authentication belongs to Clerk
> (`middlewares/auth.middleware.ts`). Do not use this to replace it — two
> sources of truth for "who is this" is how an account ends up suspended
> in one system and active in the other.

What it is for is the jobs a session cannot do, because the holder is not
signed in or is not a browser at all:

- a one-shot link mailed to someone (verify this address, claim this
  vendor invitation) that must expire and cannot be forged
- a short-lived grant handed to another service, scoped to one action

```ts
import {
  signAccessToken, signRefreshToken,
  verifyAccessToken, verifyRefreshToken,
  bearerTokenFrom, isTokenSigningConfigured,
} from "../../utils/jwt.js";

// A one-hour link, overriding ACCESS_TOKEN_EXPIRES_IN
const token = signAccessToken(
  { sub: user._id.toString(), purpose: "verify-email" },
  { expiresIn: "1h" },
);

const claims = verifyAccessToken(token);  // -> { sub, typ, iss, iat, exp, … }
```

- Every token carries `iss` (`my-shop-api`) and `typ` (`access` /
  `refresh`), and verification insists on both. Without the `typ` check a
  long-lived refresh token would verify anywhere an access token is
  accepted, quietly outliving the scope it was minted for.
- Verification throws `ApiError` 401 for anything a client could have
  caused, distinguishing `"Token has expired"` from `"Invalid token"` —
  only one of those is worth retrying after a refresh.
- Signing with an unset secret throws a **500**, not a 4xx: the client did
  nothing wrong, the deployment is missing a secret. There is no baked-in
  fallback, which would be the same secret in every environment and would
  *work*, so nobody would notice.
- `bearerTokenFrom(req.headers.authorization)` returns `null` rather than
  throwing, leaving the caller to decide whether that is a 401 or simply
  an anonymous request.

Verified: round-trip, cross-type rejection, tamper rejection, expiry
rejection, and bearer-header parsing.

---

## New endpoint

### `POST /api/v1/products/:id/images`

Appends photos to an existing product. Auth required; the caller must own
the product and their shop must be able to sell.

```bash
curl -X POST http://localhost:8000/api/v1/products/<id>/images \
  -H "Authorization: Bearer <clerk-session-token>" \
  -F "images=@photo1.jpg" \
  -F "images=@photo2.png"
```

`multipart/form-data`, field name `images`, up to 8 files of 5MB each,
`image/jpeg|png|webp|avif`. Returns `201` with the updated product.

Refuses the upload when it would push the product past
`PRODUCT_IMAGES.MAX_PER_PRODUCT` (8), naming how many more it will take.

The matching `PATCH /api/v1/products/:id/images/remove` now also deletes
the asset from Cloudinary after the document is saved — previously it
dropped the URL and left the file behind.
