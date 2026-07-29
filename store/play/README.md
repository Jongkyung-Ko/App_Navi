# Google Play Console 업로드 가이드 (App Navi)

패키지명부터 순서대로 입력하세요. 준비된 파일은 `store/play/`에 있습니다.

## 준비된 파일

| 파일 | 용도 | 규격 |
|------|------|------|
| `store/play/icon-512.png` | 스토어 아이콘 | 512×512 PNG |
| `store/play/feature-graphic-1024x500.png` | 추천 그래픽 | 1024×500 PNG |
| `store/play/LISTING_COPY.md` | 설명문 복붙용 | - |
| `store/play/DATA_SAFETY.md` | 데이터 안전성 답변 가이드 | - |
| 개인정보처리방침 URL | `https://app-navi-production.up.railway.app/privacy.html` | 배포 후 확인 |

스크린샷은 `store/play/screenshots/`에 직접 넣어 주세요 (최소 2장, 권장 4~8장).

## AAB가 아직 없을 때 (폰으로 받기)

PC 없이 GitHub Actions로 AAB를 만들 수 있습니다.  
→ 자세한 절차: [`BUILD_AAB_ON_GITHUB.md`](./BUILD_AAB_ON_GITHUB.md)

요약:
1. Expo Access Token 발급
2. GitHub Secret `EXPO_TOKEN` 등록
3. Actions → **Build Android AAB** 실행
4. Artifacts에서 `app-navi.aab` 다운로드

---

## STEP 0. 앱 만들기

Play Console → **앱 만들기**

| 항목 | 입력값 |
|------|--------|
| 앱 이름 | `App Navi` |
| 기본 언어 | 한국어 |
| 앱 또는 게임 | 앱 |
| 무료/유료 | 무료 |
| 선언 | 안내 체크박스 모두 확인 후 만들기 |

---

## STEP 1. 패키지 이름 (가장 중요)

AAB를 **처음** 올릴 때 패키지명이 확정됩니다.

| 항목 | 값 |
|------|-----|
| **패키지 이름** | `com.appnavi.mobile` |

- Expo/EAS 빌드도 이 패키지명을 써야 합니다 (`app.json`의 `android.package`).
- 한 번 올리면 **변경 불가**에 가깝습니다.
- 직접 업로드: **출시 → 프로덕션(또는 내부 테스트) → 새 버전 만들기 → App Bundle 업로드**

권장: 먼저 **내부 테스트** 트랙에 AAB를 올리세요.

---

## STEP 2. 대시보드 필수 작업 순서

왼쪽/상단 “출시까지 남은 작업”을 이 순서로 끝내세요.

### 2-1. 스토어 설정 → 기본 스토어 등록정보

| 항목 | 값 / 파일 |
|------|-----------|
| 앱 이름 | `App Navi` |
| 짧은 설명 | `LISTING_COPY.md`의 짧은 설명 |
| 자세한 설명 | `LISTING_COPY.md`의 자세한 설명 |
| 앱 아이콘 | `store/play/icon-512.png` |
| 추천 그래픽 | `store/play/feature-graphic-1024x500.png` |
| 휴대폰 스크린샷 | 최소 2장 (세로 권장, JPEG/PNG 24bit) |
| 앱 카테고리 | 부동산 또는 라이프스타일 / 도구 |
| 연락처 이메일 | 본인 이메일 (공개됨) |
| 개인정보처리방침 | `https://app-navi-production.up.railway.app/privacy.html` |

### 2-2. 스크린샷 찍는 법

기기 또는 에뮬레이터에서:

1. 홈 맵 (시세 모드)
2. 평단가 히트맵
3. 맵 전체보기 + 텍스트 카드
4. 주변 단지 리스트
5. (선택) 나레이션/설정 화면

저장 위치 예: `store/play/screenshots/01-home.png` …

권장 해상도: 1080×1920 전후 (최소 320px, 최대 3840px 한 변)

### 2-3. 앱 콘텐츠

| 항목 | 가이드 |
|------|--------|
| 개인정보처리방침 | 위 URL |
| 광고 | 아니요 (광고 없으면) |
| 앱 액세스 | 로그인 없음 → 모든 기능 제한 없이 사용 가능 |
| 콘텐츠 등급 | 설문 진행 (폭력/선정 없음 위주) |
| 타겟층 | 아동 대상 아님 |
| 뉴스 앱 | 아니요 |
| 데이터 안전성 | `DATA_SAFETY.md` 참고 |

### 2-4. 국가/지역 · 가격

- 국가: 한국 또는 원하는 국가
- 가격: 무료

### 2-5. 출시

1. **내부 테스트**에 AAB 업로드  
2. 테스터 추가 후 설치·동작 확인  
3. 이상 없으면 **프로덕션**으로 출시 제출  

---

## STEP 3. AAB 빌드 (아직 안 만들었다면)

로컬에서:

```bash
# 프로덕션 API 필수
export EXPO_PUBLIC_API_BASE_URL=https://app-navi-production.up.railway.app

npm i -g eas-cli
eas login
eas build --platform android --profile production
```

다운로드한 `.aab`를 Play Console에 업로드합니다.

> `app.json`의 `apiBaseUrl`이 localhost면 스토어 앱이 시세를 못 불러옵니다.  
> 빌드 시 `EXPO_PUBLIC_API_BASE_URL`을 꼭 프로덕션으로 주세요.

---

## STEP 4. 제출 직전 체크

- [ ] 패키지명 `com.appnavi.mobile`
- [ ] 아이콘 512 / 추천그래픽 1024×500
- [ ] 스크린샷 2장 이상
- [ ] 개인정보처리방침 URL 열림
- [ ] 데이터 안전성(위치 수집) 작성
- [ ] 내부 테스트에서 맵·위치·시세 동작 확인
- [ ] AAB versionCode가 이전보다 큼
