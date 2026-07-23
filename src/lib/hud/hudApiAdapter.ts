/**
 * Live HUD FMR/SAFMR integration — HUD USER Open API.
 *
 * 1. Get a free token: https://www.huduser.gov/portal/dataset/fmr-api.html
 * 2. Set HUD_API_TOKEN in .env
 * 3. Run `npm run ingest` (or the worker) — refreshHudData() upserts current
 *    metro FMRs and ZIP SAFMRs into HudFmrRecord.
 *
 * Endpoints used:
 *   GET https://www.huduser.gov/hudapi/public/fmr/data/{entityid}?year=YYYY
 *     entityid examples: "METRO45780M45780" (Toledo MSA), "3909599999" (county)
 *     Response includes basicdata (metro FMR) and, for SAFMR areas or when
 *     requested, ZIP-level Small Area FMRs.
 */
export interface HudApiFmrRow {
  zip?: string;
  efficiency: number;
  oneBr: number;
  twoBr: number;
  threeBr: number;
  fourBr: number;
  areaName: string;
  year: number;
}

export async function fetchFmrFromHudApi(entityId: string, year?: number): Promise<HudApiFmrRow[]> {
  const token = process.env.HUD_API_TOKEN;
  if (!token) {
    throw new Error(
      "HUD_API_TOKEN is not configured. Get a free token at https://www.huduser.gov/portal/dataset/fmr-api.html and add it to .env."
    );
  }
  const url = `https://www.huduser.gov/hudapi/public/fmr/data/${encodeURIComponent(entityId)}${year ? `?year=${year}` : ""}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HUD API request failed: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as any;
  const data = json?.data;
  const rows: HudApiFmrRow[] = [];
  const push = (r: any, zip?: string) =>
    rows.push({
      zip,
      efficiency: Number(r["Efficiency"] ?? r["efficiency"]),
      oneBr: Number(r["One-Bedroom"] ?? r["oneBr"] ?? r["one_bedroom"]),
      twoBr: Number(r["Two-Bedroom"] ?? r["twoBr"] ?? r["two_bedroom"]),
      threeBr: Number(r["Three-Bedroom"] ?? r["threeBr"] ?? r["three_bedroom"]),
      fourBr: Number(r["Four-Bedroom"] ?? r["fourBr"] ?? r["four_bedroom"]),
      areaName: String(data?.area_name ?? entityId),
      year: Number(data?.year ?? year ?? new Date().getFullYear()),
    });
  if (data?.basicdata) {
    if (Array.isArray(data.basicdata)) data.basicdata.forEach((r: any) => push(r, r.zip_code));
    else push(data.basicdata);
  }
  return rows.filter((r) => Number.isFinite(r.twoBr));
}
