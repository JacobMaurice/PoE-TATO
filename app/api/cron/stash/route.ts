// app/api/cron/stash/route.ts
import { accumulateStashes } from "@/lib/stash-cache";
import { getPublicStashTabsFetcher } from "@/lib/poe-api";

/**
 * Vercel Cron: runs every minute.
 * Each run walks 10 pages of the public stash river (≈ 1.5 s apart),
 * upserting Mirage stash tabs into Redis.
 *
 * Add to vercel.json:
 *   { "crons": [{ "path": "/api/cron/stash", "schedule": "* * * * *" }] }
 *
 * Set CRON_SECRET in your Vercel environment variables.
 */
export const maxDuration = 10; // seconds – Vercel Hobby max is 10; Pro/Team is 60+

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await accumulateStashes(getPublicStashTabsFetcher());
  return Response.json(result);
}