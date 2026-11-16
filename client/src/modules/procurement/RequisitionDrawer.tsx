import { FormEvent, useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { Item, CostCenter, Requisition } from "./types";
import { apiReq } from "../../components";
import { getUser } from "../../api";

export interface RequisitionDrawerProps {
  open: boolean;
  onClose: () => void;
  items: Item[];
  costCenters: CostCenter[];
  initialItems?: { itemId: number; quantity: number; unitPrice: number }[];
  editRequisition?: Requisition | null;
  onSuccess: (msg: string) => void;
}

interface ItemRow {
  key: number;
  itemId: string;
  brandVariantId: string;
  quantity: string;
  unitPrice: string;
}

export function RequisitionDrawer({
  open,
  onClose,
  items,
  costCenters,
  initialItems,
  editRequisition,
  onSuccess,
}: RequisitionDrawerProps) {
  const me = getUser();
  const [projectId, setProjectId] = useState(me?.projectId ? String(me.projectId) : "1");
  const [type, setType] = useState("MANUAL");
  const [costCenterId, setCostCenterId] = useState("");
  const [rows, setRows] = useState<ItemRow[]>([{ key: 0, itemId: "", brandVariantId: "", quantity: "1", unitPrice: "0" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editRequisition) {
      setProjectId(editRequisition.projectId ? String(editRequisition.projectId) : "1");
      setType(editRequisition.type || "MANUAL");
      setCostCenterId(editRequisition.costCenterId ? String(editRequisition.costCenterId) : "");
      setRows(
        editRequisition.items.map((it, idx) => ({
          key: idx,
          itemId: String(it.item?.id || ""),
          brandVariantId: it.brandVariantId ? String(it.brandVariantId) : "",
          quantity: String(it.quantity || "1"),
          unitPrice: String(it.unitPrice || "0"),
        }))
      );
    } else if (initialItems && initialItems.length > 0) {
      setProjectId(me?.projectId ? String(me.projectId) : "1");
      setType("ROP");
      setCostCenterId(costCenters[0] ? String(costCenters[0].id) : "");
      setRows(
        initialItems.map((it, idx) => ({
          key: idx,
          itemId: String(it.itemId),
          brandVariantId: "",
          quantity: String(it.quantity),
          unitPrice: String(it.unitPrice),
        }))
      );
    } else {
      setProjectId(me?.projectId ? String(me.projectId) : "1");
      setType("MANUAL");
      setCostCenterId(costCenters[0] ? String(costCenters[0].id) : "");
      setRows([{ key: 0, itemId: items[0] ? String(items[0].id) : "", brandVariantId: "", quantity: "1", unitPrice: "0" }]);
    }
    setErr(null);
  }, [open, editRequisition, initialItems, items, costCenters, me?.projectId]);

  useEffect(() => {
    // If rows had empty itemId and items just loaded, populate the first row
    if (items.length > 0 && rows.length > 0 && !rows[0].itemId) {
      setRows((r) => [{ ...r[0], itemId: String(items[0].id) }, ...r.slice(1)]);
    }
  }, [items, rows]);

  const addRow = () => {
    setRows((r) => [...r, { key: Date.now() + Math.random(), itemId: items[0] ? String(items[0].id) : "", brandVariantId: "", quantity: "1", unitPrice: "0" }]);
  };

  const updateRow = (key: number, patch: Partial<ItemRow>) => {
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  };

  const deleteRow = (key: number) => {
    setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));
  };

  const totalValue = rows.reduce((acc, r) => acc + (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0), 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    try {
      const payload = {
        projectId: Number(projectId),
        type,
        costCenterId: costCenterId ? Number(costCenterId) : null,
        items: rows.map((r) => ({
          itemId: Number(r.itemId),
          brandVariantId: r.brandVariantId ? Number(r.brandVariantId) : null,
          quantity: Number(r.quantity),
          unitPrice: Number(r.unitPrice) || 0,
        })),
      };

      if (editRequisition) {
        await apiReq("PATCH", `/procurement/requisitions/${editRequisition.id}`, payload);
        onSuccess("Purchase requisition updated.");
      } else {
        await apiReq("POST", "/procurement/requisitions", payload);
        onSuccess("Purchase requisition created and submitted for approval.");
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save requisition");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editRequisition ? `Edit Requisition #${editRequisition.number}` : "New Purchase Requisition"}
      subtitle="Request purchasing approval for stock replenishment"
      width="lg"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={busy}>
            {busy ? "Submitting…" : editRequisition ? "Update Requisition" : `Submit Requisition (${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} EGP)`}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {err && <div className="error-banner" style={{ marginBottom: 16 }}>{err}</div>}

        <div className="form-row">
          <div className="field">
            <label>Requisition Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value)} required>
              <option value="MANUAL">Manual Request</option>
              <option value="ROP">ROP Low-Stock Trigger</option>
              <option value="GROUP_CONSOLIDATED">Group Consolidated</option>
            </select>
          </div>

          <div className="field">
            <label>Cost Center</label>
            <select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
              <option value="">General Overhead</option>
              {costCenters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <label style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>Requisition Items &amp; Quantities ({rows.length})</label>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Specify catalog items, brand variants, requested quantities, and target unit prices</div>
              </div>
              <button type="button" className="btn sm" onClick={addRow}>
                + Add Item Line
              </button>
            </div>

            {/* Table Headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2.5fr 1.6fr 1.1fr 1.3fr 1.2fr 34px",
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
              <div style={{ textAlign: "right" }}>Quantity *</div>
              <div style={{ textAlign: "right" }}>Est. Price (EGP)</div>
              <div style={{ textAlign: "right" }}>Line Total (EGP)</div>
              <div></div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--line)", borderRadius: "0 0 6px 6px", background: "var(--card)", overflow: "hidden" }}>
              {rows.map((row, idx) => {
                const curItem = items.find((i) => String(i.id) === row.itemId);
                const lineTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.unitPrice) || 0);

                return (
                  <div
                    key={row.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2.5fr 1.6fr 1.1fr 1.3fr 1.2fr 34px",
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
                          Base UOM: <strong>{curItem.uom}</strong>
                        </div>
                      )}
                    </div>

                    <div>
                      <select
                        value={row.brandVariantId}
                        onChange={(e) => updateRow(row.key, { brandVariantId: e.target.value })}
                        disabled={!curItem || !curItem.brandVariants?.length}
                        style={{ width: "100%", padding: "5px 6px", fontSize: 12.5 }}
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
                        value={row.quantity}
                        onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
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
                        style={{ width: "100%", padding: "5px 6px", textAlign: "right", fontSize: 12.5 }}
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
        </div>
      </form>
    </Drawer>
  );
}
