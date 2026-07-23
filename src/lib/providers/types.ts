import type { ListingStatus, OccupancyStatus, PropertyType } from "@/generated/prisma/enums";

/**
 * Provider adapter contract.
 *
 * Every listing-data integration (mock, RESO Web API / MLS, permitted
 * third-party APIs) implements this interface and returns NormalizedListing
 * records. The ingestion pipeline handles dedupe, history and alerts, so an
 * adapter only maps its provider's payload into this shape.
 *
 * Register adapters in src/lib/providers/registry.ts.
 */
export interface NormalizedUnit {
  label: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft?: number | null;
  currentRent?: number | null; // actual in-place rent, if the source provides it
  occupied?: boolean | null;
}

export interface NormalizedAgent {
  fullName: string;
  brokerage: string;
  phone?: string | null;
  email?: string | null;
  officePhone?: string | null;
  mlsAgentId?: string | null;
}

export interface NormalizedListing {
  // Identity
  mlsNumber: string;
  url?: string | null;
  // Address
  street: string;
  city: string;
  state: string;
  zip: string;
  county?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // Physical
  propertyType: PropertyType;
  unitCount: number;
  units?: NormalizedUnit[];
  yearBuilt?: number | null;
  buildingSqft?: number | null;
  lotSqft?: number | null;
  description?: string | null;
  photos?: string[];
  parking?: string | null;
  heating?: string | null;
  cooling?: string | null;
  roof?: string | null;
  foundation?: string | null;
  floodZone?: string | null;
  codeViolations?: string | null;
  conditionNotes?: string | null;
  estimatedRehab?: number | null;
  // Financial facts
  price: number;
  originalPrice?: number | null;
  taxesAnnual?: number | null;
  taxAssessedValue?: number | null;
  ownerPaidUtilities?: string | null;
  ownerUtilitiesMonthly?: number | null;
  occupancy?: OccupancyStatus;
  /** Rent totals by provenance — the app never blends these silently. */
  rents?: {
    actualMonthlyTotal?: number | null;
    proFormaMonthlyTotal?: number | null;
    marketEstimateMonthlyTotal?: number | null;
    note?: string | null;
  };
  // Listing state
  status: ListingStatus;
  listDate?: string | null;      // ISO
  sourceUpdatedAt?: string | null;
  agent?: NormalizedAgent | null;
  raw?: unknown;
}

export interface FetchParams {
  city?: string;
  state?: string;
  zips?: string[];
  minPrice?: number;
  maxPrice?: number;
  propertyTypes?: PropertyType[];
  updatedSince?: Date;
}

export interface ListingProviderAdapter {
  /** Stable key, e.g. "MOCK_MLS" or "RESO_WEB_API". */
  key: string;
  name: string;
  kind: "mock" | "mls_reso" | "third_party_api";
  /** Lower number = more authoritative when deduplicating across sources. */
  priority: number;
  website?: string;
  isConfigured(): boolean;
  fetchListings(params: FetchParams): Promise<NormalizedListing[]>;
}
