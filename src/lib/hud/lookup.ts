/**
 * HUD FMR/SAFMR lookup. ZIP-level SAFMR (latest fiscal year) takes precedence;
 * falls back to the metro/county-level FMR. Units with 5+ bedrooms use HUD's
 * published convention: 4BR FMR + 15% per additional bedroom.
 */
export interface FmrRecordLike {
  fiscalYear: number;
  areaName: string;
  zip?: string | null;
  isSafmr: boolean;
  efficiency: number;
  oneBr: number;
  twoBr: number;
  threeBr: number;
  fourBr: number;
  effectiveDate: Date | string;
  sourceUrl: string;
  note?: string | null;
}

export interface FmrLookupResult {
  record: FmrRecordLike;
  usedSafmr: boolean;
}

export function findFmrForZip(records: FmrRecordLike[], zip: string): FmrLookupResult | null {
  const byYearDesc = (a: FmrRecordLike, b: FmrRecordLike) => b.fiscalYear - a.fiscalYear;
  const safmr = records.filter((r) => r.isSafmr && r.zip === zip).sort(byYearDesc)[0];
  if (safmr) return { record: safmr, usedSafmr: true };
  const metro = records.filter((r) => !r.isSafmr).sort(byYearDesc)[0];
  if (metro) return { record: metro, usedSafmr: false };
  return null;
}

export function fmrForBedrooms(record: FmrRecordLike, bedrooms: number): number {
  if (bedrooms <= 0) return record.efficiency;
  if (bedrooms === 1) return record.oneBr;
  if (bedrooms === 2) return record.twoBr;
  if (bedrooms === 3) return record.threeBr;
  if (bedrooms === 4) return record.fourBr;
  // HUD convention: +15% of the 4BR FMR per bedroom above four.
  return Math.round(record.fourBr * (1 + 0.15 * (bedrooms - 4)));
}

export function utilityAllowanceForBedrooms(
  allowances: Array<{ bedrooms: number; monthlyAmount: number }>,
  bedrooms: number
): number | null {
  const capped = Math.min(Math.max(bedrooms, 0), 4);
  const exact = allowances.find((a) => a.bedrooms === capped);
  return exact ? exact.monthlyAmount : null;
}
