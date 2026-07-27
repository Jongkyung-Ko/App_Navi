import React from 'react';
import { FeatureToggle } from './FeatureToggle';

type Props = {
  enabled: boolean;
  speaking: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export function NarrationToggle({ enabled, speaking, disabled, onToggle }: Props) {
  const hint = enabled
    ? speaking
      ? '매매가 Top 3와 평균을 읽어주는 중…'
      : 'On · 상위 3곳과 매매·전세 평균을 안내합니다'
    : 'Off · 켜면 주변 고가 단지를 소리로 알려줍니다';

  return (
    <FeatureToggle
      title="시세 나레이션"
      enabled={enabled}
      hint={hint}
      disabled={disabled}
      onToggle={onToggle}
    />
  );
}
