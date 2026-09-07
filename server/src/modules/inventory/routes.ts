import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, isForeignKeyViolation } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, scopeWhere } from "../../middleware/rbac.js";
import { audit } from "../../lib/audit.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { fefoPick, getStockBalance, postStockMove, recalcWac } from "../../lib/stock.js";
import { AdjustmentReason, AdjustmentStatus, AuditAction, ItemScope, Role, ValuationMethod, WarehouseType } from "@prisma/client";

const router = Router();
router.use(requireAuth);

// ---------- Warehouses ----------
router.get(
  "/warehouses",
  asyncHandler(async (req, res) => {
    const scope = scopeWhere(req.user);
    const warehouses = await prisma.warehouse.findMany({
      where: scope.projectId === undefined ? undefined : { OR: [{ projectId: scope.projectId }, { type: WarehouseType.GROUP_CENTRAL }, { type: WarehouseType.TRANSIT }] },
      include: { project: true },
      orderBy: { code: "asc" },
    });
    res.json(warehouses);
  })
);

router.post(
  "/warehouses",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE),
  asyncHandler(async (req, res) => {
    const body = z.object({ code: z.string().min(2), name: z.string().min(2), type: z.nativeEnum(WarehouseType), projectId: z.number().int().nullable().optional(), owner: z.string().optional(), address: z.string().optional().nullable(), city: z.string().optional().nullable(), country: z.string().optional() }).parse(req.body);
    const existing = await prisma.warehouse.findUnique({ where: { code: body.code } });
    if (existing) throw conflict("Warehouse code exists");
    const wh = await prisma.warehouse.create({ data: body });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "Warehouse", entityId: String(wh.id), after: { code: wh.code }, ip: req.ip });
    res.status(201).json(wh);
  })
);

router.patch(
  "/warehouses/:id",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ code: z.string().min(2), name: z.string().min(2), type: z.nativeEnum(WarehouseType), projectId: z.number().int().nullable().optional(), owner: z.string().optional(), address: z.string().optional().nullable(), city: z.string().optional().nullable(), country: z.string().optional() }).partial().parse(req.body);
    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing) throw notFound("Warehouse not found");
    const wh = await prisma.warehouse.update({ where: { id }, data: body });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "Warehouse", entityId: String(id), before: { code: existing.code }, after: { code: wh.code }, ip: req.ip });
    res.json(wh);
  })
);

router.delete(
  "/warehouses/:id",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing) throw notFound("Warehouse not found");
    try {
      await prisma.warehouse.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "Warehouse", entityId: String(id), before: { code: existing.code }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ---------- Items ----------
const itemSchema = z.object({
  code: z.string().min(2),
  description: z.string().min(2),
  scope: z.nativeEnum(ItemScope),
  projectId: z.number().int().nullable().optional(),
  category: z.string().optional().nullable(),
  valuationMethod: z.nativeEnum(ValuationMethod).optional(),
  abcClass: z.string().optional().nullable(),
  uom: z.string().optional(),
});

router.get(
  "/items",
  asyncHandler(async (req, res) => {
    const scope = scopeWhere(req.user);
    const items = await prisma.item.findMany({
      where: scope.projectId === undefined ? undefined : { OR: [{ projectId: scope.projectId }, { scope: ItemScope.CROSS_PROJECT }] },
      include: { brandVariants: true, project: true },
      orderBy: { code: "asc" },
    });
    res.json(items);
  })
);

router.get(
  "/items/:id",
  asyncHandler(async (req, res) => {
    const item = await prisma.item.findUnique({ where: { id: Number(req.params.id) }, include: { brandVariants: true, batches: true, reorderPoints: true } });
    if (!item) throw notFound("Item not found");
    res.json(item);
  })
);

router.post(
  "/items",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const body = itemSchema.parse(req.body);
    if (body.scope === ItemScope.PROJECT_ISOLATED && !body.projectId) throw badRequest("Project-Isolated items require a projectId");
    const existing = await prisma.item.findUnique({ where: { code: body.code } });
    if (existing) throw conflict("Item code exists");
    const item = await prisma.item.create({ data: body });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "Item", entityId: String(item.id), after: { code: item.code, scope: item.scope }, ip: req.ip });
    res.status(201).json(item);
  })
);

router.patch(
  "/items/:id",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = itemSchema.partial().parse(req.body);
    const existing = await prisma.item.findUnique({ where: { id } });
    if (!existing) throw notFound("Item not found");
    const item = await prisma.item.update({ where: { id }, data: body });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "Item", entityId: String(id), before: { code: existing.code, scope: existing.scope }, after: { code: item.code, scope: item.scope }, ip: req.ip });
    res.json(item);
  })
);

router.delete(
  "/items/:id",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.item.findUnique({ where: { id } });
    if (!existing) throw notFound("Item not found");
    try {
      await prisma.item.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "Item", entityId: String(id), before: { code: existing.code, scope: existing.scope }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ---------- Brand variants ----------
const brandSchema = z.object({
  itemId: z.number().int(),
  name: z.string().min(2),
  sku: z.string().min(2),
  barcode: z.string().optional().nullable(),
});

router.post(
  "/brands",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const body = brandSchema.parse(req.body);
    const existing = await prisma.brandVariant.findUnique({ where: { sku: body.sku } });
    if (existing) throw conflict("SKU exists");
    const brand = await prisma.brandVariant.create({ data: body });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "BrandVariant", entityId: String(brand.id), after: { sku: brand.sku }, ip: req.ip });
    res.status(201).json(brand);
  })
);

router.patch(
  "/brands/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = brandSchema.partial().parse(req.body);
    const existing = await prisma.brandVariant.findUnique({ where: { id } });
    if (!existing) throw notFound("Brand variant not found");
    const brand = await prisma.brandVariant.update({ where: { id }, data: body });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "BrandVariant", entityId: String(id), before: { sku: existing.sku }, after: { sku: brand.sku }, ip: req.ip });
    res.json(brand);
  })
);

router.delete(
  "/brands/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.brandVariant.findUnique({ where: { id } });
    if (!existing) throw notFound("Brand variant not found");
    try {
      await prisma.brandVariant.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "BrandVariant", entityId: String(id), before: { sku: existing.sku }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ---------- Batches ----------
const batchSchema = z.object({
  itemId: z.number().int(),
  brandVariantId: z.number().int().nullable().optional(),
  batchNo: z.string().min(2),
  expiryDate: z.coerce.date(),
  quantity: z.number().positive(),
  warehouseId: z.number().int(),
  unitCost: z.number().nonnegative().optional(),
});

router.post(
  "/batches",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const body = batchSchema.parse(req.body);
    const batch = await prisma.batch.create({ data: { itemId: body.itemId, brandVariantId: body.brandVariantId ?? null, batchNo: body.batchNo, expiryDate: body.expiryDate, quantity: body.quantity, warehouseId: body.warehouseId } });
    await postStockMove({ warehouseId: body.warehouseId, itemId: body.itemId, brandVariantId: body.brandVariantId ?? null, batchId: batch.id, qty: body.quantity, unitCost: body.unitCost ?? 0, refType: "BATCH_CREATE", refId: String(batch.id) });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "Batch", entityId: String(batch.id), after: { batchNo: batch.batchNo, qty: body.quantity }, ip: req.ip });
    res.status(201).json(batch);
  })
);

router.patch(
  "/batches/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = batchSchema.partial().parse(req.body);
    const existing = await prisma.batch.findUnique({ where: { id } });
    if (!existing) throw notFound("Batch not found");
    const batch = await prisma.batch.update({ where: { id }, data: body });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "Batch", entityId: String(id), before: { batchNo: existing.batchNo }, after: { batchNo: batch.batchNo }, ip: req.ip });
    res.json(batch);
  })
);

router.delete(
  "/batches/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.batch.findUnique({ where: { id } });
    if (!existing) throw notFound("Batch not found");
    try {
      await prisma.batch.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "Batch", entityId: String(id), before: { batchNo: existing.batchNo }, ip: req.ip });
    res.json({ ok: true });
  })
);

router.get(
  "/batches",
  asyncHandler(async (req, res) => {
    const batches = await prisma.batch.findMany({
      where: { warehouseId: req.query.warehouseId ? Number(req.query.warehouseId) : undefined },
      include: { item: true, brandVariant: true, warehouse: true },
      orderBy: { expiryDate: "asc" },
    });
    res.json(batches);
  })
);

// ---------- Stock balance & FEFO ----------
router.get(
  "/stock/:warehouseId/:itemId",
  asyncHandler(async (req, res) => {
    const warehouseId = Number(req.params.warehouseId);
    const itemId = Number(req.params.itemId);
    const brandVariantId = req.query.brandVariantId ? Number(req.query.brandVariantId) : null;
    const balance = await getStockBalance(warehouseId, itemId, brandVariantId);
    const wac = await recalcWac(itemId);
    res.json({ warehouseId, itemId, brandVariantId, balance, wac });
  })
);

/** FEFO pick simulation: returns batches to pick in expiry order. */
router.post(
  "/fefo/pick",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.BRANCH_MANAGER, Role.HEAD_CHEF, Role.HEAD_BARISTA),
  asyncHandler(async (req, res) => {
    const body = z.object({ warehouseId: z.number().int(), itemId: z.number().int(), qty: z.number().positive(), brandVariantId: z.number().int().nullable().optional() }).parse(req.body);
    const picks = await fefoPick(body.warehouseId, body.itemId, body.qty, body.brandVariantId ?? null);
    res.json({ picks });
  })
);

// ---------- Expiration alerts ----------
router.get(
  "/alerts/expiration",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const tiers = [7, 15, 30, 60];
    const batches = await prisma.batch.findMany({
      where: { quantity: { gt: 0 }, expiryDate: { gt: now } },
      include: { item: true, brandVariant: true, warehouse: true },
    });
    const alerts = batches
      .map((b) => {
        const days = Math.ceil((b.expiryDate.getTime() - now.getTime()) / (24 * 3600 * 1000));
        const tier = tiers.find((t) => days <= t);
        return tier ? { batch: b, daysLeft: days, tier } : null;
      })
      .filter(Boolean);
    res.json(alerts);
  })
);

// ---------- Reorder points ----------
const ropSchema = z.object({
  itemId: z.number().int(),
  warehouseId: z.number().int(),
  safetyStock: z.number().nonnegative().optional(),
  reorderPoint: z.number().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  consumptionVelocity: z.number().nonnegative().optional(),
});

router.get(
  "/reorder-points",
  asyncHandler(async (_req, res) => {
    const rops = await prisma.reorderPoint.findMany({ include: { item: true, warehouse: true } });
    res.json(rops);
  })
);

router.post(
  "/reorder-points",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = ropSchema.parse(req.body);
    const rop = await prisma.reorderPoint.upsert({
      where: { itemId_warehouseId: { itemId: body.itemId, warehouseId: body.warehouseId } },
      update: body,
      create: body,
    });
    res.json(rop);
  })
);

router.patch(
  "/reorder-points/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = ropSchema.partial().parse(req.body);
    const existing = await prisma.reorderPoint.findUnique({ where: { id } });
    if (!existing) throw notFound("Reorder point not found");
    const rop = await prisma.reorderPoint.update({ where: { id }, data: body });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "ReorderPoint", entityId: String(id), before: { itemId: existing.itemId, warehouseId: existing.warehouseId }, after: { itemId: rop.itemId, warehouseId: rop.warehouseId }, ip: req.ip });
    res.json(rop);
  })
);

router.delete(
  "/reorder-points/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.reorderPoint.findUnique({ where: { id } });
    if (!existing) throw notFound("Reorder point not found");
    try {
      await prisma.reorderPoint.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "ReorderPoint", entityId: String(id), before: { itemId: existing.itemId, warehouseId: existing.warehouseId }, ip: req.ip });
    res.json({ ok: true });
  })
);

/** Recalculate ROP from consumption velocity + lead time: ROP = velocity * leadTime + safetyStock. */
router.post(
  "/reorder-points/recalculate",
  requireRole(Role.ADMIN, Role.COST_CONTROLLER),
  asyncHandler(async (_req, res) => {
    const rops = await prisma.reorderPoint.findMany();
    const updated = [];
    for (const r of rops) {
      const rop = r.consumptionVelocity * r.leadTimeDays + r.safetyStock;
      const rec = await prisma.reorderPoint.update({ where: { id: r.id }, data: { reorderPoint: rop } });
      updated.push(rec);
    }
    res.json({ recalculated: updated.length, updated });
  })
);

/** Check which items are at/below reorder point (drives ROP-triggered requisitions). */
router.get(
  "/reorder-points/check",
  asyncHandler(async (_req, res) => {
    const rops = await prisma.reorderPoint.findMany({ include: { item: true, warehouse: true } });
    const results = [];
    for (const r of rops) {
      // Sum across ALL brand variants and batches for this item in this warehouse
      const agg = await prisma.stockLedger.aggregate({ where: { warehouseId: r.warehouseId, itemId: r.itemId }, _sum: { balance: true } });
      const balance = agg._sum.balance ?? 0;
      if (balance <= r.reorderPoint) {
        results.push({ item: r.item, warehouse: r.warehouse, balance, reorderPoint: r.reorderPoint, shortfall: r.reorderPoint - balance });
      }
    }
    res.json(results);
  })
);

// ---------- Adjustments ----------
const adjustmentSchema = z.object({
  quantity: z.number(),
  reason: z.nativeEnum(AdjustmentReason),
  amount: z.number().optional(),
  status: z.nativeEnum(AdjustmentStatus).optional(),
  approvalLevel: z.number().int().optional(),
});

router.patch(
  "/adjustments/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = adjustmentSchema.partial().parse(req.body);
    const existing = await prisma.adjustment.findUnique({ where: { id } });
    if (!existing) throw notFound("Adjustment not found");
    const adjustment = await prisma.adjustment.update({ where: { id }, data: body });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "Adjustment", entityId: String(id), before: { status: existing.status }, after: { status: adjustment.status }, ip: req.ip });
    res.json(adjustment);
  })
);

router.delete(
  "/adjustments/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.adjustment.findUnique({ where: { id } });
    if (!existing) throw notFound("Adjustment not found");
    if (existing.status !== AdjustmentStatus.PENDING) throw badRequest("Only pending adjustments can be deleted");
    try {
      await prisma.adjustment.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "Adjustment", entityId: String(id), before: { status: existing.status }, ip: req.ip });
    res.json({ ok: true });
  })
);

export default router;