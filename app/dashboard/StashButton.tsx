"use client";

import { useState } from "react";

type StashTab = {
  id: string;
  name: string;
  type: string;
};

type StashWithItems = StashTab & {
  items: object[];
};

export default function StashButton({ league }: { league: string }) {
  const [stashes, setStashes] = useState<StashWithItems[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchStashes() {
    setLoading(true);
    setError(null);

    try {
      // 1. Get the list of stash tabs
      const res = await fetch(`/api/poe/stashes?league=${encodeURIComponent(league)}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Request failed");
      }
      const { stashes: stashList }: { stashes: StashTab[] } = await res.json();

      // 2. Fetch items for each stash tab one at a time
      const stashesWithItems: StashWithItems[] = [];
      for (const stash of stashList) {
        const itemRes = await fetch(
          `/api/poe/stashes/${stash.id}?league=${encodeURIComponent(league)}`
        );
        if (!itemRes.ok) {
          stashesWithItems.push({ ...stash, items: [] });
          continue;
        }
        const { stash: stashData } = await itemRes.json();
        stashesWithItems.push({ ...stash, items: stashData.items ?? [] });
      }

setStashes(stashesWithItems);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={fetchStashes}
        disabled={loading}
        style={{
          marginTop: 24,
          padding: "10px 20px",
          background: "#af6025",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontWeight: 500,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Loading..." : "Get Stashes"}
      </button>

      {error && (
        <p style={{ color: "red", fontSize: 14, marginTop: 12 }}>{error}</p>
      )}

      {stashes && (
        <pre
          style={{
            marginTop: 16,
            padding: 12,
            background: "#f5f5f5",
            borderRadius: 6,
            fontSize: 12,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {JSON.stringify(stashes, null, 2)}
        </pre>
      )}
    </div>
  );
}