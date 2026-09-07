import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { forbidden } from "../lib/errors.js";

/** Roles with holding-wide (cross-project) access. */
export const GROUP_ROLES: Role[] = [Role.ADMIN, Role.GROUP_EXECUTIVE, Role.CFO, Role.PROCUREMENT_OFFICER, Role.COST_CONTROLLER];

/** Require the user to have one of the given roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(forbidden("Not authenticated"));
    if (!roles.includes(req.user.role)) return next(forbidden(`Role ${req.user.role} is not permitted`));
    next();
  };
}

/** Require the user to have group-level (cross-project) access. */
export function requireGroupAccess(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(forbidden("Not authenticated"));
  if (!GROUP_ROLES.includes(req.user.role)) return next(forbidden("Group-level access required"));
  next();
}

/**
 * Project data isolation: returns a Prisma where-clause fragment that restricts
 * a query to the user's project scope. Group roles see everything.
 */
export function scopeWhere(user?: { role: Role; projectId: number | null }) {
  if (!user) return {};
  if (GROUP_ROLES.includes(user.role)) return {};
  return { projectId: user.projectId ?? -1 };
}

/** True if the user may access the given project. */
export function canAccessProject(user: { role: Role; projectId: number | null }, projectId: number): boolean {
  if (GROUP_ROLES.includes(user.role)) return true;
  return user.projectId === projectId;
}