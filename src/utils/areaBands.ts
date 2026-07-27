/** Major exclusive-area bands used across home / list / detail filters. */
export const STANDARD_AREA_TARGETS = [49, 59, 74, 84, 99, 114, 134, 164] as const;

export function exclusiveToSupplyPyeong(m2: number): number {
  return Math.round((m2 / 3.3058) * 1.3);
}

export function formatAreaBandLabel(targetM2: number): string {
  return `${Math.round(targetM2)}㎡ · 약 ${exclusiveToSupplyPyeong(targetM2)}평`;
}

export type AreaPreset = {
  label: string;
  value: number | undefined;
  shortLabel: string;
};

export const AREA_BAND_PRESETS: AreaPreset[] = [
  { label: '전체', shortLabel: '전체', value: undefined },
  ...STANDARD_AREA_TARGETS.map((m2) => ({
    label: formatAreaBandLabel(m2),
    shortLabel: `${m2}㎡`,
    value: m2 as number | undefined,
  })),
];
