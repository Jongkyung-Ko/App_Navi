import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { geocodeRouter } from './routes/geocode.js';
import { tradesRouter } from './routes/trades.js';
import { mapEmbedHandler } from './routes/mapEmbed.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  const kakaoReady = Boolean(process.env.KAKAO_REST_KEY && !process.env.KAKAO_REST_KEY.startsWith('your_'));
  const molitReady = Boolean(
    process.env.MOLIT_SERVICE_KEY && !process.env.MOLIT_SERVICE_KEY.startsWith('your_'),
  );
  res.json({
    ok: true,
    service: 'app-navi-server',
    kakaoReady,
    molitReady,
    mockFallback: process.env.ALLOW_MOCK_FALLBACK !== 'false',
    cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 21600),
  });
});

app.get('/api/config', (_req, res) => {
  res.json({
    kakaoJsKey: process.env.KAKAO_JS_KEY?.startsWith('your_') ? null : process.env.KAKAO_JS_KEY ?? null,
  });
});

app.get('/map-embed', mapEmbedHandler);

app.use('/api/geocode', geocodeRouter);
app.use('/api/trades', tradesRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'internal error';
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`App Navi proxy listening on http://localhost:${port}`);
});
