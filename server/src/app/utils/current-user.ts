import type { Request } from "express";
import { ApiError } from "./ApiError.js";
import type { IUserDocument } from "../modules/users/user.model.js";

/**
 * `requireAuth` guarantees `req.user`, but the type system can't see across
 * middleware — this turns the invariant into a real check instead of a `!`
 * scattered through every controller.
 */
export const currentUser = (req: Request): IUserDocument => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return req.user;
};
