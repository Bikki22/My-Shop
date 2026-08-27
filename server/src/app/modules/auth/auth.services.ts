import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import { User, IUser } from "../users/user.model.js";

interface RegisterInput {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  phone: string;
}

interface LoginInput {
  email: string;
  password: string;
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

/* -------------------------------------------------------------------------- */
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                             AUTH SERVICE                                   */
/* -------------------------------------------------------------------------- */

export const authService = {
  /* ------------------------------------------------------------------------ */
  /*                              REGISTER                                    */
  /* ------------------------------------------------------------------------ */

  async register(data: RegisterInput): Promise<IUser> {
    const email = data.email.toLowerCase().trim();

    const phone = data.phone.trim();

    /*
     * Check email.
     */

    const existingEmail = await User.findOne({
      email,
    });

    if (existingEmail) {
      throw new Error("An account with this email already exists");
    }

    /*
     * Check phone.
     */

    const existingPhone = await User.findOne({
      phone,
    });

    if (existingPhone) {
      throw new Error("An account with this phone number already exists");
    }

    /*
     * Generate a cryptographic salt.
     *
     * bcrypt already generates its own salt internally,
     * so the "salt" field here is application-level data.
     *
     * We store it because your model requires it.
     */

    const salt = crypto.randomBytes(16).toString("hex");

    /*
     * Hash password.
     */

    const hashedPassword = await bcrypt.hash(data.password, 12);

    /*
     * Generate email verification token.
     *
     * Raw token -> email
     * Hashed token -> database
     */

    const verificationToken = generateRandomToken(32);

    const hashedVerificationToken = hashToken(verificationToken);

    const verificationExpiry = new Date(Date.now() + 20 * 60 * 1000);

    /*
     * Create user.
     */

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

      status: "active",

      roles: "user",

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

    if (user.status === "suspended") {
      throw new Error("Your account has been suspended");
    }

    if (user.status === "deleted") {
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
        expiresIn: ACCESS_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
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
        expiresIn: REFRESH_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
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

    /*
     * Invalidate refresh token.
     */

    user.refreshToken = null;

    /*
     * Destroy the token family too.
     */

    user.refreshTokenFamily = null;

    await user.save({
      validateBeforeSave: false,
    });
  },

  /* ------------------------------------------------------------------------ */
  /*                         REFRESH ACCESS TOKEN                             */
  /* ------------------------------------------------------------------------ */

  async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    if (!refreshToken) {
      throw new Error("Refresh token is required");
    }

    /*
     * Verify JWT.
     */

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

    /*
     * Get refresh token from DB.
     */

    const user = await User.findById(userId).select(
      "+refreshToken +refreshTokenFamily",
    );

    if (!user) {
      throw new Error("User not found");
    }

    if (user.status !== "active") {
      throw new Error("Account is not active");
    }

    /*
     * Hash incoming refresh token.
     */

    const hashedIncomingToken = hashToken(refreshToken);

    /*
     * Compare with stored hash.
     */

    if (user.refreshToken !== hashedIncomingToken) {
      /*
       * This can indicate refresh-token reuse.
       *
       * Later we'll implement full token-family
       * revocation here.
       */

      user.refreshToken = null;
      user.refreshTokenFamily = null;

      await user.save({
        validateBeforeSave: false,
      });

      throw new Error("Refresh token reuse detected");
    }

    /*
     * Rotate refresh token.
     */

    const newAccessToken = jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        roles: user.roles,
      },

      ACCESS_TOKEN_SECRET,

      {
        expiresIn: ACCESS_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
      },
    );

    const newRefreshToken = jwt.sign(
      {
        sub: user._id.toString(),
      },

      REFRESH_TOKEN_SECRET,

      {
        expiresIn: REFRESH_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"],
      },
    );

    /*
     * Store only hash.
     */

    user.refreshToken = hashToken(newRefreshToken);

    await user.save({
      validateBeforeSave: false,
    });

    return {
      accessToken: newAccessToken,

      refreshToken: newRefreshToken,
    };
  },

  /* ------------------------------------------------------------------------ */
  /*                          VERIFY EMAIL                                    */
  /* ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------ */
  /*                         FORGOT PASSWORD                                  */
  /* ------------------------------------------------------------------------ */

  async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    /*
     * Don't expose whether account exists.
     */

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

    /*
     * Send resetToken through email later.
     */

    return {
      resetToken,
      expiresAt: resetExpiry,
    };
  },

  /* ------------------------------------------------------------------------ */
  /*                           RESET PASSWORD                                 */
  /* ------------------------------------------------------------------------ */

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

    /*
     * Hash the new password.
     */

    user.password = await bcrypt.hash(newPassword, 12);

    /*
     * Invalidate reset token.
     */

    user.passwordResetToken = undefined;

    user.passwordResetTokenExpiresAt = undefined;

    /*
     * Invalidate all existing refresh sessions.
     *
     * This forces the user to login again
     * everywhere after password reset.
     */

    user.refreshToken = null;

    user.refreshTokenFamily = null;

    await user.save();
  },
};
