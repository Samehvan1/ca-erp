import crypto from "crypto";
import { prisma } from "./prisma.js";
import { AuditAction } from "@prisma/client";

/**
 * Canonical JSON serialization: keys sorted recursively.
 * Postgres stores Json as jsonb which normalizes key order, so hashing must
 * be independent of storage normalization (SQLite preserved raw text, jsonb does not).
 */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Immutable audit trail with hash chaining.
 * Each entry's hash = sha256(prevHash + action + entityType + entityId + JSON(before) + JSON(after) + ip + timestamp)
 * Tampering with any entry breaks the chain.
 *
 * Writes are serialized through a promise queue: the read of the last entry
 * and the insert must be atomic, otherwise two concurrent audit() calls can
 * read the same prevHash and produce a forked chain (false "tampering").
 */
let writeQueue: Promise<unknown> = Promise.resolve();

export function audit(opts: {
  userId?: number | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}): Promise<unknown> {
  const run = writeQueue.then(() => doAudit(opts));
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function doAudit(opts: {
  userId?: number | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}) {
  const last = await prisma.auditLog.findFirst({ orderBy: { id: "desc" } });
  const prevHash = last?.hash ?? null;
  const timestamp = new Date();
  const payload = [
    prevHash ?? "",
    opts.action,
    opts.entityType,
    opts.entityId ?? "",
    canonicalJson(opts.before ?? null),
    canonicalJson(opts.after ?? null),
    opts.ip ?? "",
    timestamp.toISOString(),
  ].join("|");
  const hash = crypto.createHash("sha256").update(payload).digest("hex");

  return prisma.auditLog.create({
    data: {
      userId: opts.userId ?? null,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      before: (opts.before as object) ?? undefined,
      after: (opts.after as object) ?? undefined,
      ip: opts.ip ?? null,
      hash,
      prevHash,
      timestamp,
    },
  });
}

/** Verify the integrity of the entire audit chain. Returns true if intact. */
export async function verifyAuditChain(): Promise<boolean> {
  const entries = await prisma.auditLog.findMany({ orderBy: { id: "asc" } });
  let prevHash: string | null = null;
  for (const e of entries) {
    const payload = [
      prevHash ?? "",
      e.action,
      e.entityType,
      e.entityId ?? "",
      canonicalJson(e.before ?? null),
      canonicalJson(e.after ?? null),
      e.ip ?? "",
      e.timestamp.toISOString(),
    ].join("|");
    const expected = crypto.createHash("sha256").update(payload).digest("hex");
    if (e.hash !== expected) return false;
    prevHash = e.hash;
  }
  return true;
}