import { prisma } from "./prisma.js";
import { recalcWac } from "./stock.js";
import { Role } from "@prisma/client";

/**
 * Shared report generators + metadata.
 * Used by the analytics routes (on-demand) and the scheduler (scheduled delivery).
 */

export const REPORT_CODES = ["STOCK-VALUATION", "VARIANCE", "PO-OPEN-BALANCE", "SUPPLIER-AP", "STOCK-AGING", "VENDOR-SLA", "MENU-MARGIN"] as const;

/** Role-based report access: financial/procurement reports are restricted. */
export const REPORT_ACCESS: Record<string, Role[]> = {
  "SUPPLIER-AP": [Role.ADMIN, Role.CFO, Role.COST_CONTROLLER],
  "VENDOR-SLA": [Role.ADMIN, Role.CFO, Role.COST_CONTROLLER, Role.PROCUREMENT_OFFICER],
  "PO-OPEN-BALANCE": [Role.ADMIN, Role.CFO, Role.COST_CONTROLLER, Role.PROCUREMENT_OFFICER],
};

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

async function stockValuation() {
  const items = await prisma.item.findMany({ include: { stockLedgers: { where: { balance: { gt: 0 } } }, batches: { where: { quantity: { gt: 0 } } } } });
  return items.map((i) => {
    const qty = i.stockLedgers.reduce((s, l) => s + l.balance, 0);
    const wac = qty > 0 ? i.stockLedgers.reduce((s, l) => s + l.balance * l.unitCost, 0) / qty : 0;
    return { itemCode: i.code, item: i.description, qty, wac, value: qty * wac, valuationMethod: i.valuationMethod };
  });
}

async function varianceReport() {
  const variances = await prisma.varianceRecord.findMany({ include: { item: true, warehouse: true }, orderBy: { createdAt: "desc" }, take: 200 });
  return variances.map((v) => ({ period: v.period, item: v.item.description, warehouse: v.warehouse.code, theoreticalQty: v.theoreticalQty, actualQty: v.actualQty, varianceQty: v.varianceQty, variancePct: v.variancePct }));
}

async function poOpenBalance() {
  const pos = await prisma.purchaseOrder.findMany({ where: { status: { in: ["OPEN", "PARTIALLY_RECEIVED"] } }, include: { vendor: true, project: true, items: true } });
  return pos.map((p) => ({ poNumber: p.number, vendor: p.vendor.name, project: p.project.name, status: p.status, orderedQty: p.orderedQty, receivedQty: p.receivedQty, outstandingQty: p.outstandingQty, totalValue: p.totalValue }));
}

async function supplierAp() {
  const vendors = await prisma.vendor.findMany({ include: { apLedger: true } });
  return vendors.map((v) => {
    const last = v.apLedger[v.apLedger.length - 1];
    return { vendor: v.name, balance: last?.balance ?? 0, entries: v.apLedger.length };
  });
}

async function stockAging() {
  const batches = await prisma.batch.findMany({ where: { quantity: { gt: 0 } }, include: { item: true, warehouse: true }, orderBy: { expiryDate: "asc" } });
  const now = Date.now();
  return batches.map((b) => {
    const daysToExpiry = Math.floor((b.expiryDate.getTime() - now) / (24 * 3600 * 1000));
    const risk = daysToExpiry < 0 ? "EXPIRED" : daysToExpiry <= 7 ? "CRITICAL" : daysToExpiry <= 30 ? "WARNING" : "OK";
    return { batchNo: b.batchNo, item: b.item.description, warehouse: b.warehouse.code, qty: b.quantity, expiryDate: b.expiryDate, daysToExpiry, risk };
  });
}

async function vendorSla() {
  const vendors = await prisma.vendor.findMany({ include: { slas: true, purchaseOrders: true } });
  return vendors.map((v) => {
    const latest = v.slas[v.slas.length - 1];
    return {
      vendor: v.name,
      slaCount: v.slas.length,
      otifRate: latest?.otifRate ?? 0,
      priceVarianceRate: latest?.priceVarianceRate ?? 0,
      qcRejectionRate: latest?.qcRejectionRate ?? 0,
      docAccuracyRate: latest?.docAccuracyRate ?? 0,
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
    rows.push({ recipe: r.name, project: r.project.name, type: r.type, cost });
  }
  return rows;
}

export const generators: Record<string, () => Promise<unknown[]>> = {
  "STOCK-VALUATION": stockValuation,
  VARIANCE: varianceReport,
  "PO-OPEN-BALANCE": poOpenBalance,
  "SUPPLIER-AP": supplierAp,
  "STOCK-AGING": stockAging,
  "VENDOR-SLA": vendorSla,
  "MENU-MARGIN": menuMargin,
};