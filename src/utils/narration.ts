import type { ComplexSummary } from '../types';

/**
 * Speak prices in compact 억 units.
 * Round to 백만원 (100만), then format like "3.2억" / "1억".
 */
export function formatManwonSpoken(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '정보 없음';
  const millionWon = Math.round(price / 100); // 백만원 단위
  if (millionWon <= 0) return '정보 없음';

  const eok = millionWon / 100; // 억
  if (eok >= 1) {
    const oneDecimal = Math.round(eok * 10) / 10;
    const text = oneDecimal.toFixed(1).replace(/\.0$/, '');
    return `${text}억`;
  }

  // 1억 미만: 천만 단위로 간략히
  if (millionWon >= 10) {
    const cheon = Math.round(millionWon / 10);
    return `${cheon}천만`;
  }
  return `${millionWon * 100}만`;
}

function formatChangeSpoken(changePercent: number | null): string | null {
  if (changePercent === null || !Number.isFinite(changePercent)) return null;
  if (Math.abs(changePercent) < 0.05) return '보합';
  const pct = Math.abs(changePercent).toFixed(Math.abs(changePercent) >= 10 ? 0 : 1);
  const compact = pct.replace(/\.0$/, '');
  if (changePercent > 0) return `${compact}% 상승중`;
  return `${compact}% 하락중`;
}

function formatGapSpoken(gap: number | null): string | null {
  if (gap === null || !Number.isFinite(gap)) return null;
  if (gap <= 0) return `갭은 ${formatManwonSpoken(Math.abs(gap))} 역전`;
  return `갭은 ${formatManwonSpoken(gap)}`;
}

/** One complex line, e.g. "래미안은 매매가 3.5억 이고 3% 상승중이며 갭은 1억입니다." */
export function formatComplexNarration(c: ComplexSummary): string {
  const name = c.aptName.replace(/\s+/g, ' ').trim() || '단지';
  const price = formatManwonSpoken(c.medianPrice);
  const change = formatChangeSpoken(c.changePercent);
  const gap = formatGapSpoken(c.saleJeonseGap);

  const parts: string[] = [`${name}는 매매가 ${price}`];
  if (change) parts.push(change);
  if (gap) parts.push(gap);

  if (parts.length === 1) return `${parts[0]}입니다.`;
  if (parts.length === 2) return `${parts[0]} 이고 ${parts[1]}입니다.`;
  // price + change + gap
  return `${parts[0]} 이고 ${parts[1]}이며 ${parts[2]}입니다.`;
}

export interface NarrationStats {
  top3: ComplexSummary[];
  avgSale: number | null;
  avgJeonse: number | null;
  script: string;
}

export function buildNearbyNarration(
  complexes: ComplexSummary[],
  areaLabel?: string,
): NarrationStats {
  const withSale = complexes.filter((c) => Number.isFinite(c.medianPrice) && c.medianPrice > 0);
  const top3 = [...withSale].sort((a, b) => b.medianPrice - a.medianPrice).slice(0, 3);

  const avgSale =
    withSale.length > 0
      ? withSale.reduce((sum, c) => sum + c.medianPrice, 0) / withSale.length
      : null;

  const withJeonse = complexes.filter(
    (c) => c.medianJeonse !== null && Number.isFinite(c.medianJeonse) && c.medianJeonse > 0,
  );
  const avgJeonse =
    withJeonse.length > 0
      ? withJeonse.reduce((sum, c) => sum + (c.medianJeonse as number), 0) / withJeonse.length
      : null;

  const areaPrefix = areaLabel ? `${areaLabel} 기준, ` : '';

  if (top3.length === 0) {
    return {
      top3,
      avgSale,
      avgJeonse,
      script: `${areaPrefix}주변에 최근 매매 실거래가 있는 단지를 찾지 못했습니다.`,
    };
  }

  const ranking = top3.map((c) => formatComplexNarration(c)).join(' ');

  const avgParts = [
    avgSale !== null ? `주변 매매가는 ${formatManwonSpoken(avgSale)}` : null,
    avgJeonse !== null ? `전세는 ${formatManwonSpoken(avgJeonse)}` : null,
  ].filter(Boolean);

  const avgSentence =
    avgParts.length > 0 ? `${avgParts.join('이고, ')}입니다.` : '';

  const script = [
    `${areaPrefix}매매가 상위 3곳입니다.`,
    ranking,
    avgSentence,
  ]
    .filter(Boolean)
    .join(' ');

  return { top3, avgSale, avgJeonse, script };
}

/** Stable key for Top 3 identity + prices (detect ranking changes). */
export function top3Fingerprint(top3: ComplexSummary[]): string {
  return top3.map((c) => `${c.id}:${Math.round(c.medianPrice)}`).join('|');
}

export function buildTop3ChangedScript(stats: NarrationStats): string {
  if (stats.top3.length === 0) {
    return '위치가 바뀌었지만, 주변에 최근 매매 실거래가 있는 단지를 찾지 못했습니다.';
  }
  const ranking = stats.top3.map((c) => formatComplexNarration(c)).join(' ');
  return `위치가 바뀌어 매매가 Top 3가 갱신되었습니다. ${ranking}`;
}

export function buildTop3InvestigateScript(stats: NarrationStats): string {
  if (stats.top3.length === 0) return stats.script;
  const ranking = stats.top3.map((c) => formatComplexNarration(c)).join(' ');
  return `선택한 위치 기준 매매가 상위 3곳입니다. ${ranking}`;
}
