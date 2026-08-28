import mongoose, { Document, model, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  salt: string;
  isVerified: boolean;
  verificationToken?: string | undefined;
  verificationTokenExpiresAt?: Date | undefined;
  passwordResetToken?: string | undefined;
  passwordResetTokenExpiresAt?: Date | undefined;
  refreshToken: string | null;
  refreshTokenFamily: string | null;
  avatarUrl: string | null;
  phone: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  roles: "USER" | "MERCHANT" | "ADMIN" | "SUPER ADMIN";
  lastLogin: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    firstName: {
      type: String,
      trim: true,
      minLength: [3, "Name must be more than 3 characters"],
      required: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      minLength: [6, "Password must be at least 6 characters"],
      required: true,
      select: false,
    },
    salt: {
      type: String,
      required: true,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false,
    },
    verificationTokenExpiresAt: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetTokenExpiresAt: {
      type: Date,
      select: false,
    },
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
    refreshTokenFamily: {
      type: String,
      default: null,
      select: false,
    },

    roles: {
      type: String,
      enum: ["USER", "MERCHANT", "ADMIN", "SUPER ADMIN"],
      default: "USER",
    },
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "DELETED"],
      default: "ACTIVE",
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
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ verificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

export const User = model<IUser>("User", userSchema);
