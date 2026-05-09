"use client";

import type { Plant } from "@/lib/types";
import { ArrowRight, Sparkles } from "lucide-react";
import A2UIRenderer from "./A2UIRenderer";
import PlantArt from "./PlantArt";

export default function QuestCard({
  plant,
  onTend,
}: {
  plant: Plant;
  onTend: () => void;
}) {
  // Compose a fallback surface if the agent hasn't provided one
  const surface = plant.surface ?? {
    type: "stack" as const,
    spacing: "normal" as const,
    children: [
      { type: "text" as const, body: plant.context, emphasis: "default" as const },
    ],
  };

  return (
    <div className="relative anim-pop">
      <div className="absolute -inset-4 bg-gradient-to-br from-amber-200/40 via-orange-200/30 to-rose-200/30 blur-2xl rounded-[3rem] pointer-events-none" />

      <div className="relative surface-glow rounded-[2rem] p-6 md:p-7 overflow-hidden">
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

        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
          {/* Plant illustration + name */}
          <div className="flex sm:flex-col items-center gap-3 sm:gap-2 flex-shrink-0">
            <div className="relative">
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
            <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)] tracking-tight sm:text-center">
              {plant.name}
            </h2>
          </div>

          {/* Agent's A2UI surface */}
          <div className="flex-1 min-w-0">
            <A2UIRenderer surface={surface} />

            <div className="mt-4">
              <button
                onClick={onTend}
                className="btn btn-primary text-sm px-5 py-3"
              >
                <span>Tend</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
