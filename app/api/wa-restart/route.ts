/**
 * POST /api/wa-restart
 *
 * Closes the current Baileys socket and re-creates it with fresh options.
 * Auth + cache are preserved. No QR scan required.
 *
 * Useful when toggling socket-level config like markOnlineOnConnect.
 */

import { softRestartSession } from "@/lib/wa-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await softRestartSession();
  return Response.json({ ok: true });
}
