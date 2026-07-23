export const money = (n: number | null | undefined, cents = false): string =>
  n == null ? "Unknown" : `$${n.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;

export const pct = (n: number | null | undefined, digits = 2): string =>
  n == null ? "Unknown" : `${n.toFixed(digits)}%`;

export const num = (n: number | null | undefined, digits = 2): string =>
  n == null ? "Unknown" : n.toFixed(digits);

export const int = (n: number | null | undefined): string =>
  n == null ? "Unknown" : n.toLocaleString("en-US");

export const dateShort = (d: Date | string | null | undefined): string => {
  if (!d) return "Unknown";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const daysOnMarket = (listDate: Date | string | null | undefined): number | null => {
  if (!listDate) return null;
  const dt = typeof listDate === "string" ? new Date(listDate) : listDate;
  return Math.max(0, Math.floor((Date.now() - dt.getTime()) / 86_400_000));
};

export const colorLabel = (c: string): string =>
  ({ DARK_GREEN: "Dark green", GREEN: "Green", YELLOW: "Yellow", RED: "Red" }[c] ?? c);

export const stageLabel = (s: string): string =>
  ({
    NEW: "New", REVIEWING: "Reviewing", CONTACT_AGENT: "Contact agent", UNDERWRITING: "Underwriting",
    OFFER_PLANNED: "Offer planned", OFFER_SUBMITTED: "Offer submitted", UNDER_CONTRACT: "Under contract",
    PASSED: "Passed", CLOSED: "Closed",
  }[s] ?? s);

export const typeLabel = (t: string): string =>
  ({
    SINGLE_FAMILY: "Single family", DUPLEX: "Duplex", TRIPLEX: "Triplex", FOURPLEX: "Fourplex",
    MULTI_5_20: "5–20 units", MULTI_20_PLUS: "20+ units",
  }[t] ?? t);

export const rentKindLabel = (k: string | null | undefined): string =>
  k == null
    ? "Unknown"
    : ({ ACTUAL: "Actual", PRO_FORMA: "Pro forma", MARKET_ESTIMATE: "Market estimate", HUD_BENCHMARK: "HUD benchmark" }[k] ?? k);
