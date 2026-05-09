/**
 * Local file-based storage. Persists plants, player state, and chat history
 * to ~/.roots/data.json (or ROOTS_DATA_DIR if set).
 *
 * Designed for the hackathon — single-user, single-machine.
 * For multi-user, swap to Postgres / SQLite later.
 */

import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Plant, PlayerState } from "./types";
import type { ParsedChat } from "./whatsapp-parser";

interface StoredData {
  plants: Plant[];
  player: PlayerState;
  /** Per-plant cached chat parse — keyed by plant id */
  chats: Record<string, ParsedChat>;
  /** Schema version for migrations */
  version: number;
}

const SCHEMA_VERSION = 1;

const DEFAULT_PLAYER: PlayerState = {
  level: 1,
  xp: 0,
  xpToNext: 100,
  streakDays: 0,
  energy: 3,
  energyMax: 3,
};

function getDataDir(): string {
  return process.env.ROOTS_DATA_DIR ?? join(homedir(), ".roots");
}

function getDataPath(): string {
  return join(getDataDir(), "data.json");
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(getDataDir(), { recursive: true });
}

let cache: StoredData | null = null;

export async function readStore(): Promise<StoredData> {
  if (cache) return cache;

  await ensureDir();
  try {
    const raw = await fs.readFile(getDataPath(), "utf8");
    const parsed = JSON.parse(raw) as StoredData;
    cache = parsed;
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      const fresh: StoredData = {
        plants: [],
        player: { ...DEFAULT_PLAYER },
        chats: {},
        version: SCHEMA_VERSION,
      };
      cache = fresh;
      await writeStore(fresh);
      return fresh;
    }
    throw err;
  }
}

export async function writeStore(data: StoredData): Promise<void> {
  await ensureDir();
  cache = data;
  await fs.writeFile(getDataPath(), JSON.stringify(data, null, 2), "utf8");
}

export async function updatePlants(
  updater: (plants: Plant[]) => Plant[],
): Promise<Plant[]> {
  const store = await readStore();
  store.plants = updater(store.plants);
  await writeStore(store);
  return store.plants;
}

export async function updatePlayer(
  updater: (player: PlayerState) => PlayerState,
): Promise<PlayerState> {
  const store = await readStore();
  store.player = updater(store.player);
  await writeStore(store);
  return store.player;
}

export async function setChatForPlant(
  plantId: string,
  chat: ParsedChat,
): Promise<void> {
  const store = await readStore();
  store.chats[plantId] = chat;
  await writeStore(store);
}

export async function getChatForPlant(
  plantId: string,
): Promise<ParsedChat | undefined> {
  const store = await readStore();
  return store.chats[plantId];
}

/** Remove a single plant + its cached chat. */
export async function removePlant(plantId: string): Promise<boolean> {
  const store = await readStore();
  const before = store.plants.length;
  store.plants = store.plants.filter((p) => p.id !== plantId);
  delete store.chats[plantId];
  await writeStore(store);
  return store.plants.length < before;
}

/** Wipe all plants (and their cached chats). Player state stays intact. */
export async function clearAllPlants(): Promise<number> {
  const store = await readStore();
  const removed = store.plants.length;
  store.plants = [];
  store.chats = {};
  await writeStore(store);
  return removed;
}

/** Resets cache — useful for tests or after a migration. */
export function clearCache(): void {
  cache = null;
}
