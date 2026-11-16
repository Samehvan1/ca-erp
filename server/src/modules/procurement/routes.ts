import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, isForeignKeyViolation } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole, canAccessProject } from "../../middleware/rbac.js";
import { audit } from "../../lib/audit.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { postStockMove, recalcWac } from "../../lib/stock.js";
import { postGl, ensureAccount } from "../../lib/gl.js";
import { AuditAction, ApprovalStatus, GrnStatus, InvoiceStatus, PaymentType, PoStatus, RequisitionStatus, RequisitionType, Role } from "@prisma/client";

const router = Router();
router.use(requireAuth);

const seq = (() => {
  let n = 0;
  return (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${(++n).toString().padStart(4, "0")}`;
})();

// ============ REQUISITIONS ============

const requisitionSchema = z.object({
  projectId: z.number().int(),
  type: z.nativeEnum(RequisitionType).optional(),
  costCenterId: z.number().int().nullable().optional(),
  items: z.array(z.object({ itemId: z.number().int(), brandVariantId: z.number().int().nullable().optional(), quantity: z.number().positive(), unitPrice: z.number().nonnegative().optional() })).min(1),
});

router.get(
  "/requisitions",
  asyncHandler(async (req, res) => {
    const requisitions = await prisma.requisition.findMany({
      where: { projectId: canAccessProject(req.user!, req.user!.projectId ?? -1) ? undefined : req.user!.projectId ?? -1 },
      include: { items: { include: { item: true, brandVariant: true } }, approvals: { include: { approver: true } }, project: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(requisitions);
  })
);

router.post(
  "/requisitions",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.PROJECT_WAREHOUSE_MANAGER, Role.BRANCH_MANAGER, Role.HEAD_CHEF, Role.HEAD_BARISTA),
  asyncHandler(async (req, res) => {
    const body = requisitionSchema.parse(req.body);
    if (!canAccessProject(req.user!, body.projectId)) throw badRequest("Cannot create requisition for another project");
    const totalValue = body.items.reduce((s, i) => s + i.quantity * (i.unitPrice ?? 0), 0);
    const requisition = await prisma.requisition.create({
      data: {
        number: seq("PR"),
        projectId: body.projectId,
        type: body.type ?? RequisitionType.MANUAL,
        status: RequisitionStatus.PENDING_APPROVAL,
        totalValue,
        requestedById: req.user!.id,
        costCenterId: body.costCenterId ?? null,
        items: { create: body.items.map((i) => ({ itemId: i.itemId, brandVariantId: i.brandVariantId ?? null, quantity: i.quantity, unitPrice: i.unitPrice ?? 0 })) },
      },
      include: { items: { include: { item: true } }, project: true, costCenter: true },
    });
    await audit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: "Requisition",
      entityId: String(requisition.id),
      after: {
        number: requisition.number,
        status: requisition.status,
        type: requisition.type,
        project: requisition.project?.name ?? String(requisition.projectId),
        costCenter: requisition.costCenter?.name ?? "None",
        totalValue: `${requisition.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} EGP`,
        itemsCount: requisition.items.length,
        itemsSummary: requisition.items.map((i) => `${i.quantity}x ${i.item.description || i.item.code}${i.unitPrice ? ` @ ${i.unitPrice} EGP` : ""}`).join(", "),
      },
      ip: req.ip,
    });
    res.status(201).json(requisition);
  })
);

router.patch(
  "/requisitions/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.PROJECT_WAREHOUSE_MANAGER, Role.BRANCH_MANAGER, Role.HEAD_CHEF, Role.HEAD_BARISTA),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = requisitionSchema.partial().parse(req.body);
    const existing = await prisma.requisition.findUnique({
      where: { id },
      include: { items: { include: { item: true } }, project: true, costCenter: true },
    });
    if (!existing) throw notFound("Requisition not found");
    const { items, ...scalars } = body;
    const totalValue = items ? items.reduce((s, i) => s + i.quantity * (i.unitPrice ?? 0), 0) : existing.totalValue;
    const updated = await prisma.requisition.update({
      where: { id },
      data: {
        ...scalars,
        ...(items ? { totalValue, items: { deleteMany: {}, create: items.map((i) => ({ itemId: i.itemId, brandVariantId: i.brandVariantId ?? null, quantity: i.quantity, unitPrice: i.unitPrice ?? 0 })) } } : {}),
      },
      include: { items: { include: { item: true } }, project: true, costCenter: true },
    });
    await audit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: "Requisition",
      entityId: String(id),
      before: {
        number: existing.number,
        status: existing.status,
        type: existing.type,
        project: existing.project?.name ?? String(existing.projectId),
        costCenter: existing.costCenter?.name ?? "None",
        totalValue: `${existing.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} EGP`,
        itemsCount: existing.items.length,
        itemsSummary: existing.items.map((i) => `${i.quantity}x ${i.item.description || i.item.code}${i.unitPrice ? ` @ ${i.unitPrice} EGP` : ""}`).join(", "),
      },
      after: {
        number: updated.number,
        status: updated.status,
        type: updated.type,
        project: updated.project?.name ?? String(updated.projectId),
        costCenter: updated.costCenter?.name ?? "None",
        totalValue: `${updated.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} EGP`,
        itemsCount: updated.items.length,
        itemsSummary: updated.items.map((i) => `${i.quantity}x ${i.item.description || i.item.code}${i.unitPrice ? ` @ ${i.unitPrice} EGP` : ""}`).join(", "),
      },
      ip: req.ip,
    });
    res.json(updated);
  })
);

router.delete(
  "/requisitions/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.PROJECT_WAREHOUSE_MANAGER, Role.BRANCH_MANAGER, Role.HEAD_CHEF, Role.HEAD_BARISTA),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.requisition.findUnique({ where: { id } });
    if (!existing) throw notFound("Requisition not found");
    if (existing.status !== RequisitionStatus.DRAFT && existing.status !== RequisitionStatus.PENDING_APPROVAL) throw badRequest("Only draft or pending approval requisitions can be deleted");
    try {
      await prisma.requisition.delete({ where: { id } });
    } catch (e: any) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "Requisition", entityId: String(id), before: { number: existing.number, status: existing.status }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ROP-triggered requisition: auto-generate from reorder point check
router.post(
  "/requisitions/rop-trigger",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const rops = await prisma.reorderPoint.findMany({ include: { item: true, warehouse: true } });
    const created = [];
    for (const r of rops) {
      const balance = await prisma.stockLedger.aggregate({ where: { warehouseId: r.warehouseId, itemId: r.itemId }, _sum: { balance: true } });
      const bal = balance._sum.balance ?? 0;
      if (bal <= r.reorderPoint) {
        const qty = r.reorderPoint * 2 - bal;
        const projectId = r.warehouse.projectId ?? (await prisma.project.findFirst({ where: { isGroup: true } }))!.id;
        const pr = await prisma.requisition.create({
          data: {
            number: seq("PR-ROP"),
            projectId,
            type: RequisitionType.ROP,
            status: RequisitionStatus.PENDING_APPROVAL,
            totalValue: 0,
            requestedById: req.user!.id,
            items: { create: [{ itemId: r.itemId, quantity: qty, unitPrice: 0 }] },
          },
        });
        created.push({ requisition: pr, item: r.item, warehouse: r.warehouse, balance: bal, reorderPoint: r.reorderPoint, suggestedQty: qty });
      }
    }
    res.status(201).json({ created });
  })
);

// Group-consolidated requisition: merge approved PRs from multiple projects into one
router.post(
  "/requisitions/consolidate",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const body = z.object({ requisitionIds: z.array(z.number().int()).min(2) }).parse(req.body);
    const requisitions = await prisma.requisition.findMany({ where: { id: { in: body.requisitionIds } }, include: { items: true, project: true } });
    if (requisitions.length !== body.requisitionIds.length) throw badRequest("One or more requisitions not found");
    if (requisitions.some((r) => r.status !== RequisitionStatus.APPROVED)) throw badRequest("All requisitions must be approved before consolidation");

    const group = await prisma.project.findFirst({ where: { isGroup: true } });
    if (!group) throw badRequest("No group project configured");

    // Merge items by itemId+brandVariantId
    const merged = new Map<string, { itemId: number; brandVariantId: number | null; quantity: number; unitPrice: number }>();
    for (const r of requisitions) {
      for (const item of r.items) {
        const key = `${item.itemId}:${item.brandVariantId ?? "null"}`;
        const existing = merged.get(key);
        if (existing) {
          existing.quantity += item.quantity;
          existing.unitPrice = Math.max(existing.unitPrice, item.unitPrice);
        } else {
          merged.set(key, { itemId: item.itemId, brandVariantId: item.brandVariantId, quantity: item.quantity, unitPrice: item.unitPrice });
        }
      }
    }

    const totalValue = [...merged.values()].reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const consolidated = await prisma.requisition.create({
      data: {
        number: seq("PR-GC"),
        projectId: group.id,
        type: RequisitionType.GROUP_CONSOLIDATED,
        status: RequisitionStatus.APPROVED,
        totalValue,
        requestedById: req.user!.id,
        items: { create: [...merged.values()].map((i) => ({ itemId: i.itemId, brandVariantId: i.brandVariantId, quantity: i.quantity, unitPrice: i.unitPrice })) },
      },
      include: { items: true },
    });
    await prisma.requisition.updateMany({ where: { id: { in: body.requisitionIds } }, data: { status: RequisitionStatus.CONVERTED } });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "Requisition", entityId: String(consolidated.id), after: { number: consolidated.number, sourceCount: requisitions.length, totalValue }, ip: req.ip });
    res.status(201).json(consolidated);
  })
);

// DoA approval: approve/reject a requisition
router.post(
  "/requisitions/:id/approve",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.CFO, Role.PROCUREMENT_OFFICER, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ approve: z.boolean().default(true), comment: z.string().optional() }).parse(req.body ?? {});
    const requisition = await prisma.requisition.findUnique({ where: { id }, include: { items: true } });
    if (!requisition) throw notFound("Requisition not found");
    if (requisition.status !== RequisitionStatus.PENDING_APPROVAL) throw badRequest("Requisition is not pending approval");

    // DoA: value-based tiers
    const value = requisition.totalValue;
    const level = value > 500000 ? 3 : value > 100000 ? 2 : 1;
    const existing = await prisma.approval.findFirst({ where: { requisitionId: id, level } });
    if (existing && existing.status !== ApprovalStatus.PENDING) throw badRequest("This approval level was already decided");

    const approval = await prisma.approval.create({
      data: { requisitionId: id, level, approverId: req.user!.id, status: body.approve ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED, comment: body.comment, decidedAt: new Date() },
    });

    if (!body.approve) {
      await prisma.requisition.update({ where: { id }, data: { status: RequisitionStatus.REJECTED } });
    } else {
      // Higher tiers may still be required
      const higherPending = await prisma.approval.findFirst({ where: { requisitionId: id, level: { gt: level }, status: ApprovalStatus.PENDING } });
      if (!higherPending) {
        await prisma.requisition.update({ where: { id }, data: { status: RequisitionStatus.APPROVED } });
      }
    }
    await audit({ userId: req.user!.id, action: body.approve ? AuditAction.APPROVE : AuditAction.REJECT, entityType: "Requisition", entityId: String(id), after: { level, status: body.approve ? "APPROVED" : "REJECTED" }, ip: req.ip });
    res.json(approval);
  })
);

// ============ PURCHASE ORDERS ============

const poSchema = z.object({
  requisitionId: z.number().int().optional(),
  vendorId: z.number().int(),
  projectId: z.number().int(),
  feesAmount: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  items: z.array(z.object({ itemId: z.number().int(), brandVariantId: z.number().int().nullable().optional(), orderedQty: z.number().positive(), unitPrice: z.number().nonnegative(), taxPct: z.number().nonnegative().optional(), discountPct: z.number().nonnegative().optional() })).min(1),
});

router.get(
  "/purchase-orders",
  asyncHandler(async (req, res) => {
    const pos = await prisma.purchaseOrder.findMany({
      where: { projectId: canAccessProject(req.user!, req.user!.projectId ?? -1) ? undefined : req.user!.projectId ?? -1 },
      include: { vendor: true, project: true, items: { include: { item: true, brandVariant: true } }, grns: true, createdBy: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(pos);
  })
);

router.post(
  "/purchase-orders",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const body = poSchema.parse(req.body);
    if (body.requisitionId) {
      const reqDoc = await prisma.requisition.findUnique({ where: { id: body.requisitionId } });
      if (!reqDoc) throw notFound("Requisition not found");
      if (reqDoc.status !== RequisitionStatus.APPROVED) throw badRequest("Requisition must be approved before creating a PO");
      await prisma.requisition.update({ where: { id: body.requisitionId }, data: { status: RequisitionStatus.CONVERTED } });
    }

    // Price from the vendor's active contracted price list when available (payment terms enforcement)
    const pricedItems = [];
    for (const item of body.items) {
      let unitPrice = item.unitPrice;
      if (item.brandVariantId) {
        const now = new Date();
        const list = await prisma.priceList.findFirst({
          where: { vendorId: body.vendorId, brandVariantId: item.brandVariantId, active: true, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gte: now } }] },
          include: { tiers: true },
          orderBy: { validFrom: "desc" },
        });
        if (list) {
          const applicable = list.tiers.filter((t) => item.orderedQty >= t.minQty).sort((a, b) => b.minQty - a.minQty)[0];
          unitPrice = list.unitPrice * (1 - (applicable?.discountPct ?? 0) / 100);
        }
      }
      pricedItems.push({ ...item, unitPrice });
    }

    const orderedQty = pricedItems.reduce((s, i) => s + i.orderedQty, 0);

    // Compute per-line and aggregate totals
    let subTotal = 0;
    let vatAmount = 0;
    let lineDiscountTotal = 0;
    for (const item of pricedItems) {
      const lineSubTotal = item.orderedQty * item.unitPrice;
      const lineVat = lineSubTotal * ((item.taxPct ?? 0) / 100);
      const lineDiscount = lineSubTotal * ((item.discountPct ?? 0) / 100);
      subTotal += lineSubTotal;
      vatAmount += lineVat;
      lineDiscountTotal += lineDiscount;
    }
    const discountAmount = body.discountAmount ?? lineDiscountTotal;
    const feesAmount = body.feesAmount ?? 0;
    const totalValue = subTotal + vatAmount - discountAmount + feesAmount;

    const po = await prisma.purchaseOrder.create({
      data: {
        number: seq("PO"),
        vendorId: body.vendorId,
        projectId: body.projectId,
        status: PoStatus.OPEN,
        orderedQty,
        outstandingQty: orderedQty,
        totalValue,
        subTotal,
        vatAmount,
        discountAmount,
        feesAmount,
        approvedById: req.user!.id,
        createdById: req.user!.id,
        items: { create: pricedItems.map((i) => ({ itemId: i.itemId, brandVariantId: i.brandVariantId ?? null, orderedQty: i.orderedQty, unitPrice: i.unitPrice, taxPct: i.taxPct ?? 0, discountPct: i.discountPct ?? 0 })) },
      },
      include: { items: true },
    });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "PurchaseOrder", entityId: String(po.id), after: { number: po.number, totalValue }, ip: req.ip });
    res.status(201).json(po);
  })
);

router.patch(
  "/purchase-orders/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = poSchema.partial().parse(req.body);
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing) throw notFound("PO not found");
    const { items, ...scalars } = body;
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...scalars,
        ...(items ? { items: { deleteMany: {}, create: items.map((i) => ({ itemId: i.itemId, brandVariantId: i.brandVariantId ?? null, orderedQty: i.orderedQty, unitPrice: i.unitPrice, taxPct: i.taxPct ?? 0, discountPct: i.discountPct ?? 0 })) } } : {}),
      },
      include: { items: true },
    });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "PurchaseOrder", entityId: String(id), before: { number: existing.number, status: existing.status, totalValue: existing.totalValue }, after: { number: updated.number, status: updated.status, totalValue: updated.totalValue }, ip: req.ip });
    res.json(updated);
  })
);

router.delete(
  "/purchase-orders/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing) throw notFound("PO not found");
    if (existing.status !== PoStatus.OPEN) throw badRequest("Only open purchase orders can be deleted");
    try {
      await prisma.purchaseOrder.delete({ where: { id } });
    } catch (e: any) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "PurchaseOrder", entityId: String(id), before: { number: existing.number, status: existing.status }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ============ GRN (Partial Receiving) ============

const grnSchema = z.object({
  poId: z.number().int(),
  items: z.array(z.object({ poItemId: z.number().int(), receivedQty: z.number().positive(), acceptedQty: z.number().nonnegative(), quarantinedQty: z.number().nonnegative(), batchNo: z.string().optional(), expiryDate: z.coerce.date().optional(), unitCost: z.number().nonnegative().optional() })).min(1),
});

router.get(
  "/grns",
  asyncHandler(async (_req, res) => {
    const grns = await prisma.grn.findMany({
      include: { po: { include: { vendor: true } }, items: { include: { item: true, poItem: true } }, debitNotes: true },
      orderBy: { receivedAt: "desc" },
    });
    res.json(grns);
  })
);

router.post(
  "/grns",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const body = grnSchema.parse(req.body);
    const po = await prisma.purchaseOrder.findUnique({ where: { id: body.poId }, include: { items: true } });
    if (!po) throw notFound("PO not found");
    if (po.status === PoStatus.FULLY_RECEIVED || po.status === PoStatus.FORCE_CLOSED) throw badRequest("PO is closed");

    const grn = await prisma.grn.create({
      data: { number: seq("GRN"), poId: body.poId, receivedById: req.user!.id, status: GrnStatus.RECEIVED },
    });

    let totalReceived = 0;
    for (const item of body.items) {
      const poItem = po.items.find((p) => p.id === item.poItemId);
      if (!poItem) throw badRequest(`PO item ${item.poItemId} not found`);
      if (item.receivedQty > poItem.orderedQty - poItem.receivedQty) throw badRequest("Received quantity exceeds outstanding PO quantity");
      if (item.acceptedQty + item.quarantinedQty > item.receivedQty) throw badRequest("Accepted + quarantined cannot exceed received");

      let batchId: number | null = null;
      if (item.acceptedQty > 0) {
        const batch = await prisma.batch.create({
          data: { itemId: poItem.itemId, brandVariantId: poItem.brandVariantId ?? null, batchNo: item.batchNo ?? seq("B"), expiryDate: item.expiryDate ?? new Date(Date.now() + 90 * 24 * 3600 * 1000), quantity: item.acceptedQty, warehouseId: (await prisma.warehouse.findFirst({ where: { projectId: po.projectId, type: "PROJECT_CENTRAL" } }))?.id ?? 1 },
        });
        batchId = batch.id;
        const wh = await prisma.warehouse.findFirst({ where: { projectId: po.projectId, type: "PROJECT_CENTRAL" } });
        if (wh) {
          await postStockMove({ warehouseId: wh.id, itemId: poItem.itemId, brandVariantId: poItem.brandVariantId ?? null, batchId: batch.id, qty: item.acceptedQty, unitCost: item.unitCost ?? poItem.unitPrice, refType: "GRN", refId: String(grn.id) });
        }
      }
      await prisma.grnItem.create({
        data: { grnId: grn.id, poItemId: poItem.id, itemId: poItem.itemId, brandVariantId: poItem.brandVariantId ?? null, receivedQty: item.receivedQty, acceptedQty: item.acceptedQty, quarantinedQty: item.quarantinedQty, batchId },
      });
      await prisma.purchaseOrderItem.update({ where: { id: poItem.id }, data: { receivedQty: { increment: item.receivedQty } } });
      totalReceived += item.receivedQty;
    }

    // Update PO status
    const newReceived = po.receivedQty + totalReceived;
    const newOutstanding = po.orderedQty - newReceived;
    const newStatus = newOutstanding <= 0 ? PoStatus.FULLY_RECEIVED : PoStatus.PARTIALLY_RECEIVED;
    await prisma.purchaseOrder.update({ where: { id: po.id }, data: { receivedQty: newReceived, outstandingQty: newOutstanding, status: newStatus } });

    // Auto debit notes for quarantined portions
    for (const item of body.items) {
      if (item.quarantinedQty > 0) {
        const poItem = po.items.find((p) => p.id === item.poItemId)!;
        await prisma.debitNote.create({ data: { number: seq("DN"), grnId: grn.id, vendorId: po.vendorId, amount: item.quarantinedQty * poItem.unitPrice, reason: "QC rejection - quarantined portion" } });
      }
    }

    const qcStatus = body.items.some((i) => i.quarantinedQty > 0) ? (body.items.every((i) => i.acceptedQty === 0) ? GrnStatus.QUARANTINED : GrnStatus.QC_PARTIAL) : GrnStatus.QC_PASSED;
    await prisma.grn.update({ where: { id: grn.id }, data: { status: qcStatus } });

    // Auto GL posting: Inventory Dr / GRNI Cr at received cost (idempotent per GRN)
    const inventory = await ensureAccount("1200", "Inventory", "ASSET");
    const grni = await ensureAccount("2100", "Goods Received Not Invoiced", "LIABILITY");
    const receivedValue = body.items.reduce((s, i) => s + i.acceptedQty * (i.unitCost ?? po.items.find((p) => p.id === i.poItemId)?.unitPrice ?? 0), 0);
    if (receivedValue > 0) {
      await postGl(`GRN-${grn.id}`, "GRN", String(grn.id), [
        { accountId: inventory.id, debit: receivedValue },
        { accountId: grni.id, credit: receivedValue },
      ]);
    }

    await audit({ userId: req.user!.id, action: AuditAction.RECEIVE, entityType: "Grn", entityId: String(grn.id), after: { poId: po.id, totalReceived }, ip: req.ip });
    res.status(201).json(await prisma.grn.findUnique({ where: { id: grn.id }, include: { items: true, debitNotes: true } }));
  })
);

router.patch(
  "/grns/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = grnSchema.partial().parse(req.body);
    const existing = await prisma.grn.findUnique({ where: { id } });
    if (!existing) throw notFound("GRN not found");
    const { items, ...scalars } = body;
    const updated = await prisma.grn.update({
      where: { id },
      data: {
        ...scalars,
        ...(items
          ? {
              items: {
                deleteMany: {},
                create: await Promise.all(
                  items.map(async (item) => {
                    const poItem = await prisma.purchaseOrderItem.findUnique({ where: { id: item.poItemId } });
                    if (!poItem) throw badRequest(`PO item ${item.poItemId} not found`);
                    return { poItemId: item.poItemId, itemId: poItem.itemId, brandVariantId: poItem.brandVariantId ?? null, receivedQty: item.receivedQty, acceptedQty: item.acceptedQty, quarantinedQty: item.quarantinedQty };
                  })
                ),
              },
            }
          : {}),
      },
      include: { items: true },
    });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "Grn", entityId: String(id), before: { number: existing.number, status: existing.status }, after: { number: updated.number, status: updated.status }, ip: req.ip });
    res.json(updated);
  })
);

router.delete(
  "/grns/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.PROJECT_WAREHOUSE_MANAGER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.grn.findUnique({ where: { id } });
    if (!existing) throw notFound("GRN not found");
    if (existing.status !== GrnStatus.RECEIVED) throw badRequest("Only received GRNs can be deleted");
    try {
      await prisma.grn.delete({ where: { id } });
    } catch (e: any) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "Grn", entityId: String(id), before: { number: existing.number, status: existing.status }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ============ INVOICES & 3-WAY MATCHING ============

const invoiceSchema = z.object({
  vendorId: z.number().int(),
  poId: z.number().int(),
  amount: z.number().positive(),
  items: z.array(z.object({ grnItemId: z.number().int(), quantity: z.number().positive(), unitPrice: z.number().nonnegative() })).min(1),
});

router.get(
  "/invoices",
  asyncHandler(async (_req, res) => {
    const invoices = await prisma.invoice.findMany({ include: { vendor: true, po: true, items: { include: { grnItem: true } } }, orderBy: { createdAt: "desc" } });
    res.json(invoices);
  })
);

router.post(
  "/invoices",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = invoiceSchema.parse(req.body);
    const po = await prisma.purchaseOrder.findUnique({ where: { id: body.poId }, include: { items: true } });
    if (!po) throw notFound("PO not found");

    // 3-way match: validate each line against its GRN tranche
    let matchedAmount = 0;
    for (const line of body.items) {
      const grnItem = await prisma.grnItem.findUnique({ where: { id: line.grnItemId }, include: { poItem: true } });
      if (!grnItem) throw badRequest(`GRN item ${line.grnItemId} not found`);
      if (grnItem.poItem.poId !== body.poId) throw badRequest("GRN item does not belong to this PO");
      const alreadyInvoiced = await prisma.invoiceItem.aggregate({ where: { grnItemId: line.grnItemId }, _sum: { quantity: true } });
      const invoicedQty = alreadyInvoiced._sum.quantity ?? 0;
      if (line.quantity > grnItem.acceptedQty - invoicedQty) throw badRequest(`Over-billing: line exceeds outstanding accepted quantity for GRN item ${line.grnItemId}`);
      matchedAmount += line.quantity * line.unitPrice;
    }

    if (matchedAmount > body.amount + 0.01) throw badRequest("Invoice amount is less than matched line total");
    const status: InvoiceStatus = matchedAmount < body.amount ? InvoiceStatus.PARTIALLY_APPROVED : InvoiceStatus.APPROVED;

    const invoice = await prisma.invoice.create({
      data: { number: seq("INV"), vendorId: body.vendorId, poId: body.poId, amount: body.amount, status, items: { create: body.items.map((i) => ({ grnItemId: i.grnItemId, quantity: i.quantity, unitPrice: i.unitPrice })) } },
      include: { items: true },
    });
    await prisma.apLedger.create({ data: { vendorId: body.vendorId, poId: body.poId, invoiceId: invoice.id, entryType: "INVOICE", amount: matchedAmount, balance: matchedAmount } });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "Invoice", entityId: String(invoice.id), after: { number: invoice.number, amount: body.amount, status }, ip: req.ip });
    res.status(201).json(invoice);
  })
);

router.patch(
  "/invoices/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = invoiceSchema.partial().parse(req.body);
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) throw notFound("Invoice not found");
    const { items, ...scalars } = body;
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        ...scalars,
        ...(items ? { items: { deleteMany: {}, create: items.map((i) => ({ grnItemId: i.grnItemId, quantity: i.quantity, unitPrice: i.unitPrice })) } } : {}),
      },
      include: { items: true },
    });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "Invoice", entityId: String(id), before: { number: existing.number, status: existing.status, amount: existing.amount }, after: { number: updated.number, status: updated.status, amount: updated.amount }, ip: req.ip });
    res.json(updated);
  })
);

router.delete(
  "/invoices/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) throw notFound("Invoice not found");
    if (existing.status !== InvoiceStatus.PENDING) throw badRequest("Only pending invoices can be deleted");
    try {
      await prisma.invoice.delete({ where: { id } });
    } catch (e: any) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "Invoice", entityId: String(id), before: { number: existing.number, status: existing.status }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ============ PAYMENTS ============

const paymentSchema = z.object({
  vendorId: z.number().int(),
  poId: z.number().int().nullable().optional(),
  invoiceId: z.number().int().nullable().optional(),
  type: z.nativeEnum(PaymentType),
  amount: z.number().positive(),
});

router.get(
  "/payments",
  asyncHandler(async (_req, res) => {
    const payments = await prisma.payment.findMany({ include: { vendor: true, po: true, invoice: true }, orderBy: { paidAt: "desc" } });
    res.json(payments);
  })
);

router.post(
  "/payments",
  requireRole(Role.ADMIN, Role.CFO, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = paymentSchema.parse(req.body);
    const lastLedger = await prisma.apLedger.findFirst({ where: { vendorId: body.vendorId }, orderBy: { id: "desc" } });
    const currentBalance = lastLedger?.balance ?? 0;
    if (body.amount > currentBalance + 0.01) throw badRequest("Payment exceeds outstanding supplier balance");

    const payment = await prisma.payment.create({
      data: { number: seq("PAY"), vendorId: body.vendorId, poId: body.poId ?? null, invoiceId: body.invoiceId ?? null, type: body.type, amount: body.amount, ledgerBalanceAfter: currentBalance - body.amount },
    });
    await prisma.apLedger.create({ data: { vendorId: body.vendorId, poId: body.poId ?? null, invoiceId: body.invoiceId ?? null, entryType: body.type === PaymentType.DOWN_PAYMENT ? "ADVANCE" : body.type === PaymentType.MILESTONE ? "MILESTONE" : "PAYMENT", amount: -body.amount, balance: currentBalance - body.amount } });
    await audit({ userId: req.user!.id, action: AuditAction.POST, entityType: "Payment", entityId: String(payment.id), after: { number: payment.number, amount: body.amount, type: body.type }, ip: req.ip });
    res.status(201).json(payment);
  })
);

router.patch(
  "/payments/:id",
  requireRole(Role.ADMIN, Role.CFO, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = paymentSchema.partial().parse(req.body);
    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) throw notFound("Payment not found");
    const updated = await prisma.payment.update({ where: { id }, data: body });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "Payment", entityId: String(id), before: { number: existing.number, amount: existing.amount, type: existing.type }, after: { number: updated.number, amount: updated.amount, type: updated.type }, ip: req.ip });
    res.json(updated);
  })
);

router.delete(
  "/payments/:id",
  requireRole(Role.ADMIN, Role.CFO, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) throw notFound("Payment not found");
    try {
      await prisma.payment.delete({ where: { id } });
    } catch (e: any) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: record is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "Payment", entityId: String(id), before: { number: existing.number, amount: existing.amount }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ============ LANDED COST ============

const landedCostSchema = z.object({
  poId: z.number().int(),
  type: z.enum(["FREIGHT", "CUSTOMS", "CLEARANCE"]),
  amount: z.number().positive(),
});

router.post(
  "/landed-costs",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = landedCostSchema.parse(req.body);
    const po = await prisma.purchaseOrder.findUnique({ where: { id: body.poId }, include: { items: true } });
    if (!po) throw notFound("PO not found");
    const lc = await prisma.landedCost.create({ data: { poId: body.poId, type: body.type, amount: body.amount } });

    // Apportion proportionally across received quantities per PO item
    const totalReceived = po.items.reduce((s, i) => s + i.receivedQty, 0);
    if (totalReceived > 0) {
      for (const item of po.items) {
        if (item.receivedQty > 0) {
          const share = (body.amount * item.receivedQty) / totalReceived;
          await prisma.purchaseOrderItem.update({ where: { id: item.id }, data: { landedCost: { increment: share } } });
        }
      }
    }
    await prisma.landedCost.update({ where: { id: lc.id }, data: { allocatedAmount: body.amount } });
    await audit({ userId: req.user!.id, action: AuditAction.POST, entityType: "LandedCost", entityId: String(lc.id), after: { poId: body.poId, type: body.type, amount: body.amount }, ip: req.ip });
    res.status(201).json(lc);
  })
);

// ============ FORCE CLOSE ============

router.post(
  "/purchase-orders/:id/force-close",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.CFO),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw notFound("PO not found");
    if (po.status === PoStatus.FULLY_RECEIVED) throw badRequest("PO already fully received");
    const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: PoStatus.FORCE_CLOSED } });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "PurchaseOrder", entityId: String(id), before: { status: po.status }, after: { status: PoStatus.FORCE_CLOSED }, ip: req.ip });
    res.json(updated);
  })
);

export default router;