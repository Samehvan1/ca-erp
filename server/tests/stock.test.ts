import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { postStockMove, fefoPick, recalcWac, getStockBalance } from "../src/lib/stock.js";

/**
 * Stock engine tests: FEFO ordering, expired-batch blocking, WAC calculation.
 * Uses dedicated test items/warehouses so seeded stock never interferes.
 */
describe("stock engine", () => {
  let whId: number;

  beforeAll(async () => {
    const wh = await prisma.warehouse.create({
      data: { code: `T-WH-${Date.now()}`, name: "Test Warehouse", type: "BRANCH", projectId: 1, owner: "tests" },
    });
    whId = wh.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function freshItem() {
    return prisma.item.create({
      data: { code: `T-ITM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, description: "Test Item", scope: "CROSS_PROJECT", category: "Test", valuationMethod: "WAC", abcClass: "C" },
    });
  }

  it("FEFO picks the earliest-expiring batch first", async () => {
    const item = await freshItem();
    const now = Date.now();
    const b1 = await prisma.batch.create({ data: { itemId: item.id, batchNo: `T-FEFO-1-${now}`, expiryDate: new Date(now + 10 * 86400000), quantity: 0, warehouseId: whId } });
    const b2 = await prisma.batch.create({ data: { itemId: item.id, batchNo: `T-FEFO-2-${now}`, expiryDate: new Date(now + 30 * 86400000), quantity: 0, warehouseId: whId } });
    await postStockMove({ warehouseId: whId, itemId: item.id, batchId: b1.id, qty: 10, unitCost: 40, refType: "TEST" });
    await postStockMove({ warehouseId: whId, itemId: item.id, batchId: b2.id, qty: 10, unitCost: 40, refType: "TEST" });

    const picks = await fefoPick(whId, item.id, 12);
    expect(picks).toHaveLength(2);
    expect(picks[0].batchId).toBe(b1.id);
    expect(picks[0].qty).toBe(10);
    expect(picks[1].batchId).toBe(b2.id);
    expect(picks[1].qty).toBe(2);
  });

  it("expired batches are blocked from FEFO picks", async () => {
    const item = await freshItem();
    const now = Date.now();
    const expired = await prisma.batch.create({ data: { itemId: item.id, batchNo: `T-EXP-${now}`, expiryDate: new Date(now - 1 * 86400000), quantity: 0, warehouseId: whId } });
    await postStockMove({ warehouseId: whId, itemId: item.id, batchId: expired.id, qty: 10, unitCost: 40, refType: "TEST" });

    // Only stock available is expired -> FEFO must reject
    await expect(fefoPick(whId, item.id, 10)).rejects.toThrow(/Insufficient available stock/);
  });

  it("WAC is the weighted average of in-stock layers", async () => {
    const item = await freshItem();
    const now = Date.now();
    const b1 = await prisma.batch.create({ data: { itemId: item.id, batchNo: `T-WAC-B1-${now}`, expiryDate: new Date(now + 90 * 86400000), quantity: 0, warehouseId: whId } });
    const b2 = await prisma.batch.create({ data: { itemId: item.id, batchNo: `T-WAC-B2-${now}`, expiryDate: new Date(now + 90 * 86400000), quantity: 0, warehouseId: whId } });
    await postStockMove({ warehouseId: whId, itemId: item.id, batchId: b1.id, qty: 10, unitCost: 20, refType: "TEST" });
    await postStockMove({ warehouseId: whId, itemId: item.id, batchId: b2.id, qty: 30, unitCost: 40, refType: "TEST" });

    const wac = await recalcWac(item.id);
    // (10*20 + 30*40) / 40 = 1400/40 = 35
    expect(wac).toBeCloseTo(35, 6);
    expect(await getStockBalance(whId, item.id)).toBe(40);
  });

  it("rejects a stock-out that would drive balance negative", async () => {
    const item = await freshItem();
    await expect(
      postStockMove({ warehouseId: whId, itemId: item.id, qty: -5, refType: "TEST" })
    ).rejects.toThrow(/Insufficient stock balance/);
  });
});