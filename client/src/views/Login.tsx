import { FormEvent, useState } from "react";
import { api, User } from "../api";

type Mode = "login" | "forgot" | "reset";

export default function Login({ onLogin }: { onLogin: (token: string, user: User) => void }) {
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
      setError(err instanceof Error ? err.message : "Login failed");
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
        setInfo("Development token issued — enter a new password below.");
      } else {
        setInfo("If an account exists for that email, a reset link has been sent.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
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
      setInfo("Password updated — sign in with your new password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-art">
        <div className="inner">
          <div className="mark" style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600 }}>
            Capital <em style={{ color: "var(--amber-2)" }}>Agro</em>
          </div>
        </div>
        <div className="inner">
          <h1>
            One ledger for every <em>outlet, kitchen &amp; depot.</em>
          </h1>
          <p>
            Enterprise stock control and purchasing across the Fanshy, Osta Rosto and Spacca brands — requisitions to
            receipts, batches to balances, all hash-chained and auditable.
          </p>
        </div>
        <div className="inner brands">
          <span>Fanshy</span>
          <span>Osta Rosto</span>
          <span>Spacca</span>
          <span>Holding</span>
        </div>
      </div>
      <div className="login-form">
        {mode === "login" && (
          <form className="login-card" onSubmit={submit}>
            <h2>Sign in</h2>
            <div className="sub">Access the group operations console.</div>
            {error && <div className="err">{error}</div>}
            {info && <div className="ok">{info}</div>}
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <button className="btn amber" style={{ width: "100%", marginTop: 6 }} disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
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
              Forgot password?
            </button>
            <div className="demo">
              admin@capitalagro.com / Admin@123
              <br />
              bm.fanshy@capitalagro.com / Admin@123 (scoped)
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