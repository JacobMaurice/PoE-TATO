// lib/poe-api.ts

import { cookies } from "next/headers";

const API_BASE = "https://api.pathofexile.com";
const USER_AGENT = `OAuth ${process.env.POE_CLIENT_ID}/1.0.0 (contact: jacob.t.maurice@gmail.com)`;
const CLIENT_ID = process.env.POE_CLIENT_ID!;
const CLIENT_SECRET = process.env.POE_CLIENT_SECRET!;

// Cache for client credentials token
let clientCredentialsCache: {
  token: string;
  expiresAt: number;
} | null = null;

async function getClientCredentialsToken(scope: string): Promise<string> {
  const now = Date.now();

  if (clientCredentialsCache && clientCredentialsCache.expiresAt > now) {
    return clientCredentialsCache.token;
  }

  const res = await fetch("https://www.pathofexile.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials",
      scope,
    }),
  });

  if (!res.ok) throw new Error(`Failed to get client credentials token: ${res.status}`);

  const data = await res.json();

  clientCredentialsCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000 - 60_000,
  };

  return clientCredentialsCache.token;
}

async function getAccessToken(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get("poe_access_token");
  if (!token) throw new Error("Not authenticated");
  return token.value;
}

async function poeAPIFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getAccessToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": USER_AGENT,
      ...init?.headers,
    },
  });

  if (res.status === 401) throw new Error("Token expired or revoked");
  if (res.status === 403) throw new Error("Insufficient scope for this endpoint");
  if (!res.ok) throw new Error(`GGG API error: ${res.status}`);

  return res.json();
}

// --- Typed API methods ---
export async function getProfile() {
  return poeAPIFetch<{
    uuid: string;
    name: string;
    locale?: string;
    twitch?: { name: string };
  }>("/profile");
}

export async function getStashes(league: string, realm?: "xbox" | "sony") {
  const path = realm ? `/stash/${realm}/${league}` : `/stash/${league}`;
  return poeAPIFetch<{ stashes: object[] }>(path);
}

export async function getStash(league: string, stashId: string, realm?: "xbox" | "sony") {
  const path = realm
    ? `/stash/${realm}/${league}/${stashId}`
    : `/stash/${league}/${stashId}`;
  return poeAPIFetch<{ stash: object }>(path);
}

export async function getPublicStashTabs(realm?: "xbox" | "sony", nextChangeId?: string) {
  const params = new URLSearchParams();
  if (realm) params.set("realm", realm);
  if (nextChangeId) params.set("id", nextChangeId);

  const query = params.size ? `?${params}` : "";

  return poeAPIFetch<{
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
  }>(`/public-stash-tabs${query}`);
}

export async function getCurrencyExchange(realm?: "xbox" | "sony" | "poe2", nextChangeId?: string) {
  const params = new URLSearchParams();
  if (realm) params.set("realm", realm);
  if (nextChangeId) params.set("id", nextChangeId);

  const query = params.size ? `?${params}` : "";

  return poeAPIFetch<{
    next_change_id: number;
    markets: {
      league: string;
      market_id: string; // e.g. "chaos|divine"
      volume_traded: Record<string, number>;
      lowest_stock: Record<string, number>;
      highest_stock: Record<string, number>;
      lowest_ratio: Record<string, number>;
      highest_ratio: Record<string, number>;
    }[];
  }>(`/currency-exchange/${query}`);
}