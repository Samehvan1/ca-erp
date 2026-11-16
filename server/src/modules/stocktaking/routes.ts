import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, isForeignKeyViolation } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { audit } from "../../lib/audit.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { postStockMove } from "../../lib/stock.js";
import { AdjustmentReason, AdjustmentStatus, AuditAction, Role, StocktakeStatus, StocktakeType } from "@prisma/client";

const router = Router();
router.use(requireAuth);

const seq = (() => {
  let n = 0;
  return (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${(++n).toString().padStart(4, "0")}`;
})();

// ============ STOCKTAKES ============

const stocktakeSchema = z.object({
  warehouseId: z.number().int(),
  type: z.nativeEnum(StocktakeType),
  abcClass: z.string().optional(),
  scheduledDate: z.coerce.date().optional(),
  itemIds: z.array(z.number().int()).optional(),
});

router.get(
  "/stocktakes",
  asyncHandler(async (_req, res) => {
    const list = await prisma.stocktake.findMany({ include: { warehouse: true, items: { include: { item: true } }, adjustments: true }, orderBy: { scheduledDate: "desc" } });
    res.json(list);
  })
);

router.post(
  "/stocktakes",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = stocktakeSchema.parse(req.body);
    const warehouse = await prisma.warehouse.findUnique({ where: { id: body.warehouseId } });
    if (!warehouse) throw notFound("Warehouse not found");

    // Snapshot system quantities at scheduling time (filtered by ABC class for cycle counts)
    const itemFilter = body.abcClass ? { abcClass: body.abcClass } : {};
    const items = body.itemIds?.length
      ? body.itemIds
      : (await prisma.stockLedger.findMany({ where: { warehouseId: body.warehouseId, balance: { gt: 0 } }, distinct: ["itemId"], select: { itemId: true } })).map((r) => r.itemId);
    const abcItems = body.abcClass ? (await prisma.item.findMany({ where: { id: { in: items }, abcClass: body.abcClass }, select: { id: true } })).map((i) => i.id) : items;

    const stocktake = await prisma.stocktake.create({
      data: {
        number: seq("ST"),
        warehouseId: body.warehouseId,
        type: body.type,
        abcClass: body.abcClass ?? null,
        scheduledDate: body.scheduledDate ?? new Date(),
        status: StocktakeStatus.SCHEDULED,
        items: {
          create: await Promise.all(
            abcItems.map(async (itemId) => {
              const agg = await prisma.stockLedger.aggregate({ where: { warehouseId: body.warehouseId, itemId }, _sum: { balance: true } });
              return { itemId, systemQty: agg._sum.balance ?? 0 };
            })
          ),
        },
      },
      include: { items: { include: { item: true } } },
    });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "Stocktake", entityId: String(stocktake.id), after: { number: stocktake.number, warehouse: warehouse.code, type: body.type }, ip: req.ip });
    res.status(201).json(stocktake);
  })
);

router.patch(
  "/stocktakes/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = stocktakeSchema.partial().parse(req.body);
    const stocktake = await prisma.stocktake.findUnique({ where: { id } });
    if (!stocktake) throw notFound("Stocktake not found");
    const updated = await prisma.stocktake.update({ where: { id }, data: body });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "Stocktake", entityId: String(id), after: body, ip: req.ip });
    res.json(updated);
  })
);

router.delete(
  "/stocktakes/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const stocktake = await prisma.stocktake.findUnique({ where: { id } });
    if (!stocktake) throw notFound("Stocktake not found");
    if (stocktake.status !== StocktakeStatus.SCHEDULED) throw badRequest("Only scheduled stocktakes can be deleted");
    try {
      await prisma.$transaction([
        prisma.stocktakeItem.deleteMany({ where: { stocktakeId: id } }),
        prisma.stocktake.delete({ where: { id } }),
      ]);
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "Stocktake", entityId: String(id), after: { status: stocktake.status }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ============ MOBILE COUNT SUBMISSION ============

const countSchema = z.object({
  counts: z.array(z.object({ stocktakeItemId: z.number().int(), countedQty: z.number().nonnegative() })).min(1),
});

router.post(
  "/stocktakes/:id/count",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.BRANCH_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = countSchema.parse(req.body);
    const stocktake = await prisma.stocktake.findUnique({ where: { id } });
    if (!stocktake) throw notFound("Stocktake not found");
    if (stocktake.status === StocktakeStatus.COMPLETED || stocktake.status === StocktakeStatus.CANCELLED) throw badRequest("Stocktake is closed");

    await prisma.stocktake.update({ where: { id }, data: { status: StocktakeStatus.IN_PROGRESS } });

    for (const c of body.counts) {
      const si = await prisma.stocktakeItem.findUnique({ where: { id: c.stocktakeItemId } });
      if (!si || si.stocktakeId !== id) throw badRequest(`Stocktake item ${c.stocktakeItemId} not found in this stocktake`);
      await prisma.stocktakeItem.update({ where: { id: si.id }, data: { countedQty: c.countedQty, varianceQty: c.countedQty - si.systemQty } });
    }
    res.json({ id, status: StocktakeStatus.IN_PROGRESS });
  })
);

// ============ COMPLETE & GENERATE ADJUSTMENTS ============

router.post(
  "/stocktakes/:id/complete",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const stocktake = await prisma.stocktake.findUnique({ where: { id }, include: { items: { include: { item: true } }, warehouse: true } });
    if (!stocktake) throw notFound("Stocktake not found");
    if (stocktake.status === StocktakeStatus.COMPLETED) throw badRequest("Stocktake already completed");

    const adjustments = [];
    for (const si of stocktake.items) {
      const variance = si.countedQty - si.systemQty;
      if (Math.abs(variance) > 0.001) {
        const adj = await prisma.adjustment.create({
          data: {
            number: seq("ADJ"),
            stocktakeId: id,
            itemId: si.itemId,
            warehouseId: stocktake.warehouseId,
            quantity: variance,
            reason: AdjustmentReason.COUNT_DIFFERENCE,
            amount: 0,
            status: AdjustmentStatus.PENDING,
            requestedById: req.user!.id,
          },
        });
        adjustments.push({ id: adj.id, itemId: si.itemId, variance });
      }
    }

    await prisma.stocktake.update({ where: { id }, data: { status: StocktakeStatus.COMPLETED, completedAt: new Date() } });
    await audit({ userId: req.user!.id, action: AuditAction.POST, entityType: "Stocktake", entityId: String(id), after: { status: StocktakeStatus.COMPLETED, adjustments: adjustments.length }, ip: req.ip });
    res.json({ id, status: StocktakeStatus.COMPLETED, adjustments });
  })
);

// ============ ADJUSTMENTS ============

const adjustmentCreateSchema = z.object({
  itemId: z.number().int(),
  warehouseId: z.number().int(),
  quantity: z.number(),
  reason: z.nativeEnum(AdjustmentReason),
  amount: z.number().optional().default(0),
  status: z.nativeEnum(AdjustmentStatus).optional().default(AdjustmentStatus.APPROVED),
  approvalLevel: z.number().int().optional().default(1),
});

router.get(
  "/adjustments",
  asyncHandler(async (_req, res) => {
    const list = await prisma.adjustment.findMany({ include: { item: true, warehouse: true, stocktake: true, requestedBy: true, approvedBy: true }, orderBy: { createdAt: "desc" } });
    res.json(list);
  })
);

router.post(
  "/adjustments",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = adjustmentCreateSchema.parse(req.body);
    const item = await prisma.item.findUnique({ where: { id: body.itemId } });
    if (!item) throw notFound("Item not found");
    const wh = await prisma.warehouse.findUnique({ where: { id: body.warehouseId } });
    if (!wh) throw notFound("Warehouse not found");

    const number = `ADJ-${Date.now().toString().slice(-6)}`;
    const isApproved = body.status === AdjustmentStatus.APPROVED;

    const adjustment = await prisma.adjustment.create({
      data: {
        number,
        itemId: body.itemId,
        warehouseId: body.warehouseId,
        quantity: body.quantity,
        reason: body.reason,
        amount: body.amount || 0,
        status: body.status || AdjustmentStatus.APPROVED,
        approvalLevel: body.approvalLevel || 1,
        requestedById: req.user!.id,
        approvedById: isApproved ? req.user!.id : null,
      },
      include: { item: true, warehouse: true, requestedBy: true, approvedBy: true },
    });

    if (isApproved) {
      await postStockMove({
        warehouseId: body.warehouseId,
        itemId: body.itemId,
        qty: body.quantity,
        refType: "ADJUSTMENT",
        refId: number,
      });
    }

    await audit({
      userId: req.user!.id,
      action: AuditAction.ADJUST,
      entityType: "Adjustment",
      entityId: String(adjustment.id),
      after: { number, itemId: body.itemId, warehouseId: body.warehouseId, quantity: body.quantity, status: adjustment.status },
      ip: req.ip,
    });

    res.status(201).json(adjustment);
  })
);

router.patch(
  "/adjustments/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = adjustmentCreateSchema.partial().parse(req.body);
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
router.post(
  "/adjustments/:id/approve",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ approve: z.boolean().optional().default(true) }).parse(req.body);
    const adj = await prisma.adjustment.findUnique({ where: { id } });
    if (!adj) throw notFound("Adjustment not found");
    if (adj.status !== AdjustmentStatus.PENDING) throw badRequest("Adjustment already decided");

    if (body.approve) {
      await postStockMove({ warehouseId: adj.warehouseId, itemId: adj.itemId, qty: adj.quantity, refType: "ADJUSTMENT", refId: String(adj.id) });
      await prisma.adjustment.update({ where: { id }, data: { status: AdjustmentStatus.APPROVED, approvedById: req.user!.id } });
    } else {
      await prisma.adjustment.update({ where: { id }, data: { status: AdjustmentStatus.REJECTED, approvedById: req.user!.id } });
    }
    await audit({ userId: req.user!.id, action: body.approve ? AuditAction.APPROVE : AuditAction.REJECT, entityType: "Adjustment", entityId: String(id), after: { status: body.approve ? AdjustmentStatus.APPROVED : AdjustmentStatus.REJECTED }, ip: req.ip });
    res.json({ id, status: body.approve ? AdjustmentStatus.APPROVED : AdjustmentStatus.REJECTED });
  })
);

export default router;