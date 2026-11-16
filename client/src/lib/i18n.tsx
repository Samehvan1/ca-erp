import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "ar" | "en";

export interface Translations {
  [key: string]: string;
}

const AR_TRANSLATIONS: Translations = {
  // Brand & Shell
  "brand.title": "كابيتال أجرو",
  "brand.sub": "إدارة المخزون · المشتريات",
  "brand.holding": "الشركة القابضة",
  "nav.dashboard": "لوحة التحكم",
  "nav.inventory": "المخزون",
  "nav.procurement": "المشتريات",
  "nav.transfers": "التحويلات المخزنية",
  "nav.stocktaking": "الجرد والتسويات",
  "nav.recipes": "الوصفات والتكاليف",
  "nav.finance": "المالية والحسابات",
  "nav.suppliers": "الموردين",
  "nav.reports": "التقارير",
  "nav.users": "المستخدمين والصلاحيات",
  "nav.audit": "سجل التدقيق والأمان",
  "nav.signout": "تسجيل الخروج",
  "nav.changepw": "تغيير كلمة المرور",
  "nav.update": "تحديث",
  "nav.cancel": "إلغاء",
  "nav.curr_pw": "كلمة المرور الحالية",
  "nav.new_pw": "كلمة المرور الجديدة (8 أحرف كحد أدنى)",
  "lang.toggle": "English",
  "lang.current": "العربية",

  // Common UI
  "common.actions": "الإجراءات",
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.delete": "حذف",
  "common.edit": "تعديل",
  "common.view": "عرض",
  "common.create": "إنشاء جديد",
  "common.search": "بحث...",
  "common.filter": "تصفية",
  "common.export_csv": "تصدير CSV",
  "common.status": "الحالة",
  "common.date": "التاريخ",
  "common.total": "الإجمالي",
  "common.quantity": "الكمية",
  "common.unit_price": "سعر الوحدة",
  "common.total_value": "القيمة الإجمالية",
  "common.project": "المشروع / الفرع",
  "common.warehouse": "المستودع",
  "common.category": "التصنيف",
  "common.item": "الصنف",
  "common.items": "الأصناف",
  "common.unit": "الوحدة",
  "common.notes": "ملاحظات",
  "common.history": "سجل التعديلات",
  "common.loading": "جاري التحميل...",
  "common.no_data": "لا توجد بيانات مسجلة حالياً.",
  "common.success": "تمت العملية بنجاح",
  "common.error": "حدث خطأ أثناء تنفيذ العملية",
  "common.egp": "ج.م",
  "common.close": "إغلاق",
  "common.confirm": "تأكيد",

  // Roles
  "role.ADMIN": "مدير النظام العام",
  "role.CFO": "المدير المالي التنفيذي (CFO)",
  "role.GROUP_EXECUTIVE": "المدير التنفيذي للمجموعة",
  "role.PROCUREMENT_OFFICER": "مسؤول المشتريات",
  "role.PROJECT_WAREHOUSE_MANAGER": "مدير مستودع المشروع",
  "role.BRANCH_MANAGER": "مدير الفرع",
  "role.HEAD_CHEF": "رئيس الطهاة (شيف)",
  "role.HEAD_BARISTA": "رئيس الباريستا",
  "role.COST_CONTROLLER": "مراقب التكاليف",

  // Status Badges
  "status.DRAFT": "مسودة",
  "status.PENDING": "قيد الانتظار",
  "status.PENDING_APPROVAL": "بانتظار الاعتماد",
  "status.APPROVED": "معتمد",
  "status.REJECTED": "مرفوض",
  "status.OPEN": "مفتوح / جاري",
  "status.PARTIALLY_RECEIVED": "مستلم جزئياً",
  "status.FULFILLED": "مكتمل التوريد",
  "status.CLOSED": "مغلق",
  "status.CANCELLED": "ملغي",
  "status.REQUESTED": "مطلوب",
  "status.DISPATCHED": "تم الشحن",
  "status.IN_TRANSIT": "في الطريق",
  "status.RECEIVED": "تم الاستلام",
  "status.CONVERTED": "تم التحويل لأمر شراء",
  "status.POSTED": "مرحل محاسبياً",

  // Dashboard
  "dash.title": "لوحة القيادة التنفيذية",
  "dash.subtitle": "نظرة عامة على حركة المخزون، المشتريات، والاعتمادات المالية لمجموعة كابيتال أجرو",
  "dash.kpi.total_stock": "إجمالي قيمة المخزون",
  "dash.kpi.open_pos": "أوامر الشراء المفتوحة",
  "dash.kpi.pending_reqs": "طلبات شراء بانتظار الاعتماد",
  "dash.kpi.transfers_transit": "تحويلات قيد النقل",
  "dash.kpi.low_stock_alerts": "تنبيهات انخفاض المخزون",
  "dash.kpi.pending_invoices": "فواتير بانتظار المطابقة الثلاثية",
  "dash.sec.recent_requisitions": "أحدث طلبات الاحتياج والمشتريات",
  "dash.sec.in_transit": "شحنات النقل بين المستودعات والفروع",
  "dash.sec.low_stock": "أصناف بلغت نقطة إعادة الطلب (ROP)",
  "dash.btn.new_req": "+ طلب شراء جديد",
  "dash.btn.new_transfer": "+ طلب تحويل مخزني",
  "dash.btn.run_rop": "⚡ فحص إعادة التوريد (ROP)",

  // Procurement Hub
  "proc.title": "مركز المشتريات وإدارة الموردين",
  "proc.subtitle": "إدارة دورة الشراء الكاملة: طلبات الاحتياج ➔ اعتماد الصلاحيات ➔ أمر الشراء ➔ استلام GRN ➔ المطابقة الثلاثية ➔ الصرف للمورد",
  "proc.tab.reqs": "طلبات الاحتياج (PR)",
  "proc.tab.pos": "أوامر الشراء والتوريد (PO)",
  "proc.tab.match": "المطابقة الثلاثية والفواتير",
  "proc.tab.replenish": "مخطط إعادة التوريد (ROP)",
  "proc.tab.grns": "سندات استلام البضاعة (GRN)",
  "proc.tab.payments": "سندات الصرف والمدفوعات",
  "proc.btn.new_req": "+ طلب احتياج جديد",
  "proc.btn.new_po": "+ أمر شراء جديد",
  "proc.btn.new_grn": "+ تسجيل استلام بضاعة (GRN)",
  "proc.btn.new_invoice": "+ تسجيل فاتورة مورد",
  "proc.btn.new_payment": "+ تسجيل سند صرف / دفعة",
  "proc.action.approve": "اعتماد",
  "proc.action.transfer": "تحويل من مستودع",
  "proc.action.convert_po": "تحويل لأمر شراء",
  "proc.match.po_vs_grn_vs_inv": "مطابقة أمر الشراء × استلام المستودع × فاتورة المورد",
  "proc.match.variance": "فرق السعر / الكمية",

  // Inventory Hub
  "inv.title": "مركز إدارة المخزون والمستودعات",
  "inv.subtitle": "المصفوفة الحية للأرصدة، تتبع الشحنات والصلاحيات (FEFO)، المستودعات المركزية والفروع، وتسويات الهالك",
  "inv.tab.matrix": "مصفوفة أرصدة المخزون",
  "inv.tab.batches": "الشحنات وتواريخ الصلاحية (FEFO)",
  "inv.tab.warehouses": "المستودعات والفروع",
  "inv.tab.items": "دليل الأصناف",
  "inv.tab.rop": "حدود إعادة الطلب (ROP)",
  "inv.tab.adjustments": "تسويات الجرد والهالك",
  "inv.tab.master": "البيانات الأساسية والتحويلات",
  "inv.btn.new_item": "+ إضافة صنف جديد",
  "inv.btn.new_warehouse": "+ إضافة مستودع / فرع",
  "inv.btn.new_batch": "+ إضافة شحنة (تشغيلة)",
  "inv.btn.new_adjustment": "+ تسوية جرد / إثبات هالك",
  "inv.btn.set_rop": "+ ضبط حد إعادة الطلب",
  "inv.col.stock_on_hand": "الرصيد الفعلي",
  "inv.col.wac_cost": "متوسط التكلفة المرجح (WAC)",
  "inv.col.total_valuation": "القيمة الإجمالية",
  "inv.col.reorder_level": "نقطة إعادة الطلب",
  "inv.col.batch_number": "رقم التشغيلة (Batch)",
  "inv.col.expiry_date": "تاريخ الصلاحية",
  "inv.fefo.expired": "منتهي الصلاحية",
  "inv.fefo.critical": "صلاحية حرجة (أقل من 30 يوم)",
  "inv.fefo.good": "صالح للاستخدام",

  // Master Data & Unit Conversions
  "master.title": "البيانات الأساسية ووحدات القياس",
  "master.subtitle": "إدارة التصنيفات، وحدات القياس، والتحويل الذكي بين وحدات الشراء والاستخدام ووصفات الإنتاج",
  "master.tab.categories": "التصنيفات الرئيسية",
  "master.tab.units": "وحدات القياس (UOM)",
  "master.tab.conversions": "التحويل الذكي بين الوحدات",
  "master.tab.roles": "مصفوفة الصلاحيات والأدوار",
  "master.btn.add_category": "+ تصنيف جديد",
  "master.btn.add_unit": "+ وحدة قياس جديدة",
  "master.btn.add_conversion": "+ قاعدة تحويل جديدة",
  "master.calc.title": "حاسبة التحويل الفوري",
  "master.calc.from": "من الوحدة",
  "master.calc.to": "إلى الوحدة",
  "master.calc.qty": "الكمية",
  "master.calc.result": "الناتج المحول",

  // Transfers Hub
  "trans.title": "مركز التحويلات اللوجستية بين المستودعات",
  "trans.subtitle": "إدارة دورة التحويل: طلب من الفرع ➔ موافقة ➔ تجهيز وشحن (FEFO) ➔ تتبع الشحنة ➔ استلام وتأكيد بالفرع",
  "trans.tab.requisitions": "طلبات التحويل",
  "trans.tab.orders": "أوامر الشحن والنقل",
  "trans.tab.aging": "لوحة الشحنات في الطريق (In-Transit)",
  "trans.btn.new_transfer": "+ طلب تحويل جديد",
  "trans.btn.dispatch": "شحن وصرف الشحنة",
  "trans.btn.receive": "تأكيد الاستلام بالمستودع",
  "trans.col.from_wh": "المستودع المصدر",
  "trans.col.to_wh": "المستودع الوجهة / الفرع",

  // Recipes & BOM
  "recipe.title": "الوصفات وتكاليف الإنتاج (BOM)",
  "recipe.subtitle": "قوائم مكونات المنتجات والمشروبات، التحليل الفعلي للتكلفة، ومطابقة الاستهلاك النظري مع الفعلي",
  "recipe.btn.new": "+ وصفة إنتاج جديدة",
  "recipe.scale": "مضاعفة كميات الإنتاج",
  "recipe.cost_per_serving": "تكلفة الوجبة / الكوب",
  "recipe.ingredients": "المكونات والكميات المعيارية",

  // Stocktaking
  "stocktake.title": "الجرد الدوري والسنوي والتسويات",
  "stocktake.subtitle": "جدولة الجرد الأعمى (Blind Count)، كشوفات الجرد للفرق الميدانية، وتوليد قيود تسوية الفروقات آلياً",
  "stocktake.btn.new": "+ بدء دورة جرد جديدة",
  "stocktake.reconcile": "تسوية واعتماد الفروقات",
  "stocktake.book_qty": "الرصيد الدفتري",
  "stocktake.counted_qty": "الرصيد الفعلي المعدود",
  "stocktake.variance": "فارق الجرد (عجز / زيادة)",

  // Finance & GL
  "fin.title": "المالية وشجرة الحسابات",
  "fin.subtitle": "دليل الحسابات (Chart of Accounts)، مراكز التكلفة، القيود الآلية، وتوزيع تكلفة الشحن والجمارك (Landed Cost)",
  "fin.tab.coa": "شجرة الحسابات",
  "fin.tab.cost_centers": "مراكز التكلفة",
  "fin.tab.journal": "دفتر اليومية العامة (GL)",
  "fin.tab.landed_cost": "توزيع التكاليف المضافة (Landed Cost)",
  "fin.btn.new_account": "+ إضافة حساب مالي",
  "fin.btn.new_entry": "+ قيد يومية يدوي",
  "fin.btn.allocate_landed": "توزيع تكاليف الشحن على الأصناف",

  // Security & Audit
  "sec.title": "المستخدمين، الأمان، وسجل التدقيق المشفر",
  "sec.subtitle": "إدارة حسابات الفريق، تعيين الصلاحيات، وسجل التدقيق اللحظي الموثق بسلاسل التشفير SHA-256",
  "sec.tab.users": "حسابات المستخدمين",
  "sec.tab.roles": "مصفوفة الصلاحيات (RBAC)",
  "sec.tab.audit": "سجل التدقيق المتسلسل (Audit Trail)",
  "sec.verify_chain": "🔍 التحقق من سلامة التشفير (SHA-256)",
  "sec.chain_valid": "سلسلة سجلات التدقيق سليمة وغير قابلة للتلاعب",
  "sec.btn.new_user": "+ مستخدم جديد",

  // History & Diff
  "history.modal_title": "سجل التغييرات والاعتمادات المشفر",
  "history.field": "الحقل المعدل",
  "history.original": "القيمة السابقة (قبل)",
  "history.new": "القيمة الجديدة (بعد)",
  "history.by": "بواسطة",
  "history.no_changes": "لا توجد حقول مسجلة لهذا الإجراء.",
  "history.hash": "رمز التحقق المشفر",
};

const EN_TRANSLATIONS: Translations = {
  // Brand & Shell
  "brand.title": "Capital Agro",
  "brand.sub": "Stock Control · Purchases",
  "brand.holding": "Holding Group",
  "nav.dashboard": "Dashboard",
  "nav.inventory": "Inventory",
  "nav.procurement": "Procurement",
  "nav.transfers": "Transfers",
  "nav.stocktaking": "Stocktaking",
  "nav.recipes": "Recipes",
  "nav.finance": "Finance",
  "nav.suppliers": "Suppliers",
  "nav.reports": "Reports",
  "nav.users": "Users",
  "nav.audit": "Audit Trail",
  "nav.signout": "Sign out",
  "nav.changepw": "Change password",
  "nav.update": "Update",
  "nav.cancel": "Cancel",
  "nav.curr_pw": "Current password",
  "nav.new_pw": "New password (min 8)",
  "lang.toggle": "العربية",
  "lang.current": "English",

  // Common UI
  "common.actions": "Actions",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.view": "View",
  "common.create": "Create New",
  "common.search": "Search...",
  "common.filter": "Filter",
  "common.export_csv": "Export CSV",
  "common.status": "Status",
  "common.date": "Date",
  "common.total": "Total",
  "common.quantity": "Quantity",
  "common.unit_price": "Unit Price",
  "common.total_value": "Total Value",
  "common.project": "Project / Brand",
  "common.warehouse": "Warehouse",
  "common.category": "Category",
  "common.item": "Item",
  "common.items": "Items",
  "common.unit": "Unit",
  "common.notes": "Notes",
  "common.history": "History",
  "common.loading": "Loading...",
  "common.no_data": "No recorded data found.",
  "common.success": "Action completed successfully",
  "common.error": "An error occurred",
  "common.egp": "EGP",
  "common.close": "Close",
  "common.confirm": "Confirm",

  // Roles
  "role.ADMIN": "System Administrator",
  "role.CFO": "Chief Financial Officer",
  "role.GROUP_EXECUTIVE": "Group Executive",
  "role.PROCUREMENT_OFFICER": "Procurement Officer",
  "role.PROJECT_WAREHOUSE_MANAGER": "Project Warehouse Manager",
  "role.BRANCH_MANAGER": "Branch Manager",
  "role.HEAD_CHEF": "Head Chef",
  "role.HEAD_BARISTA": "Head Barista",
  "role.COST_CONTROLLER": "Cost Controller",

  // Status Badges
  "status.DRAFT": "Draft",
  "status.PENDING": "Pending",
  "status.PENDING_APPROVAL": "Pending Approval",
  "status.APPROVED": "Approved",
  "status.REJECTED": "Rejected",
  "status.OPEN": "Open",
  "status.PARTIALLY_RECEIVED": "Partially Received",
  "status.FULFILLED": "Fulfilled",
  "status.CLOSED": "Closed",
  "status.CANCELLED": "Cancelled",
  "status.REQUESTED": "Requested",
  "status.DISPATCHED": "Dispatched",
  "status.IN_TRANSIT": "In Transit",
  "status.RECEIVED": "Received",
  "status.CONVERTED": "Converted to PO",
  "status.POSTED": "Posted",

  // Dashboard
  "dash.title": "Executive Dashboard",
  "dash.subtitle": "Group-wide stock movements, purchase pipeline, and Delegation of Authority approvals",
  "dash.kpi.total_stock": "Total Stock Valuation",
  "dash.kpi.open_pos": "Open Purchase Orders",
  "dash.kpi.pending_reqs": "Pending Requisitions",
  "dash.kpi.transfers_transit": "In-Transit Transfers",
  "dash.kpi.low_stock_alerts": "Low Stock Alerts",
  "dash.kpi.pending_invoices": "Pending 3-Way Match",
  "dash.sec.recent_requisitions": "Recent Purchase Requisitions",
  "dash.sec.in_transit": "Inter-Warehouse Transfers in Transit",
  "dash.sec.low_stock": "Items Below Safety Stock (ROP)",
  "dash.btn.new_req": "+ New Requisition",
  "dash.btn.new_transfer": "+ Request Transfer",
  "dash.btn.run_rop": "⚡ Run ROP Replenishment",

  // Procurement Hub
  "proc.title": "Procurement & Supplier Management",
  "proc.subtitle": "End-to-end procurement lifecycle: Requisition ➔ DoA Approval ➔ PO ➔ GRN ➔ 3-Way Match ➔ AP Payment",
  "proc.tab.reqs": "Purchase Requisitions",
  "proc.tab.pos": "Purchase Orders & Pipeline",
  "proc.tab.match": "3-Way Match & Invoices",
  "proc.tab.replenish": "Replenishment Planner",
  "proc.tab.grns": "Goods Receipts (GRN)",
  "proc.tab.payments": "Disbursements & AP",
  "proc.btn.new_req": "+ New Requisition",
  "proc.btn.new_po": "+ Issue Purchase Order",
  "proc.btn.new_grn": "+ Receive Goods (GRN)",
  "proc.btn.new_invoice": "+ Record Vendor Invoice",
  "proc.btn.new_payment": "+ Record AP Payment",
  "proc.action.approve": "Approve",
  "proc.action.transfer": "Fulfill via Transfer",
  "proc.action.convert_po": "Convert to PO",
  "proc.match.po_vs_grn_vs_inv": "3-Way Reconciliation: PO × GRN × Invoice",
  "proc.match.variance": "Price / Quantity Variance",

  // Inventory Hub
  "inv.title": "Inventory & Warehouse Hub",
  "inv.subtitle": "Real-time stock matrix, FEFO lot tracking, multi-warehouse hierarchy, and waste adjustments",
  "inv.tab.matrix": "Stock Matrix Grid",
  "inv.tab.batches": "Batches & FEFO Expiry",
  "inv.tab.warehouses": "Warehouses & Depots",
  "inv.tab.items": "Item Catalog",
  "inv.tab.rop": "Reorder Thresholds (ROP)",
  "inv.tab.adjustments": "Stock Adjustments & Waste",
  "inv.tab.master": "Master Data & UOM",
  "inv.btn.new_item": "+ New Item",
  "inv.btn.new_warehouse": "+ New Warehouse",
  "inv.btn.new_batch": "+ New Batch",
  "inv.btn.new_adjustment": "+ Stock Adjustment",
  "inv.btn.set_rop": "+ Set Reorder Point",
  "inv.col.stock_on_hand": "On Hand",
  "inv.col.wac_cost": "WAC Unit Cost",
  "inv.col.total_valuation": "Total Valuation",
  "inv.col.reorder_level": "Safety Stock / ROP",
  "inv.col.batch_number": "Batch #",
  "inv.col.expiry_date": "Expiry Date",
  "inv.fefo.expired": "Expired",
  "inv.fefo.critical": "Critical (<30 Days)",
  "inv.fefo.good": "Good Standing",

  // Master Data & Unit Conversions
  "master.title": "Master Data & Unit Conversions",
  "master.subtitle": "Maintain categories, units of measure, and smart conversion formulas between procurement and recipes",
  "master.tab.categories": "Categories",
  "master.tab.units": "Units of Measure (UOM)",
  "master.tab.conversions": "Smart Unit Conversions",
  "master.tab.roles": "Role Capabilities Matrix",
  "master.btn.add_category": "+ New Category",
  "master.btn.add_unit": "+ New Unit",
  "master.btn.add_conversion": "+ New Conversion Rule",
  "master.calc.title": "Instant Unit Converter",
  "master.calc.from": "From Unit",
  "master.calc.to": "To Unit",
  "master.calc.qty": "Quantity",
  "master.calc.result": "Converted Output",

  // Transfers Hub
  "trans.title": "Inter-Warehouse Transfers Hub",
  "trans.subtitle": "Multi-stage transfer pipeline: Requisition ➔ Authorization ➔ Dispatch ➔ In-Transit Tracking ➔ Receiving",
  "trans.tab.requisitions": "Transfer Requisitions",
  "trans.tab.orders": "Transfer Orders",
  "trans.tab.aging": "In-Transit Aging Board",
  "trans.btn.new_transfer": "+ Request Transfer",
  "trans.btn.dispatch": "Dispatch & Issue",
  "trans.btn.receive": "Confirm Receipt",
  "trans.col.from_wh": "Source Warehouse",
  "trans.col.to_wh": "Destination Warehouse",

  // Recipes & BOM
  "recipe.title": "Recipes & Bill of Materials (BOM)",
  "recipe.subtitle": "Kitchen prep BOMs, coffee formulations, dynamic yield scaling, and theoretical vs actual variance",
  "recipe.btn.new": "+ New Recipe",
  "recipe.scale": "Scale Batch Yield",
  "recipe.cost_per_serving": "Cost per Serving",
  "recipe.ingredients": "Standard Ingredients & Quantities",

  // Stocktaking
  "stocktake.title": "Stocktaking & Physical Counts",
  "stocktake.subtitle": "Blind cycle counts, full periodic audits, variance worksheets, and automated GL adjustment postings",
  "stocktake.btn.new": "+ Start Count Cycle",
  "stocktake.reconcile": "Reconcile Variances",
  "stocktake.book_qty": "Book Quantity",
  "stocktake.counted_qty": "Physical Count",
  "stocktake.variance": "Count Variance",

  // Finance & GL
  "fin.title": "Finance & General Ledger",
  "fin.subtitle": "Chart of accounts, cost center dimensions, automated inventory postings, and landed cost allocations",
  "fin.tab.coa": "Chart of Accounts",
  "fin.tab.cost_centers": "Cost Centers",
  "fin.tab.journal": "General Ledger Journal",
  "fin.tab.landed_cost": "Landed Cost Allocation",
  "fin.btn.new_account": "+ New GL Account",
  "fin.btn.new_entry": "+ Manual Journal Entry",
  "fin.btn.allocate_landed": "Allocate Landed Costs",

  // Security & Audit
  "sec.title": "Security, Users & Tamper-Evident Audit",
  "sec.subtitle": "User provisioning, multi-tenant RBAC permissions, and cryptographic SHA-256 audit chain verification",
  "sec.tab.users": "User Accounts",
  "sec.tab.roles": "Capabilities Matrix",
  "sec.tab.audit": "Audit Trail Logs",
  "sec.verify_chain": "🔍 Verify SHA-256 Cryptographic Chain",
  "sec.chain_valid": "Audit log chain is intact, valid, and cryptographically untampered",
  "sec.btn.new_user": "+ New User",

  // History & Diff
  "history.modal_title": "Cryptographic Revision History",
  "history.field": "Modified Field",
  "history.original": "Original (Before)",
  "history.new": "New (After)",
  "history.by": "By",
  "history.no_changes": "No field changes recorded for this action.",
  "history.hash": "Integrity Hash",
};

interface I18nContextType {
  lang: Language;
  setLang: (l: Language) => void;
  toggleLang: () => void;
  t: (key: string, fallback?: string) => string;
  isRtl: boolean;
  dir: "rtl" | "ltr";
}

const I18nContext = createContext<I18nContextType>({
  lang: "ar",
  setLang: () => {},
  toggleLang: () => {},
  t: (k, f) => f || k,
  isRtl: true,
  dir: "rtl",
});

const STORAGE_KEY = "ca_erp_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "en" || saved === "ar" ? saved : "ar";
  });

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };

  const toggleLang = () => {
    setLang(lang === "ar" ? "en" : "ar");
  };

  const isRtl = lang === "ar";
  const dir = isRtl ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
    if (isRtl) {
      document.body.classList.add("rtl");
    } else {
      document.body.classList.remove("rtl");
    }
  }, [lang, dir, isRtl]);

  const t = (key: string, fallback?: string): string => {
    const dict = lang === "ar" ? AR_TRANSLATIONS : EN_TRANSLATIONS;
    if (dict[key]) return dict[key];
    if (EN_TRANSLATIONS[key]) return EN_TRANSLATIONS[key];
    return fallback || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, t, isRtl, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, toggleLang, t } = useI18n();

  return (
    <button
      type="button"
      onClick={toggleLang}
      className={className || "btn ghost sm"}
      title={lang === "ar" ? "Switch to English" : "التحويل إلى اللغة العربية"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer",
        background: "rgba(217, 119, 6, 0.12)",
        color: "var(--amber-2, #d97706)",
        border: "1px solid rgba(217, 119, 6, 0.25)",
        transition: "all 0.2s ease",
      }}
    >
      <span style={{ fontSize: 15 }}>🌐</span>
      <span>{t("lang.toggle")}</span>
    </button>
  );
}
