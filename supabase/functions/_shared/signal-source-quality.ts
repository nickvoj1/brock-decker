export type SourceRunMetric = {
  pipeline: string;
  region: string;
  source_name: string;
  source_url: string;
  candidates: number;
  geo_validated: number;
  quality_passed: number;
  inserted: number;
  rejected: number;
  duplicates: number;
  errors: number;
  pending: number;
  validated: number;
  avg_geo_confidence: number;
};

export function normalizeSourceUrl(url?: string | null): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return String(url).trim().toLowerCase();
  }
}

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeRatio(numerator: number, denominator: number): number {
  const den = Number(denominator || 0);
  if (!Number.isFinite(den) || den <= 0) return 0;
  const num = Number(numerator || 0);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return clamp(0, num / den, 1);
}

export function createSourceRunMetric(
  pipeline: string,
  region: string,
  sourceName: string,
  sourceUrl: string,
): SourceRunMetric {
  return {
    pipeline,
    region,
    source_name: sourceName || "Unknown Source",
    source_url: sourceUrl,
    candidates: 0,
    geo_validated: 0,
    quality_passed: 0,
    inserted: 0,
    rejected: 0,
    duplicates: 0,
    errors: 0,
    pending: 0,
    validated: 0,
    avg_geo_confidence: 0,
  };
}

type RunRow = {
  source_name?: string | null;
  source_url?: string | null;
  candidates?: number | null;
  geo_validated?: number | null;
  quality_passed?: number | null;
  inserted?: number | null;
  rejected?: number | null;
  duplicates?: number | null;
  errors?: number | null;
  pending?: number | null;
  validated?: number | null;
  avg_geo_confidence?: number | null;
};

type AggregateRow = SourceRunMetric & { runs: number };

function aggregateRuns(rows: RunRow[], pipeline: string, region: string): Map<string, AggregateRow> {
  const out = new Map<string, AggregateRow>();

  for (const row of rows) {
    const sourceUrl = normalizeSourceUrl(row.source_url);
    if (!sourceUrl) continue;
    const existing =
      out.get(sourceUrl) ||
      ({
        pipeline,
        region,
        source_name: String(row.source_name || sourceUrl),
        source_url: sourceUrl,
        candidates: 0,
        geo_validated: 0,
        quality_passed: 0,
        inserted: 0,
        rejected: 0,
        duplicates: 0,
        errors: 0,
        pending: 0,
        validated: 0,
        avg_geo_confidence: 0,
        runs: 0,
      } as AggregateRow);

    const runsAfter = existing.runs + 1;
    const incomingGeo = Number(row.avg_geo_confidence || 0);
    const nextGeo = Number.isFinite(incomingGeo)
      ? ((existing.avg_geo_confidence * existing.runs) + incomingGeo) / runsAfter
      : existing.avg_geo_confidence;

    existing.source_name = String(row.source_name || existing.source_name || sourceUrl);
    existing.candidates += Number(row.candidates || 0);
    existing.geo_validated += Number(row.geo_validated || 0);
    existing.quality_passed += Number(row.quality_passed || 0);
    existing.inserted += Number(row.inserted || 0);
    existing.rejected += Number(row.rejected || 0);
    existing.duplicates += Number(row.duplicates || 0);
    existing.errors += Number(row.errors || 0);
    existing.pending += Number(row.pending || 0);
    existing.validated += Number(row.validated || 0);
    existing.avg_geo_confidence = clamp(0, nextGeo, 100);
    existing.runs = runsAfter;

    out.set(sourceUrl, existing);
  }

  return out;
}

function sourcePriorityScore(row: AggregateRow): number {
  const insertedRate = safeRatio(row.inserted, Math.max(row.candidates, 1));
  const qualityRate = safeRatio(row.quality_passed, Math.max(row.candidates, 1));
  const geoRate = safeRatio(row.geo_validated, Math.max(row.candidates, 1));
  const validatedRate = safeRatio(row.validated, Math.max(row.inserted, 1));
  const duplicatePenalty = safeRatio(row.duplicates, Math.max(row.candidates, 1));
  const rejectPenalty = safeRatio(row.rejected, Math.max(row.candidates, 1));
  const errorPenalty = safeRatio(row.errors, Math.max(row.candidates, 1));
  const geoConfidence = clamp(0, Number(row.avg_geo_confidence || 0), 100) / 100;
  const explorationBoost = Math.min(Math.log10(Math.max(1, row.candidates) + 1) / 10, 0.08);

  const score =
    insertedRate * 0.38 +
    qualityRate * 0.22 +
    geoRate * 0.12 +
    validatedRate * 0.09 +
    geoConfidence * 0.17 +
    explorationBoost -
    duplicatePenalty * 0.10 -
    rejectPenalty * 0.10 -
    errorPenalty * 0.08;

  return clamp(0, score, 1);
}

export async function fetchSourcePriorityMap(
  supabase: any,
  pipeline: string,
  region: string,
  lookbackDays = 21,
): Promise<Record<string, number>> {
  try {
    const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("signal_source_runs")
      .select("source_name,source_url,candidates,geo_validated,quality_passed,inserted,rejected,duplicates,errors,pending,validated,avg_geo_confidence")
      .eq("pipeline", pipeline)
      .eq("region", region)
      .gte("created_at", cutoff)
      .limit(1500);

    if (error || !Array.isArray(data) || data.length === 0) return {};

    const aggregate = aggregateRuns(data as RunRow[], pipeline, region);
    const out: Record<string, number> = {};
    for (const [sourceUrl, row] of aggregate.entries()) {
      out[sourceUrl] = sourcePriorityScore(row);
    }
    return out;
  } catch {
    return {};
  }
}

function tieBreakerKey(url: string): number {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash * 31 + url.charCodeAt(i)) >>> 0;
  }
  return hash % 997;
}

export function rankSourcesByPriority<T extends { url: string }>(
  sources: T[],
  priorityMap: Record<string, number>,
  defaultPriority = 0.45,
): T[] {
  return [...sources].sort((a, b) => {
    const aKey = normalizeSourceUrl(a.url);
    const bKey = normalizeSourceUrl(b.url);
    const aScore = priorityMap[aKey] ?? defaultPriority;
    const bScore = priorityMap[bKey] ?? defaultPriority;
    if (aScore !== bScore) return bScore - aScore;
    return tieBreakerKey(aKey) - tieBreakerKey(bKey);
  });
}

export async function saveSourceRunMetrics(supabase: any, metrics: SourceRunMetric[]): Promise<void> {
  if (!Array.isArray(metrics) || metrics.length === 0) return;

  const rows = metrics
    .map((m) => ({
      pipeline: String(m.pipeline || "").trim(),
      region: String(m.region || "").trim(),
      source_name: String(m.source_name || "").trim() || "Unknown Source",
      source_url: normalizeSourceUrl(m.source_url || ""),
      candidates: Math.max(0, Number(m.candidates || 0)),
      geo_validated: Math.max(0, Number(m.geo_validated || 0)),
      quality_passed: Math.max(0, Number(m.quality_passed || 0)),
      inserted: Math.max(0, Number(m.inserted || 0)),
      rejected: Math.max(0, Number(m.rejected || 0)),
      duplicates: Math.max(0, Number(m.duplicates || 0)),
      errors: Math.max(0, Number(m.errors || 0)),
      pending: Math.max(0, Number(m.pending || 0)),
      validated: Math.max(0, Number(m.validated || 0)),
      avg_geo_confidence: clamp(0, Number(m.avg_geo_confidence || 0), 100),
    }))
    .filter((m) => m.pipeline && m.region && m.source_url);

  if (rows.length === 0) return;

  try {
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from("signal_source_runs").insert(chunk);
      if (error) {
        console.error("signal_source_runs insert error:", error.message || error);
        return;
      }
    }
  } catch (error) {
    console.error("signal_source_runs save failed:", error);
  }
}
