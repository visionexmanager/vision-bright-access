import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError, can, setCsrf, setUnauthorizedHandler, type Me } from "./api";
import { Link, navigate, usePath } from "./router";
import { AdminUsersPage, AuditPage, CustomerPage, CustomersPage, DashboardPage, SettingsPage, SystemPage, WhatsAppAdminsPage } from "./pages";

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const path = usePath();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setMe(null);
      navigate("/login");
    });
    api<Me>("GET", "/api/auth/me")
      .then((m) => {
        setCsrf(m.csrf);
        setMe(m);
      })
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) return <p role="status" style={{ padding: "1rem" }}>Loading…</p>;
  if (!me) return <Login onDone={(m) => { setCsrf(m.csrf); setMe(m); navigate(m.mfaSetupRequired ? "/settings" : "/dashboard"); }} />;
  return <Shell me={me} path={path} onLogout={() => setMe(null)} />;
}

function Login({ onDone }: { onDone: (m: Me) => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const errRef = useRef<HTMLParagraphElement>(null);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr("");
    try {
      const m = await api<Me>("POST", "/api/auth/login", { username: f.get("username"), password: f.get("password"), otp: (f.get("otp") as string) || undefined });
      onDone(m);
    } catch (x) {
      setErr(x instanceof ApiError && x.status === 429 ? x.message : "Sign-in failed. Check your details and try again.");
      setTimeout(() => errRef.current?.focus(), 0);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main>
      <h1>ISP Admin sign-in</h1>
      <form className="card" onSubmit={submit} aria-describedby={err ? "login-err" : undefined}>
        {err && <p id="login-err" className="alert error" role="alert" tabIndex={-1} ref={errRef}>{err}</p>}
        <label htmlFor="username">Username</label>
        <input id="username" name="username" autoComplete="username" required maxLength={64} />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={200} />
        <label htmlFor="otp">Authenticator code</label>
        <input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} aria-describedby="otp-help" />
        <p id="otp-help" className="muted">Required once two-factor authentication is set up.</p>
        <button className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}

const NAV: { to: string; label: string; show: (m: Me) => boolean }[] = [
  { to: "/dashboard", label: "Dashboard", show: () => true },
  { to: "/customers", label: "Customers", show: () => true },
  { to: "/services", label: "Services", show: () => true },
  { to: "/payments", label: "Payments", show: () => true },
  { to: "/radius", label: "RADIUS", show: () => true },
  { to: "/whatsapp-admins", label: "WhatsApp admins", show: (m) => can.manageAdmins(m.user.role) },
  { to: "/admin-users", label: "Admin users", show: (m) => can.manageAdmins(m.user.role) },
  { to: "/audit", label: "Audit", show: (m) => can.audit(m.user.role) },
  { to: "/system", label: "System", show: () => true },
  { to: "/settings", label: "Settings", show: () => true },
];

function Shell({ me, path, onLogout }: { me: Me; path: string; onLogout: () => void }) {
  const pathname = path.split("?")[0]!;
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Move focus to the new page and announce it, so keyboard and screen-reader users know the route changed.
    mainRef.current?.focus();
    document.title = (NAV.find((n) => pathname.startsWith(n.to))?.label ?? "ISP Admin") + " · ISP Admin";
  }, [pathname]);

  const logout = useCallback(async () => {
    await api("POST", "/api/auth/logout").catch(() => undefined);
    onLogout();
    navigate("/login");
  }, [onLogout]);

  let page: ReactNode;
  const cm = /^\/customers\/([^/]+)$/.exec(pathname);
  if (me.mfaSetupRequired && pathname !== "/settings") navigate("/settings");
  if (cm) page = <CustomerPage me={me} id={decodeURIComponent(cm[1]!)} query={path.split("?")[1] ?? ""} />;
  else if (pathname === "/customers") page = <CustomersPage />;
  else if (pathname === "/services" || pathname === "/payments" || pathname === "/radius") page = <CustomersPage tab={pathname.slice(1)} />;
  else if (pathname === "/whatsapp-admins" && can.manageAdmins(me.user.role)) page = <WhatsAppAdminsPage />;
  else if (pathname === "/admin-users" && can.manageAdmins(me.user.role)) page = <AdminUsersPage />;
  else if (pathname === "/audit" && can.audit(me.user.role)) page = <AuditPage />;
  else if (pathname === "/system") page = <SystemPage me={me} />;
  else if (pathname === "/settings") page = <SettingsPage me={me} />;
  else if (pathname === "/dashboard" || pathname === "/" || pathname === "/login") page = <DashboardPage />;
  else page = <><h1>Not found</h1><p><Link to="/dashboard">Back to the dashboard</Link></p></>;

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
      <header className="top">
        <strong>VisionEX ISP Admin</strong>
        <span className="muted">{me.user.displayName} · {me.user.role.replace("_", " ").toLowerCase()}</span>
        <nav aria-label="Main">
          <ul>
            {NAV.filter((n) => n.show(me)).map((n) => (
              <li key={n.to}><Link to={n.to} aria-current={pathname.startsWith(n.to) ? "page" : undefined}>{n.label}</Link></li>
            ))}
            <li><button onClick={logout}>Sign out</button></li>
          </ul>
        </nav>
      </header>
      <main id="main" tabIndex={-1} ref={mainRef} style={{ outline: "none" }}>{page}</main>
    </>
  );
}
