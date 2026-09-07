import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/error.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/**
 * Operational KPI summary for the dashboard.
 * Aggregates counts/values across modules in a single round trip.
 */
router.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

    // Stock value at WAC (from ledger balances with positive balance)
    const items = await prisma.item.findMany({ include: { stockLedgers: { where: { balance: { gt: 0 } } } } });
    const stockValue = items.reduce((sum, i) => {
      const qty = i.stockLedgers.reduce((s, l) => s + l.balance, 0);
      const wac = qty > 0 ? i.stockLedgers.reduce((s, l) => s + l.balance * l.unitCost, 0) / qty : 0;
      return sum + qty * wac;
    }, 0);

    // Items at/below their reorder point
    const rops = await prisma.reorderPoint.findMany({ include: { item: { include: { stockLedgers: { where: { balance: { gt: 0 } } } } } } });
    const lowStockCount = rops.filter((r) => {
      const bal = r.item.stockLedgers.reduce((s, l) => s + l.balance, 0);
      return bal <= r.reorderPoint;
    }).length;

    // Open purchase orders (not fully received)
    const openPoCount = await prisma.purchaseOrder.count({ where: { status: { in: ["OPEN", "PARTIALLY_RECEIVED"] } } });

    // Pending approvals across workflows
    const [pendingReqs, pendingInvoices, pendingAdjustments, pendingWaste] = await Promise.all([
      prisma.requisition.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.invoice.count({ where: { status: "PENDING" } }),
      prisma.adjustment.count({ where: { status: "PENDING" } }),
      prisma.wasteLog.count({ where: { status: "PENDING" } }),
    ]);
    const pendingApprovals = pendingReqs + pendingInvoices + pendingAdjustments + pendingWaste;

    // Accounts payable: latest ledger balance per vendor
    const vendors = await prisma.vendor.findMany({ include: { apLedger: { orderBy: { id: "asc" } } } });
    const apBalance = vendors.reduce((sum, v) => sum + (v.apLedger[v.apLedger.length - 1]?.balance ?? 0), 0);

    // Batches expiring within 30 days
    const expiringSoon = await prisma.batch.count({ where: { quantity: { gt: 0 }, expiryDate: { gt: now, lte: in30 } } });

    // Transfer orders in transit
    const inTransitCount = await prisma.transferOrder.count({ where: { status: { in: ["DISPATCHED", "IN_TRANSIT"] } } });

    // Stocktakes not yet completed
    const pendingStocktakes = await prisma.stocktake.count({ where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } } });

    res.json({
      stockValue,
      lowStockCount,
      openPoCount,
      pendingApprovals,
      apBalance,
      expiringSoon,
      inTransitCount,
      pendingStocktakes,
      generatedAt: now,
    });
  })
);

export default router;