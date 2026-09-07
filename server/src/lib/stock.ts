import { prisma } from "./prisma.js";
import { badRequest } from "./errors.js";

export interface StockMove {
  warehouseId: number;
  itemId: number;
  brandVariantId?: number | null;
  batchId?: number | null;
  qty: number; // positive = in, negative = out
  unitCost?: number;
  refType: string;
  refId?: string | null;
}

/** Post a stock movement to the ledger and update batch quantity. */
export async function postStockMove(move: StockMove) {
  const { warehouseId, itemId, brandVariantId: requestedVariant, batchId, qty, unitCost = 0, refType, refId } = move;

  // When a batch is involved, the batch is authoritative for the brand variant
  let brandVariantId = requestedVariant;
  if (batchId) {
    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) throw badRequest("Batch not found");
    if (qty < 0 && batch.quantity + qty < 0) throw badRequest("Insufficient batch quantity");
    await prisma.batch.update({
      where: { id: batchId },
      data: { quantity: { increment: qty } },
    });
    brandVariantId = batch.brandVariantId;
  }

  const last = await prisma.stockLedger.findFirst({
    where: { warehouseId, itemId, brandVariantId: brandVariantId ?? null, batchId: batchId ?? null },
    orderBy: { id: "desc" },
  });
  const balance = (last?.balance ?? 0) + qty;
  if (balance < 0) throw badRequest("Insufficient stock balance");

  return prisma.stockLedger.create({
    data: {
      warehouseId,
      itemId,
      brandVariantId: brandVariantId ?? null,
      batchId: batchId ?? null,
      qtyIn: qty > 0 ? qty : 0,
      qtyOut: qty < 0 ? -qty : 0,
      balance,
      unitCost,
      refType,
      refId: refId ?? null,
    },
  });
}

/** Current stock balance for an item (optionally per brand variant) in a warehouse. */
export async function getStockBalance(warehouseId: number, itemId: number, brandVariantId?: number | null) {
  const agg = await prisma.stockLedger.aggregate({
    where: { warehouseId, itemId, brandVariantId: brandVariantId ?? null },
    _sum: { balance: true },
  });
  return agg._sum.balance ?? 0;
}

/** FEFO pick: returns batches ordered by earliest expiry first, consuming up to qty. */
export async function fefoPick(warehouseId: number, itemId: number, qty: number, brandVariantId?: number | null) {
  const batches = await prisma.batch.findMany({
    where: {
      warehouseId,
      itemId,
      brandVariantId: brandVariantId ?? undefined,
      quantity: { gt: 0 },
      expiryDate: { gt: new Date() }, // expired batches are blocked
    },
    orderBy: { expiryDate: "asc" },
  });
  const picks: { batchId: number; qty: number }[] = [];
  let remaining = qty;
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(b.quantity, remaining);
    picks.push({ batchId: b.id, qty: take });
    remaining -= take;
  }
  if (remaining > 0) throw badRequest(`Insufficient available stock (FEFO): ${remaining} units short`);
  return picks;
}

/** Recalculate Weighted Average Cost for an item across all in-stock ledger entries. */
export async function recalcWac(itemId: number) {
  const entries = await prisma.stockLedger.findMany({
    where: { itemId, balance: { gt: 0 } },
    orderBy: { id: "asc" },
  });
  const totalQty = entries.reduce((s, e) => s + e.balance, 0);
  const totalCost = entries.reduce((s, e) => s + e.balance * e.unitCost, 0);
  return totalQty > 0 ? totalCost / totalQty : 0;
}

/** Generate a sequential document number with prefix. */
export async function nextNumber(prefix: string): Promise<string> {
  const count = await prisma.stockLedger.count(); // cheap uniqueness helper
  const stamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${stamp}-${(count % 10000).toString().padStart(4, "0")}`;
}