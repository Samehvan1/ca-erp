export type UnitDimension = "MASS" | "VOLUME" | "COUNT" | "LENGTH" | "AREA";

export interface Category {
  id: number;
  code: string;
  name: string;
  parentId: number | null;
  parent?: { id: number; code: string; name: string } | null;
  children?: { id: number; code: string; name: string }[];
  defaultValuationMethod?: string;
  inventoryAccountId?: number | null;
  inventoryAccount?: { id: number; code: string; name: string } | null;
  cogsAccountId?: number | null;
  cogsAccount?: { id: number; code: string; name: string } | null;
  taxRatePct: number;
  _count?: { items: number; children: number };
}

export interface UnitOfMeasure {
  id: number;
  code: string;
  name: string;
  symbol?: string | null;
  dimension: UnitDimension;
  isBaseUnit: boolean;
  fromConversions?: UnitConversion[];
  toConversions?: UnitConversion[];
  _count?: { baseItems: number; purchaseItems: number; recipeItems: number };
}

export interface UnitConversion {
  id: number;
  fromUnitId: number;
  fromUnit?: UnitOfMeasure;
  toUnitId: number;
  toUnit?: UnitOfMeasure;
  factor: number;
  itemId?: number | null;
  item?: { id: number; code: string; description: string } | null;
}

export interface Item {
  id: number;
  code: string;
  description: string;
  category: string | null;
  categoryId?: number | null;
  categoryRef?: Category | null;
  scope: string;
  abcClass: string | null;
  uom: string;
  baseUnitId?: number | null;
  baseUnit?: UnitOfMeasure | null;
  purchaseUnitId?: number | null;
  purchaseUnit?: UnitOfMeasure | null;
  recipeUnitId?: number | null;
  recipeUnit?: UnitOfMeasure | null;
  unitConversions?: UnitConversion[];
  valuationMethod: string;
  projectId: number | null;
  brandVariants: BrandVariant[];
}

export interface BrandVariant {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
}

export interface Brand {
  id: number;
  itemId: number;
  name: string;
  sku: string;
  barcode: string | null;
  itemCode: string;
  itemDescription: string;
}

export interface Batch {
  id: number;
  batchNo: string;
  quantity: number;
  expiryDate: string;
  itemId: number;
  warehouseId: number;
  brandVariantId: number | null;
  item: { code: string; description: string };
  brandVariant: { name: string } | null;
  warehouse: { code: string; name?: string };
}

export interface ExpirationAlertItem {
  batch: Batch;
  daysLeft: number;
  tier: number;
}

export interface Rop {
  id: number;
  itemId: number;
  warehouseId: number;
  item: { code: string; description: string };
  warehouse: { code: string; name?: string };
  reorderPoint: number;
  safetyStock: number;
  leadTimeDays: number;
  consumptionVelocity: number;
}

export interface Adjustment {
  id: number;
  number: string;
  quantity: number;
  reason: string;
  amount: number;
  status: string;
  approvalLevel: number;
  createdAt: string;
  item: { code: string; description: string };
  warehouse: { code: string; name?: string };
  stocktake: { number: string } | null;
  requestedBy: { name: string } | null;
  approvedBy: { name: string } | null;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  type: string;
  projectId: number | null;
  owner: string | null;
  address: string | null;
  city: string | null;
  country: string;
}

export interface MatrixRow {
  item: Item;
  brandVariant?: BrandVariant;
  totalQuantity: number;
  stockByWarehouse: Record<number, number>; // warehouseId -> qty
  ropStatus: "ok" | "low" | "out";
  minRop: number;
  safetyStock: number;
}
