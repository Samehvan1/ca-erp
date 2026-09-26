import { FormEvent, useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { Item, Warehouse, Rop } from "./types";
import { apiReq } from "../../components";

export interface RopDrawerProps {
  open: boolean;
  onClose: () => void;
  items: Item[];
  warehouses: Warehouse[];
  editRop?: Rop | null;
  onSuccess: (msg: string) => void;
}

export function RopDrawer({ open, onClose, items, warehouses, editRop, onSuccess }: RopDrawerProps) {
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [safetyStock, setSafetyStock] = useState("");
  const [reorderPoint, setReorderPoint] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("7");
  const [consumptionVelocity, setConsumptionVelocity] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editRop) {
      setItemId(String(editRop.itemId || ""));
      setWarehouseId(String(editRop.warehouseId || ""));
      setSafetyStock(String(editRop.safetyStock || ""));
      setReorderPoint(String(editRop.reorderPoint || ""));
      setLeadTimeDays(String(editRop.leadTimeDays || "7"));
      setConsumptionVelocity(String(editRop.consumptionVelocity || ""));
    } else {
      setItemId(items[0] ? String(items[0].id) : "");
      setWarehouseId(warehouses[0] ? String(warehouses[0].id) : "");
      setSafetyStock("10");
      setReorderPoint("25");
      setLeadTimeDays("7");
      setConsumptionVelocity("3");
    }
    setErr(null);
  }, [open, editRop, items, warehouses]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body = {
        itemId: Number(itemId),
        warehouseId: Number(warehouseId),
        safetyStock: Number(safetyStock) || 0,
        reorderPoint: Number(reorderPoint) || 0,
        leadTimeDays: Number(leadTimeDays) || 7,
        consumptionVelocity: Number(consumptionVelocity) || 0,
      };

      if (editRop) {
        await apiReq("PATCH", `/inventory/reorder-points/${editRop.id}`, body);
        onSuccess("Reorder point threshold updated.");
      } else {
        await apiReq("POST", "/inventory/reorder-points", body);
        onSuccess("Reorder point rule configured.");
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save ROP threshold");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editRop ? "Edit Replenishment Threshold (ROP)" : "New Reorder Point Rule"}
      subtitle="Set min-safety stock and auto-requisition triggers per warehouse"
      width="md"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={busy}>
            {busy ? "Saving…" : editRop ? "Update Threshold" : "Save Threshold"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {err && <div className="error-banner" style={{ marginBottom: 16 }}>{err}</div>}

        <div className="form-row">
          <div className="field">
            <label>Item *</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              required
              disabled={Boolean(editRop)}
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
              disabled={Boolean(editRop)}
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

        <div className="form-row">
          <div className="field">
            <label>Reorder Point (ROP) *</label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 20"
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
              required
            />
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Triggers purchase requisition alert</small>
          </div>

          <div className="field">
            <label>Safety Stock *</label>
            <input
              type="number"
              step="any"
              placeholder="e.g. 10"
              value={safetyStock}
              onChange={(e) => setSafetyStock(e.target.value)}
              required
            />
            <small style={{ color: "var(--muted)", fontSize: 11 }}>Minimum reserve balance</small>
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Supplier Lead Time (Days)</label>
            <input
              type="number"
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Daily Consumption Velocity</label>
            <input
              type="number"
              step="any"
              placeholder="Units per day"
              value={consumptionVelocity}
              onChange={(e) => setConsumptionVelocity(e.target.value)}
            />
          </div>
        </div>
      </form>
    </Drawer>
  );
}
