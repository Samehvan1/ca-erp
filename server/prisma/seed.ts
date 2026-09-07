import { PrismaClient, ProjectScope, WarehouseType, Role, ItemScope, PaymentTerms, RecipeType, GlAccountType, CostCenterLevel, ReportFrequency, ValuationMethod } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Capital Agro ERP...");

  // ---------- Projects ----------
  const fanshy = await prisma.project.upsert({
    where: { code: "FANSHY" },
    update: {},
    create: { code: "FANSHY", name: "Fanshy", scope: ProjectScope.FANSHY, description: "Restaurant Brand - Outlets, Kitchens & Project Central Warehouse" },
  });
  const osta = await prisma.project.upsert({
    where: { code: "OSTA" },
    update: {},
    create: { code: "OSTA", name: "Osta Rosto", scope: ProjectScope.OSTA_ROSTO, description: "Restaurant Brand - Outlets, Grill Depots & Project Central Warehouse" },
  });
  const spacca = await prisma.project.upsert({
    where: { code: "SPACCA" },
    update: {},
    create: { code: "SPACCA", name: "Spacca", scope: ProjectScope.SPACCA, description: "Coffee Shop Brand - Specialty Outlets & Roaster Central Warehouse" },
  });
  const group = await prisma.project.upsert({
    where: { code: "GROUP" },
    update: {},
    create: { code: "GROUP", name: "Capital Agro Group", scope: ProjectScope.GROUP, description: "Group Holding Level", isGroup: true },
  });

  // ---------- Warehouses ----------
  const whData = [
    { code: "PCW-FSH", name: "Fanshy Central Depot", type: WarehouseType.PROJECT_CENTRAL, projectId: fanshy.id, owner: "Fanshy Logistics & Kitchen Team", address: "15 Industrial Area, 6th of October", city: "Giza", country: "Egypt" },
    { code: "PCW-OST", name: "Osta Rosto Central Kitchen Depot", type: WarehouseType.PROJECT_CENTRAL, projectId: osta.id, owner: "Osta Rosto Meat & Prep Team", address: "27 Obour Buildings, Nasr City", city: "Cairo", country: "Egypt" },
    { code: "PCW-SPC", name: "Spacca Roastery & Central Store", type: WarehouseType.PROJECT_CENTRAL, projectId: spacca.id, owner: "Spacca Coffee Roasting Team", address: "8 Maadi El-Sadis, Maadi", city: "Cairo", country: "Egypt" },
    { code: "GCW-01", name: "Group Shared Commodity Hub", type: WarehouseType.GROUP_CENTRAL, projectId: group.id, owner: "Holding Central Procurement", address: "55 Smart Village, Bourj Al Arab", city: "Alexandria", country: "Egypt" },
    { code: "FSH-KIT-01", name: "Fanshy Branch 1 Kitchen Store", type: WarehouseType.BRANCH, projectId: fanshy.id, owner: "Branch Head Chef", address: "32 Tahrir Street, Downtown", city: "Cairo", country: "Egypt" },
    { code: "SPC-BAR-01", name: "Spacca Branch 1 Barista Counter", type: WarehouseType.BRANCH, projectId: spacca.id, owner: "Head Barista", address: "10 Korba, Heliopolis", city: "Cairo", country: "Egypt" },
    { code: "TRN-99", name: "In-Transit Virtual Transfer Hub", type: WarehouseType.TRANSIT, projectId: group.id, owner: "Logistics & Delivery Drivers" },
  ];
  const warehouses: Record<string, number> = {};
  for (const w of whData) {
    const rec = await prisma.warehouse.upsert({ where: { code: w.code }, update: { address: w.address, city: w.city, country: w.country }, create: w });
    warehouses[w.code] = rec.id;
  }

  // ---------- Users ----------
  const passwordHash = await bcrypt.hash("Admin@123", 10);
  const usersData = [
    { email: "admin@capitalagro.com", name: "System Admin", role: Role.ADMIN, projectId: group.id },
    { email: "cfo@capitalagro.com", name: "Ahmed Hassan", role: Role.CFO, projectId: group.id },
    { email: "exec@capitalagro.com", name: "Group Executive", role: Role.GROUP_EXECUTIVE, projectId: group.id },
    { email: "procurement@capitalagro.com", name: "Mona Saleh", role: Role.PROCUREMENT_OFFICER, projectId: group.id },
    { email: "wm.fanshy@capitalagro.com", name: "Karim Fawzy", role: Role.PROJECT_WAREHOUSE_MANAGER, projectId: fanshy.id },
    { email: "wm.osta@capitalagro.com", name: "Omar Nabil", role: Role.PROJECT_WAREHOUSE_MANAGER, projectId: osta.id },
    { email: "wm.spacca@capitalagro.com", name: "Laila Mostafa", role: Role.PROJECT_WAREHOUSE_MANAGER, projectId: spacca.id },
    { email: "bm.fanshy@capitalagro.com", name: "Hany Adel", role: Role.BRANCH_MANAGER, projectId: fanshy.id },
    { email: "chef.fanshy@capitalagro.com", name: "Chef Tarek", role: Role.HEAD_CHEF, projectId: fanshy.id },
    { email: "barista.spacca@capitalagro.com", name: "Barista Sara", role: Role.HEAD_BARISTA, projectId: spacca.id },
    { email: "cost@capitalagro.com", name: "Dina Kamal", role: Role.COST_CONTROLLER, projectId: group.id },
  ];
  const users: Record<string, number> = {};
  for (const u of usersData) {
    const rec = await prisma.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, passwordHash } });
    users[u.email] = rec.id;
  }

  // ---------- GL Accounts ----------
  const glData = [
    { code: "1000", name: "Inventory", type: GlAccountType.ASSET },
    { code: "2000", name: "GRNI (Goods Received Not Invoiced)", type: GlAccountType.LIABILITY },
    { code: "5000", name: "COGS", type: GlAccountType.EXPENSE },
    { code: "5100", name: "Waste Write-off", type: GlAccountType.EXPENSE },
    { code: "5200", name: "Freight & Customs", type: GlAccountType.EXPENSE },
    { code: "3000", name: "Accounts Payable", type: GlAccountType.LIABILITY },
    { code: "4000", name: "Sales Revenue", type: GlAccountType.REVENUE },
  ];
  for (const g of glData) {
    await prisma.glAccount.upsert({ where: { code: g.code }, update: {}, create: g });
  }

  // ---------- Cost Centers ----------
  const ccData = [
    { code: "CC-HOLD", name: "Holding", level: CostCenterLevel.HOLDING },
    { code: "CC-FSH", name: "Fanshy Project", level: CostCenterLevel.PROJECT, projectId: fanshy.id },
    { code: "CC-OST", name: "Osta Rosto Project", level: CostCenterLevel.PROJECT, projectId: osta.id },
    { code: "CC-SPC", name: "Spacca Project", level: CostCenterLevel.PROJECT, projectId: spacca.id },
    { code: "CC-FSH-PCW", name: "Fanshy Central Depot", level: CostCenterLevel.WAREHOUSE, projectId: fanshy.id, warehouseId: warehouses["PCW-FSH"] },
    { code: "CC-OST-PCW", name: "Osta Central Depot", level: CostCenterLevel.WAREHOUSE, projectId: osta.id, warehouseId: warehouses["PCW-OST"] },
    { code: "CC-SPC-PCW", name: "Spacca Roastery", level: CostCenterLevel.WAREHOUSE, projectId: spacca.id, warehouseId: warehouses["PCW-SPC"] },
    { code: "CC-GCW", name: "Group Commodity Hub", level: CostCenterLevel.WAREHOUSE, projectId: group.id, warehouseId: warehouses["GCW-01"] },
  ];
  for (const c of ccData) {
    await prisma.costCenter.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  // ---------- Items & Brand Variants ----------
  const itemData = [
    { code: "RM-MLK-01", description: "Full Cream Milk 1L", scope: ItemScope.CROSS_PROJECT, category: "Dairy", valuationMethod: ValuationMethod.WAC, abcClass: "A", uom: "Each", brands: ["Juhayna Full Cream 1L", "Dina-Farms Full Cream 1L", "Lamar Full Cream 1L"] },
    { code: "RM-SGR-01", description: "Refined White Sugar 25Kg", scope: ItemScope.CROSS_PROJECT, category: "Dry Goods", valuationMethod: ValuationMethod.WAC, abcClass: "B", uom: "Bag", brands: ["Al-Doha Sugar 25Kg", "Savola Sugar 25Kg"] },
    { code: "FSH-SPC-09", description: "Fanshy Special Marination Spice", scope: ItemScope.PROJECT_ISOLATED, projectId: fanshy.id, category: "Spices", valuationMethod: ValuationMethod.WAC, abcClass: "C", uom: "Kg", brands: ["Fanshy In-House Blend"] },
    { code: "SPC-CB-01", description: "Spacca Specialty Green Coffee", scope: ItemScope.PROJECT_ISOLATED, projectId: spacca.id, category: "Coffee", valuationMethod: ValuationMethod.WAC, abcClass: "A", uom: "Kg", brands: ["Ethiopia Yirgacheffe", "Colombia Supremo"] },
    { code: "OST-CHK-01", description: "Whole Fresh Chicken 1.2Kg", scope: ItemScope.CROSS_PROJECT, category: "Poultry", valuationMethod: ValuationMethod.FIFO, abcClass: "A", uom: "Each", brands: ["National Poultry 1.2Kg", "El-Dahry 1.2Kg"] },
  ];
  const items: Record<string, number> = {};
  for (const it of itemData) {
    const { brands, ...rest } = it;
    const item = await prisma.item.upsert({ where: { code: it.code }, update: { uom: rest.uom }, create: rest });
    items[it.code] = item.id;
    for (const b of brands) {
      const sku = `${it.code}-${b.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase()}`;
      await prisma.brandVariant.upsert({ where: { sku }, update: {}, create: { itemId: item.id, name: b, sku, barcode: `20${sku}` } });
    }
  }

  // ---------- Vendors ----------
  const vendorData = [
    { code: "V-001", name: "Distributor A", registrationNo: "REG-1001", taxId: "TAX-1001", bankDetails: "NBE 123456789", paymentTerms: PaymentTerms.NET_30, supplyCategories: ["Dairy"], taxType: "VAT", taxRate: 14 },
    { code: "V-002", name: "Distributor B", registrationNo: "REG-1002", taxId: "TAX-1002", bankDetails: "CIB 987654321", paymentTerms: PaymentTerms.NET_60, supplyCategories: ["Dairy"], taxType: "VAT", taxRate: 14 },
    { code: "V-003", name: "Group Commodities Co.", registrationNo: "REG-1003", taxId: "TAX-1003", bankDetails: "QNB 555666777", paymentTerms: PaymentTerms.NET_90, supplyCategories: ["Dry Goods"], taxType: "VAT", taxRate: 14 },
    { code: "V-004", name: "Local Trader X", registrationNo: "REG-1004", taxId: "TAX-1004", bankDetails: "AAIB 111222333", paymentTerms: PaymentTerms.COD, supplyCategories: ["Dry Goods"], taxType: "No Tax", taxRate: 0 },
    { code: "V-005", name: "Specialty Spice Supplier Z", registrationNo: "REG-1005", taxId: "TAX-1005", bankDetails: "HSBC 444555666", paymentTerms: PaymentTerms.NET_30, supplyCategories: ["Spices"], taxType: "VAT", taxRate: 14 },
    { code: "V-006", name: "Direct Coffee Importer M", registrationNo: "REG-1006", taxId: "TAX-1006", bankDetails: "CBE 777888999", paymentTerms: PaymentTerms.NET_60, supplyCategories: ["Coffee"], taxType: "VAT", taxRate: 14 },
    { code: "V-007", name: "Poultry Supplier K", registrationNo: "REG-1007", taxId: "TAX-1007", bankDetails: "NBE 222333444", paymentTerms: PaymentTerms.NET_30, supplyCategories: ["Poultry"], taxType: "No Tax", taxRate: 0 },
    { code: "V-008", name: "Supplier L", registrationNo: "REG-1008", taxId: "TAX-1008", bankDetails: "CIB 333444555", paymentTerms: PaymentTerms.NET_30, supplyCategories: ["Poultry"], taxType: "VAT", taxRate: 14 },
  ];
  const vendors: Record<string, number> = {};
  for (const v of vendorData) {
    const rec = await prisma.vendor.upsert({ where: { code: v.code }, update: { taxType: v.taxType, taxRate: v.taxRate }, create: { ...v, supplyCategories: v.supplyCategories } });
    vendors[v.code] = rec.id;
  }

  // ---------- Vendor-Item / Vendor-Brand mappings ----------
  const milkBrands = await prisma.brandVariant.findMany({ where: { itemId: items["RM-MLK-01"] } });
  const sugarBrands = await prisma.brandVariant.findMany({ where: { itemId: items["RM-SGR-01"] } });
  const chickenBrands = await prisma.brandVariant.findMany({ where: { itemId: items["OST-CHK-01"] } });
  const spiceBrands = await prisma.brandVariant.findMany({ where: { itemId: items["FSH-SPC-09"] } });
  const coffeeBrands = await prisma.brandVariant.findMany({ where: { itemId: items["SPC-CB-01"] } });

  // Generic item level mappings
  await prisma.vendorItem.createMany({ data: [
    { vendorId: vendors["V-001"], itemId: items["RM-MLK-01"] },
    { vendorId: vendors["V-002"], itemId: items["RM-MLK-01"] },
    { vendorId: vendors["V-003"], itemId: items["RM-SGR-01"] },
    { vendorId: vendors["V-004"], itemId: items["RM-SGR-01"] },
    { vendorId: vendors["V-005"], itemId: items["FSH-SPC-09"] },
    { vendorId: vendors["V-006"], itemId: items["SPC-CB-01"] },
    { vendorId: vendors["V-007"], itemId: items["OST-CHK-01"] },
    { vendorId: vendors["V-008"], itemId: items["OST-CHK-01"] },
  ] });

  // Brand variant level mappings (exclusive distributors)
  const dina = milkBrands.find((b) => b.name.includes("Dina"));
  const juhayna = milkBrands.find((b) => b.name.includes("Juhayna"));
  const yirga = coffeeBrands.find((b) => b.name.includes("Yirgacheffe"));
  if (dina) await prisma.vendorBrandVariant.createMany({ data: [{ vendorId: vendors["V-002"], brandVariantId: dina.id, isExclusive: true }] });
  if (juhayna) await prisma.vendorBrandVariant.createMany({ data: [{ vendorId: vendors["V-001"], brandVariantId: juhayna.id, isExclusive: true }] });
  if (yirga) await prisma.vendorBrandVariant.createMany({ data: [{ vendorId: vendors["V-006"], brandVariantId: yirga.id, isExclusive: true }] });

  // ---------- Price Lists ----------
  const now = new Date();
  const future = new Date(now.getTime() + 365 * 24 * 3600 * 1000);
  const priceData: { vendorId: number; brandVariantId: number; unitPrice: number; moq: number }[] = [];
  for (const b of milkBrands) {
    const vendorId = b.name.includes("Dina") ? vendors["V-002"] : vendors["V-001"];
    priceData.push({ vendorId, brandVariantId: b.id, unitPrice: 42, moq: 24 });
  }
  for (const b of sugarBrands) priceData.push({ vendorId: vendors["V-003"], brandVariantId: b.id, unitPrice: 780, moq: 10 });
  for (const b of spiceBrands) priceData.push({ vendorId: vendors["V-005"], brandVariantId: b.id, unitPrice: 320, moq: 5 });
  for (const b of coffeeBrands) priceData.push({ vendorId: vendors["V-006"], brandVariantId: b.id, unitPrice: 540, moq: 20 });
  for (const b of chickenBrands) priceData.push({ vendorId: vendors["V-007"], brandVariantId: b.id, unitPrice: 95, moq: 50 });
  for (const p of priceData) {
    const pl = await prisma.priceList.create({ data: { ...p, validFrom: now, validTo: future } });
    await prisma.priceTier.createMany({ data: [
      { priceListId: pl.id, minQty: p.moq, discountPct: 0 },
      { priceListId: pl.id, minQty: p.moq * 5, discountPct: 3 },
      { priceListId: pl.id, minQty: p.moq * 20, discountPct: 7 },
    ] });
  }

  // ---------- Recipes ----------
  const recipeData = [
    { code: "RCP-FSH-001", name: "Fanshy Grilled Chicken", projectId: fanshy.id, type: RecipeType.MENU_ITEM, items: [{ itemId: items["OST-CHK-01"], quantity: 1, yieldFactor: 0.85, shrinkagePct: 15 }, { itemId: items["FSH-SPC-09"], quantity: 0.02, yieldFactor: 1, shrinkagePct: 0 }] },
    { code: "RCP-SPC-001", name: "Spacca Espresso Blend", projectId: spacca.id, type: RecipeType.PREP, items: [{ itemId: items["SPC-CB-01"], quantity: 1, yieldFactor: 0.82, shrinkagePct: 18 }] },
    { code: "RCP-SPC-002", name: "Spacca Cappuccino", projectId: spacca.id, type: RecipeType.MENU_ITEM, items: [{ itemId: items["SPC-CB-01"], quantity: 0.018, yieldFactor: 1, shrinkagePct: 0 }, { itemId: items["RM-MLK-01"], quantity: 0.15, yieldFactor: 1, shrinkagePct: 0 }] },
  ];
for (const r of recipeData) {
    const { items, ...rest } = r;
    const recipe = await prisma.recipe.upsert({ where: { code_version: { code: r.code, version: 1 } }, update: {}, create: rest });
    for (const ri of items) {
      await prisma.recipeItem.create({ data: { ...ri, recipeId: recipe.id } });
    }
  }

  // ---------- POS Terminals ----------
  const posData = [
    { code: "POS-FSH-01", name: "Fanshy Branch 1 POS", posSystem: "LegacyPOS v3", projectId: fanshy.id },
    { code: "POS-SPC-01", name: "Spacca Branch 1 POS", posSystem: "CoffeePOS Pro", projectId: spacca.id },
    { code: "POS-OST-01", name: "Osta Rosto POS", posSystem: "GrillPOS", projectId: osta.id },
  ];
  for (const p of posData) {
    await prisma.posTerminal.upsert({ where: { code: p.code }, update: {}, create: p });
  }

  // ---------- Menu Mappings ----------
  const posFsh = await prisma.posTerminal.findUnique({ where: { code: "POS-FSH-01" } });
  const posSpc = await prisma.posTerminal.findUnique({ where: { code: "POS-SPC-01" } });
  if (posFsh) {
    await prisma.menuMapping.createMany({ data: [
      { posMenuId: "MENU-GRILL-CHICKEN", terminalId: posFsh.id, itemId: items["OST-CHK-01"] },
      { posMenuId: "MENU-MILK", terminalId: posFsh.id, itemId: items["RM-MLK-01"] },
    ] });
  }
  if (posSpc) {
    await prisma.menuMapping.createMany({ data: [
      { posMenuId: "MENU-CAPPUCCINO", terminalId: posSpc.id, itemId: items["SPC-CB-01"] },
      { posMenuId: "MENU-MILK", terminalId: posSpc.id, itemId: items["RM-MLK-01"] },
    ] });
  }

  // ---------- Report Definitions ----------
  const reportData = [
    { code: "STOCK-VALUATION", name: "Project Stock Valuation Ledger", audience: "CFO, Project Finance", frequency: ReportFrequency.MONTHLY },
    { code: "VARIANCE", name: "Theoretical vs Actual Variance", audience: "F&B Leads, Cost Controller", frequency: ReportFrequency.DAILY },
    { code: "PO-OPEN-BALANCE", name: "PO Open Balance & Partial Receipts", audience: "Procurement Manager", frequency: ReportFrequency.REAL_TIME },
    { code: "SUPPLIER-AP", name: "Supplier AP & Partial Payments", audience: "Accounts Payable Lead", frequency: ReportFrequency.WEEKLY },
    { code: "STOCK-AGING", name: "Stock Aging & Expiration Risk", audience: "Warehouse & Store Managers", frequency: ReportFrequency.DAILY },
    { code: "VENDOR-SLA", name: "Vendor SLA & Performance", audience: "Procurement Manager", frequency: ReportFrequency.MONTHLY },
    { code: "MENU-MARGIN", name: "Menu Item Margin & Recipe Cost", audience: "Brand Managers", frequency: ReportFrequency.REAL_TIME },
  ];
  for (const r of reportData) {
    await prisma.reportDefinition.upsert({ where: { code: r.code }, update: {}, create: r });
  }

  // ---------- Initial stock batches ----------
  const batchData = [
    { itemId: items["RM-MLK-01"], brandVariantId: milkBrands[0]?.id, batchNo: "B-MLK-001", expiryDate: new Date(now.getTime() + 20 * 24 * 3600 * 1000), quantity: 120, warehouseId: warehouses["PCW-FSH"] },
    { itemId: items["RM-MLK-01"], brandVariantId: milkBrands[1]?.id, batchNo: "B-MLK-002", expiryDate: new Date(now.getTime() + 45 * 24 * 3600 * 1000), quantity: 80, warehouseId: warehouses["PCW-FSH"] },
    { itemId: items["RM-SGR-01"], brandVariantId: sugarBrands[0]?.id, batchNo: "B-SGR-001", expiryDate: new Date(now.getTime() + 300 * 24 * 3600 * 1000), quantity: 40, warehouseId: warehouses["GCW-01"] },
    { itemId: items["SPC-CB-01"], brandVariantId: coffeeBrands[0]?.id, batchNo: "B-CB-001", expiryDate: new Date(now.getTime() + 180 * 24 * 3600 * 1000), quantity: 60, warehouseId: warehouses["PCW-SPC"] },
    { itemId: items["OST-CHK-01"], brandVariantId: chickenBrands[0]?.id, batchNo: "B-CHK-001", expiryDate: new Date(now.getTime() + 5 * 24 * 3600 * 1000), quantity: 200, warehouseId: warehouses["PCW-OST"] },
  ];
  for (const b of batchData) {
    const batch = await prisma.batch.create({ data: b });
    await prisma.stockLedger.create({
      data: { warehouseId: b.warehouseId, itemId: b.itemId, brandVariantId: b.brandVariantId, batchId: batch.id, qtyIn: b.quantity, balance: b.quantity, unitCost: 40, refType: "SEED" },
    });
  }

  // ---------- Reorder points ----------
  await prisma.reorderPoint.createMany({ data: [
    { itemId: items["RM-MLK-01"], warehouseId: warehouses["PCW-FSH"], safetyStock: 30, reorderPoint: 60, leadTimeDays: 3, consumptionVelocity: 20 },
    { itemId: items["OST-CHK-01"], warehouseId: warehouses["PCW-OST"], safetyStock: 50, reorderPoint: 100, leadTimeDays: 2, consumptionVelocity: 40 },
    { itemId: items["SPC-CB-01"], warehouseId: warehouses["PCW-SPC"], safetyStock: 20, reorderPoint: 40, leadTimeDays: 14, consumptionVelocity: 5 },
  ] });

  console.log("Seed complete.");
  console.log("Login: admin@capitalagro.com / Admin@123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
