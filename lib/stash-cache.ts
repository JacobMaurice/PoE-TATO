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

export async function getCachedPublicStashTabs(
  fetcher: (nextChangeId?: string) => Promise<StashData>
): Promise<StashCache> {
  // Return cached result if still fresh
  const cached = await redis.get<StashCache>(CACHE_KEY);
  if (cached) return cached;

  // Load the stored change ID so we advance the river correctly
  const storedChangeId = await redis.get<string>(CHANGE_ID_KEY);

  const data = await fetcher(storedChangeId ?? undefined);

  const result: StashCache = {
    ...data,
    stashes: data.stashes.filter((s) => s.public), // Hard-coded public stashes only SHOULD PROBABLY REMOVE IN THE FUTURE
    fetchedAt: Date.now(),
  };
  await Promise.all([
    redis.set(CACHE_KEY, result, { ex: CACHE_TTL_SECONDS }),
    redis.set(CHANGE_ID_KEY, data.next_change_id),
  ]);

  return result;
}