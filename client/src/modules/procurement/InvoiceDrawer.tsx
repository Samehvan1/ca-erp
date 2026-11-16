import { FormEvent, useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { Vendor, Po, Grn, Invoice } from "./types";
import { apiReq } from "../../components";

export interface InvoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  vendors: Vendor[];
  pos: Po[];
  grns: Grn[];
  initialPo?: Po | null;
  editInvoice?: Invoice | null;
  onSuccess: (msg: string) => void;
}

export function InvoiceDrawer({
  open,
  onClose,
  vendors,
  pos,
  grns,
  initialPo,
  editInvoice,
  onSuccess,
}: InvoiceDrawerProps) {
  const [vendorId, setVendorId] = useState("");
  const [poId, setPoId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editInvoice) {
      setVendorId(String(editInvoice.vendorId || editInvoice.vendor?.id || ""));
      setPoId(String(editInvoice.poId || editInvoice.po?.id || ""));
      setAmount(String(editInvoice.amount || ""));
    } else if (initialPo) {
      setVendorId(String(initialPo.vendor?.id || ""));
      setPoId(String(initialPo.id));
      setAmount(String(initialPo.totalValue || ""));
    } else {
      setVendorId(vendors[0] ? String(vendors[0].id) : "");
      setPoId(pos[0] ? String(pos[0].id) : "");
      setAmount(pos[0] ? String(pos[0].totalValue || "") : "");
    }
    setErr(null);
  }, [open, editInvoice, initialPo, vendors, pos]);

  const selectedPo = pos.find((p) => String(p.id) === poId);
  const relevantGrns = grns.filter((g) => String(g.poId) === poId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!vendorId || !poId || !amount) {
      setErr("Vendor, PO, and Amount are required.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const payload = {
        vendorId: Number(vendorId),
        poId: Number(poId),
        amount: Number(amount),
        items:
          relevantGrns[0]?.items?.map((item) => ({
            grnItemId: item.id,
            quantity: item.acceptedQty || item.receivedQty || 1,
            unitPrice: Number(amount) / (relevantGrns[0].items.length || 1),
          })) || [],
      };

      if (editInvoice) {
        await apiReq("PATCH", `/procurement/invoices/${editInvoice.id}`, payload);
        onSuccess("Invoice updated.");
      } else {
        await apiReq("POST", "/procurement/invoices", payload);
        onSuccess("Invoice registered and queued for 3-way matching reconciliation.");
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to record invoice");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editInvoice ? `Edit Invoice #${editInvoice.number}` : "Record Vendor Invoice"}
      subtitle="Register supplier bill against Purchase Order and GRN"
      width="md"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={busy}>
            {busy ? "Submitting…" : editInvoice ? "Update Invoice" : "Register Invoice"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {err && <div className="error-banner" style={{ marginBottom: 16 }}>{err}</div>}

        <div className="field">
          <label>Purchase Order *</label>
          <select
            value={poId}
            onChange={(e) => {
              const pId = e.target.value;
              setPoId(pId);
              const found = pos.find((p) => String(p.id) === pId);
              if (found) {
                setVendorId(String(found.vendor?.id || ""));
                setAmount(String(found.totalValue || ""));
              }
            }}
            required
            disabled={Boolean(editInvoice)}
          >
            <option value="">Select PO…</option>
            {pos.map((p) => (
              <option key={p.id} value={p.id}>
                PO #{p.number} — {p.vendor?.name} ({(p.totalValue || 0).toLocaleString()} {p.currency})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Vendor *</label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
            <option value="">Select vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} — {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Invoice Billed Total Amount (EGP) *</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        {selectedPo && (
          <div style={{ background: "var(--paper-2)", padding: 14, borderRadius: 8, border: "1px solid var(--line)", marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>PO Reference Context</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Expected PO Total: <strong>{(selectedPo.totalValue || 0).toLocaleString()} {selectedPo.currency}</strong>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Delivery Fulfillment: <strong>{selectedPo.receivedQty}</strong> / {selectedPo.orderedQty} units received
            </div>
          </div>
        )}
      </form>
    </Drawer>
  );
}
