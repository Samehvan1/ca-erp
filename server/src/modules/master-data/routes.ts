import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, isForeignKeyViolation } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { audit } from "../../lib/audit.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { AuditAction, Role, UnitDimension, ValuationMethod } from "@prisma/client";

const router = Router();
router.use(requireAuth);

// ==========================================
// 1. CATEGORIES CRUD
// ==========================================

const categorySchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  parentId: z.number().int().nullable().optional(),
  defaultValuationMethod: z.nativeEnum(ValuationMethod).optional().default(ValuationMethod.WAC),
  inventoryAccountId: z.number().int().nullable().optional(),
  cogsAccountId: z.number().int().nullable().optional(),
  taxRatePct: z.number().min(0).max(100).optional().default(0),
});

// List all categories with hierarchy and accounts
router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true } },
        inventoryAccount: { select: { id: true, code: true, name: true } },
        cogsAccount: { select: { id: true, code: true, name: true } },
        _count: { select: { items: true, children: true } },
      },
      orderBy: { code: "asc" },
    });
    res.json(categories);
  })
);

// Get single category
router.get(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        inventoryAccount: true,
        cogsAccount: true,
        items: { select: { id: true, code: true, description: true } },
      },
    });
    if (!category) throw notFound("Category not found");
    res.json(category);
  })
);

// Create category
router.post(
  "/categories",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = categorySchema.parse(req.body);
    const existing = await prisma.category.findUnique({ where: { code: body.code } });
    if (existing) throw conflict(`Category code "${body.code}" already exists`);

    if (body.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
      if (!parent) throw badRequest("Parent category does not exist");
    }

    const cat = await prisma.category.create({
      data: {
        code: body.code.toUpperCase(),
        name: body.name,
        parentId: body.parentId ?? null,
        defaultValuationMethod: body.defaultValuationMethod,
        inventoryAccountId: body.inventoryAccountId ?? null,
        cogsAccountId: body.cogsAccountId ?? null,
        taxRatePct: body.taxRatePct,
      },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        inventoryAccount: true,
        cogsAccount: true,
      },
    });

    await audit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: "Category",
      entityId: String(cat.id),
      after: { code: cat.code, name: cat.name },
      ip: req.ip,
    });

    res.status(201).json(cat);
  })
);

// Update category
router.patch(
  "/categories/:id",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = categorySchema.partial().parse(req.body);

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw notFound("Category not found");

    if (body.parentId !== undefined && body.parentId !== null) {
      if (body.parentId === id) throw badRequest("Category cannot be its own parent");
      const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
      if (!parent) throw badRequest("Parent category does not exist");
    }

    const cat = await prisma.category.update({
      where: { id },
      data: {
        ...(body.code ? { code: body.code.toUpperCase() } : {}),
        ...(body.name ? { name: body.name } : {}),
        ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
        ...(body.defaultValuationMethod ? { defaultValuationMethod: body.defaultValuationMethod } : {}),
        ...(body.inventoryAccountId !== undefined ? { inventoryAccountId: body.inventoryAccountId } : {}),
        ...(body.cogsAccountId !== undefined ? { cogsAccountId: body.cogsAccountId } : {}),
        ...(body.taxRatePct !== undefined ? { taxRatePct: body.taxRatePct } : {}),
      },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        inventoryAccount: true,
        cogsAccount: true,
      },
    });

    await audit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: "Category",
      entityId: String(id),
      before: { code: existing.code, name: existing.name },
      after: { code: cat.code, name: cat.name },
      ip: req.ip,
    });

    res.json(cat);
  })
);

// Delete category
router.delete(
  "/categories/:id",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { items: true, children: true } } },
    });
    if (!existing) throw notFound("Category not found");

    if (existing._count.items > 0) {
      throw badRequest(`Cannot delete category: ${existing._count.items} item(s) are assigned to it`);
    }
    if (existing._count.children > 0) {
      throw badRequest(`Cannot delete category: ${existing._count.children} subcategory/subcategories exist under it`);
    }

    try {
      await prisma.category.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: category is referenced by other records");
      throw e;
    }

    await audit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: "Category",
      entityId: String(id),
      before: { code: existing.code, name: existing.name },
      ip: req.ip,
    });

    res.json({ ok: true });
  })
);

// ==========================================
// 2. UNITS OF MEASURE (UOM) CRUD
// ==========================================

const unitSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(50),
  symbol: z.string().max(10).optional().nullable(),
  dimension: z.nativeEnum(UnitDimension),
  isBaseUnit: z.boolean().optional().default(false),
});

// List units
router.get(
  "/units",
  asyncHandler(async (_req, res) => {
    const units = await prisma.unitOfMeasure.findMany({
      include: {
        fromConversions: {
          include: { toUnit: { select: { id: true, code: true, name: true } }, item: { select: { id: true, code: true, description: true } } },
        },
        _count: { select: { baseItems: true, purchaseItems: true, recipeItems: true } },
      },
      orderBy: [{ dimension: "asc" }, { code: "asc" }],
    });
    res.json(units);
  })
);

// Create unit
router.post(
  "/units",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = unitSchema.parse(req.body);
    const existing = await prisma.unitOfMeasure.findUnique({ where: { code: body.code.toUpperCase() } });
    if (existing) throw conflict(`Unit code "${body.code}" already exists`);

    // If marked as base unit for dimension, unset any existing base unit in that dimension
    if (body.isBaseUnit) {
      await prisma.unitOfMeasure.updateMany({
        where: { dimension: body.dimension, isBaseUnit: true },
        data: { isBaseUnit: false },
      });
    }

    const unit = await prisma.unitOfMeasure.create({
      data: {
        code: body.code.toUpperCase(),
        name: body.name,
        symbol: body.symbol ?? body.code.toLowerCase(),
        dimension: body.dimension,
        isBaseUnit: body.isBaseUnit,
      },
    });

    await audit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: "UnitOfMeasure",
      entityId: String(unit.id),
      after: { code: unit.code, dimension: unit.dimension },
      ip: req.ip,
    });

    res.status(201).json(unit);
  })
);

// Update unit
router.patch(
  "/units/:id",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = unitSchema.partial().parse(req.body);

    const existing = await prisma.unitOfMeasure.findUnique({ where: { id } });
    if (!existing) throw notFound("Unit not found");

    if (body.isBaseUnit) {
      const dimension = body.dimension || existing.dimension;
      await prisma.unitOfMeasure.updateMany({
        where: { dimension, isBaseUnit: true, id: { not: id } },
        data: { isBaseUnit: false },
      });
    }

    const unit = await prisma.unitOfMeasure.update({
      where: { id },
      data: {
        ...(body.code ? { code: body.code.toUpperCase() } : {}),
        ...(body.name ? { name: body.name } : {}),
        ...(body.symbol !== undefined ? { symbol: body.symbol } : {}),
        ...(body.dimension ? { dimension: body.dimension } : {}),
        ...(body.isBaseUnit !== undefined ? { isBaseUnit: body.isBaseUnit } : {}),
      },
    });

    await audit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: "UnitOfMeasure",
      entityId: String(id),
      before: { code: existing.code },
      after: { code: unit.code },
      ip: req.ip,
    });

    res.json(unit);
  })
);

// Delete unit
router.delete(
  "/units/:id",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.unitOfMeasure.findUnique({
      where: { id },
      include: {
        _count: {
          select: { baseItems: true, purchaseItems: true, recipeItems: true, fromConversions: true, toConversions: true },
        },
      },
    });
    if (!existing) throw notFound("Unit not found");

    const totalUsage =
      existing._count.baseItems +
      existing._count.purchaseItems +
      existing._count.recipeItems +
      existing._count.fromConversions +
      existing._count.toConversions;

    if (totalUsage > 0) {
      throw badRequest(`Cannot delete unit: currently linked to items or conversion rules (${totalUsage} references)`);
    }

    try {
      await prisma.unitOfMeasure.delete({ where: { id } });
    } catch (e) {
      if (isForeignKeyViolation(e)) throw badRequest("Cannot delete: unit is referenced by other records");
      throw e;
    }

    await audit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: "UnitOfMeasure",
      entityId: String(id),
      before: { code: existing.code },
      ip: req.ip,
    });

    res.json({ ok: true });
  })
);

// ==========================================
// 3. UNIT CONVERSIONS CRUD
// ==========================================

const conversionSchema = z.object({
  fromUnitId: z.number().int(),
  toUnitId: z.number().int(),
  factor: z.number().positive("Conversion factor must be greater than zero"),
  itemId: z.number().int().nullable().optional(),
});

// List conversions
router.get(
  "/conversions",
  asyncHandler(async (req, res) => {
    const { itemId, dimension } = req.query;
    const where: any = {};
    if (itemId !== undefined) {
      where.itemId = itemId === "null" || itemId === "" ? null : Number(itemId);
    }
    if (dimension) {
      where.fromUnit = { dimension: String(dimension) as UnitDimension };
    }

    const conversions = await prisma.unitConversion.findMany({
      where,
      include: {
        fromUnit: true,
        toUnit: true,
        item: { select: { id: true, code: true, description: true } },
      },
      orderBy: [{ itemId: "asc" }, { id: "asc" }],
    });
    res.json(conversions);
  })
);

// Create conversion
router.post(
  "/conversions",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const body = conversionSchema.parse(req.body);

    if (body.fromUnitId === body.toUnitId) {
      throw badRequest("From Unit and To Unit must be distinct");
    }

    const [fromUnit, toUnit] = await Promise.all([
      prisma.unitOfMeasure.findUnique({ where: { id: body.fromUnitId } }),
      prisma.unitOfMeasure.findUnique({ where: { id: body.toUnitId } }),
    ]);

    if (!fromUnit || !toUnit) throw badRequest("Invalid fromUnitId or toUnitId");

    // If global (no itemId), units must share dimension OR count packaging
    if (!body.itemId && fromUnit.dimension !== toUnit.dimension && fromUnit.dimension !== UnitDimension.COUNT && toUnit.dimension !== UnitDimension.COUNT) {
      throw badRequest(`Cross-dimension conversions without an item reference are not permitted (${fromUnit.dimension} -> ${toUnit.dimension})`);
    }

    if (body.itemId) {
      const item = await prisma.item.findUnique({ where: { id: body.itemId } });
      if (!item) throw badRequest("Referenced item does not exist");
    }

    const existing = await prisma.unitConversion.findFirst({
      where: {
        fromUnitId: body.fromUnitId,
        toUnitId: body.toUnitId,
        itemId: body.itemId ?? null,
      },
    });

    if (existing) throw conflict("Conversion rule already exists for this unit pair");

    const conversion = await prisma.unitConversion.create({
      data: {
        fromUnitId: body.fromUnitId,
        toUnitId: body.toUnitId,
        factor: body.factor,
        itemId: body.itemId ?? null,
      },
      include: {
        fromUnit: true,
        toUnit: true,
        item: { select: { id: true, code: true, description: true } },
      },
    });

    await audit({
      userId: req.user!.id,
      action: AuditAction.CREATE,
      entityType: "UnitConversion",
      entityId: String(conversion.id),
      after: { from: fromUnit.code, to: toUnit.code, factor: conversion.factor, itemId: conversion.itemId },
      ip: req.ip,
    });

    res.status(201).json(conversion);
  })
);

// Update conversion factor
router.patch(
  "/conversions/:id",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ factor: z.number().positive() }).parse(req.body);

    const existing = await prisma.unitConversion.findUnique({ where: { id } });
    if (!existing) throw notFound("Conversion rule not found");

    const updated = await prisma.unitConversion.update({
      where: { id },
      data: { factor: body.factor },
      include: {
        fromUnit: true,
        toUnit: true,
        item: { select: { id: true, code: true, description: true } },
      },
    });

    await audit({
      userId: req.user!.id,
      action: AuditAction.UPDATE,
      entityType: "UnitConversion",
      entityId: String(id),
      before: { factor: existing.factor },
      after: { factor: updated.factor },
      ip: req.ip,
    });

    res.json(updated);
  })
);

// Delete conversion
router.delete(
  "/conversions/:id",
  requireRole(Role.ADMIN, Role.GROUP_EXECUTIVE, Role.COST_CONTROLLER),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.unitConversion.findUnique({ where: { id } });
    if (!existing) throw notFound("Conversion rule not found");

    await prisma.unitConversion.delete({ where: { id } });

    await audit({
      userId: req.user!.id,
      action: AuditAction.DELETE,
      entityType: "UnitConversion",
      entityId: String(id),
      before: { fromUnitId: existing.fromUnitId, toUnitId: existing.toUnitId, factor: existing.factor },
      ip: req.ip,
    });

    res.json({ ok: true });
  })
);

// Calculate smart conversion utility
router.post(
  "/conversions/calculate",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      qty: z.number(),
      fromUnitCode: z.string(),
      toUnitCode: z.string(),
      itemId: z.number().int().optional(),
    });
    const { qty, fromUnitCode, toUnitCode, itemId } = schema.parse(req.body);

    if (fromUnitCode.toUpperCase() === toUnitCode.toUpperCase()) {
      res.json({ qty, convertedQty: qty, factor: 1, formula: "1:1" });
      return;
    }

    const [fromUom, toUom] = await Promise.all([
      prisma.unitOfMeasure.findUnique({ where: { code: fromUnitCode.toUpperCase() } }),
      prisma.unitOfMeasure.findUnique({ where: { code: toUnitCode.toUpperCase() } }),
    ]);

    if (!fromUom || !toUom) {
      throw badRequest(`Unknown unit code(s): ${fromUnitCode} or ${toUnitCode}`);
    }

    // Step 1: Check item-specific direct conversion
    if (itemId) {
      const itemConv = await prisma.unitConversion.findFirst({
        where: {
          itemId,
          OR: [
            { fromUnitId: fromUom.id, toUnitId: toUom.id },
            { fromUnitId: toUom.id, toUnitId: fromUom.id },
          ],
        },
      });

      if (itemConv) {
        const factor = itemConv.fromUnitId === fromUom.id ? itemConv.factor : 1 / itemConv.factor;
        const convertedQty = Math.round((qty * factor + Number.EPSILON) * 10000) / 10000;
        res.json({
          qty,
          convertedQty,
          factor,
          formula: `1 ${fromUom.code} = ${factor} ${toUom.code} (Item Custom Packaging)`,
        });
        return;
      }
    }

    // Step 2: Check global direct conversion
    const directConv = await prisma.unitConversion.findFirst({
      where: {
        itemId: null,
        OR: [
          { fromUnitId: fromUom.id, toUnitId: toUom.id },
          { fromUnitId: toUom.id, toUnitId: fromUom.id },
        ],
      },
    });

    if (directConv) {
      const factor = directConv.fromUnitId === fromUom.id ? directConv.factor : 1 / directConv.factor;
      const convertedQty = Math.round((qty * factor + Number.EPSILON) * 10000) / 10000;
      res.json({
        qty,
        convertedQty,
        factor,
        formula: `1 ${fromUom.code} = ${factor} ${toUom.code} (Standard Rule)`,
      });
      return;
    }

    // Step 3: Check 2-step conversion through dimension base unit
    if (fromUom.dimension === toUom.dimension) {
      const baseUom = await prisma.unitOfMeasure.findFirst({
        where: { dimension: fromUom.dimension, isBaseUnit: true },
      });

      if (baseUom) {
        // Resolve from -> base and to -> base
        const getFactorToBase = async (u: typeof fromUom) => {
          if (u.id === baseUom.id) return 1;
          const conv = await prisma.unitConversion.findFirst({
            where: {
              itemId: null,
              OR: [
                { fromUnitId: u.id, toUnitId: baseUom.id },
                { fromUnitId: baseUom.id, toUnitId: u.id },
              ],
            },
          });
          if (!conv) return null;
          return conv.fromUnitId === u.id ? conv.factor : 1 / conv.factor;
        };

        const f1 = await getFactorToBase(fromUom);
        const f2 = await getFactorToBase(toUom);

        if (f1 !== null && f2 !== null && f2 !== 0) {
          const factor = f1 / f2;
          const convertedQty = Math.round((qty * factor + Number.EPSILON) * 10000) / 10000;
          res.json({
            qty,
            convertedQty,
            factor,
            formula: `1 ${fromUom.code} = ${factor} ${toUom.code} (via Base Unit ${baseUom.code})`,
          });
          return;
        }
      }
    }

    throw badRequest(`No conversion path found between ${fromUom.code} and ${toUom.code}`);
  })
);

export default router;
