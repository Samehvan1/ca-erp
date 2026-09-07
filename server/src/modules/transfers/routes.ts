import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, isForeignKeyViolation } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { audit } from "../../lib/audit.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { postStockMove, fefoPick } from "../../lib/stock.js";
import { AuditAction, Role, TransferStatus } from "@prisma/client";

const router = Router();
router.use(requireAuth);

const seq = (() => {
  let n = 0;
  return (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${(++n).toString().padStart(4, "0")}`;
})();

// ============ TRANSFER REQUISITIONS ============

const transferReqSchema = z.object({
  fromWarehouseId: z.number().int(),
  toWarehouseId: z.number().int(),
  projectId: z.number().int(),
  items: z.array(z.object({ itemId: z.number().int(), brandVariantId: z.number().int().nullable().optional(), quantity: z.number().positive() })).min(1),
});

router.get(
  "/requisitions",
  asyncHandler(async (_req, res) => {
    const list = await prisma.transferRequisition.findMany({
      include: { fromWarehouse: true, toWarehouse: true, project: true, requestedBy: true, orders: { include: { items: { include: { item: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(list);
  })
);

router.post(
  "/requisitions",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.BRANCH_MANAGER, Role.HEAD_CHEF, Role.HEAD_BARISTA),
  asyncHandler(async (req, res) => {
    const body = transferReqSchema.parse(req.body);
    if (body.fromWarehouseId === body.toWarehouseId) throw badRequest("Source and destination warehouses must differ");
    const from = await prisma.warehouse.findUnique({ where: { id: body.fromWarehouseId } });
    const to = await prisma.warehouse.findUnique({ where: { id: body.toWarehouseId } });
    if (!from || !to) throw notFound("Warehouse not found");
    if (from.type === "TRANSIT") throw badRequest("Cannot transfer from a transit warehouse");

    const tr = await prisma.transferRequisition.create({
      data: {
        number: seq("TR"),
        fromWarehouseId: body.fromWarehouseId,
        toWarehouseId: body.toWarehouseId,
        projectId: body.projectId,
        requestedById: req.user!.id,
        status: TransferStatus.REQUESTED,
      },
    });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "TransferRequisition", entityId: String(tr.id), after: { number: tr.number, from: from.code, to: to.code }, ip: req.ip });
    res.status(201).json(tr);
  })
);

router.post(
  "/requisitions/:id/approve",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.GROUP_EXECUTIVE),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ approve: z.boolean(), comment: z.string().optional() }).parse(req.body);
    const tr = await prisma.transferRequisition.findUnique({ where: { id } });
    if (!tr) throw notFound("Transfer requisition not found");
    if (tr.status !== TransferStatus.REQUESTED) throw badRequest("Not pending approval");
    const status = body.approve ? TransferStatus.APPROVED : TransferStatus.CANCELLED;
    await prisma.transferRequisition.update({ where: { id }, data: { status } });
    await audit({ userId: req.user!.id, action: body.approve ? AuditAction.APPROVE : AuditAction.REJECT, entityType: "TransferRequisition", entityId: String(id), after: { status }, ip: req.ip });
    res.json({ id, status });
  })
);

router.patch(
  "/requisitions/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.BRANCH_MANAGER, Role.HEAD_CHEF, Role.HEAD_BARISTA),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = transferReqSchema.partial().parse(req.body);
    const existing = await prisma.transferRequisition.findUnique({ where: { id } });
    if (!existing) throw notFound("Transfer requisition not found");
    const { items: _items, ...scalars } = body;
    const updated = await prisma.transferRequisition.update({ where: { id }, data: scalars });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "TransferRequisition", entityId: String(id), before: { fromWarehouseId: existing.fromWarehouseId, toWarehouseId: existing.toWarehouseId, projectId: existing.projectId }, after: { fromWarehouseId: updated.fromWarehouseId, toWarehouseId: updated.toWarehouseId, projectId: updated.projectId }, ip: req.ip });
    res.json(updated);
  })
);

router.delete(
  "/requisitions/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.BRANCH_MANAGER, Role.HEAD_CHEF, Role.HEAD_BARISTA),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.transferRequisition.findUnique({ where: { id } });
    if (!existing) throw notFound("Transfer requisition not found");
    if (existing.status !== TransferStatus.REQUESTED) throw badRequest("Only requested requisitions can be deleted");
    try {
      await prisma.transferRequisition.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "TransferRequisition", entityId: String(id), before: { number: existing.number }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ============ TRANSFER ORDERS & EXECUTION ============

router.post(
  "/orders",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const body = z.object({ requisitionId: z.number().int(), items: z.array(z.object({ itemId: z.number().int(), brandVariantId: z.number().int().nullable().optional(), quantity: z.number().positive() })).min(1) }).parse(req.body);
    const tr = await prisma.transferRequisition.findUnique({ where: { id: body.requisitionId }, include: { fromWarehouse: true, toWarehouse: true } });
    if (!tr) throw notFound("Transfer requisition not found");
    if (tr.status !== TransferStatus.APPROVED) throw badRequest("Transfer requisition must be approved");

    const crossProject = tr.fromWarehouse.projectId !== tr.toWarehouse.projectId;

    const order = await prisma.transferOrder.create({
      data: {
        number: seq("TO"),
        requisitionId: tr.id,
        status: TransferStatus.DISPATCHED,
        dispatchedAt: new Date(),
        items: { create: body.items.map((i) => ({ itemId: i.itemId, brandVariantId: i.brandVariantId ?? null, quantity: i.quantity })) },
      },
      include: { items: true },
    });

    // Issue: move stock out of source via FEFO picks (into transit node when cross-project)
    const transit = crossProject ? await prisma.warehouse.findFirst({ where: { type: "TRANSIT" } }) : null;
    for (const item of body.items) {
      const picks = await fefoPick(tr.fromWarehouseId, item.itemId, item.quantity, item.brandVariantId ?? null);
      for (const pick of picks) {
        await postStockMove({ warehouseId: tr.fromWarehouseId, itemId: item.itemId, brandVariantId: item.brandVariantId ?? null, batchId: pick.batchId, qty: -pick.qty, refType: "TRANSFER_OUT", refId: String(order.id) });
        if (transit) {
          await postStockMove({ warehouseId: transit.id, itemId: item.itemId, brandVariantId: item.brandVariantId ?? null, batchId: pick.batchId, qty: pick.qty, refType: "TRANSIT", refId: String(order.id) });
        }
      }
      // Record the picked batch on the transfer item for destination batch continuity
      const tItem = await prisma.transferItem.findFirst({ where: { transferOrderId: order.id, itemId: item.itemId } });
      if (tItem && picks.length > 0) {
        await prisma.transferItem.update({ where: { id: tItem.id }, data: { batchId: picks[0].batchId } });
      }
    }

    if (crossProject) {
      await prisma.interCompanyEntry.create({ data: { transferOrderId: order.id, fromProjectId: tr.fromWarehouse.projectId!, toProjectId: tr.toWarehouse.projectId!, amount: 0 } });
    }

    await prisma.transferRequisition.update({ where: { id: tr.id }, data: { status: TransferStatus.DISPATCHED } });
    await audit({ userId: req.user!.id, action: AuditAction.TRANSFER, entityType: "TransferOrder", entityId: String(order.id), after: { number: order.number, from: tr.fromWarehouse.code, to: tr.toWarehouse.code, crossProject }, ip: req.ip });
    res.status(201).json(order);
  })
);

router.post(
  "/orders/:id/receive",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER, Role.BRANCH_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ items: z.array(z.object({ transferItemId: z.number().int(), receivedQty: z.number().positive(), discrepancyQty: z.number().nonnegative().optional(), acceptedQty: z.number().nonnegative().optional(), comments: z.string().optional() })).min(1), lossAllocation: z.object({ sending: z.number().nonnegative(), receiving: z.number().nonnegative(), logistics: z.number().nonnegative() }).optional() }).parse(req.body);
    const order = await prisma.transferOrder.findUnique({ where: { id }, include: { items: true, requisition: { include: { fromWarehouse: true, toWarehouse: true } } } });
    if (!order) throw notFound("Transfer order not found");
    if (order.status !== TransferStatus.DISPATCHED && order.status !== TransferStatus.IN_TRANSIT) throw badRequest("Transfer order is not in transit");

    const transit = await prisma.warehouse.findFirst({ where: { type: "TRANSIT" } });
    const crossProject = order.requisition.fromWarehouse.projectId !== order.requisition.toWarehouse.projectId;

    for (const line of body.items) {
      const tItem = order.items.find((t) => t.id === line.transferItemId);
      if (!tItem) throw badRequest(`Transfer item ${line.transferItemId} not found`);
      if (line.receivedQty + (line.discrepancyQty ?? 0) > tItem.quantity) throw badRequest("Received + discrepancy exceeds transferred quantity");

      if (crossProject && transit) {
        await postStockMove({ warehouseId: transit.id, itemId: tItem.itemId, brandVariantId: tItem.brandVariantId ?? null, batchId: tItem.batchId ?? undefined, qty: -line.receivedQty, refType: "TRANSIT_OUT", refId: String(order.id) });
      }
      // Create a destination batch to keep batch-level traceability
      const srcBatch = tItem.batchId ? await prisma.batch.findUnique({ where: { id: tItem.batchId } }) : null;
      const destBatch = await prisma.batch.create({
        data: { itemId: tItem.itemId, brandVariantId: tItem.brandVariantId ?? null, batchNo: `${srcBatch?.batchNo ?? "B"}-R`, expiryDate: srcBatch?.expiryDate ?? new Date(Date.now() + 90 * 24 * 3600 * 1000), quantity: line.receivedQty, warehouseId: order.requisition.toWarehouseId },
      });
      await postStockMove({ warehouseId: order.requisition.toWarehouseId, itemId: tItem.itemId, brandVariantId: tItem.brandVariantId ?? null, batchId: destBatch.id, qty: line.receivedQty, refType: "TRANSFER_IN", refId: String(order.id) });

      await prisma.transferItem.update({ where: { id: tItem.id }, data: { receivedQty: { increment: line.receivedQty }, discrepancyQty: { increment: line.discrepancyQty ?? 0 }, acceptedQty: line.acceptedQty ?? line.receivedQty, comments: line.comments ?? null } });
      if (line.discrepancyQty) {
        await prisma.wasteLog.create({
          data: { warehouseId: order.requisition.toWarehouseId, itemId: tItem.itemId, brandVariantId: tItem.brandVariantId ?? null, quantity: line.discrepancyQty, reason: "TRANSIT_DAMAGE", loggedById: req.user!.id },
        });
      }
    }

    await prisma.transferReceipt.create({ data: { transferOrderId: id, receivedById: req.user!.id, lossAllocation: body.lossAllocation ?? undefined } });

    // Determine completion from the request lines (order.items is a pre-update snapshot)
    const allReceived = body.items.every((line) => {
      const tItem = order.items.find((t) => t.id === line.transferItemId)!;
      return line.receivedQty + (line.discrepancyQty ?? 0) >= tItem.quantity;
    });
    const status = allReceived ? TransferStatus.RECEIVED : TransferStatus.IN_TRANSIT;
    await prisma.transferOrder.update({ where: { id }, data: { status, receivedAt: allReceived ? new Date() : undefined } });
    await prisma.transferRequisition.update({ where: { id: order.requisitionId }, data: { status } });

    await audit({ userId: req.user!.id, action: AuditAction.RECEIVE, entityType: "TransferOrder", entityId: String(id), after: { status }, ip: req.ip });
    res.json({ id, status });
  })
);

router.patch(
  "/orders/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ requisitionId: z.number().int(), items: z.array(z.object({ itemId: z.number().int(), brandVariantId: z.number().int().nullable().optional(), quantity: z.number().positive() })).min(1) }).partial().parse(req.body);
    const existing = await prisma.transferOrder.findUnique({ where: { id } });
    if (!existing) throw notFound("Transfer order not found");
    const { items: _items, ...scalars } = body;
    const updated = await prisma.transferOrder.update({ where: { id }, data: scalars });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "TransferOrder", entityId: String(id), before: { requisitionId: existing.requisitionId }, after: { requisitionId: updated.requisitionId }, ip: req.ip });
    res.json(updated);
  })
);

router.delete(
  "/orders/:id",
  requireRole(Role.ADMIN, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.transferOrder.findUnique({ where: { id } });
    if (!existing) throw notFound("Transfer order not found");
    if (existing.status !== TransferStatus.DISPATCHED && existing.status !== TransferStatus.IN_TRANSIT) throw badRequest("Only dispatched or in-transit orders can be deleted");
    try {
      await prisma.transferOrder.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "TransferOrder", entityId: String(id), before: { number: existing.number }, ip: req.ip });
    res.json({ ok: true });
  })
);

router.get(
  "/orders",
  asyncHandler(async (_req, res) => {
    const list = await prisma.transferOrder.findMany({
      include: { requisition: { include: { fromWarehouse: true, toWarehouse: true } }, items: { include: { item: true } }, receipts: true, interCompany: true },
      orderBy: { dispatchedAt: "desc" },
    });
    res.json(list);
  })
);

/** In-transit aging: transfers dispatched but not yet received, with days in transit. */
router.get(
  "/orders/aging",
  asyncHandler(async (_req, res) => {
    const now = Date.now();
    const inTransit = await prisma.transferOrder.findMany({
      where: { status: { in: [TransferStatus.DISPATCHED, TransferStatus.IN_TRANSIT] } },
      include: { requisition: { include: { fromWarehouse: true, toWarehouse: true } }, items: { include: { item: true } } },
      orderBy: { dispatchedAt: "asc" },
    });
    const rows = inTransit.map((o) => {
      const days = Math.floor((now - (o.dispatchedAt?.getTime() ?? now)) / (24 * 3600 * 1000));
      return { id: o.id, number: o.number, from: o.requisition.fromWarehouse.code, to: o.requisition.toWarehouse.code, dispatchedAt: o.dispatchedAt, daysInTransit: days, stale: days > 3, items: o.items.length };
    });
    res.json(rows);
  })
);

export default router;