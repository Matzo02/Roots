/**
 * GET /api/imessage-contacts
 *
 * Returns the user's most active 1:1 iMessage contacts.
 * macOS only. Requires Full Disk Access.
 */

import { listImessageContacts } from "@/lib/imessage-read";
import { isMacOS } from "@/lib/imessage-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isMacOS()) {
    return Response.json({ contacts: [], reason: "Not on macOS" });
  }
  const limit = parseInt(
    new URL(req.url).searchParams.get("limit") ?? "50",
    10,
  );
  try {
    const contacts = listImessageContacts(limit);
    return Response.json({ contacts });
  } catch (err) {
    return Response.json(
      {
        contacts: [],
        error:
          (err as Error).message +
          ". Grant Full Disk Access to your terminal in System Settings.",
      },
      { status: 500 },
    );
  }
}
