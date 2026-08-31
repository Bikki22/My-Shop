import type { NextFunction, Request, Response } from "express";

/**
 * Route params default to `Record<string, string>` rather than Express's
 * `ParamsDictionary` (`string | string[]`), so `req.params.x` is a plain
 * string. Pass the param shape explicitly for routes that have one:
 *
 *   asyncHandler<{ id: string }>(async (req) => req.params.id)
 */
type AsyncRouteHandler<P> = (
  req: Request<P>,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

const asyncHandler =
  <P = Record<string, string>>(handler: AsyncRouteHandler<P>) =>
  (req: Request<P>, res: Response, next: NextFunction): void => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };

export { asyncHandler };
