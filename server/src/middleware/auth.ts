import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { unauthorized } from "../lib/errors.js";
import { Role } from "@prisma/client";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  projectId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, projectId: user.projectId }, config.jwtSecret, {
    expiresIn: "12h",
  });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw unauthorized("Missing bearer token");
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwtSecret) as { id: number };
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.active) throw unauthorized("Invalid or inactive user");
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role, projectId: user.projectId };
    next();
  } catch (e) {
    next(e instanceof Error && e.message === "Missing bearer token" ? unauthorized("Missing bearer token") : unauthorized("Invalid or expired token"));
  }
}