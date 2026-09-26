import { FormEvent, useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { Po } from "./types";
import { apiReq } from "../../components";

export interface GrnReceivingDrawerProps {
  open: boolean;
  onClose: () => void;
  po: Po | null;
  onSuccess: (msg: string) => void;
}

interface GrnRowState {
  poItemId: number;
  itemCode: string;
  itemDesc: string;
  uom: string;
  orderedQty: number;
  receivedToDate: number;
  outstandingQty: number;
  receivedQty: string;
  acceptedQty: string;
  quarantinedQty: string;
  batchNo: string;
  expiryDate: string;
  unitCost: string;
}

export function GrnReceivingDrawer({
  open,
  onClose,
  po,
  onSuccess,
}: GrnReceivingDrawerProps) {
  const [rows, setRows] = useState<GrnRowState[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!po) return;
    const defaultExp = new Date();
    defaultExp.setDate(defaultExp.getDate() + 90);
    const expStr = defaultExp.toISOString().slice(0, 10);

    const initial: GrnRowState[] = po.items.map((item, idx) => {
      const out = Math.max(0, item.orderedQty - (item.receivedQty || 0));
      return {
        poItemId: item.id,
        itemCode: item.item?.code || `Item #${item.itemId}`,
        itemDesc: item.item?.description || "",
        uom: item.item?.uom || "Each",
        orderedQty: item.orderedQty,
        receivedToDate: item.receivedQty || 0,
        outstandingQty: out,
        receivedQty: String(out),
        acceptedQty: String(out),
        quarantinedQty: "0",
        batchNo: `LOT-${Date.now().toString().slice(-5)}${idx + 1}`,
        expiryDate: expStr,
        unitCost: String(item.unitPrice || "0"),
      };
    });

    setRows(initial);
    setErr(null);
  }, [open, po]);

  if (!po) return null;

  const handleRowChange = (idx: number, patch: Partial<GrnRowState>) => {
    setRows((prev) => {
      const next = [...prev];
      const cur = { ...next[idx], ...patch };
      if ("receivedQty" in patch && !("acceptedQty" in patch)) {
        const rVal = parseFloat(cur.receivedQty) || 0;
        const qVal = parseFloat(cur.quarantinedQty) || 0;
        cur.acceptedQty = String(Math.max(0, rVal - qVal));
      }
      next[idx] = cur;
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    try {
      const activeRows = rows.filter((r) => parseFloat(r.receivedQty) > 0);
      if (activeRows.length === 0) {
        throw new Error("Please specify received quantity for at least one item.");
      }

      const payload = {
        poId: po.id,
        items: activeRows.map((r) => ({
          poItemId: r.poItemId,
          receivedQty: Number(r.receivedQty),
          acceptedQty: Number(r.acceptedQty),
          quarantinedQty: Number(r.quarantinedQty) || 0,
          batchNo: r.batchNo,
          expiryDate: new Date(r.expiryDate).toISOString(),
          unitCost: Number(r.unitCost) || 0,
        })),
      };

      await apiReq("POST", "/procurement/grns", payload);
      onSuccess(`Goods Receipt (GRN) created for PO #${po.number}. Inventory batches checked in.`);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to record GRN receipt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Receive Goods against PO #${po.number}`}
      subtitle={`Vendor: ${po.vendor?.name} | Inspect quantities and generate on-hand batches`}
      width="xl"
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
            {busy ? "Checking In Batches…" : "Confirm Goods Receipt (GRN)"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {err && <div className="error-banner" style={{ marginBottom: 16 }}>{err}</div>}

        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, overflowX: "auto", marginBottom: 20 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th style={{ textAlign: "right", width: 80 }}>Ordered</th>
                <th style={{ textAlign: "right", width: 80 }}>To Date</th>
                <th style={{ textAlign: "right", width: 90 }}>Delivered *</th>
                <th style={{ textAlign: "right", width: 90 }}>Accepted *</th>
                <th style={{ textAlign: "right", width: 80 }}>Quarantine</th>
                <th style={{ minWidth: 120 }}>Batch / Lot #</th>
                <th style={{ minWidth: 130 }}>Expiry Date *</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.poItemId}>
                  <td>
                    <div className="mono" style={{ fontWeight: 600 }}>{r.itemCode}</div>
                    <div style={{ fontSize: 12 }}>{r.itemDesc}</div>
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{r.orderedQty}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", color: "var(--muted)" }}>{r.receivedToDate}</td>
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
                  <td>
                    <input
                      type="number"
                      step="any"
                      style={{ width: "100%", textAlign: "right", padding: "4px 8px" }}
                      value={r.quarantinedQty}
                      onChange={(e) => handleRowChange(idx, { quarantinedQty: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      style={{ width: "100%", padding: "4px 8px", fontFamily: "var(--mono)", fontSize: 12 }}
                      value={r.batchNo}
                      onChange={(e) => handleRowChange(idx, { batchNo: e.target.value })}
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      style={{ width: "100%", padding: "4px 8px", fontSize: 12 }}
                      value={r.expiryDate}
                      onChange={(e) => handleRowChange(idx, { expiryDate: e.target.value })}
                      required
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
    </Drawer>
  );
}
