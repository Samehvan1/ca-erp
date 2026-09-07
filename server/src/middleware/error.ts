import { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/errors.js";

/** Wrap async route handlers so thrown errors reach the error middleware. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, "Route not found"));
}

/**
 * Detect foreign-key violations from Prisma/Postgres so DELETE handlers can
 * return a friendly 400 instead of leaking a raw driver error.
 * Prisma reports these as P2003; raw Postgres RESTRICT violations surface as
 * code 23001 (sometimes nested inside a ConnectorError without a top-level code).
 */
export function isForeignKeyViolation(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (code === "P2003" || code === "23001") return true;
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("foreign key") || msg.includes("RESTRICT") || msg.includes("23001");
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  // Log safely: some error objects (e.g. Prisma) break util.inspect on Node.
  const safe = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error("Unhandled error:", safe);
  const message = err instanceof Error ? err.message : "Internal server error";
  return res.status(500).json({ error: message });
}