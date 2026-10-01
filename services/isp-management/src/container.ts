import { ActionService } from "./actions.js";
import { Auth } from "./auth.js";
import type { Config } from "./config.js";
import { createPgDb, type Db } from "./db.js";
import { Directory } from "./directory.js";
import { SecurityMonitor, type AlertSink } from "./events.js";
import { HealthChecker } from "./health.js";
import { WriteGate } from "./killswitch.js";
import { createLogger, type Logger } from "./logger.js";
import { PiClient } from "./providers/pi/client.js";
import { createPiProviders, loadPiActions } from "./providers/pi/provider.js";
import type { NotificationProvider, Providers, WhatsAppProvider } from "./providers/types.js";
import { RateLimiter } from "./ratelimit.js";
import { WaAdmins } from "./whatsapp/admins.js";
import { WhatsAppAdminController } from "./whatsapp/controller.js";
import type { IntentInterpreter } from "./whatsapp/parser.js";
import { CloudApiSender } from "./whatsapp/sender.js";

export interface Container {
  cfg: Config;
  db: Db;
  log: Logger;
  limiter: RateLimiter;
  monitor: SecurityMonitor;
  gate: WriteGate;
  auth: Auth;
  directory: Directory;
  actions: ActionService;
  waAdmins: WaAdmins;
  wa: WhatsAppAdminController;
  sender: WhatsAppProvider;
  providers: Providers;
  health: HealthChecker;
  notifier: NotificationProvider & AlertSink;
  now: () => number;
}

export interface Overrides {
  db?: Db;
  providers?: Providers;
  sender?: WhatsAppProvider;
  log?: Logger;
  now?: () => number;
  ai?: IntentInterpreter;
}

/** A development database must never be used by a production process, or the reverse. */
export async function assertEnvironment(db: Db, env: string): Promise<void> {
  const r = await db.query<{ value: string }>("SELECT value #>> '{}' AS value FROM settings WHERE key = 'environment'");
  const stored = r.rows[0]?.value;
  if (!stored) {
    await db.query("INSERT INTO settings (key, value, updated_by) VALUES ('environment', $1::jsonb, 'bootstrap') ON CONFLICT DO NOTHING", [JSON.stringify(env)]);
    return;
  }
  if (stored !== env) throw new Error(`Environment mismatch: process is "${env}" but the database belongs to "${stored}"`);
}

export async function createContainer(cfg: Config, o: Overrides = {}): Promise<Container> {
  const log = o.log ?? createLogger("isp-api");
  const db = o.db ?? (await createPgDb(cfg.databaseUrl, cfg.databaseSsl));
  await assertEnvironment(db, cfg.env);

  let providers = o.providers;
  if (!providers) {
    if (!cfg.pi.baseUrl || !cfg.pi.username || !cfg.pi.password) throw new Error("PI_BASE_URL, PI_USERNAME and PI_PASSWORD are required");
    providers = createPiProviders(
      new PiClient({ baseUrl: cfg.pi.baseUrl, username: cfg.pi.username, password: cfg.pi.password, totpSecret: cfg.pi.totpSecret }),
      loadPiActions(cfg.pi.actionsFile),
    );
  }
  const sender = o.sender ?? new CloudApiSender({ accessToken: cfg.wa.accessToken, phoneNumberId: cfg.wa.phoneNumberId });
  const limiter = new RateLimiter(o.now);
  const waAdmins = new WaAdmins({ db, encKey: cfg.encryptionKey, now: o.now });

  const notifier: NotificationProvider & AlertSink = {
    async notifyOwners(message) {
      if (!sender.configured()) return;
      const owners = await db.query<{ phone_number: string }>("SELECT phone_number FROM whatsapp_admins WHERE status='ACTIVE' AND role='SUPER_ADMIN'");
      await Promise.allSettled(owners.rows.map((r) => sender.sendText(r.phone_number, `⚠ ISP alert: ${message}`)));
    },
    alert(message) {
      return this.notifyOwners(message);
    },
  };
  const monitor = new SecurityMonitor(db, log, notifier, o.now);
  const gate = new WriteGate(db, cfg.flags);
  const auth = new Auth({ db, pepper: cfg.sessionPepper, encKey: cfg.encryptionKey, requireMfa: cfg.requireMfa, limiter, monitor, now: o.now });
  const directory = new Directory({ db, providers, limiter, monitor, log, now: o.now });
  const actions = new ActionService({ db, providers, gate, monitor, limiter, log, now: o.now });
  const wa = new WhatsAppAdminController({ db, admins: waAdmins, actions, directory, sender, monitor, limiter, log, requireUnlock: cfg.wa.requireUnlock, ai: o.ai, now: o.now });
  const health = new HealthChecker({ db, providers, wa: sender, now: o.now });
  return { cfg, db, log, limiter, monitor, gate, auth, directory, actions, waAdmins, wa, sender, providers, health, notifier, now: o.now ?? Date.now };
}
