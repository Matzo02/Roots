"use client";

import type { Plant } from "@/lib/types";
import { Plus } from "lucide-react";
import PlantTile from "./Plant";

export default function Garden({
  plants,
  onPlantClick,
  onAddPlant,
}: {
  plants: Plant[];
  onPlantClick: (plant: Plant) => void;
  onAddPlant?: () => void;
}) {
  const counts = plants.reduce(
    (acc, p) => {
      acc[p.state] = (acc[p.state] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const totalReady = counts.ready ?? 0;
  const totalWilting = counts.wilting ?? 0;

  return (
    <section>
      {/* Header row */}
      <div className="flex items-end justify-between mb-4 px-1">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)] mb-0.5">
            your garden
          </h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {plants.length} plants
            {totalReady > 0 && (
              <>
                {" · "}
                <span className="text-amber-700 font-medium">
                  {totalReady} need you
                </span>
              </>
            )}
            {totalWilting > 0 && (
              <>
                {" · "}
                <span className="text-yellow-700 font-medium">
                  {totalWilting} wilting
                </span>
              </>
            )}
          </p>
        </div>

        <button
          onClick={onAddPlant}
          className="btn btn-secondary text-sm px-3 py-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add plant</span>
        </button>
      </div>

      {/* Plant grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
        {plants.map((plant) => (
          <PlantTile
            key={plant.id}
            plant={plant}
            onClick={() => onPlantClick(plant)}
          />
        ))}
      </div>
    </section>
  );
}
