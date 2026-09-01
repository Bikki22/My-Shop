import type { QueryFilter } from "mongoose";

/** MongoServerError code for a unique-index violation. */
export const DUPLICATE_KEY = 11000;

export const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === DUPLICATE_KEY;

/**
 * Which unique index a duplicate-key error tripped, or null if it wasn't
 * one. A retry loop that regenerates a slug has to know the collision was
 * actually on `slug` — regenerating one forever because the *owner* index
 * is what collided burns five round trips and reports the wrong problem.
 */
export const duplicateKeyField = (error: unknown): string | null => {
  if (!isDuplicateKeyError(error)) return null;
  const pattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern;
  return pattern ? (Object.keys(pattern)[0] ?? null) : null;
};

/**
 * Drops keys explicitly set to `undefined` so they never reach `$set`.
 *
 * Mongoose would otherwise write `undefined` as `null` for a nullable path,
 * turning "the client omitted this field" into "the client cleared it".
 */
export const omitUndefined = <T extends object>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };

/**
 * User-supplied text goes into a `$regex`, so it has to be escaped. An
 * unescaped search of `(((((((((a` is a catastrophic-backtracking DoS, and
 * `.*` lets a caller widen the filter beyond what they typed.
 */
export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Anchored, escaped prefix match — for "starts with what I typed" filters. */
export const prefixRegex = (value: string): RegExp =>
  new RegExp(`^${escapeRegex(value)}`, "i");

/**
 * Strips accents, then collapses everything that isn't a letter or digit
 * into single hyphens — the exact shape the `slug` regexes accept.
 */
export const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Money is stored as a plain number, so every derived figure is rounded to
 * cents at the point it is computed — otherwise `0.1 + 0.2` style error
 * accumulates across lines and the total the customer agreed to no longer
 * matches the sum of what they see.
 */
export const money = (value: number): number => Math.round(value * 100) / 100;

/** The soft-delete scope every read in this codebase is narrowed by. */
export const NOT_DELETED = { deletedAt: null } as const;

export type Filter<T> = QueryFilter<T>;
