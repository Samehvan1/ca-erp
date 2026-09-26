import { useMemo, useState } from "react";
import { AgingRow, TransferOrder } from "./types";
import { StatusBadge } from "../../components/StatusBadge";
import { ListToolbar, ExportColumn } from "../../components";

export interface InTransitAgingBoardProps {
  agingRows: AgingRow[];
  orders: TransferOrder[];
  onSelectOrder: (order: TransferOrder) => void;
  onFastReceive: (order: TransferOrder) => void;
}

export function InTransitAgingBoard({
  agingRows,
  orders,
  onSelectOrder,
  onFastReceive,
}: InTransitAgingBoardProps) {
  const [q, setQ] = useState("");

  const enrichedRows = useMemo(() => {
    return agingRows.map((row) => {
      const order = orders.find((o) => o.id === row.id);
      return {
        ...row,
        order,
      };
    });
  }, [agingRows, orders]);

  const staleCount = enrichedRows.filter((r) => r.stale || r.daysInTransit > 1).length;
  const totalInTransit = enrichedRows.length;

  const filtered = useMemo(() => {
    if (!q.trim()) return enrichedRows;
    const needle = q.toLowerCase();
    return enrichedRows.filter((r) => {
      return (
        r.number.toLowerCase().includes(needle) ||
        r.from.toLowerCase().includes(needle) ||
        r.to.toLowerCase().includes(needle)
      );
    });
  }, [enrichedRows, q]);

  const exportCols: ExportColumn<(typeof enrichedRows)[0]>[] = [
    { key: "number", label: "Transfer #" },
    { key: "from", label: "Origin" },
    { key: "to", label: "Destination" },
    { key: "items", label: "Items" },
    { key: "daysInTransit", label: "Days in Transit" },
    { key: "stale", label: "Is Stale" },
  ];

  return (
    <div className="in-transit-aging-board">
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div className="kpi-card" style={{ borderLeft: "4px solid var(--amber)" }}>
          <div className="kpi-head">
            <span className="kpi-label">Active Shipments in Transit</span>
            <span>🚚</span>
          </div>
          <div className="kpi-value">{totalInTransit}</div>
          <div className="kpi-foot"><span className="kpi-subtext">Currently moving across locations</span></div>
        </div>

        <div className="kpi-card" style={{ borderLeft: staleCount > 0 ? "4px solid #b3261e" : "4px solid #2e7d32" }}>
          <div className="kpi-head">
            <span className="kpi-label">Overdue / Stale Shipments</span>
            <span>⏳</span>
          </div>
          <div className="kpi-value" style={{ color: staleCount > 0 ? "#b3261e" : "#2e7d32" }}>
            {staleCount}
          </div>
          <div className="kpi-foot">
            <span className="kpi-subtext">{staleCount > 0 ? "Transit exceeding 24h SLA" : "All routes within SLA"}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Active inter-branch logistics tracking with route aging and arrival check-in
        </div>
        <ListToolbar
          q={q}
          setQ={setQ}
          rows={filtered}
          columns={exportCols}
          filename="in_transit_shipments"
          placeholder="Search transfer #, from, to…"
        />
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Transfer Order #</th>
              <th>Origin Warehouse</th>
              <th>Destination Branch</th>
              <th style={{ textAlign: "right" }}>Items</th>
              <th style={{ textAlign: "right" }}>Days in Transit</th>
              <th>Route SLA Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>
                  No shipments are currently in transit.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} style={{ background: row.stale ? "rgba(179, 38, 30, 0.05)" : undefined }}>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (row.order) onSelectOrder(row.order);
                      }}
                      style={{ color: "var(--amber)", textDecoration: "none" }}
                    >
                      {row.number}
                    </a>
                  </td>
                  <td>{row.from}</td>
                  <td>{row.to}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600 }}>
                    {row.items} item{row.items > 1 ? "s" : ""}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                    {row.daysInTransit} day{row.daysInTransit !== 1 ? "s" : ""}
                  </td>
                  <td>
                    {row.stale || row.daysInTransit > 1 ? (
                      <span className="variance-pill variance-neg">⚠️ Stale (&gt; 24h)</span>
                    ) : (
                      <span className="variance-pill variance-zero">✓ On Schedule</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {row.order && (
                      <button
                        type="button"
                        className="btn sm"
                        style={{ background: "#2e7d32", color: "#fff", marginRight: 6 }}
                        onClick={() => onFastReceive(row.order!)}
                      >
                        📥 Check-in Receipt
                      </button>
                    )}
                    {row.order && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => onSelectOrder(row.order!)}
                      >
                        Details
                      </button>
                    )}
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
