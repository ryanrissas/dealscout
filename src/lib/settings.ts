import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { AppSettings, DEFAULT_SETTINGS } from "@/lib/scoring/thresholds";
import {
  DEFAULT_ASSUMPTIONS,
  mergeAssumptions,
  type FinancingAssumptions,
  type OpexAssumptions,
  type UnderwriteAssumptions,
} from "@/lib/finance/underwriting";

/**
 * Application settings + assumption resolution.
 *
 * - A single AppSetting row (id="global") stores JSON for scoring thresholds,
 *   Section 8 config, and alert rules. Missing keys fall back to defaults so
 *   adding new settings never breaks older rows.
 * - Underwriting assumptions resolve in scope order:
 *   PROPERTY override > MARKET profile > GLOBAL profile > code defaults.
 *   AssumptionProfile.data stores { financing?: Partial<...>, opex?: Partial<...> }.
 */

export type AssumptionOverride = {
  financing?: Partial<FinancingAssumptions>;
  opex?: Partial<OpexAssumptions>;
};

type Jsonish = Record<string, unknown>;
const asJson = (v: unknown) => v as Prisma.InputJsonValue;

function mergeSettings(stored: Jsonish | null | undefined): AppSettings {
  if (!stored) return DEFAULT_SETTINGS;
  const s = stored as Partial<AppSettings>;
  return {
    thresholds: { ...DEFAULT_SETTINGS.thresholds, ...(s.thresholds ?? {}) },
    section8: { ...DEFAULT_SETTINGS.section8, ...(s.section8 ?? {}) },
    alerts: { ...DEFAULT_SETTINGS.alerts, ...(s.alerts ?? {}) },
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const row = await prisma.appSetting.findUnique({ where: { id: "global" } });
  return mergeSettings((row?.data as Jsonish | undefined) ?? null);
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global", data: asJson(settings) },
    update: { data: asJson(settings) },
  });
}

function overrideFromProfile(data: unknown): AssumptionOverride | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Jsonish;
  const out: AssumptionOverride = {};
  if (d.financing && typeof d.financing === "object") {
    out.financing = d.financing as Partial<FinancingAssumptions>;
  }
  if (d.opex && typeof d.opex === "object") out.opex = d.opex as Partial<OpexAssumptions>;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Resolve the effective underwriting assumptions for a property.
 * Pass marketId/propertyId as available; either may be null.
 */
export async function resolveAssumptions(opts: {
  marketId?: string | null;
  propertyId?: string | null;
}): Promise<{ assumptions: UnderwriteAssumptions; sources: string[] }> {
  const sources: string[] = ["defaults"];
  const overrides: Array<AssumptionOverride | null> = [];

  const globalProfile = await prisma.assumptionProfile.findFirst({
    where: { scope: "GLOBAL" },
    orderBy: { updatedAt: "desc" },
  });
  if (globalProfile) {
    overrides.push(overrideFromProfile(globalProfile.data));
    sources.push(`global:${globalProfile.name}`);
  }

  if (opts.marketId) {
    const marketProfile = await prisma.assumptionProfile.findFirst({
      where: { scope: "MARKET", marketId: opts.marketId },
      orderBy: { updatedAt: "desc" },
    });
    if (marketProfile) {
      overrides.push(overrideFromProfile(marketProfile.data));
      sources.push(`market:${marketProfile.name}`);
    }
  }

  if (opts.propertyId) {
    const propProfile = await prisma.assumptionProfile.findFirst({
      where: { scope: "PROPERTY", propertyId: opts.propertyId },
      orderBy: { updatedAt: "desc" },
    });
    if (propProfile) {
      overrides.push(overrideFromProfile(propProfile.data));
      sources.push(`property:${propProfile.name}`);
    }
  }

  return { assumptions: mergeAssumptions(DEFAULT_ASSUMPTIONS, ...overrides), sources };
}

export async function saveGlobalAssumptions(override: AssumptionOverride): Promise<void> {
  const existing = await prisma.assumptionProfile.findFirst({ where: { scope: "GLOBAL" } });
  if (existing) {
    const prev = overrideFromProfile(existing.data) ?? {};
    const merged: AssumptionOverride = {
      financing: { ...prev.financing, ...override.financing },
      opex: { ...prev.opex, ...override.opex },
    };
    await prisma.assumptionProfile.update({
      where: { id: existing.id },
      data: { data: asJson(merged) },
    });
  } else {
    await prisma.assumptionProfile.create({
      data: { name: "Global defaults", scope: "GLOBAL", data: asJson(override) },
    });
  }
}
