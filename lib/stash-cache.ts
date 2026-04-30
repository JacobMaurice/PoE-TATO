// lib/stash-cache.ts
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv(); // UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

// ─── Keys ────────────────────────────────────────────────────────────────────
const CACHE_KEY       = "poe:stash:cache";         // Full serialized stash array
const CHANGE_ID_KEY   = "poe:stash:next_change_id";
const LOCK_KEY        = "poe:stash:lock";

// ─── Tuning ──────────────────────────────────────────────────────────────────
const PAGES_PER_CRAWL = 6;    // Pages to walk on a cold start
const INTER_PAGE_MS   = 1_500; // 1.5s between requests — well within PoE rate limits
const CACHE_TTL       = 3_600; // 1 hour in seconds

// ─── Types ───────────────────────────────────────────────────────────────────
export type StashTab = {
  id: string;
  public: boolean;
  accountName?: string;
  stash?: string;
  stashType: string;
  league?: string;
  items: object[];
};

type StashData = {
  next_change_id: string;
  stashes: StashTab[];
};

export type StashCache = {
  next_change_id: string;
  stashes: StashTab[];
  fetchedAt: number;
};

// ─── Main export ─────────────────────────────────────────────────────────────
/**
 * Returns cached stash tabs if fresh, otherwise walks PAGES_PER_CRAWL pages
 * of the public stash river synchronously and caches the result for 1 hour.
 *
 * On a cold start the caller will wait ~15s while pages are fetched — this is
 * intentional. All subsequent requests within the hour are instant.
 */
export async function getCachedPublicStashTabs(
  fetcher: (nextChangeId?: string) => Promise<StashData>,
  league = "Mirage"
): Promise<StashCache> {
  // ── 1. Return cached result if still fresh ──────────────────────────────
  const cached = await redis.get<StashCache>(CACHE_KEY);
  if (cached) return cached;

  // ── 2. Acquire a lock so concurrent requests don't all crawl at once ────
  //    Subsequent requests that arrive during the crawl will spin-wait below.
  const locked = await redis.set(LOCK_KEY, "1", { ex: CACHE_TTL, nx: true });

  if (!locked) {
    // Another request is already crawling — wait for it to finish and then
    // return whatever it cached.
    return waitForCache(fetcher, league);
  }

  // ── 3. Cold start: walk PAGES_PER_CRAWL pages and collect stashes ───────
  try {
    let changeId = (await redis.get<string>(CHANGE_ID_KEY)) ?? undefined;
    const allStashes = new Map<string, StashTab>(); // keyed by tab ID to dedupe

    for (let i = 0; i < PAGES_PER_CRAWL; i++) {
      let data: StashData;
      try {
        data = await fetcher(changeId);
      } catch (err) {
        console.error(`[stash-cache] Fetch error on page ${i}:`, err);
        break;
      }

      changeId = data.next_change_id;

      for (const tab of data.stashes) {
        if (tab.league === league && tab.public) {
          // If we've seen this tab before in a previous page, merge items
          // rather than overwriting — the river sends partial updates
          const existing = allStashes.get(tab.id);
          if (existing && tab.items.length === 0) {
            // Delta with no items — keep what we already have
            allStashes.set(tab.id, { ...tab, items: existing.items });
          } else {
            allStashes.set(tab.id, tab);
          }
        }
      }

      console.log(
        `[stash-cache] Page ${i + 1}/${PAGES_PER_CRAWL}: ${allStashes.size} stashes so far`
      );

      if (i < PAGES_PER_CRAWL - 1) await sleep(INTER_PAGE_MS);
    }

    // Persist the change ID so the next hourly crawl continues from here
    if (changeId) await redis.set(CHANGE_ID_KEY, changeId);

    const result: StashCache = {
      next_change_id: changeId ?? "",
      stashes: Array.from(allStashes.values()),
      fetchedAt: Date.now(),
    };

    await redis.set(CACHE_KEY, result, { ex: CACHE_TTL });
    return result;

  } finally {
    // Lock stays in Redis until CACHE_TTL expires — that's intentional.
    // It prevents re-crawls while the cache is valid. Once the cache expires,
    // the lock expires too, and the next request will crawl again.
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Spin-waits up to 30s for another in-flight crawl to populate the cache,
 * then returns whatever was cached. Falls back to a single live fetch if the
 * cache is still empty after the timeout.
 */
async function waitForCache(
  fetcher: (nextChangeId?: string) => Promise<StashData>,
  league: string,
  timeoutMs = 30_000,
  intervalMs = 1_000
): Promise<StashCache> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const cached = await redis.get<StashCache>(CACHE_KEY);
    if (cached) return cached;
  }

  // Timeout — fall back to a single live fetch so the page isn't empty
  console.warn("[stash-cache] Timed out waiting for crawl, falling back to single fetch");
  const changeId = (await redis.get<string>(CHANGE_ID_KEY)) ?? undefined;
  const data = await fetcher(changeId);
  return {
    next_change_id: data.next_change_id,
    stashes: data.stashes.filter((s) => s.league === league && s.public),
    fetchedAt: Date.now(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}