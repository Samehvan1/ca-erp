import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/error.js";
import { requireAuth, signToken } from "../../middleware/auth.js";
import { audit } from "../../lib/audit.js";
import { badRequest, notFound, unauthorized } from "../../lib/errors.js";
import { AuditAction } from "@prisma/client";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }
    if (!user.active) throw unauthorized("Account is disabled");
    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role, projectId: user.projectId });
    await audit({ userId: user.id, action: AuditAction.LOGIN, entityType: "User", entityId: String(user.id), ip: req.ip });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, projectId: user.projectId } });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { project: true },
    });
    res.json(user);
  })
);

// ============ PASSWORD MANAGEMENT ============

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
      throw unauthorized("Current password is incorrect");
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(body.newPassword, 10) } });
    await audit({ userId: user.id, action: AuditAction.UPDATE, entityType: "User", entityId: String(user.id), after: { passwordChanged: true }, ip: req.ip });
    res.json({ ok: true });
  })
);

const forgotPasswordSchema = z.object({ email: z.string().email() });

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const body = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    // Always return ok to avoid user enumeration; only issue a token for known accounts
    if (!user) return res.json({ ok: true });
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await audit({ userId: user.id, action: AuditAction.CREATE, entityType: "PasswordResetToken", entityId: String(user.id), ip: req.ip });
    // SMTP delivery is deployment-level; in dev the token is returned so the flow is testable.
    console.log(`[auth] password reset token for ${user.email}: ${token}`);
    res.json({ ok: true, devToken: process.env.NODE_ENV === "production" ? undefined : token });
  })
);

const resetPasswordSchema = z.object({
  token: z.string().min(32),
  newPassword: z.string().min(8),
});

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const body = resetPasswordSchema.parse(req.body);
    const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex");
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw badRequest("Invalid or expired reset token");
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await bcrypt.hash(body.newPassword, 10) } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    await audit({ userId: record.userId, action: AuditAction.UPDATE, entityType: "User", entityId: String(record.userId), after: { passwordReset: true }, ip: req.ip });
    res.json({ ok: true });
  })
);

export default router;