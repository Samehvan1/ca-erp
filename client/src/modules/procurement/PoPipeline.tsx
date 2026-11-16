import { Po, Grn, Invoice } from "./types";
import { LifecycleStepper, StepItem } from "../../components/LifecycleStepper";
import { StatusBadge } from "../../components/StatusBadge";
import { HistoryButton } from "../../components";

export interface PoPipelineProps {
  po: Po;
  grns?: Grn[];
  invoices?: Invoice[];
  onReceiveGrn: (po: Po) => void;
  onCreateInvoice: (po: Po) => void;
  onRecordPayment: (po: Po) => void;
  onForceClose?: (po: Po) => void;
}

export function PoPipeline({
  po,
  grns = [],
  invoices = [],
  onReceiveGrn,
  onCreateInvoice,
  onRecordPayment,
  onForceClose,
}: PoPipelineProps) {
  const isFullyReceived = po.status === "FULLY_RECEIVED" || (po.orderedQty > 0 && po.receivedQty >= po.orderedQty);
  const isPartiallyReceived = po.receivedQty > 0 && !isFullyReceived;
  const hasInvoices = invoices.length > 0;
  const isPaid = invoices.some((i) => i.status === "APPROVED");

  const getStepStatus = (step: string): StepItem["status"] => {
    if (po.status === "FORCE_CLOSED") return "warning";
    if (step === "req") return "completed";
    if (step === "po") return "completed";
    if (step === "grn") {
      if (isFullyReceived) return "completed";
      if (isPartiallyReceived) return "current";
      return "upcoming";
    }
    if (step === "match") {
      if (hasInvoices) return "completed";
      if (isPartiallyReceived || isFullyReceived) return "current";
      return "upcoming";
    }
    if (step === "pay") {
      if (isPaid) return "completed";
      if (hasInvoices) return "current";
      return "upcoming";
    }
    return "upcoming";
  };

  const steps: StepItem[] = [
    {
      id: "req",
      label: "Requisition Approved",
      description: po.project?.name || "Project",
      status: getStepStatus("req"),
    },
    {
      id: "po",
      label: "PO Issued",
      description: `To ${po.vendor?.name || "Vendor"}`,
      timestamp: new Date(po.createdAt).toLocaleDateString("en-GB"),
      status: getStepStatus("po"),
      badgeText: po.currency || "EGP",
    },
    {
      id: "grn",
      label: "Goods Receipt (GRN)",
      description: `${po.receivedQty} / ${po.orderedQty} units`,
      status: getStepStatus("grn"),
    },
    {
      id: "match",
      label: "3-Way Match & Invoice",
      description: hasInvoices ? `${invoices.length} Invoice(s)` : "Pending bill",
      status: getStepStatus("match"),
    },
    {
      id: "pay",
      label: "Settled / Paid",
      description: isPaid ? "Settled" : "Awaiting AP",
      status: getStepStatus("pay"),
    },
  ];

  const receivePct = po.orderedQty > 0 ? Math.min(100, (po.receivedQty / po.orderedQty) * 100) : 0;

  return (
    <div className="po-pipeline-detail">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 700 }}>
              Purchase Order #{po.number}
            </h2>
            <StatusBadge status={po.status} size="md" />
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Vendor: <strong>{po.vendor?.name}</strong> | Project: <strong>{po.project?.name}</strong> | Created by: {po.createdBy?.name || "System"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {po.status !== "FULLY_RECEIVED" && po.status !== "FORCE_CLOSED" && (
            <button
              type="button"
              className="btn"
              style={{ background: "#2e7d32", color: "#fff" }}
              onClick={() => onReceiveGrn(po)}
            >
              📥 Receive Shipment (GRN)
            </button>
          )}

          <button
            type="button"
            className="btn ghost sm"
            onClick={() => onCreateInvoice(po)}
          >
            + Bill Invoice
          </button>

          <button
            type="button"
            className="btn ghost sm"
            onClick={() => onRecordPayment(po)}
          >
            💳 Pay
          </button>

          {po.status !== "FULLY_RECEIVED" && po.status !== "FORCE_CLOSED" && onForceClose && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => onForceClose(po)}
              title="Close remaining unreceived balance"
            >
              Close PO
            </button>
          )}

          <HistoryButton entityType="PurchaseOrder" entityId={po.id} />
        </div>
      </div>

      {/* Lifecycle Progress Stepper */}
      <LifecycleStepper steps={steps} className="po-pipeline-stepper" />

      {/* Financial Summary & Delivery Progress */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 14,
          background: "var(--paper-2)",
          padding: "16px 20px",
          borderRadius: 10,
          border: "1px solid var(--line)",
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Subtotal</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--mono)", marginTop: 2 }}>
            {(po.subTotal || po.totalValue || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} {po.currency}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>VAT & Fees</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--mono)", marginTop: 2 }}>
            +{((po.vatAmount || 0) + (po.feesAmount || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Total Value</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--serif)", color: "var(--amber)", marginTop: 2 }}>
            {(po.totalValue || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} {po.currency}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Delivery Fulfillment</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <div style={{ flex: 1, height: 8, background: "var(--line)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${receivePct}%`, height: "100%", background: "#2e7d32", borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--mono)" }}>{receivePct.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* PO Line Items Table */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600 }}>Purchased Items ({po.items.length})</h4>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Ordered: <strong>{po.orderedQty}</strong> | Received to date: <strong>{po.receivedQty}</strong> | Outstanding: <strong>{po.outstandingQty || Math.max(0, po.orderedQty - po.receivedQty)}</strong>
          </span>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Description</th>
                <th style={{ textAlign: "right" }}>Ordered</th>
                <th style={{ textAlign: "right" }}>Received</th>
                <th style={{ textAlign: "right" }}>Outstanding</th>
                <th style={{ textAlign: "right" }}>Unit Price</th>
                <th style={{ textAlign: "right" }}>Tax / Disc</th>
                <th style={{ textAlign: "right" }}>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((it) => {
                const lineSub = it.orderedQty * it.unitPrice;
                const taxVal = lineSub * ((it.taxPct || 0) / 100);
                const discVal = lineSub * ((it.discountPct || 0) / 100);
                const lineTotal = lineSub + taxVal - discVal;
                const outQty = Math.max(0, it.orderedQty - (it.receivedQty || 0));

                return (
                  <tr key={it.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>{it.item?.code}</td>
                    <td>
                      <div>{it.item?.description}</div>
                      {it.brandVariant && (
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>SKU: {it.brandVariant.name}</div>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600 }}>
                      {it.orderedQty} {it.item?.uom || ""}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", color: "#2e7d32", fontWeight: 600 }}>
                      {it.receivedQty || 0}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", color: outQty > 0 ? "var(--amber)" : "var(--muted)" }}>
                      {outQty}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                      {Number(it.unitPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: "right", fontSize: 11, color: "var(--muted)" }}>
                      {it.taxPct ? `+${it.taxPct}% VAT` : ""} {it.discountPct ? `-${it.discountPct}%` : ""}
                      {!it.taxPct && !it.discountPct && "—"}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700 }}>
                      {lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
