"use client";

import {
  buildCallUrl,
  buildSmsUrl,
  buildWaMeUrl,
  plantStateLabel,
} from "@/lib/mock-data";
import type { Action, Plant } from "@/lib/types";
import clsx from "clsx";
import {
  Eye,
  EyeOff,
  Heart,
  Loader2,
  MessageCircle,
  Mic,
  Phone,
  RefreshCw,
  Reply as ReplyIcon,
  Scissors,
  Sprout,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import A2UIRenderer from "./A2UIRenderer";
import PlantArt from "./PlantArt";

type ActionMeta = {
  key: Action;
  label: string;
  icon: typeof Phone;
  cost: number;
  xp: number;
  hint: string;
};

const ACTIONS: ActionMeta[] = [
  {
    key: "water",
    label: "Open chat",
    icon: MessageCircle,
    cost: 1,
    xp: 15,
    hint: "Type your own — no script",
  },
  {
    key: "voice",
    label: "Voice note",
    icon: Mic,
    cost: 2,
    xp: 30,
    hint: "Better than text — your actual voice",
  },
  {
    key: "reply",
    label: "Reply to post",
    icon: ReplyIcon,
    cost: 1,
    xp: 25,
    hint: "React to what they shared",
  },
  {
    key: "prune",
    label: "Let go",
    icon: Scissors,
    cost: 0,
    xp: 5,
    hint: "Mark as cooled, stop pinging",
  },
];

export default function PlantModal({
  plant,
  lastSyncedAt,
  onClose,
  onAction,
  onPlantUpdated,
  onPlantRemoved,
}: {
  plant: Plant | null;
  lastSyncedAt?: number | null;
  onClose: () => void;
  onAction: (plant: Plant, action: Action) => void;
  onPlantUpdated?: (plant: Plant) => void;
  onPlantRemoved?: (plantId: string) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [showMessages, setShowMessages] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("roots:showMessages") === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("roots:showMessages", showMessages ? "1" : "0");
  }, [showMessages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (plant) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [plant, onClose]);

  if (!plant) return null;

  const isReady = plant.state === "ready";
  const points = plant.talkingPoints ?? [];
  const recent = plant.recentMessages ?? [];

  const refreshObservation = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const r = await fetch("/api/observe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId: plant.id }),
      });
      const data = await r.json();
      if (r.ok && data.plant && onPlantUpdated) {
        onPlantUpdated({ ...data.plant, recentMessages: plant.recentMessages });
      } else if (!r.ok) {
        const msg: string = data.error ?? "agent unavailable";
        if (/quota|rate|429|RESOURCE_EXHAUSTED/i.test(msg)) {
          setRefreshError("Gemini quota — try later or enable billing");
        } else {
          setRefreshError("agent unavailable");
        }
        setTimeout(() => setRefreshError(null), 3500);
      }
    } catch {
      setRefreshError("agent unavailable");
      setTimeout(() => setRefreshError(null), 3500);
    } finally {
      setRefreshing(false);
    }
  };

  const removeFromGarden = async () => {
    if (!onPlantRemoved) return;
    if (!window.confirm(`Remove ${plant.name} from your garden? This deletes the plant and its cached chat — re-import to bring them back.`)) {
      return;
    }
    try {
      const r = await fetch(`/api/plants/${plant.id}`, { method: "DELETE" });
      if (r.ok) {
        onPlantRemoved(plant.id);
        onClose();
      }
    } catch {
      /* swallow */
    }
  };

  const handleAction = (action: Action) => {
    if (action === "reply" && !isReady) return;

    if (action !== "prune" && plant.phone) {
      let url: string;
      if (action === "voice" && plant.channel === "whatsapp") {
        url = buildWaMeUrl(plant.phone);
      } else if (action === "water" || action === "reply" || action === "voice") {
        url =
          plant.channel === "imessage"
            ? buildSmsUrl(plant.phone)
            : plant.channel === "call"
              ? buildCallUrl(plant.phone)
              : buildWaMeUrl(plant.phone);
      } else {
        url = buildWaMeUrl(plant.phone);
      }
      window.open(url, "_blank");
    }

    onAction(plant, action);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/30 anim-pop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl"
      >
        {/* Soft outer glow */}
        <div
          className={clsx(
            "absolute -inset-6 rounded-[3rem] blur-2xl opacity-50 pointer-events-none",
            isReady
              ? "bg-gradient-to-br from-amber-300/50 via-orange-200/40 to-rose-200/30"
              : "bg-gradient-to-br from-emerald-200/30 via-green-200/20 to-lime-200/20",
          )}
        />

        <div className="relative bg-[var(--color-paper)] rounded-[2rem] surface-raised overflow-hidden">
          {/* Decorative top band */}
          <div
            className={clsx(
              "absolute inset-x-0 top-0 h-32 pointer-events-none",
              isReady
                ? "bg-gradient-to-b from-amber-100/80 to-transparent"
                : "bg-gradient-to-b from-emerald-50/80 to-transparent",
            )}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 btn btn-ghost p-2 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative p-6 md:p-8">
            {/* Top: plant + identity */}
            <div className="flex items-start gap-5 mb-6">
              <div
                className={clsx(
                  "relative flex-shrink-0 rounded-3xl p-3",
                  isReady
                    ? "bg-gradient-to-br from-amber-100 to-orange-100"
                    : "bg-gradient-to-br from-emerald-50 to-green-100",
                )}
              >
                <div className={isReady ? "anim-glow" : "anim-float"}>
                  <PlantArt state={plant.state} size={120} />
                </div>
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-display text-3xl font-semibold text-[var(--color-ink)] tracking-tight">
                    {plant.name}
                  </h3>
                  <StateBadge state={plant.state} />
                </div>
                {plant.handle && (
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    {plant.handle}
                  </p>
                )}
              </div>
            </div>

            {/* Warmth meter */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-300" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Warmth
                  </span>
                </div>
                <span className="text-xs font-semibold text-[var(--color-ink)] tabular-nums">
                  {plant.warmth}/100
                </span>
              </div>
              <WarmthBar warmth={plant.warmth} />
            </div>

            {/* Agent observation — A2UI surface */}
            <div className="mb-5 rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/40 to-lime-50/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                    Agent observation
                  </span>
                  {onPlantUpdated && (
                    <button
                      onClick={refreshObservation}
                      disabled={refreshing}
                      title="Re-run agent on latest messages"
                      className="text-[10px] text-emerald-700 hover:text-emerald-900 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      {refreshing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      <span>
                        {refreshing
                          ? "thinking…"
                          : refreshError ?? "refresh"}
                      </span>
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-emerald-700/70 italic">
                  you bring the words
                </span>
              </div>
              <A2UIRenderer
                surface={
                  plant.surface ?? {
                    type: "stack",
                    spacing: "normal",
                    children: [
                      ...(plant.context
                        ? ([{ type: "text", body: plant.context } as const])
                        : []),
                      ...(points.length > 0
                        ? ([
                            {
                              type: "heading",
                              body: "Things to react to",
                              level: 3,
                            } as const,
                            { type: "bullet_list", items: points } as const,
                          ])
                        : []),
                    ],
                  }
                }
              />
            </div>

            {/* Recent messages — what's actually been said */}
            {recent.length > 0 && (
              <div className="mb-5 rounded-2xl border border-black/8 bg-white/60 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                      Recent messages
                    </span>
                    <button
                      onClick={() => setShowMessages((v) => !v)}
                      title={showMessages ? "Hide content" : "Show content"}
                      className="inline-flex items-center gap-1 text-[10px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors"
                    >
                      {showMessages ? (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>show</span>
                        </>
                      )}
                    </button>
                  </div>
                  <span className="text-[10px] text-[var(--color-ink-muted)]/80 tabular-nums inline-flex items-center gap-1.5">
                    {lastSyncedAt && (
                      <span
                        key={lastSyncedAt}
                        className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 anim-pulse-once"
                        title={`synced ${new Date(lastSyncedAt).toLocaleTimeString()}`}
                      />
                    )}
                    last {recent.length}{!showMessages && " · hidden"}
                  </span>
                </div>
                <ul className="space-y-2">
                  {recent.map((m, i) => (
                    <li
                      key={i}
                      className={clsx(
                        "flex gap-2.5",
                        m.fromMe ? "flex-row-reverse" : "",
                      )}
                    >
                      <span
                        className={clsx(
                          "px-3 py-1.5 rounded-2xl text-[13px] leading-snug max-w-[80%] transition-all duration-200",
                          m.fromMe
                            ? "bg-emerald-500/90 text-white rounded-br-sm"
                            : "bg-white border border-black/8 text-[var(--color-ink)] rounded-bl-sm",
                          !showMessages && "select-none",
                        )}
                        style={
                          !showMessages
                            ? {
                                filter: "blur(6px)",
                                WebkitFilter: "blur(6px)",
                              }
                            : undefined
                        }
                      >
                        {m.text}
                      </span>
                      <span className="text-[10px] text-[var(--color-ink-muted)] flex-shrink-0 self-end mb-1 tabular-nums">
                        {formatRelativeTime(m.at)}
                      </span>
                    </li>
                  ))}
                </ul>
                {!showMessages && (
                  <p className="mt-3 text-[11px] text-[var(--color-ink-muted)] italic text-center">
                    Content blurred for privacy. The agent already read these — you don&apos;t have to.
                  </p>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {ACTIONS.map((action) => {
                const disabled = action.key === "reply" && !isReady;
                const primary =
                  action.key === "water" ||
                  (plant.channel === "call" && action.key === "voice");
                const destructive = action.key === "prune";
                const Icon = action.icon;

                return (
                  <button
                    key={action.key}
                    onClick={() => handleAction(action.key)}
                    disabled={disabled}
                    className={clsx(
                      "group/btn relative flex flex-col items-center gap-1 px-3 py-3.5 rounded-2xl border-2 transition-all duration-200 text-center",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      "hover:-translate-y-0.5 active:translate-y-0",
                      primary &&
                        "bg-gradient-to-br from-emerald-400 to-green-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40",
                      !primary &&
                        !destructive &&
                        "bg-white border-black/8 text-[var(--color-ink)] hover:border-emerald-300 hover:bg-emerald-50/50",
                      destructive &&
                        "bg-white/60 border-rose-200/60 text-rose-600 hover:bg-rose-50",
                    )}
                  >
                    <Icon
                      className={clsx(
                        "w-5 h-5",
                        primary && "fill-white/30",
                      )}
                    />
                    <span className="text-[13px] font-semibold leading-tight">
                      {action.label}
                    </span>
                    <span className="text-[10px] opacity-70 leading-tight">
                      {action.cost > 0 ? `${action.cost} energy` : "free"} ·
                      +{action.xp} xp
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-center text-[11px] text-[var(--color-ink-muted)] italic">
              Roots opens the chat empty. Whatever you say, you say.
            </p>

            {onPlantRemoved && (
              <div className="mt-3 flex items-center justify-center">
                <button
                  onClick={removeFromGarden}
                  className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-ink-muted)] hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>remove from garden</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: Plant["state"] }) {
  const cls: Record<Plant["state"], string> = {
    sapling: "bg-lime-100 text-lime-800 border-lime-200",
    healthy: "bg-emerald-100 text-emerald-800 border-emerald-200",
    mature: "bg-green-100 text-green-800 border-green-200",
    wilting: "bg-yellow-100 text-yellow-800 border-yellow-200",
    ready:
      "bg-gradient-to-br from-amber-300 to-orange-400 text-white border-amber-400 shadow-sm",
    dying: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
        cls[state],
      )}
    >
      <Sprout className="w-2.5 h-2.5" />
      {plantStateLabel(state).toLowerCase()}
    </span>
  );
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function WarmthBar({ warmth }: { warmth: number }) {
  const fill =
    warmth > 65
      ? "from-emerald-300 to-emerald-500"
      : warmth > 35
        ? "from-amber-300 to-orange-400"
        : "from-slate-300 to-slate-400";

  return (
    <div className="relative h-3 rounded-full bg-black/5 overflow-hidden">
      <div
        className={clsx(
          "absolute inset-y-0 left-0 bg-gradient-to-r rounded-full transition-all duration-500",
          fill,
        )}
        style={{ width: `${warmth}%` }}
      />
      <div
        className="absolute inset-y-0 left-0 bg-gradient-to-b from-white/40 to-transparent rounded-full"
        style={{ width: `${warmth}%` }}
      />
    </div>
  );
}
