/**
 * A2UI — minimal subset of the Google A2UI v0.9 spec.
 *
 * Spec philosophy borrowed:
 *   - Declarative JSON, no executable code
 *   - Native widgets per type (agent never ships HTML/JS)
 *   - Tree of typed nodes
 *
 * For Roots we cover the ~12 component types that meaningfully expand
 * what the agent can express about a relationship without giving it
 * compose-arbitrary-text powers.
 */

import type { Action } from "./types";

/* ─────────────── ATOMS ─────────────── */

export interface A2UIText {
  type: "text";
  body: string;
  /** Visual weight: muted, default, strong */
  emphasis?: "muted" | "default" | "strong";
}

export interface A2UIHeading {
  type: "heading";
  body: string;
  level?: 1 | 2 | 3;
}

export interface A2UIBadge {
  type: "badge";
  body: string;
  tone?: "neutral" | "warm" | "warning" | "info" | "success";
}

export interface A2UIDivider {
  type: "divider";
}

/* ─────────────── CONTAINERS ─────────────── */

export interface A2UIStack {
  type: "stack";
  children: A2UINode[];
  /** Spacing token: tight (4px), normal (12px), loose (20px) */
  spacing?: "tight" | "normal" | "loose";
}

export interface A2UIRow {
  type: "row";
  children: A2UINode[];
  align?: "start" | "center" | "between";
  spacing?: "tight" | "normal" | "loose";
}

export interface A2UICard {
  type: "card";
  children: A2UINode[];
  tone?: "neutral" | "warm" | "warning" | "info" | "success";
}

/* ─────────────── CONTENT ─────────────── */

export interface A2UICallout {
  type: "callout";
  body: string;
  tone?: "warm" | "warning" | "info" | "success";
  /** Optional small label above the body */
  label?: string;
}

export interface A2UIQuote {
  type: "quote";
  body: string;
  /** Who said it */
  from: string;
  /** ISO timestamp */
  at?: string;
}

export interface A2UIBulletList {
  type: "bullet_list";
  items: string[];
  /** Visual style: dot, check, dash */
  marker?: "dot" | "check" | "dash";
}

export interface A2UILinkCard {
  type: "link_card";
  title: string;
  url: string;
  description?: string;
  /** Domain badge displayed (e.g. "linkedin.com") */
  source?: string;
}

export interface A2UICountdown {
  type: "countdown";
  /** ISO timestamp to count down to */
  targetAt: string;
  /** What's at the target ("Anjali's birthday") */
  label: string;
}

export interface A2UIMiniTimeline {
  type: "mini_timeline";
  events: { at: string; label: string }[];
}

/* ─────────────── INTERACTIVE ─────────────── */

export interface A2UIActionButton {
  type: "action_button";
  body: string;
  /** Fires the canonical Roots action against the current plant. */
  action: Action;
  variant?: "primary" | "secondary" | "destructive";
}

/* ─────────────── UNION ─────────────── */

export type A2UINode =
  | A2UIText
  | A2UIHeading
  | A2UIBadge
  | A2UIDivider
  | A2UIStack
  | A2UIRow
  | A2UICard
  | A2UICallout
  | A2UIQuote
  | A2UIBulletList
  | A2UILinkCard
  | A2UICountdown
  | A2UIMiniTimeline
  | A2UIActionButton;

/* ─────────────── HELPERS ─────────────── */

/** Build a deterministic A2UI fallback from `context` + `talkingPoints`. */
export function fallbackSurface(
  context: string,
  talkingPoints: string[],
): A2UINode {
  const children: A2UINode[] = [
    { type: "text", body: context, emphasis: "default" },
  ];
  if (talkingPoints.length > 0) {
    children.push({ type: "divider" });
    children.push({ type: "heading", body: "Things to react to", level: 3 });
    children.push({ type: "bullet_list", items: talkingPoints });
  }
  return { type: "stack", children, spacing: "normal" };
}

/** Loose runtime guard. Returns true if the value looks like an A2UI node. */
export function isA2UINode(v: unknown): v is A2UINode {
  return typeof v === "object" && v !== null && typeof (v as { type?: unknown }).type === "string";
}
