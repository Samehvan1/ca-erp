import { FormEvent, useState } from "react";
import { Badge, ConfirmDialog, Empty, ErrorBanner, HistoryButton, ListToolbar, Loading, Modal, Toast, apiReq, useApi, useListFilter } from "../components";
import { getUser } from "../api";
import { useI18n } from "../lib/i18n";

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

interface RoleMatrixData {
  roles: string[];
  matrix: Record<
    string,
    {
      name: string;
      level: string;
      scope: string;
      description: string;
      capabilities: string[];
    }
  >;
  capabilities: { id: string; label: string; module: string }[];
}

const EMPTY_FORM: UserForm = { name: "", email: "", role: "BRANCH_MANAGER", password: "" };

export default function Users() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"users" | "roles">("users");

  const users = useApi<User[]>("/security/users");
  const roles = useApi<string[]>("/security/roles");
  const roleMatrix = useApi<RoleMatrixData>("/security/roles/matrix");

  const { q, setQ, filtered } = useListFilter<User>(users.data, ["name", "email", "role"]);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [viewUser, setViewUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [selectedRoleDetail, setSelectedRoleDetail] = useState<string | null>(null);

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

  const handleQuickRoleChange = async (userId: number, newRole: string) => {
    setBusy(true);
    try {
      await apiReq("PATCH", `/security/users/${userId}/role`, { role: newRole });
      setMsg("Role assigned successfully");
      users.reload();
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Role assignment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <h1>{t("nav_users")}</h1>
        <div className="crumb">{t("crumb_users")}</div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 20 }}>
        <button
          className={`tab ${tab === "users" ? "active" : ""}`}
          onClick={() => setTab("users")}
          style={{
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: 13.5,
            background: "none",
            border: "none",
            borderBottom: tab === "users" ? "3px solid var(--amber)" : "3px solid transparent",
            cursor: "pointer",
            color: tab === "users" ? "var(--amber)" : "var(--muted)",
          }}
        >
          👥 {t("tab_user_accounts")} ({users.data?.length ?? 0})
        </button>
        <button
          className={`tab ${tab === "roles" ? "active" : ""}`}
          onClick={() => setTab("roles")}
          style={{
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: 13.5,
            background: "none",
            border: "none",
            borderBottom: tab === "roles" ? "3px solid var(--amber)" : "3px solid transparent",
            cursor: "pointer",
            color: tab === "roles" ? "var(--amber)" : "var(--muted)",
          }}
        >
          🛡️ {t("tab_role_matrix")}
        </button>
      </div>

      {msg && <Toast message={msg} onDone={() => setMsg(null)} />}
      {(err || users.error || roleMatrix.error) && (
        <ErrorBanner message={err || users.error || roleMatrix.error || ""} />
      )}

      {/* ========================================================================= */}
      {/* 1. USERS TAB */}
      {/* ========================================================================= */}
      {tab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <div className="sub-head">
              <strong>+ Provision New User</strong>
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
          </div>

          <div className="card">
            {users.loading ? (
              <Loading />
            ) : !users.data?.length ? (
              <Empty />
            ) : (
              <div>
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
                <div className="tbl-wrap" style={{ marginTop: 8 }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th style={{ width: 180 }}>Role</th>
                        <th>Project / Scope</th>
                        <th style={{ width: 110 }}>Status</th>
                        <th style={{ width: 180, textAlign: "right" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(filtered ?? []).map((u) => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600 }}>{u.name}</td>
                          <td className="mono" style={{ color: "var(--amber)" }}>{u.email}</td>
                          <td>
                            <select
                              value={u.role}
                              onChange={(e) => handleQuickRoleChange(u.id, e.target.value)}
                              disabled={busy}
                              style={{
                                padding: "3px 6px",
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {(roles.data ?? []).map((r) => (
                                <option key={r} value={r}>
                                  {r.replace(/_/g, " ")}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {u.project?.name ? (
                              <span className="badge amber" style={{ fontSize: 11 }}>
                                {u.project.name}
                              </span>
                            ) : (
                              <span className="badge green" style={{ fontSize: 11 }}>
                                🌐 Group-wide
                              </span>
                            )}
                          </td>
                          <td>
                            <Badge status={u.active ? "ACTIVE" : "DISABLED"} />
                          </td>
                          <td>
                            <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                              <HistoryButton entityType="User" entityId={u.id} />
                              <button type="button" className="link" onClick={() => setViewUser(u)}>
                                view
                              </button>
                              <button type="button" className="link" onClick={() => openEdit(u)}>
                                edit
                              </button>
                              {u.active ? (
                                <button type="button" className="link" onClick={() => toggleActive(u)}>
                                  disable
                                </button>
                              ) : (
                                <button type="button" className="link" onClick={() => toggleActive(u)}>
                                  enable
                                </button>
                              )}
                              {currentUser?.id !== u.id && (
                                <button
                                  type="button"
                                  className="link danger"
                                  onClick={() => {
                                    setErr(null);
                                    setDeleteUser(u);
                                  }}
                                >
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ROLES & CAPABILITY MATRIX TAB */}
      {/* ========================================================================= */}
      {tab === "roles" && roleMatrix.data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <h2>🛡️ Standard ERP Security Roles &amp; Capability Matrix</h2>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
              The system implements 8 role presets across 17 functional capabilities, ensuring strict segregation of duties between procurement, warehousing, kitchen production, and financial auditing.
            </p>
          </div>

          {/* Role Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {roleMatrix.data.roles.map((roleKey) => {
              const meta = roleMatrix.data?.matrix[roleKey];
              if (!meta) return null;
              const userCount = (users.data || []).filter((u) => u.role === roleKey).length;

              return (
                <div
                  key={roleKey}
                  className="card"
                  style={{
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                          {meta.level} · {meta.scope}
                        </span>
                        <h4 style={{ margin: "2px 0 0 0", fontSize: 15, color: "var(--amber)" }}>{meta.name}</h4>
                      </div>
                      <span className="badge gray" style={{ fontSize: 11 }}>
                        {userCount} Assigned
                      </span>
                    </div>
                    <p style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.4, margin: "6px 0 12px 0" }}>
                      {meta.description}
                    </p>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
                      Active Capabilities ({meta.capabilities.length}):
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {meta.capabilities.slice(0, 5).map((capId) => {
                        const cap = roleMatrix.data?.capabilities.find((c) => c.id === capId);
                        return (
                          <span key={capId} className="badge gray" style={{ fontSize: 10 }}>
                            ✓ {cap?.label || capId}
                          </span>
                        );
                      })}
                      {meta.capabilities.length > 5 && (
                        <button
                          type="button"
                          className="badge amber"
                          style={{ fontSize: 10, cursor: "pointer", border: "none" }}
                          onClick={() => setSelectedRoleDetail(roleKey)}
                        >
                          +{meta.capabilities.length - 5} more…
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Matrix Table */}
          <div className="card">
            <div className="tbl-wrap">
              <table className="tbl" style={{ minWidth: 960 }}>
                <thead>
                  <tr>
                    <th style={{ width: 240, textAlign: "left" }}>Functional Permission Area</th>
                    <th style={{ width: 110, textAlign: "left" }}>Module</th>
                    {roleMatrix.data.roles.map((r) => (
                      <th
                        key={r}
                        style={{
                          textAlign: "center",
                          fontSize: 10.5,
                          padding: "8px 6px",
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                          lineHeight: 1.2,
                        }}
                      >
                        {r.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roleMatrix.data.capabilities.map((cap) => (
                    <tr key={cap.id}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{cap.label}</td>
                      <td>
                        <span className="badge gray" style={{ fontSize: 11 }}>
                          {cap.module}
                        </span>
                      </td>
                      {roleMatrix.data?.roles.map((r) => {
                        const hasCap = roleMatrix.data?.matrix[r]?.capabilities.includes(cap.id);
                        return (
                          <td key={r} style={{ textAlign: "center", verticalAlign: "middle" }}>
                            {hasCap ? (
                              <span style={{ color: "var(--ok)", fontWeight: 800, fontSize: 15 }}>✓</span>
                            ) : (
                              <span style={{ color: "var(--line-2)", fontSize: 14 }}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* View User Modal */}
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
              <label>Project Scope</label>
              <div>{viewUser.project?.name ?? "Group-wide (Cross Project)"}</div>
            </div>
            <div className="field">
              <label>Status</label>
              <div>
                <Badge status={viewUser.active ? "ACTIVE" : "DISABLED"} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <Modal title={`Edit: ${editUser.name}`} onClose={() => setEditUser(null)}>
          <form className="form" onSubmit={submitEdit}>
            <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {(roles.data ?? []).map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input placeholder="New password (leave blank to keep current)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn ghost" onClick={() => setEditUser(null)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Role Detail Modal */}
      {selectedRoleDetail && roleMatrix.data && (
        <Modal
          title={`Role Details: ${roleMatrix.data.matrix[selectedRoleDetail]?.name || selectedRoleDetail}`}
          onClose={() => setSelectedRoleDetail(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              {roleMatrix.data.matrix[selectedRoleDetail]?.description}
            </p>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--amber)", marginTop: 6 }}>All Assigned Capabilities:</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {roleMatrix.data.matrix[selectedRoleDetail]?.capabilities.map((capId) => {
                const cap = roleMatrix.data?.capabilities.find((c) => c.id === capId);
                return (
                  <div key={capId} style={{ padding: "6px 10px", background: "var(--paper-2)", borderRadius: 6, fontSize: 12, border: "1px solid var(--line)" }}>
                    ✓ <strong>{cap?.label || capId}</strong> ({cap?.module})
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* Delete User Dialog */}
      {deleteUser && (
        <ConfirmDialog
          title={`Delete user ${deleteUser.email}?`}
          message="This user account will be permanently removed."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteUser(null)}
        />
      )}
    </>
  );
}
