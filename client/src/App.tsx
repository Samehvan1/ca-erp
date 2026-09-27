import { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { api, clearSession, getUser, setSession, User } from "./api";
import { Toast } from "./components";
import { useI18n, LanguageSwitcher } from "./lib/i18n";
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

export default function App() {
  const { t, lang, isRtl } = useI18n();
  const [user, setUser] = useState<User | null>(getUser());
  const [toast, setToast] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "" });

  const navItems = [
    { to: "/", label: t("nav.dashboard"), ico: "◈" },
    { to: "/inventory", label: t("nav.inventory"), ico: "▤" },
    { to: "/procurement", label: t("nav.procurement"), ico: "⇄" },
    { to: "/transfers", label: t("nav.transfers"), ico: "⇌" },
    { to: "/stocktaking", label: t("nav.stocktaking"), ico: "☐" },
    { to: "/recipes", label: t("nav.recipes"), ico: "◔" },
    { to: "/finance", label: t("nav.finance"), ico: "₤" },
    { to: "/suppliers", label: t("nav.suppliers"), ico: "⚒" },
    { to: "/reports", label: t("nav.reports"), ico: "▥" },
    { to: "/users", label: t("nav.users"), ico: "☺" },
    { to: "/audit", label: t("nav.audit"), ico: "⚿" },
  ];

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setToast(t("common.error"));
    };
    window.addEventListener("ca_unauthorized", onUnauthorized);
    return () => window.removeEventListener("ca_unauthorized", onUnauthorized);
  }, [t]);

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
      setToast(t("common.success"));
    } catch (e) {
      setToast(e instanceof Error ? e.message : t("common.error"));
    }
  };

  if (!user) return <Login onLogin={onLogin} />;

  return (
    <div className={`shell ${isRtl ? "rtl" : ""}`}>
      <aside className="sidebar">
        <div className="brand" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="mark">
              {isRtl ? "كابيتال " : "Capital "}
              <em>{isRtl ? "أجرو" : "Agro"}</em>
            </div>
            <div className="sub">{t("brand.sub")}</div>
          </div>
          <LanguageSwitcher />
        </div>
        <nav className="nav">
          {navItems.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              <span className="ico">{n.ico}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="who">{user.name}</div>
          <div className="role" style={{ fontSize: 11.5, color: "var(--amber-2)" }}>{t("role." + user.role, user.role)}</div>
          {pwOpen && (
            <div className="pw-box">
              <input
                type="password"
                placeholder={t("nav.curr_pw")}
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
              />
              <input
                type="password"
                placeholder={t("nav.new_pw")}
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
              <div className="row">
                <button onClick={changePassword}>{t("nav.update")}</button>
                <button className="ghost" onClick={() => setPwOpen(false)}>
                  {t("nav.cancel")}
                </button>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <button className="ghost sm" style={{ padding: "4px 8px", fontSize: 11.5 }} onClick={() => setPwOpen((o) => !o)}>
              🔑 {t("nav.changepw")}
            </button>
            <button className="sm" style={{ padding: "4px 8px", fontSize: 11.5, background: "var(--danger)", color: "#fff" }} onClick={onLogout}>
              🚪 {t("nav.signout")}
            </button>
          </div>
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