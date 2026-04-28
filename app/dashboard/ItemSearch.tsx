"use client";

import { useState, useMemo } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type StashItem = {
  name: string;
  typeLine: string;
  baseType?: string;
  note?: string;
  rarity?: string;
  frameType?: number;
  ilvl?: number;
  icon?: string;
  corrupted?: boolean;
  identified?: boolean;
  implicitMods?: string[];
  explicitMods?: string[];
  accountName?: string;
  stashName?: string;
};

type ParsedPrice = {
  amount: number;
  currency: string;
} | null;

type SortKey = "name" | "price" | "ilvl";
type SortDir = "asc" | "desc";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parsePrice(note?: string): ParsedPrice {
  if (!note) return null;
  const m = note.match(/~(?:b\/o|price|fixed)\s+([\d.]+)\s+(\S+)/i);
  if (!m) return null;
  return { amount: parseFloat(m[1]), currency: m[2].toLowerCase() };
}

const FRAME_LABELS: Record<number, string> = {
  0: "Normal",
  1: "Magic",
  2: "Rare",
  3: "Unique",
  4: "Gem",
  5: "Currency",
  6: "Divination Card",
};

function frameLabel(item: StashItem): string {
  if (item.frameType !== undefined && FRAME_LABELS[item.frameType]) {
    return FRAME_LABELS[item.frameType];
  }
  return item.rarity ?? "Normal";
}

// PoE rarity colors matching the game's UI
const RARITY_COLORS: Record<string, { name: string; base: string; border: string }> = {
  Normal:            { name: "#c8c8c8", base: "#c8c8c8", border: "#696969" },
  Magic:             { name: "#8888ff", base: "#8888ff", border: "#393984" },
  Rare:              { name: "#ffff77", base: "#c8c800", border: "#5a5a00" },
  Unique:            { name: "#af6025", base: "#af6025", border: "#5a3010" },
  Gem:               { name: "#1ba29b", base: "#1ba29b", border: "#0d6b67" },
  Currency:          { name: "#aa9e82", base: "#aa9e82", border: "#4a4432" },
  "Divination Card": { name: "#e8e8e8", base: "#e8e8e8", border: "#555" },
};

function rarityStyle(item: StashItem) {
  return RARITY_COLORS[frameLabel(item)] ?? RARITY_COLORS["Normal"];
}

const CURRENCY_PRIORITY: Record<string, number> = {
  divine: 200, exalted: 80, chaos: 1, fusing: 0.5, alch: 0.2, chromatic: 0.1,
};

function chaosValue(price: ParsedPrice): number {
  if (!price) return -1;
  return price.amount * (CURRENCY_PRIORITY[price.currency] ?? 1);
}

// ── Item Card ─────────────────────────────────────────────────────────────────

function ItemCard({ item }: { item: StashItem }) {
  const price = parsePrice(item.note);
  const rarity = rarityStyle(item);
  const label = frameLabel(item);
  const displayName = item.name && item.name !== item.typeLine ? item.name : null;
  const displayType = item.typeLine || item.name;
  const allMods = [...(item.implicitMods ?? []), ...(item.explicitMods ?? [])];

  return (
    <li style={{
      background: "linear-gradient(180deg, #1a1208 0%, #0d0d0d 100%)",
      border: `1px solid ${rarity.border}`,
      borderRadius: 4,
      overflow: "hidden",
      fontFamily: "'Georgia', serif",
    }}>
      {/* ── Header: item name + typeline ── */}
      <div style={{
        borderBottom: `1px solid ${rarity.border}`,
        padding: "7px 12px 6px",
        textAlign: "center",
        background: "rgba(0,0,0,0.35)",
      }}>
        {displayName ? (
          <>
            <div style={{ color: rarity.name, fontSize: 14, fontWeight: 700, letterSpacing: "0.05em" }}>
              {displayName}
            </div>
            <div style={{ color: rarity.base, fontSize: 12, opacity: 0.8, marginTop: 1, letterSpacing: "0.03em" }}>
              {displayType}
            </div>
          </>
        ) : (
          <div style={{ color: rarity.name, fontSize: 14, fontWeight: 700, letterSpacing: "0.05em" }}>
            {displayType}
          </div>
        )}
      </div>

      {/* ── Body: stats + price ── */}
      <div style={{ padding: "7px 12px", display: "flex", gap: 12, alignItems: "flex-start" }}>

        {/* Left: properties + mods */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Properties */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginBottom: allMods.length ? 5 : 0 }}>
            {item.ilvl !== undefined && (
              <span style={{ fontSize: 11, color: "#7f7f7f" }}>
                Item Level: <span style={{ color: "#c8c8c8" }}>{item.ilvl}</span>
              </span>
            )}
            <span style={{ fontSize: 11, color: "#7f7f7f" }}>{label}</span>
            {item.corrupted && (
              <span style={{ fontSize: 11, color: "#d20000" }}>Corrupted</span>
            )}
          </div>

          {/* Mods */}
          {allMods.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {item.implicitMods?.map((mod, i) => (
                <div key={`imp-${i}`} style={{ fontSize: 12, color: "#7e98b7", lineHeight: 1.4 }}>{mod}</div>
              ))}
              {item.implicitMods && item.implicitMods.length > 0 && item.explicitMods && item.explicitMods.length > 0 && (
                <div style={{ borderTop: "1px solid #2a2a2a", margin: "3px 0" }} />
              )}
              {item.explicitMods?.map((mod, i) => (
                <div key={`exp-${i}`} style={{ fontSize: 12, color: "#7e98b7", lineHeight: 1.4 }}>{mod}</div>
              ))}
            </div>
          )}
        </div>

        {/* Right: price + seller */}
        <div style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
          minWidth: 72,
        }}>
          {price ? (
            <div style={{
              background: "rgba(0,0,0,0.5)",
              border: "1px solid #4a4432",
              borderRadius: 3,
              padding: "4px 10px",
              textAlign: "center",
              lineHeight: 1.3,
            }}>
              <div style={{ fontSize: 13, color: "#c8c8c8", fontWeight: 700, fontFamily: "sans-serif" }}>
                {price.amount % 1 === 0 ? price.amount : price.amount.toFixed(1)}
              </div>
              <div style={{ fontSize: 10, color: "#aa9e82", letterSpacing: "0.04em", fontFamily: "sans-serif" }}>
                {price.currency}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 10, color: "#333", fontStyle: "italic", fontFamily: "sans-serif" }}>
              no price
            </div>
          )}

          {item.accountName && (
            <div style={{
              fontSize: 10,
              color: "#555",
              textAlign: "right",
              maxWidth: 110,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontFamily: "sans-serif",
            }}>
              {item.accountName}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const RARITY_OPTIONS = ["All", "Normal", "Magic", "Rare", "Unique", "Gem", "Currency", "Divination Card"];

export default function ItemSearch({ items, league }: { items: StashItem[]; league: string }) {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("All");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [currency, setCurrency] = useState("chaos");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 25;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minPrice ? parseFloat(minPrice) : null;
    const max = maxPrice ? parseFloat(maxPrice) : null;

    return items
      .filter((item) => {
        if (q) {
          const haystack = `${item.name} ${item.typeLine} ${item.baseType ?? ""}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (rarity !== "All" && frameLabel(item) !== rarity) return false;
        if (min !== null || max !== null) {
          const price = parsePrice(item.note);
          if (!price || price.currency !== currency) return false;
          if (min !== null && price.amount < min) return false;
          if (max !== null && price.amount > max) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "name") {
          cmp = (a.name || a.typeLine).toLowerCase().localeCompare((b.name || b.typeLine).toLowerCase());
        } else if (sortKey === "price") {
          cmp = chaosValue(parsePrice(a.note)) - chaosValue(parsePrice(b.note));
        } else if (sortKey === "ilvl") {
          cmp = (a.ilvl ?? 0) - (b.ilvl ?? 0);
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [items, query, rarity, minPrice, maxPrice, currency, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  }

  const inputStyle: React.CSSProperties = {
    background: "#0d0d0d",
    border: "1px solid #3a3020",
    borderRadius: 3,
    color: "#c8c8c8",
    fontSize: 12,
    padding: "5px 8px",
    outline: "none",
    fontFamily: "sans-serif",
  };

  return (
    <section style={{ marginTop: 32, fontFamily: "sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <h2 style={{
          margin: 0, fontSize: 15, fontWeight: 700,
          color: "#c8a84b", letterSpacing: "0.06em",
          fontFamily: "'Georgia', serif",
        }}>
          Trade Search — {league}
        </h2>
        <span style={{ fontSize: 11, color: "#444", fontFamily: "monospace" }}>{filtered.length} items</span>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <input
          style={{ ...inputStyle, flex: "1 1 180px" }}
          type="text"
          placeholder="Search item name…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
        />
        <select style={{ ...inputStyle, cursor: "pointer" }} value={rarity}
          onChange={(e) => { setRarity(e.target.value); setPage(0); }}>
          {RARITY_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <input style={{ ...inputStyle, width: 70 }} type="number" min={0} placeholder="Min"
            value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(0); }} />
          <span style={{ color: "#444", fontSize: 12 }}>–</span>
          <input style={{ ...inputStyle, width: 70 }} type="number" min={0} placeholder="Max"
            value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(0); }} />
          <select style={{ ...inputStyle, cursor: "pointer" }} value={currency}
            onChange={(e) => setCurrency(e.target.value)}>
            {["chaos", "divine", "exalted", "alch", "fusing", "chromatic"].map((c) =>
              <option key={c} value={c}>{c}</option>
            )}
          </select>
        </div>
      </div>

      {/* Sort bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: "#444", marginRight: 4 }}>Sort:</span>
        {(["name", "price", "ilvl"] as SortKey[]).map((key) => (
          <button key={key} onClick={() => toggleSort(key)} style={{
            background: "none",
            border: `1px solid ${sortKey === key ? "#8a6a20" : "#2a2a2a"}`,
            borderRadius: 3,
            color: sortKey === key ? "#c8a84b" : "#555",
            fontSize: 11,
            padding: "2px 8px",
            cursor: "pointer",
            fontFamily: "sans-serif",
          }}>
            {key}{sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
          </button>
        ))}
      </div>

      {/* Results */}
      {pageItems.length === 0 ? (
        <p style={{ color: "#444", fontSize: 13 }}>No items match your filters.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          {pageItems.map((item, i) => (
            <ItemCard key={`${item.accountName}-${i}`} item={item} />
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, justifyContent: "center" }}>
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} style={{
            background: "none", border: "1px solid #2a2a2a", borderRadius: 3,
            color: "#666", fontSize: 11, padding: "3px 10px", cursor: "pointer", fontFamily: "sans-serif",
          }}>← Prev</button>
          <span style={{ color: "#444", fontSize: 12 }}>{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} style={{
            background: "none", border: "1px solid #2a2a2a", borderRadius: 3,
            color: "#666", fontSize: 11, padding: "3px 10px", cursor: "pointer", fontFamily: "sans-serif",
          }}>Next →</button>
        </div>
      )}
    </section>
  );
}
