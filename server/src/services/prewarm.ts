import { recentYearMonths } from '../types.js';
import { fetchSaleAndJeonseForMonths } from './molit.js';

const inFlight = new Map<string, Promise<void>>();

/**
 * Background-warm 시군구 MOLIT months so complex detail (10y) hits cache.
 * Deduped per lawdCd; uses lower concurrency to avoid starving live requests.
 */
export function scheduleLawdPrewarm(lawdCd: string, years = 10): void {
  if (!/^\d{5}$/.test(lawdCd)) return;
  if (inFlight.has(lawdCd)) return;

  const monthCount = Math.min(120, Math.max(12, years * 12));
  const concurrency = Math.min(
    6,
    Math.max(2, Number(process.env.MOLIT_PREWARM_CONCURRENCY ?? 4)),
  );

  const task = (async () => {
    const months = recentYearMonths(monthCount);
    console.info(`[prewarm] start ${lawdCd} months=${months.length}`);
    try {
      await fetchSaleAndJeonseForMonths(lawdCd, months, concurrency);
      console.info(`[prewarm] done ${lawdCd}`);
    } catch (err) {
      console.warn(
        `[prewarm] failed ${lawdCd}`,
        err instanceof Error ? err.message : err,
      );
    } finally {
      inFlight.delete(lawdCd);
    }
  })();

  inFlight.set(lawdCd, task);
}

export function isLawdPrewarming(lawdCd: string): boolean {
  return inFlight.has(lawdCd);
}
