"use client";

/**
 * Renders an A2UI tree as native React components.
 *
 * The agent ships JSON; this file translates JSON → JSX. The agent never
 * ships executable code. Each component type maps to a styled, on-brand
 * Roots widget.
 */

import type {
  A2UIActionButton,
  A2UIBadge,
  A2UIBulletList,
  A2UICallout,
  A2UICard,
  A2UICountdown,
  A2UIDivider,
  A2UIHeading,
  A2UILinkCard,
  A2UIMiniTimeline,
  A2UINode,
  A2UIQuote,
  A2UIRow,
  A2UIStack,
  A2UIText,
} from "@/lib/a2ui";
import type { Action } from "@/lib/types";
import clsx from "clsx";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Info,
  Quote,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

/* ─────────────── TONE / SPACING TOKENS ─────────────── */

const TONE_BG: Record<NonNullable<A2UICallout["tone"]>, string> = {
  warm:
    "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/70 text-amber-900",
  warning:
    "bg-gradient-to-br from-rose-50 to-amber-50 border-rose-200/70 text-rose-900",
  info: "bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200/70 text-sky-900",
  success:
    "bg-gradient-to-br from-emerald-50 to-lime-50 border-emerald-200/70 text-emerald-900",
};

const TONE_BADGE: Record<NonNullable<A2UIBadge["tone"]>, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  warm: "bg-amber-100 text-amber-800 border-amber-200",
  warning: "bg-rose-100 text-rose-800 border-rose-200",
  info: "bg-sky-100 text-sky-800 border-sky-200",
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const SPACING: Record<NonNullable<A2UIStack["spacing"]>, string> = {
  tight: "gap-1",
  normal: "gap-3",
  loose: "gap-5",
};

const TONE_ICON: Record<NonNullable<A2UICallout["tone"]>, React.ElementType> = {
  warm: Sparkles,
  warning: AlertTriangle,
  info: Info,
  success: Check,
};

/* ─────────────── ROOT RENDERER ─────────────── */

export default function A2UIRenderer({
  surface,
  onAction,
}: {
  surface: A2UINode | null | undefined;
  onAction?: (action: Action) => void;
}) {
  if (!surface) return null;
  return <Node node={surface} onAction={onAction} />;
}

function Node({
  node,
  onAction,
}: {
  node: A2UINode;
  onAction?: (action: Action) => void;
}) {
  switch (node.type) {
    case "text":
      return <TextNode node={node} />;
    case "heading":
      return <HeadingNode node={node} />;
    case "badge":
      return <BadgeNode node={node} />;
    case "divider":
      return <DividerNode node={node} />;
    case "stack":
      return <StackNode node={node} onAction={onAction} />;
    case "row":
      return <RowNode node={node} onAction={onAction} />;
    case "card":
      return <CardNode node={node} onAction={onAction} />;
    case "callout":
      return <CalloutNode node={node} />;
    case "quote":
      return <QuoteNode node={node} />;
    case "bullet_list":
      return <BulletListNode node={node} />;
    case "link_card":
      return <LinkCardNode node={node} />;
    case "countdown":
      return <CountdownNode node={node} />;
    case "mini_timeline":
      return <MiniTimelineNode node={node} />;
    case "action_button":
      return <ActionButtonNode node={node} onAction={onAction} />;
    default:
      return null;
  }
}

/* ─────────────── ATOMS ─────────────── */

function TextNode({ node }: { node: A2UIText }) {
  if (!node.body) return null;
  const cls =
    node.emphasis === "muted"
      ? "text-[14px] text-[var(--color-ink-muted)]"
      : node.emphasis === "strong"
        ? "text-[15px] font-semibold text-[var(--color-ink)]"
        : "text-[15px] leading-relaxed text-[var(--color-ink-soft)]";
  return <p className={cls}>{node.body}</p>;
}

function HeadingNode({ node }: { node: A2UIHeading }) {
  if (!node.body) return null;
  const level = node.level ?? 2;
  const cls =
    level === 1
      ? "font-display text-2xl md:text-3xl font-semibold text-[var(--color-ink)] tracking-tight"
      : level === 2
        ? "font-display text-xl font-semibold text-[var(--color-ink)] tracking-tight"
        : "text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]";
  if (level === 1) return <h1 className={cls}>{node.body}</h1>;
  if (level === 2) return <h2 className={cls}>{node.body}</h2>;
  return <h3 className={cls}>{node.body}</h3>;
}

function BadgeNode({ node }: { node: A2UIBadge }) {
  if (!node.body) return null;
  const tone = node.tone ?? "neutral";
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
        TONE_BADGE[tone],
      )}
    >
      {node.body}
    </span>
  );
}

function DividerNode({ node: _ }: { node: A2UIDivider }) {
  return <hr className="border-t border-black/8 my-1" />;
}

/* ─────────────── CONTAINERS ─────────────── */

function StackNode({
  node,
  onAction,
}: {
  node: A2UIStack;
  onAction?: (action: Action) => void;
}) {
  const children = node.children ?? [];
  return (
    <div className={clsx("flex flex-col", SPACING[node.spacing ?? "normal"])}>
      {children.map((child, i) => (
        <Node key={i} node={child} onAction={onAction} />
      ))}
    </div>
  );
}

function RowNode({
  node,
  onAction,
}: {
  node: A2UIRow;
  onAction?: (action: Action) => void;
}) {
  const children = node.children ?? [];
  const align =
    node.align === "between"
      ? "justify-between items-center"
      : node.align === "center"
        ? "justify-center items-center"
        : "items-center";
  return (
    <div className={clsx("flex flex-wrap", align, SPACING[node.spacing ?? "normal"])}>
      {children.map((child, i) => (
        <Node key={i} node={child} onAction={onAction} />
      ))}
    </div>
  );
}

function CardNode({
  node,
  onAction,
}: {
  node: A2UICard;
  onAction?: (action: Action) => void;
}) {
  const tone = node.tone;
  const calloutTone =
    tone === "warm" || tone === "warning" || tone === "info" || tone === "success"
      ? tone
      : null;
  return (
    <div
      className={clsx(
        "rounded-2xl border p-4",
        calloutTone ? TONE_BG[calloutTone] : "bg-white/70 border-black/8",
      )}
    >
      <div className="flex flex-col gap-2.5">
        {node.children.map((child, i) => (
          <Node key={i} node={child} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

/* ─────────────── CONTENT ─────────────── */

function CalloutNode({ node }: { node: A2UICallout }) {
  if (!node.body) return null;
  const tone = node.tone ?? "warm";
  const Icon = TONE_ICON[tone];
  return (
    <div
      className={clsx(
        "rounded-2xl border px-4 py-3 flex items-start gap-3",
        TONE_BG[tone],
      )}
    >
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-80" />
      <div className="flex-1 min-w-0">
        {node.label && (
          <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-0.5">
            {node.label}
          </div>
        )}
        <div className="text-[14px] font-medium leading-snug">
          {node.body}
        </div>
      </div>
    </div>
  );
}

function QuoteNode({ node }: { node: A2UIQuote }) {
  if (!node.body) return null; // agent sometimes omits body — bail rather than crash
  const when = node.at ? formatRelative(node.at) : null;
  return (
    <div className="relative rounded-2xl bg-white/80 border border-black/8 px-4 py-3 pl-10">
      <Quote className="absolute top-3 left-3 w-4 h-4 text-[var(--color-ink-muted)]" />
      <p className="text-[14.5px] leading-snug text-[var(--color-ink-soft)] italic">
        {smartQuote(node.body)}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--color-ink-muted)]">
        {node.from && (
          <span className="font-semibold text-[var(--color-ink)]">{node.from}</span>
        )}
        {when && <span>· {when}</span>}
      </div>
    </div>
  );
}

function BulletListNode({ node }: { node: A2UIBulletList }) {
  const items = (node.items ?? []).filter((s): s is string => Boolean(s));
  if (items.length === 0) return null;
  const marker = node.marker ?? "dot";
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex gap-2 text-[14px] leading-snug text-[var(--color-ink-soft)]"
        >
          <span className="text-emerald-500 flex-shrink-0 mt-0.5 select-none">
            {marker === "check" ? "✓" : marker === "dash" ? "—" : "●"}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function LinkCardNode({ node }: { node: A2UILinkCard }) {
  if (!node.url) return null;
  const host =
    node.source ??
    (() => {
      try {
        return new URL(node.url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })();

  return (
    <a
      href={node.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-black/8 bg-white/80 p-3.5 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group"
    >
      {host && (
        <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-medium text-[var(--color-ink-muted)] uppercase tracking-wider">
          <ExternalLink className="w-3 h-3" />
          {host}
        </div>
      )}
      <div className="text-[14px] font-semibold text-[var(--color-ink)] group-hover:text-emerald-800 leading-snug">
        {node.title}
      </div>
      {node.description && (
        <div className="text-[13px] text-[var(--color-ink-muted)] mt-1 leading-snug">
          {node.description}
        </div>
      )}
    </a>
  );
}

function CountdownNode({ node }: { node: A2UICountdown }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!node.targetAt) return null;
  const target = new Date(node.targetAt).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - now;
  const days = Math.ceil(diffMs / 86_400_000);
  const past = diffMs < 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-200/70 px-4 py-3 flex items-center gap-4">
      <div className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 text-white shadow-sm">
        <span className="text-2xl font-bold leading-none">
          {past ? "·" : Math.abs(days)}
        </span>
        <span className="text-[9px] uppercase tracking-wider opacity-90">
          {past ? "today" : "days"}
        </span>
      </div>
      <div className="flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
          {past ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}
        </div>
        <div className="text-[15px] font-semibold text-[var(--color-ink)] leading-snug mt-0.5">
          {node.label}
        </div>
      </div>
    </div>
  );
}

function MiniTimelineNode({ node }: { node: A2UIMiniTimeline }) {
  const events = node.events ?? [];
  if (events.length === 0) return null;
  return (
    <div className="rounded-2xl bg-white/80 border border-black/8 p-4">
      <ul className="space-y-3">
        {events.map((event, i) => (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-100" />
              {i < node.events.length - 1 && (
                <div className="w-px flex-1 bg-emerald-100 mt-1" />
              )}
            </div>
            <div className="flex-1 pb-1">
              <div className="text-[11px] text-[var(--color-ink-muted)] font-medium uppercase tracking-wider">
                {formatRelative(event.at)}
              </div>
              <div className="text-[14px] text-[var(--color-ink)] leading-snug">
                {event.label}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────── INTERACTIVE ─────────────── */

function ActionButtonNode({
  node,
  onAction,
}: {
  node: A2UIActionButton;
  onAction?: (action: Action) => void;
}) {
  const variant = node.variant ?? "primary";
  return (
    <button
      onClick={() => onAction?.(node.action)}
      className={clsx(
        "btn text-sm px-4 py-2.5",
        variant === "primary" && "btn-primary",
        variant === "secondary" && "btn-secondary",
        variant === "destructive" &&
          "bg-rose-50 text-rose-700 border-2 border-rose-200/60 hover:bg-rose-100",
      )}
    >
      {node.body}
    </button>
  );
}

/* ─────────────── HELPERS ─────────────── */

function smartQuote(s: string | undefined | null): string {
  if (!s) return "";
  // Wrap in curly quotes if not already present
  if (s.startsWith('"') || s.startsWith("'") || s.startsWith("“")) return s;
  return `“${s}”`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return d.toISOString().slice(0, 10);
}
