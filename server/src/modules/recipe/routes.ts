import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, isForeignKeyViolation } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { audit } from "../../lib/audit.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { postStockMove, recalcWac, fefoPick } from "../../lib/stock.js";
import { postGl, ensureAccount } from "../../lib/gl.js";
import { AuditAction, PosTransactionStatus, RecipeType, Role, WasteStatus } from "@prisma/client";

const router = Router();
router.use(requireAuth);

// ============ RECIPES & COSTING ============

const recipeSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  projectId: z.number().int(),
  type: z.nativeEnum(RecipeType).optional(),
  items: z.array(z.object({ itemId: z.number().int(), brandVariantId: z.number().int().nullable().optional(), quantity: z.number().positive(), yieldFactor: z.number().positive().optional(), shrinkagePct: z.number().nonnegative().optional() })).min(1),
});

router.get(
  "/recipes",
  asyncHandler(async (_req, res) => {
    const recipes = await prisma.recipe.findMany({ include: { items: { include: { item: true, brandVariant: true } }, project: true }, orderBy: { createdAt: "desc" } });
    res.json(recipes);
  })
);

router.post(
  "/recipes",
  requireRole(Role.ADMIN, Role.HEAD_CHEF, Role.HEAD_BARISTA, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = recipeSchema.parse(req.body);
    const existing = await prisma.recipe.findFirst({ where: { code: body.code } });
    if (existing) throw conflict("Recipe code already exists");
    const recipe = await prisma.recipe.create({
      data: { code: body.code, name: body.name, projectId: body.projectId, type: body.type ?? RecipeType.MENU_ITEM, items: { create: body.items.map((i) => ({ itemId: i.itemId, brandVariantId: i.brandVariantId ?? null, quantity: i.quantity, yieldFactor: i.yieldFactor ?? 1, shrinkagePct: i.shrinkagePct ?? 0 })) } },
      include: { items: true },
    });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "Recipe", entityId: String(recipe.id), after: { code: recipe.code }, ip: req.ip });
    res.status(201).json(recipe);
  })
);

// Cost a recipe at current WAC: sum((qty / yield) * wac * (1 + shrinkage/100))
router.get(
  "/recipes/:id/cost",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const recipe = await prisma.recipe.findUnique({ where: { id }, include: { items: true } });
    if (!recipe) throw notFound("Recipe not found");
    const lines = [];
    let totalCost = 0;
    for (const ri of recipe.items) {
      const wac = await recalcWac(ri.itemId);
      const lineCost = (ri.quantity / (ri.yieldFactor || 1)) * wac * (1 + (ri.shrinkagePct || 0) / 100);
      lines.push({ itemId: ri.itemId, brandVariantId: ri.brandVariantId, quantity: ri.quantity, yieldFactor: ri.yieldFactor, shrinkagePct: ri.shrinkagePct, wac, lineCost });
      totalCost += lineCost;
    }
    res.json({ recipeId: id, code: recipe.code, name: recipe.name, version: recipe.version, lines, totalCost });
  })
);

/** Versioned recipe update: deactivates the current version and creates a new one. */
router.put(
  "/recipes/:id",
  requireRole(Role.ADMIN, Role.HEAD_CHEF, Role.HEAD_BARISTA, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = recipeSchema.partial().parse(req.body);
    const current = await prisma.recipe.findUnique({ where: { id }, include: { items: true } });
    if (!current) throw notFound("Recipe not found");

    await prisma.recipe.update({ where: { id }, data: { active: false } });
    const next = await prisma.recipe.create({
      data: {
        code: current.code,
        name: body.name ?? current.name,
        projectId: body.projectId ?? current.projectId,
        type: body.type ?? current.type,
        version: current.version + 1,
        active: true,
        items: { create: (body.items ?? current.items).map((i) => ({ itemId: i.itemId, brandVariantId: i.brandVariantId ?? null, quantity: i.quantity, yieldFactor: i.yieldFactor ?? 1, shrinkagePct: i.shrinkagePct ?? 0 })) },
      },
      include: { items: true },
    });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "Recipe", entityId: String(id), before: { version: current.version }, after: { version: next.version }, ip: req.ip });
    res.status(201).json(next);
  })
);

router.delete(
  "/recipes/:id",
  requireRole(Role.ADMIN, Role.HEAD_CHEF, Role.HEAD_BARISTA, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const recipe = await prisma.recipe.findUnique({ where: { id } });
    if (!recipe) throw notFound("Recipe not found");
    try {
      await prisma.recipe.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: recipe is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "Recipe", entityId: String(id), before: { code: recipe.code }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ============ MENU MAPPINGS ============

const mappingSchema = z.object({
  posMenuId: z.string().min(1),
  terminalId: z.number().int().nullable().optional(),
  itemId: z.number().int(),
  brandVariantId: z.number().int().nullable().optional(),
});

router.get(
  "/pos-terminals",
  asyncHandler(async (_req, res) => {
    const terminals = await prisma.posTerminal.findMany({ orderBy: { code: "asc" } });
    res.json(terminals);
  })
);

router.get(
  "/menu-mappings",
  asyncHandler(async (_req, res) => {
    const mappings = await prisma.menuMapping.findMany({ include: { item: true, brandVariant: true, terminal: true } });
    res.json(mappings);
  })
);

router.post(
  "/menu-mappings",
  requireRole(Role.ADMIN, Role.HEAD_CHEF, Role.HEAD_BARISTA, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = mappingSchema.parse(req.body);
    const mapping = await prisma.menuMapping.create({ data: { posMenuId: body.posMenuId, terminalId: body.terminalId ?? null, itemId: body.itemId, brandVariantId: body.brandVariantId ?? null } });
    res.status(201).json(mapping);
  })
);

// ============ POS SALES SYNC (offline buffering + idempotent replay) ============

const posSyncSchema = z.object({
  terminalCode: z.string().min(1),
  transactionId: z.string().min(1),
  lines: z.array(z.object({ posMenuId: z.string().min(1), qty: z.number().positive() })).min(1),
});

router.post(
  "/pos/sales-sync",
  requireRole(Role.ADMIN, Role.HEAD_CHEF, Role.HEAD_BARISTA, Role.BRANCH_MANAGER),
  asyncHandler(async (req, res) => {
    const body = posSyncSchema.parse(req.body);

    // Idempotency: same transactionId is never processed twice
    const existing = await prisma.posTransaction.findUnique({ where: { transactionId: body.transactionId } });
    if (existing) {
      if (existing.status === PosTransactionStatus.PROCESSED) return res.json({ id: existing.id, status: existing.status, replayed: true });
      throw conflict("Transaction already buffered but not yet processed");
    }

    const terminal = await prisma.posTerminal.findUnique({ where: { code: body.terminalCode } });
    if (!terminal) throw notFound("POS terminal not found");

    const tx = await prisma.posTransaction.create({ data: { terminalId: terminal.id, transactionId: body.transactionId, payload: body as unknown as object, status: PosTransactionStatus.BUFFERED } });

    // Resolve menu mappings and deduct stock from the project's kitchen/bar warehouse
    const kitchen = await prisma.warehouse.findFirst({ where: { projectId: terminal.projectId, type: "BRANCH" } });
    if (!kitchen) throw badRequest("No branch warehouse configured for this project");

    const deductions = [];
    for (const line of body.lines) {
      const mapping = await prisma.menuMapping.findFirst({ where: { posMenuId: line.posMenuId, OR: [{ terminalId: terminal.id }, { terminalId: null }] } });
      if (!mapping) throw badRequest(`No menu mapping for POS menu id ${line.posMenuId}`);
      const picks = await fefoPick(kitchen.id, mapping.itemId, line.qty, mapping.brandVariantId);
      for (const pick of picks) {
        await postStockMove({ warehouseId: kitchen.id, itemId: mapping.itemId, brandVariantId: mapping.brandVariantId ?? null, batchId: pick.batchId, qty: -pick.qty, refType: "POS_SALE", refId: body.transactionId });
      }
      deductions.push({ posMenuId: line.posMenuId, itemId: mapping.itemId, brandVariantId: mapping.brandVariantId, qty: line.qty });
    }

    await prisma.posTransaction.update({ where: { id: tx.id }, data: { status: PosTransactionStatus.PROCESSED, processedAt: new Date() } });

    // Auto GL posting: COGS Dr / Inventory Cr at WAC for the deducted quantity
    const cogs = await ensureAccount("5100", "Cost of Goods Sold", "EXPENSE");
    const inventory = await ensureAccount("1200", "Inventory", "ASSET");
    let cogsValue = 0;
    for (const d of deductions) {
      const wac = await recalcWac(d.itemId);
      cogsValue += d.qty * wac;
    }
    if (cogsValue > 0) {
      await postGl(`POS-${body.transactionId}`, "POS_SALE", body.transactionId, [
        { accountId: cogs.id, debit: cogsValue },
        { accountId: inventory.id, credit: cogsValue },
      ]);
    }

    await audit({ userId: req.user!.id, action: AuditAction.POST, entityType: "PosTransaction", entityId: String(tx.id), after: { transactionId: body.transactionId, lines: deductions.length }, ip: req.ip });
    res.status(201).json({ id: tx.id, status: PosTransactionStatus.PROCESSED, deductions });
  })
);

// ============ WASTE LOGGING ============

const wasteSchema = z.object({
  warehouseId: z.number().int(),
  itemId: z.number().int(),
  brandVariantId: z.number().int().nullable().optional(),
  quantity: z.number().positive(),
  reason: z.string().min(1),
});

router.get(
  "/waste",
  asyncHandler(async (_req, res) => {
    const waste = await prisma.wasteLog.findMany({ include: { item: true, warehouse: true, loggedBy: true }, orderBy: { createdAt: "desc" } });
    res.json(waste);
  })
);

router.post(
  "/waste",
  requireRole(Role.ADMIN, Role.HEAD_CHEF, Role.HEAD_BARISTA, Role.BRANCH_MANAGER),
  asyncHandler(async (req, res) => {
    const body = wasteSchema.parse(req.body);
    const waste = await prisma.wasteLog.create({ data: { warehouseId: body.warehouseId, itemId: body.itemId, brandVariantId: body.brandVariantId ?? null, quantity: body.quantity, reason: body.reason, loggedById: req.user!.id } });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "WasteLog", entityId: String(waste.id), after: { itemId: body.itemId, quantity: body.quantity, reason: body.reason }, ip: req.ip });
    res.status(201).json(waste);
  })
);

/** Supervisor approval of waste: on approval, deduct stock and post Expense Dr / Inventory Cr. */
router.post(
  "/waste/:id/approve",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ approve: z.boolean() }).parse(req.body);
    const waste = await prisma.wasteLog.findUnique({ where: { id } });
    if (!waste) throw notFound("Waste log not found");
    if (waste.status !== WasteStatus.PENDING) throw badRequest("Waste entry already decided");

    if (body.approve) {
      // Deduct via FEFO picks so batch/brandVariant balances stay consistent
      const picks = await fefoPick(waste.warehouseId, waste.itemId, waste.quantity, waste.brandVariantId);
      if (picks.reduce((s, p) => s + p.qty, 0) < waste.quantity) throw badRequest("Insufficient stock balance");
      for (const p of picks) {
        await postStockMove({ warehouseId: waste.warehouseId, itemId: waste.itemId, brandVariantId: waste.brandVariantId, batchId: p.batchId, qty: -p.qty, refType: "WASTE", refId: String(waste.id) });
      }
      const expense = await ensureAccount("5200", "Waste & Spoilage", "EXPENSE");
      const inventory = await ensureAccount("1200", "Inventory", "ASSET");
      const wac = await recalcWac(waste.itemId);
      const amount = waste.quantity * wac;
      if (amount > 0) {
        await postGl(`WASTE-${waste.id}`, "WASTE", String(waste.id), [
          { accountId: expense.id, debit: amount },
          { accountId: inventory.id, credit: amount },
        ]);
      }
      await prisma.wasteLog.update({ where: { id }, data: { status: WasteStatus.APPROVED, approvedById: req.user!.id } });
    } else {
      await prisma.wasteLog.update({ where: { id }, data: { status: WasteStatus.REJECTED, approvedById: req.user!.id } });
    }
    await audit({ userId: req.user!.id, action: body.approve ? AuditAction.APPROVE : AuditAction.REJECT, entityType: "WasteLog", entityId: String(id), after: { status: body.approve ? WasteStatus.APPROVED : WasteStatus.REJECTED }, ip: req.ip });
    res.json({ id, status: body.approve ? WasteStatus.APPROVED : WasteStatus.REJECTED });
  })
);

router.patch(
  "/waste/:id",
  requireRole(Role.ADMIN, Role.HEAD_CHEF, Role.HEAD_BARISTA, Role.BRANCH_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = wasteSchema.partial().parse(req.body);
    const waste = await prisma.wasteLog.findUnique({ where: { id } });
    if (!waste) throw notFound("Waste log not found");
    const updated = await prisma.wasteLog.update({ where: { id }, data: { ...body } });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "WasteLog", entityId: String(id), after: body, ip: req.ip });
    res.json(updated);
  })
);

router.delete(
  "/waste/:id",
  requireRole(Role.ADMIN, Role.HEAD_CHEF, Role.HEAD_BARISTA, Role.BRANCH_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const waste = await prisma.wasteLog.findUnique({ where: { id } });
    if (!waste) throw notFound("Waste log not found");
    if (waste.status !== WasteStatus.PENDING) throw badRequest("Only pending waste records can be deleted");
    try {
      await prisma.wasteLog.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "WasteLog", entityId: String(id), before: { itemId: waste.itemId, quantity: waste.quantity, reason: waste.reason }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ============ VARIANCE RECORDS ============

router.get(
  "/variances",
  asyncHandler(async (_req, res) => {
    const variances = await prisma.varianceRecord.findMany({ include: { item: true, warehouse: true }, orderBy: { createdAt: "desc" } });
    res.json(variances);
  })
);

export default router;