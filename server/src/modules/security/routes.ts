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

// Audit trail (group roles see all; project roles see their own project's events or specific entity history)
// Optional ?entityType= & ?entityId= filters power per-record version history.
router.get(
  "/audit",
  asyncHandler(async (req, res) => {
    const isGroup = GROUP_ROLES.includes(req.user!.role);
    const { entityType, entityId } = req.query;
    const where: Prisma.AuditLogWhereInput = {};
    if (entityType) where.entityType = String(entityType);
    if (entityId) where.entityId = String(entityId);
    if (!isGroup && !entityType && !entityId) {
      where.userId = req.user!.id;
    }
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

// Roles list with capability matrix definition
export const ROLE_CAPABILITIES = {
  [Role.ADMIN]: {
    name: "System Administrator",
    level: "Super User",
    scope: "GLOBAL",
    description: "Full system administration, user provisioning, security audits, database configuration, and ERP-wide master data.",
    capabilities: [
      "user_management", "security_audit", "vendor_management", "requisitions_create", "requisitions_approve",
      "purchase_orders", "grn_qc_receiving", "transfers_request", "transfers_dispatch_receive",
      "stock_adjustments", "stocktaking_reconciliation", "recipes_bom", "waste_logging",
      "invoicing_ap_payments", "landed_cost_allocation", "master_data_categories_uom", "consolidated_reports"
    ]
  },
  [Role.GROUP_EXECUTIVE]: {
    name: "Group Executive",
    level: "Executive",
    scope: "GLOBAL",
    description: "Group-wide governance, cross-project visibility, strategic procurement approval, master data oversight, and consolidated analytics.",
    capabilities: [
      "user_management", "security_audit", "vendor_management", "requisitions_approve", "purchase_orders",
      "stocktaking_reconciliation", "master_data_categories_uom", "consolidated_reports"
    ]
  },
  [Role.CFO]: {
    name: "Chief Financial Officer",
    level: "Executive",
    scope: "GLOBAL",
    description: "Financial management, 3-way invoice matching, AP ledger, payments disbursement, landed costs, and financial analytics.",
    capabilities: [
      "security_audit", "vendor_management", "requisitions_approve", "purchase_orders",
      "invoicing_ap_payments", "landed_cost_allocation", "consolidated_reports"
    ]
  },
  [Role.PROCUREMENT_OFFICER]: {
    name: "Procurement Officer",
    level: "Operational",
    scope: "GLOBAL",
    description: "Vendor sourcing, price lists, SLA tracking, requisition-to-PO conversion, and supplier purchase orders.",
    capabilities: [
      "vendor_management", "requisitions_create", "requisitions_approve", "purchase_orders",
      "invoicing_ap_payments", "landed_cost_allocation"
    ]
  },
  [Role.PROJECT_WAREHOUSE_MANAGER]: {
    name: "Project Warehouse Manager",
    level: "Operational",
    scope: "PROJECT",
    description: "Warehouse inventory control, GRN receiving with QC, FEFO batch tracking, stock adjustments, and project stocktaking.",
    capabilities: [
      "requisitions_create", "grn_qc_receiving", "transfers_request", "transfers_dispatch_receive",
      "stock_adjustments", "stocktaking_reconciliation", "waste_logging"
    ]
  },
  [Role.BRANCH_MANAGER]: {
    name: "Branch Manager",
    level: "Operational",
    scope: "BRANCH",
    description: "Branch replenishment requests, transfer receiving, daily waste logging, and branch stock count execution.",
    capabilities: [
      "requisitions_create", "transfers_request", "transfers_dispatch_receive", "waste_logging", "stocktaking_reconciliation"
    ]
  },
  [Role.HEAD_CHEF]: {
    name: "Head Chef",
    level: "Operational",
    scope: "PROJECT",
    description: "Kitchen recipe Bill of Materials (BOM), kitchen inventory requisition, daily kitchen waste logs, and portion costing.",
    capabilities: [
      "requisitions_create", "recipes_bom", "waste_logging"
    ]
  },
  [Role.HEAD_BARISTA]: {
    name: "Head Barista",
    level: "Operational",
    scope: "PROJECT",
    description: "Bar & beverage recipe Bill of Materials (BOM), beverage requisition requests, and bar waste logs.",
    capabilities: [
      "requisitions_create", "recipes_bom", "waste_logging"
    ]
  },
  [Role.COST_CONTROLLER]: {
    name: "Cost Controller",
    level: "Governance",
    scope: "GLOBAL",
    description: "Variance reconciliation, stock audit verification, standard vs actual recipe costings, and adjustment approval.",
    capabilities: [
      "security_audit", "stocktaking_reconciliation", "recipes_bom", "stock_adjustments",
      "master_data_categories_uom", "consolidated_reports"
    ]
  },
};

// Roles list
router.get(
  "/roles",
  asyncHandler(async (_req, res) => {
    res.json(Object.values(Role));
  })
);

// Roles matrix metadata
router.get(
  "/roles/matrix",
  asyncHandler(async (_req, res) => {
    res.json({
      roles: Object.values(Role),
      matrix: ROLE_CAPABILITIES,
      capabilities: [
        { id: "user_management", label: "User & Security Management", module: "Security" },
        { id: "security_audit", label: "Tamper-Evident Audit Trail", module: "Security" },
        { id: "vendor_management", label: "Vendor Onboarding & Price Lists", module: "Suppliers" },
        { id: "requisitions_create", label: "Create Supply Requisitions", module: "Procurement" },
        { id: "requisitions_approve", label: "Approve Supply Requisitions", module: "Procurement" },
        { id: "purchase_orders", label: "Generate & Manage Purchase Orders", module: "Procurement" },
        { id: "grn_qc_receiving", label: "GRN Receiving & QC Inspection", module: "Procurement" },
        { id: "transfers_request", label: "Request Stock Transfers", module: "Transfers" },
        { id: "transfers_dispatch_receive", label: "Dispatch & Receive Transfers", module: "Transfers" },
        { id: "stock_adjustments", label: "Perform Stock Adjustments", module: "Inventory" },
        { id: "stocktaking_reconciliation", label: "Stocktaking & Variance Reconciliation", module: "Stocktaking" },
        { id: "recipes_bom", label: "Recipe Bill of Materials (BOM)", module: "Production" },
        { id: "waste_logging", label: "Log Production & Expiry Waste", module: "Waste" },
        { id: "invoicing_ap_payments", label: "Invoice 3-Way Match & AP Payments", module: "Finance" },
        { id: "landed_cost_allocation", label: "Landed Cost Allocation", module: "Finance" },
        { id: "master_data_categories_uom", label: "Categories, Units & Conversions", module: "Master Data" },
        { id: "consolidated_reports", label: "Consolidated Cross-Project Analytics", module: "Analytics" },
      ]
    });
  })
);

// Quick role assignment
router.patch(
  "/users/:id/role",
  requireGroupAccess,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ role: z.nativeEnum(Role) }).parse(req.body);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw notFound("User not found");

    const user = await prisma.user.update({
      where: { id },
      data: { role: body.role },
      include: { project: true }
    });

    await audit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: "UserRole",
      entityId: String(id),
      before: { role: existing.role },
      after: { role: user.role },
      ip: req.ip,
    });

    res.json({ ...user, passwordHash: undefined });
  })
);

export default router;