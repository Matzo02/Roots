/**
 * WhatsApp auto-link via Baileys.
 *
 * Singleton stored on globalThis so Next.js HMR doesn't spawn duplicate
 * sockets (which causes "Stream Errored (conflict)" loops).
 */

import {
  type WAMessage,
  type WASocket,
  default as makeWASocket,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";

/** Parsed-and-persisted shape of a single message. */
interface PersistedMsg {
  at: string;
  fromMe: boolean;
  text: string;
  keyId?: string;
}

interface SessionState {
  sock: WASocket | null;
  status: "idle" | "qr" | "linking" | "linked" | "syncing" | "ready" | "error";
  qrDataUrl: string | null;
  error: string | null;
  historyCount: number;
  events: { at: string; msg: string }[];
  /** Parsed messages per JID — persisted to disk, hydrated on auto-resume */
  chats: Map<string, PersistedMsg[]>;
  contactNames: Map<string, string>;
  initPromise: Promise<void> | null;
  /** Reconnect attempt counter — drives exponential backoff, no hard cap */
  reconnectAttempts: number;
  /** Pending reconnect timer — cancelled on unlink */
  reconnectTimer: NodeJS.Timeout | null;
  /** Whether we've already kicked off the auto-resume probe at module load */
  autoResumeAttempted: boolean;
  /** Debounced save timer */
  saveTimer: NodeJS.Timeout | null;
}

// HMR-safe singleton: store on globalThis so module reloads pick up the
// same in-flight session instead of starting a new socket.
// Bump version when the SessionState shape changes — old singleton is dropped.
const GLOBAL_KEY = "__roots_wa_session_v2__";
type GlobalWithSession = typeof globalThis & {
  [GLOBAL_KEY]?: SessionState;
};

function getSession(): SessionState {
  const g = globalThis as GlobalWithSession;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      sock: null,
      status: "idle",
      qrDataUrl: null,
      error: null,
      historyCount: 0,
      events: [],
      chats: new Map(),
      contactNames: new Map(),
      initPromise: null,
      reconnectAttempts: 0,
      reconnectTimer: null,
      autoResumeAttempted: false,
      saveTimer: null,
    };
  }
  return g[GLOBAL_KEY]!;
}

function cachePath(): string {
  return join(authDir(), "chats-cache.json");
}

/** Hydrate session.chats + contactNames from disk. */
function loadCacheFromDisk(): { chats: number; messages: number } {
  const session = getSession();
  try {
    const raw = readFileSync(cachePath(), "utf8");
    const data = JSON.parse(raw) as {
      chats: Array<[string, PersistedMsg[]]>;
      contactNames: Array<[string, string]>;
    };
    session.chats = new Map(data.chats);
    session.contactNames = new Map(data.contactNames);
    const messages = data.chats.reduce((sum, [, msgs]) => sum + msgs.length, 0);
    session.historyCount = messages;
    return { chats: data.chats.length, messages };
  } catch {
    return { chats: 0, messages: 0 };
  }
}

function scheduleSave() {
  const session = getSession();
  if (session.saveTimer) return;
  session.saveTimer = setTimeout(() => {
    session.saveTimer = null;
    try {
      const data = {
        chats: Array.from(session.chats.entries()),
        contactNames: Array.from(session.contactNames.entries()),
      };
      writeFileSync(cachePath(), JSON.stringify(data), "utf8");
    } catch (err) {
      log("save failed:", (err as Error).message);
    }
  }, 1500);
}

/**
 * Run once per process: if auth files exist on disk, auto-resume the
 * WhatsApp session immediately so the user doesn't have to click Link.
 * Also runs on import — so as soon as any API route loads this module,
 * the connection starts coming up in the background.
 */
export function autoResumeIfAuthed() {
  const session = getSession();
  if (session.autoResumeAttempted) return;
  session.autoResumeAttempted = true;

  void (async () => {
    try {
      const { access } = await import("node:fs/promises");
      await access(join(authDir(), "creds.json"));
      // Hydrate the parsed-message cache from disk first so the picker has
      // data immediately, even before the WhatsApp socket reconnects.
      const cached = loadCacheFromDisk();
      if (cached.messages > 0) {
        log(
          `auto-resume: hydrated ${cached.messages} msgs across ${cached.chats} chats from cache`,
        );
        pushEvent(`hydrated ${cached.messages} cached msgs`);
        const session = getSession();
        session.status = "ready";
      }
      log("auto-resume: saved creds detected, kicking off session");
      pushEvent("auto-resume from saved creds");
      initWhatsAppSession().catch((err) => {
        log("auto-resume failed:", (err as Error).message);
      });
    } catch {
      log("auto-resume: no saved creds, waiting for user to link");
    }
  })();
}

// Kick off auto-resume the moment this module is imported.
autoResumeIfAuthed();

function authDir(): string {
  return process.env.ROOTS_WA_AUTH_DIR ?? join(homedir(), ".roots/wa-auth");
}

function pushEvent(msg: string) {
  const session = getSession();
  session.events.push({ at: new Date().toISOString(), msg });
  if (session.events.length > 200) session.events.shift();
  log(`event: ${msg}`);
}

/** No hard cap — exponential backoff (1.5s → 60s) until success. */
const MAX_BACKOFF_MS = 60_000;

/**
 * Idempotent initializer. Calling again while already in-flight returns the
 * existing promise. Calling after a previous error/close starts a fresh one.
 */
export async function initWhatsAppSession(): Promise<void> {
  const session = getSession();

  // Already running — short-circuit
  if (
    session.sock &&
    (session.status === "qr" ||
      session.status === "linking" ||
      session.status === "syncing" ||
      session.status === "ready")
  ) {
    return;
  }

  if (session.initPromise) return session.initPromise;

  session.initPromise = doInit().catch((err) => {
    session.status = "error";
    session.error = err instanceof Error ? err.message : String(err);
    pushEvent(`error: ${session.error}`);
    session.initPromise = null;
    throw err;
  });
  return session.initPromise;
}

async function doInit(): Promise<void> {
  const session = getSession();
  mkdirSync(authDir(), { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authDir());
  const isAuthenticated = Boolean(state.creds.me);

  log(`init begin · authenticated=${isAuthenticated} · authDir=${authDir()}`);

  // Don't downgrade status if we already have hydrated data — the picker
  // should keep working while the socket reconnects in the background.
  const hadData = session.historyCount > 0;
  if (!hadData) {
    session.status = isAuthenticated ? "linking" : "qr";
  }
  session.error = null;
  pushEvent(isAuthenticated ? "resuming session" : "awaiting QR scan");

  // Make sure any stale socket is torn down before starting a new one
  if (session.sock) {
    log("tearing down stale socket before reconnect");
    try {
      session.sock.end(undefined);
    } catch {
      /* best-effort */
    }
    session.sock = null;
  }

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["Roots", "Chrome", "1.0.0"],
    syncFullHistory: true,
    // markOnlineOnConnect: true was making the phone see us as "online" and
    // therefore push live messages to us via the multi-device protocol.
    // Without this, the phone deprioritizes our socket and messages.upsert
    // never fires. Verified by 90s of no events with it set to false.
    markOnlineOnConnect: true,
    logger: silentLogger() as never,
  });

  session.sock = sock;
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect, isNewLogin, receivedPendingNotifications } =
      update;
    log(
      `connection.update · connection=${connection ?? "—"} · qr=${qr ? "yes" : "no"} · isNewLogin=${isNewLogin ?? "—"} · receivedPending=${receivedPendingNotifications ?? "—"}`,
    );

    if (qr) {
      session.qrDataUrl = await QRCode.toDataURL(qr, {
        margin: 1,
        width: 280,
        color: { dark: "#1c2826", light: "#fdf8e8" },
      });
      session.status = "qr";
      pushEvent("QR refreshed");
    }

    if (connection === "open") {
      session.qrDataUrl = null;
      session.status = session.historyCount > 0 ? "ready" : "syncing";
      session.reconnectAttempts = 0;
      pushEvent(session.historyCount > 0 ? "connected (cache hydrated)" : "connected, syncing");
      // Explicit presence — tell the phone we're available so it pushes
      // live messages to this device aggressively.
      try {
        await sock.sendPresenceUpdate("available");
        log("sent presence: available");
      } catch (err) {
        log("sendPresenceUpdate failed:", (err as Error).message);
      }
    }

    if (connection === "close") {
      const err = lastDisconnect?.error as Error & { output?: { statusCode?: number } } | undefined;
      const reason = err?.message ?? "closed";
      const statusCode = err?.output?.statusCode;
      pushEvent(`closed: ${reason}`);

      // Hard-stop conditions — DO NOT auto-reconnect
      const isLoggedOut = statusCode === 401 || /logged out|loggedOut/i.test(reason);
      const isConflict = /conflict|stream errored \(conflict\)/i.test(reason);

      if (isLoggedOut) {
        session.status = "error";
        session.error =
          "WhatsApp logged us out. Unlink Roots from your phone (Linked Devices) and try again.";
        session.sock = null;
        session.initPromise = null;
        return;
      }

      if (isConflict) {
        session.reconnectAttempts++;
        session.sock = null;
        session.initPromise = null;

        // After 4 consecutive conflicts, stop trying — there's a server-side
        // phantom session we can't beat. Tell the user.
        if (session.reconnectAttempts >= 4) {
          pushEvent(
            `gave up after ${session.reconnectAttempts} conflicts — server-side phantom session`,
          );
          if (session.historyCount > 0) {
            session.status = "ready";
            session.error =
              "Live updates paused — another WhatsApp session keeps replacing us. Cached data still works. To fix: log out + re-install WhatsApp on phone.";
          } else {
            session.status = "error";
            session.error =
              "Server-side phantom WhatsApp session keeps replacing us. Logout + reinstall WhatsApp on phone to clear.";
          }
          return;
        }

        const delay = 30_000 * session.reconnectAttempts;
        pushEvent(`conflict — retry in ${delay / 1000}s (try ${session.reconnectAttempts}/3)`);
        // Keep status as the LAST KNOWN good state if we already have data.
        if (session.historyCount === 0) {
          session.status = "error";
          session.error =
            "WhatsApp says another device is using this session. Close other WhatsApp Web tabs, or unlink Roots from your phone's Linked Devices.";
        } else {
          // Already have history — pretend we're still ready while
          // reconnecting in the background. The user can keep using the app.
          session.status = "ready";
        }
        if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
        session.reconnectTimer = setTimeout(() => {
          session.reconnectTimer = null;
          initWhatsAppSession().catch(() => {});
        }, delay);
        return;
      }

      // Soft-failure — exponential backoff, never give up
      session.reconnectAttempts++;
      session.sock = null;
      session.initPromise = null;
      const delay = Math.min(
        MAX_BACKOFF_MS,
        Math.round(1500 * Math.pow(1.6, session.reconnectAttempts - 1)),
      );
      pushEvent(`reconnecting in ${(delay / 1000).toFixed(1)}s (try ${session.reconnectAttempts})`);

      // Don't move status to "error" — keep "linking" so polling shows progress.
      // If we've never been ready before, fall back to "qr" / "linking" handling.
      if (session.status !== "ready") {
        session.status = "linking";
      }

      if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
      session.reconnectTimer = setTimeout(() => {
        session.reconnectTimer = null;
        initWhatsAppSession().catch(() => {});
      }, delay);
    }
  });

  sock.ev.on("messaging-history.set", ({ chats, contacts, messages, syncType, isLatest }) => {
    log(
      `messaging-history.set · syncType=${syncType ?? "—"} · isLatest=${isLatest ?? "—"} · chats=${chats.length} · contacts=${contacts.length} · messages=${messages.length}`,
    );
    pushEvent(`history: +${messages.length} msgs, ${chats.length} chats, ${contacts.length} contacts`);

    let nameAdds = 0;
    for (const c of contacts) {
      const name = c.name ?? c.notify ?? c.verifiedName;
      if (c.id && name) {
        session.contactNames.set(c.id, name);
        nameAdds++;
      }
    }
    log(`  + ${nameAdds} contact names indexed (total ${session.contactNames.size})`);

    let added = 0;
    let dedup = 0;
    let skippedGroup = 0;
    let skippedNoJid = 0;
    for (const m of messages) {
      if (addParsed(m)) added++;
      else {
        const jid = m.key.remoteJid;
        if (!jid) skippedNoJid++;
        else if (jid.endsWith("@g.us") || jid.endsWith("@broadcast")) skippedGroup++;
        else dedup++;
      }
    }
    log(
      `  + ${added} added · ${dedup} dedup · skipped ${skippedGroup} group/broadcast · skipped ${skippedNoJid} no-jid`,
    );

    session.historyCount = totalMessageCount();
    log(
      `  state · historyCount=${session.historyCount} · chatsTracked=${session.chats.size}`,
    );
    if (session.historyCount > 0) {
      session.status = "ready";
      pushEvent("ready");
    }
    if (added > 0) scheduleSave();
  });

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    log(`messages.upsert · type=${type} · count=${messages.length}`);
    let added = 0;
    let dedup = 0;
    let skipped = 0;
    for (const m of messages) {
      if (addParsed(m)) added++;
      else {
        const jid = m.key.remoteJid;
        if (!jid || jid.endsWith("@g.us") || jid.endsWith("@broadcast")) skipped++;
        else dedup++;
      }
    }
    log(`  + ${added} added, ${dedup} dedup, ${skipped} skipped`);

    session.historyCount = totalMessageCount();
    if (session.historyCount > 0 && session.status !== "ready") {
      session.status = "ready";
      pushEvent("ready");
      log(`  → status flipped to ready`);
    }
    if (added > 0) scheduleSave();
  });

  sock.ev.on("chats.upsert", (chats) => {
    log(`chats.upsert · count=${chats.length}`);
  });

  sock.ev.on("contacts.upsert", (contacts) => {
    log(`contacts.upsert · count=${contacts.length}`);
    let added = 0;
    for (const c of contacts) {
      const name = c.name ?? c.notify ?? c.verifiedName;
      if (c.id && name) {
        session.contactNames.set(c.id, name);
        added++;
      }
    }
    if (added > 0) scheduleSave();
  });

  // Catch-all spy for any Baileys event we don't subscribe to.
  // Helps diagnose "why isn't messages.upsert firing" — at least we can see
  // if SOMETHING is coming in.
  sock.ev.process(async (events) => {
    const eventTypes = Object.keys(events);
    if (eventTypes.length > 0) {
      log(`event-bus · ${eventTypes.join(", ")}`);
    }
  });

  // Also log any presence/receipt activity — if these fire but messages don't,
  // the connection IS live but messages are being delivered elsewhere.
  sock.ev.on("presence.update", (p) => {
    log(`presence.update · ${p.id} → ${Object.keys(p.presences ?? {}).length} presences`);
  });

  sock.ev.on("message-receipt.update", (receipts) => {
    log(`message-receipt.update · ${receipts.length} receipts`);
  });
}

/**
 * Parse a Baileys WAMessage into our persisted form, dedup by key.id, and
 * insert into session.chats. Returns true if it was actually added.
 */
function addParsed(m: WAMessage): boolean {
  const session = getSession();
  const jid = m.key.remoteJid;
  if (!jid) return false;
  if (jid.endsWith("@g.us") || jid.endsWith("@broadcast")) return false;

  const text = extractMessageText(m);
  if (!text) return false;

  const arr = session.chats.get(jid) ?? [];
  const keyId = m.key.id ?? undefined;
  if (keyId && arr.some((x) => x.keyId === keyId)) return false;

  const ts =
    m.messageTimestamp != null
      ? new Date(Number(m.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString();

  arr.push({ at: ts, fromMe: Boolean(m.key.fromMe), text, keyId });
  session.chats.set(jid, arr);
  return true;
}

function totalMessageCount(): number {
  const session = getSession();
  let n = 0;
  for (const msgs of session.chats.values()) n += msgs.length;
  return n;
}

function log(...args: unknown[]) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[wa ${ts}]`, ...args);
}

export function getSessionState() {
  const session = getSession();
  // View-level override: if we have data, the picker is usable regardless of
  // whether the socket itself thinks it's still in "syncing" — Baileys often
  // doesn't fire the events that flip it to "ready" on resume.
  const reported =
    session.historyCount > 0 &&
    (session.status === "syncing" || session.status === "linking")
      ? "ready"
      : session.status;

  return {
    status: reported,
    qrDataUrl: session.qrDataUrl,
    error: session.error,
    historyCount: session.historyCount,
    events: session.events.slice(-10),
    chatsTracked: session.chats.size,
  };
}

/** Verbose snapshot for debugging. */
export function getDebugSnapshot() {
  const session = getSession();
  const perChat: Array<{ jid: string; name: string; count: number; lastAt?: string }> = [];
  for (const [jid, msgs] of session.chats) {
    const last = msgs[msgs.length - 1];
    perChat.push({
      jid,
      name: session.contactNames.get(jid) ?? "(no name)",
      count: msgs.length,
      lastAt: last?.at,
    });
  }
  perChat.sort((a, b) => b.count - a.count);
  return {
    status: session.status,
    error: session.error,
    historyCount: session.historyCount,
    chatsTracked: session.chats.size,
    contactNamesIndexed: session.contactNames.size,
    reconnectAttempts: session.reconnectAttempts,
    sockExists: Boolean(session.sock),
    events: session.events,
    perChat: perChat.slice(0, 20),
    authDir: authDir(),
  };
}

export interface WAChatSummary {
  jid: string;
  phone: string;
  name: string;
  messageCount: number;
  lastAt?: string;
}

export function listLinkedChats(limit = 30): WAChatSummary[] {
  const session = getSession();
  const summaries: WAChatSummary[] = [];
  for (const [jid, msgs] of session.chats) {
    if (!jid.endsWith("@s.whatsapp.net")) continue;
    if (msgs.length === 0) continue;
    const phone = jid.replace(/@s\.whatsapp\.net$/, "");
    const name = session.contactNames.get(jid) ?? phone;
    const last = msgs[msgs.length - 1];
    summaries.push({
      jid,
      phone,
      name,
      messageCount: msgs.length,
      lastAt: last?.at,
    });
  }
  return summaries
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, limit);
}

export function readLinkedChat(
  jid: string,
  contactName: string,
): {
  contactName: string;
  messageCount: number;
  messages: Array<{ at: string; from: string; fromMe: boolean; text: string }>;
  firstAt?: string;
  lastAt?: string;
} {
  const session = getSession();
  const raw = session.chats.get(jid) ?? [];
  const messages = raw
    .map((m) => ({
      at: m.at,
      from: m.fromMe ? "You" : contactName,
      fromMe: m.fromMe,
      text: m.text,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));

  return {
    contactName,
    messageCount: messages.length,
    messages,
    firstAt: messages[0]?.at,
    lastAt: messages[messages.length - 1]?.at,
  };
}

function extractMessageText(m: WAMessage): string {
  const msg = m.message;
  if (!msg) return "";
  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return `[image] ${msg.imageMessage.caption}`;
  if (msg.videoMessage?.caption) return `[video] ${msg.videoMessage.caption}`;
  if (msg.audioMessage) return "[voice note]";
  if (msg.stickerMessage) return "[sticker]";
  if (msg.documentMessage) return `[document] ${msg.documentMessage.fileName ?? ""}`;
  return "";
}

function silentLogger() {
  // We're in debug mode — print Baileys' info/warn/error to console with prefix.
  // Trace/debug are still skipped to avoid drowning the dev log.
  const ts = () => new Date().toISOString().slice(11, 23);
  const make = (level: string, write: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      const [first, ...rest] = args;
      // Baileys passes either (msg) or (obj, msg)
      if (typeof first === "string") {
        write(`[baileys ${ts()}] ${level}:`, first, ...rest);
      } else {
        write(`[baileys ${ts()}] ${level}:`, rest[0] ?? "", first);
      }
    };
  const noop = () => {};
  const out: Record<string, unknown> = {
    level: "info",
    child: () => out,
    trace: noop,
    debug: noop,
    info: make("info", console.log.bind(console)),
    warn: make("warn", console.warn.bind(console)),
    error: make("error", console.error.bind(console)),
    fatal: make("fatal", console.error.bind(console)),
  };
  return out;
}

/**
 * Tear down the current socket but KEEP auth + cache. Used when changing
 * socket options (e.g., markOnlineOnConnect) — the next init creates a
 * new socket with fresh options.
 */
export async function softRestartSession(): Promise<void> {
  const session = getSession();
  log("soft-restart: closing socket, keeping auth + cache");
  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = null;
  }
  if (session.sock) {
    try {
      session.sock.end(undefined);
    } catch {
      /* best-effort */
    }
  }
  session.sock = null;
  session.initPromise = null;
  session.reconnectAttempts = 0;
  await initWhatsAppSession();
}

/**
 * Forcefully tears down the current session AND deletes auth state.
 * After this, the next initWhatsAppSession() will require a new QR scan.
 */
export async function unlinkSession(): Promise<void> {
  const session = getSession();
  if (session.sock) {
    try {
      await session.sock.logout("user requested unlink");
    } catch {
      try {
        session.sock.end(undefined);
      } catch {
        /* best-effort */
      }
    }
  }

  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = null;
  }
  if (session.saveTimer) {
    clearTimeout(session.saveTimer);
    session.saveTimer = null;
  }
  session.sock = null;
  session.status = "idle";
  session.qrDataUrl = null;
  session.error = null;
  session.chats.clear();
  session.contactNames.clear();
  session.historyCount = 0;
  session.events = [];
  session.initPromise = null;
  session.reconnectAttempts = 0;
  session.autoResumeAttempted = false;

  // Wipe auth files so next attempt is a fresh scan
  try {
    const { rm } = await import("node:fs/promises");
    await rm(authDir(), { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}
