"use client";

import { useState } from "react";

type StashTab = {
  id: string;
  name: string;
  type: string;
};

export default function StashButton({ league }: { league: string }) {
  const [stashes, setStashes] = useState<StashTab[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchStashes() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/poe/stashes?league=${encodeURIComponent(league)}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Request failed");
      }
      const data = await res.json();
      setStashes(data.stashes);
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
        <ul style={{ marginTop: 16, padding: 0, listStyle: "none" }}>
          {stashes.map((stash) => (
            <li
              key={stash.id}
              style={{
                padding: "8px 0",
                borderBottom: "1px solid #eee",
                fontSize: 14,
              }}
            >
              <strong>{stash.name}</strong>{" "}
              <span style={{ color: "#999" }}>({stash.type})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}