import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import {
  User,
  type IUserDocument,
  type UserRole,
} from "../modules/users/user.model.js";

// Extend Express Request so req.user / req.auth are typed everywhere
declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
    }
  }
}

/**
 * Verifies the Clerk session, loads (or lazily creates) the matching
 * DB user, and attaches it to req.user. Blocks suspended/deleted users.
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    let user = await User.findOne({ clerkId: userId });

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const primaryEmail = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress;
      const fallbackEmail =
        primaryEmail ?? clerkUser.emailAddresses[0]?.emailAddress;

      if (!fallbackEmail) {
        throw new Error("No email address found for Clerk user");
      }

      const lastName = clerkUser.lastName?.trim();

      user = await User.create({
        clerkId: userId,
        firstName: clerkUser.firstName || "User",
        ...(lastName ? { lastName } : {}),
        email: fallbackEmail,
        avatarUrl: clerkUser.imageUrl ?? null,
      });
    }

    if (user.status === "DELETED") {
      return res
        .status(403)
        .json({ success: false, message: "Account no longer exists" });
    }
    if (user.status === "SUSPENDED") {
      return res
        .status(403)
        .json({ success: false, message: "Account suspended" });
    }

    User.updateOne({ _id: user._id }, { lastLogin: new Date() }).catch(
      () => {},
    );

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Same as requireAuth but doesn't fail if there's no session —
 * useful for routes that behave differently for guests vs logged-in users
 * (e.g. product listing showing wishlist state).
 */
export const attachUserIfPresent = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return next();

    const user = await User.findOne({ clerkId: userId, status: "ACTIVE" });
    if (user) {
      req.user = user;
    }
    next();
  } catch (err) {
    next(err);
  }
};
/**
 * Role guard — use after requireAuth.
 * e.g. router.get("/admin/users", requireAuth, requireRole("ADMIN", "SUPER_ADMIN"), listUsers)
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden — insufficient role" });
    }
    next();
  };
};
