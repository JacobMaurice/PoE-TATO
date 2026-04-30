// lib/stash-cache.ts
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv(); // UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

// ─── Keys ────────────────────────────────────────────────────────────────────
const CHANGE_ID_KEY   = "poe:stash:next_change_id";
const STASH_INDEX_KEY = "poe:stash:index";       // Redis Set of known stash-tab IDs
const STASH_PREFIX    = "poe:stash:tab:";         // poe:stash:tab:<id> → JSON stash object
const LOCK_KEY        = "poe:stash:accumulate:lock";

// ─── Tuning ──────────────────────────────────────────────────────────────────
/**
 * How many river pages to walk per invocation of accumulateStashes().
 * Each page is one HTTP request to /public-stash-tabs.
 *
 * The PoE API enforces a "client" rate-limit bucket of roughly
 *   45 requests / 60 s  (observed; always read X-Rate-Limit-* headers)
 * so 10 pages/invocation is safe if you invoke at most once per ~15 s.
 * Tune INTER_PAGE_MS up if you ever receive 429s.
 */
const PAGES_PER_RUN   = 4;
const INTER_PAGE_MS   = 500; // 4 pages × ~1s fetch + 0.5s sleep ≈ 6-7s
const STASH_TAB_TTL   = 60 * 60; // 1 h – tabs evicted if not seen for an hour
const LOCK_TTL        = 10;

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

// ─── Accumulator (called via after() on the request path) ────────────────────
/**
 * Walk PAGES_PER_RUN pages of the public stash river, upserting each Mirage
 * stash tab into Redis individually.  Only one instance runs at a time thanks
 * to a distributed SET NX lock.
 *
 * Intended to be called inside Next.js after() so it runs after the response
 * is flushed — the user sees no added latency.
 *
 * @param fetcher  The same fetcher you already pass in poe-api.ts
 * @param league   League to keep (default "Mirage")
 */
export async function accumulateStashes(
  fetcher: (nextChangeId?: string) => Promise<StashData>,
  league = "Mirage"
): Promise<{ pagesWalked: number; tabsUpserted: number }> {
  // Distributed lock – bail out if another invocation is still running
  const locked = await redis.set(LOCK_KEY, "1", { ex: LOCK_TTL, nx: true });
  if (!locked) {
    console.log("[stash-cache] Skipping run – lock held by another worker");
    return { pagesWalked: 0, tabsUpserted: 0 };
  }

  let pagesWalked = 0;
  let tabsUpserted = 0;

  try {
    let changeId = (await redis.get<string>(CHANGE_ID_KEY)) ?? undefined;

    for (let i = 0; i < PAGES_PER_RUN; i++) {
      let data: StashData;
      try {
        data = await fetcher(changeId);
      } catch (err) {
        console.error(`[stash-cache] Fetcher error on page ${i}:`, err);
        break;
      }

      changeId = data.next_change_id;
      pagesWalked++;

      // Filter to the target league
      const relevant = data.stashes.filter(
        (s) => s.league === league && s.public
      );

      if (relevant.length > 0) {
        // Upsert each tab individually so we never blow a single Redis value's
        // 5 MB limit and so reads can be fully pipelined.
        const pipeline = redis.pipeline();
        for (const tab of relevant) {
          pipeline.set(`${STASH_PREFIX}${tab.id}`, JSON.stringify(tab), {
            ex: STASH_TAB_TTL,
          });
        }
        pipeline.sadd(STASH_INDEX_KEY, relevant.map((t) => t.id));
        await pipeline.exec();
        tabsUpserted += relevant.length;
      }

      // Persist the change ID after every page so a crash mid-run still
      // advances the river correctly next time.
      await redis.set(CHANGE_ID_KEY, changeId);

      // Respect the rate limit between pages (skip the sleep on the last page)
      if (i < PAGES_PER_RUN - 1) await sleep(INTER_PAGE_MS);
    }
  } finally {
    await redis.del(LOCK_KEY);
  }

  console.log(
    `[stash-cache] Done: ${pagesWalked} pages, ${tabsUpserted} tabs upserted`
  );
  return { pagesWalked, tabsUpserted };
}

// ─── Reader (called on the request path) ─────────────────────────────────────
/**
 * Read all accumulated stash tabs from Redis.
 *
 * Uses a single pipelined multi-get so latency is one round-trip regardless of
 * how many tabs are stored.
 */
export async function getAccumulatedStashes(): Promise<StashTab[]> {
  const ids = await redis.smembers(STASH_INDEX_KEY);
  if (!ids.length) return [];

  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.get(`${STASH_PREFIX}${id}`);
  const results = await pipeline.exec();

  return (results as (string | null)[])
    .filter((r): r is string => r !== null)
    .map((r) => JSON.parse(r) as StashTab);
}

// ─── Legacy shim (keeps poe-api.ts compiling unchanged) ──────────────────────
/**
 * Drop-in replacement for the old getCachedPublicStashTabs.
 *
 * Returns a snapshot of whatever is already in Redis without making any new
 * API calls.  after() in page.tsx keeps the store warm after every visit.
 *
 * If the store is empty (cold start on first ever visit) it falls back to a
 * single live fetch so the page never shows nothing.
 */
export async function getCachedPublicStashTabs(
  fetcher: (nextChangeId?: string) => Promise<StashData>
): Promise<{ next_change_id: string; stashes: StashTab[]; fetchedAt: number }> {
  let stashes = await getAccumulatedStashes();

  // Cold-start fallback: fetch one page live so the dashboard isn't empty
  if (stashes.length === 0) {
    console.warn("[stash-cache] Store empty – falling back to single live fetch");
    const changeId = (await redis.get<string>(CHANGE_ID_KEY)) ?? undefined;
    const data = await fetcher(changeId);

    // Always advance the change ID, even if this page had no Mirage stashes
    await redis.set(CHANGE_ID_KEY, data.next_change_id);

    const relevant = data.stashes.filter(
      (s) => s.league === "Mirage" && s.public
    );

    // Seed the store so the next read is instant
    if (relevant.length > 0) {
      const pipeline = redis.pipeline();
      for (const tab of relevant) {
        pipeline.set(`${STASH_PREFIX}${tab.id}`, JSON.stringify(tab), {
          ex: STASH_TAB_TTL,
        });
      }
      pipeline.sadd(STASH_INDEX_KEY, relevant.map((t) => t.id));
      await pipeline.exec();
      await redis.set(CHANGE_ID_KEY, data.next_change_id);
    }

    stashes = relevant;
    return {
      next_change_id: data.next_change_id,
      stashes,
      fetchedAt: Date.now(),
    };
  }

  const nextChangeId =
    (await redis.get<string>(CHANGE_ID_KEY)) ?? "0-0-0";

  return {
    next_change_id: nextChangeId,
    stashes,
    fetchedAt: Date.now(),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}