import { Router } from 'express';
import { fetchSaleAndJeonseForMonths } from '../services/molit.js';
import { searchPlaceKeyword } from '../services/kakao.js';
import { scheduleLawdPrewarm } from '../services/prewarm.js';
import { hasStoreMonth } from '../services/tradeStore.js';
import {
  aggregateComplexes,
  extractAreaBands,
  recentYearMonths,
  type ComplexSummary,
} from '../types.js';
import { distanceMeters } from '../utils/geo.js';

export const tradesRouter = Router();

/** Max complexes to geocode when filtering by radius (Kakao rate / latency). */
const RADIUS_ENRICH_CAP = 80;
/** Enough points for 평단가 heat overlay (시군구 mode). */
const DEFAULT_ENRICH_CAP = 40;
const ENRICH_CONCURRENCY = 5;

tradesRouter.get('/', async (req, res) => {
  try {
    const lawdCd = String(req.query.lawdCd ?? '').trim();
    const months = Math.min(12, Math.max(1, Number(req.query.months ?? 3)));
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const areaTarget = req.query.areaTarget ? Number(req.query.areaTarget) : undefined;
    const areaTolerance = req.query.areaTolerance ? Number(req.query.areaTolerance) : 7;
    const enrichCoords = req.query.enrichCoords === 'true';
    const lat = req.query.lat ? Number(req.query.lat) : undefined;
    const lng = req.query.lng ? Number(req.query.lng) : undefined;
    const includeJeonse = req.query.includeJeonse !== 'false';
    const prewarm = req.query.prewarm !== 'false';
    const rawRadius = req.query.radiusKm != null ? Number(req.query.radiusKm) : undefined;
    const radiusKm =
      rawRadius !== undefined && Number.isFinite(rawRadius)
        ? Math.min(10, Math.max(0.3, rawRadius))
        : undefined;

    if (!/^\d{5}$/.test(lawdCd)) {
      res.status(400).json({ error: 'lawdCd must be a 5-digit 시군구 (구·시·군) code' });
      return;
    }

    if (radiusKm !== undefined && (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng))) {
      res.status(400).json({ error: 'radiusKm requires lat and lng' });
      return;
    }

    const monthKeys = recentYearMonths(months);
    const { sales, jeonse } = await fetchSaleAndJeonseForMonths(
      lawdCd,
      monthKeys,
      includeJeonse ? 6 : 6,
    );
    const jeonseData = includeJeonse ? jeonse : [];
    const areaBands = extractAreaBands(sales, jeonseData);

    const areaFilter =
      areaTarget !== undefined && Number.isFinite(areaTarget)
        ? { target: areaTarget, tolerance: areaTolerance }
        : undefined;

    let complexes = aggregateComplexes(sales, areaFilter, jeonseData, { yearCount: 1 });

    if (q) {
      complexes = complexes.filter(
        (c) => c.aptName.toLowerCase().includes(q) || c.dong.toLowerCase().includes(q),
      );
    }

    const useRadius = radiusKm !== undefined && lat !== undefined && lng !== undefined;
    const shouldEnrich = enrichCoords || useRadius;
    if (shouldEnrich) {
      const cap = useRadius ? RADIUS_ENRICH_CAP : DEFAULT_ENRICH_CAP;
      const searchRadiusM = useRadius ? Math.max(5000, Math.round(radiusKm! * 1000 * 1.5)) : 5000;
      complexes = await enrichComplexCoords(complexes.slice(0, cap), lat, lng, {
        concurrency: ENRICH_CONCURRENCY,
        searchRadiusM,
      });
    }

    if (useRadius) {
      const origin = { lat: lat!, lng: lng! };
      const maxM = radiusKm! * 1000;
      complexes = complexes
        .map((c) => {
          if (c.lat == null || c.lng == null) return null;
          const distanceM = distanceMeters(origin, { lat: c.lat, lng: c.lng });
          if (distanceM > maxM) return null;
          return { ...c, distanceM: Math.round(distanceM) };
        })
        .filter((c): c is ComplexSummary & { distanceM: number } => c != null);
    }

    const storeSaleMonths = monthKeys.filter((m) => hasStoreMonth(lawdCd, 'sale', m)).length;
    const storeJeonseMonths = monthKeys.filter((m) => hasStoreMonth(lawdCd, 'jeonse', m)).length;

    res.json({
      lawdCd,
      months: monthKeys,
      tradeCount: sales.length,
      jeonseCount: jeonseData.length,
      complexCount: complexes.length,
      complexes,
      areaBands,
      selectedAreaTarget: areaTarget ?? null,
      radiusKm: radiusKm ?? null,
      storeSaleMonths,
      storeJeonseMonths,
      mock: process.env.MOLIT_SERVICE_KEY?.startsWith('your_') === true,
    });

    // After responding: warm remaining months so 10y complex detail is fast
    if (prewarm) {
      scheduleLawdPrewarm(lawdCd, 10);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'trades failed';
    res.status(502).json({ error: message });
  }
});

tradesRouter.get('/complex', async (req, res) => {
  try {
    const lawdCd = String(req.query.lawdCd ?? '').trim();
    const aptName = String(req.query.aptName ?? '').trim();
    const dong = String(req.query.dong ?? '').trim();
    // 10년 = 120개월 (매매+전세 병렬 수집, 서버 캐시 활용)
    const years = Math.min(10, Math.max(1, Number(req.query.years ?? 10)));
    const months = years * 12;
    const areaTarget = req.query.areaTarget ? Number(req.query.areaTarget) : undefined;
    const areaTolerance = req.query.areaTolerance ? Number(req.query.areaTolerance) : 7;

    if (!/^\d{5}$/.test(lawdCd) || !aptName) {
      res.status(400).json({ error: 'lawdCd and aptName are required' });
      return;
    }

    const monthKeys = recentYearMonths(months);
    // Higher concurrency when cache-warmed; misses still paced reasonably
    const { sales, jeonse } = await fetchSaleAndJeonseForMonths(lawdCd, monthKeys, 10);

    const filteredSales = sales.filter(
      (t) => t.aptName === aptName && (!dong || t.dong === dong),
    );
    const filteredJeonse = jeonse.filter(
      (t) => t.aptName === aptName && (!dong || t.dong === dong),
    );

    const areaFilter =
      areaTarget !== undefined && Number.isFinite(areaTarget)
        ? { target: areaTarget, tolerance: areaTolerance }
        : undefined;

    const complexes = aggregateComplexes(filteredSales, areaFilter, filteredJeonse, {
      yearCount: years,
    });
    const complex = complexes[0];
    if (!complex) {
      res.status(404).json({ error: 'complex not found', months: monthKeys, years });
      return;
    }

    const areaBands = extractAreaBands(filteredSales, filteredJeonse);

    res.json({
      lawdCd,
      months: monthKeys,
      years,
      tradeCount: filteredSales.length,
      jeonseCount: filteredJeonse.length,
      selectedAreaTarget: areaTarget ?? null,
      areaBands,
      complex,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'complex detail failed';
    res.status(502).json({ error: message });
  }
});

async function enrichComplexCoords(
  complexes: ComplexSummary[],
  lat?: number,
  lng?: number,
  opts?: { concurrency?: number; searchRadiusM?: number },
): Promise<ComplexSummary[]> {
  if (complexes.length === 0) return [];
  const concurrency = Math.max(1, opts?.concurrency ?? 1);
  const searchRadiusM = opts?.searchRadiusM ?? 5000;
  const results: ComplexSummary[] = new Array(complexes.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const idx = next;
      next += 1;
      if (idx >= complexes.length) return;
      const c = complexes[idx]!;
      const hit = await searchPlaceKeyword(
        `${c.dong} ${c.aptName}`,
        lat,
        lng,
        searchRadiusM,
      );
      results[idx] = hit ? { ...c, lat: hit.lat, lng: hit.lng } : c;
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, complexes.length) }, () => worker()));
  return results;
}
