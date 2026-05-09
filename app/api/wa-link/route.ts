/**
 * POST /api/wa-link  — kicks off (or reuses) a WhatsApp Web session.
 * Returns current status + QR code data URL when pairing.
 *
 * GET /api/wa-link   — polls current state.
 *
 * Frontend flow:
 *   1. POST to start the session
 *   2. Poll GET /api/wa-link every 2s
 *   3. Render QR while status === "qr"
 *   4. When status === "ready", call /api/wa-sync to import plants
 */

import { getSessionState, initWhatsAppSession } from "@/lib/wa-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // Don't await full sync — kick off and return immediately
  initWhatsAppSession().catch(() => {});
  // Give it a moment to populate the QR
  await new Promise((r) => setTimeout(r, 600));
  return Response.json(getSessionState());
}

export async function GET() {
  return Response.json(getSessionState());
}
