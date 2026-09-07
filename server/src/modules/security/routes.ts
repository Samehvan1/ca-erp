import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, isForeignKeyViolation } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, requireGroupAccess, scopeWhere } from "../../middleware/rbac.js";
import { audit, verifyAuditChain } from "../../lib/audit.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { AuditAction, Prisma, Role } from "@prisma/client";
import { GROUP_ROLES } from "../../middleware/rbac.js";

const router = Router();
router.use(requireAuth);

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.nativeEnum(Role),
  projectId: z.number().int().nullable().optional(),
  password: z.string().min(6).optional(),
});

// List users (scoped by project isolation)
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: scopeWhere(req.user),
      include: { project: true },
      orderBy: { id: "asc" },
    });
    res.json(users.map((u) => ({ ...u, passwordHash: undefined })));
  })
);

// Create user (group roles only)
router.post(
  "/users",
  requireGroupAccess,
  asyncHandler(async (req, res) => {
    const body = userSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) throw conflict("Email already registered");
    const passwordHash = await bcrypt.hash(body.password || "Change@123", 10);
    const user = await prisma.user.create({
      data: { email: body.email.toLowerCase(), name: body.name, role: body.role, projectId: body.projectId ?? null, passwordHash },
    });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "User", entityId: String(user.id), after: { email: user.email, role: user.role }, ip: req.ip });
    res.status(201).json({ ...user, passwordHash: undefined });
  })
);

// Update user
router.patch(
  "/users/:id",
  requireGroupAccess,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = userSchema.partial().parse(req.body);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw notFound("User not found");
    const data: Record<string, unknown> = {};
    if (body.name) data.name = body.name;
    if (body.role) data.role = body.role;
    if (body.projectId !== undefined) data.projectId = body.projectId;
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.update({ where: { id }, data });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "User", entityId: String(id), before: { role: existing.role }, after: { role: user.role }, ip: req.ip });
    res.json({ ...user, passwordHash: undefined });
  })
);

// Delete user
router.delete(
  "/users/:id",
  requireGroupAccess,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw notFound("User not found");
    if (id === req.user!.id) throw badRequest("You cannot delete your own account");
    try {
      await prisma.user.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: user is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "User", entityId: String(id), before: { email: existing.email, role: existing.role }, ip: req.ip });
    res.json({ ok: true });
  })
);

// Audit trail (group roles see all; project roles see their own project's events)
// Optional ?entityType= & ?entityId= filters power per-record version history.
router.get(
  "/audit",
  asyncHandler(async (req, res) => {
    const isGroup = GROUP_ROLES.includes(req.user!.role);
    const { entityType, entityId } = req.query;
    const where: Prisma.AuditLogWhereInput = isGroup ? {} : { userId: req.user!.id };
    if (entityType) where.entityType = String(entityType);
    if (entityId) where.entityId = String(entityId);
    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { email: true, name: true } } },
      orderBy: { id: "desc" },
      take: 200,
    });
    res.json(logs);
  })
);

// Verify audit chain integrity
router.get(
  "/audit/verify",
  requireGroupAccess,
  asyncHandler(async (_req, res) => {
    const intact = await verifyAuditChain();
    res.json({ intact });
  })
);

// Roles list
router.get(
  "/roles",
  asyncHandler(async (_req, res) => {
    res.json(Object.values(Role));
  })
);

export default router;