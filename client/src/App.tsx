import { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { api, clearSession, getUser, setSession, User } from "./api";
import { Toast } from "./components";
import Dashboard from "./views/Dashboard";
import Inventory from "./views/Inventory";
import Procurement from "./views/Procurement";
import Transfers from "./views/Transfers";
import Stocktaking from "./views/Stocktaking";
import Recipes from "./views/Recipes";
import Finance from "./views/Finance";
import Suppliers from "./views/Suppliers";
import Users from "./views/Users";
import Reports from "./views/Reports";
import Audit from "./views/Audit";
import Login from "./views/Login";

const NAV = [
  { to: "/", label: "Dashboard", ico: "◈" },
  { to: "/inventory", label: "Inventory", ico: "▤" },
  { to: "/procurement", label: "Procurement", ico: "⇄" },
  { to: "/transfers", label: "Transfers", ico: "⇌" },
  { to: "/stocktaking", label: "Stocktaking", ico: "☐" },
  { to: "/recipes", label: "Recipes", ico: "◔" },
  { to: "/finance", label: "Finance", ico: "₤" },
  { to: "/suppliers", label: "Suppliers", ico: "⚒" },
  { to: "/reports", label: "Reports", ico: "▥" },
  { to: "/users", label: "Users", ico: "☺" },
  { to: "/audit", label: "Audit Trail", ico: "⚿" },
];

export default function App() {
  const [user, setUser] = useState<User | null>(getUser());
  const [toast, setToast] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "" });

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setToast("Your session has expired. Please sign in again.");
    };
    window.addEventListener("ca_unauthorized", onUnauthorized);
    return () => window.removeEventListener("ca_unauthorized", onUnauthorized);
  }, []);

  const onLogin = (token: string, u: User) => {
    setSession(token, u);
    setUser(u);
  };

  const onLogout = () => {
    clearSession();
    setUser(null);
  };

  const changePassword = async () => {
    try {
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("ca_token")}` },
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Change failed");
      setPw({ current: "", next: "" });
      setPwOpen(false);
      setToast("Password updated");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Change failed");
    }
  };

  if (!user) return <Login onLogin={onLogin} />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">
            Capital <em>Agro</em>
          </div>
          <div className="sub">Stock Control · Purchases</div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              <span className="ico">{n.ico}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="who">{user.name}</div>
          <div className="role">{user.role}</div>
          {pwOpen && (
            <div className="pw-box">
              <input
                type="password"
                placeholder="Current password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
              />
              <input
                type="password"
                placeholder="New password (min 8)"
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
              <div className="row">
                <button onClick={changePassword}>Update</button>
                <button className="ghost" onClick={() => setPwOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          <button className="ghost" onClick={() => setPwOpen((o) => !o)}>
            Change password
          </button>
          <button onClick={onLogout}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/procurement" element={<Procurement />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/stocktaking" element={<Stocktaking />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/users" element={<Users />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

export { api };