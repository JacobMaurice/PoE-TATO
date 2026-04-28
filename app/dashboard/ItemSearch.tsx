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
};

type ParsedPrice = { amount: number; currency: string } | null;
type SortKey = "name" | "price" | "ilvl";
type SortDir = "asc" | "desc";

// ── Filter state shape ────────────────────────────────────────────────────────

type RangeFilter = { min: string; max: string };

const emptyRange = (): RangeFilter => ({ min: "", max: "" });

type Filters = {
  query: string;
  // Type
  itemCategory: string;
  itemRarity: string;
  // Weapon
  damage: RangeFilter;
  aps: RangeFilter;
  critChance: RangeFilter;
  dps: RangeFilter;
  physDps: RangeFilter;
  elemDps: RangeFilter;
  // Armour
  armour: RangeFilter;
  evasion: RangeFilter;
  energyShield: RangeFilter;
  ward: RangeFilter;
  block: RangeFilter;
  basePercentile: RangeFilter;
  // Sockets
  sockets: RangeFilter;
  links: RangeFilter;
  // Requirements
  reqLevel: RangeFilter;
  reqStr: RangeFilter;
  reqDex: RangeFilter;
  reqInt: RangeFilter;
  charClass: string;
  // Misc
  quality: RangeFilter;
  itemLevel: RangeFilter;
  gemLevel: RangeFilter;
  identified: string;
  corrupted: string;
  mirrored: string;
  split: string;
  fractured: string;
  synthesised: string;
  // Trade
  sellerAccount: string;
  saleType: string;
  minPrice: string;
  maxPrice: string;
  priceCurrency: string;
};

function defaultFilters(): Filters {
  return {
    query: "",
    itemCategory: "Any",
    itemRarity: "Any",
    damage: emptyRange(),
    aps: emptyRange(),
    critChance: emptyRange(),
    dps: emptyRange(),
    physDps: emptyRange(),
    elemDps: emptyRange(),
    armour: emptyRange(),
    evasion: emptyRange(),
    energyShield: emptyRange(),
    ward: emptyRange(),
    block: emptyRange(),
    basePercentile: emptyRange(),
    sockets: emptyRange(),
    links: emptyRange(),
    reqLevel: emptyRange(),
    reqStr: emptyRange(),
    reqDex: emptyRange(),
    reqInt: emptyRange(),
    charClass: "Any",
    quality: emptyRange(),
    itemLevel: emptyRange(),
    gemLevel: emptyRange(),
    identified: "Any",
    corrupted: "Any",
    mirrored: "Any",
    split: "Any",
    fractured: "Any",
    synthesised: "Any",
    sellerAccount: "",
    saleType: "Buyout or Fixed Price",
    minPrice: "",
    maxPrice: "",
    priceCurrency: "chaos",
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function anyActive(range: RangeFilter) {
  return range.min !== "" || range.max !== "";
}

function triState(val: boolean | undefined, filter: string): boolean {
  if (filter === "Any") return true;
  if (filter === "Yes") return !!val;
  if (filter === "No") return !val;
  return true;
}

const ITEM_CATEGORIES = [
  "Any", "Weapon", "Armour", "Accessory", "Flask", "Gem",
  "Jewel", "Map", "Currency", "Card", "Heist", "Sanctum",
];
const RARITY_OPTIONS = ["Any", "Normal", "Magic", "Rare", "Unique"];
const CHAR_CLASSES = ["Any", "Marauder", "Ranger", "Witch", "Duelist", "Templar", "Shadow", "Scion"];
const SALE_TYPES = ["Any", "Buyout or Fixed Price", "Negotiable"];
const CURRENCIES = ["chaos", "divine", "exalted", "regal", "vaal", "alch", "fusing", "alt", "chrome", "scour", "jewellers"];
const TRI_OPTIONS = ["Any", "Yes", "No"];

// ── Shared style primitives ───────────────────────────────────────────────────

const S = {
  input: {
    background: "#0a0a0a",
    border: "1px solid #2e2410",
    borderRadius: 3,
    color: "#c8c8c8",
    fontSize: 11,
    padding: "3px 6px",
    outline: "none",
    fontFamily: "sans-serif",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  select: {
    background: "#0a0a0a",
    border: "1px solid #2e2410",
    borderRadius: 3,
    color: "#c8c8c8",
    fontSize: 11,
    padding: "3px 5px",
    outline: "none",
    fontFamily: "sans-serif",
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  label: {
    fontSize: 11,
    color: "#7f6a3e",
    display: "block",
    marginBottom: 3,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#c8a84b",
    letterSpacing: "0.06em",
    fontFamily: "'Georgia', serif",
    margin: "0 0 8px 0",
    paddingBottom: 4,
    borderBottom: "1px solid #2e2410",
  } as React.CSSProperties,
  filterPanel: {
    background: "#0d0b08",
    border: "1px solid #2e2410",
    borderRadius: 4,
    padding: "10px 12px",
    marginBottom: 6,
  } as React.CSSProperties,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function RangeRow({
  label, value, onChange,
}: {
  label: string;
  value: RangeFilter;
  onChange: (v: RangeFilter) => void;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={S.label}>{label}</label>
      <div style={{ display: "flex", gap: 4 }}>
        <input style={S.input} type="number" placeholder="min" value={value.min}
          onChange={(e) => onChange({ ...value, min: e.target.value })} />
        <input style={S.input} type="number" placeholder="max" value={value.max}
          onChange={(e) => onChange({ ...value, max: e.target.value })} />
      </div>
    </div>
  );
}

function SelectRow({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={S.label}>{label}</label>
      <select style={S.select} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function CollapsibleSection({
  title, children, defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={S.filterPanel}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          width: "100%", textAlign: "left", padding: 0,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <span style={S.sectionTitle}>{title}</span>
        <span style={{ color: "#7f6a3e", fontSize: 12, marginTop: -4 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
      {children}
    </div>
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

  return (
    <li style={{
      background: "linear-gradient(180deg, #1a1208 0%, #0d0d0d 100%)",
      border: `1px solid ${rarity.border}`,
      borderRadius: 4,
      overflow: "hidden",
      fontFamily: "'Georgia', serif",
    }}>
      {/* Header */}
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

      {/* Body */}
      <div style={{ padding: "7px 12px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginBottom: allMods.length ? 5 : 0 }}>
            {item.ilvl !== undefined && (
              <span style={{ fontSize: 11, color: "#7f7f7f" }}>
                Item Level: <span style={{ color: "#c8c8c8" }}>{item.ilvl}</span>
              </span>
            )}
            <span style={{ fontSize: 11, color: "#7f7f7f" }}>{label}</span>
            {item.corrupted && <span style={{ fontSize: 11, color: "#d20000" }}>Corrupted</span>}
            {item.mirrored && <span style={{ fontSize: 11, color: "#7cc7c7" }}>Mirrored</span>}
            {item.fractured && <span style={{ fontSize: 11, color: "#a29160" }}>Fractured</span>}
            {item.synthesised && <span style={{ fontSize: 11, color: "#c98fff" }}>Synthesised</span>}
          </div>
          {allMods.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {item.implicitMods?.map((mod, i) => (
                <div key={`imp-${i}`} style={{ fontSize: 12, color: "#7e98b7", lineHeight: 1.4 }}>{mod}</div>
              ))}
              {item.implicitMods?.length && item.explicitMods?.length ? (
                <div style={{ borderTop: "1px solid #2a2a2a", margin: "3px 0" }} />
              ) : null}
              {item.explicitMods?.map((mod, i) => (
                <div key={`exp-${i}`} style={{ fontSize: 12, color: "#7e98b7", lineHeight: 1.4 }}>{mod}</div>
              ))}
            </div>
          )}
        </div>

        {/* Price + seller */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, minWidth: 72 }}>
          {price ? (
            <div style={{
              background: "rgba(0,0,0,0.5)", border: "1px solid #4a4432",
              borderRadius: 3, padding: "4px 10px", textAlign: "center", lineHeight: 1.3,
            }}>
              <div style={{ fontSize: 13, color: "#c8c8c8", fontWeight: 700, fontFamily: "sans-serif" }}>
                {price.amount % 1 === 0 ? price.amount : price.amount.toFixed(1)}
              </div>
              <div style={{ fontSize: 10, color: "#aa9e82", letterSpacing: "0.04em", fontFamily: "sans-serif" }}>
                {price.currency}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 10, color: "#333", fontStyle: "italic", fontFamily: "sans-serif" }}>no price</div>
          )}
          {item.accountName && (
            <div style={{
              fontSize: 10, color: "#555", textAlign: "right",
              maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
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

export default function ItemSearch({ items, league }: { items: StashItem[]; league: string }) {
  const [f, setF] = useState<Filters>(defaultFilters());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const PAGE_SIZE = 25;

  function setRange(key: keyof Filters, val: RangeFilter) {
    setF((prev) => ({ ...prev, [key]: val }));
    setPage(0);
  }
  function setField<K extends keyof Filters>(key: K, val: Filters[K]) {
    setF((prev) => ({ ...prev, [key]: val }));
    setPage(0);
  }

  const filtered = useMemo(() => {
    return items
      .filter((item) => {
        const q = f.query.trim().toLowerCase();
        if (q) {
          const hay = `${item.name} ${item.typeLine} ${item.baseType ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }

        // Rarity
        if (f.itemRarity !== "Any" && frameLabel(item) !== f.itemRarity) return false;

        // Misc boolean filters
        if (!triState(item.identified, f.identified)) return false;
        if (!triState(item.corrupted, f.corrupted)) return false;
        if (!triState(item.mirrored, f.mirrored)) return false;
        if (!triState(item.split, f.split)) return false;
        if (!triState(item.fractured, f.fractured)) return false;
        if (!triState(item.synthesised, f.synthesised)) return false;

        // Item level
        if (anyActive(f.itemLevel) && !inRange(item.ilvl ?? null, f.itemLevel)) return false;

        // Quality
        if (anyActive(f.quality) && !inRange(item.quality ?? null, f.quality)) return false;

        // Gem level
        if (anyActive(f.gemLevel) && !inRange(item.gemLevel ?? null, f.gemLevel)) return false;

        // Armour filters
        if (anyActive(f.armour) && !inRange(getPropValue(item, "Armour"), f.armour)) return false;
        if (anyActive(f.evasion) && !inRange(getPropValue(item, "Evasion Rating"), f.evasion)) return false;
        if (anyActive(f.energyShield) && !inRange(getPropValue(item, "Energy Shield"), f.energyShield)) return false;
        if (anyActive(f.ward) && !inRange(getPropValue(item, "Ward"), f.ward)) return false;
        if (anyActive(f.block) && !inRange(getPropValue(item, "Chance to Block"), f.block)) return false;

        // Weapon filters
        if (anyActive(f.aps) && !inRange(getPropValue(item, "Attacks per Second"), f.aps)) return false;
        if (anyActive(f.critChance) && !inRange(getPropValue(item, "Critical Strike Chance"), f.critChance)) return false;

        // Requirements
        const reqMap: Record<string, number> = {};
        item.requirements?.forEach((r) => { reqMap[r.name] = r.value; });
        if (anyActive(f.reqLevel) && !inRange(reqMap["Level"] ?? null, f.reqLevel)) return false;
        if (anyActive(f.reqStr) && !inRange(reqMap["Str"] ?? null, f.reqStr)) return false;
        if (anyActive(f.reqDex) && !inRange(reqMap["Dex"] ?? null, f.reqDex)) return false;
        if (anyActive(f.reqInt) && !inRange(reqMap["Int"] ?? null, f.reqInt)) return false;

        // Sockets
        if (anyActive(f.sockets)) {
          const count = item.sockets?.length ?? 0;
          if (!inRange(count, f.sockets)) return false;
        }
        if (anyActive(f.links)) {
          const groups: Record<number, number> = {};
          item.sockets?.forEach((s) => { groups[s.group] = (groups[s.group] ?? 0) + 1; });
          const maxLink = Math.max(0, ...Object.values(groups));
          if (!inRange(maxLink, f.links)) return false;
        }

        // Seller account
        if (f.sellerAccount.trim()) {
          if (!item.accountName?.toLowerCase().includes(f.sellerAccount.trim().toLowerCase())) return false;
        }

        // Price filter
        if (f.minPrice !== "" || f.maxPrice !== "") {
          const price = parsePrice(item.note);
          if (!price || price.currency !== f.priceCurrency) return false;
          if (f.minPrice !== "" && price.amount < parseFloat(f.minPrice)) return false;
          if (f.maxPrice !== "" && price.amount > parseFloat(f.maxPrice)) return false;
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
  }, [items, f, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  }

  function clearAll() {
    setF(defaultFilters());
    setPage(0);
  }

  return (
    <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, alignItems: "start" }}>

      {/* ── Left: filter sidebar ── */}
      <aside>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ ...S.sectionTitle, margin: 0, borderBottom: "none", fontSize: 13 }}>Filters</span>
          <button onClick={clearAll} style={{
            background: "none", border: "1px solid #2e2410", borderRadius: 3,
            color: "#7f6a3e", fontSize: 10, padding: "2px 8px", cursor: "pointer", fontFamily: "sans-serif",
          }}>Clear All</button>
        </div>

        {/* Type Filters */}
        <CollapsibleSection title="Type Filters" defaultOpen>
          <SelectRow label="Item Category" value={f.itemCategory}
            options={ITEM_CATEGORIES} onChange={(v) => setField("itemCategory", v)} />
          <SelectRow label="Item Rarity" value={f.itemRarity}
            options={RARITY_OPTIONS} onChange={(v) => setField("itemRarity", v)} />
        </CollapsibleSection>

        {/* Weapon Filters */}
        <CollapsibleSection title="Weapon Filters">
          <TwoCol>
            <RangeRow label="Damage" value={f.damage} onChange={(v) => setRange("damage", v)} />
            <RangeRow label="Attacks per Second" value={f.aps} onChange={(v) => setRange("aps", v)} />
            <RangeRow label="Critical Chance" value={f.critChance} onChange={(v) => setRange("critChance", v)} />
            <RangeRow label="Damage per Second" value={f.dps} onChange={(v) => setRange("dps", v)} />
            <RangeRow label="Physical DPS" value={f.physDps} onChange={(v) => setRange("physDps", v)} />
            <RangeRow label="Elemental DPS" value={f.elemDps} onChange={(v) => setRange("elemDps", v)} />
          </TwoCol>
        </CollapsibleSection>

        {/* Armour Filters */}
        <CollapsibleSection title="Armour Filters">
          <TwoCol>
            <RangeRow label="Armour" value={f.armour} onChange={(v) => setRange("armour", v)} />
            <RangeRow label="Evasion" value={f.evasion} onChange={(v) => setRange("evasion", v)} />
            <RangeRow label="Energy Shield" value={f.energyShield} onChange={(v) => setRange("energyShield", v)} />
            <RangeRow label="Ward" value={f.ward} onChange={(v) => setRange("ward", v)} />
            <RangeRow label="Block" value={f.block} onChange={(v) => setRange("block", v)} />
            <RangeRow label="Base Percentile" value={f.basePercentile} onChange={(v) => setRange("basePercentile", v)} />
          </TwoCol>
        </CollapsibleSection>

        {/* Socket Filters */}
        <CollapsibleSection title="Socket Filters">
          <RangeRow label="Sockets" value={f.sockets} onChange={(v) => setRange("sockets", v)} />
          <RangeRow label="Linked Sockets" value={f.links} onChange={(v) => setRange("links", v)} />
        </CollapsibleSection>

        {/* Requirements */}
        <CollapsibleSection title="Requirements">
          <TwoCol>
            <RangeRow label="Level" value={f.reqLevel} onChange={(v) => setRange("reqLevel", v)} />
            <RangeRow label="Strength" value={f.reqStr} onChange={(v) => setRange("reqStr", v)} />
            <RangeRow label="Dexterity" value={f.reqDex} onChange={(v) => setRange("reqDex", v)} />
            <RangeRow label="Intelligence" value={f.reqInt} onChange={(v) => setRange("reqInt", v)} />
          </TwoCol>
          <SelectRow label="Character Class" value={f.charClass}
            options={CHAR_CLASSES} onChange={(v) => setField("charClass", v)} />
        </CollapsibleSection>

        {/* Miscellaneous */}
        <CollapsibleSection title="Miscellaneous">
          <TwoCol>
            <RangeRow label="Quality" value={f.quality} onChange={(v) => setRange("quality", v)} />
            <RangeRow label="Item Level" value={f.itemLevel} onChange={(v) => setRange("itemLevel", v)} />
            <RangeRow label="Gem Level" value={f.gemLevel} onChange={(v) => setRange("gemLevel", v)} />
          </TwoCol>
          <TwoCol>
            <SelectRow label="Identified" value={f.identified} options={TRI_OPTIONS} onChange={(v) => setField("identified", v)} />
            <SelectRow label="Corrupted" value={f.corrupted} options={TRI_OPTIONS} onChange={(v) => setField("corrupted", v)} />
            <SelectRow label="Mirrored" value={f.mirrored} options={TRI_OPTIONS} onChange={(v) => setField("mirrored", v)} />
            <SelectRow label="Split" value={f.split} options={TRI_OPTIONS} onChange={(v) => setField("split", v)} />
            <SelectRow label="Fractured" value={f.fractured} options={TRI_OPTIONS} onChange={(v) => setField("fractured", v)} />
            <SelectRow label="Synthesised" value={f.synthesised} options={TRI_OPTIONS} onChange={(v) => setField("synthesised", v)} />
          </TwoCol>
        </CollapsibleSection>

        {/* Trade Filters */}
        <CollapsibleSection title="Trade Filters" defaultOpen>
          <div style={{ marginBottom: 6 }}>
            <label style={S.label}>Seller Account</label>
            <input style={S.input} type="text" placeholder="Enter account name…"
              value={f.sellerAccount}
              onChange={(e) => setField("sellerAccount", e.target.value)} />
          </div>
          <SelectRow label="Sale Type" value={f.saleType} options={SALE_TYPES}
            onChange={(v) => setField("saleType", v)} />
          <div style={{ marginBottom: 6 }}>
            <label style={S.label}>Buyout Price</label>
            <div style={{ display: "flex", gap: 4 }}>
              <input style={S.input} type="number" placeholder="min" value={f.minPrice}
                onChange={(e) => setField("minPrice", e.target.value)} />
              <input style={S.input} type="number" placeholder="max" value={f.maxPrice}
                onChange={(e) => setField("maxPrice", e.target.value)} />
            </div>
            <select style={{ ...S.select, marginTop: 4 }} value={f.priceCurrency}
              onChange={(e) => setField("priceCurrency", e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </CollapsibleSection>
      </aside>

      {/* ── Right: results ── */}
      <main>
        {/* Search bar + sort */}
        <div style={{ marginBottom: 10 }}>
          <input
            style={{
              ...S.input, fontSize: 13, padding: "7px 10px",
              marginBottom: 8, borderColor: "#3e3418",
            }}
            type="text"
            placeholder="Search Items…"
            value={f.query}
            onChange={(e) => setField("query", e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#444", marginRight: 4 }}>
              {filtered.length} results — Sort:
            </span>
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
        </div>

        {/* Results list */}
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
      </main>
    </div>
  );
}
