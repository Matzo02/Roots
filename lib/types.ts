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
  state: PlantState;
  daysSinceLastMessage: number;
  lastMessageWasFromThem: boolean;
  /** One-line agent observation: why this person is showing as this state */
  context: string;
  /** Optional bullet points the agent surfaced — concrete things to react to or ask about. Never message drafts. */
  talkingPoints?: string[];
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
