/**
 * MOLIT LAWD_CD is the 5-digit 시군구 code.
 * - 도시(광역/특별시·일반구): 구 단위 (예: 11140 중구, 41135 성남 분당구)
 * - 지방: 시·군 단위 (예: 42110 춘천시, 41820 가평군)
 */

export interface RegionDoc {
  region_type: string;
  code: string;
  region_1depth_name: string;
  region_2depth_name: string;
  region_3depth_name: string;
}

export interface SigunguResolution {
  /** 5-digit MOLIT LAWD_CD (시군구) */
  lawdCd: string;
  region1: string;
  /** 구 / 시 / 군 명칭 */
  region2: string;
  /** 읍·면·동 (표시용, 조사 단위 아님) */
  region3: string;
  /** UI용 조사 범위 라벨 */
  sigunguLabel: string;
}

function preferCode(docs: RegionDoc[], len: number): RegionDoc | undefined {
  return docs.find((d) => d.code.length === len);
}

/**
 * Resolve 시군구-level admin unit from Kakao coord2regioncode documents.
 * Prefers 법정동(B) codes for LAWD_CD, and 행정(H) 시군구 names for labels.
 */
export function resolveSigunguFromRegions(documents: RegionDoc[]): SigunguResolution {
  const bDocs = documents.filter((d) => d.region_type === 'B');
  const hDocs = documents.filter((d) => d.region_type === 'H');
  const all = documents.length ? documents : [];

  const bSgg = preferCode(bDocs, 5);
  const bDong = bDocs.find((d) => d.code.length >= 8) ?? bDocs[0];
  const hSgg = preferCode(hDocs, 5) ?? hDocs.find((d) => d.region_2depth_name && d.code.length >= 5);
  const hDong = hDocs.find((d) => d.code.length >= 8);

  const rawCode =
    bSgg?.code ??
    bDong?.code ??
    hSgg?.code ??
    hDong?.code ??
    all[0]?.code ??
    '';

  const lawdCd = rawCode.replace(/\D/g, '').slice(0, 5);
  if (lawdCd.length !== 5) {
    throw new Error('Failed to resolve 시군구(LAWD_CD) from region codes');
  }

  const nameSource = hSgg ?? bSgg ?? hDong ?? bDong ?? all[0];
  const region1 = nameSource?.region_1depth_name ?? '';
  let region2 = nameSource?.region_2depth_name ?? '';
  const region3 =
    bDong?.region_3depth_name ||
    hDong?.region_3depth_name ||
    nameSource?.region_3depth_name ||
    '';

  // 세종 등 시군구 명칭이 비는 경우 시도명으로 보완
  if (!region2 && region1) {
    region2 = region1.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '') || region1;
  }

  const sigunguLabel = [region1, region2].filter(Boolean).join(' ').trim() || lawdCd;

  return { lawdCd, region1, region2, region3, sigunguLabel };
}
