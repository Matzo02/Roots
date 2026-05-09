/**
 * POST /api/wa-unlink
 *
 * Tears down the WhatsApp session and wipes the cached auth state.
 * Use this when the connection is in a stuck loop or you want a fresh scan.
 */

import { unlinkSession } from "@/lib/wa-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await unlinkSession();
  return Response.json({ ok: true });
}
