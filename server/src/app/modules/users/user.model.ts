import mongoose, { Document, model, Types } from "mongoose";
import type { HydratedDocument } from "mongoose";

export type UserRole = "USER" | "MERCHANT" | "ADMIN" | "SUPER_ADMIN";

export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export interface IUser extends Document {
  _id: Types.ObjectId;

  clerkId: string;

  firstName: string;

  lastName?: string;

  email: string;

  phone?: string;

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
      unique: true,
      index: true,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, "First name must be at least 2 characters"],
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
      lowercase: true,
      trim: true,
      index: true,
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
      enum: ["USER", "MERCHANT", "ADMIN", "SUPER_ADMIN"],
      default: "USER",
      index: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "DELETED"],
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
  },
);

export const User = model<IUser>("User", userSchema);
