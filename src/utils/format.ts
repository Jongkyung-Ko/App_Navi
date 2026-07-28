export function formatManwon(price: number): string {
  if (!Number.isFinite(price)) return '-';
  if (price >= 10000) {
    const eok = Math.floor(price / 10000);
    const rest = Math.round(price % 10000);
    if (rest === 0) return `${eok}억`;
    return `${eok}억 ${rest.toLocaleString('ko-KR')}만`;
  }
  return `${Math.round(price).toLocaleString('ko-KR')}만`;
}

/** Compact 억 display: round to 백만원 → "3.3억" / "1억" / "8천만" */
export function formatManwonCompact(price: number): string {
  if (!Number.isFinite(price)) return '—';
  const sign = price < 0 ? '-' : '';
  const abs = Math.abs(price);
  if (abs <= 0) return '—';

  const millionWon = Math.round(abs / 100); // 백만원
  if (millionWon <= 0) return '—';

  const eok = millionWon / 100;
  if (eok >= 1) {
    const oneDecimal = Math.round(eok * 10) / 10;
    const text = oneDecimal.toFixed(1).replace(/\.0$/, '');
    return `${sign}${text}억`;
  }
  if (millionWon >= 10) {
    return `${sign}${Math.round(millionWon / 10)}천만`;
  }
  return `${sign}${millionWon * 100}만`;
}

export function formatPyeongPrice(pricePerPyeong: number): string {
  return `${Math.round(pricePerPyeong).toLocaleString('ko-KR')}만/평`;
}

/**
 * Map heat label: 만원/평 → "0.89억/평" / "1.2억/평".
 * Under 1억 uses 2 decimals; 1억+ uses 1 decimal.
 */
export function formatPyeongPriceEok(pricePerPyeong: number): string {
  if (!Number.isFinite(pricePerPyeong) || pricePerPyeong <= 0) return '—';
  const eok = pricePerPyeong / 10000;
  if (eok >= 1) {
    const one = Math.round(eok * 10) / 10;
    const text = one.toFixed(1).replace(/\.0$/, '');
    return `${text}억/평`;
  }
  const two = Math.round(eok * 100) / 100;
  return `${two.toFixed(2)}억/평`;
}

export function formatArea(area: number): string {
  return `${area.toFixed(1)}㎡`;
}

export function changeColor(changePercent: number | null): string {
  if (changePercent === null || Math.abs(changePercent) < 0.05) return '#5c6670';
  return changePercent > 0 ? '#c0392b' : '#1f6f4a';
}
