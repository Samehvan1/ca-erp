import { FormEvent, useState } from "react";
import { Badge, ConfirmDialog, Empty, ErrorBanner, HistoryButton, ListToolbar, Loading, Modal, Toast, apiReq, useApi, useListFilter } from "../components";

interface Item {
  id: number;
  code: string;
  description: string;
  category: string | null;
  scope: string;
  abcClass: string | null;
  uom: string;
  valuationMethod: string;
  projectId: number | null;
  brandVariants: { id: number; name: string; sku: string }[];
}

interface Batch {
  id: number;
  batchNo: string;
  quantity: number;
  expiryDate: string;
  itemId: number;
  warehouseId: number;
  brandVariantId: number | null;
  item: { code: string; description: string };
  brandVariant: { name: string } | null;
  warehouse: { code: string };
}

interface Rop {
  id: number;
  itemId: number;
  warehouseId: number;
  item: { code: string; description: string };
  warehouse: { code: string };
  reorderPoint: number;
  safetyStock: number;
  leadTimeDays: number;
  consumptionVelocity: number;
}

interface Adjustment {
  id: number;
  number: string;
  quantity: number;
  reason: string;
  amount: number;
  status: string;
  approvalLevel: number;
  createdAt: string;
  item: { code: string; description: string };
  warehouse: { code: string };
  stocktake: { number: string } | null;
  requestedBy: { name: string } | null;
  approvedBy: { name: string } | null;
}

interface Warehouse {
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

interface Brand {
  id: number;
  itemId: number;
  name: string;
  sku: string;
  barcode: string | null;
  itemCode: string;
  itemDescription: string;
}

function ViewFields({ fields }: { fields: [string, string][] }) {
  return (
    <div className="view-fields">
      {fields.map(([label, value]) => (
        <div className="view-row" key={label}>
          <span className="view-label">{label}</span>
          <span className="view-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Inventory() {
  const [tab, setTab] = useState<"items" | "batches" | "alerts" | "rop" | "adjustments">("items");
  const items = useApi<Item[]>("/inventory/items");
  const batches = useApi<Batch[]>("/inventory/batches");
  const alerts = useApi<{ batch: Batch; daysLeft: number; tier: number }[]>("/inventory/alerts/expiration");
  const rops = useApi<Rop[]>("/inventory/reorder-points");
  const adjustments = useApi<Adjustment[]>("/stocktaking/adjustments");
  const warehouses = useApi<Warehouse[]>("/inventory/warehouses");

  const { q: itemQ, setQ: setItemQ, filtered: filteredItems } = useListFilter<Item>(items.data, ["code", "description", "category", "abcClass"]);
  const { q: batchQ, setQ: setBatchQ, filtered: filteredBatches } = useListFilter<Batch>(batches.data, ["batchNo", "expiryDate"]);
  const { q: alertQ, setQ: setAlertQ, filtered: filteredAlerts } = useListFilter<{ batch: Batch; daysLeft: number; tier: number }>(alerts.data, ["daysLeft", "tier"]);
  const { q: ropQ, setQ: setRopQ, filtered: filteredRops } = useListFilter<Rop>(rops.data, ["reorderPoint", "safetyStock", "leadTimeDays", "consumptionVelocity"]);
  const { q: adjQ, setQ: setAdjQ, filtered: filteredAdjustments } = useListFilter<Adjustment>(adjustments.data, ["number", "reason", "status"]);
  const { q: whQ, setQ: setWhQ, filtered: filteredWarehouses } = useListFilter<Warehouse>(warehouses.data, ["code", "name", "type", "owner"]);
  const allBrands: Brand[] = (items.data ?? []).flatMap((i) =>
    i.brandVariants.map((v) => ({
      id: v.id,
      itemId: i.id,
      name: v.name,
      sku: v.sku,
      barcode: null,
      itemCode: i.code,
      itemDescription: i.description,
    }))
  );
  const { q: brandQ, setQ: setBrandQ, filtered: filteredBrands } = useListFilter<Brand>(allBrands, ["sku", "name", "itemCode", "itemDescription"]);

  // Modal visibility
  const [showItem, setShowItem] = useState(false);
  const [showWarehouse, setShowWarehouse] = useState(false);
  const [showBrand, setShowBrand] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showRop, setShowRop] = useState(false);
  const [showAdj, setShowAdj] = useState(false);

  // View / Edit / Delete state
  const [viewItem, setViewItem] = useState<Item | null>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [deleteItem, setDeleteItem] = useState<Item | null>(null);
  const [viewBatch, setViewBatch] = useState<Batch | null>(null);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [deleteBatch, setDeleteBatch] = useState<Batch | null>(null);
  const [viewRop, setViewRop] = useState<Rop | null>(null);
  const [editRop, setEditRop] = useState<Rop | null>(null);
  const [deleteRop, setDeleteRop] = useState<Rop | null>(null);
  const [viewWh, setViewWh] = useState<Warehouse | null>(null);
  const [editWh, setEditWh] = useState<Warehouse | null>(null);
  const [deleteWh, setDeleteWh] = useState<Warehouse | null>(null);
  const [viewBrand, setViewBrand] = useState<Brand | null>(null);
  const [editBrand, setEditBrand] = useState<Brand | null>(null);
  const [deleteBrand, setDeleteBrand] = useState<Brand | null>(null);
  const [viewAdj, setViewAdj] = useState<Adjustment | null>(null);
  const [editAdj, setEditAdj] = useState<Adjustment | null>(null);
  const [deleteAdj, setDeleteAdj] = useState<Adjustment | null>(null);
  const [approveAdj, setApproveAdj] = useState<Adjustment | null>(null);

  // Shared form state
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Item form
  const [itemForm, setItemForm] = useState({
    code: "",
    description: "",
    scope: "PROJECT_ISOLATED",
    projectId: "",
    category: "",
    valuationMethod: "WAC",
    abcClass: "",
    uom: "",
  });

  // Warehouse form
  const [whForm, setWhForm] = useState({
    code: "",
    name: "",
    type: "PROJECT_CENTRAL",
    projectId: "",
    owner: "",
    address: "",
    city: "",
    country: "Egypt",
  });

  // Brand form
  const [brandForm, setBrandForm] = useState({
    itemId: "",
    name: "",
    sku: "",
    barcode: "",
  });

  // Batch form
  const [batchForm, setBatchForm] = useState({
    itemId: "",
    brandVariantId: "",
    batchNo: "",
    expiryDate: "",
    quantity: "",
    warehouseId: "",
    unitCost: "",
  });

  // ROP form
  const [ropForm, setRopForm] = useState({
    itemId: "",
    warehouseId: "",
    safetyStock: "",
    reorderPoint: "",
    leadTimeDays: "",
    consumptionVelocity: "",
  });

  // Adjustment form
  const [adjForm, setAdjForm] = useState({
    reason: "COUNT_DIFFERENCE",
    amount: "",
    approvalLevel: "1",
    status: "PENDING",
  });

  const submitItem = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        code: itemForm.code,
        description: itemForm.description,
        scope: itemForm.scope,
      };
      if (itemForm.projectId) body.projectId = Number(itemForm.projectId);
      if (itemForm.category) body.category = itemForm.category;
      if (itemForm.valuationMethod) body.valuationMethod = itemForm.valuationMethod;
      if (itemForm.abcClass) body.abcClass = itemForm.abcClass;
      if (itemForm.uom) body.uom = itemForm.uom;
      if (editItem) {
        await apiReq("PATCH", `/inventory/items/${editItem.id}`, body);
        items.reload();
        setShowItem(false);
        setEditItem(null);
        setMsg("Updated");
      } else {
        await apiReq("POST", "/inventory/items", body);
        items.reload();
        setShowItem(false);
        setMsg("Created");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const submitWarehouse = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        code: whForm.code,
        name: whForm.name,
        type: whForm.type,
      };
      if (whForm.projectId) body.projectId = Number(whForm.projectId);
      if (whForm.owner) body.owner = whForm.owner;
      if (whForm.address) body.address = whForm.address;
      if (whForm.city) body.city = whForm.city;
      if (whForm.country) body.country = whForm.country;
      if (editWh) {
        await apiReq("PATCH", `/inventory/warehouses/${editWh.id}`, body);
        warehouses.reload();
        setShowWarehouse(false);
        setEditWh(null);
        setMsg("Updated");
      } else {
        await apiReq("POST", "/inventory/warehouses", body);
        warehouses.reload();
        setShowWarehouse(false);
        setMsg("Created");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const submitBrand = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        itemId: Number(brandForm.itemId),
        name: brandForm.name,
        sku: brandForm.sku,
      };
      if (brandForm.barcode) body.barcode = brandForm.barcode;
      if (editBrand) {
        await apiReq("PATCH", `/inventory/brands/${editBrand.id}`, body);
        items.reload();
        setShowBrand(false);
        setEditBrand(null);
        setMsg("Updated");
      } else {
        await apiReq("POST", "/inventory/brands", body);
        items.reload();
        setShowBrand(false);
        setMsg("Created");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const submitBatch = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        itemId: Number(batchForm.itemId),
        batchNo: batchForm.batchNo,
        expiryDate: batchForm.expiryDate,
        quantity: Number(batchForm.quantity),
        warehouseId: Number(batchForm.warehouseId),
      };
      if (batchForm.brandVariantId) body.brandVariantId = Number(batchForm.brandVariantId);
      if (batchForm.unitCost) body.unitCost = Number(batchForm.unitCost);
      if (editBatch) {
        await apiReq("PATCH", `/inventory/batches/${editBatch.id}`, body);
        batches.reload();
        setShowBatch(false);
        setEditBatch(null);
        setMsg("Updated");
      } else {
        await apiReq("POST", "/inventory/batches", body);
        batches.reload();
        setShowBatch(false);
        setMsg("Created");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const submitRop = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        itemId: Number(ropForm.itemId),
        warehouseId: Number(ropForm.warehouseId),
      };
      if (ropForm.safetyStock) body.safetyStock = Number(ropForm.safetyStock);
      if (ropForm.reorderPoint) body.reorderPoint = Number(ropForm.reorderPoint);
      if (ropForm.leadTimeDays) body.leadTimeDays = Number(ropForm.leadTimeDays);
      if (ropForm.consumptionVelocity) body.consumptionVelocity = Number(ropForm.consumptionVelocity);
      if (editRop) {
        await apiReq("PATCH", `/inventory/reorder-points/${editRop.id}`, body);
        rops.reload();
        setShowRop(false);
        setEditRop(null);
        setMsg("Updated");
      } else {
        await apiReq("POST", "/inventory/reorder-points", body);
        rops.reload();
        setShowRop(false);
        setMsg("Created");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const submitAdjustment = async (e: FormEvent) => {
    e.preventDefault();
    if (!editAdj) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        reason: adjForm.reason,
        status: adjForm.status,
      };
      if (adjForm.amount !== "") body.amount = Number(adjForm.amount);
      if (adjForm.approvalLevel !== "") body.approvalLevel = Number(adjForm.approvalLevel);
      await apiReq("PATCH", `/inventory/adjustments/${editAdj.id}`, body);
      adjustments.reload();
      setShowAdj(false);
      setEditAdj(null);
      setMsg("Adjustment updated");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteAdjustment = async () => {
    if (!deleteAdj) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiReq("DELETE", `/inventory/adjustments/${deleteAdj.id}`);
      adjustments.reload();
      setDeleteAdj(null);
      setMsg("Adjustment deleted");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setDeleteAdj(null);
    } finally {
      setBusy(false);
    }
  };

  const submitAdjustmentDecision = async (approve: boolean) => {
    if (!approveAdj) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiReq("POST", `/stocktaking/adjustments/${approveAdj.id}/approve`, { approve });
      adjustments.reload();
      setApproveAdj(null);
      setMsg(approve ? "Adjustment approved" : "Adjustment rejected");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
      setApproveAdj(null);
    } finally {
      setBusy(false);
    }
  };

  const openEditItem = (i: Item) => {
    setItemForm({
      code: i.code,
      description: i.description,
      scope: i.scope,
      projectId: i.projectId ? String(i.projectId) : "",
      category: i.category ?? "",
      valuationMethod: i.valuationMethod,
      abcClass: i.abcClass ?? "",
      uom: i.uom ?? "",
    });
    setEditItem(i);
    setShowItem(true);
  };

  const openEditBatch = (b: Batch) => {
    setBatchForm({
      itemId: String(b.itemId),
      brandVariantId: b.brandVariantId ? String(b.brandVariantId) : "",
      batchNo: b.batchNo,
      expiryDate: b.expiryDate.slice(0, 10),
      quantity: String(b.quantity),
      warehouseId: String(b.warehouseId),
      unitCost: "",
    });
    setEditBatch(b);
    setShowBatch(true);
  };

  const openEditRop = (r: Rop) => {
    setRopForm({
      itemId: String(r.itemId),
      warehouseId: String(r.warehouseId),
      safetyStock: String(r.safetyStock),
      reorderPoint: String(r.reorderPoint),
      leadTimeDays: String(r.leadTimeDays),
      consumptionVelocity: String(r.consumptionVelocity),
    });
    setEditRop(r);
    setShowRop(true);
  };

  const openEditAdj = (a: Adjustment) => {
    setAdjForm({
      reason: a.reason,
      amount: a.amount ? String(a.amount) : "",
      approvalLevel: String(a.approvalLevel),
      status: a.status,
    });
    setEditAdj(a);
    setShowAdj(true);
  };

  const openEditWh = (w: Warehouse) => {
    setWhForm({
      code: w.code,
      name: w.name,
      type: w.type,
      projectId: w.projectId ? String(w.projectId) : "",
      owner: w.owner ?? "",
      address: w.address ?? "",
      city: w.city ?? "",
      country: w.country ?? "Egypt",
    });
    setEditWh(w);
    setShowWarehouse(true);
  };

  const openEditBrand = (b: Brand) => {
    setBrandForm({
      itemId: String(b.itemId),
      name: b.name,
      sku: b.sku,
      barcode: b.barcode ?? "",
    });
    setEditBrand(b);
    setShowBrand(true);
  };

  const confirmDeleteItem = async () => {
    if (!deleteItem) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiReq("DELETE", `/inventory/items/${deleteItem.id}`);
      items.reload();
      setDeleteItem(null);
      setMsg("Deleted");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setDeleteItem(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteBatch = async () => {
    if (!deleteBatch) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiReq("DELETE", `/inventory/batches/${deleteBatch.id}`);
      batches.reload();
      setDeleteBatch(null);
      setMsg("Deleted");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setDeleteBatch(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteRop = async () => {
    if (!deleteRop) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiReq("DELETE", `/inventory/reorder-points/${deleteRop.id}`);
      rops.reload();
      setDeleteRop(null);
      setMsg("Deleted");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setDeleteRop(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteWh = async () => {
    if (!deleteWh) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiReq("DELETE", `/inventory/warehouses/${deleteWh.id}`);
      warehouses.reload();
      setDeleteWh(null);
      setMsg("Deleted");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setDeleteWh(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteBrand = async () => {
    if (!deleteBrand) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiReq("DELETE", `/inventory/brands/${deleteBrand.id}`);
      items.reload();
      setDeleteBrand(null);
      setMsg("Deleted");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setDeleteBrand(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <h1>Inventory</h1>
        <div className="crumb">Items · Batches · Expiry · Reorder · Adjustments</div>
      </div>

      <div className="tabs">
        <button className={tab === "items" ? "active" : ""} onClick={() => setTab("items")}>
          Items ({items.data?.length ?? 0})
        </button>
        <button className={tab === "batches" ? "active" : ""} onClick={() => setTab("batches")}>
          Batches ({batches.data?.length ?? 0})
        </button>
        <button className={tab === "alerts" ? "active" : ""} onClick={() => setTab("alerts")}>
          Expiry alerts ({alerts.data?.length ?? 0})
        </button>
        <button className={tab === "rop" ? "active" : ""} onClick={() => setTab("rop")}>
          Reorder points ({rops.data?.length ?? 0})
        </button>
        <button className={tab === "adjustments" ? "active" : ""} onClick={() => setTab("adjustments")}>
          Adjustments ({adjustments.data?.length ?? 0})
        </button>
      </div>

      {tab === "items" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn ghost" onClick={() => setShowWarehouse(true)}>
              + New Warehouse
            </button>
            <button className="btn ghost" onClick={() => setShowBrand(true)}>
              + New Brand
            </button>
            <button
              className="btn amber"
              onClick={() => {
                setItemForm({
                  code: "",
                  description: "",
                  scope: "PROJECT_ISOLATED",
                  projectId: "",
                  category: "",
                  valuationMethod: "WAC",
                  abcClass: "",
                  uom: "",
                });
                setEditItem(null);
                setShowItem(true);
              }}
            >
              + New Item
            </button>
          </div>
          {items.error && <ErrorBanner message={items.error} />}
          {err && <ErrorBanner message={err} />}
          {items.loading ? (
            <Loading />
          ) : !items.data?.length ? (
            <Empty />
          ) : (
            <div className="tbl-wrap">
              <ListToolbar
                q={itemQ}
                setQ={setItemQ}
                rows={filteredItems}
                columns={[
                  { key: "code", label: "Code" },
                  { key: "description", label: "Description" },
                  { key: "category", label: "Category" },
                  { key: "abcClass", label: "ABC" },
                ]}
                filename="items"
              />
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Scope</th>
                    <th>ABC</th>
                    <th>Valuation</th>
                    <th>Variants</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredItems ?? []).map((i) => (
                    <tr key={i.id}>
                      <td className="mono">{i.code}</td>
                      <td>{i.description}</td>
                      <td>{i.category ?? "—"}</td>
                      <td>
                        <Badge status={i.scope.replace(/_/g, " ")} />
                      </td>
                      <td>{i.abcClass ?? "—"}</td>
                      <td className="mono">{i.valuationMethod}</td>
                      <td className="mono">{i.brandVariants.map((v) => v.sku).join(", ") || "—"}</td>
                      <td className="actions">
                        <HistoryButton entityType="Item" entityId={i.id} />
                        <button className="btn sm ghost" onClick={() => setViewItem(i)}>
                          View
                        </button>
                        <button className="btn sm ghost" onClick={() => openEditItem(i)}>
                          Edit
                        </button>
                        <button className="btn sm danger" onClick={() => setDeleteItem(i)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 style={{ margin: "22px 0 10px", fontFamily: "var(--serif)", fontSize: 16 }}>Warehouses</h3>
          {warehouses.error && <ErrorBanner message={warehouses.error} />}
          {warehouses.loading ? (
            <Loading />
          ) : !warehouses.data?.length ? (
            <Empty text="No warehouses." />
          ) : (
            <div className="tbl-wrap">
              <ListToolbar
                q={whQ}
                setQ={setWhQ}
                rows={filteredWarehouses}
                columns={[
                  { key: "code", label: "Code" },
                  { key: "name", label: "Name" },
                  { key: "type", label: "Type" },
                  { key: "owner", label: "Owner" },
                ]}
                filename="warehouses"
              />
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Project</th>
                    <th>Owner</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredWarehouses ?? []).map((w) => (
                    <tr key={w.id}>
                      <td className="mono">{w.code}</td>
                      <td>{w.name}</td>
                      <td>
                        <Badge status={w.type.replace(/_/g, " ")} />
                      </td>
                      <td className="mono">{w.projectId ? String(w.projectId) : "—"}</td>
                      <td>{w.owner ?? "—"}</td>
                      <td className="actions">
                        <HistoryButton entityType="Warehouse" entityId={w.id} />
                        <button className="btn sm ghost" onClick={() => setViewWh(w)}>
                          View
                        </button>
                        <button className="btn sm ghost" onClick={() => openEditWh(w)}>
                          Edit
                        </button>
                        <button className="btn sm danger" onClick={() => setDeleteWh(w)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 style={{ margin: "22px 0 10px", fontFamily: "var(--serif)", fontSize: 16 }}>Brands</h3>
          {(() => {
            const brands: Brand[] = filteredBrands ?? [];
            return brands.length ? (
              <div className="tbl-wrap">
                <ListToolbar
                  q={brandQ}
                  setQ={setBrandQ}
                  rows={filteredBrands}
                  columns={[
                    { key: "sku", label: "SKU" },
                    { key: "name", label: "Name" },
                    { key: "itemCode", label: "Item Code" },
                    { key: "itemDescription", label: "Item Description" },
                  ]}
                  filename="brands"
                />
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Name</th>
                      <th>Item</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {brands.map((b) => (
                      <tr key={b.id}>
                        <td className="mono">{b.sku}</td>
                        <td>{b.name}</td>
                        <td>
                          {b.itemCode} · {b.itemDescription}
                        </td>
                        <td className="actions">
                          <HistoryButton entityType="BrandVariant" entityId={b.id} />
                          <button className="btn sm ghost" onClick={() => setViewBrand(b)}>
                            View
                          </button>
                          <button className="btn sm ghost" onClick={() => openEditBrand(b)}>
                            Edit
                          </button>
                          <button className="btn sm danger" onClick={() => setDeleteBrand(b)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text="No brands." />
            );
          })()}
        </div>
      )}

      {tab === "batches" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button
              className="btn amber"
              onClick={() => {
                setBatchForm({
                  itemId: "",
                  brandVariantId: "",
                  batchNo: "",
                  expiryDate: "",
                  quantity: "",
                  warehouseId: "",
                  unitCost: "",
                });
                setEditBatch(null);
                setShowBatch(true);
              }}
            >
              + New Batch
            </button>
          </div>
          {batches.error && <ErrorBanner message={batches.error} />}
          {err && <ErrorBanner message={err} />}
          {batches.loading ? (
            <Loading />
          ) : !batches.data?.length ? (
            <Empty />
          ) : (
            <div className="tbl-wrap">
              <ListToolbar
                q={batchQ}
                setQ={setBatchQ}
                rows={filteredBatches}
                columns={[
                  { key: "batchNo", label: "Batch" },
                  { key: "expiryDate", label: "Expiry" },
                ]}
                filename="batches"
              />
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Item</th>
                    <th>Variant</th>
                    <th>Warehouse</th>
                    <th>Qty</th>
                    <th>Expiry</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredBatches ?? []).map((b) => (
                    <tr key={b.id}>
                      <td className="mono">{b.batchNo}</td>
                      <td>
                        {b.item.code} · {b.item.description}
                      </td>
                      <td>{b.brandVariant?.name ?? "—"}</td>
                      <td className="mono">{b.warehouse.code}</td>
                      <td className="num">{b.quantity}</td>
                      <td className="mono">{new Date(b.expiryDate).toLocaleDateString("en-GB")}</td>
                      <td className="actions">
                        <HistoryButton entityType="Batch" entityId={b.id} />
                        <button className="btn sm ghost" onClick={() => setViewBatch(b)}>
                          View
                        </button>
                        <button className="btn sm ghost" onClick={() => openEditBatch(b)}>
                          Edit
                        </button>
                        <button className="btn sm danger" onClick={() => setDeleteBatch(b)}>
                          Delete
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

      {tab === "alerts" && (
        <div className="card">
          {alerts.error && <ErrorBanner message={alerts.error} />}
          {alerts.loading ? (
            <Loading />
          ) : !alerts.data?.length ? (
            <Empty text="No batches expiring within 60 days." />
          ) : (
            <div className="tbl-wrap">
              <ListToolbar
                q={alertQ}
                setQ={setAlertQ}
                rows={filteredAlerts}
                columns={[
                  { key: "daysLeft", label: "Days left" },
                  { key: "tier", label: "Risk" },
                ]}
                filename="expiry-alerts"
              />
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th>Qty</th>
                    <th>Days left</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredAlerts ?? []).map((a, idx) => (
                    <tr key={idx}>
                      <td className="mono">{a.batch.batchNo}</td>
                      <td>{a.batch.item.description}</td>
                      <td className="mono">{a.batch.warehouse.code}</td>
                      <td className="num">{a.batch.quantity}</td>
                      <td className="num">{a.daysLeft}</td>
                      <td>
                        <Badge status={a.tier <= 7 ? "CRITICAL" : a.tier <= 15 ? "WARNING" : "OK"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "rop" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button
              className="btn amber"
              onClick={() => {
                setRopForm({
                  itemId: "",
                  warehouseId: "",
                  safetyStock: "",
                  reorderPoint: "",
                  leadTimeDays: "",
                  consumptionVelocity: "",
                });
                setEditRop(null);
                setShowRop(true);
              }}
            >
              + New Reorder Point
            </button>
          </div>
          {rops.error && <ErrorBanner message={rops.error} />}
          {err && <ErrorBanner message={err} />}
          {rops.loading ? (
            <Loading />
          ) : !rops.data?.length ? (
            <Empty text="No reorder points configured." />
          ) : (
            <div className="tbl-wrap">
              <ListToolbar
                q={ropQ}
                setQ={setRopQ}
                rows={filteredRops}
                columns={[
                  { key: "reorderPoint", label: "ROP" },
                  { key: "safetyStock", label: "Safety" },
                  { key: "leadTimeDays", label: "Lead (days)" },
                  { key: "consumptionVelocity", label: "Velocity" },
                ]}
                filename="reorder-points"
              />
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th>ROP</th>
                    <th>Safety</th>
                    <th>Lead (days)</th>
                    <th>Velocity</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredRops ?? []).map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.item.code} · {r.item.description}
                      </td>
                      <td className="mono">{r.warehouse.code}</td>
                      <td className="num">{r.reorderPoint}</td>
                      <td className="num">{r.safetyStock}</td>
                      <td className="num">{r.leadTimeDays}</td>
                      <td className="num">{r.consumptionVelocity}</td>
                      <td className="actions">
                        <HistoryButton entityType="ReorderPoint" entityId={r.id} />
                        <button className="btn sm ghost" onClick={() => setViewRop(r)}>
                          View
                        </button>
                        <button className="btn sm ghost" onClick={() => openEditRop(r)}>
                          Edit
                        </button>
                        <button className="btn sm danger" onClick={() => setDeleteRop(r)}>
                          Delete
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

      {tab === "adjustments" && (
        <div className="card">
          {adjustments.error && <ErrorBanner message={adjustments.error} />}
          {err && <ErrorBanner message={err} />}
          {adjustments.loading ? (
            <Loading />
          ) : !adjustments.data?.length ? (
            <Empty text="No adjustments yet. Complete a stocktake to generate variance adjustments." />
          ) : (
            <div className="tbl-wrap">
              <ListToolbar
                q={adjQ}
                setQ={setAdjQ}
                rows={filteredAdjustments}
                columns={[
                  { key: "number", label: "Adjustment" },
                  { key: "reason", label: "Reason" },
                  { key: "status", label: "Status" },
                ]}
                filename="adjustments"
              />
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Adjustment</th>
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th>Qty</th>
                    <th>Reason</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredAdjustments ?? []).map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{a.number}</td>
                      <td>
                        {a.item.code} · {a.item.description}
                      </td>
                      <td className="mono">{a.warehouse.code}</td>
                      <td className="num">{a.quantity}</td>
                      <td>
                        <Badge status={a.reason.replace(/_/g, " ")} />
                      </td>
                      <td className="num">{a.amount ? a.amount.toLocaleString() : "—"}</td>
                      <td>
                        <Badge status={a.status} />
                      </td>
                      <td className="mono">{new Date(a.createdAt).toLocaleDateString("en-GB")}</td>
                      <td className="actions">
                        <HistoryButton entityType="Adjustment" entityId={a.id} />
                        <button className="btn sm ghost" onClick={() => setViewAdj(a)}>
                          View
                        </button>
                        <button className="btn sm ghost" onClick={() => openEditAdj(a)}>
                          Edit
                        </button>
                        {a.status === "PENDING" && (
                          <>
                            <button className="btn sm" onClick={() => setApproveAdj(a)}>
                              Approve
                            </button>
                            <button className="btn sm danger" onClick={() => setDeleteAdj(a)}>
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showItem && (
        <Modal title={editItem ? "Edit Item" : "New Item"} onClose={() => setShowItem(false)}>
          <form onSubmit={submitItem}>
            {err && <ErrorBanner message={err} />}
            <div className="field">
              <label>Code</label>
              <input value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} required />
            </div>
            <div className="field">
              <label>Description</label>
              <input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} required />
            </div>
            <div className="field">
              <label>Unit of Measure</label>
              <input value={itemForm.uom} onChange={(e) => setItemForm({ ...itemForm, uom: e.target.value })} placeholder="Each" />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Scope</label>
                <select value={itemForm.scope} onChange={(e) => setItemForm({ ...itemForm, scope: e.target.value })} required>
                  <option value="PROJECT_ISOLATED">Project Isolated</option>
                  <option value="CROSS_PROJECT">Cross Project</option>
                </select>
              </div>
              <div className="field">
                <label>Project ID</label>
                <input type="number" value={itemForm.projectId} onChange={(e) => setItemForm({ ...itemForm, projectId: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Category</label>
                <input value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} />
              </div>
              <div className="field">
                <label>ABC Class</label>
                <input value={itemForm.abcClass} onChange={(e) => setItemForm({ ...itemForm, abcClass: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Valuation Method</label>
              <select value={itemForm.valuationMethod} onChange={(e) => setItemForm({ ...itemForm, valuationMethod: e.target.value })}>
                <option value="WAC">WAC</option>
                <option value="FIFO">FIFO</option>
              </select>
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowItem(false)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : editItem ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showWarehouse && (
        <Modal title={editWh ? "Edit Warehouse" : "New Warehouse"} onClose={() => setShowWarehouse(false)}>
          <form onSubmit={submitWarehouse}>
            {err && <ErrorBanner message={err} />}
            <div className="form-row">
              <div className="field">
                <label>Code</label>
                <input value={whForm.code} onChange={(e) => setWhForm({ ...whForm, code: e.target.value })} required />
              </div>
              <div className="field">
                <label>Name</label>
                <input value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Type</label>
                <select value={whForm.type} onChange={(e) => setWhForm({ ...whForm, type: e.target.value })} required>
                  <option value="PROJECT_CENTRAL">Project Central</option>
                  <option value="GROUP_CENTRAL">Group Central</option>
                  <option value="BRANCH">Branch</option>
                  <option value="TRANSIT">Transit</option>
                </select>
              </div>
              <div className="field">
                <label>Project ID</label>
                <input type="number" value={whForm.projectId} onChange={(e) => setWhForm({ ...whForm, projectId: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Owner</label>
              <input value={whForm.owner} onChange={(e) => setWhForm({ ...whForm, owner: e.target.value })} />
            </div>
            <div className="field">
              <label>Address</label>
              <input value={whForm.address} onChange={(e) => setWhForm({ ...whForm, address: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="field">
                <label>City</label>
                <input value={whForm.city} onChange={(e) => setWhForm({ ...whForm, city: e.target.value })} />
              </div>
              <div className="field">
                <label>Country</label>
                <input value={whForm.country} onChange={(e) => setWhForm({ ...whForm, country: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowWarehouse(false)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : editWh ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showBrand && (
        <Modal title={editBrand ? "Edit Brand" : "New Brand"} onClose={() => setShowBrand(false)}>
          <form onSubmit={submitBrand}>
            {err && <ErrorBanner message={err} />}
            <div className="field">
              <label>Item</label>
              <select value={brandForm.itemId} onChange={(e) => setBrandForm({ ...brandForm, itemId: e.target.value })} required>
                <option value="">Select item…</option>
                {(items.data ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} · {i.description}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Name</label>
                <input value={brandForm.name} onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })} required />
              </div>
              <div className="field">
                <label>SKU</label>
                <input value={brandForm.sku} onChange={(e) => setBrandForm({ ...brandForm, sku: e.target.value })} required />
              </div>
            </div>
            <div className="field">
              <label>Barcode</label>
              <input value={brandForm.barcode} onChange={(e) => setBrandForm({ ...brandForm, barcode: e.target.value })} />
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowBrand(false)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : editBrand ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showBatch && (
        <Modal title={editBatch ? "Edit Batch" : "New Batch"} onClose={() => setShowBatch(false)}>
          <form onSubmit={submitBatch}>
            {err && <ErrorBanner message={err} />}
            <div className="form-row">
              <div className="field">
                <label>Item</label>
                <select value={batchForm.itemId} onChange={(e) => setBatchForm({ ...batchForm, itemId: e.target.value })} required>
                  <option value="">Select item…</option>
                  {(items.data ?? []).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.code} · {i.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Warehouse</label>
                <select value={batchForm.warehouseId} onChange={(e) => setBatchForm({ ...batchForm, warehouseId: e.target.value })} required>
                  <option value="">Select warehouse…</option>
                  {(warehouses.data ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} · {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Batch No</label>
                <input value={batchForm.batchNo} onChange={(e) => setBatchForm({ ...batchForm, batchNo: e.target.value })} required />
              </div>
              <div className="field">
                <label>Expiry Date</label>
                <input type="date" value={batchForm.expiryDate} onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Quantity</label>
                <input type="number" min="1" value={batchForm.quantity} onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })} required />
              </div>
              <div className="field">
                <label>Brand Variant</label>
                <select value={batchForm.brandVariantId} onChange={(e) => setBatchForm({ ...batchForm, brandVariantId: e.target.value })}>
                  <option value="">None</option>
                  {(items.data ?? [])
                    .flatMap((i) => i.brandVariants.map((v) => ({ ...v, itemCode: i.code })))
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.itemCode} · {v.name} ({v.sku})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Unit Cost</label>
              <input type="number" min="0" step="0.01" value={batchForm.unitCost} onChange={(e) => setBatchForm({ ...batchForm, unitCost: e.target.value })} />
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowBatch(false)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : editBatch ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showRop && (
        <Modal title={editRop ? "Edit Reorder Point" : "New Reorder Point"} onClose={() => setShowRop(false)}>
          <form onSubmit={submitRop}>
            {err && <ErrorBanner message={err} />}
            <div className="form-row">
              <div className="field">
                <label>Item</label>
                <select value={ropForm.itemId} onChange={(e) => setRopForm({ ...ropForm, itemId: e.target.value })} required>
                  <option value="">Select item…</option>
                  {(items.data ?? []).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.code} · {i.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Warehouse</label>
                <select value={ropForm.warehouseId} onChange={(e) => setRopForm({ ...ropForm, warehouseId: e.target.value })} required>
                  <option value="">Select warehouse…</option>
                  {(warehouses.data ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} · {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Reorder Point</label>
                <input type="number" min="0" value={ropForm.reorderPoint} onChange={(e) => setRopForm({ ...ropForm, reorderPoint: e.target.value })} />
              </div>
              <div className="field">
                <label>Safety Stock</label>
                <input type="number" min="0" value={ropForm.safetyStock} onChange={(e) => setRopForm({ ...ropForm, safetyStock: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Lead Time (days)</label>
                <input type="number" min="0" value={ropForm.leadTimeDays} onChange={(e) => setRopForm({ ...ropForm, leadTimeDays: e.target.value })} />
              </div>
              <div className="field">
                <label>Consumption Velocity</label>
                <input type="number" min="0" value={ropForm.consumptionVelocity} onChange={(e) => setRopForm({ ...ropForm, consumptionVelocity: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowRop(false)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : editRop ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {viewItem && (
        <Modal title={`Item · ${viewItem.code}`} onClose={() => setViewItem(null)}>
          <ViewFields
            fields={[
              ["Code", viewItem.code],
              ["Description", viewItem.description],
              ["Category", viewItem.category ?? "—"],
              ["Scope", viewItem.scope.replace(/_/g, " ")],
              ["ABC Class", viewItem.abcClass ?? "—"],
              ["Valuation Method", viewItem.valuationMethod],
              ["Project ID", viewItem.projectId ? String(viewItem.projectId) : "—"],
              ["Variants", viewItem.brandVariants.map((v) => `${v.name} (${v.sku})`).join(", ") || "—"],
              ["Unit of Measure", viewItem.uom || "—"],
            ]}
          />
        </Modal>
      )}

      {viewBatch && (
        <Modal title={`Batch · ${viewBatch.batchNo}`} onClose={() => setViewBatch(null)}>
          <ViewFields
            fields={[
              ["Batch No", viewBatch.batchNo],
              ["Item", `${viewBatch.item.code} · ${viewBatch.item.description}`],
              ["Variant", viewBatch.brandVariant?.name ?? "—"],
              ["Warehouse", viewBatch.warehouse.code],
              ["Quantity", String(viewBatch.quantity)],
              ["Expiry", new Date(viewBatch.expiryDate).toLocaleDateString("en-GB")],
            ]}
          />
        </Modal>
      )}

      {viewRop && (
        <Modal title="Reorder Point" onClose={() => setViewRop(null)}>
          <ViewFields
            fields={[
              ["Item", `${viewRop.item.code} · ${viewRop.item.description}`],
              ["Warehouse", viewRop.warehouse.code],
              ["Reorder Point", String(viewRop.reorderPoint)],
              ["Safety Stock", String(viewRop.safetyStock)],
              ["Lead Time (days)", String(viewRop.leadTimeDays)],
              ["Consumption Velocity", String(viewRop.consumptionVelocity)],
            ]}
          />
        </Modal>
      )}

      {viewWh && (
        <Modal title={`Warehouse · ${viewWh.code}`} onClose={() => setViewWh(null)}>
          <ViewFields
            fields={[
              ["Code", viewWh.code],
              ["Name", viewWh.name],
              ["Type", viewWh.type.replace(/_/g, " ")],
              ["Project ID", viewWh.projectId ? String(viewWh.projectId) : "—"],
              ["Owner", viewWh.owner ?? "—"],
              ["Address", viewWh.address ?? "—"],
              ["City", viewWh.city ?? "—"],
              ["Country", viewWh.country],
            ]}
          />
        </Modal>
      )}

      {viewBrand && (
        <Modal title={`Brand · ${viewBrand.name}`} onClose={() => setViewBrand(null)}>
          <ViewFields
            fields={[
              ["Name", viewBrand.name],
              ["SKU", viewBrand.sku],
              ["Item", `${viewBrand.itemCode} · ${viewBrand.itemDescription}`],
              ["Barcode", viewBrand.barcode ?? "—"],
            ]}
          />
        </Modal>
      )}

      {deleteItem && (
        <ConfirmDialog
          title="Delete Item"
          message={`Delete item "${deleteItem.code}"? This cannot be undone.`}
          busy={busy}
          onConfirm={confirmDeleteItem}
          onCancel={() => setDeleteItem(null)}
        />
      )}

      {deleteBatch && (
        <ConfirmDialog
          title="Delete Batch"
          message={`Delete batch "${deleteBatch.batchNo}"? This cannot be undone.`}
          busy={busy}
          onConfirm={confirmDeleteBatch}
          onCancel={() => setDeleteBatch(null)}
        />
      )}

      {deleteRop && (
        <ConfirmDialog
          title="Delete Reorder Point"
          message={`Delete the reorder point for "${deleteRop.item.code}" at "${deleteRop.warehouse.code}"? This cannot be undone.`}
          busy={busy}
          onConfirm={confirmDeleteRop}
          onCancel={() => setDeleteRop(null)}
        />
      )}

      {deleteWh && (
        <ConfirmDialog
          title="Delete Warehouse"
          message={`Delete warehouse "${deleteWh.code}"? This cannot be undone.`}
          busy={busy}
          onConfirm={confirmDeleteWh}
          onCancel={() => setDeleteWh(null)}
        />
      )}

      {deleteBrand && (
        <ConfirmDialog
          title="Delete Brand"
          message={`Delete brand "${deleteBrand.name}" (${deleteBrand.sku})? This cannot be undone.`}
          busy={busy}
          onConfirm={confirmDeleteBrand}
          onCancel={() => setDeleteBrand(null)}
        />
      )}

      {showAdj && editAdj && (
        <Modal title={`Edit Adjustment · ${editAdj.number}`} onClose={() => setShowAdj(false)}>
          <form onSubmit={submitAdjustment}>
            {err && <ErrorBanner message={err} />}
            <div className="form-row">
              <div className="field">
                <label>Reason</label>
                <select value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} required>
                  <option value="COUNT_DIFFERENCE">Count difference</option>
                  <option value="WASTE">Waste</option>
                  <option value="DAMAGE">Damage</option>
                  <option value="THEFT">Theft</option>
                </select>
              </div>
              <div className="field">
                <label>Status</label>
                <select value={adjForm.status} onChange={(e) => setAdjForm({ ...adjForm, status: e.target.value })} required>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Amount</label>
                <input type="number" step="0.01" value={adjForm.amount} onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })} />
              </div>
              <div className="field">
                <label>Approval Level</label>
                <input type="number" min="1" value={adjForm.approvalLevel} onChange={(e) => setAdjForm({ ...adjForm, approvalLevel: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowAdj(false)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {viewAdj && (
        <Modal title={`Adjustment · ${viewAdj.number}`} onClose={() => setViewAdj(null)}>
          <ViewFields
            fields={[
              ["Number", viewAdj.number],
              ["Item", `${viewAdj.item.code} · ${viewAdj.item.description}`],
              ["Warehouse", viewAdj.warehouse.code],
              ["Quantity", String(viewAdj.quantity)],
              ["Reason", viewAdj.reason.replace(/_/g, " ")],
              ["Amount", viewAdj.amount ? viewAdj.amount.toLocaleString() : "—"],
              ["Status", viewAdj.status.replace(/_/g, " ")],
              ["Approval Level", String(viewAdj.approvalLevel)],
              ["Stocktake", viewAdj.stocktake?.number ?? "—"],
              ["Requested by", viewAdj.requestedBy?.name ?? "—"],
              ["Approved by", viewAdj.approvedBy?.name ?? "—"],
              ["Created", new Date(viewAdj.createdAt).toLocaleDateString("en-GB")],
            ]}
          />
        </Modal>
      )}

      {approveAdj && (
        <Modal title={`Approve ${approveAdj.number}`} onClose={() => setApproveAdj(null)}>
          <p style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
            Approve adjustment {approveAdj.number} ({approveAdj.quantity} units) for {approveAdj.item.code} at {approveAdj.warehouse.code}? Approving posts the stock correction.
          </p>
          {err && <ErrorBanner message={err} />}
          <div className="modal-actions">
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={() => submitAdjustmentDecision(false)} disabled={busy}>
              Reject
            </button>
            <button type="button" className="btn" onClick={() => submitAdjustmentDecision(true)} disabled={busy}>
              {busy ? "Saving…" : "Approve"}
            </button>
          </div>
        </Modal>
      )}

      {deleteAdj && (
        <ConfirmDialog
          title="Delete Adjustment"
          message={`Delete adjustment "${deleteAdj.number}"? Only pending adjustments can be deleted.`}
          busy={busy}
          onConfirm={confirmDeleteAdjustment}
          onCancel={() => setDeleteAdj(null)}
        />
      )}

      <Toast message={msg} onDone={() => setMsg(null)} />
    </>
  );
}
