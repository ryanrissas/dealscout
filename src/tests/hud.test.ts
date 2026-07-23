import { describe, it, expect } from "vitest";
import { findFmrForZip, fmrForBedrooms, utilityAllowanceForBedrooms } from "@/lib/hud/lookup";
import { HUD_FMR_SEED, UTILITY_ALLOWANCE_SEED } from "@/lib/hud/fmrData";

describe("HUD FMR lookup", () => {
  it("prefers ZIP-level SAFMR over metro FMR", () => {
    const res = findFmrForZip(HUD_FMR_SEED, "43605")!;
    expect(res.usedSafmr).toBe(true);
    expect(res.record.twoBr).toBe(1080);
    expect(res.record.fiscalYear).toBe(2026);
  });
  it("falls back to the latest metro FMR for a ZIP without SAFMR data", () => {
    const res = findFmrForZip(HUD_FMR_SEED, "43699")!;
    expect(res.usedSafmr).toBe(false);
    expect(res.record.fiscalYear).toBe(2026); // 2026 metro row outranks 2025
    expect(res.record.oneBr).toBe(820);
  });
  it("maps bedroom counts to the right column, incl. HUD's 5+BR convention", () => {
    const rec = findFmrForZip(HUD_FMR_SEED, "43608")!.record;
    expect(fmrForBedrooms(rec, 0)).toBe(700);
    expect(fmrForBedrooms(rec, 1)).toBe(740);
    expect(fmrForBedrooms(rec, 2)).toBe(970);
    expect(fmrForBedrooms(rec, 3)).toBe(1250);
    expect(fmrForBedrooms(rec, 4)).toBe(1310);
    expect(fmrForBedrooms(rec, 6)).toBe(Math.round(1310 * 1.3)); // 4BR + 15%/extra BR
  });
  it("utility allowance by bedroom count (5+BR uses the 4BR schedule row)", () => {
    expect(utilityAllowanceForBedrooms(UTILITY_ALLOWANCE_SEED, 2)).toBe(150);
    expect(utilityAllowanceForBedrooms(UTILITY_ALLOWANCE_SEED, 5)).toBe(230);
    expect(utilityAllowanceForBedrooms([], 2)).toBeNull();
  });
});
