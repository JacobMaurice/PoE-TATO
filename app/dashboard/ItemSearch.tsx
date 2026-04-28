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

/**
 * Parses PoE trade note formats:
 *   ~price 5 chaos
 *   ~b/o 1.5 divine
 *   ~fixed 10 chaos
 */
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

const RARITY_COLOR: Record<string, string> = {
  Normal: "#c8c8c8",
  Magic: "#8888ff",
  Rare: "#ffff77",
  Unique: "#af6025",
  Gem: "#1ba29b",
  Currency: "#aa9e82",
  "Divination Card": "#eee",
};

function rarityColor(item: StashItem): string {
  return RARITY_COLOR[frameLabel(item)] ?? "#c8c8c8";
}

const CURRENCY_PRIORITY: Record<string, number> = {
  divine: 200,
  exalted: 80,
  chaos: 1,
  fusing: 0.5,
  alch: 0.2,
  chromatic: 0.1,
};

/** Approximate chaos value for sorting */
function chaosValue(price: ParsedPrice): number {
  if (!price) return -1;
  const rate = CURRENCY_PRIORITY[price.currency] ?? 1;
  return price.amount * rate;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PriceBadge({ price }: { price: ParsedPrice }) {
  if (!price) return <span style={styles.noPrice}>no price</span>;
  return (
    <span style={styles.priceBadge}>
      {price.amount} <span style={{ color: "#aa9e82" }}>{price.currency}</span>
    </span>
  );
}

function RarityPip({ item }: { item: StashItem }) {
  return (
    <span
      style={{
        ...styles.rarityPip,
        background: rarityColor(item),
      }}
      title={frameLabel(item)}
    />
  );
}

function ItemRow({ item }: { item: StashItem }) {
  const price = parsePrice(item.note);
  const label = frameLabel(item);

  return (
    <li style={styles.row}>
      <RarityPip item={item} />
      <div style={styles.rowMain}>
        <span style={{ color: rarityColor(item), fontWeight: 600, fontSize: 13 }}>
          {item.name && item.name !== item.typeLine
            ? `${item.name} — ${item.typeLine}`
            : item.typeLine || item.name}
        </span>
        {item.ilvl !== undefined && (
          <span style={styles.tag}>iLvl {item.ilvl}</span>
        )}
        {item.corrupted && <span style={{ ...styles.tag, color: "#e55" }}>corrupted</span>}
        <span style={{ ...styles.tag, color: "#888" }}>{label}</span>
      </div>
      <div style={styles.rowRight}>
        <PriceBadge price={price} />
        <span style={styles.account}>{item.accountName}</span>
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
        // Name filter
        if (q) {
          const haystack = `${item.name} ${item.typeLine} ${item.baseType ?? ""}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }

        // Rarity filter
        if (rarity !== "All" && frameLabel(item) !== rarity) return false;

        // Price range filter (only applies to items with a price in the selected currency)
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
          const an = (a.name || a.typeLine).toLowerCase();
          const bn = (b.name || b.typeLine).toLowerCase();
          cmp = an.localeCompare(bn);
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
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  function handleQueryChange(v: string) {
    setQuery(v);
    setPage(0);
  }

  function handleRarityChange(v: string) {
    setRarity(v);
    setPage(0);
  }

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <h2 style={styles.heading}>
          Trade Search — <span style={{ color: "#af6025" }}>{league}</span>
        </h2>
        <span style={styles.count}>{filtered.length} items</span>
      </div>

      {/* ── Filters ── */}
      <div style={styles.filters}>
        {/* Name search */}
        <input
          style={styles.input}
          type="text"
          placeholder="Search item name…"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
        />

        {/* Rarity */}
        <select
          style={styles.select}
          value={rarity}
          onChange={(e) => handleRarityChange(e.target.value)}
        >
          {RARITY_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {/* Price range */}
        <div style={styles.priceRow}>
          <input
            style={{ ...styles.input, width: 80 }}
            type="number"
            min={0}
            placeholder="Min"
            value={minPrice}
            onChange={(e) => { setMinPrice(e.target.value); setPage(0); }}
          />
          <span style={{ color: "#666", fontSize: 12 }}>–</span>
          <input
            style={{ ...styles.input, width: 80 }}
            type="number"
            min={0}
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => { setMaxPrice(e.target.value); setPage(0); }}
          />
          <select
            style={styles.select}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {["chaos", "divine", "exalted", "alch", "fusing", "chromatic"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Sort bar ── */}
      <div style={styles.sortBar}>
        <span style={{ color: "#555", fontSize: 11, marginRight: 8 }}>Sort:</span>
        {(["name", "price", "ilvl"] as SortKey[]).map((key) => (
          <button
            key={key}
            style={{
              ...styles.sortBtn,
              ...(sortKey === key ? styles.sortBtnActive : {}),
            }}
            onClick={() => toggleSort(key)}
          >
            {key} {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </button>
        ))}
      </div>

      {/* ── Results ── */}
      {pageItems.length === 0 ? (
        <p style={{ color: "#555", fontSize: 13, padding: "24px 0" }}>
          No items match your filters.
        </p>
      ) : (
        <ul style={styles.list}>
          {pageItems.map((item, i) => (
            <ItemRow key={`${item.accountName}-${i}`} item={item} />
          ))}
        </ul>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            style={styles.pageBtn}
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span style={{ color: "#555", fontSize: 12 }}>
            {page + 1} / {totalPages}
          </span>
          <button
            style={styles.pageBtn}
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  section: {
    marginTop: 32,
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 16,
  },
  heading: {
    fontSize: 16,
    margin: 0,
    fontWeight: 600,
    color: "#ccc",
  },
  count: {
    fontSize: 11,
    color: "#555",
    fontFamily: "monospace",
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  priceRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  input: {
    background: "#111",
    border: "1px solid #2a2a2a",
    borderRadius: 4,
    color: "#ccc",
    fontSize: 12,
    padding: "5px 8px",
    outline: "none",
    flex: "1 1 180px",
  },
  select: {
    background: "#111",
    border: "1px solid #2a2a2a",
    borderRadius: 4,
    color: "#ccc",
    fontSize: 12,
    padding: "5px 6px",
    outline: "none",
    cursor: "pointer",
  },
  sortBar: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  sortBtn: {
    background: "none",
    border: "1px solid #2a2a2a",
    borderRadius: 4,
    color: "#555",
    fontSize: 11,
    padding: "2px 8px",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
  },
  sortBtnActive: {
    color: "#af6025",
    borderColor: "#af6025",
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "grid",
    gap: 4,
  },
  row: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 5,
    padding: "7px 10px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    transition: "border-color 0.15s",
  },
  rowMain: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    minWidth: 0,
  },
  rowRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    flexShrink: 0,
  },
  rarityPip: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    flexShrink: 0,
    opacity: 0.85,
  },
  tag: {
    fontSize: 10,
    color: "#555",
    border: "1px solid #222",
    borderRadius: 3,
    padding: "1px 4px",
  },
  priceBadge: {
    fontSize: 12,
    color: "#ccc",
    fontFamily: "monospace",
    fontWeight: 600,
  },
  noPrice: {
    fontSize: 11,
    color: "#333",
    fontStyle: "italic",
  },
  account: {
    fontSize: 10,
    color: "#444",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    justifyContent: "center",
  },
  pageBtn: {
    background: "none",
    border: "1px solid #2a2a2a",
    borderRadius: 4,
    color: "#666",
    fontSize: 11,
    padding: "3px 10px",
    cursor: "pointer",
  },
};
