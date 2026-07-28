import { Router } from 'express';
import { computeLeaderIndex } from '../services/leaderIndex.js';
import { SEOUL_DISTRICTS, METRO_CITIES } from '../data/regions.js';

export const analysisRouter = Router();

analysisRouter.get('/regions', (_req, res) => {
  res.json({
    seoul: SEOUL_DISTRICTS,
    metro: METRO_CITIES,
  });
});

analysisRouter.get('/leader-index', async (req, res) => {
  try {
    const lawdCd = String(req.query.lawdCd ?? '').trim();
    if (!/^\d{5}$/.test(lawdCd)) {
      res.status(400).json({ error: 'lawdCd must be a 5-digit 시군구 code' });
      return;
    }

    const topN = req.query.topN ? Number(req.query.topN) : 10;
    const years = req.query.years ? Number(req.query.years) : 3;
    const surgeThresholdPercent = req.query.surgeThreshold
      ? Number(req.query.surgeThreshold)
      : 3;
    const areaTarget = req.query.areaTarget ? Number(req.query.areaTarget) : undefined;
    const areaTolerance = req.query.areaTolerance
      ? Number(req.query.areaTolerance)
      : undefined;

    const result = await computeLeaderIndex({
      lawdCd,
      topN,
      years,
      surgeThresholdPercent,
      areaTarget,
      areaTolerance,
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'leader-index failed';
    res.status(502).json({ error: message });
  }
});
