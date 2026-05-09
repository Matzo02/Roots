import type { A2UINode } from "./a2ui";

export type PlantState =
  | "sapling"
  | "healthy"
  | "mature"
  | "wilting"
  | "ready"
  | "dying";

export type Channel = "whatsapp" | "imessage" | "call";

export interface Plant {
  id: string;
  name: string;
  handle?: string;
  phone?: string;
  /** WhatsApp JID — when present, we read the LATEST messages from the
   *  live Baileys cache instead of the snapshot taken at import time. */
  jid?: string;
  state: PlantState;
  daysSinceLastMessage: number;
  lastMessageWasFromThem: boolean;
  /** One-line agent observation: why this person is showing as this state */
  context: string;
  /** Concrete things to react to or ask about. Never message drafts. */
  talkingPoints?: string[];
  /**
   * Rich agent-rendered observation surface (A2UI tree).
   * When present, the modal renders this instead of the default
   * context+talking-points layout. The agent chooses the shape.
   */
  surface?: A2UINode;
  /** Last few messages from the cached chat — shown in the modal */
  recentMessages?: Array<{
    at: string;
    fromMe: boolean;
    text: string;
  }>;
  channel: Channel;
  warmth: number;
}

export interface PlayerState {
  level: number;
  xp: number;
  xpToNext: number;
  streakDays: number;
  energy: number;
  energyMax: number;
}

export type Action = "water" | "voice" | "reply" | "prune";
