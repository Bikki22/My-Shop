import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  User,
  type IUser,
  type IUserDocument,
  type UserRole,
} from "../modules/users/user.model.js";

/**
 * `@clerk/express` doesn't re-export its user type, so derive it from the
 * client — that tracks the installed SDK instead of drifting from it.
 */
type ClerkUser = Awaited<ReturnType<typeof clerkClient.users.getUser>>;

// Extend Express Request so req.user is typed everywhere
declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
    }
  }
}

/** How stale `lastLogin` must be before we spend a write refreshing it. */
const LAST_LOGIN_REFRESH_MS = 15 * 60 * 1000;

/** MongoServerError code for a unique-index violation. */
const DUPLICATE_KEY = 11000;

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === DUPLICATE_KEY;

const primaryEmailOf = (clerkUser: ClerkUser): string | undefined => {
  const primary = clerkUser.emailAddresses.find(
    (address) => address.id === clerkUser.primaryEmailAddressId,
  )?.emailAddress;

  return primary ?? clerkUser.emailAddresses[0]?.emailAddress;
};

/**
 * Provisions the local mirror of a Clerk account.
 *
 * `findOne` + `create` races itself: two concurrent requests from a brand
 * new user both miss, both insert, and the loser gets a duplicate-key 500.
 * An upsert makes the insert atomic, and the retry covers the remaining
 * window where the upsert itself loses the race.
 */
const provisionUser = async (clerkId: string): Promise<IUserDocument> => {
  const clerkUser = await clerkClient.users.getUser(clerkId);
  const email = primaryEmailOf(clerkUser);

  if (!email) {
    // A Clerk account with no email can't satisfy our schema. That's a
    // client-visible configuration problem, not a server bug, so don't
    // let it surface as a 500.
    throw new ApiError(
      422,
      "Your account has no email address. Add one in your profile and try again.",
    );
  }

  const lastName = clerkUser.lastName?.trim();

  const insert: Partial<IUser> = {
    clerkId,
    firstName: clerkUser.firstName?.trim() || "User",
    email,
    avatarUrl: clerkUser.imageUrl ?? null,
    ...(lastName ? { lastName } : {}),
  };

  try {
    return await User.findOneAndUpdate(
      { clerkId },
      { $setOnInsert: insert },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // Either the upsert raced another upsert, or this email already
      // belongs to a different clerkId (e.g. the account was recreated).
      const existing = await User.findOne({ clerkId });
      if (existing) return existing;

      throw ApiError.conflict(
        "An account already exists with this email address.",
      );
    }
    throw error;
  }
};

/**
 * `lastLogin` used to be written on *every* authenticated request, which
 * turned each read into a read plus a write. Refresh it only once the
 * stored value is actually stale.
 */
const touchLastLogin = (user: IUserDocument): void => {
  const previous = user.lastLogin?.getTime() ?? 0;
  if (Date.now() - previous < LAST_LOGIN_REFRESH_MS) return;

  const now = new Date();
  user.lastLogin = now;

  // Fire-and-forget: a failure here must not fail the request, but it
  // should still be visible instead of vanishing into an empty catch.
  void User.updateOne({ _id: user._id }, { $set: { lastLogin: now } }).catch(
    (error: unknown) => {
      console.error("Failed to update lastLogin", error);
    },
  );
};

const assertUsable = (user: IUserDocument): void => {
  if (user.status === "DELETED") {
    throw ApiError.forbidden("Account no longer exists");
  }
  if (user.status === "SUSPENDED") {
    throw ApiError.forbidden("Account suspended");
  }
};

/**
 * Verifies the Clerk session, loads (or lazily provisions) the matching DB
 * user, and attaches it to req.user. Blocks suspended/deleted users.
 */
export const requireAuth: RequestHandler = asyncHandler(
  async (req, _res, next) => {
    const { userId } = getAuth(req);

    if (!userId) {
      throw ApiError.unauthorized();
    }

    const user =
      (await User.findOne({ clerkId: userId })) ??
      (await provisionUser(userId));

    assertUsable(user);
    touchLastLogin(user);

    req.user = user;
    next();
  },
);

/**
 * Same as requireAuth but doesn't fail if there's no session — useful for
 * routes that behave differently for guests vs logged-in users (e.g.
 * product listing showing wishlist state).
 *
 * Unlike requireAuth this never provisions: a guest-tolerant route
 * shouldn't be writing user records as a side effect.
 */
export const attachUserIfPresent: RequestHandler = asyncHandler(
  async (req, _res, next) => {
    const { userId } = getAuth(req);
    if (!userId) return next();

    const user = await User.findOne({ clerkId: userId, status: "ACTIVE" });
    if (user) {
      req.user = user;
    }
    next();
  },
);

/**
 * Role guard — use after requireAuth.
 * e.g. router.get("/admin/users", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), listUsers)
 */
export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden("Forbidden — insufficient role"));
    }
    next();
  };
