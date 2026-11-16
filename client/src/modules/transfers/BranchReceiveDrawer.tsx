import { FormEvent, useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { TransferOrder, RecvRow } from "./types";
import { apiReq } from "../../components";

export interface BranchReceiveDrawerProps {
  open: boolean;
  onClose: () => void;
  order: TransferOrder | null;
  onSuccess: (msg: string) => void;
}

export function BranchReceiveDrawer({
  open,
  onClose,
  order,
  onSuccess,
}: BranchReceiveDrawerProps) {
  const [rows, setRows] = useState<RecvRow[]>([]);
  const [loss, setLoss] = useState({ sending: "0", receiving: "0", logistics: "100" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    const initialRows: RecvRow[] = order.items.map((item, idx) => ({
      key: idx,
      transferItemId: String(item.id),
      receivedQty: String(item.quantity),
      acceptedQty: String(item.quantity),
      discrepancyQty: "0",
      comments: "",
    }));
    setRows(initialRows);
    setLoss({ sending: "0", receiving: "0", logistics: "100" });
    setErr(null);
  }, [open, order]);

  if (!order) return null;

  const handleRowChange = (idx: number, patch: Partial<RecvRow>) => {
    setRows((prev) => {
      const next = [...prev];
      const cur = { ...next[idx], ...patch };
      const originalDispatched = order.items[idx]?.quantity || 0;
      const rec = parseFloat(cur.receivedQty) || 0;
      const acc = parseFloat(cur.acceptedQty) || 0;

      // Discrepancy = original dispatched - accepted
      cur.discrepancyQty = String(Math.max(0, originalDispatched - acc));
      next[idx] = cur;
      return next;
    });
  };

  const hasAnyDiscrepancy = rows.some((r) => parseFloat(r.discrepancyQty) > 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    try {
      const sLoss = parseFloat(loss.sending) || 0;
      const rLoss = parseFloat(loss.receiving) || 0;
      const lLoss = parseFloat(loss.logistics) || 0;

      if (hasAnyDiscrepancy && sLoss + rLoss + lLoss !== 100) {
        throw new Error("Loss allocation percentages must sum to 100%.");
      }

      const payload = {
        items: rows.map((r) => ({
          transferItemId: Number(r.transferItemId),
          receivedQty: Number(r.receivedQty),
          acceptedQty: Number(r.acceptedQty),
          discrepancyQty: Number(r.discrepancyQty),
          comments: r.comments || null,
        })),
        lossAllocation: hasAnyDiscrepancy
          ? { sending: sLoss, receiving: rLoss, logistics: lLoss }
          : null,
      };

      await apiReq("POST", `/transfers/orders/${order.id}/receive`, payload);
      onSuccess(`Transfer Order #${order.number} received and checked in successfully.`);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to submit receipt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Receive Transfer #${order.number}`}
      subtitle={`Arriving from ${order.requisition?.fromWarehouse?.code || "Origin"} to ${order.requisition?.toWarehouse?.code || "Destination"}`}
      width="lg"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{ background: "#2e7d32", color: "#fff" }}
            onClick={handleSubmit}
            disabled={busy}
          >
            {busy ? "Processing Check-in…" : "Confirm Branch Check-in"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {err && <div className="error-banner" style={{ marginBottom: 16 }}>{err}</div>}

        <div style={{ marginBottom: 16, fontSize: 13, color: "var(--muted)" }}>
          Inspect each item delivered. Confirm accepted quantity and record any damaged or missing items.
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, overflowX: "auto", marginBottom: 20 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th style={{ textAlign: "right", width: 90 }}>Dispatched</th>
                <th style={{ textAlign: "right", width: 110 }}>Delivered Qty</th>
                <th style={{ textAlign: "right", width: 110 }}>Accepted Qty</th>
                <th style={{ textAlign: "right", width: 90 }}>Discrepancy</th>
                <th>Damage / Notes</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => {
                const r = rows[idx];
                if (!r) return null;
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="mono" style={{ fontWeight: 600 }}>{item.item?.code}</div>
                      <div style={{ fontSize: 12 }}>{item.item?.description}</div>
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600 }}>
                      {item.quantity}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        style={{ width: "100%", textAlign: "right", padding: "4px 8px" }}
                        value={r.receivedQty}
                        onChange={(e) => handleRowChange(idx, { receivedQty: e.target.value })}
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        style={{ width: "100%", textAlign: "right", padding: "4px 8px", borderColor: "#2e7d32" }}
                        value={r.acceptedQty}
                        onChange={(e) => handleRowChange(idx, { acceptedQty: e.target.value })}
                        required
                      />
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                      {parseFloat(r.discrepancyQty) > 0 ? (
                        <span className="variance-pill variance-neg">-{r.discrepancyQty}</span>
                      ) : (
                        <span style={{ color: "var(--ok)", fontWeight: 600 }}>0</span>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="e.g. Broken packaging"
                        style={{ width: "100%", padding: "4px 8px", fontSize: 12 }}
                        value={r.comments}
                        onChange={(e) => handleRowChange(idx, { comments: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Discrepancy & Loss Allocation */}
        {hasAnyDiscrepancy && (
          <div
            style={{
              padding: 16,
              background: "#fff8e1",
              border: "1px solid #ffe082",
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 600, color: "#b45309", marginBottom: 8 }}>
              ⚠️ Discrepancy Detected — Assign Cost Loss Allocation (Must sum to 100%)
            </div>
            <div className="form-row">
              <div className="field">
                <label>Sending Warehouse (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={loss.sending}
                  onChange={(e) => setLoss({ ...loss, sending: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Receiving Branch (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={loss.receiving}
                  onChange={(e) => setLoss({ ...loss, receiving: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Logistics Transport (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={loss.logistics}
                  onChange={(e) => setLoss({ ...loss, logistics: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>
        )}
      </form>
    </Drawer>
  );
}
