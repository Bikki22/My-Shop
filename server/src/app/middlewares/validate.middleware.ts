import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodError, ZodType } from "zod";
import { ApiError, type ApiErrorDetail } from "../utils/ApiError.js";

declare global {
  namespace Express {
    interface Request {
      /**
       * Output of `validateQuery`. Express 5 exposes `req.query` through a
       * getter with no setter, so coerced values (page/limit as numbers,
       * applied defaults) cannot be written back onto `req.query` itself.
       */
      validatedQuery?: unknown;
    }
  }
}

const toDetails = (error: ZodError): ApiErrorDetail[] =>
  error.issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    message: issue.message,
  }));

const parse = <T>(
  schema: ZodType<T>,
  data: unknown,
  next: NextFunction,
  onSuccess: (value: T) => void,
) => {
  const result = schema.safeParse(data);

  if (!result.success) {
    next(ApiError.badRequest("Validation failed", toDetails(result.error)));
    return;
  }

  onSuccess(result.data);
  next();
};

export const validateBody =
  <T>(schema: ZodType<T>): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) =>
    parse(schema, req.body, next, (value) => {
      req.body = value;
    });

export const validateParams =
  <T extends object>(schema: ZodType<T>): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) =>
    // Mutated in place rather than reassigned — the router owns `req.params`
    // and hands the same object to every handler on this route.
    parse(schema, req.params, next, (value) => {
      Object.assign(req.params, value);
    });

export const validateQuery =
  <T>(schema: ZodType<T>): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) =>
    parse(schema, req.query, next, (value) => {
      req.validatedQuery = value;
    });
