import { FormEvent, useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { Warehouse, Item, TransferRequisition, ItemRow } from "./types";
import { apiReq } from "../../components";
import { getUser } from "../../api";

export interface TransferRequestDrawerProps {
  open: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  items: Item[];
  editRequisition?: TransferRequisition | null;
  initialItems?: { itemId: number; brandVariantId?: number | null; quantity: number }[];
  initialToWarehouseId?: number;
  initialProjectId?: number;
  onSuccess: (msg: string) => void;
}

export function TransferRequestDrawer({
  open,
  onClose,
  warehouses,
  items,
  editRequisition,
  initialItems,
  initialToWarehouseId,
  initialProjectId,
  onSuccess,
}: TransferRequestDrawerProps) {
  const me = getUser();
  const GROUP_ROLES = ["ADMIN", "GROUP_EXECUTIVE", "CFO", "PROCUREMENT_OFFICER", "COST_CONTROLLER", "PROJECT_WAREHOUSE_MANAGER"];
  const isAdminOrGroup = !me?.role || GROUP_ROLES.includes(me.role);
  const isBranchRestricted = !isAdminOrGroup && Boolean(me?.projectId) && (me?.role === "BRANCH_MANAGER" || me?.role === "HEAD_CHEF" || me?.role === "HEAD_BARISTA");

  const centralWh = warehouses.find((w) => w.type === "GROUP_CENTRAL" || w.type === "PROJECT_CENTRAL" || !w.projectId) || warehouses[0];
  const myBranchWh = warehouses.find((w) => (me?.projectId || initialProjectId) && w.projectId === (initialProjectId || me?.projectId)) || warehouses[1] || warehouses[0];

  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [projectId, setProjectId] = useState("1");
  const [rows, setRows] = useState<ItemRow[]>([{ key: 0, itemId: "", brandVariantId: "", quantity: "" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editRequisition) {
      setFromWarehouseId(String(editRequisition.fromWarehouse?.id || ""));
      setToWarehouseId(String(editRequisition.toWarehouse?.id || ""));
      setProjectId(editRequisition.project?.id ? String(editRequisition.project.id) : me?.projectId ? String(me.projectId) : "1");
    } else if (initialItems && initialItems.length > 0) {
      setFromWarehouseId(String(centralWh?.id || ""));
      setToWarehouseId(initialToWarehouseId ? String(initialToWarehouseId) : String(myBranchWh?.id || ""));
      setProjectId(initialProjectId ? String(initialProjectId) : me?.projectId ? String(me.projectId) : "1");
      setRows(
        initialItems.map((it, idx) => ({
          key: idx,
          itemId: String(it.itemId),
          brandVariantId: it.brandVariantId ? String(it.brandVariantId) : "",
          quantity: String(it.quantity || "1"),
        }))
      );
    } else {
      setFromWarehouseId(String(centralWh?.id || ""));
      setToWarehouseId(String(myBranchWh?.id || ""));
      setProjectId(me?.projectId ? String(me.projectId) : "1");
      setRows([{ key: 0, itemId: items[0] ? String(items[0].id) : "", brandVariantId: "", quantity: "10" }]);
    }
    setErr(null);
  }, [open, editRequisition, initialItems, initialToWarehouseId, initialProjectId, warehouses, items, me?.projectId]);

  const handleDestinationChange = (whIdStr: string) => {
    setToWarehouseId(whIdStr);
    const targetWh = warehouses.find((w) => String(w.id) === whIdStr);
    if (targetWh?.projectId) {
      setProjectId(String(targetWh.projectId));
    }
  };

  const addRow = () => {
    setRows((r) => [...r, { key: Date.now() + Math.random(), itemId: items[0] ? String(items[0].id) : "", brandVariantId: "", quantity: "1" }]);
  };

  const updateRow = (key: number, patch: Partial<ItemRow>) => {
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  };

  const deleteRow = (key: number) => {
    setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fromWarehouseId || !toWarehouseId) {
      setErr("Source and destination warehouses are required.");
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      setErr("Source and destination warehouses cannot be the same.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      if (editRequisition) {
        await apiReq("PATCH", `/transfers/requisitions/${editRequisition.id}`, {
          fromWarehouseId: Number(fromWarehouseId),
          toWarehouseId: Number(toWarehouseId),
          projectId: Number(projectId),
        });
        onSuccess("Transfer requisition updated.");
      } else {
        const payload = {
          fromWarehouseId: Number(fromWarehouseId),
          toWarehouseId: Number(toWarehouseId),
          projectId: Number(projectId),
          items: rows.map((r) => ({
            itemId: Number(r.itemId),
            brandVariantId: r.brandVariantId ? Number(r.brandVariantId) : null,
            quantity: Number(r.quantity),
          })),
        };
        await apiReq("POST", "/transfers/requisitions", payload);
        onSuccess("Transfer request submitted for dispatch.");
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save transfer requisition");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editRequisition ? `Edit Requisition #${editRequisition.number}` : "New Stock Transfer Requisition"}
      subtitle="Fulfill replenishment from central hub to target location"
      width="lg"
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={handleSubmit} disabled={busy}>
            {busy ? "Submitting…" : editRequisition ? "Update Request" : "Submit Transfer Request"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {err && <div className="error-banner" style={{ marginBottom: 16 }}>{err}</div>}

        <div style={{ padding: "10px 14px", background: "rgba(217, 119, 6, 0.08)", border: "1px solid rgba(217, 119, 6, 0.2)", borderRadius: 8, marginBottom: 18, fontSize: 13, color: "var(--ink)" }}>
          💡 <strong>Stock Transfer Routing:</strong> Select the supplying <strong>Source Hub</strong> and the receiving <strong>Destination Location</strong>.
        </div>

        <div className="form-row">
          <div className="field">
            <label>Source Hub (Supplying Warehouse) *</label>
            <select
              value={fromWarehouseId}
              onChange={(e) => setFromWarehouseId(e.target.value)}
              required
              disabled={isBranchRestricted}
            >
              <option value="">Select source warehouse…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name} ({w.type})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Destination Branch (Receiving Location) *</label>
            <select
              value={toWarehouseId}
              onChange={(e) => handleDestinationChange(e.target.value)}
              required
              disabled={isBranchRestricted && Boolean(myBranchWh)}
            >
              <option value="">Select target destination…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name} ({w.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {!editRequisition && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <label style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>Transfer Request Items ({rows.length})</label>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Specify catalog items, brand variants, and requested transfer quantities</div>
              </div>
              <button type="button" className="btn sm" onClick={addRow}>
                + Add Item
              </button>
            </div>

            {/* Table Headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "3fr 2fr 1.5fr 34px",
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
              <div style={{ textAlign: "right" }}>Request Qty *</div>
              <div></div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--line)", borderRadius: "0 0 6px 6px", background: "var(--card)", overflow: "hidden" }}>
              {rows.map((row, idx) => {
                const curItem = items.find((i) => String(i.id) === row.itemId);
                return (
                  <div
                    key={row.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "3fr 2fr 1.5fr 34px",
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
                          UOM: <strong>{curItem.uom}</strong>
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
        )}
      </form>
    </Drawer>
  );
}
