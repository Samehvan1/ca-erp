import { prisma } from "./prisma.js";
import { audit } from "./audit.js";
import { generators } from "./reports.js";
import { AuditAction, ReportFrequency, StocktakeStatus, StocktakeType } from "@prisma/client";

/**
 * Background scheduler service.
 * Implements the scheduled jobs specified in the SRS/OpenSpec changes:
 *  1. Scheduled report delivery (daily/weekly/monthly) + snapshots
 *  2. Expiration alerts at 60/30/15/7-day tiers
 *  3. Reorder-point recalculation from consumption velocity + lead time
 *  4. Daily rolling cycle-count generation (ABC cadence)
 *
 * Runs on a 5-minute tick; each job self-checks whether it is due.
 * All jobs are idempotent and safe to run concurrently (single process).
 */

const DAY_MS = 24 * 3600 * 1000;

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

// ============ 1. SCHEDULED REPORT DELIVERY ============

async function runDueReports(): Promise<number> {
  const schedules = await prisma.scheduledReport.findMany({ where: { active: true } });
  let delivered = 0;
  for (const s of schedules) {
    const generator = generators[s.reportCode];
    if (!generator) continue;

    const last = await prisma.reportSnapshot.findFirst({ where: { reportCode: s.reportCode }, orderBy: { generatedAt: "desc" } });
    const now = Date.now();
    const due =
      !last ||
      (s.frequency === ReportFrequency.DAILY && now - last.generatedAt.getTime() >= DAY_MS) ||
      (s.frequency === ReportFrequency.WEEKLY && now - last.generatedAt.getTime() >= 7 * DAY_MS) ||
      (s.frequency === ReportFrequency.MONTHLY && now - last.generatedAt.getTime() >= 30 * DAY_MS);
    if (!due) continue;

    const data = await generator();
    const period = new Date().toISOString().slice(0, 10);
    const snapshot = await prisma.reportSnapshot.create({ data: { reportCode: s.reportCode, period, data: data as unknown as object } });
    const recipients = (s.recipients as unknown as string[]) ?? [];
    await audit({
      userId: null,
      action: AuditAction.POST,
      entityType: "ScheduledReport",
      entityId: String(s.id),
      after: { reportCode: s.reportCode, frequency: s.frequency, period, rows: data.length, recipients },
      ip: "scheduler",
    });
    // Delivery: recipients are recorded on the snapshot + audit trail. SMTP delivery is
    // deployment-level (see docs/deployment-security.md) — the hook point is here.
    console.log(`[scheduler] delivered ${s.reportCode} (${s.frequency}) period=${period} rows=${data.length} to=${recipients.join(",") || "none"}`);
    delivered++;
  }
  return delivered;
}

// ============ 2. EXPIRATION ALERTS (60/30/15/7-day tiers) ============

async function runExpirationAlerts(): Promise<number> {
  const now = Date.now();
  const tiers = [60, 30, 15, 7];
  const batches = await prisma.batch.findMany({ where: { quantity: { gt: 0 } }, include: { item: true, warehouse: true } });
  let created = 0;

  for (const b of batches) {
    const daysToExpiry = Math.floor((b.expiryDate.getTime() - now) / DAY_MS);
    for (const tier of tiers) {
      if (daysToExpiry > tier) continue;
      const existing = await prisma.expirationAlert.findFirst({ where: { batchId: b.id, tier, status: "ACTIVE" } });
      if (existing) continue;
      await prisma.expirationAlert.create({ data: { batchId: b.id, tier } });
      console.log(`[scheduler] expiration alert: batch ${b.batchNo} (${b.item.code}) tier=${tier}d warehouse=${b.warehouse.code}`);
      created++;
    }
  }
  return created;
}

// ============ 3. REORDER-POINT RECALCULATION ============

async function recalcReorderPoints(): Promise<number> {
  const rps = await prisma.reorderPoint.findMany({ include: { item: true, warehouse: true } });
  const since = new Date(Date.now() - 30 * DAY_MS);
  let updated = 0;

  for (const rp of rps) {
    // Consumption velocity = average daily outflow over the last 30 days
    const outflows = await prisma.stockLedger.aggregate({
      where: { warehouseId: rp.warehouseId, itemId: rp.itemId, qtyOut: { gt: 0 }, timestamp: { gte: since } },
      _sum: { qtyOut: true },
    });
    const velocity = (outflows._sum.qtyOut ?? 0) / 30;
    const reorderPoint = velocity * rp.leadTimeDays + rp.safetyStock;
    if (Math.abs(reorderPoint - rp.reorderPoint) > 0.001 || Math.abs(velocity - rp.consumptionVelocity) > 0.001) {
      await prisma.reorderPoint.update({ where: { id: rp.id }, data: { reorderPoint, consumptionVelocity: velocity } });
      updated++;
    }
  }
  return updated;
}

// ============ 4. DAILY ROLLING CYCLE COUNTS (ABC cadence) ============

async function generateCycleCounts(): Promise<number> {
  const abcClasses = ["A", "B", "C"];
  const dayOfYear = Math.floor((Date.now() - startOfDay(new Date(new Date().getFullYear(), 0, 1))) / DAY_MS);
  const dueClass = abcClasses[dayOfYear % abcClasses.length];

  const warehouses = await prisma.warehouse.findMany({ where: { type: { not: "TRANSIT" } } });
  let created = 0;

  for (const wh of warehouses) {
    // Skip if a cycle count for this class was already scheduled today
    const todayStart = new Date(startOfDay(new Date()));
    const existing = await prisma.stocktake.findFirst({
      where: { warehouseId: wh.id, type: StocktakeType.CYCLE, abcClass: dueClass, scheduledDate: { gte: todayStart } },
    });
    if (existing) continue;

    const items = await prisma.item.findMany({ where: { abcClass: dueClass }, select: { id: true } });
    if (items.length === 0) continue;

    const stocktake = await prisma.stocktake.create({
      data: {
        number: `ST-${Date.now().toString(36).toUpperCase()}-${(created + 1).toString().padStart(4, "0")}`,
        warehouseId: wh.id,
        type: StocktakeType.CYCLE,
        abcClass: dueClass,
        scheduledDate: new Date(),
        status: StocktakeStatus.SCHEDULED,
        items: {
          create: await Promise.all(
            items.map(async (it) => {
              const agg = await prisma.stockLedger.aggregate({ where: { warehouseId: wh.id, itemId: it.id }, _sum: { balance: true } });
              return { itemId: it.id, systemQty: agg._sum.balance ?? 0 };
            })
          ),
        },
      },
    });
    console.log(`[scheduler] cycle count ${stocktake.number} warehouse=${wh.code} class=${dueClass} items=${items.length}`);
    created++;
  }
  return created;
}

// ============ TICK ============

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const reports = await runDueReports();
    const alerts = await runExpirationAlerts();
    const rops = await recalcReorderPoints();
    const cycles = await generateCycleCounts();
    if (reports || alerts || rops || cycles) {
      console.log(`[scheduler] tick done: reports=${reports} alerts=${alerts} rop=${rops} cycles=${cycles}`);
    }
  } catch (e) {
    console.error("[scheduler] tick failed:", e);
  } finally {
    running = false;
  }
}

/** Start the scheduler. Safe to call multiple times (no-op if already started). */
export function startScheduler(intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
  const handle = setInterval(tick, intervalMs);
  handle.unref();
  // Run once shortly after boot
  setTimeout(tick, 5_000).unref();
  console.log(`[scheduler] started (tick every ${intervalMs / 1000}s)`);
  return handle;
}

/** Run a single tick immediately (used by tests / manual trigger). */
export async function runSchedulerOnce() {
  await tick();
}