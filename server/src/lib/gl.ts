import { prisma } from "./prisma.js";
import { badRequest } from "./errors.js";

export interface GlLine {
  accountId: number;
  costCenterId?: number | null;
  debit?: number;
  credit?: number;
}

/**
 * Post a balanced double-entry GL journal with an idempotent posting key.
 * Replaying the same key is a no-op (returns null) instead of double-posting.
 */
export async function postGl(postingKey: string, refType: string, refId: string | null, lines: GlLine[]) {
  const existing = await prisma.glEntry.findFirst({ where: { postingKey: { startsWith: `${postingKey}:` } } });
  if (existing) return null;

  const totalDebit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) throw badRequest(`Unbalanced posting: debit ${totalDebit} != credit ${totalCredit}`);

  const entries = await prisma.$transaction(
    lines.map((l, i) =>
      prisma.glEntry.create({ data: { accountId: l.accountId, costCenterId: l.costCenterId ?? null, debit: l.debit ?? 0, credit: l.credit ?? 0, refType, refId: refId ?? null, postingKey: `${postingKey}:${i}` } })
    )
  );
  return entries;
}

/** Resolve a GL account by code, creating it if missing (idempotent bootstrap). */
export async function ensureAccount(code: string, name: string, type: "ASSET" | "LIABILITY" | "EXPENSE" | "REVENUE" | "EQUITY") {
  const existing = await prisma.glAccount.findUnique({ where: { code } });
  if (existing) return existing;
  return prisma.glAccount.create({ data: { code, name, type } });
}