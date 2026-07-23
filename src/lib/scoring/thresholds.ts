import type { PropertyType } from "@/generated/prisma/enums";

/**
 * All classification thresholds are customizable (Settings → Scoring).
 * Defaults implement the spec'd GREEN / DARK GREEN / YELLOW / RED rules.
 */
export interface ScoringThresholds {
  minYearBuilt: number;            // properties older than this → RED
  allowedPropertyTypes: PropertyType[]; // types outside the list → RED
  yellowRatioFloorPct: number;     // ratio below this → RED (default 1.0)
  greenRatioPct: number;           // GREEN needs ≥ this (default 1.5)
  darkGreenRatioPct: number;       // DARK GREEN needs ≥ this (default 2.0)
  greenMinDscr: number;            // 1.25
  darkGreenMinDscr: number;        // 1.50
  targetCapRatePct: number;        // dark green must exceed (default 8)
  targetCocPct: number;            // dark green must exceed (default 10)
  darkGreenMinCfPerUnit: number;   // "strong positive cash flow" ($/unit/mo, default 100)
}

export interface Section8Thresholds {
  paymentStandardPct: number;      // % of FMR/SAFMR used as est. payment standard (default 100)
  greenMinDscr: number;            // 1.25
  darkGreenMinDscr: number;        // 1.50
  darkGreenMinCfPerUnit: number;   // 150
  darkGreenUpliftPct: number;      // HUD benchmark ≥ current rent by this % (default 15)
}

export interface AlertRules {
  ratioTargetPct: number;          // alert when a deal crosses this ratio (default 2.0)
  priceDropMinPct: number;         // meaningful price reduction (default 3)
  staleListingDays: number;        // negotiation-leverage threshold (default 90)
}

export interface AppSettings {
  thresholds: ScoringThresholds;
  section8: Section8Thresholds;
  alerts: AlertRules;
}

export const ALL_PROPERTY_TYPES: PropertyType[] = [
  "SINGLE_FAMILY",
  "DUPLEX",
  "TRIPLEX",
  "FOURPLEX",
  "MULTI_5_20",
  "MULTI_20_PLUS",
];

export const DEFAULT_SETTINGS: AppSettings = {
  thresholds: {
    minYearBuilt: 1950,
    allowedPropertyTypes: ALL_PROPERTY_TYPES,
    yellowRatioFloorPct: 1.0,
    greenRatioPct: 1.5,
    darkGreenRatioPct: 2.0,
    greenMinDscr: 1.25,
    darkGreenMinDscr: 1.5,
    targetCapRatePct: 8,
    targetCocPct: 10,
    darkGreenMinCfPerUnit: 100,
  },
  section8: {
    paymentStandardPct: 100,
    greenMinDscr: 1.25,
    darkGreenMinDscr: 1.5,
    darkGreenMinCfPerUnit: 150,
    darkGreenUpliftPct: 15,
  },
  alerts: {
    ratioTargetPct: 2.0,
    priceDropMinPct: 3,
    staleListingDays: 90,
  },
};
