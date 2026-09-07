import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Badge, ConfirmDialog, Empty, ErrorBanner, HistoryButton, ListToolbar, Loading, Modal, Toast, apiReq, useApi, useListFilter } from "../components";
import { getUser } from "../api";

interface Warehouse {
  id: number;
  code: string;
  name: string;
  type: string;
  projectId: number | null;
}

interface BrandVariant {
  id: number;
  name: string;
  sku: string;
}

interface Item {
  id: number;
  code: string;
  description: string;
  brandVariants: BrandVariant[];
}

interface Requisition {
  id: number;
  number: string;
  status: string;
  fromWarehouse: { id: number; code: string };
  toWarehouse: { id: number; code: string };
  project: { id: number; name: string } | null;
  requestedBy: { name: string } | null;
  orders: { id: number; number: string; items: TransferOrder["items"] }[];
}

interface TransferOrder {
  id: number;
  number: string;
  status: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
  requisitionId: number;
  requisition: {
    fromWarehouse: { code: string };
    toWarehouse: { code: string };
  };
  items: { id: number; quantity: number; receivedQty: number; discrepancyQty: number; acceptedQty: number; comments: string | null; item: { code: string; description: string } }[];
  receipts: { id: number; lossAllocation: { sending: number; receiving: number; logistics: number } | null }[];
}

interface AgingRow {
  id: number;
  number: string;
  from: string;
  to: string;
  daysInTransit: number;
  stale: boolean;
  items: number;
}

interface ItemRow {
  key: number;
  itemId: string;
  brandVariantId: string;
  quantity: string;
}

interface RecvRow {
  key: number;
  transferItemId: string;
  receivedQty: string;
  discrepancyQty: string;
  acceptedQty: string;
  comments: string;
}

type OrderLike = { id: number; number: string; items: TransferOrder["items"] };

type ReqFormValues = { fromWarehouseId: number; toWarehouseId: number; projectId: number | null };

function RequisitionFormModal({
  open,
  onClose,
  initial,
  busy,
  err,
  warehouses,
  me,
  renderRow,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initial?: { fromWarehouseId: number; toWarehouseId: number; projectId: number | null } | null;
  busy: boolean;
  err: string | null;
  warehouses: Warehouse[] | null;
  me: ReturnType<typeof getUser>;
  renderRow: (row: ItemRow, upd: (key: number, patch: Partial<ItemRow>) => void, del: (key: number) => void) => ReactNode;
  onSubmit: (form: ReqFormValues, rows: ItemRow[]) => void;
}) {
  const keyRef = useRef(0);
  const [form, setForm] = useState({ fromWarehouseId: "", toWarehouseId: "", projectId: me?.projectId ? String(me.projectId) : "" });
  const [rows, setRows] = useState<ItemRow[]>([{ key: 0, itemId: "", brandVariantId: "", quantity: "" }]);

  useEffect(() => {
    if (!open) return;
    setForm({
      fromWarehouseId: initial ? String(initial.fromWarehouseId) : "",
      toWarehouseId: initial ? String(initial.toWarehouseId) : "",
      projectId: initial?.projectId ? String(initial.projectId) : me?.projectId ? String(me.projectId) : "",
    });
    setRows([{ key: 0, itemId: "", brandVariantId: "", quantity: "" }]);
  }, [open, initial, me?.projectId]);

  const addRow = () => setRows((r) => [...r, { key: ++keyRef.current, itemId: "", brandVariantId: "", quantity: "" }]);
  const updRow = (key: number, patch: Partial<ItemRow>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const delRow = (key: number) => setRows((r) => r.filter((x) => x.key !== key));

  const isEdit = !!initial;

  if (!open) return null;

  return (
    <Modal title={isEdit ? "Edit transfer request" : "New transfer request"} onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(
            {
              fromWarehouseId: Number(form.fromWarehouseId),
              toWarehouseId: Number(form.toWarehouseId),
              projectId: form.projectId ? Number(form.projectId) : null,
            },
            rows
          );
        }}
      >
        <div className="form-row">
          <div className="field">
            <label>From warehouse</label>
            <select value={form.fromWarehouseId} onChange={(e) => setForm({ ...form, fromWarehouseId: e.target.value })} required>
              <option value="">Select…</option>
              {warehouses?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>To warehouse</label>
            <select value={form.toWarehouseId} onChange={(e) => setForm({ ...form, toWarehouseId: e.target.value })} required>
              <option value="">Select…</option>
              {warehouses?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Project</label>
          {me?.projectId ? (
            <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} required>
              <option value={me.projectId}>My project ({me.projectId})</option>
            </select>
          ) : (
            <input type="number" min="1" placeholder="Project ID" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} required />
          )}
        </div>
        {!isEdit && (
          <>
            <div className="sub-head">
              <strong>Items</strong>
            </div>
            {rows.map((row) => renderRow(row, updRow, delRow))}
            <button type="button" className="btn ghost sm" onClick={addRow}>
              + Add item
            </button>
          </>
        )}
        {err && <ErrorBanner message={err} />}
        <div className="modal-actions">
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn amber" disabled={busy}>
            {busy ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create request"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Transfers() {
  const me = getUser();
  const keyRef = useRef(0);
  const [tab, setTab] = useState<"requisitions" | "orders" | "aging">("requisitions");
  const orders = useApi<TransferOrder[]>("/transfers/orders");
  const requisitions = useApi<Requisition[]>("/transfers/requisitions");
  const aging = useApi<AgingRow[]>("/transfers/orders/aging");
  const warehouses = useApi<Warehouse[]>("/inventory/warehouses");
  const items = useApi<Item[]>("/inventory/items");

  const { q: reqQ, setQ: setReqQ, filtered: filteredReqs } = useListFilter<Requisition>(requisitions.data, ["number", "status"]);
  const { q: orderQ, setQ: setOrderQ, filtered: filteredOrders } = useListFilter<TransferOrder>(orders.data, ["number", "status"]);

  const [showNew, setShowNew] = useState(false);
  const [approveFor, setApproveFor] = useState<Requisition | null>(null);
  const [dispatchFor, setDispatchFor] = useState<Requisition | null>(null);
  const [receiveFor, setReceiveFor] = useState<OrderLike | null>(null);
  const [viewReq, setViewReq] = useState<Requisition | null>(null);
  const [editReq, setEditReq] = useState<Requisition | null>(null);
  const [delReq, setDelReq] = useState<Requisition | null>(null);
  const [viewOrder, setViewOrder] = useState<TransferOrder | null>(null);
  const [editOrder, setEditOrder] = useState<TransferOrder | null>(null);
  const [delOrder, setDelOrder] = useState<TransferOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [approveComment, setApproveComment] = useState("");
  const [shipItems, setShipItems] = useState<ItemRow[]>([{ key: 0, itemId: "", brandVariantId: "", quantity: "" }]);
  const [recvRows, setRecvRows] = useState<RecvRow[]>([]);
  const [loss, setLoss] = useState({ sending: "", receiving: "", logistics: "" });

  const addShipRow = () => setShipItems((r) => [...r, { key: ++keyRef.current, itemId: "", brandVariantId: "", quantity: "" }]);
  const updShipRow = (key: number, patch: Partial<ItemRow>) => setShipItems((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const delShipRow = (key: number) => setShipItems((r) => r.filter((x) => x.key !== key));

  const addRecvRow = () => setRecvRows((r) => [...r, { key: ++keyRef.current, transferItemId: "", receivedQty: "", discrepancyQty: "", acceptedQty: "", comments: "" }]);
  const updRecvRow = (key: number, patch: Partial<RecvRow>) => setRecvRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const delRecvRow = (key: number) => setRecvRows((r) => r.filter((x) => x.key !== key));

  const rowsValid = (rows: ItemRow[]) => rows.length > 0 && rows.every((r) => r.itemId && r.quantity && Number(r.quantity) > 0);

  const submitRequisition = async (form: ReqFormValues, rows: ItemRow[]) => {
    if (!rowsValid(rows)) return setErr("Add at least one item with a quantity greater than 0.");
    if (form.fromWarehouseId && form.fromWarehouseId === form.toWarehouseId) return setErr("Source and destination warehouses must differ.");
    setBusy(true);
    setErr(null);
    try {
      await apiReq("POST", "/transfers/requisitions", {
        fromWarehouseId: form.fromWarehouseId,
        toWarehouseId: form.toWarehouseId,
        projectId: form.projectId,
        items: rows.map((r) => ({
          itemId: Number(r.itemId),
          ...(r.brandVariantId ? { brandVariantId: Number(r.brandVariantId) } : {}),
          quantity: Number(r.quantity),
        })),
      });
      requisitions.reload();
      setShowNew(false);
      setMsg("Transfer request created");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const submitEditRequisition = async (form: ReqFormValues) => {
    if (!editReq) return;
    if (form.fromWarehouseId && form.fromWarehouseId === form.toWarehouseId) return setErr("Source and destination warehouses must differ.");
    setBusy(true);
    setErr(null);
    try {
      await apiReq("PATCH", `/transfers/requisitions/${editReq.id}`, {
        fromWarehouseId: form.fromWarehouseId,
        toWarehouseId: form.toWarehouseId,
        projectId: form.projectId,
      });
      requisitions.reload();
      setEditReq(null);
      setMsg("Requisition updated");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteReq = async () => {
    if (!delReq) return;
    setBusy(true);
    setErr(null);
    try {
      await apiReq("DELETE", `/transfers/requisitions/${delReq.id}`);
      requisitions.reload();
      setDelReq(null);
      setMsg("Requisition deleted");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const submitEditOrder = async (requisitionId: number) => {
    if (!editOrder) return;
    setBusy(true);
    setErr(null);
    try {
      await apiReq("PATCH", `/transfers/orders/${editOrder.id}`, { requisitionId });
      orders.reload();
      requisitions.reload();
      setEditOrder(null);
      setMsg("Order updated");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteOrder = async () => {
    if (!delOrder) return;
    setBusy(true);
    setErr(null);
    try {
      await apiReq("DELETE", `/transfers/orders/${delOrder.id}`);
      orders.reload();
      requisitions.reload();
      setDelOrder(null);
      setMsg("Order deleted");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const submitApprove = async (approve: boolean) => {
    if (!approveFor) return;
    setBusy(true);
    setErr(null);
    try {
      await apiReq("POST", `/transfers/requisitions/${approveFor.id}/approve`, {
        approve,
        ...(approveComment.trim() ? { comment: approveComment.trim() } : {}),
      });
      requisitions.reload();
      setApproveFor(null);
      setApproveComment("");
      setMsg(approve ? "Requisition approved" : "Requisition rejected");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const submitDispatch = async (e: FormEvent) => {
    e.preventDefault();
    if (!dispatchFor) return;
    if (!rowsValid(shipItems)) return setErr("Add at least one item with a quantity greater than 0.");
    setBusy(true);
    setErr(null);
    try {
      await apiReq("POST", "/transfers/orders", {
        requisitionId: dispatchFor.id,
        items: shipItems.map((r) => ({
          itemId: Number(r.itemId),
          ...(r.brandVariantId ? { brandVariantId: Number(r.brandVariantId) } : {}),
          quantity: Number(r.quantity),
        })),
      });
      orders.reload();
      requisitions.reload();
      setDispatchFor(null);
      setMsg("Transfer dispatched");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Dispatch failed");
    } finally {
      setBusy(false);
    }
  };

  const openReceive = (o: OrderLike) => {
    setReceiveFor(o);
    setRecvRows(
      o.items
        .filter((i) => i.quantity - (i.receivedQty ?? 0) > 0)
        .map((i) => ({ key: ++keyRef.current, transferItemId: String(i.id), receivedQty: String(i.quantity - (i.receivedQty ?? 0)), discrepancyQty: "", acceptedQty: String(i.quantity - (i.receivedQty ?? 0)), comments: "" }))
    );
    setLoss({ sending: "", receiving: "", logistics: "" });
    setErr(null);
  };

  const submitReceive = async (e: FormEvent) => {
    e.preventDefault();
    if (!receiveFor) return;
    if (recvRows.length === 0 || recvRows.some((r) => !r.transferItemId || !r.receivedQty || Number(r.receivedQty) <= 0))
      return setErr("Add at least one item with a received quantity greater than 0.");
    setBusy(true);
    setErr(null);
    try {
      const lossAllocation = loss.sending || loss.receiving || loss.logistics
        ? { sending: Number(loss.sending || 0), receiving: Number(loss.receiving || 0), logistics: Number(loss.logistics || 0) }
        : undefined;
      await apiReq("POST", `/transfers/orders/${receiveFor.id}/receive`, {
        items: recvRows.map((r) => ({
          transferItemId: Number(r.transferItemId),
          receivedQty: Number(r.receivedQty),
          ...(r.discrepancyQty ? { discrepancyQty: Number(r.discrepancyQty) } : {}),
          ...(r.acceptedQty ? { acceptedQty: Number(r.acceptedQty) } : {}),
          ...(r.comments ? { comments: r.comments } : {}),
        })),
        ...(lossAllocation ? { lossAllocation } : {}),
      });
      orders.reload();
      requisitions.reload();
      setReceiveFor(null);
      setMsg("Receipt recorded");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Receive failed");
    } finally {
      setBusy(false);
    }
  };

  const renderItemRow = (row: ItemRow, upd: (key: number, patch: Partial<ItemRow>) => void, del: (key: number) => void) => {
    const item = items.data?.find((i) => i.id === Number(row.itemId));
    return (
      <div className="form-row" key={row.key}>
        <div className="field">
          <label>Item</label>
          <select value={row.itemId} onChange={(e) => upd(row.key, { itemId: e.target.value, brandVariantId: "" })} required>
            <option value="">Select item…</option>
            {items.data?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} — {i.description}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Brand variant</label>
          <select value={row.brandVariantId} onChange={(e) => upd(row.key, { brandVariantId: e.target.value })}>
            <option value="">—</option>
            {item?.brandVariants.map((bv) => (
              <option key={bv.id} value={bv.id}>
                {bv.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Quantity</label>
          <input type="number" min="1" value={row.quantity} onChange={(e) => upd(row.key, { quantity: e.target.value })} required />
        </div>
        <div className="field">
          <label>&nbsp;</label>
          <button type="button" className="btn ghost sm" onClick={() => del(row.key)}>
            Remove
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="topbar">
        <h1>Transfers</h1>
        <div className="crumb">Inter-warehouse movement · In-transit aging</div>
      </div>

      <div className="toolbar">
        <button className="btn amber" onClick={() => { setShowNew(true); setErr(null); }}>
          + New transfer
        </button>
        <span className="spacer" />
      </div>

      {err && !showNew && !approveFor && !dispatchFor && !receiveFor && !editReq && !editOrder && (
        <ErrorBanner message={err} />
      )}

      <div className="tabs">
        <button className={tab === "requisitions" ? "active" : ""} onClick={() => setTab("requisitions")}>
          Requisitions ({requisitions.data?.length ?? 0})
        </button>
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>
          Orders ({orders.data?.length ?? 0})
        </button>
        <button className={tab === "aging" ? "active" : ""} onClick={() => setTab("aging")}>
          In-transit aging ({aging.data?.length ?? 0})
        </button>
      </div>

      {tab === "requisitions" && (
        <div className="card">
          {requisitions.error && <ErrorBanner message={requisitions.error} />}
          {requisitions.loading ? (
            <Loading />
          ) : !requisitions.data?.length ? (
            <Empty />
          ) : (
            <div className="tbl-wrap">
              <ListToolbar
                q={reqQ}
                setQ={setReqQ}
                rows={filteredReqs}
                columns={[
                  { key: "number", label: "Number" },
                  { key: "status", label: "Status" },
                ]}
                filename="transfer-requisitions"
              />
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Requisition</th>
                    <th>Route</th>
                    <th>Project</th>
                    <th>Requested by</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredReqs ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.number}</td>
                      <td>
                        {r.fromWarehouse.code} → {r.toWarehouse.code}
                      </td>
                      <td>{r.project?.name ?? "—"}</td>
                      <td>{r.requestedBy?.name ?? "—"}</td>
                      <td>
                        <Badge status={r.status} />
                      </td>
                      <td>
                        <HistoryButton entityType="TransferRequisition" entityId={r.id} />
                        <button className="btn ghost sm" onClick={() => { setViewReq(r); setErr(null); }}>
                          View
                        </button>
                        {r.status === "REQUESTED" && (
                          <button className="btn ghost sm" onClick={() => { setEditReq(r); setErr(null); }}>
                            Edit
                          </button>
                        )}
                        {r.status === "REQUESTED" && (
                          <button className="btn danger sm" onClick={() => { setDelReq(r); setErr(null); }}>
                            Delete
                          </button>
                        )}
                        {r.status === "REQUESTED" && (
                          <button className="btn sm" onClick={() => { setApproveFor(r); setApproveComment(""); setErr(null); }}>
                            Approve
                          </button>
                        )}
                        {r.status === "APPROVED" && (
                          <button className="btn sm" onClick={() => { setDispatchFor(r); setShipItems([{ key: ++keyRef.current, itemId: "", brandVariantId: "", quantity: "" }]); setErr(null); }}>
                            Dispatch
                          </button>
                        )}
                        {(r.status === "DISPATCHED" || r.status === "IN_TRANSIT") && r.orders[0] && (
                          <button className="btn sm" onClick={() => openReceive(r.orders[0])}>
                            Receive
                          </button>
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

      {tab === "orders" && (
        <div className="card">
          {orders.error && <ErrorBanner message={orders.error} />}
          {orders.loading ? (
            <Loading />
          ) : !orders.data?.length ? (
            <Empty />
          ) : (
            <div className="tbl-wrap">
              <ListToolbar
                q={orderQ}
                setQ={setOrderQ}
                rows={filteredOrders}
                columns={[
                  { key: "number", label: "Number" },
                  { key: "status", label: "Status" },
                ]}
                filename="transfer-orders"
              />
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Route</th>
                    <th>Items</th>
                    <th>Received</th>
                    <th>Loss</th>
                    <th>Status</th>
                    <th>Dispatched</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredOrders ?? []).map((o) => {
                    const lossAlloc = o.receipts[0]?.lossAllocation;
                    return (
                      <tr key={o.id}>
                        <td className="mono">{o.number}</td>
                        <td>
                          {o.requisition.fromWarehouse.code} → {o.requisition.toWarehouse.code}
                        </td>
                        <td className="num">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                        <td className="num">{o.items.reduce((s, i) => s + (i.receivedQty ?? 0), 0)}</td>
                        <td className="num">
                          {lossAlloc ? `${lossAlloc.sending}/${lossAlloc.receiving}/${lossAlloc.logistics}` : "—"}
                        </td>
                        <td>
                          <Badge status={o.status} />
                        </td>
                        <td className="mono">
                          {o.dispatchedAt ? new Date(o.dispatchedAt).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td>
                          <HistoryButton entityType="TransferOrder" entityId={o.id} />
                          <button className="btn ghost sm" onClick={() => { setViewOrder(o); setErr(null); }}>
                            View
                          </button>
                          {(o.status === "DISPATCHED" || o.status === "IN_TRANSIT") && (
                            <button className="btn ghost sm" onClick={() => { setEditOrder(o); setErr(null); }}>
                              Edit
                            </button>
                          )}
                          {(o.status === "DISPATCHED" || o.status === "IN_TRANSIT") && (
                            <button className="btn danger sm" onClick={() => { setDelOrder(o); setErr(null); }}>
                              Delete
                            </button>
                          )}
                          {(o.status === "DISPATCHED" || o.status === "IN_TRANSIT") && (
                            <button className="btn sm" onClick={() => openReceive(o)}>
                              Receive
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "aging" && (
        <div className="card">
          {aging.error && <ErrorBanner message={aging.error} />}
          {aging.loading ? (
            <Loading />
          ) : !aging.data?.length ? (
            <Empty text="No shipments in transit." />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Route</th>
                    <th>Lines</th>
                    <th>Days in transit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {aging.data.map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{a.number}</td>
                      <td>
                        {a.from} → {a.to}
                      </td>
                      <td className="num">{a.items}</td>
                      <td className="num">{a.daysInTransit}</td>
                      <td>{a.stale ? <Badge status="STALE" /> : <Badge status="IN_TRANSIT" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <RequisitionFormModal
        open={showNew}
        onClose={() => setShowNew(false)}
        initial={null}
        busy={busy}
        err={err}
        warehouses={warehouses.data}
        me={me}
        renderRow={renderItemRow}
        onSubmit={submitRequisition}
      />

      {editReq && (
        <RequisitionFormModal
          open
          onClose={() => setEditReq(null)}
          initial={{ fromWarehouseId: editReq.fromWarehouse.id, toWarehouseId: editReq.toWarehouse.id, projectId: editReq.project?.id ?? null }}
          busy={busy}
          err={err}
          warehouses={warehouses.data}
          me={me}
          renderRow={renderItemRow}
          onSubmit={(form) => submitEditRequisition(form)}
        />
      )}

      {viewReq && (
        <Modal title={`Requisition ${viewReq.number}`} onClose={() => setViewReq(null)}>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Number</span>
              <span className="mono">{viewReq.number}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status</span>
              <Badge status={viewReq.status} />
            </div>
            <div className="detail-item">
              <span className="detail-label">From</span>
              <span>{viewReq.fromWarehouse.code}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">To</span>
              <span>{viewReq.toWarehouse.code}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Project</span>
              <span>{viewReq.project?.name ?? "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Requested by</span>
              <span>{viewReq.requestedBy?.name ?? "—"}</span>
            </div>
          </div>
          {viewReq.orders.length > 0 && (
            <>
              <div className="sub-head">
                <strong>Orders</strong>
              </div>
              <ul className="plain-list">
                {viewReq.orders.map((o) => (
                  <li key={o.id}>
                    <span className="mono">{o.number}</span>
                    <span className="muted"> · {o.items.reduce((s, i) => s + i.quantity, 0)} items</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="modal-actions">
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setViewReq(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {delReq && (
        <ConfirmDialog
          title="Delete requisition"
          message={`Delete requisition ${delReq.number}? This cannot be undone.`}
          busy={busy}
          onConfirm={confirmDeleteReq}
          onCancel={() => setDelReq(null)}
        />
      )}

      {viewOrder && (
        <Modal title={`Order ${viewOrder.number}`} onClose={() => setViewOrder(null)} wide>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Number</span>
              <span className="mono">{viewOrder.number}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status</span>
              <Badge status={viewOrder.status} />
            </div>
            <div className="detail-item">
              <span className="detail-label">Route</span>
              <span>
                {viewOrder.requisition.fromWarehouse.code} → {viewOrder.requisition.toWarehouse.code}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Dispatched</span>
              <span>{viewOrder.dispatchedAt ? new Date(viewOrder.dispatchedAt).toLocaleDateString("en-GB") : "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Received</span>
              <span>{viewOrder.receivedAt ? new Date(viewOrder.receivedAt).toLocaleDateString("en-GB") : "—"}</span>
            </div>
          </div>
          <div className="sub-head">
            <strong>Items</strong>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Received</th>
                    <th>Discrepancy</th>
                    <th>Accepted</th>
                    <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {viewOrder.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.item.code} — {i.item.description}
                    </td>
                    <td className="num">{i.quantity}</td>
                    <td className="num">{i.receivedQty ?? 0}</td>
                    <td className="num">{i.discrepancyQty ?? 0}</td>
                    <td className="num">{i.acceptedQty ?? 0}</td>
                    <td>{i.comments ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setViewOrder(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {editOrder && (
        <Modal title={`Edit order ${editOrder.number}`} onClose={() => setEditOrder(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const sel = (e.currentTarget.elements.namedItem("requisitionId") as HTMLSelectElement).value;
              submitEditOrder(Number(sel));
            }}
          >
            <div className="field">
              <label>Requisition</label>
              <select name="requisitionId" defaultValue={editOrder.requisitionId} required>
                {requisitions.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number} — {r.fromWarehouse.code} → {r.toWarehouse.code}
                  </option>
                ))}
              </select>
            </div>
            {err && <ErrorBanner message={err} />}
            <div className="modal-actions">
              <span className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setEditOrder(null)}>
                Cancel
              </button>
              <button type="submit" className="btn amber" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {delOrder && (
        <ConfirmDialog
          title="Delete order"
          message={`Delete order ${delOrder.number}? This cannot be undone.`}
          busy={busy}
          onConfirm={confirmDeleteOrder}
          onCancel={() => setDelOrder(null)}
        />
      )}

      {approveFor && (
        <Modal title={`Approve ${approveFor.number}`} onClose={() => setApproveFor(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitApprove(true);
            }}
          >
            <div className="field">
              <label>Comment (optional)</label>
              <textarea rows={3} value={approveComment} onChange={(e) => setApproveComment(e.target.value)} placeholder="Approval note…" />
            </div>
            {err && <ErrorBanner message={err} />}
            <div className="modal-actions">
              <span className="spacer" />
              <button type="button" className="btn ghost" onClick={() => submitApprove(false)} disabled={busy}>
                Reject
              </button>
              <button type="submit" className="btn amber" disabled={busy}>
                {busy ? "Saving…" : "Approve"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {dispatchFor && (
        <Modal title={`Dispatch ${dispatchFor.number}`} onClose={() => setDispatchFor(null)} wide>
          <form onSubmit={submitDispatch}>
            <div className="hint">
              {dispatchFor.fromWarehouse.code} → {dispatchFor.toWarehouse.code}
            </div>
            {shipItems.map((row) => renderItemRow(row, updShipRow, delShipRow))}
            <button type="button" className="btn ghost sm" onClick={addShipRow}>
              + Add item
            </button>
            {err && <ErrorBanner message={err} />}
            <div className="modal-actions">
              <span className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setDispatchFor(null)}>
                Cancel
              </button>
              <button type="submit" className="btn amber" disabled={busy}>
                {busy ? "Dispatching…" : "Dispatch"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {receiveFor && (
        <Modal title={`Receive ${receiveFor.number}`} onClose={() => setReceiveFor(null)} wide>
          <form onSubmit={submitReceive}>
            {recvRows.map((row) => (
              <div className="form-row" key={row.key}>
                <div className="field">
                  <label>Item</label>
                  <select value={row.transferItemId} onChange={(e) => updRecvRow(row.key, { transferItemId: e.target.value })} required>
                    <option value="">Select…</option>
                    {receiveFor.items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.item.code} — {i.item.description} (qty {i.quantity})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Received qty</label>
                  <input type="number" min="1" value={row.receivedQty} onChange={(e) => updRecvRow(row.key, { receivedQty: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Discrepancy</label>
                  <input type="number" min="0" value={row.discrepancyQty} onChange={(e) => updRecvRow(row.key, { discrepancyQty: e.target.value })} placeholder="0" />
                </div>
                <div className="field">
                  <label>Accepted qty</label>
                  <input type="number" min="0" value={row.acceptedQty} onChange={(e) => updRecvRow(row.key, { acceptedQty: e.target.value })} />
                </div>
                <div className="field">
                  <label>Comments</label>
                  <input value={row.comments} onChange={(e) => updRecvRow(row.key, { comments: e.target.value })} />
                </div>
                <div className="field">
                  <label>&nbsp;</label>
                  <button type="button" className="btn ghost sm" onClick={() => delRecvRow(row.key)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn ghost sm" onClick={addRecvRow}>
              + Add item
            </button>
            <div className="form-row">
              <div className="field">
                <label>Loss — sending</label>
                <input type="number" min="0" value={loss.sending} onChange={(e) => setLoss({ ...loss, sending: e.target.value })} placeholder="0" />
              </div>
              <div className="field">
                <label>Loss — receiving</label>
                <input type="number" min="0" value={loss.receiving} onChange={(e) => setLoss({ ...loss, receiving: e.target.value })} placeholder="0" />
              </div>
              <div className="field">
                <label>Loss — logistics</label>
                <input type="number" min="0" value={loss.logistics} onChange={(e) => setLoss({ ...loss, logistics: e.target.value })} placeholder="0" />
              </div>
            </div>
            {err && <ErrorBanner message={err} />}
            <div className="modal-actions">
              <span className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setReceiveFor(null)}>
                Cancel
              </button>
              <button type="submit" className="btn amber" disabled={busy}>
                {busy ? "Saving…" : "Record receipt"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <Toast message={msg} onDone={() => setMsg(null)} />
    </>
  );
}