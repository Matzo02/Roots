/**
 * Sends an iMessage via AppleScript on macOS.
 *
 * Two modes:
 *   - openConversation(handle): just opens Messages.app to that conversation,
 *     empty thread, ready for the user to type. (Matches the no-AI-drafted
 *     messages rule — the user types their own text.)
 *   - sendMessage(handle, text): unattended send; only used when the user
 *     explicitly chooses to send something they wrote.
 *
 * Requires Messages.app to be signed in. No special permissions beyond what
 * macOS already gives Terminal/Node.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

function escapeAppleScriptString(s: string): string {
  // Escape backslashes, double quotes, and newlines for an AppleScript literal.
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

/**
 * Opens Messages.app to the conversation with this handle.
 * No message is sent — just brings up the chat thread.
 */
export async function openImessageConversation(
  handle: string,
): Promise<void> {
  const escaped = escapeAppleScriptString(handle);
  const script = `
    tell application "Messages"
      activate
      set targetService to 1st service whose service type = iMessage
      set targetBuddy to buddy "${escaped}" of targetService
    end tell
  `;
  await execAsync(`osascript -e ${JSON.stringify(script)}`);
}

/**
 * Unattended send via AppleScript. Use sparingly — only when the user has
 * explicitly authored the text.
 */
export async function sendImessage(
  handle: string,
  text: string,
): Promise<void> {
  if (!text || text.length === 0) {
    throw new Error("sendImessage: empty text");
  }
  if (text.length > 4000) {
    throw new Error("sendImessage: text too long");
  }
  const eHandle = escapeAppleScriptString(handle);
  const eText = escapeAppleScriptString(text);
  const script = `
    tell application "Messages"
      set targetService to 1st service whose service type = iMessage
      set targetBuddy to buddy "${eHandle}" of targetService
      send "${eText}" to targetBuddy
    end tell
  `;
  await execAsync(`osascript -e ${JSON.stringify(script)}`);
}

/** Detect macOS without booting Messages.app. */
export function isMacOS(): boolean {
  return process.platform === "darwin";
}
