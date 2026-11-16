import { FormEvent, useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { Item, Vendor, Po } from "./types";
import { apiReq } from "../../components";
import { getUser } from "../../api";

export interface PoDrawerProps {
  open: boolean;
  onClose: () => void;
  vendors: Vendor[];
  items: Item[];
  editPo?: Po | null;
  initialItems?: { itemId: number; brandVariantId?: number | null; quantity: number; unitPrice?: number }[];
  initialProjectId?: number;
  onSuccess: (msg: string) => void;
}

interface PoRowState {
  key: number;
  itemId: string;
  brandVariantId: string;
  orderedQty: string;
  unitPrice: string;
  taxPct: string;
  discountPct: string;
}

export function PoDrawer({
  open,
  onClose,
  vendors,
  items,
  editPo,
  initialItems,
  initialProjectId,
  onSuccess,
}: PoDrawerProps) {
  const me = getUser();
  const [vendorId, setVendorId] = useState("");
  const [projectId, setProjectId] = useState(me?.projectId ? String(me.projectId) : "1");
  const [feesAmount, setFeesAmount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [currency, setCurrency] = useState("EGP");
  const [rows, setRows] = useState<PoRowState[]>([
    { key: 0, itemId: "", brandVariantId: "", orderedQty: "10", unitPrice: "50", taxPct: "14", discountPct: "0" },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editPo) {
      setVendorId(String(editPo.vendor?.id || ""));
      setProjectId(editPo.project?.id ? String(editPo.project.id) : "1");
      setFeesAmount(String(editPo.feesAmount || "0"));
      setDiscountAmount(String(editPo.discountAmount || "0"));
      setCurrency(editPo.currency || "EGP");
      setRows(
        editPo.items.map((it, idx) => ({
          key: idx,
          itemId: String(it.item?.id || it.itemId || ""),
          brandVariantId: it.brandVariantId ? String(it.brandVariantId) : "",
          orderedQty: String(it.orderedQty || "1"),
          unitPrice: String(it.unitPrice || "0"),
          taxPct: String(it.taxPct || "0"),
          discountPct: String(it.discountPct || "0"),
        }))
      );
    } else if (initialItems && initialItems.length > 0) {
      setVendorId(vendors[0] ? String(vendors[0].id) : "");
      setProjectId(initialProjectId ? String(initialProjectId) : me?.projectId ? String(me.projectId) : "1");
      setFeesAmount("0");
      setDiscountAmount("0");
      setCurrency("EGP");
      setRows(
        initialItems.map((it, idx) => ({
          key: idx,
          itemId: String(it.itemId),
          brandVariantId: it.brandVariantId ? String(it.brandVariantId) : "",
          orderedQty: String(it.quantity || "1"),
          unitPrice: String(it.unitPrice || "0"),
          taxPct: "14",
          discountPct: "0",
        }))
      );
    } else {
      setVendorId(vendors[0] ? String(vendors[0].id) : "");
      setProjectId(me?.projectId ? String(me.projectId) : "1");
      setFeesAmount("0");
      setDiscountAmount("0");
      setCurrency("EGP");
      setRows([
        { key: 0, itemId: items[0] ? String(items[0].id) : "", brandVariantId: "", orderedQty: "10", unitPrice: "50", taxPct: "14", discountPct: "0" },
      ]);
    }
    setErr(null);
  }, [open, editPo, initialItems, initialProjectId, vendors, items, me?.projectId]);

  useEffect(() => {
    if (!vendorId && vendors.length > 0) {
      setVendorId(String(vendors[0].id));
    }
    if (items.length > 0 && rows.length > 0 && !rows[0].itemId) {
      setRows((r) => [{ ...r[0], itemId: String(items[0].id) }, ...r.slice(1)]);
    }
  }, [vendors, items, vendorId, rows]);

  const addRow = () => {
    setRows((r) => [
      ...r,
      { key: Date.now() + Math.random(), itemId: items[0] ? String(items[0].id) : "", brandVariantId: "", orderedQty: "1", unitPrice: "0", taxPct: "14", discountPct: "0" },
    ]);
  };

  const updateRow = (key: number, patch: Partial<PoRowState>) => {
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  };

  const deleteRow = (key: number) => {
    setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));
  };

  // Live totals calculation
  const subTotal = rows.reduce((acc, r) => acc + (parseFloat(r.orderedQty) || 0) * (parseFloat(r.unitPrice) || 0), 0);
  const totalTax = rows.reduce((acc, r) => {
    const lineSub = (parseFloat(r.orderedQty) || 0) * (parseFloat(r.unitPrice) || 0);
    return acc + lineSub * ((parseFloat(r.taxPct) || 0) / 100);
  }, 0);
  const totalLineDisc = rows.reduce((acc, r) => {
    const lineSub = (parseFloat(r.orderedQty) || 0) * (parseFloat(r.unitPrice) || 0);
    return acc + lineSub * ((parseFloat(r.discountPct) || 0) / 100);
  }, 0);
  const grandTotal = subTotal + totalTax - totalLineDisc - (parseFloat(discountAmount) || 0) + (parseFloat(feesAmount) || 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      setErr("Please select a vendor.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const payload = {
        vendorId: Number(vendorId),
        projectId: Number(projectId),
        currency,
        feesAmount: Number(feesAmount) || 0,
        discountAmount: Number(discountAmount) || 0,
        items: rows.map((r) => ({
          itemId: Number(r.itemId),
          brandVariantId: r.brandVariantId ? Number(r.brandVariantId) : null,
          orderedQty: Number(r.orderedQty),
          unitPrice: Number(r.unitPrice) || 0,
          taxPct: Number(r.taxPct) || 0,
          discountPct: Number(r.discountPct) || 0,
        })),
      };

      if (editPo) {
        await apiReq("PATCH", `/procurement/purchase-orders/${editPo.id}`, payload);
        onSuccess("Purchase Order updated.");
      } else {
        await apiReq("POST", "/procurement/purchase-orders", payload);
        onSuccess("Purchase Order issued successfully.");
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to issue purchase order");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editPo ? `Edit PO #${editPo.number}` : "Issue Purchase Order (PO)"}
      subtitle="Issue binding order to supplier with tax breakdown & delivery terms"
      width="xl"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={busy}>
            {busy ? "Issuing…" : editPo ? "Update Order" : `Issue PO (${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${currency})`}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {err && <div className="error-banner" style={{ marginBottom: 16 }}>{err}</div>}

        <div className="form-row">
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

          <div className="field">
            <label>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="EGP">Egyptian Pound (EGP)</option>
              <option value="USD">US Dollar (USD)</option>
              <option value="EUR">Euro (EUR)</option>
              <option value="SAR">Saudi Riyal (SAR)</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <label style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>Purchase Order Lines ({rows.length})</label>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Specify ordered SKU quantities, contracted supplier prices, tax, and discount rates</div>
            </div>
            <button type="button" className="btn sm" onClick={addRow}>
              + Add Item Line
            </button>
          </div>

          {/* Table Headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2.5fr 1.5fr 1.1fr 1.2fr 0.9fr 0.9fr 1.3fr 34px",
              gap: 8,
              padding: "8px 10px",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--muted)",
              background: "var(--paper-2)",
              borderRadius: "6px 6px 0 0",
              border: "1px solid var(--line)",
              borderBottom: "none",
            }}
          >
            <div>Item / SKU *</div>
            <div>Brand Variant</div>
            <div style={{ textAlign: "right" }}>Ordered Qty *</div>
            <div style={{ textAlign: "right" }}>Unit Price *</div>
            <div style={{ textAlign: "right" }}>Tax %</div>
            <div style={{ textAlign: "right" }}>Disc %</div>
            <div style={{ textAlign: "right" }}>Total ({currency})</div>
            <div></div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--line)", borderRadius: "0 0 6px 6px", background: "var(--card)", overflow: "hidden" }}>
            {rows.map((row, idx) => {
              const curItem = items.find((i) => String(i.id) === row.itemId);
              const lineSub = (parseFloat(row.orderedQty) || 0) * (parseFloat(row.unitPrice) || 0);
              const tax = lineSub * ((parseFloat(row.taxPct) || 0) / 100);
              const disc = lineSub * ((parseFloat(row.discountPct) || 0) / 100);
              const lineTotal = lineSub + tax - disc;

              return (
                <div
                  key={row.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2.5fr 1.5fr 1.1fr 1.2fr 0.9fr 0.9fr 1.3fr 34px",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 10px",
                    borderBottom: idx === rows.length - 1 ? "none" : "1px solid var(--line)",
                    background: idx % 2 === 0 ? "var(--card)" : "rgba(246, 241, 230, 0.4)",
                  }}
                >
                  <div>
                    <select
                      value={row.itemId}
                      onChange={(e) => updateRow(row.key, { itemId: e.target.value, brandVariantId: "" })}
                      required
                      style={{ width: "100%", padding: "5px 6px", fontSize: 12.5 }}
                    >
                      <option value="">Select item…</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.code} — {i.description} ({i.uom})
                        </option>
                      ))}
                    </select>
                    {curItem && (
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        Stock UOM: <strong>{curItem.uom}</strong>
                      </div>
                    )}
                  </div>

                  <div>
                    <select
                      value={row.brandVariantId}
                      onChange={(e) => updateRow(row.key, { brandVariantId: e.target.value })}
                      disabled={!curItem || !curItem.brandVariants?.length}
                      style={{ width: "100%", padding: "5px 6px", fontSize: 12 }}
                    >
                      <option value="">Generic (All)</option>
                      {curItem?.brandVariants?.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.sku} ({v.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      placeholder="Qty"
                      value={row.orderedQty}
                      onChange={(e) => updateRow(row.key, { orderedQty: e.target.value })}
                      required
                      style={{ width: "100%", padding: "5px 6px", textAlign: "right", fontSize: 12.5 }}
                    />
                  </div>

                  <div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={row.unitPrice}
                      onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })}
                      required
                      style={{ width: "100%", padding: "5px 6px", textAlign: "right", fontSize: 12.5 }}
                    />
                  </div>

                  <div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      placeholder="0"
                      value={row.taxPct}
                      onChange={(e) => updateRow(row.key, { taxPct: e.target.value })}
                      style={{ width: "100%", padding: "5px 6px", textAlign: "right", fontSize: 12 }}
                      title="VAT %"
                    />
                  </div>

                  <div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      placeholder="0"
                      value={row.discountPct}
                      onChange={(e) => updateRow(row.key, { discountPct: e.target.value })}
                      style={{ width: "100%", padding: "5px 6px", textAlign: "right", fontSize: 12 }}
                      title="Discount %"
                    />
                  </div>

                  <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color: "var(--amber)" }}>
                    {lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      className="btn ghost sm"
                      style={{ color: "var(--danger)", padding: "2px 6px", minWidth: 24 }}
                      onClick={() => deleteRow(row.key)}
                      disabled={rows.length === 1}
                      title="Remove Line"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Totals Breakdown */}
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: "var(--card)",
            borderRadius: 8,
            border: "1px solid var(--line)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1.5fr",
            gap: 16,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Subtotal</div>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--mono)" }}>{subTotal.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Total VAT (+{totalTax.toFixed(2)})</div>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--mono)" }}>+{totalTax.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Global Fees & Disc</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Disc: {discountAmount} | Fees: {feesAmount}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
              Grand Total ({currency})
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--serif)", color: "var(--amber)" }}>
              {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} {currency}
            </div>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
