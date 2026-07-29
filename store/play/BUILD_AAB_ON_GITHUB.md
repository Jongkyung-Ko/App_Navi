# 폰으로 AAB 받아서 Play에 올리기

이 저장소에 **Build Android AAB** GitHub Action이 있습니다.  
PC 없이 폰 브라우저로도 받을 수 있습니다. (단, 최초 1회 Expo 토큰 등록 필요)

## 1) Expo Access Token 만들기 (폰 브라우저 OK)

1. https://expo.dev 접속 → 로그인/가입  
2. 계정 설정 → **Access tokens**  
   - 직접: https://expo.dev/settings/access-tokens  
3. **Create token** → 이름 예: `github-aab`  
4. 생성된 토큰 문자열 복사

## 2) GitHub Secret에 넣기

1. https://github.com/Jongkyung-Ko/App_Navi/settings/secrets/actions  
2. **New repository secret**  
3. Name: `EXPO_TOKEN`  
4. Value: 방금 복사한 토큰  
5. Save

## 3) 워크플로 실행

1. https://github.com/Jongkyung-Ko/App_Navi/actions/workflows/build-android-aab.yml  
2. **Run workflow**  
3. profile: `production`  
4. **Run workflow** 클릭  
5. 빌드 완료까지 대기 (보통 10~25분)

## 4) AAB 다운로드

1. 끝난 워크플로 클릭  
2. 하단 **Artifacts** → `app-navi-aab`  
3. 다운로드 (zip 안에 `app-navi.aab`)  
4. Play Console → App Bundle 업로드에 그 파일 올리기

## 참고

- 패키지명: `com.appnavi.mobile`
- production 프로필은 API를 `https://app-navi-production.up.railway.app` 로 빌드합니다.
- 첫 빌드에서 Expo 프로젝트 연결/키스토어 생성이 필요할 수 있습니다. 실패 로그를 보내주시면 이어서 조치합니다.
