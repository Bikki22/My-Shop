import { Request, Response } from "express";

import { authService } from "./auth.service.js";
import { loginSchema, registerSchema } from "./auth.validation.js";

const ACCESS_TOKEN_COOKIE = "access_token";

const REFRESH_TOKEN_COOKIE = "refresh_token";

/* -------------------------------------------------------------------------- */
/*                           COOKIE CONFIG                                    */
/* -------------------------------------------------------------------------- */

const getCookieOptions = () => ({
  httpOnly: true,

  secure: process.env.NODE_ENV === "production",

  sameSite:
    process.env.NODE_ENV === "production"
      ? ("none" as const)
      : ("lax" as const),

  path: "/",
});

/* -------------------------------------------------------------------------- */
/*                             AUTH CONTROLLER                                */
/* -------------------------------------------------------------------------- */

export const authController = {
  /* ------------------------------------------------------------------------ */
  /*                              REGISTER                                    */
  /* ------------------------------------------------------------------------ */

  async register(req: Request, res: Response): Promise<void> {
    const validatedData = registerSchema.parse(req.body);

    const user = await authService.register(validatedData);

    res.status(201).json({
      success: true,

      message: "Account created successfully",

      data: {
        user,
      },
    });
  },

  /* ------------------------------------------------------------------------ */
  /*                                 LOGIN                                    */
  /* ------------------------------------------------------------------------ */

  async login(req: Request, res: Response): Promise<void> {
    const validatedData = loginSchema.parse(req.body);

    const { user, accessToken, refreshToken } =
      await authService.login(validatedData);

    const cookieOptions = getCookieOptions();

    /*
     * Access token
     */

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...cookieOptions,

      maxAge: 15 * 60 * 1000,
    });

    /*
     * Refresh token
     */

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...cookieOptions,

      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,

      message: "Login successful",

      data: {
        user,
      },
    });
  },

  /* ------------------------------------------------------------------------ */
  /*                                 LOGOUT                                   */
  /* ------------------------------------------------------------------------ */

  async logout(req: Request, res: Response): Promise<void> {
    /*
     * This expects authentication middleware
     * to eventually add req.user.
     *
     * We'll implement that middleware next.
     */

    const userId = (
      req as Request & {
        user?: {
          _id: string;
        };
      }
    ).user?._id;

    if (userId) {
      await authService.logout(userId);
    }

    const cookieOptions = getCookieOptions();

    res.clearCookie(ACCESS_TOKEN_COOKIE, cookieOptions);

    res.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions);

    res.status(200).json({
      success: true,

      message: "Logged out successfully",
    });
  },

  /* ------------------------------------------------------------------------ */
  /*                         REFRESH TOKEN                                    */
  /* ------------------------------------------------------------------------ */

  async refreshToken(req: Request, res: Response): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      throw new Error("Refresh token is required");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await authService.refreshAccessToken(refreshToken);

    const cookieOptions = getCookieOptions();

    /*
     * Replace access token.
     */

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...cookieOptions,

      maxAge: 15 * 60 * 1000,
    });

    /*
     * Replace refresh token.
     *
     * This is refresh-token rotation.
     */

    res.cookie(REFRESH_TOKEN_COOKIE, newRefreshToken, {
      ...cookieOptions,

      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,

      message: "Access token refreshed",
    });
  },

  /* ------------------------------------------------------------------------ */
  /*                           VERIFY EMAIL                                   */
  /* ------------------------------------------------------------------------ */

  async verifyEmail(req: Request, res: Response): Promise<void> {
    const token = req.body.token || req.query.token;

    if (typeof token !== "string") {
      throw new Error("Verification token is required");
    }

    const user = await authService.verifyEmail(token);

    res.status(200).json({
      success: true,

      message: "Email verified successfully",

      data: {
        user,
      },
    });
  },

  /* ------------------------------------------------------------------------ */
  /*                          FORGOT PASSWORD                                 */
  /* ------------------------------------------------------------------------ */

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const email = req.body.email;

    if (typeof email !== "string") {
      throw new Error("Email is required");
    }

    await authService.forgotPassword(email);

    /*
     * Always return the same message.
     *
     * This prevents email enumeration.
     */

    res.status(200).json({
      success: true,

      message:
        "If an account exists with that email, a password reset link has been sent.",
    });
  },

  /* ------------------------------------------------------------------------ */
  /*                           RESET PASSWORD                                 */
  /* ------------------------------------------------------------------------ */

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { token, password } = req.body;

    if (typeof token !== "string") {
      throw new Error("Reset token is required");
    }

    if (typeof password !== "string") {
      throw new Error("New password is required");
    }

    await authService.resetPassword(token, password);

    res.status(200).json({
      success: true,

      message: "Password reset successfully",
    });
  },
};
