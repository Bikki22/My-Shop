import { clerkClient } from "@clerk/express";
import { Types, type QueryFilter } from "mongoose";
import { ApiError } from "../../utils/ApiError.js";
import {
  User,
  type IUser,
  type IUserDocument,
  type UserRole,
} from "./user.model.js";
import type {
  ListUsersQuery,
  UpdateMeInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
} from "./user.validation.js";

/**
 * User-supplied text goes into a `$regex`, so it has to be escaped. An
 * unescaped search of `(((((((((a` is a catastrophic-backtracking DoS, and
 * `.*` lets a caller widen the filter beyond what they typed.
 */
const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Drops keys explicitly set to `undefined` so they never reach `$set`. */
const omitUndefined = <T extends object>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };

export class UserService {
  /**
   * Privilege ranking, low to high. Every admin guard is expressed in terms
   * of this ordering via `outranks` — that is what stops an ADMIN from
   * demoting or suspending a SUPER_ADMIN.
   */
  private static readonly RANK: Record<UserRole, number> = {
    USER: 0,
    MERCHANT: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
  };

  // ---------- Self-service ----------

  async updateMe(
    user: IUserDocument,
    input: UpdateMeInput,
  ): Promise<IUserDocument> {
    const updated = await User.findByIdAndUpdate(
      user._id,
      { $set: omitUndefined(input) },
      { new: true, runValidators: true },
    );

    // The document existed a moment ago (requireAuth loaded it), so a miss
    // here means it was removed concurrently.
    if (!updated) {
      throw ApiError.notFound("User not found");
    }
    return updated;
  }

  /**
   * Soft-deletes the account and signs the user out everywhere.
   *
   * Without the Clerk-side step their session stays valid, so every
   * subsequent request would authenticate fine and then be rejected by the
   * DELETED check — they'd appear logged in but permanently forbidden.
   *
   * Sessions are revoked rather than the Clerk user deleted: this is a soft
   * delete, so the identity has to survive for an admin to be able to
   * reactivate the account. Destroying it would also orphan the local record
   * behind the unique email index, locking the address out for good.
   */
  async deleteMe(user: IUserDocument): Promise<void> {
    await User.findByIdAndUpdate(user._id, {
      $set: { status: "DELETED", deletedAt: new Date() },
    });

    try {
      const { data: sessions } = await clerkClient.sessions.getSessionList({
        userId: user.clerkId,
        status: "active",
      });

      await Promise.all(
        sessions.map((session) =>
          clerkClient.sessions.revokeSession(session.id),
        ),
      );
    } catch (error) {
      // The account is already deactivated locally, so requireAuth blocks
      // them regardless — a Clerk failure shouldn't fail the request, but it
      // must not pass unnoticed either.
      console.error(
        `Soft-deleted user ${String(user._id)} but failed to revoke Clerk sessions for ${user.clerkId}`,
        error,
      );
    }
  }

  // ---------- Admin ----------

  async list(query: ListUsersQuery) {
    const { page, limit, role, status, search } = query;

    const filter: QueryFilter<IUser> = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { firstName: pattern },
        { lastName: pattern },
        { email: pattern },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string): Promise<IUserDocument> {
    // The routes validate this, but an unvalidated caller would otherwise
    // get a Mongoose CastError rendered as a 500 instead of a clean 404.
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.notFound("User not found");
    }

    const user = await User.findById(id);
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    return user;
  }

  async updateRole(
    actor: IUserDocument,
    targetId: string,
    { role }: UpdateUserRoleInput,
  ): Promise<IUserDocument> {
    const target = await this.getById(targetId);

    UserService.assertCanManage(actor, target);

    // Same rule as managing: you may only grant a role you outrank. Letting
    // an ADMIN mint peer ADMINs would be a one-way ratchet — they could
    // create accounts they are then forbidden from managing.
    if (!UserService.outranks(actor.role, role)) {
      throw ApiError.forbidden("You cannot assign a role at or above your own");
    }

    target.role = role;
    await target.save();
    return target;
  }

  async updateStatus(
    actor: IUserDocument,
    targetId: string,
    { status }: UpdateUserStatusInput,
  ): Promise<IUserDocument> {
    const target = await this.getById(targetId);

    UserService.assertCanManage(actor, target);

    target.status = status;
    target.deletedAt = status === "DELETED" ? new Date() : null;
    await target.save();
    return target;
  }

  // ---------- Guards ----------

  private static rankOf(role: UserRole): number {
    return UserService.RANK[role];
  }

  /**
   * Whether `actorRole` sits strictly above `otherRole`.
   *
   * SUPER_ADMIN is the exception: nothing outranks it, so super admins must
   * count as outranking their peers or they could neither manage each other
   * nor ever grant the role — leaving it permanently untouchable.
   */
  private static outranks(actorRole: UserRole, otherRole: UserRole): boolean {
    if (actorRole === "SUPER_ADMIN") return true;
    return UserService.rankOf(actorRole) > UserService.rankOf(otherRole);
  }

  /**
   * An admin may act on an account only if they outrank it, and never on
   * their own — self-management is how an admin accidentally locks
   * themselves out or quietly escalates.
   */
  private static assertCanManage(
    actor: IUserDocument,
    target: IUserDocument,
  ): void {
    if (actor._id.equals(target._id)) {
      throw ApiError.forbidden("You cannot change your own role or status");
    }

    if (!UserService.outranks(actor.role, target.role)) {
      throw ApiError.forbidden(
        "You cannot manage an account at or above your own role",
      );
    }
  }
}

export const userService = new UserService();
