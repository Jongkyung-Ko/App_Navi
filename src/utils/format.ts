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

export function formatPyeongPrice(pricePerPyeong: number): string {
  return `${Math.round(pricePerPyeong).toLocaleString('ko-KR')}만/평`;
}

export function formatArea(area: number): string {
  return `${area.toFixed(1)}㎡`;
}

export function changeColor(changePercent: number | null): string {
  if (changePercent === null || Math.abs(changePercent) < 0.05) return '#5c6670';
  return changePercent > 0 ? '#c0392b' : '#1f6f4a';
}
