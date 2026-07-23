import type { FetchParams, ListingProviderAdapter, NormalizedListing } from "@/lib/providers/types";

/**
 * RESO Web API adapter (skeleton, ready for credentials).
 *
 * Works with any RESO Web API–compliant feed you are licensed for, e.g.:
 *  - MLS Grid (https://www.mlsgrid.com) — many Midwest MLSs incl. Ohio
 *  - CoreLogic Trestle (https://trestle.corelogic.com)
 *  - Bridge Interactive / Zillow Group Bridge API (https://www.bridgeinteractive.com)
 *  - Spark API by FBS (https://sparkplatform.com)
 *
 * Configure in .env:
 *   RESO_API_BASE_URL=https://api.mlsgrid.com/v2      (example)
 *   RESO_API_TOKEN=...                                 (OAuth bearer token)
 *   RESO_ORIGINATING_SYSTEM=nworis                     (your MLS's system name, if required)
 *
 * IMPORTANT: use only feeds you have a data-license agreement for, and follow
 * the feed's display/refresh rules. This adapter never scrapes websites.
 */
export const resoAdapter: ListingProviderAdapter = {
  key: "RESO_WEB_API",
  name: "RESO Web API (MLS)",
  kind: "mls_reso",
  priority: 10,
  website: "https://www.reso.org/reso-web-api/",

  isConfigured() {
    return Boolean(process.env.RESO_API_BASE_URL && process.env.RESO_API_TOKEN);
  },

  async fetchListings(params: FetchParams): Promise<NormalizedListing[]> {
    if (!this.isConfigured()) {
      throw new Error(
        "RESO adapter not configured. Set RESO_API_BASE_URL and RESO_API_TOKEN in .env (see docs/data-providers.md)."
      );
    }
    const base = process.env.RESO_API_BASE_URL!.replace(/\/$/, "");
    const filters: string[] = ["StandardStatus eq 'Active'"];
    // Residential Income covers 2–4 units in most feeds; CommercialSale/MultiFamily covers 5+.
    filters.push("(PropertyType eq 'Residential Income' or PropertyType eq 'Residential' or PropertySubType eq 'Multi Family')");
    if (params.city) filters.push(`City eq '${params.city.replace(/'/g, "''")}'`);
    if (params.state) filters.push(`StateOrProvince eq '${params.state}'`);
    if (params.minPrice) filters.push(`ListPrice ge ${params.minPrice}`);
    if (params.maxPrice) filters.push(`ListPrice le ${params.maxPrice}`);
    if (params.updatedSince) filters.push(`ModificationTimestamp gt ${params.updatedSince.toISOString()}`);

    const url = `${base}/Property?$filter=${encodeURIComponent(filters.join(" and "))}&$top=200&$expand=Media`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.RESO_API_TOKEN}` } });
    if (!res.ok) throw new Error(`RESO Web API error ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { value: any[] };

    return (json.value ?? []).map((p): NormalizedListing => ({
      mlsNumber: String(p.ListingId ?? p.ListingKey),
      url: p.ListingURL ?? null,
      street: p.UnparsedAddress?.split(",")[0] ?? [p.StreetNumber, p.StreetName, p.StreetSuffix].filter(Boolean).join(" "),
      city: p.City,
      state: p.StateOrProvince,
      zip: String(p.PostalCode ?? ""),
      county: p.CountyOrParish ?? null,
      latitude: p.Latitude ?? null,
      longitude: p.Longitude ?? null,
      propertyType: mapPropertyType(p),
      unitCount: Number(p.NumberOfUnitsTotal ?? p.UnitsTotal ?? 1),
      yearBuilt: p.YearBuilt ?? null,
      buildingSqft: p.BuildingAreaTotal ?? p.LivingArea ?? null,
      lotSqft: p.LotSizeSquareFeet ?? null,
      description: p.PublicRemarks ?? null,
      photos: (p.Media ?? []).map((m: any) => m.MediaURL).filter(Boolean).slice(0, 12),
      price: Number(p.ListPrice),
      originalPrice: p.OriginalListPrice ?? null,
      taxesAnnual: p.TaxAnnualAmount ?? null,
      taxAssessedValue: p.TaxAssessedValue ?? null,
      occupancy: "UNKNOWN",
      rents: {
        actualMonthlyTotal: p.GrossScheduledIncome ? Number(p.GrossScheduledIncome) / 12 : null,
        note: p.GrossScheduledIncome ? "Derived from RESO GrossScheduledIncome / 12" : null,
      },
      status: mapStatus(p.StandardStatus),
      listDate: p.ListingContractDate ?? p.OnMarketDate ?? null,
      sourceUpdatedAt: p.ModificationTimestamp ?? null,
      agent: p.ListAgentFullName
        ? {
            fullName: p.ListAgentFullName,
            brokerage: p.ListOfficeName ?? "Unknown brokerage",
            phone: p.ListAgentPreferredPhone ?? p.ListAgentDirectPhone ?? null,
            email: p.ListAgentEmail ?? null,
            officePhone: p.ListOfficePhone ?? null,
            mlsAgentId: p.ListAgentMlsId ?? null,
          }
        : null,
      raw: p,
    }));
  },
};

function mapStatus(s: string | undefined) {
  switch ((s ?? "").toLowerCase()) {
    case "pending": case "active under contract": return "PENDING" as const;
    case "closed": case "sold": return "SOLD" as const;
    case "active": return "ACTIVE" as const;
    default: return "OFF_MARKET" as const;
  }
}

function mapPropertyType(p: any) {
  const units = Number(p.NumberOfUnitsTotal ?? p.UnitsTotal ?? 1);
  if (units >= 21) return "MULTI_20_PLUS" as const;
  if (units >= 5) return "MULTI_5_20" as const;
  if (units === 4) return "FOURPLEX" as const;
  if (units === 3) return "TRIPLEX" as const;
  if (units === 2) return "DUPLEX" as const;
  return "SINGLE_FAMILY" as const;
}
