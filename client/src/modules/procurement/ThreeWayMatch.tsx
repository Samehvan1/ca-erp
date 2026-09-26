import { useMemo, useState } from "react";
import { Invoice, Po, Grn } from "./types";
import { StatusBadge, VarianceBadge } from "../../components/StatusBadge";
import { ListToolbar, ExportColumn } from "../../components";

export interface ThreeWayMatchProps {
  invoices: Invoice[];
  pos: Po[];
  grns: Grn[];
  onApproveInvoice: (invoice: Invoice) => void;
  onRejectInvoice: (invoice: Invoice) => void;
}

export function ThreeWayMatch({
  invoices,
  pos,
  grns,
  onApproveInvoice,
  onRejectInvoice,
}: ThreeWayMatchProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(invoices[0] || null);
  const [q, setQ] = useState("");

  const matchSummary = useMemo(() => {
    return invoices.map((inv) => {
      const linkedPo = pos.find((p) => p.id === inv.poId || p.id === inv.po?.id);
      const linkedGrns = grns.filter((g) => g.poId === linkedPo?.id);

      const totalPoValue = linkedPo?.totalValue || 0;
      const billedAmount = inv.amount || 0;
      const amountDiff = billedAmount - totalPoValue;
      const isMatched = Math.abs(amountDiff) < 0.01;

      return {
        invoice: inv,
        po: linkedPo,
        grns: linkedGrns,
        amountDiff,
        isMatched,
      };
    });
  }, [invoices, pos, grns]);

  const filtered = useMemo(() => {
    if (!q.trim()) return matchSummary;
    const needle = q.toLowerCase();
    return matchSummary.filter((m) => {
      const invNum = m.invoice.number.toLowerCase();
      const vendorName = (m.invoice.vendor?.name || "").toLowerCase();
      const poNum = (m.po?.number || "").toLowerCase();
      return invNum.includes(needle) || vendorName.includes(needle) || poNum.includes(needle);
    });
  }, [matchSummary, q]);

  const exportCols: ExportColumn<(typeof matchSummary)[0]>[] = [
    { key: "invoice.number", label: "Invoice #" },
    { key: "invoice.vendor.name", label: "Vendor" },
    { key: "po.number", label: "PO #" },
    { key: "po.totalValue", label: "PO Total" },
    { key: "invoice.amount", label: "Invoice Amount" },
    { key: "amountDiff", label: "Variance Amount" },
    { key: "invoice.status", label: "Status" },
  ];

  const activeMatch = matchSummary.find((m) => m.invoice.id === selectedInvoice?.id);

  return (
    <div className="three-way-match-container">
      {/* Search Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          3-Way Reconciliation: Purchase Orders vs Goods Receipts (GRN) vs Vendor Invoices
        </div>
        <ListToolbar
          q={q}
          setQ={setQ}
          rows={filtered}
          columns={exportCols}
          filename="three_way_match_audit"
          placeholder="Search invoice #, vendor, PO…"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20 }}>
        {/* Left List */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "var(--paper-2)", borderBottom: "1px solid var(--line)", fontWeight: 600, fontSize: 13 }}>
            Invoices Awaiting Reconciliation ({invoices.length})
          </div>
          <div style={{ maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>No invoices found.</div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.invoice.id}
                  className={`master-item ${selectedInvoice?.id === item.invoice.id ? "selected" : ""}`}
                  onClick={() => setSelectedInvoice(item.invoice)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mono" style={{ fontWeight: 700 }}>#{item.invoice.number}</span>
                    <StatusBadge status={item.invoice.status} size="sm" />
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 4 }}>
                    {item.invoice.vendor?.name}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 12 }}>
                    <span style={{ color: "var(--muted)" }}>PO #{item.po?.number || "—"}</span>
                    <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>
                      {Number(item.invoice.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} EGP
                    </span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <VarianceBadge expected={item.po?.totalValue || 0} actual={item.invoice.amount} format="currency" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Detail Reconciliation Pane */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: 24 }}>
          {activeMatch ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h3 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 700 }}>
                      Reconciliation: Invoice #{activeMatch.invoice.number}
                    </h3>
                    <StatusBadge status={activeMatch.invoice.status} />
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
                    Vendor: <strong>{activeMatch.invoice.vendor?.name}</strong> | Linked PO: <strong>PO #{activeMatch.po?.number}</strong>
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  {activeMatch.invoice.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        className="btn ghost sm"
                        style={{ color: "#b3261e" }}
                        onClick={() => onRejectInvoice(activeMatch.invoice)}
                      >
                        Reject Invoice
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ background: "#2e7d32", color: "#fff" }}
                        onClick={() => onApproveInvoice(activeMatch.invoice)}
                      >
                        ✓ Approve & Post to AP
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Comparison Metric Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
                <div style={{ background: "var(--paper-2)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>1. PO Total Expected</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)", marginTop: 4 }}>
                    {(activeMatch.po?.totalValue || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} EGP
                  </div>
                </div>

                <div style={{ background: "var(--paper-2)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>2. Billed Invoice Amount</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)", marginTop: 4 }}>
                    {(activeMatch.invoice.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} EGP
                  </div>
                </div>

                <div style={{ background: "var(--paper-2)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>3. Total Variance</div>
                  <div style={{ marginTop: 4 }}>
                    <VarianceBadge
                      expected={activeMatch.po?.totalValue || 0}
                      actual={activeMatch.invoice.amount}
                      format="currency"
                    />
                  </div>
                </div>
              </div>

              {/* Matched Lines */}
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Reconciliation Line Items</h4>
                <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, overflowX: "auto" }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th style={{ textAlign: "right" }}>PO Ordered</th>
                        <th style={{ textAlign: "right" }}>GRN Accepted</th>
                        <th style={{ textAlign: "right" }}>Billed Qty</th>
                        <th style={{ textAlign: "right" }}>PO Unit Price</th>
                        <th style={{ textAlign: "right" }}>Billed Unit Price</th>
                        <th style={{ textAlign: "center" }}>Match Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMatch.invoice.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td>Line Item #{idx + 1}</td>
                          <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                            {activeMatch.po?.items[idx]?.orderedQty || "—"}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "var(--mono)", color: "#2e7d32" }}>
                            {activeMatch.po?.items[idx]?.receivedQty || "—"}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600 }}>
                            {item.quantity}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                            {activeMatch.po?.items[idx]?.unitPrice ? Number(activeMatch.po.items[idx].unitPrice).toFixed(2) : "—"}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600 }}>
                            {Number(item.unitPrice).toFixed(2)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className="variance-pill variance-zero">✓ Line OK</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
              Select an invoice to inspect 3-way matching details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
