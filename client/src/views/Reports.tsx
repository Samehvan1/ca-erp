import { FormEvent, useState } from "react";
import { Badge, ConfirmDialog, Empty, ErrorBanner, ListToolbar, Loading, Modal, Toast, apiReq, useApi, useListFilter } from "../components";
import { getUser } from "../api";
import { useI18n } from "../lib/i18n";

interface ReportDef {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

interface ReportResult {
  code: string;
  lang: string;
  generatedAt: string;
  rows: Record<string, unknown>[];
}

interface ReportSnapshot {
  id: number;
  reportCode: string;
  period: string;
  data: Record<string, unknown>[];
  generatedAt: string;
}

interface ScheduledReport {
  id: number;
  reportCode: string;
  frequency: string;
  recipients: string[];
  active: boolean;
  createdAt: string;
}

const REPORT_META: Record<string, { nameEn: string; nameAr: string; descEn: string; descAr: string }> = {
  "STOCK-VALUATION": { nameEn: "Stock Valuation", nameAr: "تقييم المخزون", descEn: "Item quantities at weighted-average cost", descAr: "كميات الأصناف بالتكلفة المتوسطة المرجحة" },
  VARIANCE: { nameEn: "Variance Analysis", nameAr: "تحليل الفروقات والتباين", descEn: "Theoretical vs actual quantities per period", descAr: "الكميات النظرية مقابل الفعلية لكل فترة" },
  "PO-OPEN-BALANCE": { nameEn: "Open PO Balance", nameAr: "أوامر الشراء المفتوحة", descEn: "Outstanding purchase commitments", descAr: "التزامات الشراء وأوامر التوريد الجارية" },
  "SUPPLIER-AP": { nameEn: "Supplier AP", nameAr: "حسابات الموردين والدائنين", descEn: "Accounts payable balances per vendor", descAr: "أرصدة حسابات الموردين المستحقة" },
  "STOCK-AGING": { nameEn: "Stock Aging", nameAr: "أعمار المخزون وتواريخ الصلاحية", descEn: "Batch expiry risk profile", descAr: "مخاطر انتهاء صلاحية التشغيلات وFEFO" },
  "VENDOR-SLA": { nameEn: "Vendor SLA", nameAr: "مؤشرات أداء الموردين (SLA)", descEn: "OTIF, price variance, QC rejection", descAr: "نسب الالتزام بالمواعيد والجودة والأسعار" },
  "MENU-MARGIN": { nameEn: "Menu Margin", nameAr: "هوامش تكاليف الوصفات والقوائم", descEn: "Recipe cost at current WAC", descAr: "تكلفة الوصفة المحدثة بمتوسط التكلفة WAC" },
};

const FREQUENCIES = ["REAL_TIME", "DAILY", "WEEKLY", "MONTHLY"];

export default function Reports() {
  const { t, lang: appLang } = useI18n();
  const defs = useApi<ReportDef[]>("/analytics/definitions");
  const snapshots = useApi<ReportSnapshot[]>("/analytics/snapshots/history");
  const schedules = useApi<ScheduledReport[]>("/analytics/schedules/list");
  const [tab, setTab] = useState<"reports" | "snapshots" | "schedules">("reports");
  const [active, setActive] = useState<string | null>(null);
  const [lang, setLang] = useState<"EN" | "AR">(appLang.toUpperCase() as "EN" | "AR");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const snapshotFilter = useListFilter<ReportSnapshot>(snapshots.data, ["reportCode", "period"]);
  const scheduleFilter = useListFilter<ScheduledReport>(schedules.data, ["reportCode", "frequency"]);

  const [viewSnapshot, setViewSnapshot] = useState<ReportSnapshot | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [deleteSchedule, setDeleteSchedule] = useState<ScheduledReport | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ reportCode: "", frequency: "DAILY", recipients: "" });

  const user = getUser();
  const canSnapshot = user && ["ADMIN", "CFO", "COST_CONTROLLER"].includes(user.role);
  const canSchedule = user && ["ADMIN", "CFO"].includes(user.role);

  const run = async (code: string, l?: "EN" | "AR") => {
    const useLang = l ?? lang;
    setActive(code);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/v1/analytics/${code}?lang=${useLang}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ca_token")}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Report failed (${res.status})`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run report");
    } finally {
      setBusy(false);
    }
  };

  const toggleLang = (l: "EN" | "AR") => {
    setLang(l);
    if (active) run(active, l);
  };

  const snapshot = async (code: string) => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await apiReq<ReportSnapshot>("POST", `/analytics/${code}/snapshot`);
      setMsg(`Snapshot saved (${res.period})`);
      snapshots.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Snapshot failed");
    } finally {
      setBusy(false);
    }
  };

  const submitSchedule = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const recipients = scheduleForm.recipients
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!recipients.length) throw new Error("Add at least one recipient email");
      await apiReq("POST", "/analytics/schedules", {
        reportCode: scheduleForm.reportCode,
        frequency: scheduleForm.frequency,
        recipients,
      });
      setMsg("Schedule created");
      schedules.reload();
      setShowSchedule(false);
      setScheduleForm({ reportCode: "", frequency: "DAILY", recipients: "" });
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleSchedule = async (s: ScheduledReport) => {
    setBusy(true);
    setError(null);
    try {
      await apiReq("PATCH", `/analytics/schedules/${s.id}`, { active: !s.active });
      schedules.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteSchedule = async () => {
    if (!deleteSchedule) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await apiReq("DELETE", `/analytics/schedules/${deleteSchedule.id}`);
      setDeleteSchedule(null);
      setMsg("Schedule deleted");
      schedules.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleteSchedule(null);
    } finally {
      setBusy(false);
    }
  };

  const cols = result?.rows?.length ? Object.keys(result.rows[0]) : [];
  const snapCols = viewSnapshot?.data?.length ? Object.keys(viewSnapshot.data[0]) : [];

  return (
    <>
      <div className="topbar">
        <h1>{t("nav_reports")}</h1>
        <div className="crumb">{t("crumb_reports")}</div>
      </div>

      <div className="tabs">
        <button
          className={tab === "reports" ? "active" : ""}
          onClick={() => setTab("reports")}
          title="Reports: Prebuilt enterprise reports covering stock valuation, FEFO expiry aging, spend analytics, and profit margins"
        >
          {t("tab_reports")}
        </button>
        <button
          className={tab === "snapshots" ? "active" : ""}
          onClick={() => setTab("snapshots")}
          title="Snapshots: Point-in-time exported report runs with immutable parameter records and historical JSON data"
        >
          {t("tab_snapshots")} ({snapshots.data?.length ?? 0})
        </button>
        <button
          className={tab === "schedules" ? "active" : ""}
          onClick={() => setTab("schedules")}
          title="Schedules: Automated cron schedules for periodic report generation and recipient email notifications"
        >
          {t("tab_schedules")} ({schedules.data?.length ?? 0})
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {tab === "reports" && (
        <>
          <div className="report-grid" style={{ marginBottom: 22 }}>
            {defs.loading && <Loading />}
            {defs.error && <ErrorBanner message={defs.error} />}
            {(defs.data ?? []).map((d) => {
              const meta = REPORT_META[d.code];
              const name = meta ? (appLang === "ar" ? meta.nameAr : meta.nameEn) : d.name;
              const desc = meta ? (appLang === "ar" ? meta.descAr : meta.descEn) : (d.description ?? "");
              return (
                <div className="report-card" key={d.id} onClick={() => run(d.code)}>
                  <div className="code">{d.code}</div>
                  <div className="name">{name}</div>
                  <div className="aud">{desc}</div>
                </div>
              );
            })}
          </div>

          {active && (
            <div className="card">
              <h2>
                {REPORT_META[active] ? (appLang === "ar" ? REPORT_META[active].nameAr : REPORT_META[active].nameEn) : active}
                <span className="count">
                  <button className={`btn ghost sm ${lang === "EN" ? "primary" : ""}`} onClick={() => toggleLang("EN")}>
                    EN
                  </button>{" "}
                  <button className={`btn ghost sm ${lang === "AR" ? "primary" : ""}`} onClick={() => toggleLang("AR")}>
                    AR
                  </button>{" "}
                  {canSnapshot && (
                    <button className="btn sm" onClick={() => snapshot(active)} disabled={busy}>
                      {busy ? "Saving…" : "Snapshot"}
                    </button>
                  )}
                </span>
              </h2>
              {busy ? (
                <Loading />
              ) : !result ? null : result.rows.length === 0 ? (
                <Empty text="No rows for this report." />
              ) : (
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        {cols.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i}>
                          {cols.map((c) => {
                            const v = row[c];
                            const isNum = typeof v === "number";
                            return (
                              <td key={c} className={isNum ? "num" : ""}>
                                {v instanceof Date ? v.toLocaleDateString("en-GB") : String(v ?? "—")}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "snapshots" && (
        <div className="card">
          <ListToolbar
            q={snapshotFilter.q}
            setQ={snapshotFilter.setQ}
            rows={snapshotFilter.filtered}
            columns={[
              { key: "reportCode", label: "Report" },
              { key: "period", label: "Period" },
            ]}
            filename="snapshots"
          />
          {snapshots.error && <ErrorBanner message={snapshots.error} />}
          {snapshots.loading ? (
            <Loading />
          ) : !snapshots.data?.length ? (
            <Empty text="No snapshots yet. Run a report and capture a snapshot." />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Period</th>
                    <th>Rows</th>
                    <th>Generated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(snapshotFilter.filtered ?? []).map((s) => (
                    <tr key={s.id}>
                      <td className="mono">{s.reportCode}</td>
                      <td className="mono">{s.period}</td>
                      <td className="num">{s.data?.length ?? 0}</td>
                      <td>{new Date(s.generatedAt).toLocaleString("en-GB")}</td>
                      <td>
                        <button className="link" onClick={() => setViewSnapshot(s)}>
                          view
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "schedules" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            {canSchedule && (
              <button className="btn amber" onClick={() => setShowSchedule(true)}>
                + New schedule
              </button>
            )}
          </div>
          <ListToolbar
            q={scheduleFilter.q}
            setQ={scheduleFilter.setQ}
            rows={scheduleFilter.filtered}
            columns={[
              { key: "reportCode", label: "Report" },
              { key: "frequency", label: "Frequency" },
            ]}
            filename="schedules"
          />
          {schedules.error && <ErrorBanner message={schedules.error} />}
          {schedules.loading ? (
            <Loading />
          ) : !schedules.data?.length ? (
            <Empty text="No schedules yet." />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Frequency</th>
                    <th>Recipients</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(scheduleFilter.filtered ?? []).map((s) => (
                    <tr key={s.id}>
                      <td className="mono">{s.reportCode}</td>
                      <td>{s.frequency.replace(/_/g, " ")}</td>
                      <td>{s.recipients.join(", ")}</td>
                      <td>
                        <Badge status={s.active ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      <td>
                        <div className="row-actions">
                          {canSchedule && (
                            <>
                              <button className="link" onClick={() => toggleSchedule(s)}>
                                {s.active ? "pause" : "resume"}
                              </button>
                              <button
                                className="link danger"
                                onClick={() => {
                                  setError(null);
                                  setDeleteSchedule(s);
                                }}
                              >
                                delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showSchedule && (
        <Modal title="New Schedule" onClose={() => setShowSchedule(false)}>
          <form onSubmit={submitSchedule}>
            {error && <ErrorBanner message={error} />}
            <div className="form-row">
              <div className="field">
                <label>Report</label>
                <select value={scheduleForm.reportCode} onChange={(e) => setScheduleForm({ ...scheduleForm, reportCode: e.target.value })} required>
                  <option value="">Select report…</option>
                  {(defs.data ?? []).map((d) => {
                    const meta = REPORT_META[d.code];
                    const rName = meta ? (appLang === "ar" ? meta.nameAr : meta.nameEn) : d.name;
                    return (
                      <option key={d.id} value={d.code}>
                        {d.code} · {rName}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="field">
                <label>Frequency</label>
                <select value={scheduleForm.frequency} onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}>
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {f.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Recipients (comma-separated emails)</label>
              <input value={scheduleForm.recipients} onChange={(e) => setScheduleForm({ ...scheduleForm, recipients: e.target.value })} placeholder="ops@capitalagro.com, cfo@capitalagro.com" required />
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowSchedule(false)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : "Create schedule"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {viewSnapshot && (
        <Modal title={`${viewSnapshot.reportCode} · ${viewSnapshot.period}`} onClose={() => setViewSnapshot(null)} wide>
          <div className="tbl-wrap">
            {!viewSnapshot.data?.length ? (
              <Empty text="Snapshot has no rows." />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    {snapCols.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewSnapshot.data.map((row, i) => (
                    <tr key={i}>
                      {snapCols.map((c) => {
                        const v = row[c];
                        const isNum = typeof v === "number";
                        return (
                          <td key={c} className={isNum ? "num" : ""}>
                            {String(v ?? "—")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="modal-actions">
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setViewSnapshot(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {deleteSchedule && (
        <ConfirmDialog
          title="Delete schedule"
          message={`Delete the ${deleteSchedule.reportCode} schedule (${deleteSchedule.frequency.replace(/_/g, " ")})? This cannot be undone.`}
          confirmLabel="Delete"
          busy={busy}
          onConfirm={confirmDeleteSchedule}
          onCancel={() => setDeleteSchedule(null)}
        />
      )}

      <Toast message={msg} onDone={() => setMsg(null)} />
    </>
  );
}