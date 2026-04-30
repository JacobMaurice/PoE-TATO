"use client";

import { useState, useMemo } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type StashItem = {
  name: string;
  typeLine: string;
  baseType?: string;
  note?: string;
  frameType?: number;
  rarity?: string;
  ilvl?: number;
  icon?: string;
  corrupted?: boolean;
  identified?: boolean;
  mirrored?: boolean;
  split?: boolean;
  synthesised?: boolean;
  fractured?: boolean;
  implicitMods?: string[];
  explicitMods?: string[];
  requirements?: { name: string; value: number }[];
  properties?: { name: string; values: [string, number][] }[];
  sockets?: { group: number; attr: string; sColour: string }[];
  quality?: number;
  gemLevel?: number;
  accountName?: string;
  stashName?: string;
  w?: number;
  h?: number;
};

type ParsedPrice = { amount: number; currency: string } | null;
type SortKey = "name" | "price" | "ilvl";
type SortDir = "asc" | "desc";

// ── Socket filter types ───────────────────────────────────────────────────────

type SocketColor = "R" | "G" | "B" | "W";

/**
 * colorCounts: minimum required sockets of each colour ("" = no requirement)
 * min/max: total socket/link count range
 */
type SocketFilter = {
  colorCounts: Record<SocketColor, string>;
  min: string;
  max: string;
};

const emptySocketFilter = (): SocketFilter => ({
  colorCounts: { R: "", G: "", B: "", W: "" },
  min: "",
  max: "",
});

// ── Filter state ──────────────────────────────────────────────────────────────

type RangeFilter = { min: string; max: string };
const emptyRange = (): RangeFilter => ({ min: "", max: "" });

type Filters = {
  query: string;
  itemCategory: string;
  itemRarity: string;
  damage: RangeFilter; aps: RangeFilter; critChance: RangeFilter;
  dps: RangeFilter; physDps: RangeFilter; elemDps: RangeFilter;
  armour: RangeFilter; evasion: RangeFilter; energyShield: RangeFilter;
  ward: RangeFilter; block: RangeFilter; basePercentile: RangeFilter;
  sockets: SocketFilter;
  links: SocketFilter;
  reqLevel: RangeFilter; reqStr: RangeFilter; reqDex: RangeFilter; reqInt: RangeFilter;
  charClass: string;
  quality: RangeFilter; itemLevel: RangeFilter; gemLevel: RangeFilter;
  identified: string; corrupted: string; mirrored: string;
  split: string; fractured: string; synthesised: string;
  sellerAccount: string; saleType: string;
  minPrice: string; maxPrice: string; priceCurrency: string;
};

function defaultFilters(): Filters {
  return {
    query: "", itemCategory: "Any", itemRarity: "Any",
    damage: emptyRange(), aps: emptyRange(), critChance: emptyRange(),
    dps: emptyRange(), physDps: emptyRange(), elemDps: emptyRange(),
    armour: emptyRange(), evasion: emptyRange(), energyShield: emptyRange(),
    ward: emptyRange(), block: emptyRange(), basePercentile: emptyRange(),
    sockets: emptySocketFilter(),
    links: emptySocketFilter(),
    reqLevel: emptyRange(), reqStr: emptyRange(), reqDex: emptyRange(), reqInt: emptyRange(),
    charClass: "Any",
    quality: emptyRange(), itemLevel: emptyRange(), gemLevel: emptyRange(),
    identified: "Any", corrupted: "Any", mirrored: "Any",
    split: "Any", fractured: "Any", synthesised: "Any",
    sellerAccount: "", saleType: "Buyout or Fixed Price",
    minPrice: "", maxPrice: "", priceCurrency: "chaos",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePrice(note?: string): ParsedPrice {
  if (!note) return null;
  const m = note.match(/~(?:b\/o|price|fixed)\s+([\d.]+)\s+(\S+)/i);
  if (!m) return null;
  return { amount: parseFloat(m[1]), currency: m[2].toLowerCase() };
}

const FRAME_LABELS: Record<number, string> = {
  0: "Normal", 1: "Magic", 2: "Rare", 3: "Unique",
  4: "Gem", 5: "Currency", 6: "Divination Card",
};
function frameLabel(item: StashItem): string {
  if (item.frameType !== undefined && FRAME_LABELS[item.frameType]) return FRAME_LABELS[item.frameType];
  return item.rarity ?? "Normal";
}

const RARITY_COLORS: Record<string, { name: string; base: string; border: string }> = {
  Normal:            { name: "#c8c8c8", base: "#c8c8c8", border: "#505050" },
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

// Per-colour styles for the socket input cells
const SOCKET_CELL: Record<SocketColor, { label: string; activeColor: string; borderActive: string; bg: string }> = {
  R: { label: "R", activeColor: "#e04040", borderActive: "#c84040", bg: "#3a0a0a" },
  G: { label: "G", activeColor: "#40b840", borderActive: "#30a030", bg: "#0a2a0a" },
  B: { label: "B", activeColor: "#6090e0", borderActive: "#4070c8", bg: "#0a1a3a" },
  W: { label: "W", activeColor: "#cccccc", borderActive: "#aaaaaa", bg: "#2a2a2a" },
};

const SOCKET_ICON_COLORS: Record<string, { fill: string; rim: string }> = {
  R: { fill: "#8b0000", rim: "#e04040" },
  G: { fill: "#005000", rim: "#40b840" },
  B: { fill: "#00008b", rim: "#4080e0" },
  W: { fill: "#666",    rim: "#ddd"    },
  A: { fill: "#333",    rim: "#888"    },
  D: { fill: "#222",    rim: "#999"    },
};
function socketIconColor(sColour: string) {
  return SOCKET_ICON_COLORS[sColour?.toUpperCase()] ?? SOCKET_ICON_COLORS["W"];
}

const CURRENCY_PRIORITY: Record<string, number> = {
  divine: 200, exalted: 80, chaos: 1, vaal: 1, regal: 3,
  fusing: 0.5, alch: 0.2, alt: 0.05, chrome: 0.1, scour: 0.5, jewellers: 0.15,
};
function chaosValue(price: ParsedPrice): number {
  if (!price) return -1;
  return price.amount * (CURRENCY_PRIORITY[price.currency] ?? 1);
}

function getPropValue(item: StashItem, propName: string): number | null {
  const p = item.properties?.find((p) => p.name === propName);
  if (!p || !p.values[0]) return null;
  return parseFloat(p.values[0][0].replace(/[^0-9.]/g, "")) || null;
}
function inRange(val: number | null, range: RangeFilter): boolean {
  if (val === null) return range.min === "" && range.max === "";
  if (range.min !== "" && val < parseFloat(range.min)) return false;
  if (range.max !== "" && val > parseFloat(range.max)) return false;
  return true;
}
function anyRangeActive(r: RangeFilter) { return r.min !== "" || r.max !== ""; }

function socketFilterActive(sf: SocketFilter) {
  return sf.min !== "" || sf.max !== "" ||
    Object.values(sf.colorCounts).some((v) => v !== "");
}

function triState(val: boolean | undefined, f: string): boolean {
  if (f === "Any") return true;
  if (f === "Yes") return !!val;
  return !val;
}

/** Count sockets of each colour */
function countByColor(sockets: StashItem["sockets"]): Record<string, number> {
  const counts: Record<string, number> = {};
  sockets?.forEach((s) => {
    const c = s.sColour?.toUpperCase() ?? "W";
    counts[c] = (counts[c] ?? 0) + 1;
  });
  return counts;
}

/** Largest linked group + its colour counts */
function largestGroup(sockets: StashItem["sockets"]): { size: number; colors: Record<string, number> } {
  if (!sockets || sockets.length === 0) return { size: 0, colors: {} };
  const groups: Record<number, typeof sockets> = {};
  sockets.forEach((s) => { (groups[s.group] ??= []).push(s); });
  let best = { size: 0, colors: {} as Record<string, number> };
  Object.values(groups).forEach((g) => {
    if (g.length > best.size) {
      const colors: Record<string, number> = {};
      g.forEach((s) => { const c = s.sColour?.toUpperCase() ?? "W"; colors[c] = (colors[c] ?? 0) + 1; });
      best = { size: g.length, colors };
    }
  });
  return best;
}

function applySocketFilter(item: StashItem, sf: SocketFilter, mode: "total" | "links"): boolean {
  if (!socketFilterActive(sf)) return true;

  let count: number;
  let colorCounts: Record<string, number>;

  if (mode === "total") {
    count = item.sockets?.length ?? 0;
    colorCounts = countByColor(item.sockets);
  } else {
    const lg = largestGroup(item.sockets);
    count = lg.size;
    colorCounts = lg.colors;
  }

  if (sf.min !== "" && count < parseInt(sf.min)) return false;
  if (sf.max !== "" && count > parseInt(sf.max)) return false;

  // Each colour with a non-empty count must have ≥ that many sockets
  for (const [c, v] of Object.entries(sf.colorCounts)) {
    if (v === "") continue;
    const required = parseInt(v);
    if ((colorCounts[c] ?? 0) < required) return false;
  }

  return true;
}

function applyFilters(items: StashItem[], f: Filters): StashItem[] {
  return items.filter((item) => {
    const q = f.query.trim().toLowerCase();
    if (q && !`${item.name} ${item.typeLine} ${item.baseType ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.itemRarity !== "Any" && frameLabel(item) !== f.itemRarity) return false;
    if (!triState(item.identified, f.identified)) return false;
    if (!triState(item.corrupted, f.corrupted)) return false;
    if (!triState(item.mirrored, f.mirrored)) return false;
    if (!triState(item.split, f.split)) return false;
    if (!triState(item.fractured, f.fractured)) return false;
    if (!triState(item.synthesised, f.synthesised)) return false;
    if (anyRangeActive(f.itemLevel) && !inRange(item.ilvl ?? null, f.itemLevel)) return false;
    if (anyRangeActive(f.quality) && !inRange(item.quality ?? null, f.quality)) return false;
    if (anyRangeActive(f.gemLevel) && !inRange(item.gemLevel ?? null, f.gemLevel)) return false;
    if (anyRangeActive(f.armour) && !inRange(getPropValue(item, "Armour"), f.armour)) return false;
    if (anyRangeActive(f.evasion) && !inRange(getPropValue(item, "Evasion Rating"), f.evasion)) return false;
    if (anyRangeActive(f.energyShield) && !inRange(getPropValue(item, "Energy Shield"), f.energyShield)) return false;
    if (anyRangeActive(f.ward) && !inRange(getPropValue(item, "Ward"), f.ward)) return false;
    if (anyRangeActive(f.block) && !inRange(getPropValue(item, "Chance to Block"), f.block)) return false;
    if (anyRangeActive(f.aps) && !inRange(getPropValue(item, "Attacks per Second"), f.aps)) return false;
    if (anyRangeActive(f.critChance) && !inRange(getPropValue(item, "Critical Strike Chance"), f.critChance)) return false;
    const reqMap: Record<string, number> = {};
    item.requirements?.forEach((r) => { reqMap[r.name] = r.value; });
    if (anyRangeActive(f.reqLevel) && !inRange(reqMap["Level"] ?? null, f.reqLevel)) return false;
    if (anyRangeActive(f.reqStr) && !inRange(reqMap["Str"] ?? null, f.reqStr)) return false;
    if (anyRangeActive(f.reqDex) && !inRange(reqMap["Dex"] ?? null, f.reqDex)) return false;
    if (anyRangeActive(f.reqInt) && !inRange(reqMap["Int"] ?? null, f.reqInt)) return false;
    if (!applySocketFilter(item, f.sockets, "total")) return false;
    if (!applySocketFilter(item, f.links, "links")) return false;
    if (f.sellerAccount.trim() && !item.accountName?.toLowerCase().includes(f.sellerAccount.trim().toLowerCase())) return false;
    if (f.minPrice !== "" || f.maxPrice !== "") {
      const price = parsePrice(item.note);
      if (!price || price.currency !== f.priceCurrency) return false;
      if (f.minPrice !== "" && price.amount < parseFloat(f.minPrice)) return false;
      if (f.maxPrice !== "" && price.amount > parseFloat(f.maxPrice)) return false;
    }
    return true;
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ITEM_CATEGORIES = ["Any","Weapon","Armour","Accessory","Flask","Gem","Jewel","Map","Currency","Card","Heist","Sanctum"];
const RARITY_OPTIONS  = ["Any","Normal","Magic","Rare","Unique"];
const CHAR_CLASSES    = ["Any","Marauder","Ranger","Witch","Duelist","Templar","Shadow","Scion"];
const SALE_TYPES      = ["Any","Buyout or Fixed Price","Negotiable"];
const CURRENCIES      = ["chaos","divine","exalted","regal","vaal","alch","fusing","alt","chrome","scour","jewellers"];
const TRI_OPTIONS     = ["Any","Yes","No"];
const SOCKET_COLORS: SocketColor[] = ["R", "G", "B", "W"];

// ── Shared style tokens ───────────────────────────────────────────────────────

const T = {
  input: {
    background: "#0a0a0a", border: "1px solid #2e2410", borderRadius: 3,
    color: "#c8c8c8", fontSize: 11, padding: "3px 6px", outline: "none",
    fontFamily: "sans-serif", width: "100%", boxSizing: "border-box" as const,
  },
  select: {
    background: "#0a0a0a", border: "1px solid #2e2410", borderRadius: 3,
    color: "#c8c8c8", fontSize: 11, padding: "3px 5px", outline: "none",
    fontFamily: "sans-serif", cursor: "pointer", width: "100%", boxSizing: "border-box" as const,
  },
  label: { fontSize: 11, color: "#7f6a3e", display: "block", marginBottom: 3 } as React.CSSProperties,
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: "#c8a84b", letterSpacing: "0.06em",
    fontFamily: "'Georgia', serif", margin: 0, paddingBottom: 4,
    borderBottom: "1px solid #2e2410", display: "block",
  } as React.CSSProperties,
  panel: {
    background: "#0d0b08", border: "1px solid #2e2410", borderRadius: 4,
    padding: "10px 12px", marginBottom: 6,
  } as React.CSSProperties,
};

// ── Socket Filter Row ─────────────────────────────────────────────────────────

function SocketFilterRow({
  label, value, onChange,
}: {
  label: string;
  value: SocketFilter;
  onChange: (v: SocketFilter) => void;
}) {
  function setColorCount(c: SocketColor, val: string) {
    // Only allow 0-6
    const clamped = val === "" ? "" : String(Math.min(6, Math.max(0, parseInt(val) || 0)));
    onChange({ ...value, colorCounts: { ...value.colorCounts, [c]: clamped } });
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <label style={T.label}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

        {/* Per-colour count inputs styled as coloured cells */}
        {SOCKET_COLORS.map((c) => {
          const style = SOCKET_CELL[c];
          const val = value.colorCounts[c];
          const active = val !== "";
          return (
            <div key={c} style={{ position: "relative", flexShrink: 0 }}>
              <input
                type="number"
                min={0}
                max={6}
                value={val}
                placeholder={style.label}
                onChange={(e) => setColorCount(c, e.target.value)}
                style={{
                  width: 28,
                  height: 26,
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "sans-serif",
                  borderRadius: 3,
                  outline: "none",
                  cursor: "text",
                  boxSizing: "border-box",
                  padding: 0,
                  // Active = show number with colour tint; idle = show letter label dimly
                  background: active ? style.bg : "#0a0a0a",
                  border: `1px solid ${active ? style.borderActive : "#2e2410"}`,
                  color: active ? style.activeColor : "#3a3a3a",
                  // Hide the browser spinner arrows
                  MozAppearance: "textfield" as any,
                }}
                // Also hide spinner on webkit via inline style trick
                onFocus={(e) => (e.target.style.color = style.activeColor)}
                onBlur={(e) => {
                  e.target.style.color = val !== "" ? style.activeColor : "#3a3a3a";
                }}
              />
            </div>
          );
        })}

        {/* Total min / max */}
        <input
          style={{ ...T.input, width: 44, flex: "none", textAlign: "center" }}
          type="number" min={0} max={6} placeholder="min"
          value={value.min}
          onChange={(e) => onChange({ ...value, min: e.target.value })}
        />
        <input
          style={{ ...T.input, width: 44, flex: "none", textAlign: "center" }}
          type="number" min={0} max={6} placeholder="max"
          value={value.max}
          onChange={(e) => onChange({ ...value, max: e.target.value })}
        />
      </div>
    </div>
  );
}

// ── Socket Overlay (on item icon) ─────────────────────────────────────────────

function getSocketPositions(count: number, cols: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = row % 2 === 0 ? i % cols : (cols - 1) - (i % cols);
    positions.push({ x: col, y: row });
  }
  return positions;
}

function SocketOverlay({ sockets, itemW }: {
  sockets: NonNullable<StashItem["sockets"]>;
  itemW: number;
}) {
  const cols = Math.min(itemW, 2);
  const CELL = 18;
  const SOCKET_R = 7;
  const LINK_W = 3;
  const PAD = 2;

  const positions = getSocketPositions(sockets.length, cols);
  const svgW = cols * CELL + PAD * 2;
  const svgH = Math.max(1, Math.ceil(sockets.length / cols)) * CELL + PAD * 2;

  const links: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < sockets.length - 1; i++) {
    if (sockets[i].group === sockets[i + 1].group) {
      const a = positions[i], b = positions[i + 1];
      links.push({
        x1: PAD + a.x * CELL + CELL / 2, y1: PAD + a.y * CELL + CELL / 2,
        x2: PAD + b.x * CELL + CELL / 2, y2: PAD + b.y * CELL + CELL / 2,
      });
    }
  }

  return (
    <svg width={svgW} height={svgH}
      style={{ position: "absolute", bottom: PAD, left: "50%", transform: "translateX(-50%)" }}>
      {links.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke="#c8a84b" strokeWidth={LINK_W} strokeLinecap="round" />
      ))}
      {sockets.map((s, i) => {
        const pos = positions[i];
        const cx = PAD + pos.x * CELL + CELL / 2;
        const cy = PAD + pos.y * CELL + CELL / 2;
        const sc = socketIconColor(s.sColour);
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={SOCKET_R} fill={sc.rim} />
            <circle cx={cx} cy={cy} r={SOCKET_R - 2.5} fill={sc.fill} />
            <circle cx={cx - 1.5} cy={cy - 2} r={1.5} fill="rgba(255,255,255,0.25)" />
          </g>
        );
      })}
    </svg>
  );
}

// ── Item Card ─────────────────────────────────────────────────────────────────

function ItemCard({ item }: { item: StashItem }) {
  const price = parsePrice(item.note);
  const rarity = rarityStyle(item);
  const label = frameLabel(item);
  const displayName = item.name && item.name !== item.typeLine ? item.name : null;
  const displayType = item.typeLine || item.name;
  const allMods = [...(item.implicitMods ?? []), ...(item.explicitMods ?? [])];
  const CELL_PX = 47;
  const itemW = item.w ?? 2;
  const itemH = item.h ?? 4;
  const iconW = itemW * CELL_PX;
  const iconH = itemH * CELL_PX;

  return (
    <li style={{
      background: "linear-gradient(180deg, #1a1208 0%, #0d0d0d 100%)",
      border: `1px solid ${rarity.border}`,
      borderRadius: 4,
      overflow: "hidden",
      fontFamily: "'Georgia', serif",
      display: "flex",
    }}>
      {item.icon && (
        <div style={{
          position: "relative", width: iconW, minWidth: iconW,
          background: "rgba(0,0,0,0.55)", borderRight: `1px solid ${rarity.border}`,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 4px",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.icon} alt={displayName ?? displayType}
            width={iconW - 8} height={iconH}
            style={{ objectFit: "contain", display: "block", imageRendering: "pixelated" }} />
          {item.sockets && item.sockets.length > 0 && (
            <SocketOverlay sockets={item.sockets} itemW={itemW} />
          )}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{
          borderBottom: `1px solid ${rarity.border}`,
          padding: "7px 12px 6px", textAlign: "center", background: "rgba(0,0,0,0.35)",
        }}>
          {displayName ? (
            <>
              <div style={{ color: rarity.name, fontSize: 14, fontWeight: 700, letterSpacing: "0.05em" }}>{displayName}</div>
              <div style={{ color: rarity.base, fontSize: 12, opacity: 0.8, marginTop: 1, letterSpacing: "0.03em" }}>{displayType}</div>
            </>
          ) : (
            <div style={{ color: rarity.name, fontSize: 14, fontWeight: 700, letterSpacing: "0.05em" }}>{displayType}</div>
          )}
        </div>

        <div style={{ padding: "7px 12px", display: "flex", gap: 12, alignItems: "flex-start", flex: 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginBottom: allMods.length ? 5 : 0 }}>
              {item.ilvl !== undefined && (
                <span style={{ fontSize: 11, color: "#7f7f7f" }}>Item Level: <span style={{ color: "#c8c8c8" }}>{item.ilvl}</span></span>
              )}
              <span style={{ fontSize: 11, color: "#7f7f7f" }}>{label}</span>
              {item.corrupted   && <span style={{ fontSize: 11, color: "#d20000" }}>Corrupted</span>}
              {item.mirrored    && <span style={{ fontSize: 11, color: "#7cc7c7" }}>Mirrored</span>}
              {item.fractured   && <span style={{ fontSize: 11, color: "#a29160" }}>Fractured</span>}
              {item.synthesised && <span style={{ fontSize: 11, color: "#c98fff" }}>Synthesised</span>}
            </div>
            {allMods.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {item.implicitMods?.map((mod, i) => (
                  <div key={`imp-${i}`} style={{ fontSize: 12, color: "#7e98b7", lineHeight: 1.4 }}>{mod}</div>
                ))}
                {item.implicitMods?.length && item.explicitMods?.length
                  ? <div style={{ borderTop: "1px solid #2a2a2a", margin: "3px 0" }} /> : null}
                {item.explicitMods?.map((mod, i) => (
                  <div key={`exp-${i}`} style={{ fontSize: 12, color: "#7e98b7", lineHeight: 1.4 }}>{mod}</div>
                ))}
              </div>
            )}
          </div>

          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, minWidth: 72 }}>
            {price ? (
              <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid #4a4432", borderRadius: 3, padding: "4px 10px", textAlign: "center", lineHeight: 1.3 }}>
                <div style={{ fontSize: 13, color: "#c8c8c8", fontWeight: 700, fontFamily: "sans-serif" }}>
                  {price.amount % 1 === 0 ? price.amount : price.amount.toFixed(1)}
                </div>
                <div style={{ fontSize: 10, color: "#aa9e82", letterSpacing: "0.04em", fontFamily: "sans-serif" }}>{price.currency}</div>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: "#333", fontStyle: "italic", fontFamily: "sans-serif" }}>no price</div>
            )}
            {item.accountName && (
              <div style={{ fontSize: 10, color: "#555", textAlign: "right", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "sans-serif" }}>
                {item.accountName}
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

// ── Sidebar helpers ───────────────────────────────────────────────────────────

function RangeRow({ label, value, onChange }: { label: string; value: RangeFilter; onChange: (v: RangeFilter) => void }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={T.label}>{label}</label>
      <div style={{ display: "flex", gap: 4 }}>
        <input style={T.input} type="number" placeholder="min" value={value.min}
          onChange={(e) => onChange({ ...value, min: e.target.value })} />
        <input style={T.input} type="number" placeholder="max" value={value.max}
          onChange={(e) => onChange({ ...value, max: e.target.value })} />
      </div>
    </div>
  );
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={T.label}>{label}</label>
      <select style={T.select} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={T.panel}>
      <button onClick={() => setOpen((o) => !o)} style={{
        background: "none", border: "none", cursor: "pointer", width: "100%",
        textAlign: "left", padding: 0, display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={T.sectionTitle}>{title}</span>
        <span style={{ color: "#7f6a3e", fontSize: 11, marginTop: -2 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>{children}</div>;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ItemSearch({ items, league }: { items: StashItem[]; league: string }) {
  const [draft, setDraft] = useState<Filters>(defaultFilters());
  const [committed, setCommitted] = useState<Filters>(defaultFilters());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  function setDraftField<K extends keyof Filters>(key: K, val: Filters[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }
  function setDraftRange(key: keyof Filters, val: RangeFilter) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }
  function setDraftSocket(key: "sockets" | "links", val: SocketFilter) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  function handleSearch() { setCommitted(draft); setPage(0); }
  function handleClear() { const f = defaultFilters(); setDraft(f); setCommitted(f); setPage(0); }
  function handleKeyDown(e: React.KeyboardEvent) { if (e.key === "Enter") handleSearch(); }

  const filtered = useMemo(() => {
    return applyFilters(items, committed).sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = (a.name || a.typeLine).toLowerCase().localeCompare((b.name || b.typeLine).toLowerCase());
      else if (sortKey === "price") cmp = chaosValue(parsePrice(a.note)) - chaosValue(parsePrice(b.note));
      else if (sortKey === "ilvl") cmp = (a.ilvl ?? 0) - (b.ilvl ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, committed, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  }

  return (
    <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, alignItems: "start" }}>

      {/* ── Sidebar ── */}
      <aside>
        <CollapsibleSection title="Type Filters" defaultOpen>
          <SelectRow label="Item Category" value={draft.itemCategory} options={ITEM_CATEGORIES} onChange={(v) => setDraftField("itemCategory", v)} />
          <SelectRow label="Item Rarity" value={draft.itemRarity} options={RARITY_OPTIONS} onChange={(v) => setDraftField("itemRarity", v)} />
        </CollapsibleSection>

        <CollapsibleSection title="Weapon Filters">
          <TwoCol>
            <RangeRow label="Damage" value={draft.damage} onChange={(v) => setDraftRange("damage", v)} />
            <RangeRow label="Attacks per Second" value={draft.aps} onChange={(v) => setDraftRange("aps", v)} />
            <RangeRow label="Critical Chance" value={draft.critChance} onChange={(v) => setDraftRange("critChance", v)} />
            <RangeRow label="Damage per Second" value={draft.dps} onChange={(v) => setDraftRange("dps", v)} />
            <RangeRow label="Physical DPS" value={draft.physDps} onChange={(v) => setDraftRange("physDps", v)} />
            <RangeRow label="Elemental DPS" value={draft.elemDps} onChange={(v) => setDraftRange("elemDps", v)} />
          </TwoCol>
        </CollapsibleSection>

        <CollapsibleSection title="Armour Filters">
          <TwoCol>
            <RangeRow label="Armour" value={draft.armour} onChange={(v) => setDraftRange("armour", v)} />
            <RangeRow label="Evasion" value={draft.evasion} onChange={(v) => setDraftRange("evasion", v)} />
            <RangeRow label="Energy Shield" value={draft.energyShield} onChange={(v) => setDraftRange("energyShield", v)} />
            <RangeRow label="Ward" value={draft.ward} onChange={(v) => setDraftRange("ward", v)} />
            <RangeRow label="Block" value={draft.block} onChange={(v) => setDraftRange("block", v)} />
            <RangeRow label="Base Percentile" value={draft.basePercentile} onChange={(v) => setDraftRange("basePercentile", v)} />
          </TwoCol>
        </CollapsibleSection>

        {/* ── Socket Filters ── */}
        <CollapsibleSection title="Socket Filters" defaultOpen>
          <SocketFilterRow label="Sockets" value={draft.sockets}
            onChange={(v) => setDraftSocket("sockets", v)} />
          <SocketFilterRow label="Link Groups" value={draft.links}
            onChange={(v) => setDraftSocket("links", v)} />
        </CollapsibleSection>

        <CollapsibleSection title="Requirements">
          <TwoCol>
            <RangeRow label="Level" value={draft.reqLevel} onChange={(v) => setDraftRange("reqLevel", v)} />
            <RangeRow label="Strength" value={draft.reqStr} onChange={(v) => setDraftRange("reqStr", v)} />
            <RangeRow label="Dexterity" value={draft.reqDex} onChange={(v) => setDraftRange("reqDex", v)} />
            <RangeRow label="Intelligence" value={draft.reqInt} onChange={(v) => setDraftRange("reqInt", v)} />
          </TwoCol>
          <SelectRow label="Character Class" value={draft.charClass} options={CHAR_CLASSES} onChange={(v) => setDraftField("charClass", v)} />
        </CollapsibleSection>

        <CollapsibleSection title="Miscellaneous">
          <TwoCol>
            <RangeRow label="Quality" value={draft.quality} onChange={(v) => setDraftRange("quality", v)} />
            <RangeRow label="Item Level" value={draft.itemLevel} onChange={(v) => setDraftRange("itemLevel", v)} />
            <RangeRow label="Gem Level" value={draft.gemLevel} onChange={(v) => setDraftRange("gemLevel", v)} />
          </TwoCol>
          <TwoCol>
            <SelectRow label="Identified" value={draft.identified} options={TRI_OPTIONS} onChange={(v) => setDraftField("identified", v)} />
            <SelectRow label="Corrupted" value={draft.corrupted} options={TRI_OPTIONS} onChange={(v) => setDraftField("corrupted", v)} />
            <SelectRow label="Mirrored" value={draft.mirrored} options={TRI_OPTIONS} onChange={(v) => setDraftField("mirrored", v)} />
            <SelectRow label="Split" value={draft.split} options={TRI_OPTIONS} onChange={(v) => setDraftField("split", v)} />
            <SelectRow label="Fractured" value={draft.fractured} options={TRI_OPTIONS} onChange={(v) => setDraftField("fractured", v)} />
            <SelectRow label="Synthesised" value={draft.synthesised} options={TRI_OPTIONS} onChange={(v) => setDraftField("synthesised", v)} />
          </TwoCol>
        </CollapsibleSection>

        <CollapsibleSection title="Trade Filters" defaultOpen>
          <div style={{ marginBottom: 6 }}>
            <label style={T.label}>Seller Account</label>
            <input style={T.input} type="text" placeholder="Enter account name…"
              value={draft.sellerAccount}
              onChange={(e) => setDraftField("sellerAccount", e.target.value)}
              onKeyDown={handleKeyDown} />
          </div>
          <SelectRow label="Sale Type" value={draft.saleType} options={SALE_TYPES} onChange={(v) => setDraftField("saleType", v)} />
          <div style={{ marginBottom: 6 }}>
            <label style={T.label}>Buyout Price</label>
            <div style={{ display: "flex", gap: 4 }}>
              <input style={T.input} type="number" placeholder="min" value={draft.minPrice}
                onChange={(e) => setDraftField("minPrice", e.target.value)} />
              <input style={T.input} type="number" placeholder="max" value={draft.maxPrice}
                onChange={(e) => setDraftField("maxPrice", e.target.value)} />
            </div>
            <select style={{ ...T.select, marginTop: 4 }} value={draft.priceCurrency}
              onChange={(e) => setDraftField("priceCurrency", e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </CollapsibleSection>

        {/* Search / Clear */}
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button onClick={handleSearch} style={{
            flex: 1,
            background: "linear-gradient(180deg, #5a3a10 0%, #3a2008 100%)",
            border: "1px solid #8a6020", borderRadius: 3,
            color: "#f0c060", fontSize: 12, fontWeight: 700,
            fontFamily: "'Georgia', serif", letterSpacing: "0.06em",
            padding: "7px 0", cursor: "pointer",
          }}>Search</button>
          <button onClick={handleClear} style={{
            flex: 1, background: "none", border: "1px solid #2e2410", borderRadius: 3,
            color: "#7f6a3e", fontSize: 12, fontFamily: "sans-serif",
            padding: "7px 0", cursor: "pointer",
          }}>Clear</button>
        </div>
      </aside>

      {/* ── Results pane ── */}
      <main>
        <input
          style={{ ...T.input, fontSize: 13, padding: "7px 10px", marginBottom: 8, borderColor: "#3e3418" }}
          type="text" placeholder="Search Items…"
          value={draft.query}
          onChange={(e) => setDraftField("query", e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: "#444", marginRight: 4 }}>
            {filtered.length} results — Sort:
          </span>
          {(["name", "price", "ilvl"] as SortKey[]).map((key) => (
            <button key={key} onClick={() => toggleSort(key)} style={{
              background: "none",
              border: `1px solid ${sortKey === key ? "#8a6a20" : "#2a2a2a"}`,
              borderRadius: 3,
              color: sortKey === key ? "#c8a84b" : "#555",
              fontSize: 11, padding: "2px 8px", cursor: "pointer", fontFamily: "sans-serif",
            }}>
              {key}{sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
            </button>
          ))}
        </div>

        {pageItems.length === 0 ? (
          <p style={{ color: "#444", fontSize: 13 }}>No items match your filters.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {pageItems.map((item, i) => (
              <ItemCard key={`${item.accountName}-${i}`} item={item} />
            ))}
          </ul>
        )}

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
      </main>
    </div>
  );
}