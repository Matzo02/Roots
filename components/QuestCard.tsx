"use client";

import type { Plant } from "@/lib/types";
import { ArrowRight, Sparkles } from "lucide-react";
import PlantArt from "./PlantArt";

export default function QuestCard({
  plant,
  onTend,
}: {
  plant: Plant;
  onTend: () => void;
}) {
  return (
    <div className="relative anim-pop">
      {/* Soft glow halo */}
      <div className="absolute -inset-4 bg-gradient-to-br from-amber-200/40 via-orange-200/30 to-rose-200/30 blur-2xl rounded-[3rem] pointer-events-none" />

      <div className="relative surface-glow rounded-[2rem] p-6 md:p-7 overflow-hidden">
        {/* Decorative background sparkles */}
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-br from-amber-200/40 to-transparent rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-gradient-to-tr from-rose-200/30 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
              <Sparkles className="w-3 h-3" />
              Today&apos;s Quest
            </span>
            <span className="text-[11px] text-amber-700 font-medium">+25 XP</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 md:gap-6">
          {/* Plant + text row */}
          <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
            {/* Plant illustration */}
            <div className="relative flex-shrink-0">
              <div
                className="absolute inset-0 rounded-full blur-xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)",
                }}
              />
              <div className="relative anim-glow">
                <PlantArt state={plant.state} size={104} />
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-2xl md:text-3xl font-semibold text-[var(--color-ink)] mb-1 tracking-tight">
                {plant.name}
              </h2>
              <p className="text-[15px] md:text-base leading-snug text-[var(--color-ink-soft)]">
                {plant.context}
              </p>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={onTend}
            className="btn btn-primary self-stretch sm:self-center text-sm px-5 py-3 sm:flex-shrink-0"
          >
            <span>Tend</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
