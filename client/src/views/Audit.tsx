import { useState } from "react";
import { Empty, ErrorBanner, ListToolbar, Loading, useApi, useListFilter } from "../components";
import { useI18n } from "../lib/i18n";

interface AuditEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  timestamp: string;
  hash: string;
  user: { email: string; name: string } | null;
}

export default function Audit() {
  const { t, lang } = useI18n();
  const logs = useApi<AuditEntry[]>("/security/audit");
  const { q, setQ, filtered } = useListFilter<AuditEntry>(logs.data, ["action", "entityType", "entityId", "hash"]);
  const [verify, setVerify] = useState<{ intact: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/security/audit/verify", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ca_token")}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Verification failed");
      }
      setVerify(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <h1>{t("nav_audit")}</h1>
        <div className="crumb">{t("crumb_audit")}</div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="toolbar">
        <button className="btn" onClick={check} disabled={busy}>
          {busy ? (lang === "ar" ? "جارِ التحقق…" : "Verifying…") : (lang === "ar" ? "🔒 التحقق من سلامة وتطابق السلسلة" : "🔒 Verify chain integrity")}
        </button>
        {verify && (
          <span className={`badge ${verify.intact ? "green" : "red"}`} style={{ fontSize: 13 }}>
            {verify.intact
              ? (lang === "ar" ? "✓ السلسلة سليمة — لم يتم رصد أي تلاعب" : "✓ Chain intact — no tampering detected")
              : (lang === "ar" ? "⚠ انقطاع في السلسلة — تم رصد تلاعب!" : "⚠ CHAIN BROKEN — tampering detected")}
          </span>
        )}
      </div>

      <div className="card">
        {logs.error && <ErrorBanner message={logs.error} />}
        {logs.loading ? (
          <Loading />
        ) : !logs.data?.length ? (
          <Empty />
        ) : (
          <>
            <ListToolbar
              q={q}
              setQ={setQ}
              rows={filtered}
              columns={[
                { key: "action", label: "Action" },
                { key: "entityType", label: "Entity" },
                { key: "entityId", label: "Entity ID" },
                { key: "hash", label: "Hash" },
              ]}
              filename="audit"
            />
            {(filtered ?? []).map((a) => (
              <div className="audit-row" key={a.id}>
                <span className="ts">{new Date(a.timestamp).toLocaleString("en-GB")}</span>
                <span className="act">{a.action}</span>
                <span className="ent">
                  {a.entityType} {a.entityId ? `#${a.entityId}` : ""}
                </span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{a.user?.name ?? "system"}</span>
                <span className="hash">{a.hash.slice(0, 16)}…</span>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}