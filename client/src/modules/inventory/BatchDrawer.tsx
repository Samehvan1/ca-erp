import { FormEvent, useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { Item, Warehouse, Batch } from "./types";
import { apiReq } from "../../components";

export interface BatchDrawerProps {
  open: boolean;
  onClose: () => void;
  items: Item[];
  warehouses: Warehouse[];
  editBatch?: Batch | null;
  onSuccess: (msg: string) => void;
}

export function BatchDrawer({ open, onClose, items, warehouses, editBatch, onSuccess }: BatchDrawerProps) {
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [brandVariantId, setBrandVariantId] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editBatch) {
      setItemId(String(editBatch.itemId || ""));
      setWarehouseId(String(editBatch.warehouseId || ""));
      setBrandVariantId(editBatch.brandVariantId ? String(editBatch.brandVariantId) : "");
      setBatchNo(editBatch.batchNo || "");
      setQuantity(String(editBatch.quantity || ""));
      setExpiryDate(editBatch.expiryDate ? editBatch.expiryDate.slice(0, 10) : "");
      setUnitCost("");
    } else {
      setItemId(items[0] ? String(items[0].id) : "");
      setWarehouseId(warehouses[0] ? String(warehouses[0].id) : "");
      setBrandVariantId("");
      setBatchNo(`BAT-${Date.now().toString().slice(-6)}`);
      setQuantity("");
      const d = new Date();
      d.setDate(d.getDate() + 90);
      setExpiryDate(d.toISOString().slice(0, 10));
      setUnitCost("");
    }
    setErr(null);
  }, [open, editBatch, items, warehouses]);

  const selectedItem = items.find((i) => String(i.id) === itemId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        itemId: Number(itemId),
        warehouseId: Number(warehouseId),
        batchNo,
        quantity: Number(quantity),
        expiryDate: new Date(expiryDate).toISOString(),
      };
      if (brandVariantId) body.brandVariantId = Number(brandVariantId);
      if (unitCost) body.unitCost = Number(unitCost);

      if (editBatch) {
        await apiReq("PATCH", `/inventory/batches/${editBatch.id}`, body);
        onSuccess("Batch updated successfully.");
      } else {
        await apiReq("POST", "/inventory/batches", body);
        onSuccess("Batch received and placed in inventory.");
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save batch");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editBatch ? `Edit Batch #${editBatch.batchNo}` : "Direct Batch Entry / Receive"}
      subtitle="Record on-hand batch with expiry date for FEFO tracking"
      width="md"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving…" : editBatch ? "Update Batch" : "Check In Batch"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {err && <div className="error-banner" style={{ marginBottom: 16 }}>{err}</div>}

        <div className="form-row">
          <div className="field">
            <label>Master Item *</label>
            <select
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                setBrandVariantId("");
              }}
              required
              disabled={Boolean(editBatch)}
            >
              <option value="">Select item…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} — {i.description}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Warehouse *</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
              disabled={Boolean(editBatch)}
            >
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedItem && selectedItem.brandVariants?.length > 0 && (
          <div className="field">
            <label>Brand Variant / SKU</label>
            <select value={brandVariantId} onChange={(e) => setBrandVariantId(e.target.value)}>
              <option value="">Generic / All variants</option>
              {selectedItem.brandVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.sku} ({v.name})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-row">
          <div className="field">
            <label>Batch / Lot # *</label>
            <input
              type="text"
              placeholder="e.g. BAT-2026-09"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Quantity *</label>
            <input
              type="number"
              step="any"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Expiry Date *</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Unit Cost (EGP)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />
          </div>
        </div>
      </form>
    </Drawer>
  );
}
