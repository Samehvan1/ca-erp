import { FormEvent, useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { Vendor, Po, Invoice, Payment } from "./types";
import { apiReq } from "../../components";

export interface PaymentDrawerProps {
  open: boolean;
  onClose: () => void;
  vendors: Vendor[];
  pos: Po[];
  invoices: Invoice[];
  initialPo?: Po | null;
  editPayment?: Payment | null;
  onSuccess: (msg: string) => void;
}

export function PaymentDrawer({
  open,
  onClose,
  vendors,
  pos,
  invoices,
  initialPo,
  editPayment,
  onSuccess,
}: PaymentDrawerProps) {
  const [vendorId, setVendorId] = useState("");
  const [poId, setPoId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [type, setType] = useState("DOWN_PAYMENT");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editPayment) {
      setVendorId(String(editPayment.vendor?.id || ""));
      setPoId(editPayment.po ? String(editPayment.po.id) : "");
      setInvoiceId(editPayment.invoice ? String(editPayment.invoice.id) : "");
      setType(editPayment.type || "DOWN_PAYMENT");
      setAmount(String(editPayment.amount || ""));
    } else if (initialPo) {
      setVendorId(String(initialPo.vendor?.id || ""));
      setPoId(String(initialPo.id));
      setInvoiceId("");
      setType("DOWN_PAYMENT");
      setAmount(String(initialPo.totalValue || ""));
    } else {
      setVendorId(vendors[0] ? String(vendors[0].id) : "");
      setPoId(pos[0] ? String(pos[0].id) : "");
      setInvoiceId("");
      setType("DOWN_PAYMENT");
      setAmount("");
    }
    setErr(null);
  }, [open, editPayment, initialPo, vendors, pos]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!vendorId || !amount) {
      setErr("Vendor and amount are required.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const payload = {
        vendorId: Number(vendorId),
        poId: poId ? Number(poId) : null,
        invoiceId: invoiceId ? Number(invoiceId) : null,
        type,
        amount: Number(amount),
      };

      if (editPayment) {
        await apiReq("PATCH", `/procurement/payments/${editPayment.id}`, payload);
        onSuccess("Payment updated.");
      } else {
        await apiReq("POST", "/procurement/payments", payload);
        onSuccess("Payment recorded and posted to Accounts Payable ledger.");
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to record payment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editPayment ? `Edit Payment #${editPayment.number}` : "Record Vendor Payment"}
      subtitle="Post disbursement against supplier balance or approved invoice"
      width="md"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={busy}>
            {busy ? "Posting…" : editPayment ? "Update Payment" : "Post Payment"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {err && <div className="error-banner" style={{ marginBottom: 16 }}>{err}</div>}

        <div className="field">
          <label>Vendor / Supplier *</label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
            <option value="">Select vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} — {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Payment Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value)} required>
              <option value="DOWN_PAYMENT">Down Payment / Advance</option>
              <option value="MILESTONE">Milestone / Partial Payment</option>
              <option value="TRANCH">Standard Invoice Settlement</option>
              <option value="RETAINAGE_RELEASE">Retainage Release</option>
            </select>
          </div>

          <div className="field">
            <label>Disbursement Amount (EGP) *</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Linked Purchase Order</label>
            <select value={poId} onChange={(e) => setPoId(e.target.value)}>
              <option value="">None / General Advance</option>
              {pos.map((p) => (
                <option key={p.id} value={p.id}>
                  PO #{p.number} ({p.vendor?.name})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Linked Invoice</label>
            <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
              <option value="">None</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  INV #{inv.number} ({(inv.amount || 0).toLocaleString()} EGP)
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
