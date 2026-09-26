import { useEffect, useState } from "react";
import { User } from "../api";
import { Badge, Empty, ErrorBanner, Loading } from "../components";

interface Summary {
  stockValue: number;
  lowStockCount: number;
  openPoCount: number;
  pendingApprovals: number;
  apBalance: number;
  expiringSoon: number;
  inTransitCount: number;
  pendingStocktakes: number;
  generatedAt: string;
}

interface AgingRow {
  id: number;
  number: string;
  from: string;
  to: string;
  daysInTransit: number;
  stale: boolean;
  items: number;
}

interface AuditRow {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  timestamp: string;
  hash: string;
  user?: { name: string } | null;
}

const fmt = (n: number) =>
  n.toLocaleString("en-GB", { maximumFractionDigits: 0 });

const money = (n: number) =>
  n.toLocaleString("en-GB", { maximumFractionDigits: 0 }) + " EGP";

export default function Dashboard({ user }: { user: User }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [aging, setAging] = useState<AgingRow[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("ca_token");
    if (!token) {
      window.dispatchEvent(new Event("ca_unauthorized"));
      return;
    }
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch("/api/v1/dashboard/summary", { headers: h }).then((r) => {
        if (r.status === 401) {
          window.dispatchEvent(new Event("ca_unauthorized"));
          throw new Error("Unauthorized");
        }
        return r.ok ? r.json() : null;
      }),
      fetch("/api/v1/transfers/orders/aging", { headers: h }).then((r) => {
        if (r.status === 401) {
          window.dispatchEvent(new Event("ca_unauthorized"));
          throw new Error("Unauthorized");
        }
        return r.ok ? r.json() : [];
      }),
      fetch("/api/v1/security/audit?limit=8", { headers: h }).then((r) => {
        if (r.status === 401) {
          window.dispatchEvent(new Event("ca_unauthorized"));
          throw new Error("Unauthorized");
        }
        return r.ok ? r.json() : [];
      }),
    ])
      .then(([s, a, au]) => {
        setSummary(s && typeof s === "object" && !s.error ? s : null);
        setAging(Array.isArray(a) ? a : []);
        setAudit(Array.isArray(au) ? au : Array.isArray(au?.entries) ? au.entries : []);
      })
      .catch((e) => {
        if (e.message !== "Unauthorized") {
          setErr(e.message);
        }
      });
  }, []);

  const stale = Array.isArray(aging) ? aging.filter((a) => a.stale).length : 0;

  const kpis: { label: string; value: string; hint: string; cls?: string }[] = [
    { label: "Stock value", value: summary ? money(summary.stockValue) : "…", hint: "at weighted avg cost" },
    { label: "Low stock items", value: summary ? fmt(summary.lowStockCount) : "…", hint: "at/below reorder point", cls: (summary?.lowStockCount ?? 0) > 0 ? "warn" : "ok" },
    { label: "Open purchase orders", value: summary ? fmt(summary.openPoCount) : "…", hint: "not fully received" },
    { label: "Pending approvals", value: summary ? fmt(summary.pendingApprovals) : "…", hint: "reqs · invoices · adjustments · waste", cls: (summary?.pendingApprovals ?? 0) > 0 ? "warn" : "ok" },
    { label: "Accounts payable", value: summary ? money(summary.apBalance) : "…", hint: "supplier ledger balances" },
    { label: "Expiring soon", value: summary ? fmt(summary.expiringSoon) : "…", hint: "batches within 30 days", cls: (summary?.expiringSoon ?? 0) > 0 ? "warn" : "ok" },
    { label: "In-transit orders", value: summary ? fmt(summary.inTransitCount) : "…", hint: `${stale} stale (>3 days)` },
    { label: "Pending stocktakes", value: summary ? fmt(summary.pendingStocktakes) : "…", hint: "scheduled or in progress" },
  ];

  return (
    <>
      <div className="topbar">
        <h1>Operations overview</h1>
        <div className="crumb">Welcome back, {user.name.split(" ")[0]}</div>
      </div>

      {err && <ErrorBanner message={err} />}

      <div className="grid kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="label">{k.label}</div>
            <div className={`value ${k.cls ?? ""}`}>{k.value}</div>
            <div className="hint">{k.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid two">
        <div className="card">
          <h2>
            In-transit aging <span className="count">{aging?.length ?? 0} orders</span>
          </h2>
          {!aging ? (
            <Loading />
          ) : aging.length === 0 ? (
            <Empty text="No shipments in transit." />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Route</th>
                    <th>Days</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {aging.map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{a.number}</td>
                      <td>
                        {a.from} → {a.to}
                      </td>
                      <td className="num">{a.daysInTransit}</td>
                      <td>{a.stale ? <Badge status="STALE" /> : <Badge status="IN_TRANSIT" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2>
            Latest audit activity <span className="count">hash-chained</span>
          </h2>
          {!audit ? (
            <Loading />
          ) : audit.length === 0 ? (
            <Empty text="No audit entries." />
          ) : (
            audit.map((a) => (
              <div className="audit-row" key={a.id}>
                <span className="ts">{new Date(a.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="act">{a.action}</span>
                <span className="ent">
                  {a.entityType} {a.entityId ? `#${a.entityId}` : ""}
                </span>
                <span className="hash">{a.hash.slice(0, 10)}…</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}