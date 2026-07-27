import { describe, expect, it } from 'vitest';
import { resolveSigunguFromRegions } from '../services/sigungu.js';

describe('resolveSigunguFromRegions', () => {
  it('uses 5-digit 구 code for Seoul', () => {
    const result = resolveSigunguFromRegions([
      {
        region_type: 'B',
        code: '11',
        region_1depth_name: '서울특별시',
        region_2depth_name: '',
        region_3depth_name: '',
      },
      {
        region_type: 'B',
        code: '11680',
        region_1depth_name: '서울특별시',
        region_2depth_name: '강남구',
        region_3depth_name: '',
      },
      {
        region_type: 'B',
        code: '1168010100',
        region_1depth_name: '서울특별시',
        region_2depth_name: '강남구',
        region_3depth_name: '역삼동',
      },
      {
        region_type: 'H',
        code: '11680',
        region_1depth_name: '서울특별시',
        region_2depth_name: '강남구',
        region_3depth_name: '',
      },
    ]);
    expect(result.lawdCd).toBe('11680');
    expect(result.region2).toBe('강남구');
    expect(result.region3).toBe('역삼동');
    expect(result.sigunguLabel).toBe('서울특별시 강남구');
  });

  it('uses 시·군 code for provincial areas', () => {
    const result = resolveSigunguFromRegions([
      {
        region_type: 'B',
        code: '41820',
        region_1depth_name: '경기도',
        region_2depth_name: '가평군',
        region_3depth_name: '',
      },
      {
        region_type: 'B',
        code: '4182031021',
        region_1depth_name: '경기도',
        region_2depth_name: '가평군',
        region_3depth_name: '가평읍',
      },
    ]);
    expect(result.lawdCd).toBe('41820');
    expect(result.region2).toBe('가평군');
    expect(result.sigunguLabel).toBe('경기도 가평군');
  });

  it('keeps 일반구 under a provincial city', () => {
    const result = resolveSigunguFromRegions([
      {
        region_type: 'B',
        code: '41135',
        region_1depth_name: '경기도',
        region_2depth_name: '성남시 분당구',
        region_3depth_name: '',
      },
      {
        region_type: 'B',
        code: '4113510900',
        region_1depth_name: '경기도',
        region_2depth_name: '성남시 분당구',
        region_3depth_name: '정자동',
      },
    ]);
    expect(result.lawdCd).toBe('41135');
    expect(result.sigunguLabel).toContain('분당구');
  });
});
