import jwt from "jsonwebtoken";
import type { JwtPayload, SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";
import { TOKEN_ISSUER, TOKEN_TYPES, type TokenType } from "../constants.js";
import { ApiError } from "./ApiError.js";

/**
 * The app's own signed tokens.
 *
 * This is **not** the login path. Session authentication belongs to Clerk
 * (`middlewares/auth.middleware.ts`) and nothing here should be used to
 * replace it — two sources of truth for "who is this" is how an account
 * ends up suspended in one system and active in the other.
 *
 * What this is for are the jobs a session cannot do, because the holder is
 * not signed in or is not a browser at all:
 *
 *   - a one-shot link mailed to someone (verify this address, claim this
 *     vendor invitation) that must expire and cannot be forged
 *   - a short-lived grant handed to another service, scoped to one action
 *
 * Every token carries who issued it (`iss`) and what kind it is (`typ`),
 * and verification insists on both. Without the `typ` check a long-lived
 * refresh token would verify anywhere an access token is accepted, quietly
 * outliving the scope it was minted for.
 */

/** Claims a caller supplies. The registered ones are added here. */
export interface TokenClaims {
  /** Who the token is about — our own user `_id`, not the Clerk id. */
  sub: string;
  [claim: string]: unknown;
}

export interface VerifiedToken extends JwtPayload {
  sub: string;
  typ: TokenType;
}

const secretFor = (type: TokenType): string => {
  const secret =
    type === TOKEN_TYPES.ACCESS
      ? env.ACCESS_TOKEN_SECRET
      : env.REFRESH_TOKEN_SECRET;

  if (!secret) {
    // Deliberately a 500 and not a 4xx: the client did nothing wrong, the
    // deployment is missing a secret. Falling back to a baked-in default
    // would be worse than failing — it would be the same secret in every
    // environment, and it would work, so nobody would notice.
    const name =
      type === TOKEN_TYPES.ACCESS
        ? "ACCESS_TOKEN_SECRET"
        : "REFRESH_TOKEN_SECRET";
    throw new ApiError(500, `Token signing is not configured (${name} unset)`);
  }

  return secret;
};

/**
 * `SignOptions["expiresIn"]` is optional, so indexing it yields
 * `... | undefined`, which `exactOptionalPropertyTypes` then refuses where
 * a value is actually required. Strip the undefined once, here.
 */
type ExpiresIn = NonNullable<SignOptions["expiresIn"]>;

const ttlFor = (type: TokenType): string =>
  type === TOKEN_TYPES.ACCESS
    ? env.ACCESS_TOKEN_EXPIRES_IN
    : env.REFRESH_TOKEN_EXPIRES_IN;

/** True once both secrets are present — lets a caller skip a token feature. */
export const isTokenSigningConfigured =
  env.ACCESS_TOKEN_SECRET !== undefined &&
  env.REFRESH_TOKEN_SECRET !== undefined;

/**
 * Per-call overrides. Narrower than `SignOptions` on purpose: `issuer` and
 * the payload are fixed by this module, and widening this to all of
 * `SignOptions` would let a caller mint a token that verification here
 * then rejects.
 */
export interface TokenOptions {
  /**
   * Overrides the environment default. The reason this exists: a one-shot
   * link mailed to someone wants its own lifetime ("1h"), not whatever
   * `ACCESS_TOKEN_EXPIRES_IN` happens to be set to for API calls.
   */
  expiresIn?: ExpiresIn;
  /** Narrows who the token is for, when it is minted for one consumer. */
  audience?: SignOptions["audience"];
}

const sign = (
  type: TokenType,
  claims: TokenClaims,
  options: TokenOptions = {},
): string => {
  const { sub, ...rest } = claims;

  const signOptions: SignOptions = {
    subject: sub,
    issuer: TOKEN_ISSUER,
    // `expiresIn` is typed as a template-literal union that a plain string
    // out of the environment cannot satisfy. The cast is safe enough:
    // jsonwebtoken rejects a malformed value at sign time, which happens
    // on the first token minted after a bad deploy.
    expiresIn: options.expiresIn ?? (ttlFor(type) as ExpiresIn),
    // Spread conditionally rather than assigning `options.audience`
    // directly — under `exactOptionalPropertyTypes` an explicit
    // `undefined` is not the same as an absent key.
    ...(options.audience !== undefined ? { audience: options.audience } : {}),
  };

  return jwt.sign({ ...rest, typ: type }, secretFor(type), signOptions);
};

export const signAccessToken = (
  claims: TokenClaims,
  options?: TokenOptions,
): string => sign(TOKEN_TYPES.ACCESS, claims, options);

export const signRefreshToken = (
  claims: TokenClaims,
  options?: TokenOptions,
): string => sign(TOKEN_TYPES.REFRESH, claims, options);

/**
 * Verifies signature, issuer, expiry and kind.
 *
 * Throws `ApiError` 401 for anything a client could have caused — expired,
 * tampered with, wrong kind — so a bad token reads as "sign in again"
 * rather than a 500. The distinction between *expired* and *invalid* is
 * kept, because only one of them is worth retrying after a refresh.
 */
export const verifyToken = (
  token: string,
  type: TokenType,
): VerifiedToken => {
  let decoded: string | JwtPayload;

  try {
    decoded = jwt.verify(token, secretFor(type), { issuer: TOKEN_ISSUER });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized("Token has expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw ApiError.unauthorized("Invalid token");
    }
    throw error;
  }

  // A token signed with `{ subject }` always decodes to an object; the
  // string form only happens for a payload that was signed as a string.
  if (typeof decoded === "string" || typeof decoded.sub !== "string") {
    throw ApiError.unauthorized("Invalid token");
  }

  if ((decoded as { typ?: unknown }).typ !== type) {
    // Right signature, wrong purpose — e.g. a refresh token presented
    // where an access token is expected.
    throw ApiError.unauthorized("Invalid token");
  }

  return decoded as VerifiedToken;
};

export const verifyAccessToken = (token: string): VerifiedToken =>
  verifyToken(token, TOKEN_TYPES.ACCESS);

export const verifyRefreshToken = (token: string): VerifiedToken =>
  verifyToken(token, TOKEN_TYPES.REFRESH);

/**
 * Reads a token out of `Authorization: Bearer <token>`.
 * Returns null when the header is absent or not a Bearer scheme, leaving
 * the caller to decide whether that is a 401 or simply an anonymous
 * request.
 */
export const bearerTokenFrom = (
  header: string | undefined,
): string | null => {
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token.trim() || null;
};
