import { Router } from 'express';
import { reverseGeocode } from '../services/kakao.js';

export const geocodeRouter = Router();

geocodeRouter.get('/reverse', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'lat and lng are required numbers' });
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'lat/lng out of range' });
      return;
    }

    const result = await reverseGeocode(lat, lng);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'geocode failed';
    res.status(502).json({ error: message });
  }
});
