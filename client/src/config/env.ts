/**
 * Environment access, validated once at module load.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when the
 * property is read literally, so each public var is destructured by its full
 * name rather than looked up dynamically.
 */

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
};

const trimTrailingSlash = (url: string): string => url.replace(/\/+$/, "");

export const clientEnv = {
  /** Base URL of the Express API, e.g. http://localhost:8000 */
  apiUrl: trimTrailingSlash(
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  ),
  clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
} as const;

/**
 * Server-only values. Reading this from a Client Component would leak the
 * secret into the bundle, so it throws instead of returning an empty string.
 */
export const serverEnv = () => {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser");
  }
  return {
    clerkSecretKey: required(process.env.CLERK_SECRET_KEY, "CLERK_SECRET_KEY"),
  } as const;
};
