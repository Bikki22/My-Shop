import type { Request } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/async-handler.js";
import type { IUserDocument } from "./user.model.js";
import { userService, UserService } from "./user.service.js";
import type {
  ListUsersQuery,
  UpdateMeInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
} from "./user.validation.js";

/**
 * `requireAuth` guarantees this, but the type system can't see across
 * middleware — this turns the invariant into a real check instead of a `!`.
 */
const currentUser = (req: Request): IUserDocument => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return req.user;
};

/**
 * HTTP boundary only: unwrap the request, delegate, shape the response.
 * Bodies/params/queries are already validated by the route's middleware,
 * which is what makes the casts below safe.
 */
export class UserController {
  constructor(private readonly service: UserService) {}

  // ---------- Self-service ----------

  getMe = asyncHandler(async (req, res) =>
    res.status(200).json({ success: true, data: currentUser(req) }),
  );

  updateMe = asyncHandler(async (req, res) => {
    const user = await this.service.updateMe(
      currentUser(req),
      req.body as UpdateMeInput,
    );
    return res.status(200).json({ success: true, data: user });
  });

  deleteMe = asyncHandler(async (req, res) => {
    await this.service.deleteMe(currentUser(req));
    return res.status(200).json({ success: true, message: "Account deleted" });
  });

  // ---------- Admin ----------

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(
      req.validatedQuery as ListUsersQuery,
    );
    return res.status(200).json({ success: true, ...result });
  });

  getById = asyncHandler<{ id: string }>(async (req, res) => {
    const user = await this.service.getById(req.params.id);
    return res.status(200).json({ success: true, data: user });
  });

  updateRole = asyncHandler<{ id: string }>(async (req, res) => {
    const user = await this.service.updateRole(
      currentUser(req),
      req.params.id,
      req.body as UpdateUserRoleInput,
    );
    return res.status(200).json({ success: true, data: user });
  });

  updateStatus = asyncHandler<{ id: string }>(async (req, res) => {
    const user = await this.service.updateStatus(
      currentUser(req),
      req.params.id,
      req.body as UpdateUserStatusInput,
    );
    return res.status(200).json({ success: true, data: user });
  });
}

export const userController = new UserController(userService);
