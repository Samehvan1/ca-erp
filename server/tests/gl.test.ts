import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { postGl, ensureAccount } from "../src/lib/gl.js";

/**
 * GL posting tests: balanced double-entry and idempotent replay.
 */
describe("GL posting", () => {
  let inventory: { id: number };
  let grni: { id: number };

  beforeAll(async () => {
    inventory = await ensureAccount("1200", "Inventory", "ASSET");
    grni = await ensureAccount("2100", "GRNI", "LIABILITY");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("posts a balanced journal with unique per-line posting keys", async () => {
    const entries = await postGl("TEST-GRN-1", "GRN", "1", [
      { accountId: inventory.id, debit: 500 },
      { accountId: grni.id, credit: 500 },
    ]);
    expect(entries).toHaveLength(2);
    const keys = entries!.map((e) => e.postingKey);
    expect(new Set(keys).size).toBe(2);
  });

  it("rejects an unbalanced journal", async () => {
    await expect(
      postGl("TEST-UNBAL-1", "GRN", "2", [
        { accountId: inventory.id, debit: 500 },
        { accountId: grni.id, credit: 400 },
      ])
    ).rejects.toThrow(/Unbalanced posting/);
  });

  it("replaying the same posting key is a no-op (idempotent)", async () => {
    const first = await postGl("TEST-REPLAY-1", "GRN", "3", [
      { accountId: inventory.id, debit: 250 },
      { accountId: grni.id, credit: 250 },
    ]);
    expect(first).toHaveLength(2);

    const replay = await postGl("TEST-REPLAY-1", "GRN", "3", [
      { accountId: inventory.id, debit: 250 },
      { accountId: grni.id, credit: 250 },
    ]);
    expect(replay).toBeNull();

    const count = await prisma.glEntry.count({ where: { postingKey: { startsWith: "TEST-REPLAY-1:" } } });
    expect(count).toBe(2);
  });
});