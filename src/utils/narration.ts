import type { ComplexSummary } from '../types';

/** Spoken Korean manwon (만원) amount for TTS. */
export function formatManwonSpoken(price: number): string {
  if (!Number.isFinite(price)) return '정보 없음';
  if (price >= 10000) {
    const eok = Math.floor(price / 10000);
    const rest = Math.round(price % 10000);
    if (rest === 0) return `${eok}억 원`;
    return `${eok}억 ${rest}만 원`;
  }
  return `${Math.round(price)}만 원`;
}

export interface NarrationStats {
  top3: ComplexSummary[];
  avgSale: number | null;
  avgJeonse: number | null;
  script: string;
}

export function buildNearbyNarration(complexes: ComplexSummary[]): NarrationStats {
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

  if (top3.length === 0) {
    return {
      top3,
      avgSale,
      avgJeonse,
      script: '주변에 최근 매매 실거래가 있는 단지를 찾지 못했습니다.',
    };
  }

  const ranking = top3
    .map((c, i) => {
      const jeonsePart =
        c.medianJeonse !== null && c.medianJeonse > 0
          ? `, 전세 중간가는 ${formatManwonSpoken(c.medianJeonse)}`
          : '';
      return `${i + 1}위, ${c.dong} ${c.aptName}, 매매 중간가 ${formatManwonSpoken(c.medianPrice)}${jeonsePart}.`;
    })
    .join(' ');

  const avgParts = [
    avgSale !== null ? `주변 단지 매매가 평균은 ${formatManwonSpoken(avgSale)}` : null,
    avgJeonse !== null ? `전세가 평균은 ${formatManwonSpoken(avgJeonse)}` : null,
  ].filter(Boolean);

  const avgSentence =
    avgParts.length > 0 ? `${avgParts.join('이고, ')}입니다.` : '';

  const script = [
    '내 위치 주변에서 매매가가 가장 높은 단지 상위 3곳입니다.',
    ranking,
    avgSentence,
  ]
    .filter(Boolean)
    .join(' ');

  return { top3, avgSale, avgJeonse, script };
}
