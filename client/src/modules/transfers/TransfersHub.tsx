import { useMemo, useState } from "react";
import { TransferOrder, TransferRequisition, AgingRow, Warehouse, Item } from "./types";
import { TransferDetailPane } from "./TransferDetailPane";
import { InTransitAgingBoard } from "./InTransitAgingBoard";
import { BranchReceiveDrawer } from "./BranchReceiveDrawer";
import { TransferRequestDrawer } from "./TransferRequestDrawer";
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
import { KpiCard, MasterDetailView } from "../../components/MasterDetailView";

export default function TransfersHub() {
  const [tab, setTab] = useState<"transit" | "orders" | "requisitions">("transit");
  const [selectedOrder, setSelectedOrder] = useState<TransferOrder | null>(null);

  // APIs
  const ordersApi = useApi<TransferOrder[]>("/transfers/orders");
  const reqsApi = useApi<TransferRequisition[]>("/transfers/requisitions");
  const agingApi = useApi<AgingRow[]>("/transfers/in-transit/aging");
  const warehousesApi = useApi<Warehouse[]>("/inventory/warehouses");
  const itemsApi = useApi<Item[]>("/inventory/items");

  const orders = ordersApi.data || [];
  const reqs = reqsApi.data || [];
  const aging = agingApi.data || [];
  const warehouses = warehousesApi.data || [];
  const items = itemsApi.data || [];

  // Drawers
  const [drawerReq, setDrawerReq] = useState<{ open: boolean; edit?: TransferRequisition | null }>({ open: false });
  const [drawerReceive, setDrawerReceive] = useState<{ open: boolean; order: TransferOrder | null }>({ open: false, order: null });

  // Dialogs
  const [confirmAction, setConfirmAction] = useState<{
    type: "dispatch" | "cancelOrder" | "cancelReq";
    id: number;
    title: string;
    message: string;
  } | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Filters
  const { q: orderQ, setQ: setOrderQ, filtered: filteredOrders } = useListFilter<TransferOrder>(orders, [
    "number",
    "status",
    "requisition.fromWarehouse.code",
    "requisition.toWarehouse.code",
  ]);

  const { q: reqQ, setQ: setReqQ, filtered: filteredReqs } = useListFilter<TransferRequisition>(reqs, [
    "number",
    "status",
    "fromWarehouse.code",
    "toWarehouse.code",
  ]);

  const refreshAll = () => {
    ordersApi.reload();
    reqsApi.reload();
    agingApi.reload();
  };

  const handleDispatch = async (orderId: number) => {
    setBusy(true);
    try {
      await apiReq("POST", `/transfers/orders/${orderId}/dispatch`, {});
      setToast("Transfer shipment dispatched and moved into In-Transit.");
      setConfirmAction(null);
      refreshAll();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Dispatch failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    setBusy(true);
    try {
      await apiReq("POST", `/transfers/orders/${orderId}/cancel`, {});
      setToast("Transfer order cancelled.");
      setConfirmAction(null);
      refreshAll();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  };

  const handleApproveReq = async (reqId: number) => {
    setBusy(true);
    try {
      await apiReq("POST", `/transfers/requisitions/${reqId}/approve`, { approve: true });
      setToast("Transfer requisition approved.");
      refreshAll();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateOrderFromReq = async (r: TransferRequisition) => {
    setBusy(true);
    try {
      const orderItems = (r.orders?.[0]?.items || []).map((it) => ({
        itemId: it.itemId || 1,
        brandVariantId: it.brandVariantId,
        quantity: it.quantity,
      }));
      await apiReq("POST", "/transfers/orders", {
        requisitionId: r.id,
        items: orderItems.length > 0 ? orderItems : items.slice(0, 1).map((i) => ({ itemId: i.id, quantity: 10 })),
      });
      setToast("Transfer Order created and dispatched from source storage.");
      refreshAll();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Order creation failed");
    } finally {
      setBusy(false);
    }
  };

  const handleExecuteAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "dispatch") handleDispatch(confirmAction.id);
    else if (confirmAction.type === "cancelOrder") handleCancelOrder(confirmAction.id);
  };

  // KPIs
  const inTransitCount = aging.length;
  const staleTransitCount = aging.filter((a) => a.stale || a.daysInTransit > 1).length;
  const pendingOrdersCount = orders.filter((o) => o.status === "REQUESTED" || o.status === "APPROVED").length;
  const completedOrdersCount = orders.filter((o) => o.status === "RECEIVED").length;

  const orderCols: ExportColumn<TransferOrder>[] = [
    { key: "number", label: "Transfer #" },
    { key: "status", label: "Status" },
    { key: "requisition.fromWarehouse.code", label: "Origin" },
    { key: "requisition.toWarehouse.code", label: "Destination" },
    { key: "dispatchedAt", label: "Dispatched Date" },
    { key: "receivedAt", label: "Received Date" },
  ];

  const reqCols: ExportColumn<TransferRequisition>[] = [
    { key: "number", label: "Requisition #" },
    { key: "status", label: "Status" },
    { key: "fromWarehouse.code", label: "Origin" },
    { key: "toWarehouse.code", label: "Destination" },
    { key: "createdAt", label: "Created Date" },
  ];

  const loading = ordersApi.loading || reqsApi.loading || agingApi.loading;

  return (
    <div className="transfers-module-container">
      {/* Top Header */}
      <div className="topbar">
        <div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 600 }}>
            Inter-Branch Stock Transfers
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Multi-stage transfer logistics, route dispatching, and branch arrival inspection
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn ghost" onClick={refreshAll} title="Refresh data">
            ↻ Sync
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setDrawerReq({ open: true })}
          >
            + New Transfer Request
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <KpiCard
          label="In-Transit Shipments"
          value={inTransitCount}
          subtext="Moving across locations"
          icon="🚚"
          onClick={() => setTab("transit")}
          accent={inTransitCount > 0 ? "amber" : "default"}
        />
        <KpiCard
          label="Overdue / Stale Routes"
          value={staleTransitCount}
          subtext="Exceeding 24h route SLA"
          icon="⏳"
          onClick={() => setTab("transit")}
          accent={staleTransitCount > 0 ? "red" : "green"}
        />
        <KpiCard
          label="Pending Dispatch"
          value={pendingOrdersCount}
          subtext="Ready for warehouse picking"
          icon="📦"
          onClick={() => setTab("orders")}
        />
        <KpiCard
          label="Completed Transfers"
          value={completedOrdersCount}
          subtext="Successfully received"
          icon="✓"
          onClick={() => setTab("orders")}
          accent="green"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="tabs" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 20 }}>
        <button
          className={`tab ${tab === "transit" ? "active" : ""}`}
          onClick={() => setTab("transit")}
          title="In-Transit Aging Board: Real-time tracking of inter-branch shipments currently on the road, transit duration, and overdue alerts"
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "transit" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "transit" ? "var(--amber)" : "var(--muted)" }}
        >
          🚚 In-Transit Aging Board ({aging.length})
        </button>
        <button
          className={`tab ${tab === "orders" ? "active" : ""}`}
          onClick={() => setTab("orders")}
          title="Transfer Orders & Lifecycle: Full dispatch, transit, branch receiving, variance reporting, and transfer history"
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "orders" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "orders" ? "var(--amber)" : "var(--muted)" }}
        >
          📑 Transfer Orders & Lifecycle ({orders.length})
        </button>
        <button
          className={`tab ${tab === "requisitions" ? "active" : ""}`}
          onClick={() => setTab("requisitions")}
          title="Transfer Requisitions: Internal stock requests submitted by branch kitchen / store managers awaiting central dispatch approval"
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "requisitions" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "requisitions" ? "var(--amber)" : "var(--muted)" }}
        >
          📝 Transfer Requisitions ({reqs.length})
        </button>
      </div>

      {loading && <Loading />}
      {ordersApi.error && <ErrorBanner message={ordersApi.error} />}

      {/* Tab 1: In-Transit Aging Board */}
      {tab === "transit" && (
        <InTransitAgingBoard
          agingRows={aging}
          orders={orders}
          onSelectOrder={(ord) => {
            setSelectedOrder(ord);
            setTab("orders");
          }}
          onFastReceive={(ord) => setDrawerReceive({ open: true, order: ord })}
        />
      )}

      {/* Tab 2: Orders Master-Detail View */}
      {tab === "orders" && (
        <MasterDetailView
          listTitle="Transfer Orders"
          listSubtitle="Select an order to inspect manifest and progress"
          listHeaderActions={
            <ListToolbar
              q={orderQ}
              setQ={setOrderQ}
              rows={filteredOrders}
              columns={orderCols}
              filename="transfer_orders"
              placeholder="Search transfer #, from, to…"
            />
          }
          listContent={
            (filteredOrders || []).length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>No transfer orders found.</div>
            ) : (
              (filteredOrders || []).map((ord) => (
                <div
                  key={ord.id}
                  className={`master-item ${selectedOrder?.id === ord.id ? "selected" : ""}`}
                  onClick={() => setSelectedOrder(ord)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>
                      #{ord.number}
                    </span>
                    <StatusBadge status={ord.status} size="sm" />
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500 }}>
                    {ord.requisition?.fromWarehouse?.code || "—"} ➔ {ord.requisition?.toWarehouse?.code || "—"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    <span>{ord.items.length} item{ord.items.length !== 1 ? "s" : ""}</span>
                    <span>{ord.dispatchedAt ? new Date(ord.dispatchedAt).toLocaleDateString("en-GB") : "Pending"}</span>
                  </div>
                </div>
              ))
            )
          }
          hasSelection={Boolean(selectedOrder)}
          detailContent={
            selectedOrder && (
              <TransferDetailPane
                order={selectedOrder}
                onDispatch={(ord) =>
                  setConfirmAction({
                    type: "dispatch",
                    id: ord.id,
                    title: `Dispatch Transfer #${ord.number}`,
                    message: "Are you sure you want to mark this shipment as dispatched and move items into In-Transit holding?",
                  })
                }
                onReceive={(ord) => setDrawerReceive({ open: true, order: ord })}
                onCancel={(ord) =>
                  setConfirmAction({
                    type: "cancelOrder",
                    id: ord.id,
                    title: `Cancel Transfer #${ord.number}`,
                    message: "Are you sure you want to cancel this transfer order?",
                  })
                }
              />
            )
          }
        />
      )}

      {/* Tab 3: Requisitions */}
      {tab === "requisitions" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Stock transfer requisitions requested by branch kitchen managers
            </div>
            <ListToolbar
              q={reqQ}
              setQ={setReqQ}
              rows={filteredReqs}
              columns={reqCols}
              filename="transfer_requisitions"
              placeholder="Search requisition #, from, to…"
            />
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Requisition #</th>
                  <th>Origin (From)</th>
                  <th>Destination (To)</th>
                  <th>Requested By</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filteredReqs || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                      No transfer requisitions on record.
                    </td>
                  </tr>
                ) : (
                  (filteredReqs || []).map((r) => (
                    <tr key={r.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{r.number}</td>
                      <td>{r.fromWarehouse?.code}</td>
                      <td>{r.toWarehouse?.code}</td>
                      <td>{r.requestedBy?.name || "Branch Staff"}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {new Date(r.createdAt).toLocaleDateString("en-GB")}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {r.status === "REQUESTED" && (
                          <button
                            type="button"
                            className="btn sm"
                            style={{ background: "#2e7d32", color: "#fff", marginRight: 4 }}
                            onClick={() => handleApproveReq(r.id)}
                            disabled={busy}
                          >
                            Approve
                          </button>
                        )}
                        {r.status === "APPROVED" && (
                          <button
                            type="button"
                            className="btn sm amber"
                            style={{ marginRight: 4 }}
                            onClick={() => handleCreateOrderFromReq(r)}
                            disabled={busy}
                          >
                            🚚 Dispatch Order
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setDrawerReq({ open: true, edit: r })}
                          style={{ marginRight: 4 }}
                        >
                          Edit
                        </button>
                        <HistoryButton entityType="TransferRequisition" entityId={r.id} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawers */}
      <TransferRequestDrawer
        open={drawerReq.open}
        editRequisition={drawerReq.edit}
        warehouses={warehouses}
        items={items}
        onClose={() => setDrawerReq({ open: false })}
        onSuccess={(msg) => {
          setToast(msg);
          refreshAll();
        }}
      />

      <BranchReceiveDrawer
        open={drawerReceive.open}
        order={drawerReceive.order}
        onClose={() => setDrawerReceive({ open: false, order: null })}
        onSuccess={(msg) => {
          setToast(msg);
          refreshAll();
          if (selectedOrder && selectedOrder.id === drawerReceive.order?.id) {
            setSelectedOrder(null);
          }
        }}
      />

      {/* Confirm Action Dialog */}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.type === "dispatch" ? "Confirm Dispatch" : "Confirm Cancel"}
          busy={busy}
          onConfirm={handleExecuteAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
