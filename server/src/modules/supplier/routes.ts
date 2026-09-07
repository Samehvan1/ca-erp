import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, isForeignKeyViolation } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { audit } from "../../lib/audit.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { AuditAction, PaymentTerms, Role } from "@prisma/client";

const router = Router();
router.use(requireAuth);

const vendorSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  registrationNo: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  bankDetails: z.string().optional().nullable(),
  paymentTerms: z.nativeEnum(PaymentTerms).optional(),
  supplyCategories: z.array(z.string()).optional(),
  taxType: z.string().optional().nullable(),
  taxRate: z.number().nonnegative().optional(),
});

// ---------- Vendors ----------
router.get(
  "/vendors",
  asyncHandler(async (_req, res) => {
    const vendors = await prisma.vendor.findMany({
      include: { _count: { select: { priceLists: true, purchaseOrders: true } } },
      orderBy: { code: "asc" },
    });
    res.json(vendors);
  })
);

router.get(
  "/vendors/:id",
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({
      where: { id: Number(req.params.id) },
      include: { vendorItems: { include: { item: true } }, vendorBrands: { include: { brandVariant: { include: { item: true } } } }, priceLists: { include: { brandVariant: true, tiers: true } }, slas: true },
    });
    if (!vendor) throw notFound("Vendor not found");
    res.json(vendor);
  })
);

router.post(
  "/vendors",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.PROCUREMENT_OFFICER, Role.CFO),
  asyncHandler(async (req, res) => {
    const body = vendorSchema.parse(req.body);
    const existing = await prisma.vendor.findUnique({ where: { code: body.code } });
    if (existing) throw conflict("Vendor code already exists");
    const vendor = await prisma.vendor.create({ data: { ...body, supplyCategories: body.supplyCategories ?? [] } });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "Vendor", entityId: String(vendor.id), after: { code: vendor.code, name: vendor.name }, ip: req.ip });
    res.status(201).json(vendor);
  })
);

router.patch(
  "/vendors/:id",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.PROCUREMENT_OFFICER, Role.CFO),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = vendorSchema.partial().parse(req.body);
    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) throw notFound("Vendor not found");
    const vendor = await prisma.vendor.update({ where: { id }, data: body });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "Vendor", entityId: String(id), before: { name: existing.name }, after: { name: vendor.name }, ip: req.ip });
    res.json(vendor);
  })
);

router.delete(
  "/vendors/:id",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.PROCUREMENT_OFFICER, Role.CFO),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) throw notFound("Vendor not found");
    try {
      await prisma.vendor.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: vendor is referenced by other records");
      throw e;
    }
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "Vendor", entityId: String(id), before: { name: existing.name }, ip: req.ip });
    res.json({ ok: true });
  })
);

/** Vendor onboarding approval workflow: PENDING -> APPROVED/REJECTED. */
router.post(
  "/vendors/:id/approve",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.CFO),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ approve: z.boolean(), comment: z.string().optional() }).parse(req.body);
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw notFound("Vendor not found");
    if (vendor.approvalStatus !== "PENDING") throw badRequest("Vendor is not pending approval");
    const approvalStatus = body.approve ? "APPROVED" : "REJECTED";
    const updated = await prisma.vendor.update({ where: { id }, data: { approvalStatus, active: body.approve } });
    await audit({ userId: req.user!.id, action: body.approve ? AuditAction.APPROVE : AuditAction.REJECT, entityType: "Vendor", entityId: String(id), before: { approvalStatus: vendor.approvalStatus }, after: { approvalStatus }, ip: req.ip });
    res.json(updated);
  })
);

// ---------- Dual-level supplier mapping ----------
const mappingSchema = z.object({
  vendorId: z.number().int(),
  itemId: z.number().int().optional(),
  brandVariantId: z.number().int().optional(),
  isExclusive: z.boolean().optional(),
});

router.post(
  "/mappings/item",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const body = mappingSchema.parse(req.body);
    if (!body.itemId) throw badRequest("itemId is required");
    const existing = await prisma.vendorItem.findUnique({ where: { vendorId_itemId: { vendorId: body.vendorId, itemId: body.itemId } } });
    if (existing) throw conflict("Mapping already exists");
    const mapping = await prisma.vendorItem.create({ data: { vendorId: body.vendorId, itemId: body.itemId, isExclusive: body.isExclusive ?? false } });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "VendorItem", entityId: String(mapping.id), after: body, ip: req.ip });
    res.status(201).json(mapping);
  })
);

router.post(
  "/mappings/brand",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const body = mappingSchema.parse(req.body);
    if (!body.brandVariantId) throw badRequest("brandVariantId is required");
    const existing = await prisma.vendorBrandVariant.findUnique({ where: { vendorId_brandVariantId: { vendorId: body.vendorId, brandVariantId: body.brandVariantId } } });
    if (existing) throw conflict("Mapping already exists");
    const mapping = await prisma.vendorBrandVariant.create({ data: { vendorId: body.vendorId, brandVariantId: body.brandVariantId, isExclusive: body.isExclusive ?? false } });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "VendorBrandVariant", entityId: String(mapping.id), after: body, ip: req.ip });
    res.status(201).json(mapping);
  })
);

router.patch(
  "/mappings/item/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = mappingSchema.partial().parse(req.body);
    const existing = await prisma.vendorItem.findUnique({ where: { id } });
    if (!existing) throw notFound("Mapping not found");
    const mapping = await prisma.vendorItem.update({ where: { id }, data: body });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "VendorItem", entityId: String(id), before: { vendorId: existing.vendorId, isExclusive: existing.isExclusive }, after: { vendorId: mapping.vendorId, isExclusive: mapping.isExclusive }, ip: req.ip });
    res.json(mapping);
  })
);

router.delete(
  "/mappings/item/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.vendorItem.findUnique({ where: { id } });
    if (!existing) throw notFound("Mapping not found");
    await prisma.vendorItem.delete({ where: { id } });
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "VendorItem", entityId: String(id), before: { vendorId: existing.vendorId, isExclusive: existing.isExclusive }, ip: req.ip });
    res.json({ ok: true });
  })
);

router.patch(
  "/mappings/brand/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = mappingSchema.partial().parse(req.body);
    const existing = await prisma.vendorBrandVariant.findUnique({ where: { id } });
    if (!existing) throw notFound("Mapping not found");
    const mapping = await prisma.vendorBrandVariant.update({ where: { id }, data: body });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "VendorBrandVariant", entityId: String(id), before: { vendorId: existing.vendorId, isExclusive: existing.isExclusive }, after: { vendorId: mapping.vendorId, isExclusive: mapping.isExclusive }, ip: req.ip });
    res.json(mapping);
  })
);

router.delete(
  "/mappings/brand/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.vendorBrandVariant.findUnique({ where: { id } });
    if (!existing) throw notFound("Mapping not found");
    await prisma.vendorBrandVariant.delete({ where: { id } });
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "VendorBrandVariant", entityId: String(id), before: { vendorId: existing.vendorId, isExclusive: existing.isExclusive }, ip: req.ip });
    res.json({ ok: true });
  })
);

// ---------- Price lists ----------
const priceListSchema = z.object({
  vendorId: z.number().int(),
  brandVariantId: z.number().int(),
  unitPrice: z.number().positive(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional().nullable(),
  moq: z.number().nonnegative().optional(),
  tiers: z.array(z.object({ minQty: z.number(), discountPct: z.number() })).optional(),
});

router.get(
  "/price-lists",
  asyncHandler(async (_req, res) => {
    const lists = await prisma.priceList.findMany({
      include: { vendor: true, brandVariant: { include: { item: true } }, tiers: true },
      orderBy: { validFrom: "desc" },
    });
    res.json(lists);
  })
);

router.post(
  "/price-lists",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const body = priceListSchema.parse(req.body);
    const { tiers, ...rest } = body;
    const list = await prisma.priceList.create({
      data: { ...rest, tiers: tiers ? { create: tiers } : undefined },
      include: { tiers: true },
    });
    await audit({ userId: req.user!.id, action: AuditAction.CREATE, entityType: "PriceList", entityId: String(list.id), after: { vendorId: list.vendorId, unitPrice: list.unitPrice }, ip: req.ip });
    res.status(201).json(list);
  })
);

router.patch(
  "/price-lists/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = priceListSchema.partial().parse(req.body);
    const existing = await prisma.priceList.findUnique({ where: { id } });
    if (!existing) throw notFound("Price list not found");
    const { tiers, ...rest } = body;
    const list = await prisma.priceList.update({
      where: { id },
      data: { ...rest, tiers: tiers ? { create: tiers } : undefined },
      include: { tiers: true },
    });
    await audit({ userId: req.user!.id, action: AuditAction.UPDATE, entityType: "PriceList", entityId: String(id), before: { vendorId: existing.vendorId, unitPrice: existing.unitPrice }, after: { vendorId: list.vendorId, unitPrice: list.unitPrice }, ip: req.ip });
    res.json(list);
  })
);

router.delete(
  "/price-lists/:id",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.priceList.findUnique({ where: { id } });
    if (!existing) throw notFound("Price list not found");
    await prisma.priceList.delete({ where: { id } });
    await audit({ userId: req.user!.id, action: AuditAction.DELETE, entityType: "PriceList", entityId: String(id), before: { vendorId: existing.vendorId, unitPrice: existing.unitPrice }, ip: req.ip });
    res.json({ ok: true });
  })
);

/** Effective price for a vendor+brand at a given quantity (applies MOQ + tier discounts). */
router.get(
  "/price-lists/effective",
  asyncHandler(async (req, res) => {
    const vendorId = Number(req.query.vendorId);
    const brandVariantId = Number(req.query.brandVariantId);
    const qty = Number(req.query.qty ?? 1);
    const now = new Date();
    const list = await prisma.priceList.findFirst({
      where: { vendorId, brandVariantId, active: true, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gte: now } }] },
      include: { tiers: true },
      orderBy: { validFrom: "desc" },
    });
    if (!list) return res.status(404).json({ error: "No active price list for this vendor/brand" });
    let unitPrice = list.unitPrice;
    const applicable = list.tiers.filter((t) => qty >= t.minQty).sort((a, b) => b.minQty - a.minQty)[0];
    if (applicable) unitPrice = unitPrice * (1 - applicable.discountPct / 100);
    res.json({ priceListId: list.id, unitPrice, moq: list.moq, tierApplied: applicable ?? null });
  })
);

// ---------- SLA scorecard ----------
/** Compute SLA metrics from GRN/PO/invoice history for a vendor. */
router.post(
  "/slas/compute",
  requireRole(Role.ADMIN, Role.PROCUREMENT_OFFICER, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const vendorId = Number(req.body.vendorId);
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw notFound("Vendor not found");

    const pos = await prisma.purchaseOrder.findMany({ where: { vendorId }, include: { grns: true } });
    const totalPos = pos.length;
    const onTimeInFull = pos.filter((p) => p.status === "FULLY_RECEIVED").length;
    const otif = totalPos > 0 ? (onTimeInFull / totalPos) * 100 : 0;

    const invoices = await prisma.invoice.findMany({ where: { vendorId } });
    const priceVariance = invoices.length > 0 ? invoices.filter((i) => i.status === "REJECTED").length / invoices.length * 100 : 0;

    const grns = pos.flatMap((p) => p.grns);
    const qcRejected = grns.filter((g) => g.status === "QUARANTINED" || g.status === "QC_PARTIAL").length;
    const qcRejection = grns.length > 0 ? (qcRejected / grns.length) * 100 : 0;

    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - 1);
    const sla = await prisma.vendorSla.create({
      data: { vendorId, periodStart, periodEnd: new Date(), otifRate: otif, priceVarianceRate: priceVariance, qcRejectionRate: qcRejection, docAccuracyRate: Math.max(0, 100 - priceVariance) },
    });
    res.status(201).json(sla);
  })
);

router.get(
  "/slas",
  asyncHandler(async (_req, res) => {
    const slas = await prisma.vendorSla.findMany({ include: { vendor: true }, orderBy: { periodEnd: "desc" } });
    res.json(slas);
  })
);

export default router;