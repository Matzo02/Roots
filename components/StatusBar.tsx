"use client";

import type { PlayerState } from "@/lib/types";
import { Flame, Sparkles, Zap } from "lucide-react";

export default function StatusBar({ player }: { player: PlayerState }) {
  const xpPct = Math.min(100, (player.xp / player.xpToNext) * 100);

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-white/60 border-b border-black/5">
      <div className="mx-auto max-w-6xl px-5 py-4 md:px-8 flex flex-wrap items-center justify-between gap-4">
        {/* Wordmark */}
        <div className="flex items-center gap-3">
          <Logo />
          <div className="flex flex-col leading-none">
            <span className="font-display text-2xl font-semibold text-[var(--color-ink)] tracking-tight">
              roots
            </span>
            <span className="text-[11px] text-[var(--color-ink-muted)] mt-1">
              tend the people who matter
            </span>
          </div>
        </div>

        {/* HUD pills */}
        <div className="flex items-center gap-2.5">
          {/* Level + XP */}
          <div className="pill">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-[var(--color-ink-muted)]">LV</span>
            <span className="text-sm font-bold text-[var(--color-ink)]">{player.level}</span>
            <div className="h-1.5 w-20 rounded-full bg-black/5 overflow-hidden ml-1">
              <div
                className="h-full anim-shimmer rounded-full"
                style={{ width: `${xpPct}%` }}
              />
            </div>
            <span className="text-[10px] text-[var(--color-ink-muted)] tabular-nums">
              {player.xp}/{player.xpToNext}
            </span>
          </div>

          {/* Streak */}
          <div className="pill">
            <Flame className="w-4 h-4 text-orange-500 anim-flicker" />
            <span className="text-sm font-bold text-orange-600">{player.streakDays}</span>
            <span className="text-[10px] text-[var(--color-ink-muted)] uppercase font-semibold">days</span>
          </div>

          {/* Energy */}
          <div className="pill">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-300" />
            <div className="flex gap-1">
              {Array.from({ length: player.energyMax }).map((_, i) => (
                <span
                  key={i}
                  className={
                    i < player.energy
                      ? "h-2 w-2 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-sm shadow-amber-300/60"
                      : "h-2 w-2 rounded-full bg-black/8"
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="relative">
      <svg width={40} height={40} viewBox="0 0 40 40">
        <defs>
          <radialGradient id="logo-leaf" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </radialGradient>
          <linearGradient id="logo-pot" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#d4a574" />
            <stop offset="100%" stopColor="#8b5a3c" />
          </linearGradient>
        </defs>
        <ellipse cx="20" cy="35" rx="9" ry="2" fill="rgba(0,0,0,0.15)" />
        <path d="M 12 27 L 13 33 Q 13 35 15 35 L 25 35 Q 27 35 27 33 L 28 27 Z" fill="url(#logo-pot)" />
        <ellipse cx="20" cy="27" rx="8" ry="1.5" fill="#b07b4a" />
        <path d="M 20 27 Q 20 18 20 13" stroke="#15803d" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="20" cy="13" rx="9" ry="7" fill="url(#logo-leaf)" stroke="#15803d" strokeWidth="0.6" />
        <ellipse cx="17" cy="11" rx="2.5" ry="1.5" fill="rgba(255,255,255,0.4)" />
      </svg>
    </div>
  );
}
