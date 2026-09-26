import { FormEvent, useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { Item, Warehouse, Adjustment } from "./types";
import { apiReq } from "../../components";

export interface StockAdjustmentDrawerProps {
  open: boolean;
  onClose: () => void;
  items: Item[];
  warehouses: Warehouse[];
  initialItem?: Item | null;
  initialWarehouseId?: number | null;
  editAdjustment?: Adjustment | null;
  onSuccess: (msg: string) => void;
}

export function StockAdjustmentDrawer({
  open,
  onClose,
  items,
  warehouses,
  initialItem,
  initialWarehouseId,
  editAdjustment,
  onSuccess,
}: StockAdjustmentDrawerProps) {
  const [itemId, setItemId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [reason, setReason] = useState<string>("COUNT_DIFFERENCE");
  const [quantity, setQuantity] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editAdjustment) {
      setItemId(String(editAdjustment.item?.code ? items.find(i => i.code === editAdjustment.item.code)?.id || "" : ""));
      setWarehouseId(String(editAdjustment.warehouse?.code ? warehouses.find(w => w.code === editAdjustment.warehouse.code)?.id || "" : ""));
      setReason(editAdjustment.reason || "COUNT_DIFFERENCE");
      setQuantity(String(editAdjustment.quantity || ""));
      setAmount(String(editAdjustment.amount || ""));
    } else {
      setItemId(initialItem ? String(initialItem.id) : items[0] ? String(items[0].id) : "");
      setWarehouseId(initialWarehouseId ? String(initialWarehouseId) : warehouses[0] ? String(warehouses[0].id) : "");
      setReason("COUNT_DIFFERENCE");
      setQuantity("");
      setAmount("");
    }
    setErr(null);
  }, [open, editAdjustment, initialItem, initialWarehouseId, items, warehouses]);

  const numAmount = parseFloat(amount) || 0;
  const isHighValue = numAmount > 5000;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!itemId || !warehouseId || !quantity) {
      setErr("Item, warehouse, and quantity are required.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const payload = {
        itemId: Number(itemId),
        warehouseId: Number(warehouseId),
        reason,
        quantity: Number(quantity),
        amount: numAmount,
        approvalLevel: isHighValue ? 2 : 1,
        status: isHighValue ? "PENDING" : "APPROVED",
      };

      if (editAdjustment) {
        await apiReq("PATCH", `/stocktaking/adjustments/${editAdjustment.id}`, payload);
        onSuccess("Adjustment updated successfully.");
      } else {
        await apiReq("POST", "/stocktaking/adjustments", payload);
        onSuccess(
          isHighValue
            ? "Adjustment submitted for Tier 2 Manager Approval (amount > 5,000 EGP)."
            : "Adjustment applied directly to inventory ledger."
        );
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to record adjustment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editAdjustment ? `Edit Adjustment #${editAdjustment.number}` : "Record Stock Adjustment"}
      subtitle="Reconcile physical stock counts, damage, waste, or discrepancies"
      width="md"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={busy}>
            {busy ? "Submitting…" : editAdjustment ? "Update Adjustment" : "Apply Adjustment"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {err && (
          <div className="error-banner" style={{ marginBottom: 16 }}>
            {err}
          </div>
        )}

        <div className="field">
          <label>Target Warehouse *</label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            required
            disabled={Boolean(editAdjustment)}
          >
            <option value="">Select warehouse…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name} ({w.type})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Item *</label>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            required
            disabled={Boolean(editAdjustment)}
          >
            <option value="">Select master item…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} — {i.description} ({i.uom})
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Adjustment Reason *</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} required>
              <option value="COUNT_DIFFERENCE">Count Difference (Audit)</option>
              <option value="WASTE">Kitchen / Station Waste</option>
              <option value="DAMAGE">Damaged / Expired Goods</option>
              <option value="THEFT">Loss / Theft</option>
            </select>
          </div>

          <div className="field">
            <label>Quantity Delta *</label>
            <input
              type="number"
              step="any"
              placeholder="e.g. -5 or 10"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <small style={{ color: "var(--muted)", fontSize: 11 }}>
              Negative for stock deduction, positive for addition
            </small>
          </div>
        </div>

        <div className="field">
          <label>Estimated Total Value (EGP)</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {isHighValue ? (
          <div
            style={{
              padding: "12px 16px",
              background: "#fff8e1",
              border: "1px solid #ffe082",
              borderRadius: 8,
              marginTop: 14,
              fontSize: 12.5,
              color: "#b45309",
            }}
          >
            <strong>⚠️ High-Value Threshold Exceeded:</strong> Adjustments exceeding 5,000 EGP require Tier 2 Cost Controller / Executive approval before ledger posting.
          </div>
        ) : (
          <div
            style={{
              padding: "10px 14px",
              background: "#e8f5e9",
              border: "1px solid #c8e6c9",
              borderRadius: 8,
              marginTop: 14,
              fontSize: 12.5,
              color: "#2e7d32",
            }}
          >
            ✓ Standard threshold: Will be approved and posted to the stock ledger immediately.
          </div>
        )}
      </form>
    </Drawer>
  );
}
