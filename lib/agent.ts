/**
 * Gemini-powered agent that surfaces:
 *   - one-line context for a plant ("why this person matters today")
 *   - 1-3 talking points (concrete things to react to / ask about)
 *
 * Hard rule: agent NEVER drafts messages the user sends. Talking points are
 * angles + specific things to mention — not pre-written text.
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { ChatMessage, ChatSignals } from "./whatsapp-parser";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

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

export interface AgentObservation {
  context: string;
  talkingPoints: string[];
}

const SYSTEM_PROMPT = `You are the agent inside Roots — a relationship-keeping app where each person in someone's life is represented as a plant in a garden.

Your role is to NOTICE — never to write messages.

Given a person's chat history with the user, surface:
1. A single observational sentence about the relationship's current state and what's notable RIGHT NOW (max ~25 words).
2. 1-3 concrete "talking points" — things the user could react to, ask about, or remember. NEVER full message drafts.

Talking points are *angles*, not text. Examples of good talking points:
  ✓ "Ask about the trek — she posted from Manali"
  ✓ "Lead with apology, not explanation"
  ✓ "Voice note instead of text — better for distance"
  ✓ "Reference the project he asked about"

Bad (these are drafts, not points):
  ✗ "Send: 'Hey, how was the trek?'"
  ✗ "Tell her you miss her"

Tone: warm, observant, honest. The user is your friend — don't be sycophantic. If the relationship looks like it's drifted past saving, say so gently. If they were the one who reached out and got ignored, name that directly.

Cultural note: the user is in India. Many relationships will be Indian friends/family — Hindi/English code-switching is normal. Don't moralize about reaching out; just observe.`;

const SCHEMA = {
  type: Type.OBJECT,
  required: ["context", "talkingPoints"],
  properties: {
    context: {
      type: Type.STRING,
      description: "One observational sentence, max 25 words.",
    },
    talkingPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      maxItems: 3,
      description: "Up to 3 concrete angles. Never message drafts.",
    },
  },
};

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
  /** Optional public-social context (their bio, recent post) the user may have provided */
  publicContext?: string;
}): Promise<AgentObservation> {
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

Now produce: { context: "...", talkingPoints: ["...", "..."] }`;

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
  return {
    context: parsed.context ?? "",
    talkingPoints: Array.isArray(parsed.talkingPoints)
      ? parsed.talkingPoints.slice(0, 3)
      : [],
  };
}
