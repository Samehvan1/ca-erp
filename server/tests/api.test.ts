import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

/**
 * API integration tests: 3-way matching, partial receiving, ROP trigger, RBAC.
 * Runs against the dedicated test DB (tests/global-setup.ts).
 */
const app = createApp();
let admin: Record<string, string>;

beforeAll(async () => {
  const res = await request(app).post("/api/v1/auth/login").send({ email: "admin@capitalagro.com", password: "Admin@123" }).expect(200);
  admin = { Authorization: `Bearer ${res.body.token}` };
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("procurement 3-way matching", () => {
  it("rejects over-billing beyond the accepted GRN quantity", async () => {
    // PR -> approve -> PO -> GRN (6 of 10 accepted)
    const pr = await request(app).post("/api/v1/procurement/requisitions").set(admin).send({
      projectId: 1,
      items: [{ itemId: 2, quantity: 10, unitPrice: 30 }],
    }).expect(201);
    await request(app).post(`/api/v1/procurement/requisitions/${pr.body.id}/approve`).set(admin).send({ approve: true }).expect(200);

    const po = await request(app).post("/api/v1/procurement/purchase-orders").set(admin).send({
      requisitionId: pr.body.id,
      vendorId: 1,
      projectId: 1,
      items: [{ itemId: 2, orderedQty: 10, unitPrice: 30 }],
    }).expect(201);
    const poItemId = po.body.items[0].id;

    const grn = await request(app).post("/api/v1/procurement/grns").set(admin).send({
      poId: po.body.id,
      items: [{ poItemId, receivedQty: 6, acceptedQty: 6, quarantinedQty: 0 }],
    }).expect(201);
    expect(grn.body.status).toBe("QC_PASSED");
    const grnItemId = grn.body.items[0].id;

    // PO must still be open (PARTIALLY_RECEIVED) with outstanding 4
    const poAfter = await request(app).get("/api/v1/procurement/purchase-orders").set(admin).expect(200);
    const found = poAfter.body.find((p: { id: number }) => p.id === po.body.id);
    expect(found.status).toBe("PARTIALLY_RECEIVED");
    expect(found.outstandingQty).toBe(4);

    // Over-billing: invoice 10 units against 6 accepted -> rejected
    const over = await request(app).post("/api/v1/procurement/invoices").set(admin).send({
      vendorId: 1,
      poId: po.body.id,
      amount: 300,
      items: [{ grnItemId, quantity: 10, unitPrice: 30 }],
    });
    expect(over.status).toBe(400);
    expect(over.body.error).toMatch(/Over-billing/);

    // Correct invoice for 6 units -> APPROVED
    const inv = await request(app).post("/api/v1/procurement/invoices").set(admin).send({
      vendorId: 1,
      poId: po.body.id,
      amount: 180,
      items: [{ grnItemId, quantity: 6, unitPrice: 30 }],
    }).expect(201);
    expect(inv.body.status).toBe("APPROVED");
  });

  it("closes the PO once fully received", async () => {
    const pr = await request(app).post("/api/v1/procurement/requisitions").set(admin).send({
      projectId: 1,
      items: [{ itemId: 2, quantity: 4, unitPrice: 30 }],
    }).expect(201);
    await request(app).post(`/api/v1/procurement/requisitions/${pr.body.id}/approve`).set(admin).send({ approve: true }).expect(200);

    const po = await request(app).post("/api/v1/procurement/purchase-orders").set(admin).send({
      requisitionId: pr.body.id,
      vendorId: 1,
      projectId: 1,
      items: [{ itemId: 2, orderedQty: 4, unitPrice: 30 }],
    }).expect(201);
    const poItemId = po.body.items[0].id;

    await request(app).post("/api/v1/procurement/grns").set(admin).send({
      poId: po.body.id,
      items: [{ poItemId, receivedQty: 4, acceptedQty: 4, quarantinedQty: 0 }],
    }).expect(201);

    const poAfter = await request(app).get("/api/v1/procurement/purchase-orders").set(admin).expect(200);
    const found = poAfter.body.find((p: { id: number }) => p.id === po.body.id);
    expect(found.status).toBe("FULLY_RECEIVED");
    expect(found.outstandingQty).toBe(0);
  });
});

describe("ROP-triggered requisition", () => {
  it("creates a PR when balance falls to the reorder point", async () => {
    // Fresh item with zero stock + a high reorder point
    const item = await prisma.item.create({
      data: { code: `T-ROP-${Date.now()}`, description: "ROP Test Item", scope: "CROSS_PROJECT", category: "Test", valuationMethod: "WAC", abcClass: "C" },
    });
    const wh = await prisma.warehouse.findUniqueOrThrow({ where: { code: "PCW-FSH" } });
    await request(app).post("/api/v1/inventory/reorder-points").set(admin).send({
      itemId: item.id,
      warehouseId: wh.id,
      safetyStock: 10,
      reorderPoint: 20,
      leadTimeDays: 2,
      consumptionVelocity: 5,
    }).expect(200);

    const res = await request(app).post("/api/v1/procurement/requisitions/rop-trigger").set(admin).expect(201);
    const hit = res.body.created.find((c: { item: { id: number } }) => c.item.id === item.id);
    expect(hit).toBeDefined();
    expect(hit.suggestedQty).toBe(40); // reorderPoint*2 - balance(0)
    expect(hit.requisition.type).toBe("ROP");
  });
});

describe("RBAC enforcement", () => {
  it("denies BRANCH_MANAGER access to finance postings", async () => {
    const bm = await request(app).post("/api/v1/auth/login").send({ email: "bm.fanshy@capitalagro.com", password: "Admin@123" }).expect(200);
    const res = await request(app)
      .post("/api/v1/finance/postings")
      .set({ Authorization: `Bearer ${bm.body.token}` })
      .send({ postingKey: "RBAC-TEST", refType: "TEST", lines: [{ accountId: 1, debit: 10 }, { accountId: 2, credit: 10 }] });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not permitted/);
  });

  it("scopes BRANCH_MANAGER item visibility to their project", async () => {
    const bm = await request(app).post("/api/v1/auth/login").send({ email: "bm.fanshy@capitalagro.com", password: "Admin@123" }).expect(200);
    const res = await request(app).get("/api/v1/inventory/items").set({ Authorization: `Bearer ${bm.body.token}` }).expect(200);
    const ids = res.body.map((i: { id: number }) => i.id);
    const fanshyOnly = ids.every((id: number) => {
      const item = res.body.find((i: { id: number }) => i.id === id);
      return item.scope === "CROSS_PROJECT" || item.projectId === 1;
    });
    expect(fanshyOnly).toBe(true);
  });
});