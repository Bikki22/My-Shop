import type { Request, Response, NextFunction } from "express";
import { User, type UserRole, type UserStatus } from "../users/user.model.js";

// ---------- Self-service ----------

export const getMe = async (req: Request, res: Response) => {
  return res.status(200).json({ success: true, data: req.user });
};

export const updateMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Whitelist — never let a user set their own role/status/email via this route
    const { firstName, lastName, phone, avatarUrl } = req.body;

    const updated = await User.findByIdAndUpdate(
      req.user!._id,
      { $set: { firstName, lastName, phone, avatarUrl } },
      { new: true, runValidators: true },
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const deleteMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await User.findByIdAndUpdate(req.user!._id, {
      status: "DELETED",
      deletedAt: new Date(),
    });
    return res.status(200).json({ success: true, message: "Account deleted" });
  } catch (err) {
    next(err);
  }
};

// ---------- Admin ----------

export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const { role, status, search } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const updateUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { role } = req.body as { role: UserRole };
    const validRoles: UserRole[] = ["USER", "MERCHANT", "ADMIN", "SUPER_ADMIN"];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    // Only SUPER_ADMIN can create/modify another SUPER_ADMIN
    if (role === "SUPER_ADMIN" && req.user!.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only a super admin can assign that role",
      });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const updateUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status } = req.body as { status: UserStatus };
    const validStatuses: UserStatus[] = ["ACTIVE", "SUSPENDED", "DELETED"];

    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { status, deletedAt: status === "DELETED" ? new Date() : null },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};
