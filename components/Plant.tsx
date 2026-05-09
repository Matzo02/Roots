"use client";

import type { Plant } from "@/lib/types";
import clsx from "clsx";
import PlantArt from "./PlantArt";

const STATE_BG: Record<Plant["state"], string> = {
  sapling: "bg-gradient-to-br from-lime-50 to-emerald-50",
  healthy: "bg-gradient-to-br from-emerald-50 to-green-100",
  mature: "bg-gradient-to-br from-green-50 to-emerald-100",
  wilting: "bg-gradient-to-br from-yellow-50 to-amber-50",
  ready: "bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100",
  dying: "bg-gradient-to-br from-slate-100 to-stone-100",
};

const STATE_BORDER: Record<Plant["state"], string> = {
  sapling: "border-lime-200/60",
  healthy: "border-emerald-200/60",
  mature: "border-green-200/60",
  wilting: "border-amber-200/60",
  ready: "border-amber-300",
  dying: "border-slate-200/60",
};

const STATE_ANIM: Record<Plant["state"], string> = {
  sapling: "anim-float-soft",
  healthy: "anim-float",
  mature: "anim-float-soft",
  wilting: "anim-droop",
  ready: "anim-glow",
  dying: "",
};

export default function PlantTile({
  plant,
  onClick,
}: {
  plant: Plant;
  onClick: () => void;
}) {
  const isReady = plant.state === "ready";
  const isDying = plant.state === "dying";

  return (
    <button
      onClick={onClick}
      className={clsx(
        "group relative aspect-square w-full select-none rounded-3xl overflow-hidden",
        "border-2 transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:shadow-2xl active:translate-y-0",
        STATE_BG[plant.state],
        STATE_BORDER[plant.state],
        isReady && "shadow-lg shadow-amber-300/40 ring-4 ring-amber-200/40",
        isDying && "opacity-70",
      )}
      aria-label={`Tend ${plant.name}`}
    >
      {/* Soft sky gradient backdrop inside the tile */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

      {/* Sparkle ring on ready */}
      {isReady && (
        <>
          <Sparkle className="absolute top-3 left-4 anim-sparkle" delay={0} />
          <Sparkle className="absolute top-6 right-5 anim-sparkle" delay={0.4} size={10} />
          <Sparkle className="absolute bottom-12 left-6 anim-sparkle" delay={0.8} size={8} />
          <Sparkle className="absolute top-10 right-3 anim-sparkle" delay={1.2} size={6} />
        </>
      )}

      {/* Plant illustration */}
      <div className="absolute inset-0 flex items-center justify-center pt-2">
        <div className={clsx("w-[78%] h-[78%] flex items-end justify-center", STATE_ANIM[plant.state])}>
          <PlantArt state={plant.state} size={140} className="w-full h-full" />
        </div>
      </div>

      {/* Name plate */}
      <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-center">
        <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-black/5 text-[13px] font-semibold text-[var(--color-ink)] shadow-sm truncate max-w-full">
          {plant.name}
        </span>
      </div>

      {/* "Needs you" badge */}
      {isReady && (
        <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[10px] font-bold uppercase tracking-wide text-white shadow-md ring-2 ring-white/60 anim-flicker">
          Needs you
        </div>
      )}

      {/* Days indicator (subtle) */}
      {plant.daysSinceLastMessage > 0 && !isReady && (
        <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded-full bg-white/80 backdrop-blur-sm text-[10px] font-medium text-[var(--color-ink-muted)]">
          {plant.daysSinceLastMessage}d
        </div>
      )}

      {/* Hover ring */}
      <div className="absolute inset-0 rounded-3xl ring-2 ring-transparent group-hover:ring-white/60 transition-all duration-300 pointer-events-none" />
    </button>
  );
}

function Sparkle({
  className = "",
  delay = 0,
  size = 12,
}: {
  className?: string;
  delay?: number;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      className={className}
      style={{ animationDelay: `${delay}s` }}
    >
      <path
        d="M 6 0 L 7 5 L 12 6 L 7 7 L 6 12 L 5 7 L 0 6 L 5 5 Z"
        fill="#fbbf24"
        stroke="#b45309"
        strokeWidth="0.3"
      />
    </svg>
  );
}
