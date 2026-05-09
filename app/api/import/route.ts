/**
 * POST /api/import
 *
 * Body (multipart/form-data):
 *   - file:        WhatsApp .txt export
 *   - name:        contact display name (overrides the auto-detected one)
 *   - phone:       international phone, no + (e.g. "919876543210")
 *   - handle?:     optional social handle
 *   - channel?:    "whatsapp" | "imessage" | "call"  (default whatsapp)
 *   - publicContext?: optional one-liner (their bio / what they're up to publicly)
 *
 * Pipeline:
 *   1. Parse the .txt → ParsedChat
 *   2. Compute signals
 *   3. Derive plant state + warmth
 *   4. Call Gemini for context + talking points
 *   5. Persist plant + chat → ~/.roots/data.json
 *   6. Return the new plant
 */

import { fallbackObservation, observePlant } from "@/lib/agent";
import { derivePlantState } from "@/lib/plant-state";
import { setChatForPlant, updatePlants } from "@/lib/storage";
import type { Channel, Plant } from "@/lib/types";
import { computeSignals, parseWhatsAppExport } from "@/lib/whatsapp-parser";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FormSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^\d{8,15}$/, "phone: digits only, country code first"),
  handle: z.string().max(80).optional(),
  channel: z.enum(["whatsapp", "imessage", "call"]).default("whatsapp"),
  publicContext: z.string().max(500).optional(),
});

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const fileEntry = form.get("file");
  if (!(fileEntry instanceof File)) {
    return Response.json({ error: "Missing 'file'" }, { status: 400 });
  }

  const fields = {
    name: form.get("name"),
    phone: form.get("phone"),
    handle: form.get("handle") || undefined,
    channel: (form.get("channel") || "whatsapp") as Channel,
    publicContext: form.get("publicContext") || undefined,
  };

  let parsed;
  try {
    parsed = FormSchema.parse(fields);
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : "invalid";
    return Response.json({ error: `Invalid form: ${msg}` }, { status: 400 });
  }

  const text = await fileEntry.text();
  if (text.length === 0) {
    return Response.json({ error: "Empty .txt file" }, { status: 400 });
  }
  if (text.length > 5_000_000) {
    return Response.json(
      { error: "Chat too large — max 5MB" },
      { status: 413 },
    );
  }

  const chat = parseWhatsAppExport(text);
  if (chat.messageCount === 0) {
    return Response.json(
      {
        error:
          "Couldn't parse any messages — make sure this is a WhatsApp .txt export.",
      },
      { status: 422 },
    );
  }

  const signals = computeSignals(chat);
  const derived = derivePlantState(signals);

  // Agent call — surface context, talking points + A2UI surface
  let context: string;
  let talkingPoints: string[] = [];
  let surface;
  try {
    const obs = await observePlant({
      contactName: parsed.name,
      signals,
      recentMessages: chat.messages,
      publicContext: parsed.publicContext,
    });
    context = obs.context;
    talkingPoints = obs.talkingPoints;
    surface = obs.surface;
  } catch (err) {
    console.error("[import] agent failed:", err);
    context =
      derived.lastMessageWasFromThem && derived.daysSinceLastMessage >= 1
        ? `${parsed.name} sent you a message ${derived.daysSinceLastMessage} day(s) ago — unanswered.`
        : `${parsed.name} — last message ${derived.daysSinceLastMessage} day(s) ago.`;
    surface = fallbackObservation(context, []).surface;
  }

  const plant: Plant = {
    id: newId(),
    name: parsed.name,
    handle: parsed.handle,
    phone: parsed.phone,
    channel: parsed.channel,
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
