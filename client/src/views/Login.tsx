import { FormEvent, useState } from "react";
import { api, User } from "../api";
import { useI18n, LanguageSwitcher } from "../lib/i18n";

type Mode = "login" | "forgot" | "reset";

export default function Login({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const { t, isRtl } = useI18n();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("admin@capitalagro.com");
  const [password, setPassword] = useState("Admin@123");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onLogin(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : (isRtl ? "فشل تسجيل الدخول" : "Login failed"));
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api<{ ok: boolean; devToken?: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (res.devToken) {
        setResetToken(res.devToken);
        setMode("reset");
        setInfo(isRtl ? "تم إصدار رمز الاستعادة التجريبي — أدخل كلمة المرور الجديدة بالأسفل." : "Development token issued — enter a new password below.");
      } else {
        setInfo(isRtl ? "إذا كان الحساب مسجلاً، تم إرسال رابط إعادة التعيين." : "If an account exists for that email, a reset link has been sent.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (isRtl ? "فشل الطلب" : "Request failed"));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api<{ ok: boolean }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: resetToken, newPassword: resetPassword }),
      });
      setMode("login");
      setResetToken("");
      setResetPassword("");
      setInfo(isRtl ? "تم تحديث كلمة المرور — يرجى تسجيل الدخول بكلمة المرور الجديدة." : "Password updated — sign in with your new password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : (isRtl ? "فشل التعيين" : "Reset failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`login-wrap ${isRtl ? "rtl" : ""}`}>
      <div className="login-art">
        <div className="inner" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div className="mark" style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600 }}>
            {isRtl ? "كابيتال " : "Capital "}
            <em style={{ color: "var(--amber-2)" }}>{isRtl ? "أجرو" : "Agro"}</em>
          </div>
          <LanguageSwitcher />
        </div>
        <div className="inner">
          <h1>
            {isRtl ? (
              <>نظام مالي ومخزني متكامل <em>لكل منفذ، مطبخ، ومستودع مركزي.</em></>
            ) : (
              <>One ledger for every <em>outlet, kitchen &amp; depot.</em></>
            )}
          </h1>
          <p>
            {isRtl ? (
              "إدارة المخزون والمشتريات الشاملة لعلامات فانشي، أسطى روستو، وسپاكا كافيه — من طلبات الاحتياج إلى الاستلام الفعلي، تتبع الشحنات وسلاسل التشفير لجميع الحركات."
            ) : (
              "Enterprise stock control and purchasing across the Fanshy, Osta Rosto and Spacca brands — requisitions to receipts, batches to balances, all hash-chained and auditable."
            )}
          </p>
        </div>
        <div className="inner brands">
          <span>Fanshy (فانشي)</span>
          <span>Osta Rosto (أسطى روستو)</span>
          <span>Spacca (سپاكا)</span>
          <span>Holding (القابضة)</span>
        </div>
      </div>
      <div className="login-form">
        {mode === "login" && (
          <form className="login-card" onSubmit={submit}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2>{isRtl ? "تسجيل الدخول" : "Sign in"}</h2>
              <LanguageSwitcher />
            </div>
            <div className="sub">{isRtl ? "لوحة التحكم وإدارة العمليات للمجموعة" : "Access the group operations console."}</div>
            {error && <div className="err">{error}</div>}
            {info && <div className="ok">{info}</div>}
            <div className="field">
              <label>{isRtl ? "البريد الإلكتروني" : "Email"}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <div className="field">
              <label>{isRtl ? "كلمة المرور" : "Password"}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <button className="btn amber" style={{ width: "100%", marginTop: 6 }} disabled={busy}>
              {busy ? (isRtl ? "جاري الدخول..." : "Signing in…") : (isRtl ? "دخول النظام" : "Sign in")}
            </button>
            <button
              type="button"
              className="link"
              style={{ marginTop: 12 }}
              onClick={() => {
                setError(null);
                setInfo(null);
                setMode("forgot");
              }}
            >
              {isRtl ? "نسيت كلمة المرور؟" : "Forgot password?"}
            </button>
            <div className="demo">
              admin@capitalagro.com / Admin@123
              <br />
              bm.fanshy@capitalagro.com / Admin@123
            </div>
          </form>
        )}

        {mode === "forgot" && (
          <form className="login-card" onSubmit={submitForgot}>
            <h2>Reset password</h2>
            <div className="sub">Enter your account email to receive a reset link.</div>
            {error && <div className="err">{error}</div>}
            {info && <div className="ok">{info}</div>}
            <div className="field">
              <label>Email</label>
              <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} autoComplete="username" required />
            </div>
            <button className="btn amber" style={{ width: "100%", marginTop: 6 }} disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <button
              type="button"
              className="link"
              style={{ marginTop: 12 }}
              onClick={() => {
                setError(null);
                setInfo(null);
                setMode("login");
              }}
            >
              Back to sign in
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form className="login-card" onSubmit={submitReset}>
            <h2>Set new password</h2>
            <div className="sub">Use the token from the reset email to set a new password.</div>
            {error && <div className="err">{error}</div>}
            {info && <div className="ok">{info}</div>}
            <div className="field">
              <label>Reset token</label>
              <input value={resetToken} onChange={(e) => setResetToken(e.target.value)} autoComplete="off" required />
            </div>
            <div className="field">
              <label>New password</label>
              <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
            </div>
            <button className="btn amber" style={{ width: "100%", marginTop: 6 }} disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </button>
            <button
              type="button"
              className="link"
              style={{ marginTop: 12 }}
              onClick={() => {
                setError(null);
                setInfo(null);
                setMode("login");
              }}
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}