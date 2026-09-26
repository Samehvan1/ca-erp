export interface Requisition {
  id: number;
  number: string;
  type: string;
  status: string;
  totalValue: number;
  createdAt: string;
  costCenterId: number | null;
  projectId?: number;
  project: { id: number; name: string };
  requestedBy: { name: string } | null;
  items: {
    id: number;
    quantity: number;
    unitPrice: number;
    brandVariantId: number | null;
    item: { id: number; code: string; description: string; uom?: string };
  }[];
}

export interface PoItem {
  id: number;
  itemId: number;
  brandVariantId: number | null;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  taxPct: number;
  discountPct: number;
  item: { id?: number; code: string; description?: string; uom?: string };
  brandVariant?: { id?: number; name: string; sku: string } | null;
}

export interface Po {
  id: number;
  number: string;
  status: string; // OPEN | PARTIALLY_RECEIVED | FULLY_RECEIVED | FORCE_CLOSED
  orderedQty: number;
  receivedQty: number;
  outstandingQty: number;
  totalValue: number;
  subTotal: number;
  vatAmount: number;
  discountAmount: number;
  feesAmount: number;
  currency: string;
  createdAt: string;
  vendor: { id: number; name: string; code?: string };
  project: { id: number; name: string };
  createdBy: { name: string } | null;
  approvedBy?: { name: string } | null;
  items: PoItem[];
  grns?: Grn[];
  invoices?: Invoice[];
  payments?: Payment[];
}

export interface GrnItem {
  id: number;
  poItemId: number;
  receivedQty: number;
  acceptedQty: number;
  quarantinedQty: number;
  batchId?: number | null;
  item: { id?: number; code: string; description?: string; uom?: string };
  brandVariant?: { id?: number; name: string } | null;
  batch?: { batchNo: string; expiryDate: string } | null;
}

export interface Grn {
  id: number;
  number: string;
  status: string; // RECEIVED | QC_PASSED | QC_PARTIAL | QUARANTINED
  receivedAt: string;
  poId: number;
  po: { id: number; number: string; vendor?: { name: string } };
  receivedBy?: { name: string } | null;
  items: GrnItem[];
}

export interface InvoiceItem {
  id: number;
  grnItemId: number;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: number;
  number: string;
  status: string; // PENDING | PARTIALLY_APPROVED | APPROVED | REJECTED
  amount: number;
  createdAt: string;
  vendorId: number;
  vendor: { id: number; name: string; code?: string };
  poId: number;
  po: { id: number; number: string };
  items: InvoiceItem[];
}

export interface Payment {
  id: number;
  number: string;
  type: string; // DOWN_PAYMENT | MILESTONE | TRANCH | RETAINAGE_RELEASE
  amount: number;
  paidAt: string;
  vendor: { id: number; name: string };
  po: { id: number; number: string } | null;
  invoice: { id: number; number: string } | null;
}

export interface Item {
  id: number;
  code: string;
  description: string;
  uom?: string;
  brandVariants: { id: number; name: string; sku: string }[];
}

export interface Vendor {
  id: number;
  code: string;
  name: string;
  taxType?: string | null;
  taxRate?: number;
  paymentTerms?: string;
}

export interface CostCenter {
  id: number;
  code: string;
  name: string;
}
