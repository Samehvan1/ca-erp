import { FormEvent, useState } from "react";
import { apiReq, Badge, ConfirmDialog, Empty, ErrorBanner, HistoryButton, ListToolbar, Loading, Modal, Toast, useApi, useListFilter } from "../components";

interface TrialRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

interface Posting {
  id: number;
  postingKey: string;
  refType: string;
  refId: string | null;
  debit: number;
  credit: number;
  account: { code: string; name: string };
  costCenter: { code: string } | null;
}

interface ApRow {
  id: number;
  createdAt: string;
  entryType: string;
  amount: number;
  balance: number;
  vendor: { name: string };
  po: { number: string } | null;
  invoice: { number: string } | null;
}

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  entries: unknown[];
}

interface CostCenter {
  id: number;
  code: string;
  name: string;
  level: string;
  projectId?: number | null;
  warehouseId?: number | null;
}

interface GlLine {
  accountId: string;
  costCenterId: string;
  debit: string;
  credit: string;
}

export default function Finance() {
  const [tab, setTab] = useState<"trial" | "postings" | "ap" | "accounts" | "costCenters">("trial");
  const trial = useApi<{ rows: TrialRow[]; totalDebit: number; totalCredit: number; balanced: boolean }>("/finance/trial-balance");
  const postings = useApi<Posting[]>("/finance/postings");
  const ap = useApi<ApRow[]>("/finance/ap-ledger");
  const accounts = useApi<Account[]>("/finance/accounts");
  const costCenters = useApi<CostCenter[]>("/finance/cost-centers");

  const accountFilter = useListFilter<Account>(accounts.data, ["code", "name", "type"]);
  const postingFilter = useListFilter<Posting>(postings.data, ["refType", "postingKey"]);
  const apFilter = useListFilter<ApRow>(ap.data, ["entryType", "amount", "balance"]);

  // New account
  const [showAccount, setShowAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({ code: "", name: "", type: "ASSET" });
  const [busyAccount, setBusyAccount] = useState(false);
  const [errAccount, setErrAccount] = useState<string | null>(null);

  // New cost center
  const [showCostCenter, setShowCostCenter] = useState(false);
  const [ccForm, setCcForm] = useState({ code: "", name: "", level: "HOLDING", projectId: "", warehouseId: "" });
  const [busyCc, setBusyCc] = useState(false);
  const [errCc, setErrCc] = useState<string | null>(null);

  // New posting
  const [showPosting, setShowPosting] = useState(false);
  const [postingForm, setPostingForm] = useState({ postingKey: "", refType: "", refId: "" });
  const [lines, setLines] = useState<GlLine[]>([{ accountId: "", costCenterId: "", debit: "", credit: "" }]);
  const [busyPosting, setBusyPosting] = useState(false);
  const [errPosting, setErrPosting] = useState<string | null>(null);

  const [msg, setMsg] = useState<string | null>(null);

  // View
  const [viewAccount, setViewAccount] = useState<Account | null>(null);
  const [viewCc, setViewCc] = useState<CostCenter | null>(null);

  // Edit (reuses the create modals)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingCc, setEditingCc] = useState<CostCenter | null>(null);

  // Delete
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null);
  const [busyDeleteAccount, setBusyDeleteAccount] = useState(false);
  const [errDeleteAccount, setErrDeleteAccount] = useState<string | null>(null);
  const [deleteCc, setDeleteCc] = useState<CostCenter | null>(null);
  const [busyDeleteCc, setBusyDeleteCc] = useState(false);
  const [errDeleteCc, setErrDeleteCc] = useState<string | null>(null);

  const openEditAccount = (a: Account) => {
    setAccountForm({ code: a.code, name: a.name, type: a.type });
    setEditingAccount(a);
    setErrAccount(null);
    setShowAccount(true);
  };

  const openEditCc = (c: CostCenter) => {
    setCcForm({
      code: c.code,
      name: c.name,
      level: c.level,
      projectId: c.projectId != null ? String(c.projectId) : "",
      warehouseId: c.warehouseId != null ? String(c.warehouseId) : "",
    });
    setEditingCc(c);
    setErrCc(null);
    setShowCostCenter(true);
  };

  const confirmDeleteAccount = async () => {
    if (!deleteAccount) return;
    setBusyDeleteAccount(true);
    setErrDeleteAccount(null);
    try {
      await apiReq("DELETE", `/finance/accounts/${deleteAccount.id}`);
      accounts.reload();
      setDeleteAccount(null);
      setMsg("Account deleted");
    } catch (err) {
      setErrDeleteAccount(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyDeleteAccount(false);
    }
  };

  const confirmDeleteCc = async () => {
    if (!deleteCc) return;
    setBusyDeleteCc(true);
    setErrDeleteCc(null);
    try {
      await apiReq("DELETE", `/finance/cost-centers/${deleteCc.id}`);
      costCenters.reload();
      setDeleteCc(null);
      setMsg("Cost center deleted");
    } catch (err) {
      setErrDeleteCc(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyDeleteCc(false);
    }
  };

  const submitAccount = async (e: FormEvent) => {
    e.preventDefault();
    setBusyAccount(true);
    setErrAccount(null);
    try {
      const body = { code: accountForm.code, name: accountForm.name, type: accountForm.type };
      if (editingAccount) {
        await apiReq("PATCH", `/finance/accounts/${editingAccount.id}`, body);
        setMsg("Account updated");
      } else {
        await apiReq("POST", "/finance/accounts", body);
        setMsg("Account created");
      }
      accounts.reload();
      setShowAccount(false);
      setEditingAccount(null);
      setAccountForm({ code: "", name: "", type: "ASSET" });
    } catch (err) {
      setErrAccount(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusyAccount(false);
    }
  };

  const submitCostCenter = async (e: FormEvent) => {
    e.preventDefault();
    setBusyCc(true);
    setErrCc(null);
    const body: Record<string, unknown> = { code: ccForm.code, name: ccForm.name, level: ccForm.level };
    if (ccForm.projectId) body.projectId = Number(ccForm.projectId);
    if (ccForm.warehouseId) body.warehouseId = Number(ccForm.warehouseId);
    try {
      if (editingCc) {
        await apiReq("PATCH", `/finance/cost-centers/${editingCc.id}`, body);
        setMsg("Cost center updated");
      } else {
        await apiReq("POST", "/finance/cost-centers", body);
        setMsg("Cost center created");
      }
      costCenters.reload();
      setShowCostCenter(false);
      setEditingCc(null);
      setCcForm({ code: "", name: "", level: "HOLDING", projectId: "", warehouseId: "" });
    } catch (err) {
      setErrCc(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusyCc(false);
    }
  };

  const submitPosting = async (e: FormEvent) => {
    e.preventDefault();
    setBusyPosting(true);
    setErrPosting(null);
    const body: Record<string, unknown> = {
      postingKey: postingForm.postingKey,
      refType: postingForm.refType,
      lines: lines.map((l) => {
        const line: Record<string, unknown> = { accountId: Number(l.accountId) };
        if (l.costCenterId) line.costCenterId = Number(l.costCenterId);
        if (l.debit) line.debit = Number(l.debit);
        if (l.credit) line.credit = Number(l.credit);
        return line;
      }),
    };
    if (postingForm.refId) body.refId = postingForm.refId;
    try {
      await apiReq("POST", "/finance/postings", body);
      postings.reload();
      setShowPosting(false);
      setPostingForm({ postingKey: "", refType: "", refId: "" });
      setLines([{ accountId: "", costCenterId: "", debit: "", credit: "" }]);
      setMsg("Posting created");
    } catch (err) {
      setErrPosting(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusyPosting(false);
    }
  };

  const addLine = () => setLines((ls) => [...ls, { accountId: "", costCenterId: "", debit: "", credit: "" }]);
  const updateLine = (i: number, patch: Partial<GlLine>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const canSubmitPosting = lines.length >= 2 && lines.every((l) => l.accountId !== "");

  return (
    <>
      <div className="topbar">
        <h1>Finance</h1>
        <div className="crumb">Trial Balance · GL · AP Ledger</div>
      </div>

      <div className="tabs">
        <button
          className={tab === "trial" ? "active" : ""}
          onClick={() => setTab("trial")}
          title="Trial balance: Overview of debits, credits, and closing balances for all active General Ledger accounts"
        >
          Trial balance
        </button>
        <button
          className={tab === "postings" ? "active" : ""}
          onClick={() => setTab("postings")}
          title="GL postings: Double-entry journal entries generated from inventory movements, invoices, and manual vouchers"
        >
          GL postings ({postings.data?.length ?? 0})
        </button>
        <button
          className={tab === "ap" ? "active" : ""}
          onClick={() => setTab("ap")}
          title="AP ledger: Accounts Payable subledger detailing outstanding vendor balances, invoices, and scheduled payments"
        >
          AP ledger ({ap.data?.length ?? 0})
        </button>
        <button
          className={tab === "accounts" ? "active" : ""}
          onClick={() => setTab("accounts")}
          title="Accounts: Chart of Accounts structure, financial classification codes, and reporting parents"
        >
          Accounts ({accounts.data?.length ?? 0})
        </button>
        <button
          className={tab === "costCenters" ? "active" : ""}
          onClick={() => setTab("costCenters")}
          title="Cost centers: Business units, departments, and store locations for departmental expense allocation"
        >
          Cost centers ({costCenters.data?.length ?? 0})
        </button>
      </div>

      {tab === "trial" && (
        <div className="card">
          {trial.error && <ErrorBanner message={trial.error} />}
          {trial.loading ? (
            <Loading />
          ) : !trial.data ? (
            <Empty />
          ) : (
            <>
              <div className="kpis">
                <div className="kpi">
                  <div className="kpi-v num">{trial.data.totalDebit.toFixed(2)}</div>
                  <div className="kpi-l">Total debit</div>
                </div>
                <div className="kpi">
                  <div className="kpi-v num">{trial.data.totalCredit.toFixed(2)}</div>
                  <div className="kpi-l">Total credit</div>
                </div>
                <div className="kpi">
                  <div className="kpi-v">
                    <Badge status={trial.data.balanced ? "BALANCED" : "UNBALANCED"} />
                  </div>
                  <div className="kpi-l">Double-entry check</div>
                </div>
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Account</th>
                      <th>Type</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trial.data.rows.map((r) => (
                      <tr key={r.code}>
                        <td className="mono">{r.code}</td>
                        <td>{r.name}</td>
                        <td>
                          <Badge status={r.type} />
                        </td>
                        <td className="num">{r.debit.toFixed(2)}</td>
                        <td className="num">{r.credit.toFixed(2)}</td>
                        <td className="num">{r.balance.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "postings" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn amber" onClick={() => setShowCostCenter(true)}>
              + New cost center
            </button>
            <button className="btn amber" onClick={() => setShowPosting(true)}>
              + New posting
            </button>
          </div>
          <ListToolbar
            q={postingFilter.q}
            setQ={postingFilter.setQ}
            rows={postingFilter.filtered}
            columns={[
              { key: "postingKey", label: "Posting key" },
              { key: "refType", label: "Ref" },
            ]}
            filename="gl-postings"
          />
          {postings.error && <ErrorBanner message={postings.error} />}
          {postings.loading ? (
            <Loading />
          ) : !postings.data?.length ? (
            <Empty text="No GL postings yet." />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Posting key</th>
                    <th>Account</th>
                    <th>Ref</th>
                    <th>Cost center</th>
                    <th>Debit</th>
                    <th>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {(postingFilter.filtered ?? []).map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.postingKey}</td>
                      <td>
                        {p.account.code} · {p.account.name}
                      </td>
                      <td className="mono">
                        {p.refType}
                        {p.refId ? `:${p.refId}` : ""}
                      </td>
                      <td className="mono">{p.costCenter?.code ?? "—"}</td>
                      <td className="num">{p.debit.toFixed(2)}</td>
                      <td className="num">{p.credit.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "ap" && (
        <div className="card">
          <ListToolbar
            q={apFilter.q}
            setQ={apFilter.setQ}
            rows={apFilter.filtered}
            columns={[
              { key: "entryType", label: "Type" },
              { key: "amount", label: "Amount" },
              { key: "balance", label: "Balance" },
            ]}
            filename="ap-ledger"
          />
          {ap.error && <ErrorBanner message={ap.error} />}
          {ap.loading ? (
            <Loading />
          ) : !ap.data?.length ? (
            <Empty text="No AP ledger entries." />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Vendor</th>
                    <th>PO</th>
                    <th>Invoice</th>
                    <th>Amount</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(apFilter.filtered ?? []).map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{new Date(a.createdAt).toLocaleDateString("en-GB")}</td>
                      <td>
                        <Badge status={a.entryType} />
                      </td>
                      <td>{a.vendor.name}</td>
                      <td className="mono">{a.po?.number ?? "—"}</td>
                      <td className="mono">{a.invoice?.number ?? "—"}</td>
                      <td className="num">{a.amount.toFixed(2)}</td>
                      <td className="num">{a.balance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "accounts" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn amber" onClick={() => setShowAccount(true)}>
              + New account
            </button>
          </div>
          <ListToolbar
            q={accountFilter.q}
            setQ={accountFilter.setQ}
            rows={accountFilter.filtered}
            columns={[
              { key: "code", label: "Code" },
              { key: "name", label: "Account" },
              { key: "type", label: "Type" },
            ]}
            filename="accounts"
          />
          {accounts.error && <ErrorBanner message={accounts.error} />}
          {accounts.loading ? (
            <Loading />
          ) : !accounts.data?.length ? (
            <Empty />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th>Type</th>
                    <th>Entries</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(accountFilter.filtered ?? []).map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{a.code}</td>
                      <td>{a.name}</td>
                      <td>
                        <Badge status={a.type} />
                      </td>
                      <td className="num">{a.entries.length}</td>
                      <td className="row-actions">
                        <HistoryButton entityType="GlAccount" entityId={a.id} />
                        <button className="btn sm ghost" onClick={() => setViewAccount(a)}>
                          View
                        </button>
                        <button className="btn sm ghost" onClick={() => openEditAccount(a)}>
                          Edit
                        </button>
                        <button className="btn sm danger" onClick={() => setDeleteAccount(a)} disabled={a.entries.length > 0}>
                          Delete
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

      {tab === "costCenters" && (
        <div className="card">
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn amber" onClick={() => setShowCostCenter(true)}>
              + New cost center
            </button>
          </div>
          {costCenters.error && <ErrorBanner message={costCenters.error} />}
          {costCenters.loading ? (
            <Loading />
          ) : !costCenters.data?.length ? (
            <Empty />
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Level</th>
                    <th>Project</th>
                    <th>Warehouse</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {costCenters.data.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{c.code}</td>
                      <td>{c.name}</td>
                      <td>
                        <Badge status={c.level} />
                      </td>
                      <td className="mono">{c.projectId ?? "—"}</td>
                      <td className="mono">{c.warehouseId ?? "—"}</td>
                      <td className="row-actions">
                        <button className="btn sm ghost" onClick={() => setViewCc(c)}>
                          View
                        </button>
                        <button className="btn sm ghost" onClick={() => openEditCc(c)}>
                          Edit
                        </button>
                        <button className="btn sm danger" onClick={() => setDeleteCc(c)}>
                          Delete
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

      <Toast message={msg} onDone={() => setMsg(null)} />

      {showAccount && (
        <Modal title={editingAccount ? "Edit account" : "New account"} onClose={() => setShowAccount(false)}>
          <form onSubmit={submitAccount}>
            {errAccount && <ErrorBanner message={errAccount} />}
            <div className="field">
              <label>Code</label>
              <input value={accountForm.code} onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })} required />
            </div>
            <div className="field">
              <label>Name</label>
              <input value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}>
                {["ASSET", "LIABILITY", "EXPENSE", "REVENUE", "EQUITY"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowAccount(false)}>
                Cancel
              </button>
              <button type="submit" className="btn amber" disabled={busyAccount}>
                {busyAccount ? "Saving…" : editingAccount ? "Save changes" : "Create account"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showCostCenter && (
        <Modal title={editingCc ? "Edit cost center" : "New cost center"} onClose={() => setShowCostCenter(false)}>
          <form onSubmit={submitCostCenter}>
            {errCc && <ErrorBanner message={errCc} />}
            <div className="form-row">
              <div className="field">
                <label>Code</label>
                <input value={ccForm.code} onChange={(e) => setCcForm({ ...ccForm, code: e.target.value })} required />
              </div>
              <div className="field">
                <label>Name</label>
                <input value={ccForm.name} onChange={(e) => setCcForm({ ...ccForm, name: e.target.value })} required />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Level</label>
                <select value={ccForm.level} onChange={(e) => setCcForm({ ...ccForm, level: e.target.value })}>
                  {["HOLDING", "PROJECT", "WAREHOUSE"].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Project ID</label>
                <input type="number" value={ccForm.projectId} onChange={(e) => setCcForm({ ...ccForm, projectId: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Warehouse ID</label>
              <input type="number" value={ccForm.warehouseId} onChange={(e) => setCcForm({ ...ccForm, warehouseId: e.target.value })} />
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowCostCenter(false)}>
                Cancel
              </button>
              <button type="submit" className="btn amber" disabled={busyCc}>
                {busyCc ? "Saving…" : editingCc ? "Save changes" : "Create cost center"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showPosting && (
        <Modal title="New GL posting" onClose={() => setShowPosting(false)} wide>
          <form onSubmit={submitPosting}>
            {errPosting && <ErrorBanner message={errPosting} />}
            <div className="form-row">
              <div className="field">
                <label>Posting key</label>
                <input value={postingForm.postingKey} onChange={(e) => setPostingForm({ ...postingForm, postingKey: e.target.value })} required />
              </div>
              <div className="field">
                <label>Ref type</label>
                <input value={postingForm.refType} onChange={(e) => setPostingForm({ ...postingForm, refType: e.target.value })} required />
              </div>
            </div>
            <div className="field">
              <label>Ref ID</label>
              <input value={postingForm.refId} onChange={(e) => setPostingForm({ ...postingForm, refId: e.target.value })} />
            </div>

            <div className="field">
              <label>Lines (min 2)</label>
              {lines.map((l, i) => (
                <div key={i} className="form-row">
                  <div className="field">
                    <label>Account</label>
                    <select value={l.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value })} required>
                      <option value="">Select…</option>
                      {(accounts.data ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Cost center</label>
                    <select value={l.costCenterId} onChange={(e) => updateLine(i, { costCenterId: e.target.value })}>
                      <option value="">—</option>
                      {(costCenters.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} · {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Debit</label>
                    <input type="number" step="0.01" min="0" value={l.debit} onChange={(e) => updateLine(i, { debit: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Credit</label>
                    <input type="number" step="0.01" min="0" value={l.credit} onChange={(e) => updateLine(i, { credit: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>&nbsp;</label>
                    <button type="button" className="btn ghost sm" onClick={() => removeLine(i)} disabled={lines.length <= 1}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn ghost sm" onClick={addLine}>
                + Add line
              </button>
            </div>

            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setShowPosting(false)}>
                Cancel
              </button>
              <button type="submit" className="btn amber" disabled={busyPosting || !canSubmitPosting}>
                {busyPosting ? "Creating…" : "Create posting"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {viewAccount && (
        <Modal title="Account details" onClose={() => setViewAccount(null)}>
          <div className="field">
            <label>Code</label>
            <div className="mono">{viewAccount.code}</div>
          </div>
          <div className="field">
            <label>Name</label>
            <div>{viewAccount.name}</div>
          </div>
          <div className="field">
            <label>Type</label>
            <div>
              <Badge status={viewAccount.type} />
            </div>
          </div>
          <div className="field">
            <label>Journal entries</label>
            <div className="num">{viewAccount.entries.length}</div>
          </div>
          <div className="modal-actions">
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setViewAccount(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {viewCc && (
        <Modal title="Cost center details" onClose={() => setViewCc(null)}>
          <div className="field">
            <label>Code</label>
            <div className="mono">{viewCc.code}</div>
          </div>
          <div className="field">
            <label>Name</label>
            <div>{viewCc.name}</div>
          </div>
          <div className="field">
            <label>Level</label>
            <div>
              <Badge status={viewCc.level} />
            </div>
          </div>
          <div className="field">
            <label>Project ID</label>
            <div className="mono">{viewCc.projectId ?? "—"}</div>
          </div>
          <div className="field">
            <label>Warehouse ID</label>
            <div className="mono">{viewCc.warehouseId ?? "—"}</div>
          </div>
          <div className="modal-actions">
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setViewCc(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {deleteAccount && (
        <ConfirmDialog
          title="Delete account"
          message={errDeleteAccount ?? `Delete account "${deleteAccount.name}"? This cannot be undone.`}
          busy={busyDeleteAccount}
          onConfirm={confirmDeleteAccount}
          onCancel={() => {
            setDeleteAccount(null);
            setErrDeleteAccount(null);
          }}
        />
      )}

      {deleteCc && (
        <ConfirmDialog
          title="Delete cost center"
          message={errDeleteCc ?? `Delete cost center "${deleteCc.name}"? This cannot be undone.`}
          busy={busyDeleteCc}
          onConfirm={confirmDeleteCc}
          onCancel={() => {
            setDeleteCc(null);
            setErrDeleteCc(null);
          }}
        />
      )}
    </>
  );
}