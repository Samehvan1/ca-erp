export interface Warehouse {
  id: number;
  code: string;
  name: string;
  type: string;
  projectId: number | null;
}

export interface BrandVariant {
  id: number;
  name: string;
  sku: string;
}

export interface Item {
  id: number;
  code: string;
  description: string;
  uom?: string;
  brandVariants: BrandVariant[];
}

export interface TransferItem {
  id: number;
  quantity: number;
  receivedQty: number;
  discrepancyQty: number;
  acceptedQty: number;
  comments: string | null;
  itemId?: number;
  brandVariantId?: number | null;
  item: { code: string; description: string; uom?: string };
  brandVariant?: { name: string; sku: string } | null;
  batch?: { batchNo: string; expiryDate: string } | null;
}

export interface TransferOrder {
  id: number;
  number: string;
  status: string; // REQUESTED | APPROVED | DISPATCHED | IN_TRANSIT | RECEIVED | CANCELLED
  dispatchedAt: string | null;
  receivedAt: string | null;
  createdAt?: string;
  requisitionId: number;
  requisition: {
    fromWarehouse: { id?: number; code: string; name?: string };
    toWarehouse: { id?: number; code: string; name?: string };
    project?: { id: number; name: string } | null;
    requestedBy?: { name: string } | null;
  };
  items: TransferItem[];
  receipts: { id: number; lossAllocation: { sending: number; receiving: number; logistics: number } | null }[];
}

export interface TransferRequisition {
  id: number;
  number: string;
  status: string;
  createdAt: string;
  fromWarehouse: { id: number; code: string; name?: string };
  toWarehouse: { id: number; code: string; name?: string };
  project: { id: number; name: string } | null;
  requestedBy: { name: string } | null;
  orders: { id: number; number: string; items: TransferItem[] }[];
}

export interface AgingRow {
  id: number;
  number: string;
  from: string;
  to: string;
  daysInTransit: number;
  stale: boolean;
  items: number;
  dispatchedAt?: string | null;
}

export interface ItemRow {
  key: number;
  itemId: string;
  brandVariantId: string;
  quantity: string;
}

export interface RecvRow {
  key: number;
  transferItemId: string;
  receivedQty: string;
  discrepancyQty: string;
  acceptedQty: string;
  comments: string;
}
