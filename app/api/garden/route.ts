/**
 * GET /api/garden
 * Returns the full garden state — plants + player.
 * Backed by the local file store. Falls back to mocks if no real data yet.
 */

import { MOCK_PLANTS, MOCK_PLAYER } from "@/lib/mock-data";
import { readStore } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readStore();
  const usingMocks = store.plants.length === 0;

  return Response.json({
    plants: usingMocks ? MOCK_PLANTS : store.plants,
    player: usingMocks ? MOCK_PLAYER : store.player,
    usingMocks,
  });
}
