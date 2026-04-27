// lib/stash-cache.ts
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv(); // UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

const CACHE_KEY = "poe:stash:cache";
const CHANGE_ID_KEY = "poe:stash:next_change_id";
const CACHE_TTL_SECONDS = 60;

type StashCache = {
  next_change_id: string;
  stashes: {
    id: string;
    public: boolean;
    accountName?: string;
    stash?: string;
    stashType: string;
    league?: string;
    items: object[];
  }[];
  fetchedAt: number;
};

type StashData = Omit<StashCache, "fetchedAt">;

async function seedChangeIdFromNinja(): Promise<string> {
  const res = await fetch("https://poe.ninja/api/data/GetStats");
  if (!res.ok) throw new Error(`poe.ninja stats fetch failed: ${res.status}`);
  const data = await res.json();
  return data.next_change_id;
}

export async function getCachedPublicStashTabs(
  fetcher: (nextChangeId?: string) => Promise<StashData>
): Promise<StashCache> {
  try {
    const cached = await redis.get<StashCache>(CACHE_KEY);
    if (cached) return cached;

    let storedChangeId = await redis.get<string>(CHANGE_ID_KEY);
    if (!storedChangeId) {
      storedChangeId = await seedChangeIdFromNinja();
      await redis.set(CHANGE_ID_KEY, storedChangeId);
    }
    const data = await fetcher(storedChangeId);

    const result: StashCache = {
      ...data,
      stashes: data.stashes.filter((s) => s.league === "Mirage"),
      fetchedAt: Date.now(),
    };

    await Promise.all([
      redis.set(CACHE_KEY, result, { ex: CACHE_TTL_SECONDS }),
      redis.set(CHANGE_ID_KEY, data.next_change_id),
    ]);

    return result;
  } catch (err) {
    console.error("[stash-cache] error:", err);
    throw err;
  }
}