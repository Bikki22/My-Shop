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
