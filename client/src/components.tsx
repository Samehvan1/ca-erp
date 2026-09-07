import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

/** POST/PATCH/DELETE helper against the API with the stored bearer token. */
export async function apiReq<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("ca_token")}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal${wide ? " wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "gray";
  if (/approve|passed|received|closed|active|approved|complete|intact|ok|processed|paid|full/i.test(s)) cls = "green";
  else if (/pending|open|partial|in_transit|dispatched|quarantin|aging|warn/i.test(s)) cls = "amber";
  else if (/reject|denied|cancel|expired|over|short|fail|error|negative/i.test(s)) cls = "red";
  else if (/requested|created|draft/i.test(s)) cls = "blue";
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/v1${path}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("ca_token")}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { data, error, loading, reload };
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return <div className="toast">{message}</div>;
}

export function Loading() {
  return <div className="loading">loading…</div>;
}

export function Empty({ text = "No records yet." }: { text?: string }) {
  return <div className="empty">{text}</div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner">{message}</div>;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>{message}</p>
      {error && <ErrorBanner message={error} />}
      <div className="modal-actions">
        <div className="spacer" />
        <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ============ SEARCH / FILTER / EXPORT ============

/** Resolve a dot-path like "vendor.name" or "item.description" on a row. */
function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const k of path.split(".")) {
    if (cur && typeof cur === "object") {
      const rec = cur as Record<string, unknown>;
      cur = rec[k];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** Client-side text filter across the given row keys (dot-paths allowed, e.g. "vendor.name"). */
export function useListFilter<T>(rows: T[] | null | undefined, keys: string[]) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!rows) return rows;
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => keys.some((k) => String(getPath(r, k) ?? "").toLowerCase().includes(needle)));
  }, [rows, q, keys]);
  return { q, setQ, filtered };
}

export interface ExportColumn<T> {
  key: string;
  label: string;
}

/** Search box + CSV export for a table. Renders nothing when rows are absent. */
export function ListToolbar<T>({
  q,
  setQ,
  rows,
  columns,
  filename,
  placeholder = "Search…",
}: {
  q: string;
  setQ: (v: string) => void;
  rows: T[] | null | undefined;
  columns: ExportColumn<T>[];
  filename: string;
  placeholder?: string;
}) {
  const exportCsv = () => {
    if (!rows?.length) return;
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.map((c) => c.label).join(",");
    const lines = rows.map((r) => columns.map((c) => esc(getPath(r, c.key))).join(","));
    const blob = new Blob(["\uFEFF" + [header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="list-toolbar">
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
      <button type="button" className="btn ghost sm" onClick={exportCsv} disabled={!rows?.length}>
        Export CSV
      </button>
    </div>
  );
}

// ============ VERSION HISTORY (per-record audit) ============

interface AuditEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
  hash: string;
  user?: { name: string } | null;
}

function DiffTable({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  const changed = keys.filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
  if (changed.length === 0) return <div className="history-none">no field changes recorded</div>;
  return (
    <table className="tbl history-diff">
      <thead>
        <tr>
          <th>Field</th>
          <th>Before</th>
          <th>After</th>
        </tr>
      </thead>
      <tbody>
        {changed.map((k) => (
          <tr key={k}>
            <td className="mono">{k}</td>
            <td className="muted-cell">{before?.[k] == null ? "—" : String(before[k])}</td>
            <td>{after?.[k] == null ? "—" : String(after[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Modal showing the hash-chained audit history for one record. */
export function HistoryModal({
  entityType,
  entityId,
  title,
  onClose,
}: {
  entityType: string;
  entityId: string | number;
  title: string;
  onClose: () => void;
}) {
  const { data, error, loading } = useApi<AuditEntry[]>(
    `/security/audit?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(String(entityId))}`
  );
  return (
    <Modal title={title} onClose={onClose} wide>
      {error && <ErrorBanner message={error} />}
      {loading ? (
        <Loading />
      ) : !data || data.length === 0 ? (
        <Empty text="No recorded changes for this record." />
      ) : (
        data.map((a) => (
          <div className="history-entry" key={a.id}>
            <div className="history-head">
              <Badge status={a.action} />
              <span className="ts">{new Date(a.timestamp).toLocaleString("en-GB")}</span>
              <span className="who">{a.user?.name ?? "system"}</span>
              <span className="hash">{a.hash.slice(0, 10)}…</span>
            </div>
            <DiffTable before={a.before} after={a.after} />
          </div>
        ))
      )}
    </Modal>
  );
}

/** Small button that opens the version-history modal for a record. */
export function HistoryButton({
  entityType,
  entityId,
  label = "History",
}: {
  entityType: string;
  entityId: string | number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
        ⏱ {label}
      </button>
      {open && (
        <HistoryModal
          entityType={entityType}
          entityId={entityId}
          title={`${label} — ${entityType} #${entityId}`}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}