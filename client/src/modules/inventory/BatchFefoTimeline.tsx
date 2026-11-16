import { useMemo, useState } from "react";
import { Batch } from "./types";
import { StatusBadge } from "../../components/StatusBadge";
import { HistoryButton, ListToolbar, ExportColumn } from "../../components";

export interface BatchFefoTimelineProps {
  batches: Batch[];
  onAdjustBatch: (batch: Batch) => void;
  onTransferBatch: (batch: Batch) => void;
}

export function BatchFefoTimeline({
  batches,
  onAdjustBatch,
  onTransferBatch,
}: BatchFefoTimelineProps) {
  const [selectedTier, setSelectedTier] = useState<"ALL" | "CRITICAL" | "WARNING" | "HEALTHY" | "EXPIRED">("ALL");
  const [q, setQ] = useState("");

  const enrichedBatches = useMemo(() => {
    const now = new Date();
    return batches.map((b) => {
      const exp = new Date(b.expiryDate);
      const diffMs = exp.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let tier: "CRITICAL" | "WARNING" | "HEALTHY" | "EXPIRED" = "HEALTHY";
      if (daysLeft < 0) tier = "EXPIRED";
      else if (daysLeft <= 7) tier = "CRITICAL";
      else if (daysLeft <= 30) tier = "WARNING";

      return {
        ...b,
        daysLeft,
        tier,
      };
    }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }, [batches]);

  const counts = useMemo(() => {
    return {
      expired: enrichedBatches.filter((b) => b.tier === "EXPIRED").length,
      critical: enrichedBatches.filter((b) => b.tier === "CRITICAL").length,
      warning: enrichedBatches.filter((b) => b.tier === "WARNING").length,
      healthy: enrichedBatches.filter((b) => b.tier === "HEALTHY").length,
    };
  }, [enrichedBatches]);

  const filtered = useMemo(() => {
    return enrichedBatches.filter((b) => {
      if (selectedTier !== "ALL" && b.tier !== selectedTier) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        const bNo = b.batchNo.toLowerCase();
        const code = (b.item?.code || "").toLowerCase();
        const desc = (b.item?.description || "").toLowerCase();
        const wh = (b.warehouse?.code || "").toLowerCase();
        return bNo.includes(needle) || code.includes(needle) || desc.includes(needle) || wh.includes(needle);
      }
      return true;
    });
  }, [enrichedBatches, selectedTier, q]);

  const exportColumns: ExportColumn<(typeof enrichedBatches)[0]>[] = [
    { key: "batchNo", label: "Batch #" },
    { key: "item.code", label: "Item Code" },
    { key: "item.description", label: "Item Description" },
    { key: "warehouse.code", label: "Warehouse" },
    { key: "quantity", label: "Quantity" },
    { key: "expiryDate", label: "Expiry Date" },
    { key: "daysLeft", label: "Days Left" },
    { key: "tier", label: "Freshness Tier" },
  ];

  return (
    <div className="fefo-timeline-container">
      {/* KPI Freshness Tiers Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div
          className={`kpi-card ${selectedTier === "EXPIRED" ? "selected" : ""}`}
          onClick={() => setSelectedTier(selectedTier === "EXPIRED" ? "ALL" : "EXPIRED")}
          style={{ cursor: "pointer", borderLeft: "4px solid #b3261e" }}
        >
          <div className="kpi-head">
            <span className="kpi-label">Expired Batches</span>
            <span>⛔</span>
          </div>
          <div className="kpi-value" style={{ color: "#b3261e" }}>{counts.expired}</div>
          <div className="kpi-foot"><span className="kpi-subtext">Immediate quarantine required</span></div>
        </div>

        <div
          className={`kpi-card ${selectedTier === "CRITICAL" ? "selected" : ""}`}
          onClick={() => setSelectedTier(selectedTier === "CRITICAL" ? "ALL" : "CRITICAL")}
          style={{ cursor: "pointer", borderLeft: "4px solid #d97706" }}
        >
          <div className="kpi-head">
            <span className="kpi-label">Critical (&le; 7 Days)</span>
            <span>⚠️</span>
          </div>
          <div className="kpi-value" style={{ color: "#d97706" }}>{counts.critical}</div>
          <div className="kpi-foot"><span className="kpi-subtext">FEFO priority picking</span></div>
        </div>

        <div
          className={`kpi-card ${selectedTier === "WARNING" ? "selected" : ""}`}
          onClick={() => setSelectedTier(selectedTier === "WARNING" ? "ALL" : "WARNING")}
          style={{ cursor: "pointer", borderLeft: "4px solid #f0a63c" }}
        >
          <div className="kpi-head">
            <span className="kpi-label">Warning (&le; 30 Days)</span>
            <span>⏳</span>
          </div>
          <div className="kpi-value" style={{ color: "#b45309" }}>{counts.warning}</div>
          <div className="kpi-foot"><span className="kpi-subtext">Monitor and rotate stock</span></div>
        </div>

        <div
          className={`kpi-card ${selectedTier === "HEALTHY" ? "selected" : ""}`}
          onClick={() => setSelectedTier(selectedTier === "HEALTHY" ? "ALL" : "HEALTHY")}
          style={{ cursor: "pointer", borderLeft: "4px solid #2e7d32" }}
        >
          <div className="kpi-head">
            <span className="kpi-label">Healthy Stock</span>
            <span>✓</span>
          </div>
          <div className="kpi-value" style={{ color: "#2e7d32" }}>{counts.healthy}</div>
          <div className="kpi-foot"><span className="kpi-subtext">&gt; 30 Days shelf life</span></div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Showing <strong>{filtered.length}</strong> batches sorted by First-Expired-First-Out (FEFO)
        </div>
        <ListToolbar
          q={q}
          setQ={setQ}
          rows={filtered}
          columns={exportColumns}
          filename="fefo_batches_report"
          placeholder="Search batch #, item, warehouse…"
        />
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Batch #</th>
              <th>Item / SKU</th>
              <th>Warehouse</th>
              <th style={{ textAlign: "right" }}>Quantity</th>
              <th>Expiry Date</th>
              <th>Freshness / Days Left</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>
                  No batches found for this criteria.
                </td>
              </tr>
            ) : (
              filtered.map((b) => (
                <tr key={b.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>{b.batchNo}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{b.item?.code} — {b.item?.description}</div>
                    {b.brandVariant && (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>SKU: {b.brandVariant.name}</div>
                    )}
                  </td>
                  <td>
                    <span style={{ padding: "2px 8px", background: "var(--paper-2)", borderRadius: 4, fontSize: 12 }}>
                      {b.warehouse?.code || `WH #${b.warehouseId}`}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600 }}>
                    {Number(b.quantity).toLocaleString()}
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12.5 }}>
                    {new Date(b.expiryDate).toLocaleDateString("en-GB")}
                  </td>
                  <td>
                    {b.daysLeft < 0 ? (
                      <span className="variance-pill variance-neg">Expired {Math.abs(b.daysLeft)}d ago</span>
                    ) : b.daysLeft <= 7 ? (
                      <span className="variance-pill variance-pos">⚠️ {b.daysLeft} days left</span>
                    ) : b.daysLeft <= 30 ? (
                      <span style={{ fontSize: 12, color: "var(--amber)", fontWeight: 600 }}>{b.daysLeft} days left</span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--ok)" }}>{b.daysLeft} days left</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge
                      status={b.tier}
                      tone={
                        b.tier === "EXPIRED"
                          ? "danger"
                          : b.tier === "CRITICAL"
                          ? "danger"
                          : b.tier === "WARNING"
                          ? "warning"
                          : "success"
                      }
                    />
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => onTransferBatch(b)}
                      style={{ marginRight: 4 }}
                      title="Transfer batch to fast-moving branch"
                    >
                      Transfer
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => onAdjustBatch(b)}
                      style={{ marginRight: 4 }}
                      title="Adjust count or record waste"
                    >
                      Adjust
                    </button>
                    <HistoryButton entityType="Batch" entityId={b.id} />
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
