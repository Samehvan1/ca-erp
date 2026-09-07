import { FormEvent, useState } from "react";
import { Badge, ConfirmDialog, Empty, ErrorBanner, HistoryButton, ListToolbar, Loading, Modal, Toast, apiReq, useApi, useListFilter } from "../components";
import { getUser } from "../api";

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  projectId: number | null;
  active: boolean;
  project: { name: string } | null;
}

interface UserForm {
  name: string;
  email: string;
  role: string;
  password: string;
}

const EMPTY_FORM: UserForm = { name: "", email: "", role: "BRANCH_MANAGER", password: "" };

export default function Users() {
  const users = useApi<User[]>("/security/users");
  const roles = useApi<string[]>("/security/roles");
  const { q, setQ, filtered } = useListFilter<User>(users.data, ["name", "email", "role"]);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [viewUser, setViewUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const currentUser = getUser();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/v1/security/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("ca_token")}` },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Create failed");
      setForm(EMPTY_FORM);
      setMsg(`Created ${body.email}`);
      users.reload();
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (u: User) => {
    setErr(null);
    setForm({ name: u.name, email: u.email, role: u.role, password: "" });
    setEditUser(u);
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
      };
      if (form.password) body.password = form.password;
      await apiReq("PATCH", `/security/users/${editUser.id}`, body);
      setEditUser(null);
      setForm(EMPTY_FORM);
      setMsg("User updated");
      users.reload();
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteUser) return;
    setBusy(true);
    setErr(null);
    try {
      await apiReq("DELETE", `/security/users/${deleteUser.id}`);
      setDeleteUser(null);
      setMsg("User deleted");
      users.reload();
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Delete failed");
      setDeleteUser(null);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u: User) => {
    try {
      const res = await fetch(`/api/v1/security/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("ca_token")}` },
        body: JSON.stringify({ active: !u.active }),
      });
      if (!res.ok) throw new Error("Update failed");
      users.reload();
    } catch {
      setMsg("Update failed");
    }
  };

  return (
    <>
      <div className="topbar">
        <h1>Users &amp; Access</h1>
        <div className="crumb">Accounts · Roles · RBAC</div>
      </div>

      <div className="card">
        <div className="sub-head">
          <strong>Create user</strong>
        </div>
        <form className="form" onSubmit={submit}>
          <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {(roles.data ?? []).map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <input placeholder="Password (min 6)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create user"}
          </button>
        </form>
        {msg && <div className="hint">{msg}</div>}
      </div>

      <div className="card">
        {users.error && <ErrorBanner message={users.error} />}
        {users.loading ? (
          <Loading />
        ) : !users.data?.length ? (
          <Empty />
        ) : (
          <div className="tbl-wrap">
            <ListToolbar
              q={q}
              setQ={setQ}
              rows={filtered}
              columns={[
                { key: "name", label: "Name" },
                { key: "email", label: "Email" },
                { key: "role", label: "Role" },
              ]}
              filename="users"
            />
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(filtered ?? []).map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td className="mono">{u.email}</td>
                    <td>
                      <Badge status={u.role} />
                    </td>
                    <td>{u.project?.name ?? "Group-wide"}</td>
                    <td>
                      <Badge status={u.active ? "ACTIVE" : "DISABLED"} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <HistoryButton entityType="User" entityId={u.id} />
                        <button className="link" onClick={() => setViewUser(u)}>
                          view
                        </button>
                        <button className="link" onClick={() => openEdit(u)}>
                          edit
                        </button>
                        {u.active ? (
                          <button className="link" onClick={() => toggleActive(u)}>
                            disable
                          </button>
                        ) : (
                          <button className="link" onClick={() => toggleActive(u)}>
                            enable
                          </button>
                        )}
                        {currentUser?.id !== u.id && (
                          <button className="link danger" onClick={() => { setErr(null); setDeleteUser(u); }}>
                            delete
                          </button>
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

      {viewUser && (
        <Modal title={viewUser.name} onClose={() => setViewUser(null)}>
          <div className="detail-grid">
            <div className="field">
              <label>Name</label>
              <div>{viewUser.name}</div>
            </div>
            <div className="field">
              <label>Email</label>
              <div className="mono">{viewUser.email}</div>
            </div>
            <div className="field">
              <label>Role</label>
              <div>
                <Badge status={viewUser.role} />
              </div>
            </div>
            <div className="field">
              <label>Project</label>
              <div>{viewUser.project?.name ?? "Group-wide"}</div>
            </div>
            <div className="field">
              <label>Status</label>
              <div>
                <Badge status={viewUser.active ? "ACTIVE" : "DISABLED"} />
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <div className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setViewUser(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {editUser && (
        <Modal title={`Edit ${editUser.name}`} onClose={() => setEditUser(null)}>
          <form onSubmit={submitEdit}>
            {err && <ErrorBanner message={err} />}
            <div className="field">
              <label>Full name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {(roles.data ?? []).map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Password (leave blank to keep current)</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="New password (min 6)" />
            </div>
            <div className="modal-actions">
              <div className="spacer" />
              <button type="button" className="btn ghost" onClick={() => setEditUser(null)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteUser && (
        <ConfirmDialog
          title="Delete user"
          message={`Delete ${deleteUser.name} (${deleteUser.email})? This cannot be undone.`}
          confirmLabel="Delete"
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteUser(null)}
        />
      )}

      {err && !editUser && !deleteUser && <ErrorBanner message={err} />}
      <Toast message={msg} onDone={() => setMsg(null)} />
    </>
  );
}
