/**
 * POST /api/import-imessage
 *
 * Imports a contact from local iMessage chat.db (macOS only).
 *
 * Body (JSON):
 *   { name: string, handle: string, channel?: "imessage", publicContext?: string }
 *
 * `handle` is the phone (with country code, no spaces) or email associated
 * with the iMessage thread.
 *
 * Pipeline mirrors the WhatsApp import.
 */

import { fallbackObservation, observePlant } from "@/lib/agent";
import { isMacOS } from "@/lib/imessage-send";
import { readImessageChat } from "@/lib/imessage-read";
import { derivePlantState } from "@/lib/plant-state";
import { setChatForPlant, updatePlants } from "@/lib/storage";
import type { Plant } from "@/lib/types";
import { computeSignals } from "@/lib/whatsapp-parser";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  name: z.string().min(1).max(100),
  handle: z.string().min(3).max(120),
  publicContext: z.string().max(500).optional(),
});

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function POST(req: Request) {
  if (!isMacOS()) {
    return Response.json(
      { error: "iMessage import only works on macOS." },
      { status: 400 },
    );
  }

  let body;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : "invalid";
    return Response.json({ error: `Invalid: ${msg}` }, { status: 400 });
  }

  let chat;
  try {
    chat = readImessageChat(body.handle, body.name);
  } catch (err) {
    return Response.json(
      {
        error:
          (err as Error).message +
          ". You may need to grant Full Disk Access to your terminal.",
      },
      { status: 500 },
    );
  }

  if (chat.messageCount === 0) {
    return Response.json(
      {
        error:
          "No iMessages found with that handle. Try the international format with country code (e.g. +919876543210) or the email used for iMessage.",
      },
      { status: 404 },
    );
  }

  const signals = computeSignals(chat);
  const derived = derivePlantState(signals);

  let context: string;
  let talkingPoints: string[] = [];
  let surface;
  try {
    const obs = await observePlant({
      contactName: body.name,
      signals,
      recentMessages: chat.messages,
      publicContext: body.publicContext,
    });
    context = obs.context;
    talkingPoints = obs.talkingPoints;
    surface = obs.surface;
  } catch (err) {
    console.error("[import-imessage] agent failed:", err);
    context =
      derived.lastMessageWasFromThem && derived.daysSinceLastMessage >= 1
        ? `${body.name} sent you a message ${derived.daysSinceLastMessage} day(s) ago — unanswered.`
        : `${body.name} — last message ${derived.daysSinceLastMessage} day(s) ago.`;
    surface = fallbackObservation(context, []).surface;
  }

  const plant: Plant = {
    id: newId(),
    name: body.name,
    phone: body.handle.replace(/^\+/, "").replace(/\D/g, "") || undefined,
    channel: "imessage",
    state: derived.state,
    warmth: derived.warmth,
    daysSinceLastMessage: derived.daysSinceLastMessage,
    lastMessageWasFromThem: derived.lastMessageWasFromThem,
    context,
    talkingPoints,
    surface,
  };

  await setChatForPlant(plant.id, chat);
  const plants = await updatePlants((all) => [...all, plant]);

  return Response.json({
    plant,
    totalPlants: plants.length,
    parsed: {
      contactName: chat.contactName,
      messageCount: chat.messageCount,
      firstAt: chat.firstAt,
      lastAt: chat.lastAt,
    },
  });
}
