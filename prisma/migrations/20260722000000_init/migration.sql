-- DealScout initial migration (PostgreSQL)

CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER', 'VIEWER');
CREATE TYPE "PropertyType" AS ENUM ('SINGLE_FAMILY', 'DUPLEX', 'TRIPLEX', 'FOURPLEX', 'MULTI_5_20', 'MULTI_20_PLUS');
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'PENDING', 'SOLD', 'OFF_MARKET');
CREATE TYPE "OccupancyStatus" AS ENUM ('OCCUPIED', 'PARTIALLY_OCCUPIED', 'VACANT', 'UNKNOWN');
CREATE TYPE "RentKind" AS ENUM ('ACTUAL', 'PRO_FORMA', 'MARKET_ESTIMATE', 'HUD_BENCHMARK');
CREATE TYPE "DealColor" AS ENUM ('DARK_GREEN', 'GREEN', 'YELLOW', 'RED');
CREATE TYPE "Confidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "PipelineStage" AS ENUM ('NEW', 'REVIEWING', 'CONTACT_AGENT', 'UNDERWRITING', 'OFFER_PLANNED', 'OFFER_SUBMITTED', 'UNDER_CONTRACT', 'PASSED', 'CLOSED');
CREATE TYPE "AlertType" AS ENUM ('NEW_GREEN_DEAL', 'RATIO_TARGET_CROSSED', 'PRICE_REDUCTION', 'DEAL_BECAME_VIABLE', 'STATUS_CHANGE', 'STALE_LISTING_LEVERAGE');
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE');
CREATE TYPE "AssumptionScope" AS ENUM ('GLOBAL', 'MARKET', 'PROPERTY');

CREATE TABLE "Team" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'MEMBER',
  "teamId" TEXT REFERENCES "Team"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Market" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "city" TEXT,
  "county" TEXT,
  "state" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AppSetting" (
  "id" TEXT PRIMARY KEY,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Property" (
  "id" TEXT PRIMARY KEY,
  "addressKey" TEXT NOT NULL,
  "street" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "zip" TEXT NOT NULL,
  "county" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "propertyType" "PropertyType" NOT NULL,
  "unitCount" INTEGER NOT NULL,
  "yearBuilt" INTEGER,
  "buildingSqft" INTEGER,
  "lotSqft" INTEGER,
  "description" TEXT,
  "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "occupancy" "OccupancyStatus" NOT NULL DEFAULT 'UNKNOWN',
  "taxesAnnual" DOUBLE PRECISION,
  "taxAssessedValue" DOUBLE PRECISION,
  "ownerPaidUtilities" TEXT,
  "ownerUtilitiesMonthly" DOUBLE PRECISION,
  "parking" TEXT,
  "heating" TEXT,
  "cooling" TEXT,
  "roof" TEXT,
  "foundation" TEXT,
  "floodZone" TEXT,
  "codeViolations" TEXT,
  "conditionNotes" TEXT,
  "estimatedRehab" DOUBLE PRECISION,
  "marketId" TEXT REFERENCES "Market"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Property_addressKey_key" ON "Property"("addressKey");
CREATE INDEX "Property_city_state_idx" ON "Property"("city", "state");
CREATE INDEX "Property_zip_idx" ON "Property"("zip");
CREATE INDEX "Property_propertyType_idx" ON "Property"("propertyType");

CREATE TABLE "AssumptionProfile" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "scope" "AssumptionScope" NOT NULL,
  "marketId" TEXT REFERENCES "Market"("id") ON DELETE SET NULL,
  "propertyId" TEXT REFERENCES "Property"("id") ON DELETE CASCADE,
  "data" JSONB NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Unit" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
  "label" TEXT NOT NULL,
  "bedrooms" INTEGER NOT NULL,
  "bathrooms" DOUBLE PRECISION NOT NULL,
  "sqft" INTEGER,
  "currentRent" DOUBLE PRECISION,
  "occupied" BOOLEAN
);

CREATE TABLE "ListingSource" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "website" TEXT
);
CREATE UNIQUE INDEX "ListingSource_key_key" ON "ListingSource"("key");

CREATE TABLE "Agent" (
  "id" TEXT PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  "brokerage" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "officePhone" TEXT,
  "mlsAgentId" TEXT,
  "sourceKey" TEXT NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "Agent_fullName_brokerage_key" ON "Agent"("fullName", "brokerage");

CREATE TABLE "Listing" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
  "sourceId" TEXT NOT NULL REFERENCES "ListingSource"("id"),
  "agentId" TEXT REFERENCES "Agent"("id") ON DELETE SET NULL,
  "mlsNumber" TEXT,
  "url" TEXT,
  "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
  "price" DOUBLE PRECISION NOT NULL,
  "originalPrice" DOUBLE PRECISION,
  "listDate" TIMESTAMP(3),
  "statusChangedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sourceUpdatedAt" TIMESTAMP(3),
  "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "raw" JSONB
);
CREATE UNIQUE INDEX "Listing_sourceId_mlsNumber_key" ON "Listing"("sourceId", "mlsNumber");
CREATE INDEX "Listing_propertyId_idx" ON "Listing"("propertyId");

CREATE TABLE "ListingPriceEvent" (
  "id" TEXT PRIMARY KEY,
  "listingId" TEXT NOT NULL REFERENCES "Listing"("id") ON DELETE CASCADE,
  "price" DOUBLE PRECISION NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "RentRecord" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
  "unitId" TEXT,
  "kind" "RentKind" NOT NULL,
  "monthlyAmount" DOUBLE PRECISION NOT NULL,
  "source" TEXT,
  "note" TEXT,
  "effectiveDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RentRecord_propertyId_kind_idx" ON "RentRecord"("propertyId", "kind");

CREATE TABLE "DealMetrics" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
  "rentBasisUsed" "RentKind",
  "monthlyGrossRent" DOUBLE PRECISION,
  "rentToPricePct" DOUBLE PRECISION,
  "grossYieldPct" DOUBLE PRECISION,
  "pricePerUnit" DOUBLE PRECISION,
  "pricePerSqft" DOUBLE PRECISION,
  "noiAnnual" DOUBLE PRECISION,
  "capRatePct" DOUBLE PRECISION,
  "dscr" DOUBLE PRECISION,
  "cashFlowMonthly" DOUBLE PRECISION,
  "cashFlowAnnual" DOUBLE PRECISION,
  "cashToClose" DOUBLE PRECISION,
  "cocPct" DOUBLE PRECISION,
  "breakEvenOccPct" DOUBLE PRECISION,
  "score" INTEGER NOT NULL,
  "color" "DealColor" NOT NULL,
  "confidence" "Confidence" NOT NULL,
  "missingFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "breakdown" JSONB NOT NULL,
  "sec8Color" "DealColor",
  "sec8" JSONB,
  "hudMonthlyGross" DOUBLE PRECISION,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DealMetrics_propertyId_key" ON "DealMetrics"("propertyId");
CREATE INDEX "DealMetrics_color_idx" ON "DealMetrics"("color");
CREATE INDEX "DealMetrics_score_idx" ON "DealMetrics"("score");

CREATE TABLE "UnderwritingScenario" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "name" TEXT NOT NULL,
  "rentBasis" "RentKind" NOT NULL,
  "assumptions" JSONB NOT NULL,
  "results" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SavedSearch" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "alertEnabled" BOOLEAN NOT NULL DEFAULT true,
  "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Alert" (
  "id" TEXT PRIMARY KEY,
  "type" "AlertType" NOT NULL,
  "title" TEXT NOT NULL,
  "reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "propertyId" TEXT REFERENCES "Property"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "emailed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Alert_userId_read_idx" ON "Alert"("userId", "read");

CREATE TABLE "Note" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Task" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "assigneeId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Attachment" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "uploadedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PipelineItem" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
  "stage" "PipelineStage" NOT NULL DEFAULT 'NEW',
  "assigneeId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "favorite" BOOLEAN NOT NULL DEFAULT false,
  "rejectionReason" TEXT,
  "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PipelineItem_propertyId_key" ON "PipelineItem"("propertyId");

CREATE TABLE "PropertyStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
  "field" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PropertyStatusHistory_propertyId_occurredAt_idx" ON "PropertyStatusHistory"("propertyId", "occurredAt");

CREATE TABLE "HudFmrRecord" (
  "id" TEXT PRIMARY KEY,
  "fiscalYear" INTEGER NOT NULL,
  "areaName" TEXT NOT NULL,
  "areaCode" TEXT,
  "state" TEXT NOT NULL,
  "county" TEXT,
  "zip" TEXT,
  "isSafmr" BOOLEAN NOT NULL DEFAULT false,
  "efficiency" DOUBLE PRECISION NOT NULL,
  "oneBr" DOUBLE PRECISION NOT NULL,
  "twoBr" DOUBLE PRECISION NOT NULL,
  "threeBr" DOUBLE PRECISION NOT NULL,
  "fourBr" DOUBLE PRECISION NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "note" TEXT
);
CREATE INDEX "HudFmrRecord_zip_fiscalYear_idx" ON "HudFmrRecord"("zip", "fiscalYear");
CREATE INDEX "HudFmrRecord_state_fiscalYear_idx" ON "HudFmrRecord"("state", "fiscalYear");

CREATE TABLE "UtilityAllowance" (
  "id" TEXT PRIMARY KEY,
  "authorityName" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "zip" TEXT,
  "bedrooms" INTEGER NOT NULL,
  "monthlyAmount" DOUBLE PRECISION NOT NULL,
  "tenantPaid" TEXT NOT NULL,
  "note" TEXT,
  "effectiveDate" TIMESTAMP(3)
);
