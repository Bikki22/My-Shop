import mongoose, { model, Types } from "mongoose";
import type { HydratedDocument } from "mongoose";

export type UserRole = "USER" | "MERCHANT" | "ADMIN" | "SUPER_ADMIN";

export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

/**
 * Single source of truth for the allowed values: the Mongoose enum and the
 * Zod schemas both read these, so the two can't drift apart. Declared as
 * const tuples so `z.enum` keeps the literal union instead of widening to
 * `string`.
 */
export const USER_ROLES = [
  "USER",
  "MERCHANT",
  "ADMIN",
  "SUPER_ADMIN",
] as const satisfies readonly UserRole[];

export const USER_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "DELETED",
] as const satisfies readonly UserStatus[];

/**
 * The shape of a user *document's data* — deliberately not extending
 * `Document`. Mixing the two makes `IUser` both the raw shape and a
 * hydrated document, which breaks `.lean()` results and makes
 * `HydratedDocument<IUser>` recursive. Use `IUserDocument` for anything
 * that came back from a query.
 */
export interface IUser {
  _id: Types.ObjectId;
  clerkId: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  status: UserStatus;
  lastLogin?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type IUserDocument = HydratedDocument<IUser>;

const userSchema = new mongoose.Schema<IUser>(
  {
    clerkId: {
      type: String,
      required: true,
      // `unique` already builds the index — adding `index: true` as well
      // makes Mongoose emit a duplicate-index warning at startup.
      unique: true,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
      // Clerk allows single-character given names, so a floor of 2 would
      // reject real accounts with a 500 during provisioning.
      minlength: [1, "First name cannot be empty"],
      maxlength: [50, "First name cannot exceed 50 characters"],
    },

    lastName: {
      type: String,
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },

    phone: {
      type: String,
      trim: true,
      default: null,
    },

    avatarUrl: {
      type: String,
      default: null,
    },

    role: {
      type: String,
      enum: [...USER_ROLES],
      default: "USER",
      index: true,
    },

    status: {
      type: String,
      enum: [...USER_STATUSES],
      default: "ACTIVE",
      index: true,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret["__v"];
        return ret;
      },
    },
  },
);

// The admin list is always "filter, then newest first" — this covers the
// common role/status filters and the sort in one index.
userSchema.index({ status: 1, role: 1, createdAt: -1 });

export const User = model<IUser>("User", userSchema);
