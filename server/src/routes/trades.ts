import { Router } from 'express';
import { fetchTradesForMonths } from '../services/molit.js';
import { searchPlaceKeyword } from '../services/kakao.js';
import {
  aggregateComplexes,
  recentYearMonths,
  type ComplexSummary,
} from '../types.js';

export const tradesRouter = Router();

tradesRouter.get('/', async (req, res) => {
  try {
    const lawdCd = String(req.query.lawdCd ?? '').trim();
    const months = Math.min(6, Math.max(1, Number(req.query.months ?? 3)));
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const areaTarget = req.query.areaTarget ? Number(req.query.areaTarget) : undefined;
    const areaTolerance = req.query.areaTolerance ? Number(req.query.areaTolerance) : 5;
    const enrichCoords = req.query.enrichCoords === 'true';
    const lat = req.query.lat ? Number(req.query.lat) : undefined;
    const lng = req.query.lng ? Number(req.query.lng) : undefined;

    if (!/^\d{5}$/.test(lawdCd)) {
      res.status(400).json({ error: 'lawdCd must be a 5-digit region code' });
      return;
    }

    const monthKeys = recentYearMonths(months);
    const trades = await fetchTradesForMonths(lawdCd, monthKeys);

    const areaFilter =
      areaTarget !== undefined && Number.isFinite(areaTarget)
        ? { target: areaTarget, tolerance: areaTolerance }
        : undefined;

    let complexes = aggregateComplexes(trades, areaFilter);

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
      tradeCount: trades.length,
      complexCount: complexes.length,
      complexes,
      mock: trades.some((t) => t.jibun === undefined) && process.env.MOLIT_SERVICE_KEY?.startsWith('your_'),
    });
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
    const months = Math.min(6, Math.max(1, Number(req.query.months ?? 6)));
    const areaTarget = req.query.areaTarget ? Number(req.query.areaTarget) : undefined;
    const areaTolerance = req.query.areaTolerance ? Number(req.query.areaTolerance) : 5;

    if (!/^\d{5}$/.test(lawdCd) || !aptName) {
      res.status(400).json({ error: 'lawdCd and aptName are required' });
      return;
    }

    const monthKeys = recentYearMonths(months);
    const trades = await fetchTradesForMonths(lawdCd, monthKeys);
    const filtered = trades.filter(
      (t) => t.aptName === aptName && (!dong || t.dong === dong),
    );

    const areaFilter =
      areaTarget !== undefined && Number.isFinite(areaTarget)
        ? { target: areaTarget, tolerance: areaTolerance }
        : undefined;

    const complexes = aggregateComplexes(filtered, areaFilter);
    const complex = complexes[0];
    if (!complex) {
      res.status(404).json({ error: 'complex not found', months: monthKeys });
      return;
    }

    res.json({ lawdCd, months: monthKeys, complex });
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
