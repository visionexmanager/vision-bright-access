import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError, can, type Customer, type Me, type Pending, type PaymentInfo, type Profile, type Result, type Status } from "./api";
import { Link, navigate } from "./router";

// ---------- shared bits ----------
function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!path);
  const reload = useCallback(() => {
    if (!path) return;
    setLoading(true);
    api<T>("GET", path).then((d) => { setData(d); setError(""); }).catch((e: ApiError) => setError(e.message)).finally(() => setLoading(false));
  }, [path]);
  useEffect(reload, [reload]);
  return { data, error, loading, reload };
}
const Err = ({ msg }: { msg: string }) => (msg ? <p className="alert error" role="alert">{msg}</p> : null);
const Status_ = ({ s }: { s: string }) => <span className={`badge ${s}`}>{s.toLowerCase()}</span>;
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "—");

/** Native <dialog>: focus is trapped, Escape closes it, and focus returns to the opener. */
function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby="modal-title" onClose={onClose}>
      <h2 id="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}

// ---------- dashboard ----------
interface Dash {
  cachedCustomersByStatus: Record<string, number>; cachedExpiringWithin7Days: number; upstreamStats: Record<string, number> | null;
  recentErrors: { id: number; event_type: string; severity: string; message: string; created_at: string }[];
  recentActions?: { id: number; actor_type: string; action: string; target_id: string | null; result: string; created_at: string }[];
}
interface Sys { environment: string; health: { healthy: boolean; checks: Record<string, { ok: boolean; note?: string; ms?: number }> }; killSwitch: { allWrites: boolean; whatsappWrites: boolean; radiusWrites: boolean }; writeCapabilities: Record<string, boolean> }

export function DashboardPage() {
  const dash = useLoad<Dash>("/api/dashboard");
  const sys = useLoad<Sys>("/api/system");
  const d = dash.data;
  return (
    <>
      <h1>Dashboard</h1>
      <Err msg={dash.error || sys.error} />
      <section className="card" aria-labelledby="h-status">
        <h2 id="h-status">System status</h2>
        {sys.data ? (
          <div className="grid">
            {Object.entries(sys.data.health.checks).map(([k, v]) => (
              <div className="stat" key={k}><span className="muted">{k}</span><b className={v.ok ? "ok" : "bad"}>{v.ok ? "OK" : "Problem"}</b><span className="muted">{v.note ?? (v.ms !== undefined ? `${v.ms} ms` : "")}</span></div>
            ))}
            <div className="stat"><span className="muted">Changes</span><b className={sys.data.killSwitch.allWrites ? "bad" : "ok"}>{sys.data.killSwitch.allWrites ? "Disabled" : "Allowed"}</b><span className="muted">kill switch</span></div>
          </div>
        ) : <p role="status">Loading…</p>}
      </section>
      <section className="card" aria-labelledby="h-cust">
        <h2 id="h-cust">Customers seen by this system</h2>
        <p className="muted">Counts come from customers opened here, not the whole ISP database.</p>
        {d && (
          <div className="grid">
            {Object.entries(d.cachedCustomersByStatus).map(([k, v]) => <div className="stat" key={k}><span className="muted">{k.toLowerCase()}</span><b>{v}</b></div>)}
            <div className="stat"><span className="muted">expiring ≤ 7 days</span><b>{d.cachedExpiringWithin7Days}</b></div>
            {d.upstreamStats && Object.entries(d.upstreamStats).slice(0, 4).map(([k, v]) => <div className="stat" key={k}><span className="muted">ISP: {k}</span><b>{v}</b></div>)}
          </div>
        )}
      </section>
      <section className="card" aria-labelledby="h-err">
        <h2 id="h-err">Recent errors</h2>
        {d && !d.recentErrors.length ? <p>None.</p> : (
          <ul>{d?.recentErrors.map((e) => <li key={e.id}><b className="bad">{e.severity}</b> {e.message} <span className="muted">{when(e.created_at)}</span></li>)}</ul>
        )}
      </section>
      {d?.recentActions && (
        <section className="card" aria-labelledby="h-act">
          <h2 id="h-act">Recent administrative actions</h2>
          <div className="table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>Target</th><th>Result</th></tr></thead>
            <tbody>{d.recentActions.map((a) => <tr key={a.id}><td>{when(a.created_at)}</td><td>{a.action}</td><td>{a.target_id ?? "—"}</td><td>{a.result}</td></tr>)}</tbody></table></div>
        </section>
      )}
    </>
  );
}

// ---------- customer search ----------
export function CustomersPage({ tab }: { tab?: string }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ items: Customer[]; truncated: boolean } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const live = useRef<HTMLParagraphElement>(null);
  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 3) { setErr("Enter at least 3 characters."); return; }
    setBusy(true); setErr("");
    try { setRes(await api("GET", `/api/customers?q=${encodeURIComponent(q.trim())}&limit=25`)); }
    catch (x) { setErr((x as ApiError).message); setRes(null); }
    finally { setBusy(false); }
  };
  const label = tab ? tab[0]!.toUpperCase() + tab.slice(1) : "Customers";
  return (
    <>
      <h1>{tab ? `${label} — find a customer` : "Customers"}</h1>
      <form className="card" onSubmit={search} role="search" aria-label="Customer search">
        <label htmlFor="q">Customer ID, username, phone, name or email</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={64} autoComplete="off" aria-describedby="q-help" />
        <p id="q-help" className="muted">At least 3 characters. Wildcards are not supported.</p>
        <button className="btn" disabled={busy}>{busy ? "Searching…" : "Search"}</button>
      </form>
      <Err msg={err} />
      <p role="status" ref={live} className="muted">{res ? `${res.items.length} result${res.items.length === 1 ? "" : "s"}${res.truncated ? " (more exist — refine the search)" : ""}` : ""}</p>
      {res && res.items.length > 0 && (
        <div className="card table-wrap"><table>
          <thead><tr><th>Name</th><th>Username</th><th>Status</th></tr></thead>
          <tbody>{res.items.map((c) => (
            <tr key={c.externalId}>
              <td><Link to={`/customers/${encodeURIComponent(c.externalId)}${tab ? `?tab=${tab}` : ""}`}>{c.fullName ?? c.username}</Link></td>
              <td>{c.username}</td><td><Status_ s={c.status} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}

// ---------- customer profile + actions ----------
const ACTIONS: Record<Status, ("SUSPEND" | "RESUME" | "ACTIVATE")[]> = { ACTIVE: ["SUSPEND"], SUSPENDED: ["RESUME"], EXPIRED: ["ACTIVATE"], TERMINATED: [], UNKNOWN: [] };

export function CustomerPage({ me, id, query }: { me: Me; id: string; query: string }) {
  const [tab, setTab] = useState(new URLSearchParams(query).get("tab") ?? "overview");
  const { data, error, loading, reload } = useLoad<Profile>(`/api/customers/${encodeURIComponent(id)}`);
  const sessions = useLoad<{ sessions: { sessionId: string; startedAt?: string }[] }>(tab === "radius" ? `/api/customers/${encodeURIComponent(id)}/sessions` : null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [aerr, setAerr] = useState("");
  const [busy, setBusy] = useState(false);

  const request = async (action: string) => {
    setAerr(""); setResult(null); setBusy(true);
    try {
      // A fresh key per click; the server returns the same pending row if this exact request is repeated.
      setPending(await api<Pending>("POST", `/api/customers/${encodeURIComponent(id)}/actions`, { action, idempotencyKey: crypto.randomUUID() }));
    } catch (x) { setAerr((x as ApiError).message); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try { setResult(await api<Result>("POST", `/api/actions/${pending.id}/confirm`)); setPending(null); reload(); }
    catch (x) { setAerr((x as ApiError).message); setPending(null); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    if (pending) await api("POST", `/api/actions/${pending.id}/cancel`).catch(() => undefined);
    setPending(null);
  };

  if (loading && !data) return <p role="status">Loading…</p>;
  if (error || !data) return <><Err msg={error || "Customer not found."} /><p><Link to="/customers">Back to search</Link></p></>;
  const c = data.customer;
  const offered = can.act(me.user.role) ? ACTIONS[c.status] : [];
  const TABS = ["overview", "services", "payments", "radius", "actions"];
  return (
    <>
      <p><Link to="/customers">← Back to search</Link></p>
      <h1>{c.fullName ?? c.username} <Status_ s={c.status} /></h1>
      <div role="tablist" aria-label="Customer sections" className="tabs">
        {TABS.map((t) => <button key={t} role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} onClick={() => setTab(t)}>{t[0]!.toUpperCase() + t.slice(1)}</button>)}
      </div>
      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="card">
        {tab === "overview" && (
          <dl>
            <dt>Username</dt><dd>{c.username}</dd><dt>Phone</dt><dd>{c.phone ?? "—"}</dd><dt>Email</dt><dd>{c.email ?? "—"}</dd><dt>Address</dt><dd>{c.address ?? "—"}</dd>
          </dl>
        )}
        {tab === "services" && (data.services?.available ? (data.services.data.length ? data.services.data.map((s) => (
          <dl key={s.externalId}><dt>Package</dt><dd>{s.package ?? "—"}</dd><dt>Speed</dt><dd>{s.speed ?? "—"}</dd><dt>Status</dt><dd><Status_ s={s.status} /></dd><dt>Expires</dt><dd>{day(s.expirationDate)}</dd></dl>
        )) : <p>No service on record.</p>) : <p>Service details are unavailable right now.</p>)}
        {tab === "payments" && (data.payments?.available ? (data.payments.data.length ? <PaymentTable rows={data.payments.data} /> : <p>No payments on record.</p>) : <p>Payment details are unavailable right now.</p>)}
        {tab === "radius" && (
          <>
            {data.radius?.available ? <p>Account: <b>{data.radius.data.enabled === null ? "unknown" : data.radius.data.enabled ? "enabled" : "disabled"}</b> · Online: <b>{data.radius.data.online === null ? "unknown" : data.radius.data.online ? "yes" : "no"}</b></p> : <p>RADIUS status is unavailable right now.</p>}
            <h2>Active sessions</h2>
            {sessions.data ? (sessions.data.sessions.length ? <ul>{sessions.data.sessions.map((s) => <li key={s.sessionId}>Since {when(s.startedAt)}</li>)}</ul> : <p>No active session.</p>) : <p role="status">{sessions.loading ? "Loading…" : sessions.error}</p>}
          </>
        )}
        {tab === "actions" && (
          <>
            <p>Every change asks for confirmation, re-checks the customer in the ISP system, and is recorded in the audit log.</p>
            <Err msg={aerr} />
            {result && <p className={`alert ${result.ok ? "" : "error"}`} role={result.ok ? "status" : "alert"}>{result.message}</p>}
            {offered.length ? offered.map((a) => (
              <button key={a} className={`btn ${a === "SUSPEND" ? "danger" : ""}`} disabled={busy} onClick={() => request(a)}>{a[0] + a.slice(1).toLowerCase()} service</button>
            )) : <p className="muted">{can.act(me.user.role) ? `No actions are available while the status is ${c.status.toLowerCase()}.` : "Your role is read-only."}</p>}
          </>
        )}
      </section>
      <Modal open={!!pending} title={pending ? `Confirm ${pending.action.toLowerCase()}` : ""} onClose={() => pending && cancel()}>
        {pending && (
          <>
            <p><b>{pending.customer.fullName ?? pending.customer.username}</b> ({pending.customer.username})</p>
            <p>Status now <Status_ s={pending.currentStatus} /> → after <Status_ s={pending.resultingStatus} />.</p>
            <p className="muted">This request expires in 2 minutes.</p>
            <button className={`btn ${pending.action === "SUSPEND" ? "danger" : ""}`} disabled={busy} onClick={confirm}>Confirm {pending.action.toLowerCase()}</button>
            <button className="btn secondary" onClick={cancel}>Cancel</button>
          </>
        )}
      </Modal>
    </>
  );
}

const PaymentTable = ({ rows }: { rows: PaymentInfo[] }) => (
  <div className="table-wrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Method</th></tr></thead>
    <tbody>{rows.map((p) => <tr key={p.externalId}><td>{day(p.paymentDate)}</td><td>{p.amount.toFixed(2)} {p.currency}</td><td>{p.status}</td><td>{p.method ?? "—"}</td></tr>)}</tbody></table></div>
);

// ---------- audit ----------
interface AuditRow { id: number; actor_type: string; actor_id: string | null; action: string; target_id: string | null; result: string; created_at: string }
export function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [chain, setChain] = useState("");
  const more = useCallback(async () => {
    try {
      const before = rows.at(-1)?.id;
      const r = await api<{ entries: AuditRow[] }>("GET", `/api/audit?limit=50${before ? `&before=${before}` : ""}`);
      setRows((x) => [...x, ...r.entries]);
      if (r.entries.length < 50) setDone(true);
    } catch (e) { setErr((e as ApiError).message); }
  }, [rows]);
  useEffect(() => { void more(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const verify = async () => {
    try { const r = await api<{ ok: boolean; checked: number; brokenAt?: number }>("GET", "/api/audit/verify"); setChain(r.ok ? `Chain intact (${r.checked} entries).` : `TAMPERING DETECTED at entry ${r.brokenAt}.`); }
    catch (e) { setChain((e as ApiError).message); }
  };
  return (
    <>
      <h1>Audit log</h1>
      <Err msg={err} />
      <button className="btn secondary" onClick={verify}>Verify integrity</button>
      <p role="status">{chain}</p>
      <div className="card table-wrap"><table>
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Result</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td>{when(r.created_at)}</td><td>{r.actor_type.toLowerCase().replace("_", " ")}</td><td>{r.action}</td><td>{r.target_id ?? "—"}</td><td>{r.result}</td></tr>)}</tbody>
      </table></div>
      {!done && <button className="btn secondary" onClick={more}>Load older</button>}
    </>
  );
}

// ---------- system + kill switch ----------
export function SystemPage({ me }: { me: Me }) {
  const sys = useLoad<Sys>("/api/system");
  const ev = useLoad<{ events: { id: number; event_type: string; severity: string; message: string; created_at: string }[] }>("/api/events");
  const [confirmSwitch, setConfirm] = useState<null | { allWrites: boolean; whatsappWrites: boolean; radiusWrites: boolean }>(null);
  const [msg, setMsg] = useState("");
  const apply = async () => {
    if (!confirmSwitch) return;
    try { await api("POST", "/api/system/killswitch", confirmSwitch); setMsg("Kill switch updated."); sys.reload(); }
    catch (e) { setMsg((e as ApiError).message); }
    setConfirm(null);
  };
  const ks = sys.data?.killSwitch;
  return (
    <>
      <h1>System</h1>
      <Err msg={sys.error} />
      {sys.data && (
        <>
          <section className="card"><h2>Environment: {sys.data.environment}</h2>
            <h2>Health</h2>
            <ul>{Object.entries(sys.data.health.checks).map(([k, v]) => <li key={k}>{k}: <b className={v.ok ? "ok" : "bad"}>{v.ok ? "OK" : "Problem"}</b> <span className="muted">{v.note ?? ""}</span></li>)}</ul>
            <h2>Write capabilities (set by the server environment)</h2>
            <ul>{Object.entries(sys.data.writeCapabilities).map(([k, v]) => <li key={k}>{k}: <b>{v ? "enabled" : "off"}</b></li>)}</ul>
          </section>
          <section className="card" aria-labelledby="h-ks">
            <h2 id="h-ks">Emergency kill switch</h2>
            <p>Stops state-changing actions immediately while keeping read-only access. It can only reduce what the server allows.</p>
            <p role="status">{msg}</p>
            {can.manageAdmins(me.user.role) ? ks && (
              <>
                <button className={`btn ${ks.allWrites ? "secondary" : "danger"}`} onClick={() => setConfirm({ ...ks, allWrites: !ks.allWrites })}>{ks.allWrites ? "Re-enable all changes" : "Disable ALL changes"}</button>
                <button className="btn secondary" onClick={() => setConfirm({ ...ks, whatsappWrites: !ks.whatsappWrites })}>{ks.whatsappWrites ? "Re-enable WhatsApp actions" : "Disable WhatsApp actions"}</button>
                <button className="btn secondary" onClick={() => setConfirm({ ...ks, radiusWrites: !ks.radiusWrites })}>{ks.radiusWrites ? "Re-enable RADIUS changes" : "Disable RADIUS changes"}</button>
              </>
            ) : <p className="muted">Only a super admin can change this.</p>}
          </section>
        </>
      )}
      <section className="card"><h2>Recent events</h2>
        <div className="table-wrap"><table><thead><tr><th>When</th><th>Severity</th><th>Event</th></tr></thead>
          <tbody>{ev.data?.events.slice(0, 40).map((e) => <tr key={e.id}><td>{when(e.created_at)}</td><td>{e.severity}</td><td>{e.message}</td></tr>)}</tbody></table></div>
      </section>
      <Modal open={!!confirmSwitch} title="Change the kill switch?" onClose={() => setConfirm(null)}>
        <p>This takes effect immediately and is recorded in the audit log.</p>
        <button className="btn danger" onClick={apply}>Apply</button>
        <button className="btn secondary" onClick={() => setConfirm(null)}>Cancel</button>
      </Modal>
    </>
  );
}

// ---------- WhatsApp admins ----------
interface WaRow { id: string; phone: string; name: string; role: string; status: string; lastUsedAt: string | null }
export function WhatsAppAdminsPage() {
  const list = useLoad<{ admins: WaRow[] }>("/api/whatsapp-admins");
  const [created, setCreated] = useState<{ enrollmentCode: string; totpSecret: string; otpauthUri: string } | null>(null);
  const [err, setErr] = useState("");
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try { setCreated(await api("POST", "/api/whatsapp-admins", { phone: f.get("phone"), name: f.get("name"), role: f.get("role") })); setErr(""); list.reload(); e.currentTarget.reset(); }
    catch (x) { setErr((x as ApiError).message); }
  };
  const set = async (id: string, status: "ACTIVE" | "DISABLED") => { try { await api("PATCH", `/api/whatsapp-admins/${id}`, { status }); list.reload(); } catch (x) { setErr((x as ApiError).message); } };
  return (
    <>
      <h1>WhatsApp admins</h1>
      <p className="muted">A number is only trusted after it sends its one-time enrolment code, and every session is unlocked with an authenticator code. Phone numbers are masked.</p>
      <Err msg={err || list.error} />
      <form className="card" onSubmit={add}>
        <h2>Authorise a new number</h2>
        <label htmlFor="wa-phone">Phone number (international, digits only)</label><input id="wa-phone" name="phone" inputMode="numeric" required maxLength={20} />
        <label htmlFor="wa-name">Name</label><input id="wa-name" name="name" required maxLength={80} />
        <label htmlFor="wa-role">Role</label>
        <select id="wa-role" name="role" defaultValue="WHATSAPP_ADMIN"><option value="READ_ONLY_ADMIN">Read only</option><option value="WHATSAPP_ADMIN">WhatsApp admin</option><option value="ADMIN">Admin</option></select>
        <p><button className="btn">Create</button></p>
      </form>
      {created && (
        <section className="card" role="status" aria-label="Enrolment details">
          <h2>Shown once — hand these over privately</h2>
          <p>1. The person sends this from the registered number within 30 minutes:</p><code className="secret">enroll {created.enrollmentCode}</code>
          <p>2. They add this key to an authenticator app (the unlock code):</p><code className="secret">{created.totpSecret}</code>
          <p className="muted">Or open: {created.otpauthUri}</p>
          <button className="btn secondary" onClick={() => setCreated(null)}>I have handed this over</button>
        </section>
      )}
      <div className="card table-wrap"><table><thead><tr><th>Name</th><th>Number</th><th>Role</th><th>Status</th><th>Last used</th><th><span className="sr">Actions</span></th></tr></thead>
        <tbody>{list.data?.admins.map((a) => (
          <tr key={a.id}><td>{a.name}</td><td>{a.phone}</td><td>{a.role}</td><td>{a.status}</td><td>{when(a.lastUsedAt ?? undefined)}</td>
            <td>{a.status === "DISABLED" ? <button className="btn secondary" onClick={() => set(a.id, "ACTIVE")}>Enable</button> : <button className="btn danger secondary" onClick={() => set(a.id, "DISABLED")}>Disable</button>}</td></tr>
        ))}</tbody></table></div>
    </>
  );
}

// ---------- admin users ----------
interface AdminRow { id: string; username: string; display_name: string; role: string; status: string; totp_enabled: boolean; last_login: string | null }
export function AdminUsersPage() {
  const list = useLoad<{ users: AdminRow[] }>("/api/admin-users");
  const [err, setErr] = useState("");
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try { await api("POST", "/api/admin-users", { username: f.get("username"), password: f.get("password"), role: f.get("role") }); setErr(""); e.currentTarget.reset(); list.reload(); }
    catch (x) { setErr((x as ApiError).message); }
  };
  const set = async (id: string, status: "ACTIVE" | "DISABLED") => { try { await api("PATCH", `/api/admin-users/${id}`, { status }); setErr(""); list.reload(); } catch (x) { setErr((x as ApiError).message); } };
  return (
    <>
      <h1>Admin users</h1>
      <Err msg={err || list.error} />
      <form className="card" onSubmit={add}>
        <h2>Add an admin</h2>
        <label htmlFor="au-name">Username</label><input id="au-name" name="username" required minLength={3} maxLength={64} autoComplete="off" />
        <label htmlFor="au-pass">Temporary password (12+ characters, letters and numbers)</label><input id="au-pass" name="password" type="password" required minLength={12} autoComplete="new-password" />
        <label htmlFor="au-role">Role</label>
        <select id="au-role" name="role" defaultValue="ADMIN"><option value="READ_ONLY_ADMIN">Read only</option><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super admin</option></select>
        <p><button className="btn">Create</button></p>
      </form>
      <div className="card table-wrap"><table><thead><tr><th>Username</th><th>Role</th><th>2FA</th><th>Status</th><th>Last login</th><th><span className="sr">Actions</span></th></tr></thead>
        <tbody>{list.data?.users.map((u) => (
          <tr key={u.id}><td>{u.username}</td><td>{u.role}</td><td>{u.totp_enabled ? "on" : "off"}</td><td>{u.status}</td><td>{when(u.last_login ?? undefined)}</td>
            <td>{u.status === "ACTIVE" ? <button className="btn danger secondary" onClick={() => set(u.id, "DISABLED")}>Disable</button> : <button className="btn secondary" onClick={() => set(u.id, "ACTIVE")}>Enable</button>}</td></tr>
        ))}</tbody></table></div>
    </>
  );
}

// ---------- settings: password + MFA ----------
export function SettingsPage({ me }: { me: Me }) {
  const [msg, setMsg] = useState("");
  const [mfa, setMfa] = useState<{ secret: string; uri: string } | null>(null);
  const [err, setErr] = useState("");
  const pw = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try { await api("POST", "/api/auth/password", { current: f.get("current"), next: f.get("next") }); setMsg("Password changed. Other sessions were signed out."); setErr(""); e.currentTarget.reset(); }
    catch (x) { setErr((x as ApiError).message); }
  };
  const begin = async () => { try { setMfa(await api("POST", "/api/auth/mfa/begin")); setErr(""); } catch (x) { setErr((x as ApiError).message); } };
  const confirm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try { await api("POST", "/api/auth/mfa/confirm", { code: new FormData(e.currentTarget).get("code") }); setMsg("Two-factor authentication is on."); setMfa(null); if (me.mfaSetupRequired) window.location.assign("/dashboard"); }
    catch (x) { setErr((x as ApiError).message); }
  };
  return (
    <>
      <h1>Settings</h1>
      {me.mfaSetupRequired && <p className="alert" role="status">Two-factor authentication is required. Set it up to continue.</p>}
      <p role="status">{msg}</p>
      <Err msg={err} />
      <section className="card" aria-labelledby="h-mfa">
        <h2 id="h-mfa">Two-factor authentication</h2>
        {!mfa ? <button className="btn" onClick={begin}>Set up an authenticator app</button> : (
          <form onSubmit={confirm}>
            <p>Add this key to your authenticator app, then enter the 6-digit code it shows.</p>
            <code className="secret">{mfa.secret}</code>
            <label htmlFor="mfa-code">6-digit code</label><input id="mfa-code" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" />
            <p><button className="btn">Turn on</button></p>
          </form>
        )}
      </section>
      <form className="card" onSubmit={pw}>
        <h2>Change password</h2>
        <label htmlFor="pw-cur">Current password</label><input id="pw-cur" name="current" type="password" required autoComplete="current-password" />
        <label htmlFor="pw-new">New password (12+ characters, letters and numbers)</label><input id="pw-new" name="next" type="password" required minLength={12} autoComplete="new-password" />
        <p><button className="btn">Change password</button></p>
      </form>
      <p><Link to="/dashboard" onClick={() => navigate("/dashboard")}>Back to the dashboard</Link></p>
    </>
  );
}
