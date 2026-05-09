import type { Plant, PlayerState } from "./types";

export const MOCK_PLAYER: PlayerState = {
  level: 3,
  xp: 47,
  xpToNext: 100,
  streakDays: 7,
  energy: 3,
  energyMax: 3,
};

export const MOCK_PLANTS: Plant[] = [
  {
    id: "p1",
    name: "Anjali",
    handle: "@anjali_codes",
    phone: "919876543210",
    state: "ready",
    daysSinceLastMessage: 3,
    lastMessageWasFromThem: true,
    context: "Posted about landing the PM role 3 days ago. Hasn't heard back from you.",
    talkingPoints: [
      "Ask which company / which team it is",
      "Ask how the interview loop went",
      "Mention you saw it — don't make her bring it up first",
    ],
    channel: "whatsapp",
    warmth: 78,
  },
  {
    id: "p2",
    name: "Dad",
    phone: "919812340000",
    state: "wilting",
    daysSinceLastMessage: 11,
    lastMessageWasFromThem: false,
    context: "Hasn't been a real conversation in 11 days. Last few were logistics.",
    talkingPoints: [
      "Try a call instead of a text — he prefers voice",
      "Ask about his back / how he's been feeling",
    ],
    channel: "call",
    warmth: 42,
  },
  {
    id: "p3",
    name: "Karan",
    handle: "@karandev",
    phone: "919900112233",
    state: "ready",
    daysSinceLastMessage: 1,
    lastMessageWasFromThem: true,
    context: "Asked you a question about your project last night. Still unanswered.",
    talkingPoints: [
      "Answer his question — agent loop is in lib/agent.ts",
      "Offer a 10-min call if he wants a walkthrough",
    ],
    channel: "whatsapp",
    warmth: 64,
  },
  {
    id: "p4",
    name: "Megha",
    handle: "@meghawrites",
    phone: "919811223344",
    state: "healthy",
    daysSinceLastMessage: 4,
    lastMessageWasFromThem: false,
    context: "Convo's flowing. No urgent move — just a healthy plant.",
    channel: "whatsapp",
    warmth: 71,
  },
  {
    id: "p5",
    name: "Rohan",
    phone: "919833445566",
    state: "dying",
    daysSinceLastMessage: 187,
    lastMessageWasFromThem: false,
    context: "Drifted. 6+ months, no warmth signal from socials either.",
    talkingPoints: [
      "Be honest if you reach out — don't pretend it's been less time",
    ],
    channel: "imessage",
    warmth: 8,
  },
  {
    id: "p6",
    name: "Sara",
    handle: "@sara.builds",
    phone: "919844556677",
    state: "wilting",
    daysSinceLastMessage: 9,
    lastMessageWasFromThem: false,
    context: "She liked your last post. Two-way warmth fading though.",
    talkingPoints: [
      "Mention her v2 ship — that empty-state animation",
      "Ask what's next for her project",
    ],
    channel: "whatsapp",
    warmth: 51,
  },
  {
    id: "p7",
    name: "Mom",
    phone: "919855667788",
    state: "healthy",
    daysSinceLastMessage: 2,
    lastMessageWasFromThem: true,
    context: "Daily check-ins. Sent you a recipe yesterday.",
    channel: "whatsapp",
    warmth: 92,
  },
  {
    id: "p8",
    name: "Vikram",
    handle: "@vikr",
    phone: "919866778899",
    state: "sapling",
    daysSinceLastMessage: 0,
    lastMessageWasFromThem: false,
    context: "Met at last AI Tinkerers. Just added — figure out if this becomes a friendship.",
    talkingPoints: [
      "Reference what you talked about there",
      "Send a thing he'd find — article, repo, anything",
    ],
    channel: "whatsapp",
    warmth: 30,
  },
  {
    id: "p9",
    name: "Priya",
    handle: "@priya.designs",
    phone: "919877889900",
    state: "mature",
    daysSinceLastMessage: 5,
    lastMessageWasFromThem: false,
    context: "Solid. Strong long-term thread — no action needed.",
    channel: "whatsapp",
    warmth: 84,
  },
  {
    id: "p10",
    name: "Aditya",
    phone: "919888990011",
    state: "dying",
    daysSinceLastMessage: 142,
    lastMessageWasFromThem: false,
    context: "Old college friend. Effort stopped being mutual a while ago.",
    channel: "imessage",
    warmth: 14,
  },
  {
    id: "p11",
    name: "Riya",
    handle: "@riyabuilds",
    phone: "919899001122",
    state: "ready",
    daysSinceLastMessage: 6,
    lastMessageWasFromThem: true,
    context: "Asked you for feedback on her landing page. You said ‘tomorrow.’ That was 6 days ago.",
    talkingPoints: [
      "Open her page right now — don't go in cold",
      "Lead with the apology, not an explanation",
      "Specific over kind — what'd you actually change?",
    ],
    channel: "whatsapp",
    warmth: 68,
  },
  {
    id: "p12",
    name: "Arjun",
    handle: "@arjun_co",
    phone: "919811220033",
    state: "wilting",
    daysSinceLastMessage: 14,
    lastMessageWasFromThem: false,
    context: "Used to talk weekly. Two weeks of silence now.",
    talkingPoints: ["No specific hook — just say hi, no script needed"],
    channel: "whatsapp",
    warmth: 47,
  },
];

export function plantStateLabel(state: Plant["state"]): string {
  switch (state) {
    case "sapling":
      return "NEW";
    case "healthy":
      return "HEALTHY";
    case "mature":
      return "MATURE";
    case "wilting":
      return "WILTING";
    case "ready":
      return "READY";
    case "dying":
      return "DYING";
  }
}

/** WhatsApp deep link — opens chat with phone selected, NO pre-filled text. */
export function buildWaMeUrl(phone: string): string {
  return `https://wa.me/${phone}`;
}

/** SMS deep link — opens Messages app with phone selected, NO body. */
export function buildSmsUrl(phone: string): string {
  return `sms:${phone}`;
}

/** tel: deep link for calls. */
export function buildCallUrl(phone: string): string {
  return `tel:+${phone}`;
}
