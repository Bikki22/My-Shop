import type { Request } from "express";
import type { IUserDocument } from "../users/user.model.js";

export interface AuthenticatedRequest extends Request {
  user?: IUserDocument;
}

export interface TokenPayload {
  userId: string;
}
