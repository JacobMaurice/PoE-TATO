// app/api/poe/profile/route.ts

import { NextResponse } from "next/server";
import { getProfile } from "@/lib/poe-api";

export async function GET() {
  try {
    const profile = await getProfile();
    return NextResponse.json(profile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("authenticated") ? 401
                 : message.includes("scope") ? 403
                 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}