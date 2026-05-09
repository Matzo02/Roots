/**
 * GET  /api/wa-sync  — list every linked 1:1 contact (preview, before import)
 * POST /api/wa-sync  — import the top N most-active linked contacts as plants
 *
 * Body for POST:
 *   { jids?: string[]; limit?: number }
 *   - jids: specific contacts to import. If omitted, imports the top `limit`.
 *   - limit: default 8 (sane demo seed). Max 30.
 *
 * Each imported chat runs through:
 *   1. Compute signals
 *   2. Derive plant state + warmth
 *   3. Call agent (Gemini) for context + talking points + A2UI surface
 *   4. Persist to ~/.roots/data.json
 */

import { fallbackObservation, observePlant } from "@/lib/agent";
import { derivePlantState } from "@/lib/plant-state";
import {
  readStore,
  setChatForPlant,
  updatePlants,
} from "@/lib/storage";
import type { Plant } from "@/lib/types";
import { listLinkedChats, readLinkedChat } from "@/lib/wa-session";
import { computeSignals } from "@/lib/whatsapp-parser";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({
  jids: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(30).default(8),
});

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function GET() {
  const chats = listLinkedChats(50);
  return Response.json({ chats, count: chats.length });
}

export async function POST(req: Request) {
  let body;
  try {
    body = Body.parse(await req.json().catch(() => ({})));
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof z.ZodError ? err.issues[0]?.message : "Invalid body",
      },
      { status: 400 },
    );
  }

  const all = listLinkedChats(50);
  if (all.length === 0) {
    return Response.json(
      { error: "No linked chats yet — connect WhatsApp first." },
      { status: 400 },
    );
  }

  const target = body.jids
    ? all.filter((c) => body.jids!.includes(c.jid))
    : all.slice(0, body.limit);

  // Index existing plants by phone + jid so we can update-or-insert instead
  // of creating duplicates. Phone is the stable identifier even for plants
  // imported before the jid field existed.
  const existingByPhone = new Map<string, Plant>();
  const existingByJid = new Map<string, Plant>();
  {
    const store = await readStore();
    for (const p of store.plants) {
      if (p.phone) existingByPhone.set(p.phone, p);
      if (p.jid) existingByJid.set(p.jid, p);
    }
  }

  const imported: Plant[] = [];
  const updated: Plant[] = [];
  for (const chat of target) {
    const parsed = readLinkedChat(chat.jid, chat.name);
    if (parsed.messageCount === 0) continue;

    const signals = computeSignals(parsed);
    const derived = derivePlantState(signals);

    let context: string;
    let talkingPoints: string[] = [];
    let surface;
    try {
      const obs = await observePlant({
        contactName: chat.name,
        signals,
        recentMessages: parsed.messages,
      });
      context = obs.context;
      talkingPoints = obs.talkingPoints;
      surface = obs.surface;
    } catch (err) {
      console.error(`[wa-sync] agent failed for ${chat.name}:`, err);
      context =
        derived.lastMessageWasFromThem && derived.daysSinceLastMessage >= 1
          ? `${chat.name} sent you a message ${derived.daysSinceLastMessage} day(s) ago — unanswered.`
          : `${chat.name} — last message ${derived.daysSinceLastMessage} day(s) ago.`;
      surface = fallbackObservation(context, []).surface;
    }

    // Upsert by phone (preferred) or jid — never create duplicates
    const existing =
      existingByPhone.get(chat.phone) ?? existingByJid.get(chat.jid);

    if (existing) {
      // Refresh in place — keep the same id and game state, refresh
      // signals + agent surface from the latest chat.
      const refreshed: Plant = {
        ...existing,
        name: existing.name || chat.name,
        jid: chat.jid, // backfill if missing
        phone: existing.phone ?? chat.phone,
        state: derived.state,
        warmth: derived.warmth,
        daysSinceLastMessage: derived.daysSinceLastMessage,
        lastMessageWasFromThem: derived.lastMessageWasFromThem,
        context,
        talkingPoints,
        surface,
      };
      await setChatForPlant(existing.id, parsed);
      updated.push(refreshed);
    } else {
      const plant: Plant = {
        id: newId(),
        name: chat.name,
        phone: chat.phone,
        jid: chat.jid,
        channel: "whatsapp",
        state: derived.state,
        warmth: derived.warmth,
        daysSinceLastMessage: derived.daysSinceLastMessage,
        lastMessageWasFromThem: derived.lastMessageWasFromThem,
        context,
        talkingPoints,
        surface,
      };
      await setChatForPlant(plant.id, parsed);
      imported.push(plant);
    }
  }

  const plants = await updatePlants((all) => {
    const updatedIds = new Set(updated.map((u) => u.id));
    return [
      ...all.map((p) => updated.find((u) => u.id === p.id) ?? p),
      ...imported.filter((p) => !updatedIds.has(p.id)),
    ];
  });

  return Response.json({
    imported,
    updated,
    totalPlants: plants.length,
  });
}
