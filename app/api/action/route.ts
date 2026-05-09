/**
 * POST /api/action
 *
 * Records a player action against a plant.
 * Updates plant state + player XP/energy/streak in the persistent store.
 *
 * Body: { plantId: string, action: "water" | "voice" | "reply" | "prune" }
 *
 * The agent doesn't draft messages — this endpoint just persists the
 * gameplay outcome after the user has done the real-world action.
 */

import { updatePlants, updatePlayer } from "@/lib/storage";
import type { Action, Plant } from "@/lib/types";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  plantId: z.string().min(1),
  action: z.enum(["water", "voice", "reply", "prune"]),
});

const XP: Record<Action, number> = {
  water: 15,
  voice: 30,
  reply: 25,
  prune: 5,
};
const ENERGY: Record<Action, number> = {
  water: 1,
  voice: 2,
  reply: 1,
  prune: 0,
};

function applyToPlant(plant: Plant, action: Action): Plant {
  if (action === "prune") {
    return {
      ...plant,
      state: "dying",
      warmth: Math.max(0, plant.warmth - 20),
    };
  }
  if (action === "reply") {
    return {
      ...plant,
      state: "mature",
      warmth: Math.min(100, plant.warmth + 18),
      daysSinceLastMessage: 0,
      lastMessageWasFromThem: false,
    };
  }
  if (action === "voice") {
    return {
      ...plant,
      state: "mature",
      warmth: Math.min(100, plant.warmth + 22),
      daysSinceLastMessage: 0,
    };
  }
  // water
  return {
    ...plant,
    state: plant.warmth + 10 > 60 ? "healthy" : "wilting",
    warmth: Math.min(100, plant.warmth + 10),
    daysSinceLastMessage: 0,
  };
}

export async function POST(req: Request) {
  let body;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message
            : "Invalid body",
      },
      { status: 400 },
    );
  }

  const { plantId, action } = body;

  const plants = await updatePlants((all) => {
    const idx = all.findIndex((p) => p.id === plantId);
    if (idx === -1) return all;
    const next = [...all];
    next[idx] = applyToPlant(all[idx], action);
    return next;
  });

  const plant = plants.find((p) => p.id === plantId);
  if (!plant) {
    return Response.json({ error: "Plant not found" }, { status: 404 });
  }

  const player = await updatePlayer((p) => {
    let xp = p.xp + XP[action];
    let level = p.level;
    let xpToNext = p.xpToNext;
    while (xp >= xpToNext) {
      xp -= xpToNext;
      level += 1;
      xpToNext = Math.round(xpToNext * 1.4);
    }
    return {
      ...p,
      xp,
      level,
      xpToNext,
      energy: Math.max(0, p.energy - ENERGY[action]),
    };
  });

  return Response.json({ plant, player, xpGain: XP[action] });
}
