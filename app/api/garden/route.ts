/**
 * GET /api/garden
 * Returns plants + player.
 * Each plant is augmented with the last few messages from EITHER the live
 * Baileys cache (if the plant has a JID) OR the snapshot taken at import
 * time. Live cache wins, so new incoming messages reflect immediately.
 */

import { MOCK_PLANTS, MOCK_PLAYER } from "@/lib/mock-data";
import { readStore } from "@/lib/storage";
import type { Plant } from "@/lib/types";
import { readLinkedChat } from "@/lib/wa-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT_LIMIT = 6;

export async function GET() {
  const store = await readStore();
  const usingMocks = store.plants.length === 0;

  if (usingMocks) {
    return Response.json({
      plants: MOCK_PLANTS,
      player: MOCK_PLAYER,
      usingMocks: true,
    });
  }

  const plants: Plant[] = store.plants.map((p) => {
    // Prefer the live Baileys cache. If the plant doesn't yet have a JID
    // (imported before that field existed), derive it from the phone.
    let messages: Array<{ at: string; fromMe: boolean; text: string }> = [];
    const jid =
      p.jid ?? (p.phone ? `${p.phone}@s.whatsapp.net` : undefined);

    if (jid) {
      const live = readLinkedChat(jid, p.name);
      if (live.messages.length > 0) {
        messages = live.messages.map((m) => ({
          at: m.at,
          fromMe: m.fromMe,
          text: m.text,
        }));
      }
    }

    // Fallback: cached chat from import time
    if (messages.length === 0) {
      const chat = store.chats[p.id];
      if (chat) {
        const seen = new Set<string>();
        const dedup = chat.messages.filter((m) => {
          const key = `${m.at}|${m.fromMe}|${m.text}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        messages = dedup.map((m) => ({
          at: m.at,
          fromMe: m.fromMe,
          text: m.text,
        }));
      }
    }

    if (messages.length === 0) return p;

    const recent = messages.slice(-RECENT_LIMIT).map((m) => ({
      at: m.at,
      fromMe: m.fromMe,
      text: m.text.length > 220 ? m.text.slice(0, 220) + "…" : m.text,
    }));

    // Also re-derive `daysSinceLastMessage` from live data so the plant tile
    // stays in sync without forcing a re-import.
    const lastAt = messages[messages.length - 1]?.at;
    const lastFromThem = messages[messages.length - 1]?.fromMe === false;
    let liveDays = p.daysSinceLastMessage;
    if (lastAt) {
      liveDays = Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(lastAt).getTime()) / 86_400_000,
        ),
      );
    }

    return {
      ...p,
      recentMessages: recent,
      daysSinceLastMessage: liveDays,
      lastMessageWasFromThem: lastFromThem,
    };
  });

  return Response.json({
    plants,
    player: store.player,
    usingMocks: false,
  });
}
