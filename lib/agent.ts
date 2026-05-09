/**
 * Gemini-powered agent that surfaces:
 *   - one-line context for a plant ("why this person matters today")
 *   - 1-3 talking points (concrete angles, not message drafts)
 *   - optional rich emphasis (a callout / quote / countdown / link card)
 *
 * Hard rule: agent NEVER drafts messages the user sends. Talking points are
 * angles, not pre-written text.
 *
 * The structured Gemini response is then composed into an A2UI surface (tree
 * of declarative nodes) which the frontend renders natively.
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { A2UINode } from "./a2ui";
import { fallbackSurface } from "./a2ui";
import type { ChatMessage, ChatSignals } from "./whatsapp-parser";

// gemini-2.5-flash-lite has its own per-model 20/day free-tier quota,
// so swapping here gives you a fresh bucket if -flash is exhausted.
// For higher limits, enable billing on the AI Studio project.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY not set. Copy .env.local.example to .env.local and add a key.",
    );
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

/* ─────────────── Structured agent output ─────────────── */

export type EmphasisType = "callout" | "quote" | "countdown" | "link" | "none";

export interface AgentObservation {
  context: string;
  talkingPoints: string[];
  emphasisType: EmphasisType;
  emphasisCallout?: {
    tone: "warm" | "warning" | "info" | "success";
    body: string;
    label?: string;
  };
  emphasisQuote?: { body: string; from: string; at?: string };
  emphasisCountdown?: { targetAt: string; label: string };
  emphasisLink?: { title: string; url: string; description?: string };
}

export interface AgentSurface extends AgentObservation {
  /** Composed A2UI tree — the renderable surface */
  surface: A2UINode;
}

const SYSTEM_PROMPT = `You are the agent inside Roots — a relationship-keeping app where each person in someone's life is represented as a plant in a garden.

Your role is to NOTICE — never to write messages.

Given a person's chat history with the user, surface:
1. context: A single observational sentence about the relationship's current state and what's notable RIGHT NOW (max ~25 words).
2. talkingPoints: 1-3 concrete "talking points" — things the user could react to, ask about, or remember. NEVER full message drafts.
3. emphasisType: ONE of "callout" | "quote" | "countdown" | "link" | "none". Pick ONLY when the situation truly warrants emphasis. Default to "none".

Talking points are *angles*, not text:
  ✓ "Ask about the trek — she posted from Manali"
  ✓ "Lead with apology, not explanation"
  ✓ "Voice note instead of text — better for distance"
Bad (drafts):
  ✗ "Send: 'Hey, how was the trek?'"
  ✗ "Tell her you miss her"

Emphasis rules — strongly prefer SOMETHING over "none". Default to picking an emphasis unless the relationship is genuinely uneventful:
- quote: USE THIS WHEN POSSIBLE. Pick a real, specific message from them in the recent chat that captures the most interesting/unanswered/notable thing they said. Use their actual text, truncated to one sentence. Quotes ground the user in the conversation.
- callout: when there's an attention-grabbing fact (e.g., "you said 'tomorrow' 6 days ago", "they've messaged 3x without a reply", "they hit a milestone they shared with you"). tone: warning for guilt/urgency, warm for celebrations, info for context, success for streaks.
- countdown: when there's a date-bound moment coming (birthday, anniversary, planned meet) — only if the user/contact has explicitly mentioned it in chat. Don't fabricate.
- link: when they shared a specific URL the user should engage with.
- none: ONLY if the conversation is purely transactional/logistical with nothing notable. Justify "none" by having literally nothing worth highlighting.

For Sagar-style casual chats, prefer "quote" pulling out an actual line they said that's funny, characteristic, or unanswered.

Tone: warm, observant, honest. The user is your friend — don't be sycophantic. If the relationship looks like it's drifted past saving, say so gently. If they were the one who reached out and got ignored, name that directly.

Cultural note: the user is in India. Many relationships will be Indian friends/family — Hindi/English code-switching is normal. Don't moralize about reaching out; just observe.`;

const SCHEMA = {
  type: Type.OBJECT,
  required: ["context", "talkingPoints", "emphasisType"],
  properties: {
    context: { type: Type.STRING, description: "Max 25 words." },
    talkingPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      maxItems: 3,
      description: "Up to 3 concrete angles. Never message drafts.",
    },
    emphasisType: {
      type: Type.STRING,
      enum: ["callout", "quote", "countdown", "link", "none"],
    },
    emphasisCallout: {
      type: Type.OBJECT,
      properties: {
        tone: {
          type: Type.STRING,
          enum: ["warm", "warning", "info", "success"],
        },
        body: { type: Type.STRING },
        label: { type: Type.STRING },
      },
    },
    emphasisQuote: {
      type: Type.OBJECT,
      properties: {
        body: { type: Type.STRING },
        from: { type: Type.STRING },
        at: { type: Type.STRING },
      },
    },
    emphasisCountdown: {
      type: Type.OBJECT,
      properties: {
        targetAt: { type: Type.STRING },
        label: { type: Type.STRING },
      },
    },
    emphasisLink: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        url: { type: Type.STRING },
        description: { type: Type.STRING },
      },
    },
  },
};

/* ─────────────── Surface composer ─────────────── */

/**
 * Compose an A2UI tree from a structured AgentObservation.
 * The agent's WHAT (which emphasis) becomes the renderer's HOW (which nodes).
 */
export function composeSurface(obs: AgentObservation): A2UINode {
  const children: A2UINode[] = [];

  // Lead with the emphasis (if any)
  switch (obs.emphasisType) {
    case "callout":
      if (obs.emphasisCallout) {
        children.push({
          type: "callout",
          tone: obs.emphasisCallout.tone,
          body: obs.emphasisCallout.body,
          label: obs.emphasisCallout.label,
        });
      }
      break;
    case "quote":
      if (obs.emphasisQuote) {
        children.push({
          type: "quote",
          body: obs.emphasisQuote.body,
          from: obs.emphasisQuote.from,
          at: obs.emphasisQuote.at,
        });
      }
      break;
    case "countdown":
      if (obs.emphasisCountdown) {
        children.push({
          type: "countdown",
          targetAt: obs.emphasisCountdown.targetAt,
          label: obs.emphasisCountdown.label,
        });
      }
      break;
    case "link":
      if (obs.emphasisLink) {
        children.push({
          type: "link_card",
          title: obs.emphasisLink.title,
          url: obs.emphasisLink.url,
          description: obs.emphasisLink.description,
        });
      }
      break;
    case "none":
    default:
      break;
  }

  // Context line — always
  if (obs.context) {
    children.push({ type: "text", body: obs.context, emphasis: "default" });
  }

  // Talking points — always (when present)
  if (obs.talkingPoints.length > 0) {
    children.push({
      type: "heading",
      body: "Things to react to",
      level: 3,
    });
    children.push({ type: "bullet_list", items: obs.talkingPoints });
  }

  return { type: "stack", children, spacing: "normal" };
}

/* ─────────────── Agent call ─────────────── */

function formatMessages(msgs: ChatMessage[], limit = 30): string {
  return msgs
    .slice(-limit)
    .map((m) => {
      const date = new Date(m.at).toISOString().slice(0, 16).replace("T", " ");
      const who = m.fromMe ? "You" : m.from;
      const text =
        m.text.length > 200 ? m.text.slice(0, 200) + "…" : m.text;
      return `[${date}] ${who}: ${text}`;
    })
    .join("\n");
}

export async function observePlant(args: {
  contactName: string;
  signals: ChatSignals;
  recentMessages: ChatMessage[];
  publicContext?: string;
}): Promise<AgentSurface> {
  const { contactName, signals, recentMessages, publicContext } = args;

  const summary = `
Contact: ${contactName}
Days since last message: ${signals.daysSinceLastMessage}
Last message was from: ${signals.lastMessageWasFromThem ? contactName : "the user"}
Recent activity: ${signals.messagesPerWeekRecent.toFixed(1)} msgs/week (last 30d)
Historical activity: ${signals.messagesPerWeekHistorical.toFixed(1)} msgs/week (prior 5 mo)
Avg response time: ${signals.avgResponseHours ? signals.avgResponseHours.toFixed(1) + "h" : "—"}
Total messages on record: ${signals.totalMessages}
${signals.unansweredInbound ? `Unanswered inbound from ${contactName}: "${signals.unansweredInbound.text.slice(0, 200)}"` : "No unanswered inbound."}
${publicContext ? `\nPublic context: ${publicContext}` : ""}
`.trim();

  const prompt = `${summary}

Recent conversation (most recent ${Math.min(30, recentMessages.length)} messages):
${formatMessages(recentMessages)}

Now produce structured output per the schema.`;

  const response = await client().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
      temperature: 0.7,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned no text");
  }
  const parsed = JSON.parse(text) as AgentObservation;
  const observation: AgentObservation = {
    context: parsed.context ?? "",
    talkingPoints: Array.isArray(parsed.talkingPoints)
      ? parsed.talkingPoints.slice(0, 3)
      : [],
    emphasisType: parsed.emphasisType ?? "none",
    emphasisCallout: parsed.emphasisCallout,
    emphasisQuote: parsed.emphasisQuote,
    emphasisCountdown: parsed.emphasisCountdown,
    emphasisLink: parsed.emphasisLink,
  };

  return {
    ...observation,
    surface: composeSurface(observation),
  };
}

/**
 * Deterministic fallback when no Gemini key is set.
 * Returns a basic A2UI surface from existing context + talking points.
 */
export function fallbackObservation(
  context: string,
  talkingPoints: string[] = [],
): AgentSurface {
  const obs: AgentObservation = {
    context,
    talkingPoints,
    emphasisType: "none",
  };
  return { ...obs, surface: composeSurface(obs) };
}
