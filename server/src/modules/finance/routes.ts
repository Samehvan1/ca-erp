import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, isForeignKeyViolation } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { audit } from "../../lib/audit.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { recalcWac } from "../../lib/stock.js";
import { AuditAction, Role } from "@prisma/client";

const router = Router();
router.use(requireAuth);

// ============ GL ACCOUNTS & COST CENTERS ============

const accountSchema = z.object({ code: z.string().min(1), name: z.string().min(1), type: z.enum(["ASSET", "LIABILITY", "EXPENSE", "REVENUE", "EQUITY"]) });

router.get(
  "/accounts",
  asyncHandler(async (_req, res) => {
    const accounts = await prisma.glAccount.findMany({ include: { entries: true }, orderBy: { code: "asc" } });
    res.json(accounts);
  })
);

router.post(
  "/accounts",
  requireRole(Role.ADMIN, Role.CFO, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = accountSchema.parse(req.body);
    const account = await prisma.glAccount.create({ data: body });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "GlAccount", entityId: String(account.id), after: body, ip: req.ip });
    res.status(201).json(account);
  })
);

router.patch(
  "/accounts/:id",
  requireRole(Role.ADMIN, Role.CFO, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = accountSchema.partial().parse(req.body);
    const existing = await prisma.glAccount.findUnique({ where: { id } });
    if (!existing) throw notFound("GlAccount not found");
    const updated = await prisma.glAccount.update({ where: { id }, data: body });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "GlAccount", entityId: String(id), before: { ...existing }, after: { ...updated }, ip: req.ip });
    res.json(updated);
  })
);

router.delete(
  "/accounts/:id",
  requireRole(Role.ADMIN, Role.CFO, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.glAccount.findUnique({ where: { id }, include: { entries: true } });
    if (!existing) throw notFound("GlAccount not found");
    if (existing.entries.length > 0) throw badRequest("Cannot delete: account has journal entries");
    try {
      await prisma.glAccount.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "GlAccount", entityId: String(id), before: { ...existing }, ip: req.ip });
    res.json({ ok: true });
  })
);

const costCenterSchema = z.object({ code: z.string().min(1), name: z.string().min(1), level: z.enum(["HOLDING", "PROJECT", "WAREHOUSE"]), projectId: z.number().int().nullable().optional(), warehouseId: z.number().int().nullable().optional() });

router.get(
  "/cost-centers",
  asyncHandler(async (_req, res) => {
    const centers = await prisma.costCenter.findMany({ include: { project: true, warehouse: true }, orderBy: { code: "asc" } });
    res.json(centers);
  })
);

router.post(
  "/cost-centers",
  requireRole(Role.ADMIN, Role.CFO, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = costCenterSchema.parse(req.body);
    const center = await prisma.costCenter.create({ data: { code: body.code, name: body.name, level: body.level, projectId: body.projectId ?? null, warehouseId: body.warehouseId ?? null } });
    res.status(201).json(center);
  })
);

router.patch(
  "/cost-centers/:id",
  requireRole(Role.ADMIN, Role.CFO, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = costCenterSchema.partial().parse(req.body);
    const existing = await prisma.costCenter.findUnique({ where: { id } });
    if (!existing) throw notFound("CostCenter not found");
    const updated = await prisma.costCenter.update({ where: { id }, data: { code: body.code, name: body.name, level: body.level, projectId: body.projectId ?? null, warehouseId: body.warehouseId ?? null } });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "CostCenter", entityId: String(id), before: { ...existing }, after: { ...updated }, ip: req.ip });
    res.json(updated);
  })
);

router.delete(
  "/cost-centers/:id",
  requireRole(Role.ADMIN, Role.CFO, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.costCenter.findUnique({ where: { id } });
    if (!existing) throw notFound("CostCenter not found");
    try {
      await prisma.costCenter.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "CostCenter", entityId: String(id), before: { ...existing }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ============ GL POSTING (double-entry) ============

const glPostSchema = z.object({
  postingKey: z.string().min(1),
  refType: z.string().min(1),
  refId: z.string().optional(),
  lines: z.array(z.object({ accountId: z.number().int(), costCenterId: z.number().int().nullable().optional(), debit: z.number().nonnegative().optional(), credit: z.number().nonnegative().optional() })).min(2),
});

router.get(
  "/postings",
  asyncHandler(async (req, res) => {
    const refType = req.query.refType as string | undefined;
    const entries = await prisma.glEntry.findMany({
      where: refType ? { refType } : undefined,
      include: { account: true, costCenter: true },
      orderBy: { id: "desc" },
    });
    res.json(entries);
  })
);

router.post(
  "/postings",
  requireRole(Role.ADMIN, Role.CFO, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = glPostSchema.parse(req.body);
    const existing = await prisma.glEntry.findFirst({ where: { postingKey: { startsWith: `${body.postingKey}:` } } });
    if (existing) throw badRequest("Posting key already exists (duplicate posting)");

    const totalDebit = body.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalCredit = body.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) throw badRequest(`Unbalanced posting: debit ${totalDebit} != credit ${totalCredit}`);

    const entries = await prisma.$transaction(
      body.lines.map((l, i) =>
        prisma.glEntry.create({ data: { accountId: l.accountId, costCenterId: l.costCenterId ?? null, debit: l.debit ?? 0, credit: l.credit ?? 0, refType: body.refType, refId: body.refId ?? null, postingKey: `${body.postingKey}:${i}` } })
      )
    );
    await audit({ userId: req.user!.id, action: AuditAction.POST, entityType: "GlEntry", entityId: body.postingKey, after: { refType: body.refType, totalDebit, totalCredit }, ip: req.ip });
    res.status(201).json({ postingKey: body.postingKey, entries });
  })
);

// ============ AP LEDGER ============

router.get(
  "/ap-ledger",
  asyncHandler(async (_req, res) => {
    const ledger = await prisma.apLedger.findMany({ include: { vendor: true, po: true, invoice: true }, orderBy: { createdAt: "desc" } });
    res.json(ledger);
  })
);

router.get(
  "/ap-ledger/:vendorId/balance",
  asyncHandler(async (req, res) => {
    const vendorId = Number(req.params.vendorId);
    const last = await prisma.apLedger.findFirst({ where: { vendorId }, orderBy: { id: "desc" } });
    res.json({ vendorId, balance: last?.balance ?? 0 });
  })
);

// ============ VALUATION (WAC / FIFO) ============

router.get(
  "/valuation/:itemId",
  asyncHandler(async (req, res) => {
    const itemId = Number(req.params.itemId);
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw notFound("Item not found");
    const wac = await recalcWac(itemId);
    // FIFO: value in-stock ledger layers by oldest entry first
    const layers = await prisma.stockLedger.findMany({ where: { itemId, balance: { gt: 0 } }, orderBy: { id: "asc" } });
    const fifoValue = layers.reduce((s, l) => s + l.balance * l.unitCost, 0);
    const fifoQty = layers.reduce((s, l) => s + l.balance, 0);
    res.json({ itemId, item: item.description, valuationMethod: item.valuationMethod, wac, fifo: { qty: fifoQty, value: fifoValue, unitCost: fifoQty > 0 ? fifoValue / fifoQty : 0 }, layers });
  })
);

// ============ TRIAL BALANCE ============

router.get(
  "/trial-balance",
  asyncHandler(async (_req, res) => {
    const accounts = await prisma.glAccount.findMany({ include: { entries: true } });
    const rows = accounts.map((a) => {
      const debit = a.entries.reduce((s, e) => s + e.debit, 0);
      const credit = a.entries.reduce((s, e) => s + e.credit, 0);
      return { code: a.code, name: a.name, type: a.type, debit, credit, balance: debit - credit };
    });
    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    res.json({ rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 });
  })
);

export default router;