/**
 * Reads iMessage chat history from the local Messages.app SQLite DB.
 *
 * Path: ~/Library/Messages/chat.db
 *
 * Requires Full Disk Access for the process (System Settings → Privacy &
 * Security → Full Disk Access → add Terminal / iTerm / your Node).
 *
 * The DB schema (macOS 13+):
 *   chat                — one row per conversation
 *   handle              — one row per phone/email of every participant
 *   message             — every message (text in `text` OR `attributedBody`)
 *   chat_message_join   — many-to-many between chat and message
 *   chat_handle_join    — many-to-many between chat and handle
 *
 * Newer macOS stores message text in `attributedBody` (a serialized
 * NSAttributedString). We pull a plain-text fallback when `text` is null.
 *
 * Note on locks: chat.db is locked while Messages.app is running. We open
 * read-only with the immutable flag; if that fails, we copy the file to
 * a tmp location and read that.
 */

import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatMessage, ParsedChat } from "./whatsapp-parser";

const CHAT_DB = join(homedir(), "Library/Messages/chat.db");

interface RawMessage {
  rowid: number;
  guid: string;
  text: string | null;
  attributedBody: Buffer | null;
  date: number; // Apple Cocoa epoch (nanoseconds since 2001-01-01 UTC)
  is_from_me: number;
  handle_id: number | null;
}

/** Cocoa reference date offset (2001-01-01 UTC) in unix ms. */
const COCOA_EPOCH_OFFSET_MS = 978307200000;

function appleDateToIso(appleDate: number): string {
  // Newer messages use nanoseconds; older use seconds. Heuristic: if the
  // value is > 10^15 it's nanoseconds (post-macOS 10.13).
  const ms =
    appleDate > 1e15
      ? appleDate / 1_000_000 + COCOA_EPOCH_OFFSET_MS
      : appleDate * 1000 + COCOA_EPOCH_OFFSET_MS;
  return new Date(ms).toISOString();
}

/**
 * Best-effort plain text extraction from `attributedBody` when `text` is null.
 * `attributedBody` is an NSAttributedString archive — there's no clean spec.
 * We strip non-printable chars and pull out runs of UTF-8 readable bytes.
 */
function extractFromAttributedBody(buf: Buffer | null): string {
  if (!buf || buf.length === 0) return "";
  // Convert to string and pull UTF-8-printable runs of length ≥ 1.
  // The actual message body is usually after the marker `NSString` /
  // `NSAttributes`, then a length-prefixed plain string.
  const raw = buf.toString("utf8");
  // Match runs of printable characters (incl. non-ASCII letters) length ≥ 4
  const matches = raw.match(/[\x20-\x7e\xa0-\uffff]{4,}/g);
  if (!matches) return "";
  // The body is usually the longest readable run that isn't class metadata
  const candidates = matches
    .filter(
      (s) =>
        !/^(NS|__kIM|streamtyped|iI|\$null)/.test(s.trim()) &&
        !/^[A-Z][a-zA-Z]+$/.test(s.trim()),
    )
    .sort((a, b) => b.length - a.length);
  return (candidates[0] ?? "").trim();
}

function openDb(): Database.Database {
  if (!existsSync(CHAT_DB)) {
    throw new Error(
      `iMessage DB not found at ${CHAT_DB}. Are you on macOS with Messages.app set up?`,
    );
  }
  // Try read-only direct first; fall back to copy if locked.
  try {
    return new Database(CHAT_DB, { readonly: true, fileMustExist: true });
  } catch (err) {
    // Copy to tmp and read from there
    const tmp = mkdtempSync(join(tmpdir(), "roots-imsg-"));
    const copyPath = join(tmp, "chat.db");
    copyFileSync(CHAT_DB, copyPath);
    return new Database(copyPath, { readonly: true, fileMustExist: true });
  }
}

/**
 * Resolves a phone or email to all matching `handle.rowid`s.
 * iMessage normalizes phones inconsistently — we match permissively.
 */
function findHandleIds(
  db: Database.Database,
  phoneOrEmail: string,
): number[] {
  const normalized = phoneOrEmail.replace(/\s+/g, "").replace(/^\+/, "");
  const rows = db
    .prepare(
      `SELECT rowid, id FROM handle
       WHERE id = ?
          OR id = ?
          OR replace(replace(id, ' ', ''), '+', '') = ?`,
    )
    .all(phoneOrEmail, "+" + normalized, normalized) as Array<{
    rowid: number;
    id: string;
  }>;
  return rows.map((r) => r.rowid);
}

/**
 * Reads the full message history with a single contact.
 * Returns the same `ParsedChat` shape as the WhatsApp parser so plant-state
 * derivation works against either source.
 */
export function readImessageChat(
  contactPhoneOrEmail: string,
  contactName: string,
  /** Limit to last N days (default unlimited) */
  daysBack?: number,
): ParsedChat {
  const db = openDb();
  try {
    const handleIds = findHandleIds(db, contactPhoneOrEmail);
    if (handleIds.length === 0) {
      return {
        contactName,
        messageCount: 0,
        messages: [],
      };
    }
    const placeholders = handleIds.map(() => "?").join(",");

    let sinceClause = "";
    const params: (number | string)[] = [...handleIds];
    if (daysBack !== undefined) {
      const sinceMs = Date.now() - daysBack * 86_400_000;
      const sinceCocoaNs = (sinceMs - COCOA_EPOCH_OFFSET_MS) * 1_000_000;
      sinceClause = "AND m.date >= ?";
      params.push(sinceCocoaNs);
    }

    // We pull messages where the contact is the OTHER side of a 1:1 chat.
    // Group chats are excluded for v1.
    const sql = `
      SELECT
        m.rowid AS rowid,
        m.guid AS guid,
        m.text AS text,
        m.attributedBody AS attributedBody,
        m.date AS date,
        m.is_from_me AS is_from_me,
        m.handle_id AS handle_id
      FROM message m
      INNER JOIN chat_message_join cmj ON cmj.message_id = m.rowid
      INNER JOIN chat c ON c.rowid = cmj.chat_id
      INNER JOIN chat_handle_join chj ON chj.chat_id = c.rowid
      WHERE chj.handle_id IN (${placeholders})
        AND c.style = 45  -- 45 = 1:1 chat, 43 = group
        ${sinceClause}
      ORDER BY m.date ASC
    `;

    const rows = db.prepare(sql).all(...params) as RawMessage[];

    const messages: ChatMessage[] = rows.map((r) => {
      const text = r.text ?? extractFromAttributedBody(r.attributedBody);
      return {
        at: appleDateToIso(r.date),
        from: r.is_from_me ? "You" : contactName,
        fromMe: r.is_from_me === 1,
        text: text.trim(),
      };
    });

    return {
      contactName,
      messageCount: messages.length,
      messages,
      firstAt: messages[0]?.at,
      lastAt: messages[messages.length - 1]?.at,
    };
  } finally {
    db.close();
  }
}

/**
 * Lists the user's most active 1:1 contacts in iMessage (for autocomplete in
 * the Add Plant flow). Returns the contact's identifier (phone or email) and
 * a recent-message count.
 */
export function listImessageContacts(
  limit = 50,
): Array<{ id: string; messageCount: number }> {
  const db = openDb();
  try {
    const sql = `
      SELECT h.id AS id, COUNT(m.rowid) AS messageCount
      FROM handle h
      INNER JOIN chat_handle_join chj ON chj.handle_id = h.rowid
      INNER JOIN chat c ON c.rowid = chj.chat_id AND c.style = 45
      INNER JOIN chat_message_join cmj ON cmj.chat_id = c.rowid
      INNER JOIN message m ON m.rowid = cmj.message_id
      GROUP BY h.id
      ORDER BY messageCount DESC
      LIMIT ?
    `;
    return db.prepare(sql).all(limit) as Array<{
      id: string;
      messageCount: number;
    }>;
  } finally {
    db.close();
  }
}
