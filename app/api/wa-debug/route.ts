/**
 * GET /api/wa-debug
 *
 * Verbose introspection of the WhatsApp session — full event log, per-chat
 * message counts, contact-name index, reconnect attempts, etc.
 *
 * Used for live monitoring during development.
 */

import { getDebugSnapshot } from "@/lib/wa-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getDebugSnapshot());
}
