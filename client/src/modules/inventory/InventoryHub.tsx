import { useMemo, useState } from "react";
import { Item, Warehouse, Batch, Rop, Adjustment, Brand } from "./types";
import { StockMatrixGrid } from "./StockMatrixGrid";
import { BatchFefoTimeline } from "./BatchFefoTimeline";
import { StockAdjustmentDrawer } from "./StockAdjustmentDrawer";
import { ItemDrawer } from "./ItemDrawer";
import { WarehouseDrawer } from "./WarehouseDrawer";
import { BatchDrawer } from "./BatchDrawer";
import { RopDrawer } from "./RopDrawer";
import { MasterDataHub } from "./MasterDataHub";
import {
  useApi,
  apiReq,
  useListFilter,
  ListToolbar,
  ExportColumn,
  Loading,
  ErrorBanner,
  ConfirmDialog,
  Toast,
  HistoryButton,
} from "../../components";
import { StatusBadge } from "../../components/StatusBadge";
import { KpiCard } from "../../components/MasterDetailView";
import { useI18n } from "../../lib/i18n";

export default function InventoryHub() {
  const { t, isRtl } = useI18n();
  const [tab, setTab] = useState<"matrix" | "fefo" | "items" | "rop" | "adjustments" | "warehouses" | "masterdata">("matrix");

  // API Calls
  const itemsApi = useApi<Item[]>("/inventory/items");
  const batchesApi = useApi<Batch[]>("/inventory/batches");
  const ropsApi = useApi<Rop[]>("/inventory/reorder-points");
  const adjustmentsApi = useApi<Adjustment[]>("/stocktaking/adjustments");
  const warehousesApi = useApi<Warehouse[]>("/inventory/warehouses");

  const items = itemsApi.data || [];
  const batches = batchesApi.data || [];
  const rops = ropsApi.data || [];
  const adjustments = adjustmentsApi.data || [];
  const warehouses = warehousesApi.data || [];

  // Drawers & Modals
  const [drawerItem, setDrawerItem] = useState<{ open: boolean; edit?: Item | null }>({ open: false });
  const [drawerWh, setDrawerWh] = useState<{ open: boolean; edit?: Warehouse | null }>({ open: false });
  const [drawerBatch, setDrawerBatch] = useState<{ open: boolean; edit?: Batch | null }>({ open: false });
  const [drawerRop, setDrawerRop] = useState<{ open: boolean; edit?: Rop | null }>({ open: false });
  const [drawerAdj, setDrawerAdj] = useState<{
    open: boolean;
    initialItem?: Item | null;
    initialWarehouseId?: number | null;
    edit?: Adjustment | null;
  }>({ open: false });

  // Delete & Approve Modals
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: number; label: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Filters for Items tab
  const { q: itemQ, setQ: setItemQ, filtered: filteredItems } = useListFilter<Item>(items, ["code", "description", "category", "abcClass"]);
  const { q: ropQ, setQ: setRopQ, filtered: filteredRops } = useListFilter<Rop>(rops, ["item.code", "item.description", "warehouse.code"]);
  const { q: adjQ, setQ: setAdjQ, filtered: filteredAdjustments } = useListFilter<Adjustment>(adjustments, ["number", "reason", "status", "item.code"]);
  const { q: whQ, setQ: setWhQ, filtered: filteredWarehouses } = useListFilter<Warehouse>(warehouses, ["code", "name", "type", "owner"]);

  // KPIs
  const totalStockQty = useMemo(() => batches.reduce((acc, b) => acc + Number(b.quantity || 0), 0), [batches]);
  const expiringSoonCount = useMemo(() => {
    const now = new Date();
    return batches.filter((b) => {
      const diff = new Date(b.expiryDate).getTime() - now.getTime();
      return diff <= 30 * 24 * 60 * 60 * 1000;
    }).length;
  }, [batches]);
  const lowStockCount = useMemo(() => {
    const stockMap = new Map<number, number>();
    batches.forEach((b) => stockMap.set(b.itemId, (stockMap.get(b.itemId) || 0) + Number(b.quantity)));
    let count = 0;
    rops.forEach((r) => {
      const stock = stockMap.get(r.itemId) || 0;
      if (stock <= Number(r.reorderPoint)) count++;
    });
    return count;
  }, [batches, rops]);

  const refreshAll = () => {
    itemsApi.reload();
    batchesApi.reload();
    ropsApi.reload();
    adjustmentsApi.reload();
    warehousesApi.reload();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      if (deleteTarget.type === "item") await apiReq("DELETE", `/inventory/items/${deleteTarget.id}`);
      else if (deleteTarget.type === "warehouse") await apiReq("DELETE", `/inventory/warehouses/${deleteTarget.id}`);
      else if (deleteTarget.type === "batch") await apiReq("DELETE", `/inventory/batches/${deleteTarget.id}`);
      else if (deleteTarget.type === "rop") await apiReq("DELETE", `/inventory/reorder-points/${deleteTarget.id}`);
      else if (deleteTarget.type === "adjustment") await apiReq("DELETE", `/stocktaking/adjustments/${deleteTarget.id}`);
      setToast(`${deleteTarget.label} deleted successfully.`);
      setDeleteTarget(null);
      refreshAll();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const handleApproveAdj = async (adj: Adjustment) => {
    setBusy(true);
    try {
      await apiReq("POST", `/stocktaking/adjustments/${adj.id}/approve`, {});
      setToast(`Adjustment #${adj.number} approved and posted to GL.`);
      adjustmentsApi.reload();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  };

  // Export Columns
  const itemCols: ExportColumn<Item>[] = [
    { key: "code", label: "Item Code" },
    { key: "description", label: "Description" },
    { key: "category", label: "Category" },
    { key: "uom", label: "UOM" },
    { key: "valuationMethod", label: "Valuation" },
    { key: "scope", label: "Scope" },
  ];

  const ropCols: ExportColumn<Rop>[] = [
    { key: "item.code", label: "Item Code" },
    { key: "warehouse.code", label: "Warehouse" },
    { key: "reorderPoint", label: "ROP" },
    { key: "safetyStock", label: "Safety Stock" },
    { key: "leadTimeDays", label: "Lead Time (Days)" },
  ];

  const adjCols: ExportColumn<Adjustment>[] = [
    { key: "number", label: "Adjustment #" },
    { key: "item.code", label: "Item" },
    { key: "warehouse.code", label: "Warehouse" },
    { key: "quantity", label: "Qty Delta" },
    { key: "reason", label: "Reason" },
    { key: "amount", label: "Amount (EGP)" },
    { key: "status", label: "Status" },
  ];

  const whCols: ExportColumn<Warehouse>[] = [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "type", label: "Type" },
    { key: "owner", label: "Manager" },
    { key: "city", label: "City" },
  ];

  const loading = itemsApi.loading || batchesApi.loading || warehousesApi.loading;

  return (
    <div className="inventory-module-container">
      {/* Top Header */}
      <div className="topbar">
        <div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 600 }}>
            {t("inv.title")}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            {t("inv.subtitle")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn ghost" onClick={refreshAll} title={isRtl ? "مزامنة البيانات" : "Refresh data"}>
            ↻ {isRtl ? "مزامنة" : "Sync"}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setDrawerAdj({ open: true })}
          >
            {t("inv.btn.new_adjustment")}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setDrawerBatch({ open: true })}
          >
            {t("inv.btn.new_batch")}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setDrawerItem({ open: true })}
          >
            {t("inv.btn.new_item")}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <KpiCard
          label={isRtl ? "إجمالي الأصناف النشطة" : "Total Active SKUs"}
          value={items.length}
          subtext={isRtl ? `${warehouses.length} مستودعات وفروع مسجلة` : `${warehouses.length} Active Warehouse Locations`}
          icon="▤"
          onClick={() => setTab("items")}
        />
        <KpiCard
          label={t("inv.col.stock_on_hand")}
          value={totalStockQty.toLocaleString(isRtl ? "ar-EG" : "en-US")}
          subtext={isRtl ? "إجمالي الوحدات المتاحة بجميع الفروع" : "Total units across all nodes"}
          icon="◈"
          onClick={() => setTab("matrix")}
          accent="amber"
        />
        <KpiCard
          label={isRtl ? "شحنات تقترب من الانتهاء (≤ 30 يوم)" : "Expiring Batches (≤ 30d)"}
          value={expiringSoonCount}
          subtext={isRtl ? "تدوير المخزون حسب الصلاحية (FEFO)" : "FEFO rotation required"}
          icon="⏳"
          onClick={() => setTab("fefo")}
          accent={expiringSoonCount > 0 ? "red" : "green"}
        />
        <KpiCard
          label={t("dash.kpi.low_stock_alerts")}
          value={lowStockCount}
          subtext={isRtl ? "أصناف بلغت نقطة إعادة الطلب (ROP)" : "Items below reorder point"}
          icon="⚠️"
          onClick={() => setTab("rop")}
          accent={lowStockCount > 0 ? "red" : "green"}
        />
      </div>

      {/* Modern Navigation Tabs */}
      <div className="tabs" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 20 }}>
        <button
          className={`tab ${tab === "matrix" ? "active" : ""}`}
          onClick={() => setTab("matrix")}
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "matrix" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "matrix" ? "var(--amber)" : "var(--muted)" }}
        >
          📊 {t("inv.tab.matrix")}
        </button>
        <button
          className={`tab ${tab === "fefo" ? "active" : ""}`}
          onClick={() => setTab("fefo")}
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "fefo" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "fefo" ? "var(--amber)" : "var(--muted)" }}
        >
          ⏳ {t("inv.tab.batches")} ({batches.length})
        </button>
        <button
          className={`tab ${tab === "items" ? "active" : ""}`}
          onClick={() => setTab("items")}
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "items" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "items" ? "var(--amber)" : "var(--muted)" }}
        >
          📦 {t("inv.tab.items")} ({items.length})
        </button>
        <button
          className={`tab ${tab === "rop" ? "active" : ""}`}
          onClick={() => setTab("rop")}
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "rop" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "rop" ? "var(--amber)" : "var(--muted)" }}
        >
          ⚙️ {t("inv.tab.rop")} ({rops.length})
        </button>
        <button
          className={`tab ${tab === "adjustments" ? "active" : ""}`}
          onClick={() => setTab("adjustments")}
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "adjustments" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "adjustments" ? "var(--amber)" : "var(--muted)" }}
        >
          📝 {t("inv.tab.adjustments")} ({adjustments.length})
        </button>
        <button
          className={`tab ${tab === "warehouses" ? "active" : ""}`}
          onClick={() => setTab("warehouses")}
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "warehouses" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "warehouses" ? "var(--amber)" : "var(--muted)" }}
        >
          🏢 {t("inv.tab.warehouses")} ({warehouses.length})
        </button>
        <button
          className={`tab ${tab === "masterdata" ? "active" : ""}`}
          onClick={() => setTab("masterdata")}
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "masterdata" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "masterdata" ? "var(--amber)" : "var(--muted)" }}
        >
          🏷️ {t("inv.tab.master")}
        </button>
      </div>

      {loading && <Loading />}
      {itemsApi.error && <ErrorBanner message={itemsApi.error} />}

      {/* Tab 1: Multi-Warehouse Matrix */}
      {tab === "matrix" && (
        <StockMatrixGrid
          items={items}
          warehouses={warehouses}
          batches={batches}
          rops={rops}
          onSelectItem={(it) => setDrawerItem({ open: true, edit: it })}
          onAdjustItem={(it, whId) => setDrawerAdj({ open: true, initialItem: it, initialWarehouseId: whId })}
          onRequestTransfer={(it) => {
            setToast(`Transfer initiated for ${it.code}. Head to the Transfers tab to dispatch.`);
          }}
        />
      )}

      {/* Tab 2: FEFO Batches & Freshness */}
      {tab === "fefo" && (
        <BatchFefoTimeline
          batches={batches}
          onAdjustBatch={(b) => {
            const it = items.find((i) => i.id === b.itemId);
            setDrawerAdj({ open: true, initialItem: it, initialWarehouseId: b.warehouseId });
          }}
          onTransferBatch={(b) => {
            setToast(`Transfer requested for batch #${b.batchNo}.`);
          }}
        />
      )}

      {/* Tab 3: Catalog & Master Items */}
      {tab === "items" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Catalog items with multi-brand SKU variants and valuation models
            </div>
            <ListToolbar
              q={itemQ}
              setQ={setItemQ}
              rows={filteredItems}
              columns={itemCols}
              filename="master_items_catalog"
              placeholder="Search code, description, category…"
            />
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>UOM</th>
                  <th>Valuation</th>
                  <th>ABC</th>
                  <th>Scope</th>
                  <th>Variants / SKUs</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filteredItems || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                      No items found.
                    </td>
                  </tr>
                ) : (
                  (filteredItems || []).map((i) => (
                    <tr key={i.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{i.code}</td>
                      <td>{i.description}</td>
                      <td>{i.category || "—"}</td>
                      <td>{i.uom}</td>
                      <td><span className="mono">{i.valuationMethod}</span></td>
                      <td>{i.abcClass ? <span className="mono font-bold">{i.abcClass}</span> : "—"}</td>
                      <td><StatusBadge status={i.scope} tone={i.scope === "CROSS_PROJECT" ? "purple" : "neutral"} /></td>
                      <td>
                        {i.brandVariants?.length > 0 ? (
                          <span style={{ fontSize: 12 }}>
                            {i.brandVariants.length} SKU{i.brandVariants.length > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>Base only</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setDrawerItem({ open: true, edit: i })}
                          style={{ marginRight: 4 }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setDeleteTarget({ type: "item", id: i.id, label: `Item ${i.code}` })}
                          style={{ marginRight: 4 }}
                        >
                          Delete
                        </button>
                        <HistoryButton entityType="Item" entityId={i.id} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: ROP & Safety Stock */}
      {tab === "rop" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Configured reorder points, consumption velocity, and safety stocks
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn sm" onClick={() => setDrawerRop({ open: true })}>
                + Configure ROP
              </button>
              <ListToolbar
                q={ropQ}
                setQ={setRopQ}
                rows={filteredRops}
                columns={ropCols}
                filename="rop_thresholds"
                placeholder="Search item, warehouse…"
              />
            </div>
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Item Description</th>
                  <th>Warehouse</th>
                  <th style={{ textAlign: "right" }}>Reorder Point</th>
                  <th style={{ textAlign: "right" }}>Safety Stock</th>
                  <th style={{ textAlign: "right" }}>Lead Time</th>
                  <th style={{ textAlign: "right" }}>Daily Velocity</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filteredRops || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                      No reorder point rules configured.
                    </td>
                  </tr>
                ) : (
                  (filteredRops || []).map((r) => (
                    <tr key={r.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{r.item?.code}</td>
                      <td>{r.item?.description}</td>
                      <td>{r.warehouse?.code}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600, color: "var(--amber)" }}>
                        {r.reorderPoint}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{r.safetyStock}</td>
                      <td style={{ textAlign: "right" }}>{r.leadTimeDays} days</td>
                      <td style={{ textAlign: "right" }}>{r.consumptionVelocity}/day</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setDrawerRop({ open: true, edit: r })}
                          style={{ marginRight: 4 }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setDeleteTarget({ type: "rop", id: r.id, label: `ROP rule for ${r.item?.code}` })}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Adjustments */}
      {tab === "adjustments" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Physical inventory variances, spoilage waste, and approved stock reconciliations
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn sm" onClick={() => setDrawerAdj({ open: true })}>
                + Record Adjustment
              </button>
              <ListToolbar
                q={adjQ}
                setQ={setAdjQ}
                rows={filteredAdjustments}
                columns={adjCols}
                filename="stock_adjustments"
                placeholder="Search number, reason, item…"
              />
            </div>
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Adjustment #</th>
                  <th>Item</th>
                  <th>Warehouse</th>
                  <th style={{ textAlign: "right" }}>Qty Delta</th>
                  <th>Reason</th>
                  <th style={{ textAlign: "right" }}>Value (EGP)</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filteredAdjustments || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                      No adjustments on record.
                    </td>
                  </tr>
                ) : (
                  (filteredAdjustments || []).map((a) => (
                    <tr key={a.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{a.number}</td>
                      <td>{a.item?.code} — {a.item?.description}</td>
                      <td>{a.warehouse?.code}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600 }}>
                        {a.quantity > 0 ? `+${a.quantity}` : a.quantity}
                      </td>
                      <td><StatusBadge status={a.reason} tone="neutral" /></td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                        {Number(a.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td><StatusBadge status={a.status} /></td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {new Date(a.createdAt).toLocaleDateString("en-GB")}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {a.status === "PENDING" && (
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => handleApproveAdj(a)}
                            disabled={busy}
                            style={{ marginRight: 4, background: "#2e7d32", color: "#fff" }}
                          >
                            Approve
                          </button>
                        )}
                        <HistoryButton entityType="Adjustment" entityId={a.id} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Warehouses */}
      {tab === "warehouses" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Physical and virtual storage topologies across Holding & Project brands
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn sm" onClick={() => setDrawerWh({ open: true })}>
                + New Warehouse Node
              </button>
              <ListToolbar
                q={whQ}
                setQ={setWhQ}
                rows={filteredWarehouses}
                columns={whCols}
                filename="warehouse_locations"
                placeholder="Search code, name, city…"
              />
            </div>
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Manager / Owner</th>
                  <th>City / Country</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filteredWarehouses || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                      No warehouse locations found.
                    </td>
                  </tr>
                ) : (
                  (filteredWarehouses || []).map((w) => (
                    <tr key={w.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{w.code}</td>
                      <td>{w.name}</td>
                      <td><StatusBadge status={w.type} tone={w.type === "BRANCH" ? "info" : "purple"} /></td>
                      <td>{w.owner || "—"}</td>
                      <td>{w.city ? `${w.city}, ${w.country}` : w.country}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setDrawerWh({ open: true, edit: w })}
                          style={{ marginRight: 4 }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setDeleteTarget({ type: "warehouse", id: w.id, label: `Warehouse ${w.code}` })}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: Master Data & Units */}
      {tab === "masterdata" && (
        <MasterDataHub
          items={items}
          onRefreshItems={() => itemsApi.reload()}
        />
      )}

      {/* Drawers */}
      <ItemDrawer
        open={drawerItem.open}
        editItem={drawerItem.edit}
        onClose={() => setDrawerItem({ open: false })}
        onSuccess={(msg) => {
          setToast(msg);
          itemsApi.reload();
        }}
      />

      <WarehouseDrawer
        open={drawerWh.open}
        editWarehouse={drawerWh.edit}
        onClose={() => setDrawerWh({ open: false })}
        onSuccess={(msg) => {
          setToast(msg);
          warehousesApi.reload();
        }}
      />

      <BatchDrawer
        open={drawerBatch.open}
        editBatch={drawerBatch.edit}
        items={items}
        warehouses={warehouses}
        onClose={() => setDrawerBatch({ open: false })}
        onSuccess={(msg) => {
          setToast(msg);
          batchesApi.reload();
        }}
      />

      <RopDrawer
        open={drawerRop.open}
        editRop={drawerRop.edit}
        items={items}
        warehouses={warehouses}
        onClose={() => setDrawerRop({ open: false })}
        onSuccess={(msg) => {
          setToast(msg);
          ropsApi.reload();
        }}
      />

      <StockAdjustmentDrawer
        open={drawerAdj.open}
        initialItem={drawerAdj.initialItem}
        initialWarehouseId={drawerAdj.initialWarehouseId}
        editAdjustment={drawerAdj.edit}
        items={items}
        warehouses={warehouses}
        onClose={() => setDrawerAdj({ open: false })}
        onSuccess={(msg) => {
          setToast(msg);
          adjustmentsApi.reload();
          batchesApi.reload();
        }}
      />

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Confirm Removal"
          message={`Are you sure you want to delete ${deleteTarget.label}? This action cannot be undone.`}
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
