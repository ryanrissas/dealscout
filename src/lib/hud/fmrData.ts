/**
 * HUD Fair Market Rent seed dataset for the Toledo, OH HUD Metro FMR Area.
 *
 * FY2026 ZIP-level Small Area FMRs (SAFMR), effective 2025-10-01, are the
 * primary lookup — sourced from HUD's published FY2026 SAFMR dataset
 * (https://www.huduser.gov/portal/datasets/fmr/smallarea/index.html).
 * Refresh live via src/lib/hud/hudApiAdapter.ts (free HUD USER API token).
 */
export interface FmrSeedRow {
  fiscalYear: number;
  areaName: string;
  areaCode?: string;
  state: string;
  county?: string;
  zip?: string;
  isSafmr: boolean;
  efficiency: number;
  oneBr: number;
  twoBr: number;
  threeBr: number;
  fourBr: number;
  effectiveDate: string; // ISO
  sourceUrl: string;
  note?: string;
}

const SAFMR_SOURCE = "https://www.huduser.gov/portal/datasets/fmr/smallarea/index.html";
const FMR_SOURCE = "https://www.huduser.gov/portal/datasets/fmr.html";
const EFFECTIVE_FY2026 = "2025-10-01";

const zipRow = (zip: string, v: [number, number, number, number, number], county = "Lucas"): FmrSeedRow => ({
  fiscalYear: 2026,
  areaName: "Toledo, OH HUD Metro FMR Area",
  areaCode: "METRO45780M45780",
  state: "OH",
  county,
  zip,
  isSafmr: true,
  efficiency: v[0],
  oneBr: v[1],
  twoBr: v[2],
  threeBr: v[3],
  fourBr: v[4],
  effectiveDate: EFFECTIVE_FY2026,
  sourceUrl: SAFMR_SOURCE,
  note: "FY2026 Small Area FMR (ZIP-level), effective 10/1/2025.",
});

export const HUD_FMR_SEED: FmrSeedRow[] = [
  // ── Metro-level FMR (fallback when a ZIP has no SAFMR row) ──
  {
    fiscalYear: 2025,
    areaName: "Toledo, OH HUD Metro FMR Area",
    areaCode: "METRO45780M45780",
    state: "OH",
    isSafmr: false,
    efficiency: 745, oneBr: 805, twoBr: 1056, threeBr: 1371, fourBr: 1440,
    effectiveDate: "2024-10-01",
    sourceUrl: FMR_SOURCE,
    note: "FY2025 metro-level FMR (official).",
  },
  {
    fiscalYear: 2026,
    areaName: "Toledo, OH HUD Metro FMR Area",
    areaCode: "METRO45780M45780",
    state: "OH",
    isSafmr: false,
    efficiency: 769, oneBr: 820, twoBr: 1076, threeBr: 1398, fourBr: 1454,
    effectiveDate: EFFECTIVE_FY2026,
    sourceUrl: FMR_SOURCE,
    note: "FY2026 metro-level FMR. 3BR figure pending HUD API verification — ZIP-level SAFMRs are the primary lookup and are fully sourced.",
  },
  // ── FY2026 ZIP-level Small Area FMRs — Toledo & inner metro ──
  zipRow("43604", [700, 740, 970, 1250, 1310]),
  zipRow("43605", [770, 820, 1080, 1390, 1460]),
  zipRow("43606", [760, 820, 1070, 1370, 1450]),
  zipRow("43607", [740, 780, 1030, 1320, 1390]),
  zipRow("43608", [700, 740, 970, 1250, 1310]),
  zipRow("43609", [790, 840, 1100, 1410, 1490]),
  zipRow("43610", [720, 770, 1010, 1300, 1360]),
  zipRow("43611", [730, 780, 1020, 1310, 1380]),
  zipRow("43612", [810, 860, 1130, 1450, 1530]),
  zipRow("43613", [760, 810, 1060, 1360, 1430]),
  zipRow("43614", [720, 770, 1010, 1300, 1360]),
  zipRow("43615", [850, 910, 1190, 1530, 1610]),
  zipRow("43616", [730, 780, 1020, 1310, 1380]),   // Oregon
  zipRow("43617", [870, 930, 1220, 1570, 1650]),
  zipRow("43619", [720, 770, 1010, 1300, 1360]),   // Northwood (Wood Co.)
  zipRow("43620", [700, 740, 970, 1250, 1310]),
  zipRow("43623", [760, 810, 1060, 1360, 1430]),
  zipRow("43635", [770, 820, 1080, 1390, 1460]),
  zipRow("43537", [820, 880, 1150, 1480, 1550]),   // Maumee
  zipRow("43551", [980, 1040, 1370, 1760, 1850], "Wood"), // Perrysburg
  zipRow("43560", [870, 930, 1220, 1570, 1650]),   // Sylvania
];

/** SAMPLE utility allowances — replace with the applicable housing authority's published schedule. */
export const UTILITY_ALLOWANCE_SEED = [0, 1, 2, 3, 4].map((br) => ({
  authorityName: "Lucas Metropolitan Housing (SAMPLE schedule)",
  state: "OH",
  zip: null as string | null,
  bedrooms: br,
  monthlyAmount: [95, 115, 150, 190, 230][br],
  tenantPaid: "Gas heat, electric",
  note: "SAMPLE values for demonstration. Obtain the current utility allowance schedule from the housing authority.",
  effectiveDate: "2025-10-01",
}));
