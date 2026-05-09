"use client";

import AddPlantSheet from "@/components/AddPlantSheet";
import Garden from "@/components/Garden";
import LinkWhatsAppSheet from "@/components/LinkWhatsAppSheet";
import PlantModal from "@/components/PlantModal";
import QuestCard from "@/components/QuestCard";
import StatusBar from "@/components/StatusBar";
import { MOCK_PLANTS, MOCK_PLAYER } from "@/lib/mock-data";
import type { Action, Plant, PlayerState } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATE_PRIORITY: Record<Plant["state"], number> = {
  ready: 5,
  wilting: 4,
  dying: 3,
  sapling: 2,
  healthy: 1,
  mature: 0,
};

const XP: Record<Action, number> = { water: 15, voice: 30, reply: 25, prune: 5 };
const ENERGY: Record<Action, number> = { water: 1, voice: 2, reply: 1, prune: 0 };

export default function Home() {
  const [plants, setPlants] = useState<Plant[]>(MOCK_PLANTS);
  const [player, setPlayer] = useState<PlayerState>(MOCK_PLAYER);
  const [openPlant, setOpenPlant] = useState<Plant | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [usingMocks, setUsingMocks] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const questPlant = useMemo(
    () =>
      [...plants].sort(
        (a, b) =>
          STATE_PRIORITY[b.state] - STATE_PRIORITY[a.state] ||
          b.daysSinceLastMessage - a.daysSinceLastMessage,
      )[0],
    [plants],
  );

  // Initial load + 6s polling so live WhatsApp messages flow into the UI.
  // Polling continues while the plant modal is open — we propagate the
  // freshest data into openPlant so its Recent messages list updates live.
  // Skipped only while the Add/Link sheets are open (they own session state).
  useEffect(() => {
    let mounted = true;

    const fetchOnce = async () => {
      try {
        const r = await fetch("/api/garden", { cache: "no-store" });
        const data = await r.json();
        if (!mounted) return;
        if (Array.isArray(data.plants) && data.plants.length > 0) {
          setPlants(data.plants);
          setPlayer(data.player);
          setUsingMocks(Boolean(data.usingMocks));
          setLastSyncedAt(Date.now());
          // If a plant modal is open, refresh its data in place — otherwise
          // new live messages would never appear in an already-open modal.
          setOpenPlant((prev) => {
            if (!prev) return prev;
            const fresh = (data.plants as Plant[]).find(
              (p) => p.id === prev.id,
            );
            // Always return a NEW object reference to force re-render even if
            // shallow content matches (lets a "live" pulse animate)
            return fresh ? { ...fresh } : prev;
          });
        } else {
          setLastSyncedAt(Date.now());
        }
      } catch {
        /* ignore network blips */
      }
    };

    fetchOnce();
    const interval = setInterval(() => {
      // Pause only for Add/Link sheets — those own their own state
      if (showAdd || showLink) return;
      fetchOnce();
    }, 6000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdd, showLink]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPlant(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const handleAction = useCallback(
    async (plant: Plant, action: Action) => {
      // Optimistic local update for snappy UX
      setPlayer((p) => {
        let xp = p.xp + XP[action];
        let level = p.level;
        let xpToNext = p.xpToNext;
        while (xp >= xpToNext) {
          xp -= xpToNext;
          level += 1;
          xpToNext = Math.round(xpToNext * 1.4);
        }
        return {
          ...p,
          xp,
          level,
          xpToNext,
          energy: Math.max(0, p.energy - ENERGY[action]),
        };
      });

      setPlants((all) =>
        all.map((pp) => {
          if (pp.id !== plant.id) return pp;
          if (action === "prune")
            return { ...pp, state: "dying" as const, warmth: Math.max(0, pp.warmth - 20) };
          if (action === "reply")
            return {
              ...pp,
              state: "mature" as const,
              warmth: Math.min(100, pp.warmth + 18),
              daysSinceLastMessage: 0,
              lastMessageWasFromThem: false,
            };
          if (action === "voice")
            return {
              ...pp,
              state: "mature" as const,
              warmth: Math.min(100, pp.warmth + 22),
              daysSinceLastMessage: 0,
            };
          return {
            ...pp,
            state: pp.warmth + 10 > 60 ? ("healthy" as const) : ("wilting" as const),
            warmth: Math.min(100, pp.warmth + 10),
            daysSinceLastMessage: 0,
          };
        }),
      );

      const verb =
        action === "water"
          ? "Reached out to"
          : action === "voice"
            ? "Voice-noted"
            : action === "prune"
              ? "Let go of"
              : "Replied to";
      setToast(`${verb} ${plant.name} · +${XP[action]} XP`);

      // Persist if we have a real backend
      if (!usingMocks) {
        try {
          await fetch("/api/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plantId: plant.id, action }),
          });
        } catch {
          // Optimistic update will linger; on next reload, server is canon
        }
      }
    },
    [usingMocks],
  );

  const handlePlantAdded = useCallback((plant: Plant) => {
    setPlants((all) => [...all, plant]);
    setUsingMocks(false);
    setToast(`Planted ${plant.name}`);
  }, []);

  const handleBatchAdded = useCallback((newPlants: Plant[]) => {
    if (newPlants.length === 0) return;
    setPlants((all) => [...all, ...newPlants]);
    setUsingMocks(false);
    setToast(`Planted ${newPlants.length} relationship${newPlants.length === 1 ? "" : "s"}`);
  }, []);

  const handlePlantRemoved = useCallback((plantId: string) => {
    setPlants((all) => all.filter((p) => p.id !== plantId));
    setToast("Removed from garden");
  }, []);

  const handleClearGarden = useCallback(async () => {
    if (
      !window.confirm(
        "Remove ALL plants and their cached chats? Player level/XP/streak stays intact. WhatsApp link stays connected.",
      )
    )
      return;
    try {
      const r = await fetch("/api/plants/clear", { method: "POST" });
      if (r.ok) {
        const data = await r.json();
        setPlants([]);
        setUsingMocks(true);
        setToast(`Cleared ${data.removed} plant${data.removed === 1 ? "" : "s"} — start fresh`);
      }
    } catch {
      /* swallow */
    }
  }, []);

  return (
    <div className="min-h-screen relative">
      <AmbientOrbs />
      <StatusBar player={player} />

      <main className="mx-auto max-w-6xl px-5 md:px-8 py-6 md:py-10 space-y-7 relative">
        {usingMocks && <DemoBanner />}

        {questPlant && questPlant.state === "ready" && (
          <QuestCard
            plant={questPlant}
            onTend={() => setOpenPlant(questPlant)}
          />
        )}

        <Garden
          plants={plants}
          onPlantClick={(p) => setOpenPlant(p)}
          onAddPlant={() => setShowAdd(true)}
          onLinkWhatsApp={() => setShowLink(true)}
          onClearGarden={!usingMocks ? handleClearGarden : undefined}
        />
      </main>

      <Footer />

      <PlantModal
        plant={openPlant}
        lastSyncedAt={lastSyncedAt}
        onClose={() => setOpenPlant(null)}
        onAction={handleAction}
        onPlantUpdated={(updated) => {
          setPlants((all) =>
            all.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
          );
          setOpenPlant(updated);
        }}
        onPlantRemoved={handlePlantRemoved}
      />

      <AddPlantSheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={handlePlantAdded}
      />

      <LinkWhatsAppSheet
        open={showLink}
        onClose={() => setShowLink(false)}
        onPlantsImported={handleBatchAdded}
      />

      {toast && (
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 anim-pop">
          <div className="surface-raised flex items-center gap-2.5 px-5 py-3 rounded-full bg-white">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100" />
            <span className="text-sm font-semibold text-[var(--color-ink)]">
              {toast}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-yellow-50 px-4 py-2.5 text-[13px] text-amber-800">
      <span className="font-semibold">Demo data.</span> Drop a real WhatsApp
      chat export via{" "}
      <span className="font-semibold">Add plant</span> to see your real
      relationships.
    </div>
  );
}

function AmbientOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="anim-drift absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-emerald-200/30 to-lime-200/20 rounded-full blur-3xl" />
      <div
        className="anim-drift absolute top-1/3 -right-32 w-[28rem] h-[28rem] bg-gradient-to-br from-amber-200/30 to-orange-200/20 rounded-full blur-3xl"
        style={{ animationDelay: "2s", animationDuration: "11s" }}
      />
      <div
        className="anim-drift absolute bottom-0 left-1/3 w-80 h-80 bg-gradient-to-br from-rose-200/20 to-pink-200/20 rounded-full blur-3xl"
        style={{ animationDelay: "4s", animationDuration: "13s" }}
      />
    </div>
  );
}

function Footer() {
  return (
    <footer className="relative mt-12 pb-8 text-center">
      <div className="text-[11px] text-[var(--color-ink-muted)]">
        roots · the agent notices, you bring the words
      </div>
    </footer>
  );
}
