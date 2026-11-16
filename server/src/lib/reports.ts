import { prisma } from "./prisma.js";
import { recalcWac } from "./stock.js";
import { Role } from "@prisma/client";

/**
 * Shared report generators + metadata.
 * Used by the analytics routes (on-demand) and the scheduler (scheduled delivery).
 */

export const REPORT_CODES = [
  "BOARD-EXECUTIVE-KPI",
  "PROJECT-PNL-COGS",
  "ABC-INVENTORY-MATRIX",
  "TRANSFER-LOGISTICS-SLA",
  "WASTE-SHRINKAGE-BOARD",
  "STOCK-VALUATION",
  "VARIANCE",
  "PO-OPEN-BALANCE",
  "SUPPLIER-AP",
  "STOCK-AGING",
  "VENDOR-SLA",
  "MENU-MARGIN",
] as const;

/** Role-based report access: financial/board/procurement reports are restricted. */
export const REPORT_ACCESS: Record<string, Role[]> = {
  "BOARD-EXECUTIVE-KPI": [Role.ADMIN, Role.CFO, Role.GROUP_EXECUTIVE, Role.COST_CONTROLLER],
  "PROJECT-PNL-COGS": [Role.ADMIN, Role.CFO, Role.GROUP_EXECUTIVE, Role.COST_CONTROLLER],
  "SUPPLIER-AP": [Role.ADMIN, Role.CFO, Role.GROUP_EXECUTIVE, Role.COST_CONTROLLER],
  "VENDOR-SLA": [Role.ADMIN, Role.CFO, Role.GROUP_EXECUTIVE, Role.COST_CONTROLLER, Role.PROCUREMENT_OFFICER],
  "PO-OPEN-BALANCE": [Role.ADMIN, Role.CFO, Role.GROUP_EXECUTIVE, Role.COST_CONTROLLER, Role.PROCUREMENT_OFFICER],
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Arabic labels for bilingual rendering (RTL). */
const AR_LABELS: Record<string, string> = {
  itemCode: "كود الصنف",
  item: "الصنف",
  qty: "الكمية",
  wac: "متوسط التكلفة",
  value: "القيمة",
  valuationMethod: "طريقة التقييم",
  period: "الفترة",
  warehouse: "المخزن",
  theoreticalQty: "الكمية النظرية",
  actualQty: "الكمية الفعلية",
  varianceQty: "فرق الكمية",
  variancePct: "نسبة الفرق",
  poNumber: "رقم أمر الشراء",
  vendor: "المورد",
  project: "المشروع",
  projectCode: "كود المشروع",
  status: "الحالة",
  orderedQty: "الكمية المطلوبة",
  receivedQty: "الكمية المستلمة",
  outstandingQty: "الكمية المتبقية",
  totalValue: "القيمة الإجمالية",
  balance: "الرصيد",
  entries: "القيود",
  batchNo: "رقم الدفعة",
  expiryDate: "تاريخ الانتهاء",
  daysToExpiry: "أيام حتى الانتهاء",
  risk: "المخاطر",
  slaCount: "عدد تقييمات الأداء",
  otifRate: "نسبة التسليم الكامل في الوقت",
  priceVarianceRate: "نسبة انحراف السعر",
  qcRejectionRate: "نسبة رفض الجودة",
  docAccuracyRate: "دقة المستندات",
  poCount: "عدد أوامر الشراء",
  recipe: "الوصفة",
  type: "النوع",
  cost: "التكلفة",
  stockValue: "قيمة المخزون",
  openPoValue: "قيمة أوامر الشراء المفتوحة",
  totalSpend: "إجمالي المشتريات",
  wasteLossValue: "قيمة الهدر والتسويات",
  pendingApprovals: "اعتمادات معلقة",
  lowStockAlerts: "تنبيهات انخفاض المخزون",
  expiringBatches: "تشغيلات قريبة الانتهاء",
  inTransitTransfers: "تحويلات قيد النقل",
  cogsDebit: "تكلفة البضاعة المباعة (COGS)",
  wasteDebit: "مصروف الهدر والتوالف",
  freightDebit: "تكاليف الشحن والجمارك",
  inventoryAsset: "أصول المخزون",
  apExposure: "التزامات الموردين",
  spendSharePct: "نسبة الإنفاق %",
  abcClass: "التصنيف (ABC)",
  itemCount: "عدد الأصناف",
  totalQty: "إجمالي الكمية",
  capitalSharePct: "نسبة رأس المال المحجوز %",
  avgUnitCost: "متوسط تكلفة الوحدة",
  transferCount: "عدد التحويلات",
  totalUnitsMoved: "إجمالي الوحدات المنقولة",
  discrepancyUnits: "فروقات الاستلام",
  discrepancyPct: "نسبة الفروقات %",
  staleOver3Days: "متأخر > 3 أيام",
  source: "المصدر",
  category: "الفئة / السبب",
  eventCount: "عدد الحالات",
  totalUnitsLost: "إجمالي الوحدات المفقودة",
  financialImpact: "الأثر المالي (ج.م)",
};

export function localize(rows: unknown[], lang: string) {
  if (lang !== "AR") return rows;
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      out[AR_LABELS[k] ?? k] = v;
    }
    return out;
  });
}

// ─── HIGH-BOARD EXECUTIVE REPORTS ──────────────────────────────────────────

async function boardExecutiveKpi() {
  const [projects, warehouses, ledgers, pos, wasteLogs, adjustments, rops, batches, transfers, pendingApprovals] =
    await Promise.all([
      prisma.project.findMany({ orderBy: { id: "asc" } }),
      prisma.warehouse.findMany(),
      prisma.stockLedger.findMany({ where: { balance: { gt: 0 } } }),
      prisma.purchaseOrder.findMany(),
      prisma.wasteLog.findMany({ include: { warehouse: true } }),
      prisma.adjustment.findMany({ include: { warehouse: true } }),
      prisma.reorderPoint.findMany(),
      prisma.batch.findMany({ where: { quantity: { gt: 0 } }, include: { warehouse: true } }),
      prisma.transferOrder.findMany({ include: { requisition: true } }),
      prisma.requisition.groupBy({ by: ["projectId"], where: { status: "PENDING_APPROVAL" }, _count: { id: true } }),
    ]);

  const whProjectMap = new Map<number, number | null>(warehouses.map((w) => [w.id, w.projectId]));
  const stockByWh = new Map<string, number>();
  for (const l of ledgers) {
    const key = `${l.warehouseId}:${l.itemId}`;
    stockByWh.set(key, (stockByWh.get(key) ?? 0) + l.balance);
  }

  const now = Date.now();
  const in30Days = now + 30 * 24 * 3600 * 1000;

  return projects.map((proj) => {
    const projWhIds = new Set(warehouses.filter((w) => w.projectId === proj.id).map((w) => w.id));
    const stockValue = ledgers
      .filter((l) => projWhIds.has(l.warehouseId))
      .reduce((s, l) => s + l.balance * l.unitCost, 0);

    const projPos = pos.filter((p) => p.projectId === proj.id);
    const openPoValue = projPos
      .filter((p) => p.status === "OPEN" || p.status === "PARTIALLY_RECEIVED")
      .reduce((s, p) => s + p.totalValue, 0);
    const totalSpend = projPos
      .filter((p) => p.status !== "FORCE_CLOSED")
      .reduce((s, p) => s + p.totalValue, 0);

    const adjLoss = adjustments
      .filter((a) => projWhIds.has(a.warehouseId) && a.status === "APPROVED")
      .reduce((s, a) => s + Math.abs(a.amount), 0);
    const wasteCount = wasteLogs.filter((w) => projWhIds.has(w.warehouseId) && w.status === "APPROVED").length;

    const lowStockAlerts = rops.filter(
      (r) => projWhIds.has(r.warehouseId) && (stockByWh.get(`${r.warehouseId}:${r.itemId}`) ?? 0) <= r.reorderPoint
    ).length;

    const expiringBatches = batches.filter(
      (b) => projWhIds.has(b.warehouseId) && b.expiryDate.getTime() <= in30Days
    ).length;

    const inTransitTransfers = transfers.filter(
      (t) =>
        (t.status === "IN_TRANSIT" || t.status === "DISPATCHED") &&
        (whProjectMap.get(t.requisition.fromWarehouseId) === proj.id ||
          whProjectMap.get(t.requisition.toWarehouseId) === proj.id)
    ).length;

    const pendingReqCount = pendingApprovals.find((p) => p.projectId === proj.id)?._count.id ?? 0;

    return {
      projectCode: proj.code,
      project: proj.name,
      stockValue: round2(stockValue),
      poCount: projPos.length,
      openPoValue: round2(openPoValue),
      totalSpend: round2(totalSpend),
      wasteLossValue: round2(adjLoss + wasteCount * 150),
      pendingApprovals: pendingReqCount,
      lowStockAlerts,
      expiringBatches,
      inTransitTransfers,
    };
  });
}

async function projectPnlCogs() {
  const [projects, costCenters, glEntries, pos] = await Promise.all([
    prisma.project.findMany({ orderBy: { id: "asc" } }),
    prisma.costCenter.findMany(),
    prisma.glEntry.findMany({ include: { account: true } }),
    prisma.purchaseOrder.findMany(),
  ]);

  const grandSpend = pos.reduce((s, p) => s + p.totalValue, 0) || 1;

  return projects.map((proj) => {
    const ccIds = new Set(costCenters.filter((c) => c.projectId === proj.id).map((c) => c.id));
    const entries = glEntries.filter((e) => e.costCenterId != null && ccIds.has(e.costCenterId));

    const sumAcct = (code: string) =>
      entries.filter((e) => e.account.code === code).reduce((s, e) => s + (e.debit - e.credit), 0);

    const inventoryAsset = sumAcct("1000");
    const cogsDebit = sumAcct("5000");
    const wasteDebit = sumAcct("5100");
    const freightDebit = sumAcct("5200");
    const apExposure = Math.abs(sumAcct("3000"));
    const totalSpend = pos.filter((p) => p.projectId === proj.id).reduce((s, p) => s + p.totalValue, 0);

    return {
      projectCode: proj.code,
      project: proj.name,
      inventoryAsset: round2(inventoryAsset),
      cogsDebit: round2(cogsDebit),
      wasteDebit: round2(wasteDebit),
      freightDebit: round2(freightDebit),
      apExposure: round2(apExposure),
      totalSpend: round2(totalSpend),
      spendSharePct: round2((totalSpend / grandSpend) * 100),
    };
  });
}

async function abcInventoryMatrix() {
  const items = await prisma.item.findMany({
    include: { stockLedgers: { where: { balance: { gt: 0 } } } },
  });

  const groups = new Map<string, { itemCount: number; totalQty: number; totalValue: number }>();
  let grandTotalValue = 0;

  for (const item of items) {
    const cls = (item.abcClass || "C").toUpperCase();
    const qty = item.stockLedgers.reduce((s, l) => s + l.balance, 0);
    const val = item.stockLedgers.reduce((s, l) => s + l.balance * l.unitCost, 0);
    grandTotalValue += val;
    const prev = groups.get(cls) ?? { itemCount: 0, totalQty: 0, totalValue: 0 };
    prev.itemCount += 1;
    prev.totalQty += qty;
    prev.totalValue += val;
    groups.set(cls, prev);
  }

  const denom = grandTotalValue || 1;
  return ["A", "B", "C"].map((cls) => {
    const g = groups.get(cls) ?? { itemCount: 0, totalQty: 0, totalValue: 0 };
    return {
      abcClass: cls,
      itemCount: g.itemCount,
      totalQty: round2(g.totalQty),
      totalValue: round2(g.totalValue),
      capitalSharePct: round2((g.totalValue / denom) * 100),
      avgUnitCost: g.totalQty > 0 ? round2(g.totalValue / g.totalQty) : 0,
    };
  });
}

async function transferLogisticsSla() {
  const orders = await prisma.transferOrder.findMany({
    include: { items: true },
  });

  const now = Date.now();
  const threeDaysMs = 3 * 24 * 3600 * 1000;
  const byStatus = new Map<
    string,
    { transferCount: number; totalUnitsMoved: number; discrepancyUnits: number; staleOver3Days: number }
  >();

  for (const ord of orders) {
    const cur = byStatus.get(ord.status) ?? {
      transferCount: 0,
      totalUnitsMoved: 0,
      discrepancyUnits: 0,
      staleOver3Days: 0,
    };
    cur.transferCount += 1;
    for (const it of ord.items) {
      cur.totalUnitsMoved += it.quantity;
      cur.discrepancyUnits += Math.abs(it.discrepancyQty);
    }
    if (
      (ord.status === "IN_TRANSIT" || ord.status === "DISPATCHED") &&
      ord.dispatchedAt &&
      now - ord.dispatchedAt.getTime() > threeDaysMs
    ) {
      cur.staleOver3Days += 1;
    }
    byStatus.set(ord.status, cur);
  }

  return Array.from(byStatus.entries()).map(([status, stats]) => ({
    status,
    transferCount: stats.transferCount,
    totalUnitsMoved: round2(stats.totalUnitsMoved),
    discrepancyUnits: round2(stats.discrepancyUnits),
    discrepancyPct: stats.totalUnitsMoved > 0 ? round2((stats.discrepancyUnits / stats.totalUnitsMoved) * 100) : 0,
    staleOver3Days: stats.staleOver3Days,
  }));
}

async function wasteShrinkageBoard() {
  const [wasteLogs, adjustments] = await Promise.all([
    prisma.wasteLog.findMany({ include: { item: true } }),
    prisma.adjustment.findMany(),
  ]);

  const rows: {
    source: string;
    category: string;
    status: string;
    eventCount: number;
    totalUnitsLost: number;
    financialImpact: number;
  }[] = [];

  const wasteGroups = new Map<string, { eventCount: number; totalUnitsLost: number }>();
  for (const w of wasteLogs) {
    const key = `${w.reason}::${w.status}`;
    const cur = wasteGroups.get(key) ?? { eventCount: 0, totalUnitsLost: 0 };
    cur.eventCount += 1;
    cur.totalUnitsLost += Math.abs(w.quantity);
    wasteGroups.set(key, cur);
  }
  for (const [key, val] of wasteGroups.entries()) {
    const [category, status] = key.split("::");
    rows.push({
      source: "WASTE_LOG",
      category,
      status,
      eventCount: val.eventCount,
      totalUnitsLost: round2(val.totalUnitsLost),
      financialImpact: round2(val.totalUnitsLost * 48),
    });
  }

  const adjGroups = new Map<string, { eventCount: number; totalUnitsLost: number; financialImpact: number }>();
  for (const a of adjustments) {
    const key = `${a.reason}::${a.status}`;
    const cur = adjGroups.get(key) ?? { eventCount: 0, totalUnitsLost: 0, financialImpact: 0 };
    cur.eventCount += 1;
    cur.totalUnitsLost += Math.abs(a.quantity);
    cur.financialImpact += Math.abs(a.amount);
    adjGroups.set(key, cur);
  }
  for (const [key, val] of adjGroups.entries()) {
    const [category, status] = key.split("::");
    rows.push({
      source: "STOCK_ADJUSTMENT",
      category,
      status,
      eventCount: val.eventCount,
      totalUnitsLost: round2(val.totalUnitsLost),
      financialImpact: round2(val.financialImpact),
    });
  }

  return rows.sort((a, b) => b.financialImpact - a.financialImpact);
}

// ─── CORE OPERATIONAL REPORTS ──────────────────────────────────────────────

async function stockValuation() {
  const items = await prisma.item.findMany({
    include: { stockLedgers: { where: { balance: { gt: 0 } } }, batches: { where: { quantity: { gt: 0 } } } },
  });
  return items.map((i) => {
    const qty = i.stockLedgers.reduce((s, l) => s + l.balance, 0);
    const wac = qty > 0 ? i.stockLedgers.reduce((s, l) => s + l.balance * l.unitCost, 0) / qty : 0;
    return {
      itemCode: i.code,
      item: i.description,
      qty: round2(qty),
      wac: round2(wac),
      value: round2(qty * wac),
      valuationMethod: i.valuationMethod,
    };
  });
}

async function varianceReport() {
  const variances = await prisma.varianceRecord.findMany({
    include: { item: true, warehouse: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return variances.map((v) => ({
    period: v.period,
    item: v.item.description,
    warehouse: v.warehouse.code,
    theoreticalQty: round2(v.theoreticalQty),
    actualQty: round2(v.actualQty),
    varianceQty: round2(v.varianceQty),
    variancePct: round2(v.variancePct),
  }));
}

async function poOpenBalance() {
  const pos = await prisma.purchaseOrder.findMany({
    where: { status: { in: ["OPEN", "PARTIALLY_RECEIVED"] } },
    include: { vendor: true, project: true, items: true },
  });
  return pos.map((p) => ({
    poNumber: p.number,
    vendor: p.vendor.name,
    project: p.project.name,
    status: p.status,
    orderedQty: round2(p.orderedQty),
    receivedQty: round2(p.receivedQty),
    outstandingQty: round2(p.outstandingQty),
    totalValue: round2(p.totalValue),
  }));
}

async function supplierAp() {
  const vendors = await prisma.vendor.findMany({ include: { apLedger: true } });
  return vendors.map((v) => {
    const last = v.apLedger[v.apLedger.length - 1];
    return { vendor: v.name, balance: round2(last?.balance ?? 0), entries: v.apLedger.length };
  });
}

async function stockAging() {
  const batches = await prisma.batch.findMany({
    where: { quantity: { gt: 0 } },
    include: { item: true, warehouse: true },
    orderBy: { expiryDate: "asc" },
  });
  const now = Date.now();
  return batches.map((b) => {
    const daysToExpiry = Math.floor((b.expiryDate.getTime() - now) / (24 * 3600 * 1000));
    const risk = daysToExpiry < 0 ? "EXPIRED" : daysToExpiry <= 7 ? "CRITICAL" : daysToExpiry <= 30 ? "WARNING" : "OK";
    return {
      batchNo: b.batchNo,
      item: b.item.description,
      warehouse: b.warehouse.code,
      qty: round2(b.quantity),
      expiryDate: b.expiryDate.toISOString().slice(0, 10),
      daysToExpiry,
      risk,
    };
  });
}

async function vendorSla() {
  const vendors = await prisma.vendor.findMany({ include: { slas: true, purchaseOrders: true } });
  return vendors.map((v) => {
    const latest = v.slas[v.slas.length - 1];
    return {
      vendor: v.name,
      slaCount: v.slas.length,
      otifRate: round2(latest?.otifRate ?? 0),
      priceVarianceRate: round2(latest?.priceVarianceRate ?? 0),
      qcRejectionRate: round2(latest?.qcRejectionRate ?? 0),
      docAccuracyRate: round2(latest?.docAccuracyRate ?? 0),
      poCount: v.purchaseOrders.length,
    };
  });
}

async function menuMargin() {
  const recipes = await prisma.recipe.findMany({ include: { items: true, project: true } });
  const rows = [];
  for (const r of recipes) {
    let cost = 0;
    for (const ri of r.items) {
      const wac = await recalcWac(ri.itemId);
      cost += (ri.quantity / (ri.yieldFactor || 1)) * wac * (1 + (ri.shrinkagePct || 0) / 100);
    }
    rows.push({ recipe: r.name, project: r.project.name, type: r.type, cost: round2(cost) });
  }
  return rows;
}

export const generators: Record<string, () => Promise<unknown[]>> = {
  "BOARD-EXECUTIVE-KPI": boardExecutiveKpi,
  "PROJECT-PNL-COGS": projectPnlCogs,
  "ABC-INVENTORY-MATRIX": abcInventoryMatrix,
  "TRANSFER-LOGISTICS-SLA": transferLogisticsSla,
  "WASTE-SHRINKAGE-BOARD": wasteShrinkageBoard,
  "STOCK-VALUATION": stockValuation,
  VARIANCE: varianceReport,
  "PO-OPEN-BALANCE": poOpenBalance,
  "SUPPLIER-AP": supplierAp,
  "STOCK-AGING": stockAging,
  "VENDOR-SLA": vendorSla,
  "MENU-MARGIN": menuMargin,
};
