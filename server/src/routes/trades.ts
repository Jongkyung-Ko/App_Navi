import { Router } from 'express';
import { fetchSaleAndJeonseForMonths } from '../services/molit.js';
import { searchPlaceKeyword } from '../services/kakao.js';
import { scheduleLawdPrewarm } from '../services/prewarm.js';
import {
  aggregateComplexes,
  extractAreaBands,
  recentYearMonths,
  type ComplexSummary,
} from '../types.js';

export const tradesRouter = Router();

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

    if (!/^\d{5}$/.test(lawdCd)) {
      res.status(400).json({ error: 'lawdCd must be a 5-digit 시군구 (구·시·군) code' });
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

    if (enrichCoords) {
      complexes = await enrichComplexCoords(complexes.slice(0, 15), lat, lng);
    }

    res.json({
      lawdCd,
      months: monthKeys,
      tradeCount: sales.length,
      jeonseCount: jeonseData.length,
      complexCount: complexes.length,
      complexes,
      areaBands,
      selectedAreaTarget: areaTarget ?? null,
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
): Promise<ComplexSummary[]> {
  const results: ComplexSummary[] = [];
  for (const c of complexes) {
    const hit = await searchPlaceKeyword(`${c.dong} ${c.aptName}`, lat, lng);
    results.push(hit ? { ...c, lat: hit.lat, lng: hit.lng } : c);
  }
  return results;
}
