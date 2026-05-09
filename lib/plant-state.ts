/**
 * Computes a plant's state + warmth from chat signals.
 *
 * Rules of thumb (calibrated for hackathon demo):
 *   - "Ready" = they sent something recent, you haven't replied for ≥1 day
 *   - "Wilting" = no messages in 7-29 days
 *   - "Dying" = no messages in 60+ days, OR sustained drop in activity
 *   - "Sapling" = total messages < 10 AND first message in last 30 days
 *   - "Mature" = active 6+ months, balanced two-way recent
 *   - "Healthy" = recently active, not stale, not unanswered
 *
 * Warmth (0–100) is a smoother metric driven by:
 *   - recency, two-way balance, response time, message volume.
 */

import type { ChatSignals } from "./whatsapp-parser";
import type { PlantState } from "./types";

export interface DerivedPlantSignals {
  state: PlantState;
  warmth: number;
  daysSinceLastMessage: number;
  lastMessageWasFromThem: boolean;
}

export function derivePlantState(s: ChatSignals): DerivedPlantSignals {
  const days = s.daysSinceLastMessage;
  const isInfinite = !Number.isFinite(days);

  // ── State ──
  let state: PlantState;
  if (isInfinite) {
    state = "sapling";
  } else if (s.unansweredInbound && days >= 1) {
    state = "ready";
  } else if (days >= 60) {
    state = "dying";
  } else if (days >= 7) {
    state = "wilting";
  } else if (s.totalMessages < 10) {
    state = "sapling";
  } else if (
    s.messagesPerWeekRecent >= 5 &&
    s.totalMessages >= 100
  ) {
    state = "mature";
  } else {
    state = "healthy";
  }

  // ── Warmth (0..100) ──
  // Components:
  //   - recencyScore: 100 if today, 0 at 90+ days, smooth between
  //   - volumeScore: based on recent messages/week (saturates around 10/wk)
  //   - balanceScore: how two-way it is (1.0 = perfectly balanced)
  //   - responseScore: faster replies = warmer
  let warmth = 0;
  if (!isInfinite) {
    const recencyScore = Math.max(0, 100 - (days * 100) / 90);
    const volumeScore = Math.min(100, (s.messagesPerWeekRecent / 10) * 100);
    const trendBoost =
      s.messagesPerWeekHistorical > 0
        ? Math.min(
            1.5,
            s.messagesPerWeekRecent / s.messagesPerWeekHistorical,
          ) - 1 // 0 if flat, +0.5 if doubling
        : 0;
    const responseScore =
      s.avgResponseHours === undefined
        ? 50
        : Math.max(0, 100 - s.avgResponseHours * 4); // 25h avg = 0
    warmth = Math.round(
      recencyScore * 0.45 +
        volumeScore * 0.3 +
        responseScore * 0.25 +
        trendBoost * 10,
    );
    warmth = Math.max(0, Math.min(100, warmth));
  }

  return {
    state,
    warmth,
    daysSinceLastMessage: isInfinite ? 999 : days,
    lastMessageWasFromThem: s.lastMessageWasFromThem,
  };
}
