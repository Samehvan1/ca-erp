import { useMemo, useState } from "react";
import {
  Requisition,
  Po,
  Grn,
  Invoice,
  Payment,
  Item,
  Vendor,
  CostCenter,
} from "./types";
import { PoPipeline } from "./PoPipeline";
import { GrnReceivingDrawer } from "./GrnReceivingDrawer";
import { ThreeWayMatch } from "./ThreeWayMatch";
import { ReplenishmentPlanner } from "./ReplenishmentPlanner";
import { RequisitionDrawer } from "./RequisitionDrawer";
import { PoDrawer } from "./PoDrawer";
import { InvoiceDrawer } from "./InvoiceDrawer";
import { PaymentDrawer } from "./PaymentDrawer";
import { TransferRequestDrawer } from "../transfers/TransferRequestDrawer";
import { Warehouse } from "../transfers/types";
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

export default function ProcurementHub() {
  const [tab, setTab] = useState<"reqs" | "pos" | "match" | "replenish" | "grns" | "payments">("reqs");
  const [selectedPo, setSelectedPo] = useState<Po | null>(null);

  // APIs
  const posApi = useApi<Po[]>("/procurement/purchase-orders");
  const reqsApi = useApi<Requisition[]>("/procurement/requisitions");
  const grnsApi = useApi<Grn[]>("/procurement/grns");
  const invsApi = useApi<Invoice[]>("/procurement/invoices");
  const paysApi = useApi<Payment[]>("/procurement/payments");
  const itemsApi = useApi<Item[]>("/inventory/items");
  const warehousesApi = useApi<Warehouse[]>("/inventory/warehouses");
  const batchesApi = useApi<{ itemId: number; quantity: number }[]>("/inventory/batches");
  const ropsApi = useApi<{ itemId: number; reorderPoint: number; safetyStock: number }[]>("/inventory/reorder-points");
  const vendorsApi = useApi<Vendor[]>("/suppliers/vendors");
  const costCentersApi = useApi<CostCenter[]>("/finance/cost-centers");

  const pos = posApi.data || [];
  const reqs = reqsApi.data || [];
  const grns = grnsApi.data || [];
  const invs = invsApi.data || [];
  const pays = paysApi.data || [];
  const items = itemsApi.data || [];
  const warehouses = warehousesApi.data || [];
  const batches = batchesApi.data || [];
  const rops = ropsApi.data || [];
  const vendors = vendorsApi.data || [];
  const costCenters = costCentersApi.data || [];

  // Drawers
  const [drawerReq, setDrawerReq] = useState<{ open: boolean; edit?: Requisition | null; initialItems?: { itemId: number; quantity: number; unitPrice: number }[] }>({ open: false });
  const [drawerPo, setDrawerPo] = useState<{ open: boolean; edit?: Po | null; initialItems?: { itemId: number; brandVariantId?: number | null; quantity: number; unitPrice?: number }[]; initialProjectId?: number }>({ open: false });
  const [drawerTransfer, setDrawerTransfer] = useState<{ open: boolean; initialItems?: { itemId: number; brandVariantId?: number | null; quantity: number }[]; initialProjectId?: number }>({ open: false });
  const [drawerGrn, setDrawerGrn] = useState<{ open: boolean; po: Po | null }>({ open: false, po: null });
  const [drawerInv, setDrawerInv] = useState<{ open: boolean; po?: Po | null; edit?: Invoice | null }>({ open: false });
  const [drawerPay, setDrawerPay] = useState<{ open: boolean; po?: Po | null; edit?: Payment | null }>({ open: false });

  // Dialogs
  const [confirmAction, setConfirmAction] = useState<{
    type: "approveReq" | "approveInv" | "rejectInv" | "forceClosePo";
    id: number;
    title: string;
    message: string;
  } | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Filters
  const { q: poQ, setQ: setPoQ, filtered: filteredPos } = useListFilter<Po>(pos, ["number", "status", "vendor.name", "project.name"]);
  const { q: reqQ, setQ: setReqQ, filtered: filteredReqs } = useListFilter<Requisition>(reqs, ["number", "status", "project.name", "requestedBy.name"]);
  const { q: grnQ, setQ: setGrnQ, filtered: filteredGrns } = useListFilter<Grn>(grns, ["number", "status", "po.number"]);
  const { q: payQ, setQ: setPayQ, filtered: filteredPays } = useListFilter<Payment>(pays, ["number", "type", "vendor.name"]);

  const refreshAll = () => {
    posApi.reload();
    reqsApi.reload();
    grnsApi.reload();
    invsApi.reload();
    paysApi.reload();
  };

  const handleApproveReq = async (reqId: number) => {
    setBusy(true);
    try {
      await apiReq("POST", `/procurement/requisitions/${reqId}/approve`, { approve: true });
      setToast("Requisition approved.");
      setConfirmAction(null);
      refreshAll();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  };

  const handleApproveInv = async (invId: number) => {
    setBusy(true);
    try {
      await apiReq("POST", `/procurement/invoices/${invId}/approve`, {});
      setToast("Invoice approved and posted to Accounts Payable ledger.");
      setConfirmAction(null);
      refreshAll();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRejectInv = async (invId: number) => {
    setBusy(true);
    try {
      await apiReq("POST", `/procurement/invoices/${invId}/reject`, {});
      setToast("Invoice rejected.");
      setConfirmAction(null);
      refreshAll();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Rejection failed");
    } finally {
      setBusy(false);
    }
  };

  const handleForceClosePo = async (poId: number) => {
    setBusy(true);
    try {
      await apiReq("POST", `/procurement/purchase-orders/${poId}/force-close`, {});
      setToast("Purchase Order force-closed.");
      setConfirmAction(null);
      refreshAll();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Close failed");
    } finally {
      setBusy(false);
    }
  };

  const handleExecuteAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "approveReq") handleApproveReq(confirmAction.id);
    else if (confirmAction.type === "approveInv") handleApproveInv(confirmAction.id);
    else if (confirmAction.type === "rejectInv") handleRejectInv(confirmAction.id);
    else if (confirmAction.type === "forceClosePo") handleForceClosePo(confirmAction.id);
  };

  // KPIs
  const openPosCount = pos.filter((p) => p.status === "OPEN" || p.status === "PARTIALLY_RECEIVED").length;
  const pendingReqsCount = reqs.filter((r) => r.status === "PENDING_APPROVAL" || r.status === "DRAFT").length;
  const pendingInvsCount = invs.filter((i) => i.status === "PENDING").length;
  const totalApSpent = pays.reduce((acc, p) => acc + Number(p.amount || 0), 0);

  const poCols: ExportColumn<Po>[] = [
    { key: "number", label: "PO #" },
    { key: "vendor.name", label: "Vendor" },
    { key: "status", label: "Status" },
    { key: "totalValue", label: "Total Value" },
    { key: "orderedQty", label: "Ordered Qty" },
    { key: "receivedQty", label: "Received Qty" },
  ];

  const reqCols: ExportColumn<Requisition>[] = [
    { key: "number", label: "Requisition #" },
    { key: "type", label: "Type" },
    { key: "status", label: "Status" },
    { key: "totalValue", label: "Total Value" },
    { key: "requestedBy.name", label: "Requested By" },
  ];

  const grnCols: ExportColumn<Grn>[] = [
    { key: "number", label: "GRN #" },
    { key: "po.number", label: "PO #" },
    { key: "status", label: "Status" },
    { key: "receivedAt", label: "Received Date" },
  ];

  const payCols: ExportColumn<Payment>[] = [
    { key: "number", label: "Payment #" },
    { key: "vendor.name", label: "Vendor" },
    { key: "type", label: "Type" },
    { key: "amount", label: "Amount" },
    { key: "paidAt", label: "Date" },
  ];

  const loading = posApi.loading || reqsApi.loading || invsApi.loading;

  return (
    <div className="procurement-module-container">
      {/* Header */}
      <div className="topbar">
        <div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 28, fontWeight: 600 }}>
            Purchasing & Procurement
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            End-to-end Procure-to-Pay pipeline, 3-way matching, goods receipts (GRN), and replenishment planning
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn ghost" onClick={refreshAll} title="Refresh data">
            ↻ Sync
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setDrawerReq({ open: true })}
          >
            + New Requisition
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setDrawerPo({ open: true })}
          >
            + Issue Purchase Order
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <KpiCard
          label="Open Purchase Orders"
          value={openPosCount}
          subtext="Awaiting delivery fulfillment"
          icon="📦"
          onClick={() => setTab("pos")}
          accent={openPosCount > 0 ? "amber" : "default"}
        />
        <KpiCard
          label="Pending 3-Way Match"
          value={pendingInvsCount}
          subtext="Invoices to reconcile & approve"
          icon="⚖️"
          onClick={() => setTab("match")}
          accent={pendingInvsCount > 0 ? "red" : "green"}
        />
        <KpiCard
          label="Pending Requisitions"
          value={pendingReqsCount}
          subtext="Awaiting DoA authorization"
          icon="📝"
          onClick={() => setTab("reqs")}
        />
        <KpiCard
          label="Total Disbursements (YTD)"
          value={`${totalApSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })} EGP`}
          subtext="Settled vendor payments"
          icon="💳"
          onClick={() => setTab("payments")}
          accent="green"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="tabs" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 20 }}>
        <button
          className={`tab ${tab === "reqs" ? "active" : ""}`}
          onClick={() => setTab("reqs")}
          title="Purchase Requisitions: Internal department requests, budget approvals, and one-click PO conversion"
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "reqs" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "reqs" ? "var(--amber)" : "var(--muted)" }}
        >
          📝 Requisitions ({reqs.length})
        </button>
        <button
          className={`tab ${tab === "pos" ? "active" : ""}`}
          onClick={() => setTab("pos")}
          title="Purchase Orders & Pipeline: Supplier procurement orders, approval status, delivery milestones, and line item fulfillment"
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "pos" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "pos" ? "var(--amber)" : "var(--muted)" }}
        >
          📑 Purchase Orders & Pipeline ({pos.length})
        </button>
        <button
          className={`tab ${tab === "match" ? "active" : ""}`}
          onClick={() => setTab("match")}
          title="3-Way Match & Invoices: Automated audit reconciling PO unit cost, GRN received quantity, and supplier invoice amount for AP clearance"
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "match" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "match" ? "var(--amber)" : "var(--muted)" }}
        >
          ⚖️ 3-Way Match & Invoices ({invs.length})
        </button>
        <button
          className={`tab ${tab === "replenish" ? "active" : ""}`}
          onClick={() => setTab("replenish")}
          title="Replenishment Planner: Real-time reorder suggestions triggered by warehouse stock falling below safety stock & ROP thresholds"
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "replenish" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "replenish" ? "var(--amber)" : "var(--muted)" }}
        >
          ⚡ Replenishment Planner
        </button>
        <button
          className={`tab ${tab === "grns" ? "active" : ""}`}
          onClick={() => setTab("grns")}
          title="Goods Receipts (GRN): Receiving dock check-in, batch lot tagging, expiry tracking, and instant inventory stock ledger posting"
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "grns" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "grns" ? "var(--amber)" : "var(--muted)" }}
        >
          📥 Goods Receipts ({grns.length})
        </button>
        <button
          className={`tab ${tab === "payments" ? "active" : ""}`}
          onClick={() => setTab("payments")}
          title="Disbursements & AP Payments: Vendor settlement tracking, approved payment batches, and invoice payment receipts"
          style={{ padding: "10px 18px", fontWeight: 600, fontSize: 13.5, background: "none", border: "none", borderBottom: tab === "payments" ? "3px solid var(--amber)" : "3px solid transparent", cursor: "pointer", color: tab === "payments" ? "var(--amber)" : "var(--muted)" }}
        >
          💳 Disbursements ({pays.length})
        </button>
      </div>

      {loading && <Loading />}
      {posApi.error && <ErrorBanner message={posApi.error} />}

      {/* Tab 1: PO Pipeline Master-Detail View */}
      {tab === "pos" && (
        <MasterDetailView
          listTitle="Purchase Orders"
          listSubtitle="Select a PO to inspect fulfillments and 3-way stage"
          listHeaderActions={
            <ListToolbar
              q={poQ}
              setQ={setPoQ}
              rows={filteredPos}
              columns={poCols}
              filename="purchase_orders"
              placeholder="Search PO #, vendor, project…"
            />
          }
          listContent={
            (filteredPos || []).length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>No purchase orders found.</div>
            ) : (
              (filteredPos || []).map((poItem) => (
                <div
                  key={poItem.id}
                  className={`master-item ${selectedPo?.id === poItem.id ? "selected" : ""}`}
                  onClick={() => setSelectedPo(poItem)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>
                      #{poItem.number}
                    </span>
                    <StatusBadge status={poItem.status} size="sm" />
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500 }}>
                    {poItem.vendor?.name}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    <span>{poItem.items.length} item{poItem.items.length !== 1 ? "s" : ""}</span>
                    <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--ink)" }}>
                      {(poItem.totalValue || 0).toLocaleString()} {poItem.currency}
                    </span>
                  </div>
                </div>
              ))
            )
          }
          hasSelection={Boolean(selectedPo)}
          detailContent={
            selectedPo && (
              <PoPipeline
                po={selectedPo}
                grns={grns.filter((g) => g.poId === selectedPo.id)}
                invoices={invs.filter((i) => i.poId === selectedPo.id)}
                onReceiveGrn={(p) => setDrawerGrn({ open: true, po: p })}
                onCreateInvoice={(p) => setDrawerInv({ open: true, po: p })}
                onRecordPayment={(p) => setDrawerPay({ open: true, po: p })}
                onForceClose={(p) =>
                  setConfirmAction({
                    type: "forceClosePo",
                    id: p.id,
                    title: `Force Close PO #${p.number}`,
                    message: "Are you sure you want to force-close this purchase order and cancel the unfulfilled balance?",
                  })
                }
              />
            )
          }
        />
      )}

      {/* Tab 2: 3-Way Matching Engine */}
      {tab === "match" && (
        <ThreeWayMatch
          invoices={invs}
          pos={pos}
          grns={grns}
          onApproveInvoice={(inv) =>
            setConfirmAction({
              type: "approveInv",
              id: inv.id,
              title: `Approve Invoice #${inv.number}`,
              message: `Confirm 3-way matching and post ${inv.amount.toLocaleString()} EGP to Accounts Payable?`,
            })
          }
          onRejectInvoice={(inv) =>
            setConfirmAction({
              type: "rejectInv",
              id: inv.id,
              title: `Reject Invoice #${inv.number}`,
              message: "Are you sure you want to reject this vendor invoice?",
            })
          }
        />
      )}

      {/* Tab 3: Replenishment Planner */}
      {tab === "replenish" && (
        <ReplenishmentPlanner
          items={items}
          vendors={vendors}
          batches={batches}
          rops={rops}
          onGenerateRequisition={(selItems) => {
            setDrawerReq({ open: true, initialItems: selItems });
          }}
        />
      )}

      {/* Tab 4: GRNs */}
      {tab === "grns" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Goods Receipt Notes (GRN) with batch inspection and quarantine tracking
            </div>
            <ListToolbar
              q={grnQ}
              setQ={setGrnQ}
              rows={filteredGrns}
              columns={grnCols}
              filename="goods_receipt_notes"
              placeholder="Search GRN #, PO #…"
            />
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>GRN #</th>
                  <th>PO Reference</th>
                  <th>Received Date</th>
                  <th>Status</th>
                  <th>Items Count</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filteredGrns || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                      No goods receipts on record.
                    </td>
                  </tr>
                ) : (
                  (filteredGrns || []).map((g) => (
                    <tr key={g.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{g.number}</td>
                      <td>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            const p = pos.find((x) => x.id === g.poId || x.number === g.po?.number);
                            if (p) {
                              setSelectedPo(p);
                              setTab("pos");
                            }
                          }}
                          style={{ color: "var(--amber)", textDecoration: "none" }}
                        >
                          PO #{g.po?.number || g.poId}
                        </a>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {new Date(g.receivedAt).toLocaleDateString("en-GB")}
                      </td>
                      <td><StatusBadge status={g.status} /></td>
                      <td>{g.items?.length || 0} line item{g.items?.length !== 1 ? "s" : ""}</td>
                      <td style={{ textAlign: "right" }}>
                        <HistoryButton entityType="Grn" entityId={g.id} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Requisitions */}
      {tab === "reqs" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Purchase requisitions submitted for multi-level Delegation of Authority approval
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn sm" onClick={() => setDrawerReq({ open: true })}>
                + New Requisition
              </button>
              <ListToolbar
                q={reqQ}
                setQ={setReqQ}
                rows={filteredReqs}
                columns={reqCols}
                filename="purchase_requisitions"
                placeholder="Search requisition #, project…"
              />
            </div>
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Requisition #</th>
                  <th>Type</th>
                  <th>Project</th>
                  <th>Requested By</th>
                  <th style={{ textAlign: "right" }}>Total Value (EGP)</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filteredReqs || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                      No purchase requisitions found.
                    </td>
                  </tr>
                ) : (
                  (filteredReqs || []).map((r) => (
                    <tr key={r.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{r.number}</td>
                      <td><StatusBadge status={r.type} tone="neutral" /></td>
                      <td>{r.project?.name}</td>
                      <td>{r.requestedBy?.name || "Staff"}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600 }}>
                        {Number(r.totalValue || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td><StatusBadge status={r.status} /></td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {new Date(r.createdAt).toLocaleDateString("en-GB")}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {r.status === "PENDING_APPROVAL" && (
                          <button
                            type="button"
                            className="btn sm"
                            style={{ background: "#2e7d32", color: "#fff", marginRight: 4 }}
                            onClick={() =>
                              setConfirmAction({
                                type: "approveReq",
                                id: r.id,
                                title: `Approve Requisition #${r.number}`,
                                message: `Approve purchase requisition for ${r.totalValue.toLocaleString()} EGP?`,
                              })
                            }
                          >
                            Approve
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn ghost sm"
                          title="Fulfill via Central Warehouse Transfer"
                          style={{ marginRight: 4, color: "var(--amber)", fontWeight: 600 }}
                          onClick={() =>
                            setDrawerTransfer({
                              open: true,
                              initialItems: r.items.map((it) => ({
                                itemId: it.item.id,
                                brandVariantId: it.brandVariantId,
                                quantity: it.quantity,
                              })),
                              initialProjectId: r.projectId,
                            })
                          }
                        >
                          🚚 Transfer
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          title="Convert to Supplier Purchase Order"
                          style={{ marginRight: 4, color: "#1976d2", fontWeight: 600 }}
                          onClick={() =>
                            setDrawerPo({
                              open: true,
                              initialItems: r.items.map((it) => ({
                                itemId: it.item.id,
                                brandVariantId: it.brandVariantId,
                                quantity: it.quantity,
                                unitPrice: it.unitPrice,
                              })),
                              initialProjectId: r.projectId,
                            })
                          }
                        >
                          📑 PO
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setDrawerReq({ open: true, edit: r })}
                          style={{ marginRight: 4 }}
                        >
                          Edit
                        </button>
                        <HistoryButton entityType="Requisition" entityId={r.id} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Payments */}
      {tab === "payments" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Vendor disbursements, down-payments, and settlement records
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn sm" onClick={() => setDrawerPay({ open: true })}>
                + Record Payment
              </button>
              <ListToolbar
                q={payQ}
                setQ={setPayQ}
                rows={filteredPays}
                columns={payCols}
                filename="vendor_disbursements"
                placeholder="Search payment #, vendor…"
              />
            </div>
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Payment #</th>
                  <th>Vendor</th>
                  <th>Type</th>
                  <th>Linked PO</th>
                  <th style={{ textAlign: "right" }}>Amount (EGP)</th>
                  <th>Payment Date</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filteredPays || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                      No payment records found.
                    </td>
                  </tr>
                ) : (
                  (filteredPays || []).map((p) => (
                    <tr key={p.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{p.number}</td>
                      <td>{p.vendor?.name}</td>
                      <td><StatusBadge status={p.type} tone="info" /></td>
                      <td>{p.po ? `PO #${p.po.number}` : "—"}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700, color: "#2e7d32" }}>
                        {Number(p.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {new Date(p.paidAt).toLocaleDateString("en-GB")}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <HistoryButton entityType="Payment" entityId={p.id} />
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
      <RequisitionDrawer
        open={drawerReq.open}
        editRequisition={drawerReq.edit}
        initialItems={drawerReq.initialItems}
        items={items}
        costCenters={costCenters}
        onClose={() => setDrawerReq({ open: false })}
        onSuccess={(msg) => {
          setToast(msg);
          refreshAll();
        }}
      />

      <PoDrawer
        open={drawerPo.open}
        editPo={drawerPo.edit}
        initialItems={drawerPo.initialItems}
        initialProjectId={drawerPo.initialProjectId}
        vendors={vendors}
        items={items}
        onClose={() => setDrawerPo({ open: false })}
        onSuccess={(msg) => {
          setToast(msg);
          refreshAll();
        }}
      />

      <TransferRequestDrawer
        open={drawerTransfer.open}
        initialItems={drawerTransfer.initialItems}
        initialProjectId={drawerTransfer.initialProjectId}
        warehouses={warehouses}
        items={items}
        onClose={() => setDrawerTransfer({ open: false })}
        onSuccess={(msg) => {
          setToast(msg);
          refreshAll();
        }}
      />

      <GrnReceivingDrawer
        open={drawerGrn.open}
        po={drawerGrn.po}
        onClose={() => setDrawerGrn({ open: false, po: null })}
        onSuccess={(msg) => {
          setToast(msg);
          refreshAll();
        }}
      />

      <InvoiceDrawer
        open={drawerInv.open}
        vendors={vendors}
        pos={pos}
        grns={grns}
        initialPo={drawerInv.po}
        editInvoice={drawerInv.edit}
        onClose={() => setDrawerInv({ open: false, po: null })}
        onSuccess={(msg) => {
          setToast(msg);
          refreshAll();
        }}
      />

      <PaymentDrawer
        open={drawerPay.open}
        vendors={vendors}
        pos={pos}
        invoices={invs}
        initialPo={drawerPay.po}
        editPayment={drawerPay.edit}
        onClose={() => setDrawerPay({ open: false, po: null })}
        onSuccess={(msg) => {
          setToast(msg);
          refreshAll();
        }}
      />

      {/* Confirm Action Dialog */}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.type.startsWith("approve") ? "Approve" : "Confirm"}
          busy={busy}
          onConfirm={handleExecuteAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
