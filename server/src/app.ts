import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { geocodeRouter } from './routes/geocode.js';
import { tradesRouter } from './routes/trades.js';
import { mapEmbedHandler } from './routes/mapEmbed.js';
import { getDiskCacheRoot } from './services/diskCache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    const kakaoReady = Boolean(
      process.env.KAKAO_REST_KEY && !process.env.KAKAO_REST_KEY.startsWith('your_'),
    );
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
      diskCacheDir: getDiskCacheRoot(),
    });
  });

  app.get('/api/config', (_req, res) => {
    res.json({
      kakaoJsKey:
        process.env.KAKAO_JS_KEY?.startsWith('your_') ? null : process.env.KAKAO_JS_KEY ?? null,
    });
  });

  app.get('/map-embed', mapEmbedHandler);
  app.use('/api/geocode', geocodeRouter);
  app.use('/api/trades', tradesRouter);

  const staticCandidates = [
    path.resolve(__dirname, '../public'),
    path.resolve(__dirname, '../../dist'),
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'dist'),
  ];
  const staticDir = staticCandidates.find((p) => fs.existsSync(path.join(p, 'index.html')));

  if (staticDir) {
    app.use(
      express.static(staticDir, {
        setHeaders(res, filePath) {
          if (filePath.endsWith('.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json');
          }
          if (filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Service-Worker-Allowed', '/');
          }
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      if (
        req.path.startsWith('/api') ||
        req.path === '/health' ||
        req.path.startsWith('/map-embed')
      ) {
        next();
        return;
      }
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'internal error';
    res.status(500).json({ error: message });
  });

  return app;
}
