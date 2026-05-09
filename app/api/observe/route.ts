/**
 * POST /api/observe
 *
 * Re-runs the agent for a plant — refreshes context + talking points using
 * the latest cached chat history. Useful when:
 *   - User wants a fresh observation
 *   - Time has passed and the situation may have changed
 *
 * Body: { plantId: string }
 */

import { observePlant } from "@/lib/agent";
import { getChatForPlant, updatePlants } from "@/lib/storage";
import { computeSignals } from "@/lib/whatsapp-parser";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ plantId: z.string().min(1) });

export async function POST(req: Request) {
  let body;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof z.ZodError ? err.issues[0]?.message : "Invalid body",
      },
      { status: 400 },
    );
  }

  const chat = await getChatForPlant(body.plantId);
  if (!chat) {
    return Response.json(
      { error: "No chat history found for this plant" },
      { status: 404 },
    );
  }

  const updatedPlants = await updatePlants((all) => all);
  const plant = updatedPlants.find((p) => p.id === body.plantId);
  if (!plant) {
    return Response.json({ error: "Plant not found" }, { status: 404 });
  }

  const signals = computeSignals(chat);

  let context = plant.context;
  let talkingPoints = plant.talkingPoints ?? [];
  try {
    const obs = await observePlant({
      contactName: plant.name,
      signals,
      recentMessages: chat.messages,
    });
    context = obs.context;
    talkingPoints = obs.talkingPoints;
  } catch (err) {
    console.error("[observe] agent failed:", err);
    return Response.json(
      { error: "Agent call failed: " + (err as Error).message },
      { status: 502 },
    );
  }

  const plants = await updatePlants((all) =>
    all.map((p) =>
      p.id === body.plantId ? { ...p, context, talkingPoints } : p,
    ),
  );

  return Response.json({
    plant: plants.find((p) => p.id === body.plantId),
  });
}
