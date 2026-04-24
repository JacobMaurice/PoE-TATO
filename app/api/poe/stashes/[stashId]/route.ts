// app/api/poe/stashes/[stashId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getStash } from "@/lib/poe-api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ stashId: string }> }
) {
  const { stashId } = await params;
  const league = req.nextUrl.searchParams.get("league");

  if (!league) {
    return NextResponse.json({ error: "Missing league parameter" }, { status: 400 });
  }

  try {
    const data = await getStash(league, stashId);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("authenticated") ? 401
                 : message.includes("scope") ? 403
                 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}