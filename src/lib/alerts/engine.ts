import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getAppSettings } from "@/lib/settings";
import type { AlertType, DealColor } from "@/generated/prisma/enums";

/**
 * Alert engine.
 *
 * Called after each ingestion/recompute cycle with per-property change facts.
 * Every alert explains WHY it fired (reasons[]), fans out to all active users,
 * and is delivered by email when SMTP is configured (console fallback in dev).
 */

export interface PropertyChangeFacts {
  propertyId: string;
  address: string;
  isNewProperty: boolean;
  prevColor: DealColor | null;
  newColor: DealColor;
  prevRatioPct: number | null;
  newRatioPct: number | null;
  prevPrice: number | null;
  newPrice: number | null;
  prevStatus: string | null;
  newStatus: string | null;
  daysOnMarket: number | null;
  cashFlowMonthly: number | null;
  dscr: number | null;
}

interface PendingAlert {
  type: AlertType;
  title: string;
  reasons: string[];
  propertyId: string;
}

const GREENS: DealColor[] = ["GREEN", "DARK_GREEN"];

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

export async function evaluateAlertsForChanges(changes: PropertyChangeFacts[]): Promise<number> {
  if (changes.length === 0) return 0;
  const settings = await getAppSettings();
  const rules = settings.alerts;
  const pending: PendingAlert[] = [];

  for (const c of changes) {
    // 1) New GREEN / DARK GREEN deal detected
    if (c.isNewProperty && GREENS.includes(c.newColor)) {
      const reasons = [
        `Classified ${c.newColor.replace("_", " ")} on first ingestion.`,
      ];
      if (c.newRatioPct != null) reasons.push(`Rent-to-price ratio ${fmtPct(c.newRatioPct)}.`);
      if (c.cashFlowMonthly != null) reasons.push(`Projected cash flow ${fmtMoney(c.cashFlowMonthly)}/mo at default assumptions.`);
      if (c.dscr != null) reasons.push(`DSCR ${c.dscr.toFixed(2)}.`);
      pending.push({
        type: "NEW_GREEN_DEAL",
        title: `New ${c.newColor === "DARK_GREEN" ? "dark green" : "green"} deal: ${c.address}`,
        reasons,
        propertyId: c.propertyId,
      });
    }

    // 2) Ratio target crossed (e.g. crossed 2.0%)
    if (
      c.newRatioPct != null &&
      c.newRatioPct >= rules.ratioTargetPct &&
      (c.prevRatioPct == null || c.prevRatioPct < rules.ratioTargetPct) &&
      !c.isNewProperty
    ) {
      pending.push({
        type: "RATIO_TARGET_CROSSED",
        title: `${c.address} crossed the ${rules.ratioTargetPct}% rent-to-price target`,
        reasons: [
          `Ratio moved from ${c.prevRatioPct != null ? fmtPct(c.prevRatioPct) : "unknown"} to ${fmtPct(c.newRatioPct)}.`,
          c.prevPrice != null && c.newPrice != null && c.newPrice < c.prevPrice
            ? `Driven by a price change from ${fmtMoney(c.prevPrice)} to ${fmtMoney(c.newPrice)}.`
            : `Threshold is configurable in Settings → Alerts.`,
        ],
        propertyId: c.propertyId,
      });
    }

    // 3) Meaningful price reduction
    if (c.prevPrice != null && c.newPrice != null && c.newPrice < c.prevPrice) {
      const dropPct = ((c.prevPrice - c.newPrice) / c.prevPrice) * 100;
      if (dropPct >= rules.priceDropMinPct) {
        const reasons = [
          `Price reduced ${fmtPct(dropPct)}: ${fmtMoney(c.prevPrice)} → ${fmtMoney(c.newPrice)}.`,
        ];
        if (c.newRatioPct != null) reasons.push(`Rent-to-price ratio is now ${fmtPct(c.newRatioPct)}.`);
        pending.push({
          type: "PRICE_REDUCTION",
          title: `Price reduction on ${c.address}`,
          reasons,
          propertyId: c.propertyId,
        });
      }
    }

    // 4) Deal became viable (RED/YELLOW → GREEN family)
    if (
      !c.isNewProperty &&
      c.prevColor != null &&
      !GREENS.includes(c.prevColor) &&
      GREENS.includes(c.newColor)
    ) {
      const reasons = [
        `Classification changed ${c.prevColor.replace("_", " ")} → ${c.newColor.replace("_", " ")}.`,
      ];
      if (c.prevPrice != null && c.newPrice != null && c.newPrice !== c.prevPrice) {
        reasons.push(`Price changed ${fmtMoney(c.prevPrice)} → ${fmtMoney(c.newPrice)}.`);
      }
      if (c.newRatioPct != null) reasons.push(`Ratio now ${fmtPct(c.newRatioPct)}.`);
      pending.push({
        type: "DEAL_BECAME_VIABLE",
        title: `${c.address} became viable`,
        reasons,
        propertyId: c.propertyId,
      });
    }

    // 5) Status change on a tracked (pipeline) property
    if (c.prevStatus != null && c.newStatus != null && c.prevStatus !== c.newStatus) {
      const tracked = await prisma.pipelineItem.findUnique({ where: { propertyId: c.propertyId } });
      if (tracked) {
        pending.push({
          type: "STATUS_CHANGE",
          title: `Status change: ${c.address} is now ${c.newStatus}`,
          reasons: [
            `Listing status moved ${c.prevStatus} → ${c.newStatus}.`,
            `This property is in your pipeline (stage: ${tracked.stage.replaceAll("_", " ")}).`,
          ],
          propertyId: c.propertyId,
        });
      }
    }

    // 6) Long days-on-market → negotiation leverage (once per property)
    if (
      c.daysOnMarket != null &&
      c.daysOnMarket >= rules.staleListingDays &&
      GREENS.concat("YELLOW").includes(c.newColor)
    ) {
      const already = await prisma.alert.findFirst({
        where: { propertyId: c.propertyId, type: "STALE_LISTING_LEVERAGE" },
      });
      if (!already) {
        pending.push({
          type: "STALE_LISTING_LEVERAGE",
          title: `Negotiation leverage: ${c.address} has sat ${c.daysOnMarket} days`,
          reasons: [
            `Days on market (${c.daysOnMarket}) exceeds the ${rules.staleListingDays}-day leverage threshold.`,
            `Long market time often signals seller flexibility on price or terms.`,
          ],
          propertyId: c.propertyId,
        });
      }
    }
  }

  if (pending.length === 0) return 0;

  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  let created = 0;

  for (const alert of pending) {
    for (const user of users) {
      await prisma.alert.create({
        data: {
          type: alert.type,
          title: alert.title,
          reasons: alert.reasons,
          propertyId: alert.propertyId,
          userId: user.id,
        },
      });
      created++;
    }
    // One email per alert per user (console fallback without SMTP).
    for (const user of users) {
      const res = await sendEmail({
        to: user.email,
        subject: `[DealScout] ${alert.title}`,
        text: `${alert.title}\n\nWhy this alert fired:\n${alert.reasons.map((r) => `• ${r}`).join("\n")}\n\nOpen DealScout to review the deal.`,
      });
      if (res.delivered) {
        await prisma.alert.updateMany({
          where: { propertyId: alert.propertyId, userId: user.id, type: alert.type, emailed: false },
          data: { emailed: true },
        });
      }
    }
  }

  return created;
}
