import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { audit, verifyAuditChain } from "../src/lib/audit.js";
import { AuditAction } from "@prisma/client";

/**
 * Immutable audit trail tests: hash chaining and tamper detection.
 */
describe("audit chain", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a chained entry and verifies the chain is intact", async () => {
    await audit({ userId: 1, action: AuditAction.CREATE, entityType: "Test", entityId: "1", after: { hello: "world" }, ip: "127.0.0.1" });
    await audit({ userId: 1, action: AuditAction.UPDATE, entityType: "Test", entityId: "2", after: { n: 2 }, ip: "127.0.0.1" });
    expect(await verifyAuditChain()).toBe(true);
  });

  it("detects tampering with a historical entry", async () => {
    await audit({ userId: 1, action: AuditAction.CREATE, entityType: "TamperTarget", entityId: "99", after: { amount: 100 }, ip: "127.0.0.1" });
    const target = await prisma.auditLog.findFirst({ where: { entityType: "TamperTarget" }, orderBy: { id: "desc" } });
    expect(target).not.toBeNull();

    // Tamper: change the recorded amount without recomputing the hash
    await prisma.auditLog.update({
      where: { id: target!.id },
      data: { after: { amount: 999999 } },
    });
    expect(await verifyAuditChain()).toBe(false);
  });
});