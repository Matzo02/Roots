"use client";

import type { Plant } from "@/lib/types";
import { Link2, Plus, Trash2 } from "lucide-react";
import PlantTile from "./Plant";

export default function Garden({
  plants,
  onPlantClick,
  onAddPlant,
  onLinkWhatsApp,
  onClearGarden,
}: {
  plants: Plant[];
  onPlantClick: (plant: Plant) => void;
  onAddPlant?: () => void;
  onLinkWhatsApp?: () => void;
  onClearGarden?: () => void;
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
      <div className="flex items-end justify-between mb-4 px-1 gap-3 flex-wrap">
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

        <div className="flex items-center gap-2">
          <button
            onClick={onLinkWhatsApp}
            className="btn btn-primary text-sm px-3 py-2"
          >
            <Link2 className="w-4 h-4" />
            <span>Link WhatsApp</span>
          </button>
          <button
            onClick={onAddPlant}
            className="btn btn-secondary text-sm px-3 py-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add manually</span>
          </button>
          {onClearGarden && plants.length > 0 && (
            <button
              onClick={onClearGarden}
              title="Remove all plants — start fresh"
              className="btn btn-ghost text-sm px-2.5 py-2 text-[var(--color-ink-muted)] hover:text-rose-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

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
