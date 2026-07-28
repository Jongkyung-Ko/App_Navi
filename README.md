# App Navi

위치 기반 아파트 실거래 시세 앱 (React Native / Expo + 무료 API).

- GPS로 현재 위치·주소 표시
- 국토교통부 실거래가로 주변 아파트 단지 시세·최근 동향 표시

## 스택

| 역할 | 기술 |
|------|------|
| 앱 | Expo (TypeScript) + Expo Router |
| 위치 | expo-location |
| 지도 | 카카오맵 JS (WebView). 키 없으면 OSM Leaflet 폴백 |
| 주소 | 카카오 로컬 REST (`coord2address`, `coord2regioncode`) |
| 부동산 | 국토교통부 아파트 매매 실거래가 (공공데이터포털) |
| 프록시 | Node.js + Express (`server/`) — API 키 보관·캐시 |

## Phase 0 — API 키 발급

### 1) 카카오 디벨로퍼스

1. https://developers.kakao.com 로그인 후 애플리케이션 생성
2. **카카오맵 API를 이 계정에서 첫 번째로 활성화** (무료 쿼터 조건)
3. REST API 키 → `KAKAO_REST_KEY`
4. JavaScript 키 → `KAKAO_JS_KEY` (지도 WebView용)
5. 플랫폼에 Android 패키지 `com.appnavi.mobile` / iOS 번들 `com.appnavi.mobile` 등록
6. Web 플랫폼에 사이트 도메인 추가: `localhost`, `127.0.0.1` (지도 JS용)

### 2) 공공데이터포털 (국토부 실거래)

1. https://www.data.go.kr 회원가입
2. **국토교통부_아파트 매매 실거래가 자료** + **아파트 전월세 실거래가 자료** 활용신청
3. 일반 인증키 → `MOLIT_SERVICE_KEY` (매매·전월세 공통)

### 3) 환경 변수

```bash
cp server/.env.example server/.env
# server/.env 에 키를 넣으세요
```

키가 없어도 `ALLOW_MOCK_FALLBACK=true`이면 **데모 데이터**로 UI를 확인할 수 있습니다.

### 키 검증 (완료 기준)

```bash
npm run server:start
curl http://localhost:3001/health
curl "http://localhost:3001/api/geocode/reverse?lat=37.5665&lng=126.9780"
curl "http://localhost:3001/api/trades?lawdCd=11140&months=1"
```

## 공개 배포 URL

- 앱/API: https://app-navi-production.up.railway.app
- 상태: https://app-navi-production.up.railway.app/health

카카오맵 JS를 쓰려면 디벨로퍼스 Web 도메인에 `app-navi-production.up.railway.app` 를 등록하세요. (미등록 시 OSM 폴백)

`master` / `main` 푸시 시 Railway가 자동 배포되도록 연결해 두세요. GitHub Actions 보조 배포는 Secrets에 `RAILWAY_TOKEN`(선택: `RAILWAY_SERVICE_ID`)이 있을 때 동작합니다.

## 실행

터미널 1 — 프록시:

```bash
npm run server
```

터미널 2 — 앱:

```bash
npm start
```

- Android 에뮬레이터: API는 `10.0.2.2:3001`로 자동 연결
- 실기기: `app.json` → `extra.apiBaseUrl`을 PC LAN IP로 변경 (예: `http://192.168.0.10:3001`)

## 화면

1. **홈** — 지도 + 현재 주소 + 주변 단지 요약
2. **주변 단지 시세** — 검색·면적대 필터
3. **단지 상세** — 월별 동향 차트 + 최근 거래

## 테스트

```bash
npm test
```

집계/중위가/평당가/증감률 단위 테스트 (`server/src/__tests__`).

## EAS 빌드 (내부 테스트)

```bash
npx eas-cli login
npx eas build -p android --profile preview
```

자세한 QA·개인정보 문구는 `docs/` 참고.

## 쿼터·캐시

- 서버는 `LAWD_CD`+월 단위로 MOLIT 응답을 캐시합니다 (`CACHE_TTL_SECONDS`, 기본 6시간)
- 카카오 REST는 서버에서만 호출합니다 (키 노출 방지)
- 카카오 무료 쿼터: 개발자 계정 기준 **첫 맵 활성화 앱**만 적용

## 개인정보

위치는 기기에서 획득하며, 주소 변환·시세 조회를 위해 좌표가 프록시로 전달됩니다. 로그인·영구 위치 저장은 하지 않습니다. 자세한 내용: [docs/PRIVACY.md](docs/PRIVACY.md)
