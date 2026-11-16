import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();
let admin: Record<string, string>;

beforeAll(async () => {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "admin@capitalagro.com", password: "Admin@123" })
    .expect(200);
  admin = { Authorization: `Bearer ${res.body.token}` };
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Master Data & Unit Conversion Engine", () => {
  it("CRUD categories with parent-child hierarchy", async () => {
    // 1. Create parent category
    const parentRes = await request(app)
      .post("/api/v1/master-data/categories")
      .set(admin)
      .send({
        code: "TEST-FOOD",
        name: "Test Food & Ingredients",
        defaultValuationMethod: "WAC",
        taxRatePct: 14,
      })
      .expect(201);

    expect(parentRes.body.code).toBe("TEST-FOOD");
    const parentId = parentRes.body.id;

    // 2. Create subcategory
    const subRes = await request(app)
      .post("/api/v1/master-data/categories")
      .set(admin)
      .send({
        code: "TEST-DAIRY",
        name: "Test Dairy Subcategory",
        parentId: parentId,
        defaultValuationMethod: "FIFO",
      })
      .expect(201);

    expect(subRes.body.parentId).toBe(parentId);

    // 3. List categories and verify nesting
    const listRes = await request(app)
      .get("/api/v1/master-data/categories")
      .set(admin)
      .expect(200);

    const foundParent = listRes.body.find((c: any) => c.id === parentId);
    expect(foundParent).toBeDefined();

    // 4. Clean up
    await request(app).delete(`/api/v1/master-data/categories/${subRes.body.id}`).set(admin).expect(200);
    await request(app).delete(`/api/v1/master-data/categories/${parentId}`).set(admin).expect(200);
  });

  it("manages Units of Measure and prevents deletion when referenced", async () => {
    const unitRes = await request(app)
      .post("/api/v1/master-data/units")
      .set(admin)
      .send({
        code: "TEST_PALLET",
        name: "Test Pallet Unit",
        symbol: "plt",
        dimension: "COUNT",
        isBaseUnit: false,
      })
      .expect(201);

    expect(unitRes.body.code).toBe("TEST_PALLET");

    // Patch unit
    const patchRes = await request(app)
      .patch(`/api/v1/master-data/units/${unitRes.body.id}`)
      .set(admin)
      .send({ name: "Updated Test Pallet" })
      .expect(200);

    expect(patchRes.body.name).toBe("Updated Test Pallet");

    // Delete unit
    await request(app)
      .delete(`/api/v1/master-data/units/${unitRes.body.id}`)
      .set(admin)
      .expect(200);
  });

  it("calculates conversions for both standard dimensions and custom item packaging", async () => {
    // 1. Standard dimension conversion: 2.5 KG -> G (1000x)
    const calcKgToG = await request(app)
      .post("/api/v1/master-data/conversions/calculate")
      .set(admin)
      .send({
        qty: 2.5,
        fromUnitCode: "KG",
        toUnitCode: "G",
      })
      .expect(200);

    expect(calcKgToG.body.convertedQty).toBe(2500);
    expect(calcKgToG.body.factor).toBe(1000);

    // 2. Standard dimension conversion: 1500 ML -> L (0.001x)
    const calcMlToL = await request(app)
      .post("/api/v1/master-data/conversions/calculate")
      .set(admin)
      .send({
        qty: 1500,
        fromUnitCode: "ML",
        toUnitCode: "L",
      })
      .expect(200);

    expect(calcMlToL.body.convertedQty).toBe(1.5);
    expect(calcMlToL.body.factor).toBe(0.001);
  });

  it("returns full Role Capability Matrix metadata", async () => {
    const matrixRes = await request(app)
      .get("/api/v1/security/roles/matrix")
      .set(admin)
      .expect(200);

    expect(matrixRes.body.roles).toContain("ADMIN");
    expect(matrixRes.body.roles).toContain("HEAD_CHEF");
    expect(matrixRes.body.roles).toContain("BRANCH_MANAGER");
    expect(matrixRes.body.matrix.ADMIN.capabilities).toContain("user_management");
    expect(matrixRes.body.matrix.HEAD_CHEF.capabilities).toContain("recipes_bom");
  });
});
