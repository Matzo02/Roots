/**
 * WhatsApp chat export parser.
 *
 * WhatsApp's "Export chat" feature produces a `.txt` like:
 *   [12/04/2025, 14:32:11] Anjali: hey did you see my post?
 *   [12/04/2025, 14:35:42] You: omg congrats!! pm role??
 *   12/04/25, 2:32 PM - Anjali: hey did you see my post?     ← Android format
 *
 * Format varies by:
 *   - iOS vs Android (brackets vs dash separator)
 *   - 12h vs 24h time
 *   - DD/MM/YYYY vs MM/DD/YY date order (region-dependent)
 *
 * We accept the common variants and fail soft on lines we can't parse.
 */

export interface ChatMessage {
  /** ISO 8601 timestamp */
  at: string;
  /** Sender name as it appears in the export */
  from: string;
  /** Whether this was sent by the user (the device owner) */
  fromMe: boolean;
  /** Plain-text body. Media placeholders kept as `<image omitted>` etc. */
  text: string;
}

export interface ParsedChat {
  contactName: string;
  messageCount: number;
  messages: ChatMessage[];
  /** First and last message timestamps */
  firstAt?: string;
  lastAt?: string;
}

const ME_TOKENS = new Set(["You", "you", "Me", "me"]);

/**
 * Match either:
 *   [DD/MM/YY(YY), HH:MM(:SS)? (AM|PM)?] Sender: text
 *   DD/MM/YY(YY), HH:MM (AM|PM)? - Sender: text
 *   M/D/YY, H:MM AM/PM - Sender: text
 */
const LINE_RX =
  /^\[?(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|AM|PM)?\]?\s*[-–]?\s*([^:]+?):\s+([\s\S]*)$/;

function normalizeYear(y: number): number {
  if (y < 100) return 2000 + y;
  return y;
}

function toIso(
  d: number,
  m: number,
  y: number,
  hh: number,
  mm: number,
  ss: number,
  ampm?: string,
  /** Default DD/MM (most of world incl. India). Set to true if logs look like MM/DD. */
  monthFirst = false,
): string {
  let day = d;
  let month = m;
  if (monthFirst) {
    day = m;
    month = d;
  }
  let h = hh;
  if (ampm) {
    const isPm = ampm.toLowerCase() === "pm";
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
  }
  const date = new Date(
    Date.UTC(normalizeYear(y), month - 1, day, h, mm, ss ?? 0),
  );
  return date.toISOString();
}

/**
 * Heuristic: scan the first 50 message dates. If any "month" exceeds 12 in
 * DD/MM mode, force month-first. Otherwise default DD/MM (India).
 */
function detectMonthFirst(rawLines: string[]): boolean {
  let monthFirstHits = 0;
  let dayFirstHits = 0;
  for (const line of rawLines.slice(0, 200)) {
    const m = LINE_RX.exec(line);
    if (!m) continue;
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a > 12 && b <= 12) dayFirstHits++;
    else if (b > 12 && a <= 12) monthFirstHits++;
  }
  return monthFirstHits > dayFirstHits;
}

export function parseWhatsAppExport(raw: string): ParsedChat {
  // Normalize line endings + strip non-breaking spaces WhatsApp likes to insert
  const normalized = raw.replace(/\r\n/g, "\n").replace(/ | /g, " ");
  const lines = normalized.split("\n");

  const monthFirst = detectMonthFirst(lines);
  const messages: ChatMessage[] = [];
  const senderCounts = new Map<string, number>();

  let current: ChatMessage | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const match = LINE_RX.exec(line);
    if (match) {
      // Push the previous accumulating message
      if (current) messages.push(current);

      const [, dStr, mStr, yStr, hStr, miStr, sStr, ampm, sender, text] = match;
      const d = parseInt(dStr, 10);
      const m = parseInt(mStr, 10);
      const y = parseInt(yStr, 10);
      const h = parseInt(hStr, 10);
      const mi = parseInt(miStr, 10);
      const s = sStr ? parseInt(sStr, 10) : 0;

      let at: string;
      try {
        at = toIso(d, m, y, h, mi, s, ampm, monthFirst);
      } catch {
        at = new Date().toISOString();
      }

      const cleanSender = sender.trim();
      const fromMe = ME_TOKENS.has(cleanSender);

      current = {
        at,
        from: cleanSender,
        fromMe,
        text: text ?? "",
      };
      senderCounts.set(
        cleanSender,
        (senderCounts.get(cleanSender) ?? 0) + 1,
      );
    } else if (current && line.length > 0) {
      // Continuation line of a multi-line message
      current.text += "\n" + line;
    }
  }
  if (current) messages.push(current);

  // Determine the contact name as the most-frequent non-"You" sender.
  let contactName = "Unknown";
  let bestCount = 0;
  for (const [sender, count] of senderCounts) {
    if (ME_TOKENS.has(sender)) continue;
    if (count > bestCount) {
      bestCount = count;
      contactName = sender;
    }
  }

  return {
    contactName,
    messageCount: messages.length,
    messages,
    firstAt: messages[0]?.at,
    lastAt: messages[messages.length - 1]?.at,
  };
}

/* ─────────────── DERIVED SIGNALS ─────────────── */

export interface ChatSignals {
  daysSinceLastMessage: number;
  lastMessageWasFromThem: boolean;
  /** Average over last 30 days */
  messagesPerWeekRecent: number;
  /** Average over last 6 months excluding last 30 days */
  messagesPerWeekHistorical: number;
  /** Their last few messages, for context the agent can read */
  recentInbound: ChatMessage[];
  /** Mean response time (in hours) — how long *you* take to reply */
  avgResponseHours?: number;
  /** Total messages in the chat */
  totalMessages: number;
  /** Current unanswered inbound (their msg with no reply from you after) */
  unansweredInbound?: ChatMessage;
}

export function computeSignals(chat: ParsedChat, now = new Date()): ChatSignals {
  const msgs = chat.messages;
  if (msgs.length === 0) {
    return {
      daysSinceLastMessage: Infinity,
      lastMessageWasFromThem: false,
      messagesPerWeekRecent: 0,
      messagesPerWeekHistorical: 0,
      recentInbound: [],
      totalMessages: 0,
    };
  }

  const last = msgs[msgs.length - 1];
  const lastAt = new Date(last.at);
  const daysSinceLastMessage = Math.max(
    0,
    Math.floor((now.getTime() - lastAt.getTime()) / 86_400_000),
  );

  // Activity buckets
  const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;
  const sixMonthsAgo = now.getTime() - 180 * 86_400_000;
  let recent = 0;
  let historical = 0;
  for (const m of msgs) {
    const t = new Date(m.at).getTime();
    if (t >= thirtyDaysAgo) recent++;
    else if (t >= sixMonthsAgo) historical++;
  }
  const recentWeeks = 30 / 7;
  const historicalWeeks = (180 - 30) / 7;

  // Recent inbound — last 5 messages from them
  const recentInbound = msgs
    .filter((m) => !m.fromMe)
    .slice(-5);

  // Find unanswered inbound: the most recent message *from them* with nothing
  // from you after it
  let unansweredInbound: ChatMessage | undefined;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].fromMe) break;
    unansweredInbound = msgs[i];
  }

  // Avg response time — find their messages followed by yours, measure delta
  const responseTimes: number[] = [];
  for (let i = 1; i < msgs.length; i++) {
    if (msgs[i].fromMe && !msgs[i - 1].fromMe) {
      const delta =
        new Date(msgs[i].at).getTime() - new Date(msgs[i - 1].at).getTime();
      responseTimes.push(delta);
    }
  }
  const avgResponseHours = responseTimes.length
    ? responseTimes.reduce((a, b) => a + b, 0) /
      responseTimes.length /
      3_600_000
    : undefined;

  return {
    daysSinceLastMessage,
    lastMessageWasFromThem: !last.fromMe,
    messagesPerWeekRecent: recent / recentWeeks,
    messagesPerWeekHistorical: historical / historicalWeeks,
    recentInbound,
    avgResponseHours,
    totalMessages: msgs.length,
    unansweredInbound,
  };
}
