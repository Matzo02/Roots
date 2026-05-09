/**
 * POST /api/plants/clear  — remove all plants + cached chats. Start fresh.
 * Player state (level/xp/streak) is preserved.
 */

import { clearAllPlants } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const removed = await clearAllPlants();
  return Response.json({ ok: true, removed });
}
