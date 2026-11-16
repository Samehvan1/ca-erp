import { FormEvent, useState } from "react";
import { Badge, ConfirmDialog, Empty, ErrorBanner, HistoryButton, ListToolbar, Loading, Modal, Toast, apiReq, useApi, useListFilter } from "../components";
import { useI18n } from "../lib/i18n";

interface Stocktake {
  id: number;
  number: string;
  type: string;
  abcClass: string | null;
  status: string;
  scheduledDate: string;
  completedAt: string | null;
  warehouse: { id: number; code: string };
  items: { id: number; systemQty: number; countedQty: number; varianceQty: number; item: { id: number; code: string; description: string } }[];
  adjustments: { id: number; quantity: number; status: string }[];
}

interface Adjustment {
  id: number;
  number: string;
  quantity: number;
  reason: string;
  status: string;
  createdAt: string;
  item: { code: string; description: string };
  warehouse: { code: string };
  stocktake: { number: string } | null;
}

interface Warehouse {
  id: number;
  code: string;
  name: string;
  type: string;
}

export default function Stocktaking() {
  const { t, isRtl } = useI18n();
  const [tab, setTab] = useState<"stocktakes" | "adjustments">("stocktakes");
  const stocktakes = useApi<Stocktake[]>("/stocktaking/stocktakes");
  const adjustments = useApi<Adjustment[]>("/stocktaking/adjustments");
  const warehouses = useApi<Warehouse[]>("/inventory/warehouses");

  const { q: stocktakeQ, setQ: setStocktakeQ, filtered: filteredStocktakes } = useListFilter<Stocktake>(stocktakes.data, ["number", "type", "status"]);
  const { q: adjQ, setQ: setAdjQ, filtered: filteredAdjustments } = useListFilter<Adjustment>(adjustments.data, ["number", "reason", "status"]);

  // New / edit stocktake
  const [showNew, setShowNew] = useState(false);
  const [editTarget, setEditTarget] = useState<Stocktake | null>(null);
  const [newForm, setNewForm] = useState({ warehouseId: "", type: "FULL", abcClass: "", scheduledDate: "", itemIds: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // View
  const [viewTarget, setViewTarget] = useState<Stocktake | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Stocktake | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  // Submit counts
  const [countTarget, setCountTarget] = useState<Stocktake | null>(null);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [countBusy, setCountBusy] = useState(false);
  const [countErr, setCountErr] = useState<string | null>(null);

  // Complete
  const [completeTarget, setCompleteTarget] = useState<Stocktake | null>(null);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [completeErr, setCompleteErr] = useState<string | null>(null);

  const openCounts = (s: Stocktake) => {
    const init: Record<number, string> = {};
    for (const i of s.items) init[i.id] = i.countedQty !== 0 ? String(i.countedQty) : "";
    setCounts(init);
    setCountErr(null);
    setCountTarget(s);
  };

  const openEdit = (s: Stocktake) => {
    setNewForm({
      warehouseId: String(s.warehouse.id),
      type: s.type,
      abcClass: s.abcClass ?? "",
      scheduledDate: s.scheduledDate ? s.scheduledDate.slice(0, 10) : "",
      itemIds: s.items.map((i) => i.item.id).join(", "),
    });
    setErr(null);
    setEditTarget(s);
  };

  const submitNew = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { warehouseId: Number(newForm.warehouseId), type: newForm.type };
      if (newForm.abcClass.trim()) body.abcClass = newForm.abcClass.trim();
      if (newForm.scheduledDate) body.scheduledDate = newForm.scheduledDate;
      const ids = newForm.itemIds
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n));
      if (ids.length) body.itemIds = ids;
      if (editTarget) {
        await apiReq("PATCH", `/stocktaking/stocktakes/${editTarget.id}`, body);
        setMsg("Stocktake updated");
      } else {
        await apiReq("POST", "/stocktaking/stocktakes", body);
        setMsg("Stocktake created");
      }
      stocktakes.reload();
      setShowNew(false);
      setEditTarget(null);
      setNewForm({ warehouseId: "", type: "FULL", abcClass: "", scheduledDate: "", itemIds: "" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteErr(null);
    try {
      await apiReq("DELETE", `/stocktaking/stocktakes/${deleteTarget.id}`);
      stocktakes.reload();
      setDeleteTarget(null);
      setMsg("Stocktake deleted");
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  };

  const submitCounts = async (e: FormEvent) => {
    e.preventDefault();
    if (!countTarget) return;
    setCountBusy(true);
    setCountErr(null);
    try {
      const payload = countTarget.items
        .filter((i) => (counts[i.id] ?? "").trim() !== "" && !Number.isNaN(Number(counts[i.id])))
        .map((i) => ({ stocktakeItemId: i.id, countedQty: Number(counts[i.id]) }));
      if (!payload.length) throw new Error("Enter at least one count");
      await apiReq("POST", `/stocktaking/stocktakes/${countTarget.id}/count`, { counts: payload });
      stocktakes.reload();
      setCountTarget(null);
      setMsg("Counts submitted");
    } catch (e) {
      setCountErr(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setCountBusy(false);
    }
  };

  const complete = async () => {
    if (!completeTarget) return;
    setCompleteBusy(true);
    setCompleteErr(null);
    try {
      await apiReq("POST", `/stocktaking/stocktakes/${completeTarget.id}/complete`);
      stocktakes.reload();
      setCompleteTarget(null);
      setMsg("Stocktake completed");
    } catch (e) {
      setCompleteErr(e instanceof Error ? e.message : "Complete failed");
    } finally {
      setCompleteBusy(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <h1>{t("stocktake.title")}</h1>
        <div className="crumb">{t("stocktake.subtitle")}</div>
      </div>

      <div className="toolbar">
        <div className="spacer" />
        <button className="btn amber" onClick={() => setShowNew(true)}>
          {t("stocktake.btn.new")}
        </button>
      </div>

      <div className="tabs">
        <button
          className={tab === "stocktakes" ? "active" : ""}
          onClick={() => setTab("stocktakes")}
        >
          📋 {isRtl ? "جلسات الجرد" : "Stocktakes"} ({stocktakes.data?.length ?? 0})
        </button>
        <button
          className={tab === "adjustments" ? "active" : ""}
          onClick={() => setTab("adjustments")}
        >
          ⚖️ {isRtl ? "تسويات الفروقات" : "Adjustments"} ({adjustments.data?.length ?? 0})
        </button>
      </div>

      {tab === "stocktakes" && (
        <div className="card">
          {stocktakes.error && <ErrorBanner message={stocktakes.error} />}
          {stocktakes.loading ? (
            <Loading />
          ) : !stocktakes.data?.length ? (
            <Empty />
          ) : (
            <div className="tbl-wrap">
              <ListToolbar
                q={stocktakeQ}
                setQ={setStocktakeQ}
                rows={filteredStocktakes}
                columns={[
                  { key: "number", label: "Number" },
                  { key: "type", label: "Type" },
                  { key: "status", label: "Status" },
                ]}
                filename="stocktakes"
              />
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Stocktake</th>
                    <th>Warehouse</th>
                    <th>Type</th>
                    <th>ABC</th>
                    <th>Lines</th>
                    <th>Variance</th>
                    <th>Status</th>
                    <th>Scheduled</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredStocktakes ?? []).map((s) => {
                    const variance = s.items.reduce((sum, i) => sum + Math.abs(i.varianceQty ?? 0), 0);
                    return (
                      <tr key={s.id}>
                        <td className="mono">{s.number}</td>
                        <td className="mono">{s.warehouse.code}</td>
                        <td>
                          <Badge status={s.type.replace(/_/g, " ")} />
                        </td>
                        <td>{s.abcClass ?? "—"}</td>
                        <td className="num">{s.items.length}</td>
                        <td className="num">{variance.toFixed(1)}</td>
                        <td>
                          <Badge status={s.status} />
                        </td>
                        <td className="mono">{new Date(s.scheduledDate).toLocaleDateString("en-GB")}</td>
                        <td>
                          {s.status === "SCHEDULED" && (
                            <button className="btn sm" onClick={() => openCounts(s)}>
                              Submit counts
                            </button>
                          )}
                          {s.status === "IN_PROGRESS" && (
                            <button className="btn sm" onClick={() => setCompleteTarget(s)}>
                              Complete
                            </button>
                          )}
                        </td>
                        <td className="row-actions">
                          <HistoryButton entityType="Stocktake" entityId={s.id} />
                          <button className="btn sm ghost" onClick={() => setViewTarget(s)}>
                            View
                          </button>
                          <button className="btn sm ghost" onClick={() => openEdit(s)}>
                            Edit
                          </button>
                          {s.status === "SCHEDULED" && (
                            <button className="btn sm danger" onClick={() => setDeleteTarget(s)}>
                              Delete
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

      {tab === "adjustments" && (
        <div className="card">
          {adjustments.error && <ErrorBanner message={adjustments.error} />}
          {adjustments.loading ? (
            <Loading />
          ) : !adjustments.data?.length ? (
            <Empty />
          ) : (
            <div className="tbl-wrap">
              <ListToolbar
                q={adjQ}
                setQ={setAdjQ}
                rows={filteredAdjustments}
                columns={[
                  { key: "number", label: "Number" },
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
                      <td>
                        <Badge status={a.status} />
                      </td>
                      <td className="mono">{new Date(a.createdAt).toLocaleDateString("en-GB")}</td>
                      <td className="actions">
                        <HistoryButton entityType="Adjustment" entityId={a.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(showNew || editTarget) && (
        <Modal title={editTarget ? `Edit stocktake · ${editTarget.number}` : "New stocktake"} onClose={() => { setShowNew(false); setEditTarget(null); }} wide>
          <form onSubmit={submitNew}>
            {err && <ErrorBanner message={err} />}
            <div className="form-row">
              <div className="field">
                <label>Warehouse</label>
                <select value={newForm.warehouseId} onChange={(e) => setNewForm({ ...newForm, warehouseId: e.target.value })} required>
                  <option value="">Select…</option>
                  {(warehouses.data ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} · {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Type</label>
                <select value={newForm.type} onChange={(e) => setNewForm({ ...newForm, type: e.target.value })}>
                  <option value="FULL">Full</option>
                  <option value="CYCLE">Cycle</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>ABC class (optional)</label>
                <input placeholder="e.g. A" value={newForm.abcClass} onChange={(e) => setNewForm({ ...newForm, abcClass: e.target.value })} />
              </div>
              <div className="field">
                <label>Scheduled date (optional)</label>
                <input type="date" value={newForm.scheduledDate} onChange={(e) => setNewForm({ ...newForm, scheduledDate: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Item IDs (optional, comma-separated)</label>
              <input placeholder="e.g. 12, 34, 56" value={newForm.itemIds} onChange={(e) => setNewForm({ ...newForm, itemIds: e.target.value })} />
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => { setShowNew(false); setEditTarget(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn amber" disabled={busy}>
                {busy ? "Saving…" : editTarget ? "Save changes" : "Create stocktake"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {countTarget && (
        <Modal title={`Submit counts · ${countTarget.number}`} onClose={() => setCountTarget(null)} wide>
          <form onSubmit={submitCounts}>
            {countErr && <ErrorBanner message={countErr} />}
            {countTarget.items.map((i) => (
              <div className="field" key={i.id}>
                <label>
                  {i.item.code} · {i.item.description} <span className="hint">(system {i.systemQty})</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Counted qty"
                  value={counts[i.id] ?? ""}
                  onChange={(e) => setCounts({ ...counts, [i.id]: e.target.value })}
                />
              </div>
            ))}
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setCountTarget(null)}>
                Cancel
              </button>
              <button type="submit" className="btn amber" disabled={countBusy}>
                {countBusy ? "Submitting…" : "Submit counts"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {completeTarget && (
        <Modal title={`Complete ${completeTarget.number}`} onClose={() => setCompleteTarget(null)}>
          {completeErr && <ErrorBanner message={completeErr} />}
          <p>Complete this stocktake? Variance adjustments will be generated for counted differences.</p>
          <div className="modal-actions">
            <div className="spacer" />
            <button className="btn ghost" onClick={() => setCompleteTarget(null)}>
              Cancel
            </button>
            <button className="btn amber" disabled={completeBusy} onClick={complete}>
              {completeBusy ? "Completing…" : "Complete"}
            </button>
          </div>
        </Modal>
      )}

      {viewTarget && (
        <Modal title={`Stocktake · ${viewTarget.number}`} onClose={() => setViewTarget(null)} wide>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Reference</span>
              <span className="mono">{viewTarget.number}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Warehouse</span>
              <span className="mono">{viewTarget.warehouse.code}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Type</span>
              <Badge status={viewTarget.type.replace(/_/g, " ")} />
            </div>
            <div className="detail-item">
              <span className="detail-label">ABC class</span>
              <span>{viewTarget.abcClass ?? "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status</span>
              <Badge status={viewTarget.status} />
            </div>
            <div className="detail-item">
              <span className="detail-label">Scheduled</span>
              <span className="mono">{new Date(viewTarget.scheduledDate).toLocaleDateString("en-GB")}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Completed</span>
              <span className="mono">{viewTarget.completedAt ? new Date(viewTarget.completedAt).toLocaleDateString("en-GB") : "—"}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Lines</span>
              <span>{viewTarget.items.length}</span>
            </div>
          </div>
          <div className="detail-section">
            <h4>Counts</h4>
            {viewTarget.items.length ? (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>System</th>
                    <th>Counted</th>
                    <th>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {viewTarget.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.item.code} · {i.item.description}
                      </td>
                      <td className="num">{i.systemQty}</td>
                      <td className="num">{i.countedQty}</td>
                      <td className="num">{i.varianceQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No items.</p>
            )}
          </div>
          <div className="modal-actions">
            <div className="spacer" />
            <button className="btn ghost" onClick={() => setViewTarget(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.number}`}
          message={
            deleteErr
              ? `Delete stocktake ${deleteTarget.number}? ${deleteErr}`
              : `Delete stocktake ${deleteTarget.number}? This cannot be undone.`
          }
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <Toast message={msg} onDone={() => setMsg(null)} />
    </>
  );
}