import {
  PrismaClient,
  ProjectScope,
  WarehouseType,
  Role,
  ItemScope,
  PaymentTerms,
  RecipeType,
  GlAccountType,
  CostCenterLevel,
  ReportFrequency,
  ValuationMethod,
  RequisitionType,
  RequisitionStatus,
  ApprovalStatus,
  PoStatus,
  GrnStatus,
  InvoiceStatus,
  PaymentType,
  TransferStatus,
  StocktakeType,
  StocktakeStatus,
  AdjustmentReason,
  AdjustmentStatus,
  WasteStatus,
  PosTransactionStatus,
  ApEntryType,
  AuditAction,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

const DAY_MS = 24 * 3600 * 1000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY_MS);
const daysFromNow = (d: number) => new Date(Date.now() + d * DAY_MS);
const pad = (n: number, len = 3) => String(n).padStart(len, "0");

async function main() {
  console.log("Seeding Capital Agro ERP (comprehensive >=50 records per module)...");

  // ---------- 1. Projects ----------
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
  const projectList = [fanshy, osta, spacca, group];

  // ---------- 2. Warehouses ----------
  const whData = [
    { code: "PCW-FSH", name: "Fanshy Central Depot", type: WarehouseType.PROJECT_CENTRAL, projectId: fanshy.id, owner: "Fanshy Logistics & Kitchen Team", address: "15 Industrial Area, 6th of October", city: "Giza", country: "Egypt" },
    { code: "PCW-OST", name: "Osta Rosto Central Kitchen Depot", type: WarehouseType.PROJECT_CENTRAL, projectId: osta.id, owner: "Osta Rosto Meat & Prep Team", address: "27 Obour Buildings, Nasr City", city: "Cairo", country: "Egypt" },
    { code: "PCW-SPC", name: "Spacca Roastery & Central Store", type: WarehouseType.PROJECT_CENTRAL, projectId: spacca.id, owner: "Spacca Coffee Roasting Team", address: "8 Maadi El-Sadis, Maadi", city: "Cairo", country: "Egypt" },
    { code: "GCW-01", name: "Group Shared Commodity Hub", type: WarehouseType.GROUP_CENTRAL, projectId: group.id, owner: "Holding Central Procurement", address: "55 Smart Village, Bourj Al Arab", city: "Alexandria", country: "Egypt" },
    { code: "FSH-KIT-01", name: "Fanshy Branch 1 Kitchen Store", type: WarehouseType.BRANCH, projectId: fanshy.id, owner: "Branch Head Chef", address: "32 Tahrir Street, Downtown", city: "Cairo", country: "Egypt" },
    { code: "OST-GRL-01", name: "Osta Rosto Branch 1 Grill Store", type: WarehouseType.BRANCH, projectId: osta.id, owner: "Grill Supervisor", address: "14 Abbas El-Akkad, Nasr City", city: "Cairo", country: "Egypt" },
    { code: "SPC-BAR-01", name: "Spacca Branch 1 Barista Counter", type: WarehouseType.BRANCH, projectId: spacca.id, owner: "Head Barista", address: "10 Korba, Heliopolis", city: "Cairo", country: "Egypt" },
    { code: "TRN-99", name: "In-Transit Virtual Transfer Hub", type: WarehouseType.TRANSIT, projectId: group.id, owner: "Logistics & Delivery Drivers" },
  ];
  const warehouses: Record<string, number> = {};
  for (const w of whData) {
    const rec = await prisma.warehouse.upsert({ where: { code: w.code }, update: { address: w.address, city: w.city, country: w.country }, create: w });
    warehouses[w.code] = rec.id;
  }
  const activeWhIds = [
    warehouses["PCW-FSH"],
    warehouses["PCW-OST"],
    warehouses["PCW-SPC"],
    warehouses["GCW-01"],
    warehouses["FSH-KIT-01"],
    warehouses["OST-GRL-01"],
    warehouses["SPC-BAR-01"],
  ];

  // ---------- 3. Users ----------
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
  const userIds = Object.values(users);

  // ---------- 4. GL Accounts & Cost Centers ----------
  const glData = [
    { code: "1000", name: "Inventory", type: GlAccountType.ASSET },
    { code: "2000", name: "GRNI (Goods Received Not Invoiced)", type: GlAccountType.LIABILITY },
    { code: "5000", name: "COGS", type: GlAccountType.EXPENSE },
    { code: "5100", name: "Waste Write-off", type: GlAccountType.EXPENSE },
    { code: "5200", name: "Freight & Customs", type: GlAccountType.EXPENSE },
    { code: "3000", name: "Accounts Payable", type: GlAccountType.LIABILITY },
    { code: "4000", name: "Sales Revenue", type: GlAccountType.REVENUE },
  ];
  const glAccounts: Record<string, number> = {};
  for (const g of glData) {
    const rec = await prisma.glAccount.upsert({ where: { code: g.code }, update: {}, create: g });
    glAccounts[g.code] = rec.id;
  }

  const ccData = [
    { code: "CC-HOLD", name: "Holding", level: CostCenterLevel.HOLDING, projectId: group.id },
    { code: "CC-FSH", name: "Fanshy Project", level: CostCenterLevel.PROJECT, projectId: fanshy.id },
    { code: "CC-OST", name: "Osta Rosto Project", level: CostCenterLevel.PROJECT, projectId: osta.id },
    { code: "CC-SPC", name: "Spacca Project", level: CostCenterLevel.PROJECT, projectId: spacca.id },
    { code: "CC-FSH-PCW", name: "Fanshy Central Depot", level: CostCenterLevel.WAREHOUSE, projectId: fanshy.id, warehouseId: warehouses["PCW-FSH"] },
    { code: "CC-OST-PCW", name: "Osta Central Depot", level: CostCenterLevel.WAREHOUSE, projectId: osta.id, warehouseId: warehouses["PCW-OST"] },
    { code: "CC-SPC-PCW", name: "Spacca Roastery", level: CostCenterLevel.WAREHOUSE, projectId: spacca.id, warehouseId: warehouses["PCW-SPC"] },
    { code: "CC-GCW", name: "Group Commodity Hub", level: CostCenterLevel.WAREHOUSE, projectId: group.id, warehouseId: warehouses["GCW-01"] },
  ];
  const costCenters: Record<string, number> = {};
  for (const c of ccData) {
    const rec = await prisma.costCenter.upsert({ where: { code: c.code }, update: {}, create: c });
    costCenters[c.code] = rec.id;
  }
  const ccIds = Object.values(costCenters);

  // ---------- 5. Categories & Units of Measure ----------
  const catData = [
    { code: "CAT-DAIRY", name: "Dairy & Milk", defaultValuationMethod: ValuationMethod.WAC, taxRatePct: 14 },
    { code: "CAT-BEV", name: "Coffee & Beverages", defaultValuationMethod: ValuationMethod.WAC, taxRatePct: 14 },
    { code: "CAT-GRAIN", name: "Bakery & Dry Goods", defaultValuationMethod: ValuationMethod.WAC, taxRatePct: 14 },
    { code: "CAT-MEAT", name: "Meats & Poultry", defaultValuationMethod: ValuationMethod.FIFO, taxRatePct: 14 },
    { code: "CAT-SPICE", name: "Spices & Seasonings", defaultValuationMethod: ValuationMethod.WAC, taxRatePct: 14 },
    { code: "CAT-PACK", name: "Packaging & Disposables", defaultValuationMethod: ValuationMethod.WAC, taxRatePct: 14 },
    { code: "CAT-CHEM", name: "Cleaning & Chemicals", defaultValuationMethod: ValuationMethod.WAC, taxRatePct: 14 },
  ];
  const categories: Record<string, number> = {};
  for (const c of catData) {
    const cat = await prisma.category.upsert({ where: { code: c.code }, update: { name: c.name, defaultValuationMethod: c.defaultValuationMethod, taxRatePct: c.taxRatePct }, create: c });
    categories[c.code] = cat.id;
  }

  const uomData = [
    { code: "KG", name: "Kilogram", symbol: "kg", dimension: "MASS" as const, isBaseUnit: true },
    { code: "G", name: "Gram", symbol: "g", dimension: "MASS" as const, isBaseUnit: false },
    { code: "MG", name: "Milligram", symbol: "mg", dimension: "MASS" as const, isBaseUnit: false },
    { code: "L", name: "Liter", symbol: "L", dimension: "VOLUME" as const, isBaseUnit: true },
    { code: "ML", name: "Milliliter", symbol: "ml", dimension: "VOLUME" as const, isBaseUnit: false },
    { code: "PCS", name: "Pieces / Units", symbol: "pcs", dimension: "COUNT" as const, isBaseUnit: true },
    { code: "BOX", name: "Box", symbol: "box", dimension: "COUNT" as const, isBaseUnit: false },
    { code: "PACK", name: "Pack", symbol: "pk", dimension: "COUNT" as const, isBaseUnit: false },
    { code: "BAG", name: "Bag / Sack", symbol: "bag", dimension: "COUNT" as const, isBaseUnit: false },
    { code: "CRATE", name: "Crate", symbol: "crate", dimension: "COUNT" as const, isBaseUnit: false },
    { code: "BOTTLE", name: "Bottle", symbol: "btl", dimension: "COUNT" as const, isBaseUnit: false },
    { code: "CAN", name: "Can", symbol: "can", dimension: "COUNT" as const, isBaseUnit: false },
  ];
  const uoms: Record<string, number> = {};
  for (const u of uomData) {
    const uomRec = await prisma.unitOfMeasure.upsert({ where: { code: u.code }, update: { name: u.name, symbol: u.symbol, dimension: u.dimension, isBaseUnit: u.isBaseUnit }, create: u });
    uoms[u.code] = uomRec.id;
  }

  const stdConversions = [
    { from: "KG", to: "G", factor: 1000 },
    { from: "G", to: "KG", factor: 0.001 },
    { from: "G", to: "MG", factor: 1000 },
    { from: "MG", to: "G", factor: 0.001 },
    { from: "L", to: "ML", factor: 1000 },
    { from: "ML", to: "L", factor: 0.001 },
  ];
  for (const sc of stdConversions) {
    const fromId = uoms[sc.from];
    const toId = uoms[sc.to];
    if (fromId && toId) {
      const existing = await prisma.unitConversion.findFirst({ where: { fromUnitId: fromId, toUnitId: toId, itemId: null } });
      if (!existing) {
        await prisma.unitConversion.create({ data: { fromUnitId: fromId, toUnitId: toId, factor: sc.factor } });
      }
    }
  }

  // ---------- 6. Items & Brand Variants (>= 52 items) ----------
  const baseItems = [
    { code: "RM-MLK-01", description: "Full Cream Milk 1L", scope: ItemScope.CROSS_PROJECT, category: "Dairy & Milk", categoryId: categories["CAT-DAIRY"], valuationMethod: ValuationMethod.WAC, abcClass: "A", uom: "L", brands: ["Juhayna Full Cream 1L", "Dina-Farms Full Cream 1L", "Lamar Full Cream 1L"] },
    { code: "RM-SGR-01", description: "Refined White Sugar 25Kg", scope: ItemScope.CROSS_PROJECT, category: "Bakery & Dry Goods", categoryId: categories["CAT-GRAIN"], valuationMethod: ValuationMethod.WAC, abcClass: "B", uom: "Bag", brands: ["Al-Doha Sugar 25Kg", "Savola Sugar 25Kg"] },
    { code: "FSH-SPC-09", description: "Fanshy Special Marination Spice", scope: ItemScope.PROJECT_ISOLATED, projectId: fanshy.id, category: "Spices & Seasonings", categoryId: categories["CAT-SPICE"], valuationMethod: ValuationMethod.WAC, abcClass: "C", uom: "Kg", brands: ["Fanshy In-House Blend"] },
    { code: "SPC-CB-01", description: "Spacca Specialty Green Coffee", scope: ItemScope.PROJECT_ISOLATED, projectId: spacca.id, category: "Coffee & Beverages", categoryId: categories["CAT-BEV"], valuationMethod: ValuationMethod.WAC, abcClass: "A", uom: "Kg", brands: ["Ethiopia Yirgacheffe", "Colombia Supremo"] },
    { code: "OST-CHK-01", description: "Whole Fresh Chicken 1.2Kg", scope: ItemScope.CROSS_PROJECT, category: "Meats & Poultry", categoryId: categories["CAT-MEAT"], valuationMethod: ValuationMethod.FIFO, abcClass: "A", uom: "Pcs", brands: ["National Poultry 1.2Kg", "El-Dahry 1.2Kg"] },
  ];

  const catKeys = Object.keys(categories);
  const catNames = ["Dairy & Milk", "Coffee & Beverages", "Bakery & Dry Goods", "Meats & Poultry", "Spices & Seasonings", "Packaging & Disposables", "Cleaning & Chemicals"];
  const extraItemNames = [
    "Skimmed Milk 1L", "Heavy Cooking Cream 1L", "Mozzarella Block 2Kg", "Cheddar Slices 1Kg", "Unsalted Butter 5Kg",
    "Arabica Dark Roast Beans", "Robusta Espresso Beans", "Matcha Ceremonial Powder", "Caramel Syrup 750ml", "Vanilla Syrup 750ml",
    "Hazelnut Syrup 750ml", "All-Purpose Flour 25Kg", "Brioche Burger Buns 24pk", "Basmati Rice 20Kg", "Extra Virgin Olive Oil 5L",
    "Sunflower Frying Oil 20L", "Beef Chuck Roll 5Kg", "Angus Brisket 4Kg", "Chicken Breast Fillet 5Kg", "Smoked Turkey Breast 2Kg",
    "Beef Bacon Slices 1Kg", "Black Pepper Whole 1Kg", "Smoked Paprika 1Kg", "Garlic Powder 1Kg", "Oregano Dried 500g",
    "Sea Salt Fine 5Kg", "12oz Double-Wall Paper Cup", "8oz Espresso Cup", "Cup Lids 90mm Black", "Kraft Takeaway Bag Medium",
    "Burger Wrap Greaseproof", "Food-Grade Sanitizer 5L", "Degreaser Heavy Duty 5L", "Dishwasher Detergent 10L", "Oat Milk Barista 1L",
    "Almond Milk Unsweetened 1L", "Whipped Cream Charger Box", "Dark Chocolate Sauce 2Kg", "White Chocolate Powder 1Kg", "Chai Tea Concentrate 1L",
    "Tomato Paste Concentrate 3Kg", "Mayonnaise Catering Tub 4Kg", "Mustard Dijon 2Kg", "Pickled Jalapeno Sliced 3Kg", "Parmesan Grated 1Kg",
    "Ice Cubes Food-Grade 10Kg", "Sparkling Water 330ml Case", "Cold Brew Bottle 250ml",
  ];

  const allItemSeeds = [
    ...baseItems,
    ...extraItemNames.map((desc, idx) => {
      const catIdx = idx % catKeys.length;
      const scope = idx % 3 === 0 ? ItemScope.PROJECT_ISOLATED : ItemScope.CROSS_PROJECT;
      const proj = scope === ItemScope.PROJECT_ISOLATED ? projectList[idx % 3].id : undefined;
      const abc = idx % 5 === 0 ? "A" : idx % 3 === 0 ? "B" : "C";
      const valMethod = catIdx === 3 || catIdx === 0 ? ValuationMethod.FIFO : ValuationMethod.WAC;
      return {
        code: `INV-${pad(idx + 10)}`,
        description: desc,
        scope,
        projectId: proj,
        category: catNames[catIdx],
        categoryId: categories[catKeys[catIdx]],
        valuationMethod: valMethod,
        abcClass: abc,
        uom: catIdx === 0 || catIdx === 6 ? "L" : catIdx === 5 ? "Box" : "Kg",
        brands: [`${desc.split(" ")[0]} Prime`, `${desc.split(" ")[0]} Select`],
      };
    }),
  ];

  const items: Record<string, number> = {};
  const itemIds: number[] = [];
  const brandIdsByItem: Record<number, number[]> = {};

  for (const it of allItemSeeds) {
    const { brands, ...rest } = it;
    const item = await prisma.item.upsert({
      where: { code: it.code },
      update: { categoryId: rest.categoryId, abcClass: rest.abcClass, valuationMethod: rest.valuationMethod },
      create: rest,
    });
    items[it.code] = item.id;
    itemIds.push(item.id);
    brandIdsByItem[item.id] = [];
    for (const b of brands) {
      const sku = `${it.code}-${b.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase()}`;
      const bv = await prisma.brandVariant.upsert({
        where: { sku },
        update: {},
        create: { itemId: item.id, name: b, sku, barcode: `20${sku}` },
      });
      brandIdsByItem[item.id].push(bv.id);
    }
  }

  // ---------- 7. Vendors (>= 52 vendors) ----------
  const baseVendors = [
    { code: "V-001", name: "Distributor A (Dairy)", registrationNo: "REG-1001", taxId: "TAX-1001", bankDetails: "NBE 123456789", paymentTerms: PaymentTerms.NET_30, supplyCategories: ["Dairy & Milk"], taxType: "VAT", taxRate: 14 },
    { code: "V-002", name: "Distributor B (Fresh)", registrationNo: "REG-1002", taxId: "TAX-1002", bankDetails: "CIB 987654321", paymentTerms: PaymentTerms.NET_60, supplyCategories: ["Dairy & Milk"], taxType: "VAT", taxRate: 14 },
    { code: "V-003", name: "Group Commodities Co.", registrationNo: "REG-1003", taxId: "TAX-1003", bankDetails: "QNB 555666777", paymentTerms: PaymentTerms.NET_90, supplyCategories: ["Bakery & Dry Goods"], taxType: "VAT", taxRate: 14 },
    { code: "V-004", name: "Local Trader X", registrationNo: "REG-1004", taxId: "TAX-1004", bankDetails: "AAIB 111222333", paymentTerms: PaymentTerms.COD, supplyCategories: ["Bakery & Dry Goods"], taxType: "No Tax", taxRate: 0 },
    { code: "V-005", name: "Specialty Spice Supplier Z", registrationNo: "REG-1005", taxId: "TAX-1005", bankDetails: "HSBC 444555666", paymentTerms: PaymentTerms.NET_30, supplyCategories: ["Spices & Seasonings"], taxType: "VAT", taxRate: 14 },
    { code: "V-006", name: "Direct Coffee Importer M", registrationNo: "REG-1006", taxId: "TAX-1006", bankDetails: "CBE 777888999", paymentTerms: PaymentTerms.NET_60, supplyCategories: ["Coffee & Beverages"], taxType: "VAT", taxRate: 14 },
    { code: "V-007", name: "Poultry Supplier K", registrationNo: "REG-1007", taxId: "TAX-1007", bankDetails: "NBE 222333444", paymentTerms: PaymentTerms.NET_30, supplyCategories: ["Meats & Poultry"], taxType: "No Tax", taxRate: 0 },
    { code: "V-008", name: "Prime Meat Wholesaler L", registrationNo: "REG-1008", taxId: "TAX-1008", bankDetails: "CIB 333444555", paymentTerms: PaymentTerms.NET_30, supplyCategories: ["Meats & Poultry"], taxType: "VAT", taxRate: 14 },
  ];

  const paymentTermsArr = [PaymentTerms.COD, PaymentTerms.NET_30, PaymentTerms.NET_60, PaymentTerms.NET_90];
  const taxConfigs = [
    { taxType: "VAT", taxRate: 14 },
    { taxType: "VAT", taxRate: 5 },
    { taxType: "VAT", taxRate: 10 },
    { taxType: "No Tax", taxRate: 0 },
  ];

  const allVendors = [
    ...baseVendors,
    ...Array.from({ length: 44 }, (_, i) => {
      const idx = i + 9;
      const tc = taxConfigs[i % taxConfigs.length];
      return {
        code: `V-${pad(idx)}`,
        name: `Agro Supply Partner ${pad(idx)}`,
        registrationNo: `REG-${1000 + idx}`,
        taxId: `TAX-${1000 + idx}`,
        bankDetails: `NBE 9000${pad(idx, 5)}`,
        paymentTerms: paymentTermsArr[i % paymentTermsArr.length],
        supplyCategories: [catNames[i % catNames.length]],
        taxType: tc.taxType,
        taxRate: tc.taxRate,
      };
    }),
  ];

  const vendors: Record<string, number> = {};
  const vendorIds: number[] = [];
  for (const v of allVendors) {
    const rec = await prisma.vendor.upsert({
      where: { code: v.code },
      update: { taxType: v.taxType, taxRate: v.taxRate },
      create: { ...v, supplyCategories: v.supplyCategories },
    });
    vendors[v.code] = rec.id;
    vendorIds.push(rec.id);
  }

  // ---------- 8. Vendor Items, Price Lists & Vendor SLAs (>= 55 each) ----------
  const vendorItemPairs = itemIds.map((itemId, idx) => ({
    vendorId: vendorIds[idx % vendorIds.length],
    itemId,
  }));
  await prisma.vendorItem.createMany({ data: vendorItemPairs, skipDuplicates: true });

  const now = new Date();
  const future = daysFromNow(365);
  if ((await prisma.priceList.count()) < 50) {
    for (let i = 0; i < itemIds.length; i++) {
      const itemId = itemIds[i];
      const bvId = brandIdsByItem[itemId]?.[0];
      if (!bvId) continue;
      const vendorId = vendorIds[i % vendorIds.length];
      const unitPrice = 35 + (i % 15) * 18;
      const moq = 5 + (i % 4) * 5;
      const pl = await prisma.priceList.create({
        data: { vendorId, brandVariantId: bvId, unitPrice, moq, validFrom: daysAgo(30), validTo: future },
      });
      await prisma.priceTier.createMany({
        data: [
          { priceListId: pl.id, minQty: moq, discountPct: 0 },
          { priceListId: pl.id, minQty: moq * 5, discountPct: 3 },
          { priceListId: pl.id, minQty: moq * 20, discountPct: 7 },
        ],
      });
    }
  }

  if ((await prisma.vendorSla.count()) < 50) {
    const slaRows = Array.from({ length: 55 }, (_, i) => ({
      vendorId: vendorIds[i % vendorIds.length],
      periodStart: daysAgo(90 - (i % 3) * 30),
      periodEnd: daysAgo(60 - (i % 3) * 30),
      otifRate: Number((72 + ((i * 7) % 27)).toFixed(1)),
      priceVarianceRate: Number((0.4 + ((i * 3) % 7)).toFixed(1)),
      qcRejectionRate: Number((0.2 + ((i * 2) % 6)).toFixed(1)),
      docAccuracyRate: Number((86 + ((i * 5) % 14)).toFixed(1)),
    }));
    await prisma.vendorSla.createMany({ data: slaRows });
  }

  // ---------- 9. Batches, StockLedgers, ReorderPoints, ExpirationAlerts (>= 55 each) ----------
  const createdBatchIds: number[] = [];
  if ((await prisma.batch.count()) < 50) {
    // Mix of expired (<0d), critical (1-7d), warning (8-30d), and healthy (45-320d)
    const expiryOffsets = [-8, -3, 2, 5, 12, 22, 45, 90, 150, 280];
    for (let i = 0; i < 60; i++) {
      const itemId = itemIds[i % itemIds.length];
      const whId = activeWhIds[i % activeWhIds.length];
      const bvId = brandIdsByItem[itemId]?.[0] ?? null;
      const qty = 20 + (i % 12) * 15;
      const unitCost = 30 + (i % 10) * 12;
      const batch = await prisma.batch.create({
        data: {
          itemId,
          brandVariantId: bvId,
          batchNo: `B-SEED-${pad(i + 1)}`,
          expiryDate: daysFromNow(expiryOffsets[i % expiryOffsets.length]),
          quantity: qty,
          warehouseId: whId,
        },
      });
      createdBatchIds.push(batch.id);
      await prisma.stockLedger.create({
        data: {
          warehouseId: whId,
          itemId,
          brandVariantId: bvId,
          batchId: batch.id,
          qtyIn: qty,
          balance: qty,
          unitCost,
          refType: "SEED",
        },
      });
    }
  }
  const allBatches = await prisma.batch.findMany({ take: 60 });

  if ((await prisma.expirationAlert.count()) < 50 && allBatches.length > 0) {
    const tiers = [7, 15, 30, 60];
    const alerts = Array.from({ length: 52 }, (_, i) => ({
      batchId: allBatches[i % allBatches.length].id,
      tier: tiers[i % tiers.length],
      status: i % 3 === 0 ? "RESOLVED" : "ACTIVE",
      createdAt: daysAgo(i % 20),
    }));
    await prisma.expirationAlert.createMany({ data: alerts });
  }

  if ((await prisma.reorderPoint.count()) < 50) {
    const ropPairs: { itemId: number; warehouseId: number; safetyStock: number; reorderPoint: number; leadTimeDays: number; consumptionVelocity: number }[] = [];
    for (let i = 0; i < 55; i++) {
      const itemId = itemIds[i % itemIds.length];
      const warehouseId = activeWhIds[(i * 2) % activeWhIds.length];
      if (!ropPairs.some((r) => r.itemId === itemId && r.warehouseId === warehouseId)) {
        // Deliberately make some ROPs high (250) so Low-Stock Alerts & Replenishment Planner populate
        const isTrigger = i % 3 === 0;
        ropPairs.push({
          itemId,
          warehouseId,
          safetyStock: isTrigger ? 120 : 20,
          reorderPoint: isTrigger ? 250 : 40,
          leadTimeDays: 2 + (i % 10),
          consumptionVelocity: 5 + (i % 25),
        });
      }
    }
    await prisma.reorderPoint.createMany({ data: ropPairs, skipDuplicates: true });
  }

  // ---------- 10. Requisitions & Approvals (>= 52) ----------
  const reqStatuses = [
    RequisitionStatus.DRAFT,
    RequisitionStatus.PENDING_APPROVAL,
    RequisitionStatus.APPROVED,
    RequisitionStatus.REJECTED,
    RequisitionStatus.CONVERTED,
  ];
  const reqTypes = [RequisitionType.MANUAL, RequisitionType.ROP, RequisitionType.GROUP_CONSOLIDATED];

  if ((await prisma.requisition.count()) < 50) {
    for (let i = 1; i <= 52; i++) {
      const num = `PR-2026-${pad(i, 4)}`;
      const existing = await prisma.requisition.findUnique({ where: { number: num } });
      if (existing) continue;
      const itemId = itemIds[i % itemIds.length];
      const qty = 10 + (i % 8) * 10;
      const unitPrice = 45 + (i % 12) * 15;
      const status = reqStatuses[i % reqStatuses.length];
      const reqRec = await prisma.requisition.create({
        data: {
          number: num,
          projectId: projectList[i % 3].id,
          type: reqTypes[i % reqTypes.length],
          status,
          totalValue: qty * unitPrice,
          requestedById: userIds[i % userIds.length],
          costCenterId: ccIds[i % ccIds.length],
          createdAt: daysAgo(i % 60),
          items: {
            create: [
              { itemId, brandVariantId: brandIdsByItem[itemId]?.[0], quantity: qty, unitPrice },
            ],
          },
          approvals: {
            create: [
              {
                level: 1,
                approverId: users["cfo@capitalagro.com"],
                status: status === RequisitionStatus.REJECTED ? ApprovalStatus.REJECTED : status === RequisitionStatus.PENDING_APPROVAL || status === RequisitionStatus.DRAFT ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED,
                comment: status === RequisitionStatus.REJECTED ? "Budget threshold exceeded" : "Approved per operating plan",
                decidedAt: status === RequisitionStatus.PENDING_APPROVAL || status === RequisitionStatus.DRAFT ? null : daysAgo(i % 30),
              },
            ],
          },
        },
      });
      void reqRec;
    }
  }

  // ---------- 11. Purchase Orders, GRNs, DebitNotes, Invoices, Payments, LandedCosts, AP (>= 52 each) ----------
  const poStatuses = [PoStatus.OPEN, PoStatus.PARTIALLY_RECEIVED, PoStatus.FULLY_RECEIVED, PoStatus.FORCE_CLOSED];
  const grnStatuses = [GrnStatus.RECEIVED, GrnStatus.QC_PASSED, GrnStatus.QC_PARTIAL, GrnStatus.QUARANTINED];
  const invStatuses = [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_APPROVED, InvoiceStatus.APPROVED, InvoiceStatus.REJECTED];
  const payTypes = [PaymentType.DOWN_PAYMENT, PaymentType.MILESTONE, PaymentType.TRANCH, PaymentType.RETAINAGE_RELEASE];

  if ((await prisma.purchaseOrder.count()) < 50) {
    const vendorBalances = new Map<number, number>();
    for (let i = 1; i <= 52; i++) {
      const poNum = `PO-2026-${pad(i, 4)}`;
      if (await prisma.purchaseOrder.findUnique({ where: { number: poNum } })) continue;

      const vendorId = vendorIds[i % vendorIds.length];
      const projectId = projectList[i % 3].id;
      const itemId = itemIds[i % itemIds.length];
      const bvId = brandIdsByItem[itemId]?.[0] ?? null;
      const orderedQty = 20 + (i % 10) * 15;
      const poStatus = poStatuses[i % poStatuses.length];
      const receivedQty =
        poStatus === PoStatus.OPEN
          ? 0
          : poStatus === PoStatus.PARTIALLY_RECEIVED
          ? Math.floor(orderedQty / 2)
          : orderedQty;
      const outstandingQty = Math.max(0, orderedQty - receivedQty);
      const unitPrice = 40 + (i % 14) * 12;
      const taxPct = i % 4 === 0 ? 0 : 14;
      const subTotal = orderedQty * unitPrice;
      const vatAmount = subTotal * (taxPct / 100);
      const feesAmount = (i % 5) * 120;
      const totalValue = subTotal + vatAmount + feesAmount;

      const po = await prisma.purchaseOrder.create({
        data: {
          number: poNum,
          vendorId,
          projectId,
          status: poStatus,
          orderedQty,
          receivedQty,
          outstandingQty,
          subTotal,
          vatAmount,
          feesAmount,
          totalValue,
          approvedById: users["cfo@capitalagro.com"],
          createdById: users["procurement@capitalagro.com"],
          createdAt: daysAgo(i % 75),
          items: {
            create: [
              {
                itemId,
                brandVariantId: bvId,
                orderedQty,
                receivedQty,
                unitPrice,
                taxPct,
                landedCost: feesAmount / orderedQty,
              },
            ],
          },
          landedCosts: {
            create: [
              { type: i % 2 === 0 ? "FREIGHT" : "CUSTOMS", amount: feesAmount || 250, allocatedAmount: feesAmount || 250 },
            ],
          },
        },
        include: { items: true },
      });

      const poItem = po.items[0];
      const grnQty = receivedQty > 0 ? receivedQty : Math.floor(orderedQty * 0.4);
      const quarantined = i % 6 === 0 ? Math.max(1, Math.floor(grnQty * 0.1)) : 0;
      const accepted = grnQty - quarantined;

      const grn = await prisma.grn.create({
        data: {
          number: `GRN-2026-${pad(i, 4)}`,
          poId: po.id,
          status: grnStatuses[i % grnStatuses.length],
          receivedById: userIds[i % userIds.length],
          receivedAt: daysAgo(i % 40),
          items: {
            create: [
              {
                poItemId: poItem.id,
                itemId,
                brandVariantId: bvId,
                receivedQty: grnQty,
                acceptedQty: accepted,
                quarantinedQty: quarantined,
                batchId: allBatches[i % allBatches.length]?.id,
              },
            ],
          },
        },
        include: { items: true },
      });

      if (quarantined > 0 || i <= 50) {
        await prisma.debitNote.create({
          data: {
            number: `DN-2026-${pad(i, 4)}`,
            grnId: grn.id,
            vendorId,
            amount: Math.max(120, quarantined * unitPrice),
            reason: quarantined > 0 ? "QC temperature / packaging defect" : "Short-delivery quantity variance",
            createdAt: daysAgo(i % 35),
          },
        });
      }

      const invStatus = invStatuses[i % invStatuses.length];
      const invAmount = Number((grnQty * unitPrice * (1 + taxPct / 100)).toFixed(2));
      const inv = await prisma.invoice.create({
        data: {
          number: `INV-SUP-${pad(i, 4)}`,
          vendorId,
          poId: po.id,
          amount: invAmount,
          status: invStatus,
          createdAt: daysAgo(i % 30),
          items: {
            create: [
              {
                grnItemId: grn.items[0].id,
                quantity: grnQty,
                unitPrice: i % 7 === 0 ? unitPrice * 1.08 : unitPrice, // intentional price discrepancy on every 7th
              },
            ],
          },
        },
      });

      const prevBal = vendorBalances.get(vendorId) ?? 0;
      const balAfterInv = prevBal + invAmount;
      await prisma.apLedger.create({
        data: {
          vendorId,
          poId: po.id,
          invoiceId: inv.id,
          entryType: ApEntryType.INVOICE,
          amount: invAmount,
          balance: balAfterInv,
          createdAt: daysAgo(i % 30),
        },
      });

      const payAmt = invStatus === InvoiceStatus.APPROVED ? invAmount * 0.7 : invAmount * 0.35;
      const balAfterPay = Math.max(0, balAfterInv - payAmt);
      vendorBalances.set(vendorId, balAfterPay);

      await prisma.payment.create({
        data: {
          number: `PAY-2026-${pad(i, 4)}`,
          vendorId,
          poId: po.id,
          invoiceId: inv.id,
          type: payTypes[i % payTypes.length],
          amount: Number(payAmt.toFixed(2)),
          paidAt: daysAgo(i % 20),
          ledgerBalanceAfter: Number(balAfterPay.toFixed(2)),
        },
      });

      await prisma.apLedger.create({
        data: {
          vendorId,
          poId: po.id,
          invoiceId: inv.id,
          entryType: ApEntryType.PAYMENT,
          amount: -Number(payAmt.toFixed(2)),
          balance: Number(balAfterPay.toFixed(2)),
          createdAt: daysAgo(i % 20),
        },
      });
    }
  }

  // ---------- 12. Transfers (>= 52) ----------
  const trfStatuses = [
    TransferStatus.REQUESTED,
    TransferStatus.APPROVED,
    TransferStatus.DISPATCHED,
    TransferStatus.IN_TRANSIT,
    TransferStatus.RECEIVED,
    TransferStatus.CANCELLED,
  ];
  if ((await prisma.transferOrder.count()) < 50) {
    for (let i = 1; i <= 52; i++) {
      const reqNum = `TR-REQ-${pad(i, 4)}`;
      if (await prisma.transferRequisition.findUnique({ where: { number: reqNum } })) continue;

      const fromWh = activeWhIds[i % 4];
      const toWh = activeWhIds[4 + (i % 3)];
      const status = trfStatuses[i % trfStatuses.length];
      const itemId = itemIds[i % itemIds.length];
      const qty = 10 + (i % 8) * 5;
      const discrepancy = status === TransferStatus.RECEIVED && i % 4 === 0 ? 2 : 0;
      const receivedQty = status === TransferStatus.RECEIVED ? qty - discrepancy : 0;

      // Make some IN_TRANSIT orders stale (> 4 days old) for aging board
      const dispatchedAt =
        status === TransferStatus.DISPATCHED || status === TransferStatus.IN_TRANSIT || status === TransferStatus.RECEIVED
          ? daysAgo(status === TransferStatus.IN_TRANSIT ? 5 + (i % 5) : 1 + (i % 10))
          : null;

      const trReq = await prisma.transferRequisition.create({
        data: {
          number: reqNum,
          fromWarehouseId: fromWh,
          toWarehouseId: toWh,
          projectId: projectList[i % 3].id,
          status,
          requestedById: userIds[i % userIds.length],
          createdAt: daysAgo(i % 30),
        },
      });

      const trOrd = await prisma.transferOrder.create({
        data: {
          number: `TRF-2026-${pad(i, 4)}`,
          requisitionId: trReq.id,
          status,
          dispatchedAt,
          receivedAt: status === TransferStatus.RECEIVED ? daysAgo(i % 5) : null,
          items: {
            create: [
              {
                itemId,
                brandVariantId: brandIdsByItem[itemId]?.[0],
                batchId: allBatches[i % allBatches.length]?.id,
                quantity: qty,
                receivedQty,
                acceptedQty: receivedQty,
                discrepancyQty: discrepancy,
                comments: discrepancy > 0 ? "Minor transit spillage" : undefined,
              },
            ],
          },
        },
      });

      if (status === TransferStatus.RECEIVED) {
        await prisma.transferReceipt.create({
          data: {
            transferOrderId: trOrd.id,
            receivedById: userIds[i % userIds.length],
            receivedAt: daysAgo(i % 5),
            lossAllocation: discrepancy > 0 ? { sending: 0, receiving: 0, logistics: discrepancy * 40 } : undefined,
          },
        });
      }

      await prisma.interCompanyEntry.create({
        data: {
          transferOrderId: trOrd.id,
          fromProjectId: fanshy.id,
          toProjectId: spacca.id,
          amount: qty * 42,
          createdAt: daysAgo(i % 25),
        },
      });
    }
  }

  // ---------- 13. Recipes, POS Terminals, MenuMappings, PosTransactions (>= 52 each) ----------
  const recipeTypes = [RecipeType.MENU_ITEM, RecipeType.PREP, RecipeType.FINISHED_GOOD];
  if ((await prisma.recipe.count()) < 50) {
    for (let i = 1; i <= 52; i++) {
      const code = `RCP-${pad(i, 4)}`;
      const exists = await prisma.recipe.findUnique({ where: { code_version: { code, version: 1 } } });
      if (exists) continue;
      const itemA = itemIds[i % itemIds.length];
      const itemB = itemIds[(i + 3) % itemIds.length];
      await prisma.recipe.create({
        data: {
          code,
          name: `Signature Dish / Beverage #${i}`,
          projectId: projectList[i % 3].id,
          type: recipeTypes[i % recipeTypes.length],
          version: 1,
          active: true,
          items: {
            create: [
              { itemId: itemA, quantity: 0.25 + (i % 5) * 0.1, yieldFactor: 0.9, shrinkagePct: 5 + (i % 10) },
              { itemId: itemB, quantity: 0.15 + (i % 4) * 0.05, yieldFactor: 1, shrinkagePct: 2 },
            ],
          },
        },
      });
    }
  }

  const posData = [
    { code: "POS-FSH-01", name: "Fanshy Branch 1 POS", posSystem: "LegacyPOS v3", projectId: fanshy.id },
    { code: "POS-SPC-01", name: "Spacca Branch 1 POS", posSystem: "CoffeePOS Pro", projectId: spacca.id },
    { code: "POS-OST-01", name: "Osta Rosto POS", posSystem: "GrillPOS", projectId: osta.id },
  ];
  const terminalIds: number[] = [];
  for (const p of posData) {
    const t = await prisma.posTerminal.upsert({ where: { code: p.code }, update: {}, create: p });
    terminalIds.push(t.id);
  }

  if ((await prisma.posTransaction.count()) < 50) {
    const posStatuses = [PosTransactionStatus.BUFFERED, PosTransactionStatus.SYNCED, PosTransactionStatus.PROCESSED, PosTransactionStatus.FAILED];
    for (let i = 1; i <= 55; i++) {
      const txId = `POS-TX-2026-${pad(i, 4)}`;
      if (await prisma.posTransaction.findUnique({ where: { transactionId: txId } })) continue;
      const status = posStatuses[i % posStatuses.length];
      await prisma.posTransaction.create({
        data: {
          terminalId: terminalIds[i % terminalIds.length],
          transactionId: txId,
          payload: { items: [{ posMenuId: `MENU-${pad(i)}`, qty: 1 + (i % 4), total: 95 + i * 5 }] },
          status,
          processedAt: status === PosTransactionStatus.PROCESSED ? daysAgo(i % 15) : null,
          createdAt: daysAgo(i % 20),
        },
      });
    }
  }

  // ---------- 14. WasteLogs & VarianceRecords (>= 52 each) ----------
  if ((await prisma.wasteLog.count()) < 50) {
    const wasteReasons = ["Spoilage / Expired", "Kitchen Prep Burn", "Spillage", "Customer Return", "Cold-Chain Breach"];
    const wasteStatuses = [WasteStatus.PENDING, WasteStatus.APPROVED, WasteStatus.REJECTED];
    const wasteRows = Array.from({ length: 52 }, (_, i) => ({
      warehouseId: activeWhIds[i % activeWhIds.length],
      itemId: itemIds[i % itemIds.length],
      brandVariantId: brandIdsByItem[itemIds[i % itemIds.length]]?.[0] ?? null,
      quantity: 1.5 + (i % 9) * 1.2,
      reason: wasteReasons[i % wasteReasons.length],
      status: wasteStatuses[i % wasteStatuses.length],
      loggedById: userIds[i % userIds.length],
      approvedById: wasteStatuses[i % wasteStatuses.length] === WasteStatus.PENDING ? null : users["cfo@capitalagro.com"],
      createdAt: daysAgo(i % 45),
    }));
    await prisma.wasteLog.createMany({ data: wasteRows });
  }

  if ((await prisma.varianceRecord.count()) < 50) {
    const periods = ["2026-09", "2026-10", "2026-11"];
    const varRows = Array.from({ length: 55 }, (_, i) => {
      const theo = 100 + (i % 10) * 20;
      const diff = i % 3 === 0 ? 4 + (i % 6) : -(3 + (i % 8));
      const actual = theo + diff;
      return {
        period: periods[i % periods.length],
        itemId: itemIds[i % itemIds.length],
        warehouseId: activeWhIds[i % activeWhIds.length],
        theoreticalQty: theo,
        actualQty: actual,
        varianceQty: diff,
        variancePct: Number(((diff / theo) * 100).toFixed(2)),
        createdAt: daysAgo(i % 60),
      };
    });
    await prisma.varianceRecord.createMany({ data: varRows });
  }

  // ---------- 15. Stocktakes & Adjustments (>= 52 each) ----------
  if ((await prisma.stocktake.count()) < 50) {
    const stTypes = [StocktakeType.FULL, StocktakeType.CYCLE];
    const stStatuses = [StocktakeStatus.SCHEDULED, StocktakeStatus.IN_PROGRESS, StocktakeStatus.COMPLETED, StocktakeStatus.CANCELLED];
    for (let i = 1; i <= 52; i++) {
      const num = `ST-2026-${pad(i, 4)}`;
      if (await prisma.stocktake.findUnique({ where: { number: num } })) continue;
      const status = stStatuses[i % stStatuses.length];
      const itemId = itemIds[i % itemIds.length];
      const sysQty = 80 + (i % 10) * 10;
      const cntQty = sysQty + (i % 2 === 0 ? -4 : 3);
      await prisma.stocktake.create({
        data: {
          number: num,
          warehouseId: activeWhIds[i % activeWhIds.length],
          type: stTypes[i % stTypes.length],
          status,
          abcClass: i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C",
          scheduledDate: daysAgo(i % 30),
          completedAt: status === StocktakeStatus.COMPLETED ? daysAgo(i % 10) : null,
          items: {
            create: [{ itemId, systemQty: sysQty, countedQty: cntQty, varianceQty: cntQty - sysQty }],
          },
        },
      });
    }
  }

  if ((await prisma.adjustment.count()) < 50) {
    const adjReasons = [AdjustmentReason.WASTE, AdjustmentReason.DAMAGE, AdjustmentReason.THEFT, AdjustmentReason.COUNT_DIFFERENCE];
    const adjStatuses = [AdjustmentStatus.PENDING, AdjustmentStatus.APPROVED, AdjustmentStatus.REJECTED];
    for (let i = 1; i <= 52; i++) {
      const num = `ADJ-2026-${pad(i, 4)}`;
      if (await prisma.adjustment.findUnique({ where: { number: num } })) continue;
      const status = adjStatuses[i % adjStatuses.length];
      const qty = -(2 + (i % 8));
      const amount = Math.abs(qty) * (45 + (i % 10) * 5);
      await prisma.adjustment.create({
        data: {
          number: num,
          itemId: itemIds[i % itemIds.length],
          warehouseId: activeWhIds[i % activeWhIds.length],
          quantity: qty,
          reason: adjReasons[i % adjReasons.length],
          amount,
          status,
          approvalLevel: amount > 300 ? 2 : 1,
          requestedById: userIds[i % userIds.length],
          approvedById: status === AdjustmentStatus.PENDING ? null : users["cfo@capitalagro.com"],
          createdAt: daysAgo(i % 40),
        },
      });
    }
  }

  // ---------- 16. Balanced GL Entries (>= 60 pairs = 120 rows) ----------
  if ((await prisma.glEntry.count()) < 100) {
    for (let i = 1; i <= 60; i++) {
      const keyD = `SEED-GL-${pad(i, 4)}-D`;
      if (await prisma.glEntry.findUnique({ where: { postingKey: keyD } })) continue;
      const ccId = ccIds[i % ccIds.length];
      const amt = 500 + (i % 15) * 350;
      const debitAcct = i % 4 === 0 ? glAccounts["5100"] : i % 4 === 1 ? glAccounts["5200"] : i % 4 === 2 ? glAccounts["5000"] : glAccounts["1000"];
      const creditAcct = i % 4 === 3 ? glAccounts["3000"] : glAccounts["1000"];
      const ts = daysAgo(i % 60);
      await prisma.glEntry.createMany({
        data: [
          { accountId: debitAcct, costCenterId: ccId, debit: amt, credit: 0, refType: "SEED_JOURNAL", refId: `JRN-${pad(i, 4)}`, postingKey: keyD, timestamp: ts },
          { accountId: creditAcct, costCenterId: ccId, debit: 0, credit: amt, refType: "SEED_JOURNAL", refId: `JRN-${pad(i, 4)}`, postingKey: `SEED-GL-${pad(i, 4)}-C`, timestamp: ts },
        ],
      });
    }
  }

  // ---------- 17. Report Definitions, Snapshots & Scheduled Reports ----------
  const reportData = [
    { code: "BOARD-EXECUTIVE-KPI", name: "Board Executive Scorecard", audience: "Board, CEO, CFO", frequency: ReportFrequency.REAL_TIME },
    { code: "PROJECT-PNL-COGS", name: "Project P&L & COGS Control", audience: "Board, CFO, Cost Controller", frequency: ReportFrequency.MONTHLY },
    { code: "ABC-INVENTORY-MATRIX", name: "ABC Capital Lock-up Matrix", audience: "Board, CFO, Warehouse Leads", frequency: ReportFrequency.WEEKLY },
    { code: "TRANSFER-LOGISTICS-SLA", name: "Transfer & Logistics SLA", audience: "COO, Logistics, Branch Managers", frequency: ReportFrequency.DAILY },
    { code: "WASTE-SHRINKAGE-BOARD", name: "Waste & Shrinkage Impact", audience: "Board, CFO, F&B Directors", frequency: ReportFrequency.WEEKLY },
    { code: "STOCK-VALUATION", name: "Project Stock Valuation Ledger", audience: "CFO, Project Finance", frequency: ReportFrequency.MONTHLY },
    { code: "VARIANCE", name: "Theoretical vs Actual Variance", audience: "F&B Leads, Cost Controller", frequency: ReportFrequency.DAILY },
    { code: "PO-OPEN-BALANCE", name: "PO Open Balance & Partial Receipts", audience: "Procurement Manager", frequency: ReportFrequency.REAL_TIME },
    { code: "SUPPLIER-AP", name: "Supplier AP & Partial Payments", audience: "Accounts Payable Lead", frequency: ReportFrequency.WEEKLY },
    { code: "STOCK-AGING", name: "Stock Aging & Expiration Risk", audience: "Warehouse & Store Managers", frequency: ReportFrequency.DAILY },
    { code: "VENDOR-SLA", name: "Vendor SLA & Performance", audience: "Procurement Manager", frequency: ReportFrequency.MONTHLY },
    { code: "MENU-MARGIN", name: "Menu Item Margin & Recipe Cost", audience: "Brand Managers", frequency: ReportFrequency.REAL_TIME },
  ];
  for (const r of reportData) {
    await prisma.reportDefinition.upsert({ where: { code: r.code }, update: { name: r.name, audience: r.audience, frequency: r.frequency }, create: r });
  }

  if ((await prisma.reportSnapshot.count()) < 10) {
    for (let i = 0; i < 12; i++) {
      await prisma.reportSnapshot.create({
        data: {
          reportCode: reportData[i % reportData.length].code,
          period: `2026-${pad((i % 11) + 1, 2)}`,
          data: [{ sample: true, index: i + 1, generatedBy: "seed" }],
          generatedAt: daysAgo(i * 3),
        },
      });
    }
  }

  if ((await prisma.scheduledReport.count()) < 5) {
    await prisma.scheduledReport.createMany({
      data: [
        { reportCode: "BOARD-EXECUTIVE-KPI", frequency: ReportFrequency.DAILY, recipients: ["cfo@capitalagro.com", "exec@capitalagro.com"], active: true },
        { reportCode: "PROJECT-PNL-COGS", frequency: ReportFrequency.WEEKLY, recipients: ["cfo@capitalagro.com", "cost@capitalagro.com"], active: true },
        { reportCode: "STOCK-AGING", frequency: ReportFrequency.DAILY, recipients: ["wm.fanshy@capitalagro.com", "wm.spacca@capitalagro.com"], active: true },
        { reportCode: "VENDOR-SLA", frequency: ReportFrequency.MONTHLY, recipients: ["procurement@capitalagro.com"], active: true },
        { reportCode: "WASTE-SHRINKAGE-BOARD", frequency: ReportFrequency.WEEKLY, recipients: ["exec@capitalagro.com", "cost@capitalagro.com"], active: true },
      ],
    });
  }

  // ---------- 18. Audit Logs (>= 60) ----------
  if ((await prisma.auditLog.count()) < 50) {
    const actions = [
      AuditAction.LOGIN,
      AuditAction.CREATE,
      AuditAction.APPROVE,
      AuditAction.POST,
      AuditAction.TRANSFER,
      AuditAction.RECEIVE,
      AuditAction.ADJUST,
    ];
    let prevHash = "GENESIS";
    for (let i = 1; i <= 60; i++) {
      const action = actions[i % actions.length];
      const entityType = i % 3 === 0 ? "PurchaseOrder" : i % 3 === 1 ? "TransferOrder" : "Stocktake";
      const entityId = String(i);
      const payload = `${prevHash}|${action}|${entityType}|${entityId}|${i}`;
      const hash = crypto.createHash("sha256").update(payload).digest("hex");
      await prisma.auditLog.create({
        data: {
          userId: userIds[i % userIds.length],
          action,
          entityType,
          entityId,
          after: { seeded: true, step: i },
          ip: "127.0.0.1",
          prevHash,
          hash,
          timestamp: daysAgo(i % 30),
        },
      });
      prevHash = hash;
    }
  }

  console.log("Seed complete (>= 50 varied records per module).");
  console.log("Login: admin@capitalagro.com / Admin@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
