import { TransferOrder } from "./types";
import { TransferStepper } from "./TransferStepper";
import { StatusBadge } from "../../components/StatusBadge";
import { HistoryButton } from "../../components";

export interface TransferDetailPaneProps {
  order: TransferOrder;
  onDispatch: (order: TransferOrder) => void;
  onReceive: (order: TransferOrder) => void;
  onCancel: (order: TransferOrder) => void;
}

export function TransferDetailPane({
  order,
  onDispatch,
  onReceive,
  onCancel,
}: TransferDetailPaneProps) {
  const isDispatchable = order.status === "REQUESTED" || order.status === "APPROVED";
  const isReceivable = order.status === "DISPATCHED" || order.status === "IN_TRANSIT";
  const isCancellable = order.status !== "RECEIVED" && order.status !== "CANCELLED";

  const totalDispatched = order.items.reduce((acc, i) => acc + Number(i.quantity || 0), 0);
  const totalAccepted = order.items.reduce((acc, i) => acc + Number(i.acceptedQty || i.receivedQty || 0), 0);
  const totalDiscrepancy = order.items.reduce((acc, i) => acc + Number(i.discrepancyQty || 0), 0);

  return (
    <div className="transfer-detail-view">
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 700 }}>
              Transfer Order #{order.number}
            </h2>
            <StatusBadge status={order.status} size="md" />
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Requisition linked: <strong>REQ #{order.requisitionId}</strong>
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isDispatchable && (
            <button
              type="button"
              className="btn"
              onClick={() => onDispatch(order)}
            >
              🚚 Dispatch Shipment
            </button>
          )}

          {isReceivable && (
            <button
              type="button"
              className="btn"
              style={{ background: "#2e7d32", color: "#fff" }}
              onClick={() => onReceive(order)}
            >
              📥 Receive & Inspect
            </button>
          )}

          {isCancellable && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => onCancel(order)}
            >
              Cancel
            </button>
          )}

          <HistoryButton entityType="TransferOrder" entityId={order.id} />
        </div>
      </div>

      {/* Lifecycle Progress Stepper */}
      <TransferStepper order={order} />

      {/* Origin -> Destination Route Card */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 16,
          alignItems: "center",
          background: "var(--paper-2)",
          padding: "16px 20px",
          borderRadius: 10,
          border: "1px solid var(--line)",
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
            Origin (Sending Warehouse)
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: "var(--ink)" }}>
            {order.requisition?.fromWarehouse?.code || "—"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {order.requisition?.fromWarehouse?.name || "Central Depot"}
          </div>
        </div>

        <div style={{ fontSize: 22, color: "var(--amber)", fontWeight: 700 }}>➔</div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
            Destination (Receiving Branch)
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: "var(--ink)" }}>
            {order.requisition?.toWarehouse?.code || "—"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {order.requisition?.toWarehouse?.name || "Branch Store"}
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600 }}>Manifest Items ({order.items.length})</h4>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Total Qty: <strong>{totalDispatched}</strong> dispatched | <strong>{totalAccepted}</strong> accepted
          </span>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th>SKU Variant</th>
                <th style={{ textAlign: "right" }}>Dispatched</th>
                <th style={{ textAlign: "right" }}>Received</th>
                <th style={{ textAlign: "right" }}>Accepted</th>
                <th style={{ textAlign: "right" }}>Discrepancy</th>
                <th>Remarks / Damage</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    {item.item?.code} — {item.item?.description}
                  </td>
                  <td>{item.brandVariant?.name || <span style={{ color: "var(--muted)" }}>Default</span>}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600 }}>
                    {item.quantity} {item.item?.uom || ""}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                    {item.receivedQty || "—"}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", color: "#2e7d32", fontWeight: 600 }}>
                    {item.acceptedQty || (item.receivedQty ? item.receivedQty : "—")}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                    {item.discrepancyQty > 0 ? (
                      <span className="variance-pill variance-neg">-{item.discrepancyQty}</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>0</span>
                    )}
                  </td>
                  <td>
                    {item.comments ? (
                      <span style={{ fontSize: 12, color: "#b3261e" }}>{item.comments}</span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipts & Loss Allocation */}
      {order.receipts?.length > 0 && (
        <div style={{ background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Discrepancy Loss Allocation Breakdown
          </h4>
          {order.receipts.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 20, fontSize: 13 }}>
              {r.lossAllocation ? (
                <>
                  <div>Sending Warehouse Loss: <strong>{r.lossAllocation.sending}%</strong></div>
                  <div>Receiving Branch Loss: <strong>{r.lossAllocation.receiving}%</strong></div>
                  <div>Logistics Transport Loss: <strong>{r.lossAllocation.logistics}%</strong></div>
                </>
              ) : (
                <div style={{ color: "var(--muted)" }}>Standard delivery without loss claim.</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
