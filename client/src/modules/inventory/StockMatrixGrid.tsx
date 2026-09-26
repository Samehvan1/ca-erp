import { useMemo, useState } from "react";
import { Item, Warehouse, Batch, Rop, MatrixRow } from "./types";
import { StatusBadge } from "../../components/StatusBadge";
import { ListToolbar, ExportColumn } from "../../components";

export interface StockMatrixGridProps {
  items: Item[];
  warehouses: Warehouse[];
  batches: Batch[];
  rops: Rop[];
  onSelectItem: (item: Item) => void;
  onAdjustItem: (item: Item, warehouseId?: number) => void;
  onRequestTransfer: (item: Item, fromWarehouseId?: number) => void;
}

export function StockMatrixGrid({
  items,
  warehouses,
  batches,
  rops,
  onSelectItem,
  onAdjustItem,
  onRequestTransfer,
}: StockMatrixGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "LOW" | "OUT" | "OK">("ALL");
  const [q, setQ] = useState("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return ["ALL", ...Array.from(set)];
  }, [items]);

  // Compute matrix data
  const matrixRows: MatrixRow[] = useMemo(() => {
    // Map item + warehouse -> batch qty sum
    const stockMap = new Map<string, number>(); // `${itemId}_${warehouseId}` -> qty
    batches.forEach((b) => {
      const key = `${b.itemId}_${b.warehouseId}`;
      stockMap.set(key, (stockMap.get(key) || 0) + Number(b.quantity));
    });

    // Map item + warehouse -> ROP
    const ropMap = new Map<string, { rop: number; safety: number }>();
    rops.forEach((r) => {
      const key = `${r.itemId}_${r.warehouseId}`;
      ropMap.set(key, { rop: Number(r.reorderPoint), safety: Number(r.safetyStock) });
    });

    return items.map((item) => {
      let total = 0;
      const stockByWarehouse: Record<number, number> = {};
      let totalRop = 0;
      let totalSafety = 0;

      warehouses.forEach((w) => {
        const key = `${item.id}_${w.id}`;
        const qty = stockMap.get(key) || 0;
        stockByWarehouse[w.id] = qty;
        total += qty;

        const ropInfo = ropMap.get(key);
        if (ropInfo) {
          totalRop += ropInfo.rop;
          totalSafety += ropInfo.safety;
        }
      });

      let ropStatus: "ok" | "low" | "out" = "ok";
      if (total <= 0) {
        ropStatus = "out";
      } else if (totalRop > 0 && total <= totalRop) {
        ropStatus = "low";
      }

      return {
        item,
        totalQuantity: total,
        stockByWarehouse,
        ropStatus,
        minRop: totalRop,
        safetyStock: totalSafety,
      };
    });
  }, [items, warehouses, batches, rops]);

  // Filter
  const filteredRows = useMemo(() => {
    return matrixRows.filter((row) => {
      if (selectedCategory !== "ALL" && row.item.category !== selectedCategory) {
        return false;
      }
      if (statusFilter === "LOW" && row.ropStatus !== "low") return false;
      if (statusFilter === "OUT" && row.ropStatus !== "out") return false;
      if (statusFilter === "OK" && row.ropStatus !== "ok") return false;

      if (q.trim()) {
        const needle = q.toLowerCase();
        const code = row.item.code.toLowerCase();
        const desc = row.item.description.toLowerCase();
        const cat = (row.item.category || "").toLowerCase();
        return code.includes(needle) || desc.includes(needle) || cat.includes(needle);
      }
      return true;
    });
  }, [matrixRows, selectedCategory, statusFilter, q]);

  // Export columns
  const exportColumns: ExportColumn<MatrixRow>[] = [
    { key: "item.code", label: "Item Code" },
    { key: "item.description", label: "Description" },
    { key: "item.category", label: "Category" },
    { key: "item.uom", label: "UOM" },
    { key: "totalQuantity", label: "Total On Hand" },
    { key: "minRop", label: "Total ROP" },
    { key: "ropStatus", label: "Status" },
    ...warehouses.map((w) => ({
      key: `stockByWarehouse.${w.id}`,
      label: `${w.code} (${w.name})`,
    })),
  ];

  return (
    <div className="stock-matrix-container">
      <div className="matrix-filters-bar" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--card)", fontSize: 13 }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "ALL" ? "All Categories" : c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            type="button"
            className={`btn ${statusFilter === "ALL" ? "" : "ghost"} sm`}
            onClick={() => setStatusFilter("ALL")}
          >
            All Stock
          </button>
          <button
            type="button"
            className={`btn ${statusFilter === "LOW" ? "danger" : "ghost"} sm`}
            onClick={() => setStatusFilter("LOW")}
          >
            ⚠️ Low Stock ({matrixRows.filter((r) => r.ropStatus === "low").length})
          </button>
          <button
            type="button"
            className={`btn ${statusFilter === "OUT" ? "danger" : "ghost"} sm`}
            onClick={() => setStatusFilter("OUT")}
          >
            ⛔ Out of Stock ({matrixRows.filter((r) => r.ropStatus === "out").length})
          </button>
        </div>

        <div style={{ marginLeft: "auto" }}>
          <ListToolbar
            q={q}
            setQ={setQ}
            rows={filteredRows}
            columns={exportColumns}
            filename="stock_matrix_report"
            placeholder="Search code, description, category…"
          />
        </div>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto" }}>
        <table className="tbl stock-matrix-table">
          <thead>
            <tr>
              <th style={{ minWidth: 100 }}>Item Code</th>
              <th style={{ minWidth: 200 }}>Description</th>
              <th style={{ minWidth: 100 }}>Category</th>
              <th style={{ minWidth: 70 }}>UOM</th>
              {warehouses.map((w) => (
                <th key={w.id} style={{ minWidth: 110, textAlign: "right", borderLeft: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 12 }}>{w.code}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, color: "var(--muted)" }}>{w.type.replace(/_/g, " ")}</div>
                </th>
              ))}
              <th style={{ minWidth: 110, textAlign: "right", borderLeft: "2px solid var(--line)", background: "var(--paper-2)" }}>
                Total On Hand
              </th>
              <th style={{ minWidth: 100, textAlign: "center" }}>ROP Status</th>
              <th style={{ minWidth: 140, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6 + warehouses.length} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
                  No items match the active filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.item.id}
                  className={row.ropStatus === "out" ? "out-of-stock" : row.ropStatus === "low" ? "low-stock" : ""}
                >
                  <td className="mono" style={{ fontWeight: 600 }}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        onSelectItem(row.item);
                      }}
                      style={{ color: "var(--amber)", textDecoration: "none" }}
                    >
                      {row.item.code}
                    </a>
                  </td>
                  <td>
                    <div>{row.item.description}</div>
                    {row.item.brandVariants?.length > 0 && (
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {row.item.brandVariants.length} SKU{row.item.brandVariants.length > 1 ? "s" : ""}:{" "}
                        {row.item.brandVariants.map((v) => v.name).join(", ")}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: 12, padding: "2px 8px", background: "var(--paper-2)", borderRadius: 4 }}>
                      {row.item.category || "General"}
                    </span>
                  </td>
                  <td style={{ color: "var(--muted)" }}>{row.item.uom || "Each"}</td>
                  {warehouses.map((w) => {
                    const qty = row.stockByWarehouse[w.id] || 0;
                    return (
                      <td
                        key={w.id}
                        style={{
                          textAlign: "right",
                          borderLeft: "1px solid var(--line)",
                          fontFamily: "var(--mono)",
                          fontWeight: qty > 0 ? 600 : 400,
                          color: qty === 0 ? "var(--muted)" : "var(--ink)",
                        }}
                      >
                        {qty > 0 ? qty.toLocaleString() : "—"}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      textAlign: "right",
                      borderLeft: "2px solid var(--line)",
                      background: "rgba(240, 166, 60, 0.05)",
                      fontFamily: "var(--mono)",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {row.totalQuantity.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {row.ropStatus === "out" ? (
                      <StatusBadge status="OUT_OF_STOCK" tone="danger" />
                    ) : row.ropStatus === "low" ? (
                      <StatusBadge status="LOW_STOCK" tone="warning" />
                    ) : (
                      <StatusBadge status="HEALTHY" tone="success" />
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="btn ghost sm"
                      title="Adjust inventory count / record discrepancy"
                      onClick={() => onAdjustItem(row.item)}
                      style={{ marginRight: 4 }}
                    >
                      Adjust
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      title="Transfer item between branches"
                      onClick={() => onRequestTransfer(row.item)}
                    >
                      Transfer
                    </button>
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
