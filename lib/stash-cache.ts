// lib/stash-cache.ts
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv(); // UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

// ─── Keys ────────────────────────────────────────────────────────────────────
const STASH_INDEX_KEY = "poe:stash:index";  // Redis Set of all known tab IDs
const STASH_PREFIX    = "poe:stash:tab:";   // poe:stash:tab:<id> → JSON StashTab
const CHANGE_ID_KEY   = "poe:stash:next_change_id";
const CRAWLED_AT_KEY  = "poe:stash:crawled_at";
const LOCK_KEY        = "poe:stash:lock";

// ─── Tuning ──────────────────────────────────────────────────────────────────
const PAGES_PER_CRAWL = 4;
const CACHE_TTL       = 3_600; // 1 hour — tabs and crawl timestamp expire together
const LOCK_TTL        = CACHE_TTL;

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
 * Returns all accumulated stash tabs if the store is fresh (< 1 hour old),
 * otherwise walks PAGES_PER_CRAWL river pages synchronously, writing each tab
 * as its own Redis key to stay well under Upstash's 10MB per-value limit.
 */
export async function getCachedPublicStashTabs(
  fetcher: (nextChangeId?: string) => Promise<StashData>,
  league = "Mirage"
): Promise<StashCache> {
  // ── 1. Return store if still fresh ─────────────────────────────────────
  const crawledAt = await redis.get<number>(CRAWLED_AT_KEY);
  if (crawledAt) {
    const stashes = await readAllTabs();
    const changeId = (await redis.get<string>(CHANGE_ID_KEY)) ?? "";
    return { next_change_id: changeId, stashes, fetchedAt: crawledAt };
  }

  // ── 2. Acquire lock — only one request crawls at a time ────────────────
  const locked = await redis.set(LOCK_KEY, "1", { ex: LOCK_TTL, nx: true });
  if (!locked) {
    return waitForStore(fetcher, league);
  }

  // ── 3. Cold crawl ───────────────────────────────────────────────────────
  let changeId = (await redis.get<string>(CHANGE_ID_KEY)) ?? undefined;

  for (let i = 0; i < PAGES_PER_CRAWL; i++) {
    let data: StashData;
    try {
      data = await fetcher(changeId);
    } catch (err) {
      console.error(`[stash-cache] Fetch error on page ${i}:`, err);
      break;
    }

    changeId = data.next_change_id;

    const relevant = data.stashes.filter(
      (s) => s.league === league && s.public
    );

    if (relevant.length > 0) {
      const pipeline = redis.pipeline();
      for (const tab of relevant) {
        // Only overwrite items if the incoming tab actually has items —
        // the river sends empty items arrays for unchanged tabs.
        // We handle the merge on read (see readAllTabs) to avoid an
        // extra GET per tab here.
        pipeline.set(`${STASH_PREFIX}${tab.id}`, JSON.stringify(tab), {
          ex: CACHE_TTL,
        });
      }
      for (const tab of relevant) {
        pipeline.sadd(STASH_INDEX_KEY, tab.id);
      }
      await pipeline.exec();
    }

    console.log(`[stash-cache] Page ${i + 1}/${PAGES_PER_CRAWL} done, changeId: ${changeId}`);
  }

  if (changeId) await redis.set(CHANGE_ID_KEY, changeId);

  // Mark the store as fresh — this key expiring is what triggers the next crawl
  const now = Date.now();
  await redis.set(CRAWLED_AT_KEY, now, { ex: CACHE_TTL });

  const stashes = await readAllTabs();
  return { next_change_id: changeId ?? "", stashes, fetchedAt: now };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read every tab from Redis in a single pipelined round-trip. */
async function readAllTabs(): Promise<StashTab[]> {
  const ids = await redis.smembers(STASH_INDEX_KEY);
  if (!ids.length) return [];

  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.get(`${STASH_PREFIX}${id}`);
  const results = await pipeline.exec() as (StashTab | string | null)[];

  // Evict IDs whose tab keys have expired from the Set
  const expiredIds = ids.filter((_, i) => results[i] === null);
  if (expiredIds.length > 0) {
    const sremPipeline = redis.pipeline();
    for (const id of expiredIds) sremPipeline.srem(STASH_INDEX_KEY, id);
    await sremPipeline.exec();
  }

  return results
    .filter((r): r is StashTab | string => r !== null)
    .map((r) => (typeof r === "string" ? JSON.parse(r) : r) as StashTab);
}

/**
 * Spin-waits up to 30s for an in-flight crawl to complete, then reads the
 * store. Falls back to a single live fetch if the timeout is exceeded.
 */
async function waitForStore(
  fetcher: (nextChangeId?: string) => Promise<StashData>,
  league: string,
  timeoutMs = 10_000,
  intervalMs = 1_000
): Promise<StashCache> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const crawledAt = await redis.get<number>(CRAWLED_AT_KEY);
    if (crawledAt) {
      const stashes = await readAllTabs();
      const changeId = (await redis.get<string>(CHANGE_ID_KEY)) ?? "";
      return { next_change_id: changeId, stashes, fetchedAt: crawledAt };
    }
  }

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