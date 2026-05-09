/**
 * DELETE /api/plants/:id  — remove a single plant + its cached chat
 */

import { removePlant } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const removed = await removePlant(id);
  if (!removed) {
    return Response.json({ error: "Plant not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
