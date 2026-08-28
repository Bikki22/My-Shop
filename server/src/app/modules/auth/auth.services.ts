import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import { User, type IUser } from "../users/user.model.js";

interface LoginInput {
  email: string;
  password: string;
}
interface RegisterInput {
  firstName: string;
  lastName: string | null;
  email: string;
  password: string;
  phone: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: IUser;
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "15m";

const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

if (!ACCESS_TOKEN_SECRET) {
  throw new Error("ACCESS_TOKEN_SECRET is not configured");
}

if (!REFRESH_TOKEN_SECRET) {
  throw new Error("REFRESH_TOKEN_SECRET is not configured");
}

const generateRandomToken = (bytes = 32): string => {
  return crypto.randomBytes(bytes).toString("hex");
};

const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const sanitizeUser = (user: IUser) => {
  const userObject = user.toObject();

  delete userObject.password;
  delete userObject.salt;
  delete userObject.refreshToken;
  delete userObject.refreshTokenFamily;
  delete userObject.verificationToken;
  delete userObject.verificationTokenExpiresAt;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetTokenExpiresAt;

  return userObject;
};

export const authService = {
  async register(data: RegisterInput): Promise<IUser> {
    const email = data.email.toLowerCase().trim();

    const phone = data.phone.trim();

    const existingEmail = await User.findOne({
      email,
    });

    if (existingEmail) {
      throw new Error("An account with this email already exists");
    }

    const existingPhone = await User.findOne({
      phone,
    });

    if (existingPhone) {
      throw new Error("An account with this phone number already exists");
    }

    const salt = crypto.randomBytes(16).toString("hex");

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const verificationToken = generateRandomToken(32);

    const hashedVerificationToken = hashToken(verificationToken);

    const verificationExpiry = new Date(Date.now() + 20 * 60 * 1000);

    const user = await User.create({
      firstName: data.firstName.trim(),

      lastName: data.lastName?.trim() || "",

      email,

      password: hashedPassword,

      salt,

      phone,

      isVerified: false,

      verificationToken: hashedVerificationToken,

      verificationTokenExpiresAt: verificationExpiry,

      status: "ACTIVE",

      roles: "USER",

      lastLogin: null,

      deletedAt: null,

      avatarUrl: null,

      refreshToken: null,

      refreshTokenFamily: null,
    });

    /*
     * In a real application, the raw verification token
     * would now be passed to an email service.
     *
     * Example:
     *
     * await emailService.sendVerificationEmail(
     *   user.email,
     *   verificationToken,
     * );
     *
     * We'll build that later.
     */

    return sanitizeUser(user) as IUser;
  },

  /* ------------------------------------------------------------------------ */
  /*                                LOGIN                                     */
  /* ------------------------------------------------------------------------ */

  async login(data: LoginInput): Promise<AuthResponse> {
    const email = data.email.toLowerCase().trim();

    /*
     * Password has select:false,
     * therefore explicitly select it.
     */

    const user = await User.findOne({
      email,
    }).select("+password +salt +refreshToken +refreshTokenFamily");

    /*
     * Never reveal whether email exists.
     */

    if (!user) {
      throw new Error("Invalid email or password");
    }

    /*
     * Check account status.
     */

    if (user.status === "SUSPENDED") {
      throw new Error("Your account has been suspended");
    }

    if (user.status === "DELETED") {
      throw new Error("This account no longer exists");
    }

    /*
     * Verify password.
     */

    const passwordCorrect = await bcrypt.compare(data.password, user.password);

    if (!passwordCorrect) {
      throw new Error("Invalid email or password");
    }

    /*
     * Generate access token.
     */

    const accessToken = jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        roles: user.roles,
      },

      ACCESS_TOKEN_SECRET,

      {
        expiresIn: ACCESS_TOKEN_EXPIRY as NonNullable<
          jwt.SignOptions["expiresIn"]
        >,
      },
    );

    /*
     * Generate refresh token.
     */

    const refreshToken = jwt.sign(
      {
        sub: user._id.toString(),
      },

      REFRESH_TOKEN_SECRET,

      {
        expiresIn: REFRESH_TOKEN_EXPIRY as NonNullable<
          jwt.SignOptions["expiresIn"]
        >,
      },
    );

    /*
     * Generate refresh token family.
     *
     * A token family allows us to detect refresh-token
     * reuse later.
     */

    const refreshTokenFamily =
      user.refreshTokenFamily || generateRandomToken(32);

    /*
     * Store HASH of refresh token.
     *
     * Never store the raw refresh token.
     */

    const hashedRefreshToken = hashToken(refreshToken);

    user.refreshToken = hashedRefreshToken;

    user.refreshTokenFamily = refreshTokenFamily;

    user.lastLogin = new Date();

    await user.save({
      validateBeforeSave: false,
    });

    return {
      user: sanitizeUser(user) as IUser,

      accessToken,

      refreshToken,
    };
  },

  /* ------------------------------------------------------------------------ */
  /*                                LOGOUT                                    */
  /* ------------------------------------------------------------------------ */

  async logout(userId: string): Promise<void> {
    const user = await User.findById(userId).select(
      "+refreshToken +refreshTokenFamily",
    );

    if (!user) {
      return;
    }

    user.refreshToken = null;

    user.refreshTokenFamily = null;

    await user.save({
      validateBeforeSave: false,
    });
  },

  async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    if (!refreshToken) {
      throw new Error("Refresh token is required");
    }

    let decoded: jwt.JwtPayload;

    try {
      decoded = jwt.verify(
        refreshToken,
        REFRESH_TOKEN_SECRET,
      ) as jwt.JwtPayload;
    } catch {
      throw new Error("Invalid or expired refresh token");
    }

    const userId = decoded.sub;

    if (!userId) {
      throw new Error("Invalid refresh token");
    }

    const user = await User.findById(userId).select(
      "+refreshToken +refreshTokenFamily",
    );

    if (!user) {
      throw new Error("User not found");
    }

    if (user.status !== "ACTIVE") {
      throw new Error("Account is not active");
    }

    const hashedIncomingToken = hashToken(refreshToken);

    if (user.refreshToken !== hashedIncomingToken) {
      user.refreshToken = null;
      user.refreshTokenFamily = null;

      await user.save({
        validateBeforeSave: false,
      });

      throw new Error("Refresh token reuse detected");
    }

    const newAccessToken = jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        roles: user.roles,
      },

      ACCESS_TOKEN_SECRET,

      {
        expiresIn: ACCESS_TOKEN_EXPIRY as NonNullable<
          jwt.SignOptions["expiresIn"]
        >,
      },
    );

    const newRefreshToken = jwt.sign(
      {
        sub: user._id.toString(),
      },

      REFRESH_TOKEN_SECRET,

      {
        expiresIn: REFRESH_TOKEN_EXPIRY as NonNullable<
          jwt.SignOptions["expiresIn"]
        >,
      },
    );

    user.refreshToken = hashToken(newRefreshToken);

    await user.save({
      validateBeforeSave: false,
    });

    return {
      accessToken: newAccessToken,

      refreshToken: newRefreshToken,
    };
  },

  async verifyEmail(token: string): Promise<IUser> {
    if (!token) {
      throw new Error("Verification token is required");
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      verificationToken: hashedToken,

      verificationTokenExpiresAt: {
        $gt: new Date(),
      },
    }).select("+verificationToken +verificationTokenExpiresAt");

    if (!user) {
      throw new Error("Invalid or expired verification token");
    }

    user.isVerified = true;

    user.verificationToken = undefined;

    user.verificationTokenExpiresAt = undefined;

    await user.save({
      validateBeforeSave: false,
    });

    return sanitizeUser(user) as IUser;
  },

  async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return null;
    }

    const resetToken = generateRandomToken(32);

    const hashedResetToken = hashToken(resetToken);

    const resetExpiry = new Date(Date.now() + 20 * 60 * 1000);

    user.passwordResetToken = hashedResetToken;

    user.passwordResetTokenExpiresAt = resetExpiry;

    await user.save({
      validateBeforeSave: false,
    });

    return {
      resetToken,
      expiresAt: resetExpiry,
    };
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = hashToken(token);

    const user = await User.findOne({
      passwordResetToken: hashedToken,

      passwordResetTokenExpiresAt: {
        $gt: new Date(),
      },
    }).select("+passwordResetToken +passwordResetTokenExpiresAt");

    if (!user) {
      throw new Error("Invalid or expired password reset token");
    }

    user.password = await bcrypt.hash(newPassword, 12);

    user.passwordResetToken = undefined;

    user.passwordResetTokenExpiresAt = undefined;

    user.refreshToken = null;

    user.refreshTokenFamily = null;

    await user.save();
  },
};
