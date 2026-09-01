import { z } from "zod";

/**
 * Every environment variable the server reads, validated once at startup.
 *
 * Anything required and missing crashes the process immediately with a
 * readable list, rather than surfacing as a confusing failure on the first
 * request that happens to need it. Import `env` instead of touching
 * `process.env` directly so the types stay honest.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .optional()
    .default("development"),

  PORT: z.coerce.number().int().min(1).max(65535).optional().default(8000),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  CLERK_PUBLISHABLE_KEY: z.string().min(1, "CLERK_PUBLISHABLE_KEY is required"),

  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),

  /**
   * Optional on purpose: the rest of the API works without it. Only the
   * `/webhooks/clerk` endpoint needs it, and that route answers 503 while
   * it is unset instead of taking the whole server down.
   */
  CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),

  /** Comma-separated list of browser origins allowed to call the API. */
  CORS_ORIGINS: z.string().optional().default("http://localhost:5173"),

  /**
   * Marketplace economics. These were literals inside the checkout; they
   * live here so the sandbox and production can differ without a code
   * change, and so `config/platform.ts` has one place to read them from.
   *
   * `PLATFORM_COMMISSION_RATE` is the cut the platform keeps on every sale
   * a vendor has not negotiated a rate for, as a fraction (0.1 = 10%).
   */
  PLATFORM_COMMISSION_RATE: z.coerce
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.1),

  /** Charged per vendor sub-order, waived above the threshold. */
  SHIPPING_FLAT_FEE: z.coerce.number().min(0).optional().default(49),
  FREE_SHIPPING_THRESHOLD: z.coerce.number().min(0).optional().default(999),

  /** Fraction of the subtotal, e.g. 0.13 for 13%. */
  TAX_RATE: z.coerce.number().min(0).max(1).optional().default(0),

  /**
   * Where the browser is sent back to after a payment. eSewa redirects the
   * *browser*, not an API client, so both of these have to be absolute
   * URLs reachable from the customer's machine — not container hostnames.
   */
  CLIENT_URL: z.url().optional().default("http://localhost:5173"),
  SERVER_URL: z.url().optional().default("http://localhost:8000"),

  /**
   * eSewa ePay v2. Optional as a group: while they are unset the payment
   * routes answer 503 and the rest of the API runs normally, the same deal
   * as CLERK_WEBHOOK_SECRET.
   *
   * `ESEWA_ENV=test` targets rc-epay (the sandbox) with the published test
   * merchant `EPAYTEST`; `production` targets the live gateway and needs
   * the credentials eSewa issues to the merchant.
   */
  ESEWA_ENV: z.enum(["test", "production"]).optional().default("test"),
  ESEWA_PRODUCT_CODE: z.string().trim().min(1).optional(),
  ESEWA_SECRET_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * A variable declared but left blank in `.env` (`FOO=`) arrives as `""`,
 * not `undefined`, so `.optional()` and `.default()` would both ignore it
 * and the blank would fail a `min(1)` check instead. Dropping blanks up
 * front makes "declared but empty" mean the same thing as "not set".
 */
const withoutBlanks = (source: NodeJS.ProcessEnv): Record<string, string> =>
  Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1].trim() !== "",
    ),
  );

const parsed = envSchema.safeParse(withoutBlanks(process.env));

if (!parsed.success) {
  const lines = parsed.error.issues.map(
    (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
  );
  console.error(`Invalid environment configuration:\n${lines.join("\n")}`);
  process.exit(1);
}

export const env: Env = parsed.data;

export const corsOrigins: string[] = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

export const isProduction = env.NODE_ENV === "production";
