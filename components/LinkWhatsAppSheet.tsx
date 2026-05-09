"use client";

import type { Plant } from "@/lib/types";
import clsx from "clsx";
import {
  CheckCircle2,
  Link2,
  Loader2,
  MessageCircle,
  Search,
  Smartphone,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Status =
  | "idle"
  | "qr"
  | "linking"
  | "linked"
  | "syncing"
  | "ready"
  | "error";

interface SessionState {
  status: Status;
  qrDataUrl: string | null;
  error: string | null;
  historyCount: number;
  events: { at: string; msg: string }[];
  chatsTracked: number;
}

interface ChatPreview {
  jid: string;
  phone: string;
  name: string;
  messageCount: number;
  lastAt?: string;
}

/** Active poll only while transient — stops once linked/ready/error. */
const TRANSIENT_STATES: Status[] = ["idle", "qr", "linking", "linked", "syncing"];
/** Slow poll while ready — picks up live new-chat appearances. */
const READY_POLL_MS = 8_000;

export default function LinkWhatsAppSheet({
  open,
  onClose,
  onPlantsImported,
}: {
  open: boolean;
  onClose: () => void;
  onPlantsImported: (plants: Plant[]) => void;
}) {
  const [state, setState] = useState<SessionState | null>(null);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [filter, setFilter] = useState("");
  const [importingJid, setImportingJid] = useState<string | null>(null);
  const [recentlyImported, setRecentlyImported] = useState<string[]>([]);

  const start = useCallback(async () => {
    try {
      // Probe current state first — if a session is already alive, don't kick
      // off a new init. This makes browser-refresh paths instant: open the
      // sheet → straight to picker if linked.
      const probe = await fetch("/api/wa-link");
      const probeData = (await probe.json()) as SessionState;
      if (probeData.status === "ready" || probeData.status === "syncing") {
        setState(probeData);
        return;
      }
      // No active session — kick one off.
      const r = await fetch("/api/wa-link", { method: "POST" });
      const data = (await r.json()) as SessionState;
      setState(data);
    } catch (err) {
      setState({
        status: "error",
        qrDataUrl: null,
        error: (err as Error).message,
        historyCount: 0,
        events: [],
        chatsTracked: 0,
      });
    }
  }, []);

  // Kick off once when opened
  useEffect(() => {
    if (!open) return;
    start();
  }, [open, start]);

  // Poll while sheet is open. Fast (3s) while syncing, slow (8s) while ready
  // so we still pick up newly-tracked chats from live messages.upsert.
  useEffect(() => {
    if (!open) return;
    if (!state) return;
    if (state.status === "error") return;

    const fast = TRANSIENT_STATES.includes(state.status);
    const interval = setInterval(async () => {
      try {
        const r = await fetch("/api/wa-link");
        const data = (await r.json()) as SessionState;
        setState(data);
      } catch {
        /* ignore */
      }
    }, fast ? 3000 : READY_POLL_MS);
    return () => clearInterval(interval);
  }, [open, state?.status, state]);

  // Fetch chat list as soon as the session has any chats indexed —
  // don't wait for "ready" status, since picking is already useful.
  useEffect(() => {
    if (!state) return;
    if (state.chatsTracked === 0) return;
    fetch("/api/wa-sync")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.chats)) setChats(d.chats);
      })
      .catch(() => {});
  }, [state?.chatsTracked]);

  const importOne = async (jid: string, name: string) => {
    setImportingJid(jid);
    try {
      const r = await fetch("/api/wa-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jids: [jid] }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      onPlantsImported(data.imported);
      setRecentlyImported((rs) => [name, ...rs].slice(0, 5));
    } catch (err) {
      alert(`Failed to plant ${name}: ${(err as Error).message}`);
    } finally {
      setImportingJid(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/30 anim-pop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl"
      >
        <div className="absolute -inset-6 rounded-[3rem] blur-2xl opacity-50 pointer-events-none bg-gradient-to-br from-emerald-200/40 via-lime-200/30 to-amber-200/30" />

        <div className="relative bg-[var(--color-paper)] rounded-[2rem] surface-raised overflow-hidden">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 btn btn-ghost p-2 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 md:p-7">
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="w-4 h-4 text-emerald-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                Auto-link
              </span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-[var(--color-ink)] mb-1.5 tracking-tight">
              Link your WhatsApp
            </h2>
            <p className="text-sm text-[var(--color-ink-soft)] mb-5">
              Scan once. Then plant one contact at a time —{" "}
              <span className="font-semibold">no batch imports.</span> Stays on
              your machine.
            </p>

            {state?.status === "qr" ? (
              <QRView qrDataUrl={state.qrDataUrl} />
            ) : state?.status === "error" ? (
              <ErrorView error={state.error} onRetry={start} />
            ) : state && (state.status === "ready" || chats.length > 0) ? (
              <SingleContactPicker
                chats={chats}
                filter={filter}
                setFilter={setFilter}
                onPick={importOne}
                importingJid={importingJid}
                recentlyImported={recentlyImported}
                historyCount={state.historyCount}
                stillSyncing={state.status !== "ready"}
              />
            ) : state?.status === "linking" ||
              state?.status === "linked" ||
              state?.status === "syncing" ? (
              <Syncing state={state} />
            ) : (
              <Booting />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── SUB-VIEWS ─────────────── */

function Booting() {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-[var(--color-ink-muted)]">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">Starting WhatsApp session…</span>
    </div>
  );
}

function QRView({ qrDataUrl }: { qrDataUrl: string | null }) {
  return (
    <div className="flex flex-col items-center gap-4 py-3">
      <div className="rounded-2xl bg-white border-2 border-emerald-200/60 p-3">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="WhatsApp QR code"
            width={280}
            height={280}
            className="block"
          />
        ) : (
          <div className="w-[280px] h-[280px] flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-ink-muted)]" />
          </div>
        )}
      </div>
      <ol className="text-xs text-[var(--color-ink-soft)] space-y-1 list-decimal list-inside">
        <li>Open WhatsApp on your phone</li>
        <li>
          <strong>Settings → Linked Devices → Link a Device</strong>
        </li>
        <li>Scan the QR above</li>
      </ol>
    </div>
  );
}

function Syncing({ state }: { state: SessionState }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="relative">
        <Smartphone className="w-12 h-12 text-emerald-500" />
        <div className="absolute -inset-2 rounded-full border-2 border-emerald-300/40 animate-ping" />
      </div>
      <div>
        <div className="text-sm font-semibold text-[var(--color-ink)]">
          {state.status === "syncing"
            ? "Linked! Pulling history…"
            : "Connecting…"}
        </div>
        <div className="text-xs text-[var(--color-ink-muted)] mt-0.5 tabular-nums">
          {state.historyCount > 0
            ? `${state.historyCount.toLocaleString()} messages indexed across ${state.chatsTracked} chat${state.chatsTracked === 1 ? "" : "s"}`
            : "WhatsApp delivers history in waves — 30-60s."}
        </div>
      </div>
    </div>
  );
}

function SingleContactPicker({
  chats,
  filter,
  setFilter,
  onPick,
  importingJid,
  recentlyImported,
  historyCount,
  stillSyncing = false,
}: {
  chats: ChatPreview[];
  filter: string;
  setFilter: (s: string) => void;
  onPick: (jid: string, name: string) => void;
  importingJid: string | null;
  recentlyImported: string[];
  historyCount: number;
  stillSyncing?: boolean;
}) {
  const filtered = filter.trim()
    ? chats.filter((c) =>
        (c.name + " " + c.phone)
          .toLowerCase()
          .includes(filter.trim().toLowerCase()),
      )
    : chats;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 inline-flex items-center gap-1.5">
          {chats.length} linked · {historyCount.toLocaleString()} msgs
          {stillSyncing && (
            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              syncing more
            </span>
          )}
        </span>
        {recentlyImported.length > 0 && (
          <span className="text-[11px] text-emerald-700/80">
            ✓ planted: {recentlyImported.slice(0, 3).join(", ")}
            {recentlyImported.length > 3 && ` + ${recentlyImported.length - 3}`}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-muted)]" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search by name or number…"
          className="w-full pl-10 pr-3 py-2.5 rounded-2xl border-2 border-black/8 bg-white/70 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)]/70 focus:border-emerald-300 focus:bg-white focus:outline-none transition-all"
        />
      </div>

      {/* List — click any one row to import that one */}
      <div className="max-h-72 overflow-y-auto rounded-2xl border border-black/8 bg-white/60">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--color-ink-muted)]">
            {chats.length === 0
              ? "Still pulling history — give it a moment."
              : `No matches for "${filter}".`}
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {filtered.map((c) => {
              const importing = importingJid === c.jid;
              const isImported = recentlyImported.includes(c.name);
              return (
                <li key={c.jid}>
                  <button
                    onClick={() => !importing && !isImported && onPick(c.jid, c.name)}
                    disabled={importing || isImported}
                    className={clsx(
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                      isImported && "bg-emerald-50/70 cursor-default",
                      !isImported && !importing && "hover:bg-emerald-50/40",
                      importing && "bg-emerald-50/40",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--color-ink)] truncate">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-[var(--color-ink-muted)] tabular-nums">
                        {c.messageCount} msgs
                        {c.lastAt && (
                          <>
                            {" · "}
                            {new Date(c.lastAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </>
                        )}
                      </div>
                    </div>
                    {isImported ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100 flex-shrink-0" />
                    ) : importing ? (
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-500 flex-shrink-0" />
                    ) : (
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 px-2 py-1 rounded-full bg-emerald-50 group-hover:bg-emerald-100 flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        Plant
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-center text-[11px] text-[var(--color-ink-muted)] italic">
        Click a contact to plant just that one. Modal stays open — keep going.
      </p>
    </div>
  );
}

function ErrorView({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  const [unlinking, setUnlinking] = useState(false);

  const unlinkAndRetry = async () => {
    setUnlinking(true);
    try {
      await fetch("/api/wa-unlink", { method: "POST" });
    } catch {
      /* best-effort */
    }
    setUnlinking(false);
    onRetry();
  };

  return (
    <div className="flex flex-col items-stretch gap-3 py-4">
      <div className="rounded-2xl bg-rose-50 border border-rose-200/70 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 mb-1">
          Connection issue
        </div>
        <div className="text-sm text-rose-900 leading-snug">
          {error ?? "Something went wrong"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onRetry}
          disabled={unlinking}
          className="btn btn-secondary text-sm py-2.5"
        >
          Retry
        </button>
        <button
          onClick={unlinkAndRetry}
          disabled={unlinking}
          className="btn btn-primary text-sm py-2.5"
        >
          {unlinking ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Unlinking…</span>
            </>
          ) : (
            <span>Unlink &amp; start fresh</span>
          )}
        </button>
      </div>

      <p className="text-[11px] text-[var(--color-ink-muted)] italic text-center">
        &quot;Unlink &amp; start fresh&quot; clears the cached auth and shows a new QR.
        Also revoke any old &quot;Roots&quot; entries from your phone&apos;s Linked Devices.
      </p>
    </div>
  );
}
