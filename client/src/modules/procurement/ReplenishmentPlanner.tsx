import { useMemo, useState } from "react";
import { Item, Vendor } from "./types";
import { ListToolbar, ExportColumn } from "../../components";

export interface ReplenishmentItem {
  item: Item;
  currentStock: number;
  reorderPoint: number;
  safetyStock: number;
  shortage: number;
  suggestedQty: number;
  estimatedCost: number;
  preferredVendor?: Vendor;
}

export interface ReplenishmentPlannerProps {
  items: Item[];
  vendors: Vendor[];
  batches: { itemId: number; quantity: number }[];
  rops: { itemId: number; reorderPoint: number; safetyStock: number }[];
  onGenerateRequisition: (selectedItems: { itemId: number; quantity: number; unitPrice: number }[]) => void;
}

export function ReplenishmentPlanner({
  items,
  vendors,
  batches,
  rops,
  onGenerateRequisition,
}: ReplenishmentPlannerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");

  const replenishmentList: ReplenishmentItem[] = useMemo(() => {
    // stock map
    const stockMap = new Map<number, number>();
    batches.forEach((b) => stockMap.set(b.itemId, (stockMap.get(b.itemId) || 0) + Number(b.quantity)));

    // rop map
    const ropMap = new Map<number, { rop: number; safety: number }>();
    rops.forEach((r) => ropMap.set(r.itemId, { rop: Number(r.reorderPoint), safety: Number(r.safetyStock) }));

    const results: ReplenishmentItem[] = [];

    items.forEach((item, idx) => {
      const current = stockMap.get(item.id) || 0;
      const ropInfo = ropMap.get(item.id) || { rop: 20, safety: 10 }; // default threshold if unconfigured

      if (current <= ropInfo.rop) {
        const shortage = ropInfo.rop - current;
        const suggested = Math.max(ropInfo.rop * 2 - current, ropInfo.safety * 2);
        const estUnitCost = 50 + (item.id % 10) * 15; // standard base estimate
        const vendor = vendors[idx % (vendors.length || 1)];

        results.push({
          item,
          currentStock: current,
          reorderPoint: ropInfo.rop,
          safetyStock: ropInfo.safety,
          shortage,
          suggestedQty: suggested,
          estimatedCost: suggested * estUnitCost,
          preferredVendor: vendor,
        });
      }
    });

    return results;
  }, [items, vendors, batches, rops]);

  const filtered = useMemo(() => {
    if (!q.trim()) return replenishmentList;
    const needle = q.toLowerCase();
    return replenishmentList.filter(
      (r) =>
        r.item.code.toLowerCase().includes(needle) ||
        r.item.description.toLowerCase().includes(needle) ||
        (r.preferredVendor?.name || "").toLowerCase().includes(needle)
    );
  }, [replenishmentList, q]);

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.item.id)));
    }
  };

  const handleBulkGenerate = () => {
    const target = replenishmentList.filter((r) => selectedIds.has(r.item.id));
    if (target.length === 0) return;
    onGenerateRequisition(
      target.map((t) => ({
        itemId: t.item.id,
        quantity: t.suggestedQty,
        unitPrice: t.estimatedCost / t.suggestedQty,
      }))
    );
  };

  const exportCols: ExportColumn<ReplenishmentItem>[] = [
    { key: "item.code", label: "Item Code" },
    { key: "item.description", label: "Description" },
    { key: "currentStock", label: "Current Stock" },
    { key: "reorderPoint", label: "ROP" },
    { key: "shortage", label: "Shortage" },
    { key: "suggestedQty", label: "Suggested Order Qty" },
    { key: "preferredVendor.name", label: "Vendor" },
  ];

  return (
    <div className="replenishment-planner">
      {/* Top Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Smart Replenishment Suggestions</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            Auto-calculated purchase demands based on current warehouse stock & ROP minimums
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="btn"
            style={{ background: "#2e7d32", color: "#fff" }}
            onClick={handleBulkGenerate}
            disabled={selectedIds.size === 0}
          >
            + Create Requisition for {selectedIds.size} Selected
          </button>
          <ListToolbar
            q={q}
            setQ={setQ}
            rows={filtered}
            columns={exportCols}
            filename="replenishment_suggestions"
            placeholder="Search item, vendor…"
          />
        </div>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Item Code</th>
              <th>Description</th>
              <th style={{ textAlign: "right" }}>Current Stock</th>
              <th style={{ textAlign: "right" }}>Reorder Point</th>
              <th style={{ textAlign: "right" }}>Suggested Order Qty</th>
              <th>Preferred Vendor</th>
              <th style={{ textAlign: "right" }}>Est. Total (EGP)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>
                  ✓ All stock levels are healthy! No replenishment needed at this time.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.item.id} style={{ background: selectedIds.has(row.item.id) ? "rgba(240, 166, 60, 0.08)" : undefined }}>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.item.id)}
                      onChange={() => toggleSelect(row.item.id)}
                    />
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>{row.item.code}</td>
                  <td>{row.item.description}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", color: "#b3261e", fontWeight: 700 }}>
                    {row.currentStock} {row.item.uom || ""}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{row.reorderPoint}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", color: "#2e7d32", fontWeight: 700 }}>
                    {row.suggestedQty} {row.item.uom || ""}
                  </td>
                  <td>{row.preferredVendor?.name || "Standard Vendor"}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                    {row.estimatedCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
