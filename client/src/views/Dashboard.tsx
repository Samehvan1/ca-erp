import { useEffect, useState } from "react";
import { User } from "../api";
import { Badge, Empty, ErrorBanner, Loading } from "../components";
import { useI18n } from "../lib/i18n";

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

export default function Dashboard({ user }: { user: User }) {
  const { t, isRtl } = useI18n();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [aging, setAging] = useState<AgingRow[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fmt = (n: number) => n.toLocaleString(isRtl ? "ar-EG" : "en-GB", { maximumFractionDigits: 0 });
  const money = (n: number) => `${n.toLocaleString(isRtl ? "ar-EG" : "en-GB", { maximumFractionDigits: 0 })} ${t("common.egp")}`;

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
    { label: t("dash.kpi.total_stock"), value: summary ? money(summary.stockValue) : "…", hint: isRtl ? "وفقاً لمتوسط التكلفة المرجح (WAC)" : "at weighted avg cost" },
    { label: t("dash.kpi.low_stock_alerts"), value: summary ? fmt(summary.lowStockCount) : "…", hint: isRtl ? "بلغت أو أقل من حد إعادة الطلب" : "at/below reorder point", cls: (summary?.lowStockCount ?? 0) > 0 ? "warn" : "ok" },
    { label: t("dash.kpi.open_pos"), value: summary ? fmt(summary.openPoCount) : "…", hint: isRtl ? "بانتظار التوريد والاستلام" : "not fully received" },
    { label: t("dash.kpi.pending_reqs"), value: summary ? fmt(summary.pendingApprovals) : "…", hint: isRtl ? "طلبات · فواتير · تسويات · هالك" : "reqs · invoices · adjustments · waste", cls: (summary?.pendingApprovals ?? 0) > 0 ? "warn" : "ok" },
    { label: isRtl ? "مستحقات الموردين (AP)" : "Accounts payable", value: summary ? money(summary.apBalance) : "…", hint: isRtl ? "أرصدة سجل الموردين المستحقة" : "supplier ledger balances" },
    { label: isRtl ? "شحنات تقترب من الانتهاء" : "Expiring soon", value: summary ? fmt(summary.expiringSoon) : "…", hint: isRtl ? "شحنات خلال 30 يوماً (FEFO)" : "batches within 30 days", cls: (summary?.expiringSoon ?? 0) > 0 ? "warn" : "ok" },
    { label: t("dash.kpi.transfers_transit"), value: summary ? fmt(summary.inTransitCount) : "…", hint: isRtl ? `${stale} شحنة متأخرة (>3 أيام)` : `${stale} stale (>3 days)` },
    { label: isRtl ? "دورات جرد قيد التنفيذ" : "Pending stocktakes", value: summary ? fmt(summary.pendingStocktakes) : "…", hint: isRtl ? "مجدولة أو جارية بالمستودعات" : "scheduled or in progress" },
  ];

  return (
    <>
      <div className="topbar">
        <h1>{t("dash.title")}</h1>
        <div className="crumb">{isRtl ? `مرحباً بك، ${user.name}` : `Welcome back, ${user.name.split(" ")[0]}`}</div>
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
            {isRtl ? "شحنات التحويل في الطريق" : "In-transit aging"}{" "}
            <span className="count">{aging?.length ?? 0} {isRtl ? "شحنة" : "orders"}</span>
          </h2>
          {!aging ? (
            <Loading />
          ) : aging.length === 0 ? (
            <Empty text={isRtl ? "لا توجد شحنات منقولة حالياً." : "No shipments in transit."} />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{isRtl ? "رقم الشحنة" : "Order"}</th>
                    <th>{isRtl ? "المسار" : "Route"}</th>
                    <th>{isRtl ? "الأيام" : "Days"}</th>
                    <th>{t("common.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {aging.map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{a.number}</td>
                      <td>
                        {a.from} {isRtl ? "←" : "→"} {a.to}
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
            {isRtl ? "أحدث حركات سجل التدقيق" : "Latest audit activity"}{" "}
            <span className="count">🔒 {isRtl ? "مشفرة SHA-256" : "hash-chained"}</span>
          </h2>
          {!audit ? (
            <Loading />
          ) : audit.length === 0 ? (
            <Empty text={isRtl ? "لا توجد حركات تدقيق مسجلة." : "No audit entries."} />
          ) : (
            audit.map((a) => (
              <div className="audit-row" key={a.id}>
                <span className="ts">{new Date(a.timestamp).toLocaleTimeString(isRtl ? "ar-EG" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
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