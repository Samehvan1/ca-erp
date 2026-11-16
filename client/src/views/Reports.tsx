import { FormEvent, useState } from "react";
import { Badge, ConfirmDialog, Empty, ErrorBanner, ListToolbar, Loading, Modal, Toast, apiReq, useApi, useListFilter } from "../components";
import { getUser } from "../api";
import { useI18n } from "../lib/i18n";

interface ReportDef {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

interface ReportResult {
  code: string;
  lang: string;
  generatedAt: string;
  rows: Record<string, unknown>[];
}

interface ReportSnapshot {
  id: number;
  reportCode: string;
  period: string;
  data: Record<string, unknown>[];
  generatedAt: string;
}

interface ScheduledReport {
  id: number;
  reportCode: string;
  frequency: string;
  recipients: string[];
  active: boolean;
  createdAt: string;
}

const REPORT_META: Record<
  string,
  { nameEn: string; nameAr: string; descEn: string; descAr: string; category: "board" | "inventory" | "procurement"; isBoard?: boolean }
> = {
  "BOARD-EXECUTIVE-KPI": {
    nameEn: "Board Executive Scorecard",
    nameAr: "بطاقة الأداء التنفيذية لمجلس الإدارة",
    descEn: "Holding KPIs per project: stock value, open POs, spend, waste loss & alerts",
    descAr: "مؤشرات الأداء العليا لكل مشروع: قيمة المخزون، المشتريات، الهدر والتنبيهات",
    category: "board",
    isBoard: true,
  },
  "PROJECT-PNL-COGS": {
    nameEn: "Project P&L & COGS Control",
    nameAr: "ملخص التكاليف والأرباح (COGS) لكل مشروع",
    descEn: "Inventory asset, COGS, waste write-off, freight, AP exposure & spend share %",
    descAr: "أصول المخزون، تكلفة البضاعة، الهدر، الشحن، التزامات الموردين ونسبة الإنفاق",
    category: "board",
    isBoard: true,
  },
  "ABC-INVENTORY-MATRIX": {
    nameEn: "ABC Capital Lock-up Matrix",
    nameAr: "مصفوفة تصنيف المخزون ورأس المال (ABC)",
    descEn: "Capital distribution across Class A/B/C items with share % and avg unit cost",
    descAr: "توزيع رأس المال المحجوز عبر فئات الأصناف A و B و C ونسبة كل فئة",
    category: "board",
    isBoard: true,
  },
  "TRANSFER-LOGISTICS-SLA": {
    nameEn: "Transfer & Logistics SLA",
    nameAr: "كفاءة التحويلات واللوجستيات (SLA)",
    descEn: "Inter-branch transfer volume, discrepancy rates & stale in-transit alerts",
    descAr: "حجم التحويلات بين الفروع ونسب الفروقات والشحنات المتأخرة > 3 أيام",
    category: "board",
    isBoard: true,
  },
  "WASTE-SHRINKAGE-BOARD": {
    nameEn: "Waste & Shrinkage Impact",
    nameAr: "تحليل الهدر والتوالف وفروقات الجرد",
    descEn: "Financial impact of waste logs, damage, theft & audit count differences",
    descAr: "الأثر المالي لسجلات الهدر، التلف، العجز وفروقات الجرد المعتمدة",
    category: "board",
    isBoard: true,
  },
  "STOCK-VALUATION": { nameEn: "Stock Valuation", nameAr: "تقييم المخزون", descEn: "Item quantities at weighted-average cost", descAr: "كميات الأصناف بالتكلفة المتوسطة المرجحة", category: "inventory" },
  VARIANCE: { nameEn: "Variance Analysis", nameAr: "تحليل الفروقات والتباين", descEn: "Theoretical vs actual quantities per period", descAr: "الكميات النظرية مقابل الفعلية لكل فترة", category: "inventory" },
  "PO-OPEN-BALANCE": { nameEn: "Open PO Balance", nameAr: "أوامر الشراء المفتوحة", descEn: "Outstanding purchase commitments", descAr: "التزامات الشراء وأوامر التوريد الجارية", category: "procurement" },
  "SUPPLIER-AP": { nameEn: "Supplier AP", nameAr: "حسابات الموردين والدائنين", descEn: "Accounts payable balances per vendor", descAr: "أرصدة حسابات الموردين المستحقة", category: "procurement" },
  "STOCK-AGING": { nameEn: "Stock Aging", nameAr: "أعمار المخزون وتواريخ الصلاحية", descEn: "Batch expiry risk profile", descAr: "مخاطر انتهاء صلاحية التشغيلات وFEFO", category: "inventory" },
  "VENDOR-SLA": { nameEn: "Vendor SLA", nameAr: "مؤشرات أداء الموردين (SLA)", descEn: "OTIF, price variance, QC rejection", descAr: "نسب الالتزام بالمواعيد والجودة والأسعار", category: "procurement" },
  "MENU-MARGIN": { nameEn: "Menu Margin", nameAr: "هوامش تكاليف الوصفات والقوائم", descEn: "Recipe cost at current WAC", descAr: "تكلفة الوصفة المحدثة بمتوسط التكلفة WAC", category: "inventory" },
};

const FREQUENCIES = ["REAL_TIME", "DAILY", "WEEKLY", "MONTHLY"];

const COLUMN_TOOLTIPS: Record<string, { en: string; ar: string }> = {
  // Transfer & Logistics SLA
  status: { en: "Current lifecycle stage of the record (e.g., REQUESTED, IN_TRANSIT, RECEIVED, OPEN).", ar: "المرحلة الحالية للسجل في دورة العمل (مثل: مطلوب، في الطريق، مستلم، مفتوح)." },
  transferCount: { en: "Total number of transfer orders currently in this status.", ar: "إجمالي عدد أوامر التحويل الموجودة حالياً في هذه الحالة." },
  totalUnitsMoved: { en: "Sum of all item quantities requested/moved across these transfers.", ar: "مجموع كميات الأصناف المطلوبة أو المنقولة عبر هذه التحويلات." },
  discrepancyUnits: { en: "Total units lost, damaged, or short-received between dispatch and receipt.", ar: "إجمالي الوحدات المفقودة أو التالفة أو الناقصة بين الشحن والاستلام." },
  discrepancyPct: { en: "Percentage of moved units lost or mismatched: (Discrepancy Units / Total Units Moved) × 100.", ar: "نسبة الفروقات من إجمالي الوحدات المنقولة: (فروقات الاستلام ÷ إجمالي المنقول) × 100." },
  staleOver3Days: { en: "Count of in-transit or dispatched transfers delayed more than 3 days without receipt.", ar: "عدد التحويلات المشحونة أو قيد النقل المتأخرة لأكثر من 3 أيام دون استلام." },

  // Board Executive KPI & P&L
  projectCode: { en: "Short identifier code for the brand or holding entity.", ar: "الكود التعريفي المختصر للمشروع أو العلامة التجارية." },
  project: { en: "Brand, outlet group, or holding entity name.", ar: "اسم المشروع أو العلامة التجارية أو المجموعة." },
  stockValue: { en: "Total on-hand inventory valuation across the project's warehouses at current unit cost.", ar: "إجمالي قيمة المخزون المتاح حالياً في مستودعات المشروع بالتكلفة الحالية." },
  poCount: { en: "Total number of purchase orders issued for this project or vendor.", ar: "إجمالي عدد أوامر الشراء الصادرة لهذا المشروع أو المورد." },
  openPoValue: { en: "Total monetary value of purchase orders still OPEN or PARTIALLY_RECEIVED.", ar: "إجمالي قيمة أوامر الشراء المفتوحة أو المستلمة جزئياً بانتظار التوريد." },
  totalSpend: { en: "Cumulative procurement spend across non-closed purchase orders.", ar: "إجمالي الإنفاق والمشتريات عبر أوامر الشراء." },
  wasteLossValue: { en: "Estimated financial loss from approved waste logs and stock adjustments.", ar: "القيمة المالية المقدرة للخسائر من سجلات الهدر والتسويات المعتمدة." },
  pendingApprovals: { en: "Number of purchase requisitions awaiting management/CFO approval.", ar: "عدد طلبات الشراء المعلقة بانتظار اعتماد الإدارة أو المدير المالي." },
  lowStockAlerts: { en: "Count of item-warehouse pairs at or below their Reorder Point (ROP).", ar: "عدد الأصناف التي وصلت إلى حد إعادة الطلب أو أقل منه." },
  expiringBatches: { en: "Active stock batches expiring within the next 30 days (including already expired).", ar: "عدد التشغيلات النشطة التي تنتهي صلاحيتها خلال 30 يوماً أو انتهت بالفعل." },
  inTransitTransfers: { en: "Transfers currently dispatched or in transit involving this project.", ar: "التحويلات المشحونة أو الجارية في الطريق المرتبطة بهذا المشروع." },
  inventoryAsset: { en: "Net General Ledger balance of Inventory Asset account (1000).", ar: "صافي رصيد حساب أصول المخزون (1000) في دفتر الأستاذ العام." },
  cogsDebit: { en: "Cost of Goods Sold debits (account 5000) posted to this project's cost centers.", ar: "مدين تكلفة البضاعة المباعة (حساب 5000) المرحّل لمراكز تكلفة المشروع." },
  wasteDebit: { en: "Waste write-off expenses (account 5100) recorded against this project.", ar: "مصروفات إعدام الهدر والتوالف (حساب 5100) المسجلة على المشروع." },
  freightDebit: { en: "Freight, customs, and clearance charges (account 5200) allocated to the project.", ar: "مصروفات الشحن والجمارك والتخليص (حساب 5200) المخصصة للمشروع." },
  apExposure: { en: "Outstanding Accounts Payable liability (account 3000) owed to suppliers.", ar: "إجمالي التزامات الموردين المستحقة (حساب 3000)." },
  spendSharePct: { en: "Project's percentage share of total holding procurement spend.", ar: "نسبة إنفاق المشروع من إجمالي إنفاق المجموعة القابضة." },

  // ABC Matrix
  abcClass: { en: "ABC inventory tier: A = high-value critical items, B = moderate value, C = low-value bulk.", ar: "تصنيف ABC: فئة A عالية القيمة والأهمية، B متوسطة، C منخفضة القيمة." },
  itemCount: { en: "Number of distinct master items belonging to this ABC class.", ar: "عدد الأصناف الفريدة المصنفة ضمن هذه الفئة." },
  totalQty: { en: "Total physical units on hand across all items in this class.", ar: "إجمالي الكميات الفعلية المتوفرة لجميع أصناف هذه الفئة." },
  capitalSharePct: { en: "Percentage of total holding inventory capital tied up in this ABC class.", ar: "نسبة رأس المال المحجوز في هذه الفئة من إجمالي قيمة مخزون المجموعة." },
  avgUnitCost: { en: "Blended average cost per unit across items in this class (Total Value / Total Qty).", ar: "متوسط تكلفة الوحدة المرجح لهذه الفئة (إجمالي القيمة ÷ إجمالي الكمية)." },

  // Waste & Shrinkage
  source: { en: "Origin module of the loss: WASTE_LOG (kitchen/bar waste) or STOCK_ADJUSTMENT (audit/damage).", ar: "مصدر الخسارة: سجل الهدر (WASTE_LOG) أو تسويات المخزون (STOCK_ADJUSTMENT)." },
  category: { en: "Specific loss reason (e.g., Spoilage, DAMAGE, THEFT, COUNT_DIFFERENCE).", ar: "سبب الخسارة المحدد (مثل: تلف، سرقة، فرق جرد، انتهاء صلاحية)." },
  eventCount: { en: "Number of logged incidents matching this source, reason, and status.", ar: "عدد الحالات المسجلة لنفس المصدر والسبب والحالة." },
  totalUnitsLost: { en: "Total physical quantity written off or lost across these incidents.", ar: "إجمالي الكمية الفعلية المفقودة أو المعدومة عبر هذه الحالات." },
  financialImpact: { en: "Estimated or booked monetary loss (EGP) resulting from these incidents.", ar: "الأثر المالي المقدر أو المسجل بالعملة المحلية نتيجة هذه الحالات." },

  // Core Reports
  itemCode: { en: "Unique SKU/item master code.", ar: "الكود الفريد للصنف في دليل الأصناف." },
  item: { en: "Item name and description.", ar: "اسم ووصف الصنف." },
  qty: { en: "Current on-hand quantity in stock.", ar: "الكمية المتوفرة حالياً في المخزن." },
  wac: { en: "Weighted Average Cost per unit based on active stock ledger balances.", ar: "متوسط التكلفة المرجح للوحدة بناءً على أرصدة المخزون النشطة." },
  value: { en: "Total stock value (Qty × WAC).", ar: "إجمالي قيمة المخزون (الكمية × متوسط التكلفة)." },
  valuationMethod: { en: "Costing method applied to the item (WAC or FIFO).", ar: "طريقة تقييم التكلفة المطبقة على الصنف (متوسط مرجح WAC أو الوارد أولاً FIFO)." },
  period: { en: "Accounting or inventory count period (YYYY-MM).", ar: "الفترة المحاسبية أو فترة الجرد." },
  warehouse: { en: "Warehouse or branch store code.", ar: "كود المستودع أو مخزن الفرع." },
  theoreticalQty: { en: "Expected stock quantity calculated from recipes/POS sales and movements.", ar: "الكمية النظرية المتوقعة وفقاً للمبيعات والوصفات وحركة المخزن." },
  actualQty: { en: "Physical quantity counted during stocktaking.", ar: "الكمية الفعلية المعدودة أثناء الجرد." },
  varianceQty: { en: "Difference between actual and theoretical quantity (Actual − Theoretical).", ar: "الفرق بين الكمية الفعلية والنظرية (الفعلي − النظري)." },
  variancePct: { en: "Variance percentage relative to theoretical consumption.", ar: "نسبة الفرق مقارنة بالكمية النظرية." },
  poNumber: { en: "Purchase Order reference number.", ar: "الرقم المرجعي لأمر الشراء." },
  vendor: { en: "Supplier / vendor name.", ar: "اسم المورد." },
  orderedQty: { en: "Total quantity ordered on the Purchase Order.", ar: "إجمالي الكمية المطلوبة في أمر الشراء." },
  receivedQty: { en: "Quantity already received via GRN.", ar: "الكمية المستلمة فعلياً عبر سندات الاستلام." },
  outstandingQty: { en: "Remaining quantity still awaiting delivery (Ordered − Received).", ar: "الكمية المتبقية قيد التوريد (المطلوب − المستلم)." },
  totalValue: { en: "Total monetary value of the Purchase Order or ABC tier.", ar: "القيمة المالية الإجمالية لأمر الشراء أو الفئة." },
  balance: { en: "Current unpaid Accounts Payable balance owed to the supplier.", ar: "الرصيد المستحق حالياً للمورد في دفتر الدائنين." },
  entries: { en: "Total number of AP ledger postings (invoices & payments) for this vendor.", ar: "عدد القيود المسجلة في دفتر الدائنين لهذا المورد." },
  batchNo: { en: "Lot / batch tracking number.", ar: "رقم التشغيلة / الدفعة." },
  expiryDate: { en: "Batch expiration date.", ar: "تاريخ انتهاء صلاحية الدفعة." },
  daysToExpiry: { en: "Days remaining until expiry (negative means already expired).", ar: "الأيام المتبقية حتى الانتهاء (القيم السالبة تعني منتهي الصلاحية)." },
  risk: { en: "Expiry risk tier: EXPIRED (<0d), CRITICAL (≤7d), WARNING (≤30d), OK (>30d).", ar: "مستوى مخاطر الصلاحية: منتهي، حرج (≤7 أيام)، تحذير (≤30 يوم)، آمن." },
  slaCount: { en: "Number of periodic SLA evaluations recorded for this vendor.", ar: "عدد تقييمات الأداء المسجلة لهذا المورد." },
  otifRate: { en: "On-Time In-Full delivery rate (%) — higher is better.", ar: "نسبة التسليم الكامل في الموعد المحدد (%) — الأعلى أفضل." },
  priceVarianceRate: { en: "Invoice vs. PO price variance rate (%) — lower is better.", ar: "نسبة انحراف سعر الفاتورة عن أمر الشراء (%) — الأقل أفضل." },
  qcRejectionRate: { en: "Percentage of delivered goods rejected/quarantined at QC — lower is better.", ar: "نسبة البضائع المرفوضة أو المحجوزة في فحص الجودة (%) — الأقل أفضل." },
  docAccuracyRate: { en: "Accuracy rate (%) of supplier invoices and delivery paperwork.", ar: "نسبة دقة الفواتير ومستندات التوريد (%)." },
  recipe: { en: "Menu item or prep recipe name.", ar: "اسم الوصفة أو الصنف المباع." },
  type: { en: "Recipe category (MENU_ITEM, PREP, or FINISHED_GOOD).", ar: "نوع الوصفة (صنف قائمة، تحضير، منتج تام)." },
  cost: { en: "Calculated recipe cost at current WAC including yield factor & shrinkage.", ar: "تكلفة الوصفة المحسوبة بمتوسط التكلفة الحالي مع احتساب الفاقد والهالك." },
};

function getColumnTooltip(colKey: string, appLang: "ar" | "en"): string | null {
  if (COLUMN_TOOLTIPS[colKey]) {
    return appLang === "ar" ? COLUMN_TOOLTIPS[colKey].ar : COLUMN_TOOLTIPS[colKey].en;
  }
  // Fallback lookup if report was switched to AR headers
  const arMatch = Object.entries(AR_KEY_REVERSE_MAP).find(([arLabel]) => arLabel === colKey);
  if (arMatch && COLUMN_TOOLTIPS[arMatch[1]]) {
    const t = COLUMN_TOOLTIPS[arMatch[1]];
    return appLang === "ar" ? t.ar : t.en;
  }
  return null;
}

const AR_KEY_REVERSE_MAP: Record<string, string> = {
  "كود الصنف": "itemCode",
  "الصنف": "item",
  "الكمية": "qty",
  "متوسط التكلفة": "wac",
  "القيمة": "value",
  "طريقة التقييم": "valuationMethod",
  "الفترة": "period",
  "المخزن": "warehouse",
  "الكمية النظرية": "theoreticalQty",
  "الكمية الفعلية": "actualQty",
  "فرق الكمية": "varianceQty",
  "نسبة الفرق": "variancePct",
  "رقم أمر الشراء": "poNumber",
  "المورد": "vendor",
  "المشروع": "project",
  "كود المشروع": "projectCode",
  "الحالة": "status",
  "الكمية المطلوبة": "orderedQty",
  "الكمية المستلمة": "receivedQty",
  "الكمية المتبقية": "outstandingQty",
  "القيمة الإجمالية": "totalValue",
  "الرصيد": "balance",
  "القيود": "entries",
  "رقم الدفعة": "batchNo",
  "تاريخ الانتهاء": "expiryDate",
  "أيام حتى الانتهاء": "daysToExpiry",
  "المخاطر": "risk",
  "عدد تقييمات الأداء": "slaCount",
  "نسبة التسليم الكامل في الوقت": "otifRate",
  "نسبة انحراف السعر": "priceVarianceRate",
  "نسبة رفض الجودة": "qcRejectionRate",
  "دقة المستندات": "docAccuracyRate",
  "عدد أوامر الشراء": "poCount",
  "الوصفة": "recipe",
  "النوع": "type",
  "التكلفة": "cost",
  "قيمة المخزون": "stockValue",
  "قيمة أوامر الشراء المفتوحة": "openPoValue",
  "إجمالي المشتريات": "totalSpend",
  "قيمة الهدر والتسويات": "wasteLossValue",
  "اعتمادات معلقة": "pendingApprovals",
  "تنبيهات انخفاض المخزون": "lowStockAlerts",
  "تشغيلات قريبة الانتهاء": "expiringBatches",
  "تحويلات قيد النقل": "inTransitTransfers",
  "تكلفة البضاعة المباعة (COGS)": "cogsDebit",
  "مصروف الهدر والتوالف": "wasteDebit",
  "تكاليف الشحن والجمارك": "freightDebit",
  "أصول المخزون": "inventoryAsset",
  "التزامات الموردين": "apExposure",
  "نسبة الإنفاق %": "spendSharePct",
  "التصنيف (ABC)": "abcClass",
  "عدد الأصناف": "itemCount",
  "إجمالي الكمية": "totalQty",
  "نسبة رأس المال المحجوز %": "capitalSharePct",
  "متوسط تكلفة الوحدة": "avgUnitCost",
  "عدد التحويلات": "transferCount",
  "إجمالي الوحدات المنقولة": "totalUnitsMoved",
  "فروقات الاستلام": "discrepancyUnits",
  "نسبة الفروقات %": "discrepancyPct",
  "متأخر > 3 أيام": "staleOver3Days",
  "المصدر": "source",
  "الفئة / السبب": "category",
  "عدد الحالات": "eventCount",
  "إجمالي الوحدات المفقودة": "totalUnitsLost",
  "الأثر المالي (ج.م)": "financialImpact",
};

export default function Reports() {
  const { t, lang: appLang } = useI18n();
  const defs = useApi<ReportDef[]>("/analytics/definitions");
  const snapshots = useApi<ReportSnapshot[]>("/analytics/snapshots/history");
  const schedules = useApi<ScheduledReport[]>("/analytics/schedules/list");
  const [tab, setTab] = useState<"reports" | "snapshots" | "schedules">("reports");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "board" | "inventory" | "procurement">("all");
  const [active, setActive] = useState<string | null>(null);
  const [lang, setLang] = useState<"EN" | "AR">(appLang.toUpperCase() as "EN" | "AR");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pinnedColInfo, setPinnedColInfo] = useState<{ col: string; desc: string } | null>(null);
  const boardSummary = useApi<ReportResult>("/analytics/BOARD-EXECUTIVE-KPI?lang=EN");

  const snapshotFilter = useListFilter<ReportSnapshot>(snapshots.data, ["reportCode", "period"]);
  const scheduleFilter = useListFilter<ScheduledReport>(schedules.data, ["reportCode", "frequency"]);

  const [viewSnapshot, setViewSnapshot] = useState<ReportSnapshot | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [deleteSchedule, setDeleteSchedule] = useState<ScheduledReport | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ reportCode: "", frequency: "DAILY", recipients: "" });

  const user = getUser();
  const canSnapshot = user && ["ADMIN", "CFO", "COST_CONTROLLER"].includes(user.role);
  const canSchedule = user && ["ADMIN", "CFO"].includes(user.role);

  const run = async (code: string, l?: "EN" | "AR") => {
    const useLang = l ?? lang;
    setActive(code);
    setPinnedColInfo(null);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/v1/analytics/${code}?lang=${useLang}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ca_token")}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Report failed (${res.status})`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run report");
    } finally {
      setBusy(false);
    }
  };

  const toggleLang = (l: "EN" | "AR") => {
    setLang(l);
    if (active) run(active, l);
  };

  const snapshot = async (code: string) => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await apiReq<ReportSnapshot>("POST", `/analytics/${code}/snapshot`);
      setMsg(`Snapshot saved (${res.period})`);
      snapshots.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Snapshot failed");
    } finally {
      setBusy(false);
    }
  };

  const submitSchedule = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const recipients = scheduleForm.recipients
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!recipients.length) throw new Error("Add at least one recipient email");
      await apiReq("POST", "/analytics/schedules", {
        reportCode: scheduleForm.reportCode,
        frequency: scheduleForm.frequency,
        recipients,
      });
      setMsg("Schedule created");
      schedules.reload();
      setShowSchedule(false);
      setScheduleForm({ reportCode: "", frequency: "DAILY", recipients: "" });
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleSchedule = async (s: ScheduledReport) => {
    setBusy(true);
    setError(null);
    try {
      await apiReq("PATCH", `/analytics/schedules/${s.id}`, { active: !s.active });
      schedules.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteSchedule = async () => {
    if (!deleteSchedule) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await apiReq("DELETE", `/analytics/schedules/${deleteSchedule.id}`);
      setDeleteSchedule(null);
      setMsg("Schedule deleted");
      schedules.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleteSchedule(null);
    } finally {
      setBusy(false);
    }
  };

  const cols = result?.rows?.length ? Object.keys(result.rows[0]) : [];
  const snapCols = viewSnapshot?.data?.length ? Object.keys(viewSnapshot.data[0]) : [];

  const boardTotals = (boardSummary.data?.rows ?? []).reduce<{
    stockValue: number;
    openPoValue: number;
    totalSpend: number;
    wasteLoss: number;
    alerts: number;
  }>(
    (acc, r) => {
      acc.stockValue += Number(r.stockValue ?? 0);
      acc.openPoValue += Number(r.openPoValue ?? 0);
      acc.totalSpend += Number(r.totalSpend ?? 0);
      acc.wasteLoss += Number(r.wasteLossValue ?? 0);
      acc.alerts += Number(r.lowStockAlerts ?? 0) + Number(r.expiringBatches ?? 0);
      return acc;
    },
    { stockValue: 0, openPoValue: 0, totalSpend: 0, wasteLoss: 0, alerts: 0 }
  );

  const exportActiveReportCsv = () => {
    if (!result || !result.rows.length) return;
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = cols.map(esc).join(",");
    const lines = result.rows.map((r) => cols.map((c) => esc(r[c])).join(","));
    const blob = new Blob(["\ufeff" + [header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.code.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredDefs = (defs.data ?? []).filter((d) => {
    if (categoryFilter === "all") return true;
    return REPORT_META[d.code]?.category === categoryFilter;
  });

  return (
    <>
      <div className="topbar">
        <h1>{t("nav_reports")}</h1>
        <div className="crumb">{t("crumb_reports")}</div>
      </div>

      {boardSummary.data?.rows?.length ? (
        <div className="grid kpis" style={{ marginBottom: 22 }}>
          <div className="kpi">
            <div className="label">{appLang === "ar" ? "إجمالي قيمة المخزون (المجموعة)" : "Holding Stock Value"}</div>
            <div className="value">{boardTotals.stockValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} {t("common.egp")}</div>
            <div className="hint">{appLang === "ar" ? "عبر جميع المستودعات والفروع" : "Across all warehouses"}</div>
          </div>
          <div className="kpi">
            <div className="label">{appLang === "ar" ? "أوامر الشراء المفتوحة" : "Open PO Commitments"}</div>
            <div className="value">{boardTotals.openPoValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} {t("common.egp")}</div>
            <div className="hint">{appLang === "ar" ? "قيد التوريد والاستلام" : "Pending delivery & GRN"}</div>
          </div>
          <div className="kpi">
            <div className="label">{appLang === "ar" ? "إجمالي الإنفاق والمشتريات" : "Total Procurement Spend"}</div>
            <div className="value">{boardTotals.totalSpend.toLocaleString("en-US", { maximumFractionDigits: 0 })} {t("common.egp")}</div>
            <div className="hint">{appLang === "ar" ? "إجمالي قيمة أوامر الشراء" : "Total PO volume"}</div>
          </div>
          <div className="kpi">
            <div className="label">{appLang === "ar" ? "خسائر الهدر والتسويات" : "Waste & Shrinkage Loss"}</div>
            <div className="value bad">{boardTotals.wasteLoss.toLocaleString("en-US", { maximumFractionDigits: 0 })} {t("common.egp")}</div>
            <div className="hint">{appLang === "ar" ? "هالك وفروقات معتمدة" : "Approved waste & adjustments"}</div>
          </div>
          <div className="kpi">
            <div className="label">{appLang === "ar" ? "تنبيهات المخزون والصلاحية" : "Active Stock & Expiry Alerts"}</div>
            <div className={`value ${boardTotals.alerts > 0 ? "warn" : "ok"}`}>{boardTotals.alerts}</div>
            <div className="hint">{appLang === "ar" ? "إعادة طلب + صلاحية < 30 يوم" : "Low stock + expiring < 30d"}</div>
          </div>
        </div>
      ) : null}

      <div className="tabs">
        <button
          className={tab === "reports" ? "active" : ""}
          onClick={() => setTab("reports")}
          title="Reports: Prebuilt enterprise reports covering stock valuation, FEFO expiry aging, spend analytics, and profit margins"
        >
          {t("tab_reports")}
        </button>
        <button
          className={tab === "snapshots" ? "active" : ""}
          onClick={() => setTab("snapshots")}
          title="Snapshots: Point-in-time exported report runs with immutable parameter records and historical JSON data"
        >
          {t("tab_snapshots")} ({snapshots.data?.length ?? 0})
        </button>
        <button
          className={tab === "schedules" ? "active" : ""}
          onClick={() => setTab("schedules")}
          title="Schedules: Automated cron schedules for periodic report generation and recipient email notifications"
        >
          {t("tab_schedules")} ({schedules.data?.length ?? 0})
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {tab === "reports" && (
        <>
          <div className="toolbar" style={{ marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
            {(
              [
                { id: "all", en: "All Reports", ar: "جميع التقارير" },
                { id: "board", en: "Board & Executive", ar: "تقارير مجلس الإدارة" },
                { id: "inventory", en: "Inventory & Costing", ar: "المخزون والتكاليف" },
                { id: "procurement", en: "Procurement & Vendors", ar: "المشتريات والموردين" },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`btn sm ${categoryFilter === cat.id ? "amber" : "ghost"}`}
                onClick={() => setCategoryFilter(cat.id)}
              >
                {appLang === "ar" ? cat.ar : cat.en}
              </button>
            ))}
          </div>

          <div className="report-grid" style={{ marginBottom: 22 }}>
            {defs.loading && <Loading />}
            {defs.error && <ErrorBanner message={defs.error} />}
            {filteredDefs.map((d) => {
              const meta = REPORT_META[d.code];
              const name = meta ? (appLang === "ar" ? meta.nameAr : meta.nameEn) : d.name;
              const desc = meta ? (appLang === "ar" ? meta.descAr : meta.descEn) : (d.description ?? "");
              return (
                <div
                  className="report-card"
                  key={d.id}
                  onClick={() => run(d.code)}
                  style={active === d.code ? { borderColor: "var(--amber-2, #d97706)" } : undefined}
                >
                  <div className="code" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span>{d.code}</span>
                    {meta?.isBoard && (
                      <span className="badge amber" style={{ fontSize: 10 }}>
                        {appLang === "ar" ? "تنفيذي" : "BOARD"}
                      </span>
                    )}
                  </div>
                  <div className="name">{name}</div>
                  <div className="aud">{desc}</div>
                </div>
              );
            })}
          </div>

          {active && (
            <div className="card">
              <h2>
                {REPORT_META[active] ? (appLang === "ar" ? REPORT_META[active].nameAr : REPORT_META[active].nameEn) : active}
                <span className="count" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <button className={`btn ghost sm ${lang === "EN" ? "primary" : ""}`} onClick={() => toggleLang("EN")}>
                    EN
                  </button>
                  <button className={`btn ghost sm ${lang === "AR" ? "primary" : ""}`} onClick={() => toggleLang("AR")}>
                    AR
                  </button>
                  {result?.rows?.length ? (
                    <button className="btn ghost sm" onClick={exportActiveReportCsv}>
                      {t("common.export_csv")}
                    </button>
                  ) : null}
                  {canSnapshot && (
                    <button className="btn sm" onClick={() => snapshot(active)} disabled={busy}>
                      {busy ? "Saving…" : "Snapshot"}
                    </button>
                  )}
                </span>
              </h2>
              {busy ? (
                <Loading />
              ) : !result ? null : result.rows.length === 0 ? (
                <Empty text="No rows for this report." />
              ) : (
                <>
                  {pinnedColInfo && (
                    <div
                      style={{
                        marginBottom: 10,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(217, 119, 6, 0.1)",
                        border: "1px solid rgba(217, 119, 6, 0.3)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        fontSize: 12.5,
                      }}
                    >
                      <div>
                        <strong style={{ color: "var(--amber-2, #d97706)" }}>{pinnedColInfo.col}:</strong>{" "}
                        <span>{pinnedColInfo.desc}</span>
                      </div>
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => setPinnedColInfo(null)}
                        aria-label="Close column description"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead>
                        <tr>
                          {cols.map((c) => {
                            const tip = getColumnTooltip(c, appLang);
                            const isPinned = pinnedColInfo?.col === c;
                            return (
                              <th
                                key={c}
                                title={tip ?? undefined}
                                onClick={() => {
                                  if (!tip) return;
                                  setPinnedColInfo((prev) => (prev?.col === c ? null : { col: c, desc: tip }));
                                }}
                                style={
                                  tip
                                    ? {
                                        cursor: "pointer",
                                        userSelect: "none",
                                        textDecoration: isPinned ? "underline" : undefined,
                                      }
                                    : undefined
                                }
                              >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <span>{c}</span>
                                  {tip && (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 14,
                                        height: 14,
                                        borderRadius: "50%",
                                        fontSize: 10,
                                        fontWeight: 700,
                                        background: isPinned ? "var(--amber-2, #d97706)" : "rgba(148, 163, 184, 0.25)",
                                        color: isPinned ? "#fff" : "inherit",
                                      }}
                                    >
                                      ?
                                    </span>
                                  )}
                                </span>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, i) => (
                          <tr key={i}>
                            {cols.map((c) => {
                              const v = row[c];
                              const isNum = typeof v === "number";
                              const strVal = v instanceof Date ? v.toLocaleDateString("en-GB") : String(v ?? "—");
                              const isBadge =
                                typeof v === "string" &&
                                /^(EXPIRED|CRITICAL|WARNING|OK|OPEN|PARTIALLY_RECEIVED|FULLY_RECEIVED|FORCE_CLOSED|REQUESTED|APPROVED|DISPATCHED|IN_TRANSIT|RECEIVED|CANCELLED|PENDING|REJECTED)$/i.test(
                                  v
                                );
                              return (
                                <td key={c} className={isNum ? "num" : ""}>
                                  {isBadge ? (
                                    <Badge status={v as string} />
                                  ) : isNum ? (
                                    (v as number).toLocaleString("en-US", { maximumFractionDigits: 2 })
                                  ) : (
                                    strVal
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {tab === "snapshots" && (
        <div className="card">
          <ListToolbar
            q={snapshotFilter.q}
            setQ={snapshotFilter.setQ}
            rows={snapshotFilter.filtered}
            columns={[
              { key: "reportCode", label: "Report" },
              { key: "period", label: "Period" },
            ]}
            filename="snapshots"
          />
          {snapshots.error && <ErrorBanner message={snapshots.error} />}
          {snapshots.loading ? (
            <Loading />
          ) : !snapshots.data?.length ? (
            <Empty text="No snapshots yet. Run a report and capture a snapshot." />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Period</th>
                    <th>Rows</th>
                    <th>Generated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(snapshotFilter.filtered ?? []).map((s) => (
                    <tr key={s.id}>
                      <td className="mono">{s.reportCode}</td>
                      <td className="mono">{s.period}</td>
                      <td className="num">{s.data?.length ?? 0}</td>
                      <td>{new Date(s.generatedAt).toLocaleString("en-GB")}</td>
                      <td>
                        <button className="link" onClick={() => setViewSnapshot(s)}>
                          view
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "schedules" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            {canSchedule && (
              <button className="btn amber" onClick={() => setShowSchedule(true)}>
                + New schedule
              </button>
            )}
          </div>
          <ListToolbar
            q={scheduleFilter.q}
            setQ={scheduleFilter.setQ}
            rows={scheduleFilter.filtered}
            columns={[
              { key: "reportCode", label: "Report" },
              { key: "frequency", label: "Frequency" },
            ]}
            filename="schedules"
          />
          {schedules.error && <ErrorBanner message={schedules.error} />}
          {schedules.loading ? (
            <Loading />
          ) : !schedules.data?.length ? (
            <Empty text="No schedules yet." />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Frequency</th>
                    <th>Recipients</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(scheduleFilter.filtered ?? []).map((s) => (
                    <tr key={s.id}>
                      <td className="mono">{s.reportCode}</td>
                      <td>{s.frequency.replace(/_/g, " ")}</td>
                      <td>{s.recipients.join(", ")}</td>
                      <td>
                        <Badge status={s.active ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      <td>
                        <div className="row-actions">
                          {canSchedule && (
                            <>
                              <button className="link" onClick={() => toggleSchedule(s)}>
                                {s.active ? "pause" : "resume"}
                              </button>
                              <button
                                className="link danger"
                                onClick={() => {
                                  setError(null);
                                  setDeleteSchedule(s);
                                }}
                              >
                                delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showSchedule && (
        <Modal title="New Schedule" onClose={() => setShowSchedule(false)}>
          <form onSubmit={submitSchedule}>
            {error && <ErrorBanner message={error} />}
            <div className="form-row">
              <div className="field">
                <label>Report</label>
                <select value={scheduleForm.reportCode} onChange={(e) => setScheduleForm({ ...scheduleForm, reportCode: e.target.value })} required>
                  <option value="">Select report…</option>
                  {(defs.data ?? []).map((d) => {
                    const meta = REPORT_META[d.code];
                    const rName = meta ? (appLang === "ar" ? meta.nameAr : meta.nameEn) : d.name;
                    return (
                      <option key={d.id} value={d.code}>
                        {d.code} · {rName}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="field">
                <label>Frequency</label>
                <select value={scheduleForm.frequency} onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}>
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {f.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Recipients (comma-separated emails)</label>
              <input value={scheduleForm.recipients} onChange={(e) => setScheduleForm({ ...scheduleForm, recipients: e.target.value })} placeholder="ops@capitalagro.com, cfo@capitalagro.com" required />
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowSchedule(false)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : "Create schedule"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {viewSnapshot && (
        <Modal title={`${viewSnapshot.reportCode} · ${viewSnapshot.period}`} onClose={() => setViewSnapshot(null)} wide>
          <div className="tbl-wrap">
            {!viewSnapshot.data?.length ? (
              <Empty text="Snapshot has no rows." />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    {snapCols.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewSnapshot.data.map((row, i) => (
                    <tr key={i}>
                      {snapCols.map((c) => {
                        const v = row[c];
                        const isNum = typeof v === "number";
                        return (
                          <td key={c} className={isNum ? "num" : ""}>
                            {String(v ?? "—")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="modal-actions">
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setViewSnapshot(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {deleteSchedule && (
        <ConfirmDialog
          title="Delete schedule"
          message={`Delete the ${deleteSchedule.reportCode} schedule (${deleteSchedule.frequency.replace(/_/g, " ")})? This cannot be undone.`}
          confirmLabel="Delete"
          busy={busy}
          onConfirm={confirmDeleteSchedule}
          onCancel={() => setDeleteSchedule(null)}
        />
      )}

      <Toast message={msg} onDone={() => setMsg(null)} />
    </>
  );
}