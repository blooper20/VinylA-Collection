# VinylA Collection — Dev Log

매일 작업을 마무리할 때 날짜별로 기록합니다.

---

## 2026-06-18 (Day 2)

### 🎯 오늘의 목표
Stitch UI 시안을 Next.js 웹 앱에 이식하고, 모바일 Vision AI 연동 및 외부 API 브릿지를 완성한다.

---

### ✅ 완료된 작업 (커밋 순서)

#### 1. `feat(ui)` — ThemeContext, 멀티 테마 토큰, Glassmorphism 시스템
- `packages/ui/src/ThemeContext.tsx`: `createContext` 기반 테마 스위칭 컨텍스트 작성. `"use client"` 지시어 추가로 RSC 충돌 해결
- `packages/ui/src/tokens.ts`: `DARK_BLACK`, `MOODY_WALNUT`, `CLEAN_DOODLING` 3개 테마의 디자인 토큰 확장
- `packages/ui/src/index.tsx`: ThemeProvider, ThemeContext export 정리

#### 2. `feat(core-api)` — Supabase, DB CRUD, OAuth, 외부 API 브릿지
- `packages/core-api/src/supabase.ts`: `@supabase/supabase-js` 클라이언트 초기화. 개발 환경 fallback URL 추가로 런타임 크래시 방지
- `packages/core-api/src/supabaseDb.ts`: `ALBUM_MASTER`, `USER_VINYL`, `VINYL_TAG` 테이블에 대한 CRUD 함수 구현
- `packages/core-api/src/auth.ts`: Supabase Google OAuth 로그인/로그아웃 함수 뼈대 작성
- `packages/core-api/src/externalApi.ts`: Discogs 검색(`EXPO_PUBLIC_DISCOGS_TOKEN`)과 YouTube 영상 검색(`EXPO_PUBLIC_YOUTUBE_API_KEY`) 비동기 함수 작성

#### 3. `feat(web)` — SideNav, ThemeSync, 전역 레이아웃 셸
- `apps/web/src/components/Navigation/SideNav.tsx`: Hover 시 80px → 256px로 확장되는 인터랙티브 사이드바 구현
- `apps/web/src/components/Theme/ThemeSync.tsx`: `data-theme` 속성을 HTML 태그에 동기화하는 클라이언트 컴포넌트
- `apps/web/src/app/globals.css`: `texture-overlay`(노이즈 필터), `doodle-bg`, 커스텀 스크롤바, `.main-content` 레이아웃 시프트 CSS 추가
- `apps/web/src/app/layout.tsx`: Material Symbols 폰트 링크, SideNav, ThemeProvider, ThemeSync 통합

#### 4. `feat(web/search)` — Discovery Hub (Stitch UI 이식)
- 전체 HTML/Tailwind → Vanilla CSS (CSS Modules) 수동 변환
- 72px Bodoni Moda 헤로 타이틀 + 하단 언더라인 포커스 검색 인풋
- CSS `column-count` 기반 **Masonry 그리드** (1→2→3→4열 반응형)
- Hover 시 이미지 스케일 + 오버레이 투명도 트랜지션 효과

#### 5. `feat(web/my)` — Profile Dashboard Lux (Stitch UI 이식)
- 원형 Avatar 프레임 + Elite Curator 뱃지 (Glassmorphism 패널)
- Vault Analytics 3열 통계 카드 (Backdrop-blur + 상단 Accent 그라데이션 라인)
- Musical Journey 가로 스크롤 폴라로이드 타임라인
- Profile Actions 버튼 (Edit Collection, Export Vault Data)

#### 6. `feat(web/wishlist)` — Rare Findings Wishlist (Stitch UI 이식)
- Spotlight Hero 카드 (RARE FIND 뱃지 + Walnut Gradient)
- Wanted List: 우선순위별(HIGH/MEDIUM/LOW) 좌측 컬러 라인 + Progress Bar
- Curator's Log: 편집 가능 형식의 Glassmorphism 메모 패널
- 데스크톱 기준 2열 그리드 (Spotlight | List) 반응형 레이아웃

#### 7. `feat(web)` — DetailModal Discogs/YouTube 연동
- 웹 `DetailModal.tsx`에 `searchDiscogs`, `searchYouTube` 함수 연결
- 검색 결과를 팝업 내에서 바로 표시하고, YouTube는 `window.open`으로 연결

#### 8. `feat(mobile)` — My/Scan/Wishlist 스크린 + Vision AI 통합
- `MyScreen.tsx`: 모바일 Bento 통계 그리드, 세로 타임라인 (Glow 도트 + 이미지 Grayscale → Color Hover)
- `ScanScreen.tsx`: 카메라 뷰파인더 고도화 (어두운 오버레이, 'Point at a record' 가이드 문구, 플래시/셔터 버튼)
- `apps/mobile/src/utils/visionAPI.ts`: Google Cloud Vision API 호출 뼈대 (Base64 이미지 → OCR + 이미지 특징 추출 → 외부 DB 쿼리)
- `WishScreen.tsx`: Obsidian 그라데이션 배경, 우선순위 컬러 바, Curator's Log 노트 패널

#### 9. `chore` — app.json, eas.json, turbo.json, 루트 의존성
- `apps/mobile/app.json`: 아이콘/스플래시 경로 최적화
- `apps/mobile/eas.json`: iOS TestFlight 및 Android 빌드 프로파일 뼈대 작성
- `turbo.json`: `dev`, `build`, `lint` 파이프라인 정비

---

### 🐛 알려진 이슈 및 TODO

| 구분 | 내용 | 상태 |
|------|------|------|
| `env` | `EXPO_PUBLIC_DISCOGS_TOKEN`, `EXPO_PUBLIC_YOUTUBE_API_KEY` 환경 변수 미설정 | ⚠️ 콘솔 경고 (기능 비활성) |
| `env` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` 미설정 | ⚠️ Fallback 모드 동작 중 |
| `env` | `EXPO_PUBLIC_VISION_API_KEY` 미설정 | ⚠️ 실제 스캔 불가 |
| `web` | `/settings` 페이지 없음 → 404 | 🔲 미구현 |
| `mobile` | React Native 버전 My/Search/Wishlist Stitch UI 완전 이식 | 🔲 다음 세션 예정 |
| `infra` | Supabase 프로젝트 연결 및 테이블 마이그레이션 실행 | 🔲 미실행 |

---

### 📦 오늘 변경된 주요 파일

```
packages/
  ui/src/ThemeContext.tsx          ← NEW
  ui/src/tokens.ts                 ← MOD
  ui/src/index.tsx                 ← MOD
  core-api/src/supabase.ts         ← NEW
  core-api/src/supabaseDb.ts       ← NEW
  core-api/src/auth.ts             ← NEW
  core-api/src/externalApi.ts      ← NEW

apps/web/
  src/app/globals.css              ← MOD (texture, scrollbar, layout-shift)
  src/app/layout.tsx               ← MOD (SideNav, ThemeProvider, Material Icons)
  src/app/search/page.tsx          ← MOD (Stitch UI 이식)
  src/app/search/page.module.css   ← MOD (Masonry, Header)
  src/app/my/page.tsx              ← NEW
  src/app/my/page.module.css       ← NEW
  src/app/wishlist/page.tsx        ← MOD (Stitch UI 이식)
  src/app/wishlist/page.module.css ← MOD
  src/components/Navigation/SideNav.tsx         ← NEW
  src/components/Navigation/SideNav.module.css  ← NEW
  src/components/Theme/ThemeSync.tsx            ← NEW
  src/components/Modal/DetailModal.tsx          ← MOD

apps/mobile/
  src/screens/MyScreen.tsx         ← NEW
  src/screens/ScanScreen.tsx       ← MOD
  src/screens/WishScreen.tsx       ← MOD
  src/utils/visionAPI.ts           ← NEW
  src/navigation/TabNavigator.tsx  ← MOD
  src/components/Modal/DetailModal.tsx ← MOD
  app.json                         ← MOD
  eas.json                         ← NEW
```

---

### 📎 참고 자료
- Stitch Project ID: `6479699016643164123`
- VinylA_Blue_Print.md — 프로젝트 최우선 설계서
- Git: `826de1c` → `3a981a1` (9 commits pushed to `main`)

## 2026-07-01: Vision API 결제 이슈 및 Gemini 2.5 Flash 100% 무료 전환기

### 💥 이슈 1: Google Cloud Vision API 403 Permission Denied
모바일 앱에서 앨범 커버의 텍스트(OCR)와 객체 키워드(Web Entities)를 추출하기 위해 사용하던 `Google Cloud Vision API`가 403 에러를 뱉기 시작함.
- **원인**: 구글 클라우드 정책 상 Vision API는 결제 계정(신용카드)이 연결된 프로젝트에서만 작동함. 무료 할당량이 있더라도 결제 수단 등록은 필수.
- **해결**: Vision API를 완전히 버리고, **멀티모달 처리에 능하고 무료 티어를 제공하는 Gemini 2.5 Flash**로 1단계(텍스트/키워드 추출) 로직을 전면 대체.

### 💥 이슈 2: Gemini 2.5 Flash JSON 잘림 (Thinking Budget 버그)
프롬프트에 순수 JSON 포맷 출력을 명시했으나, 반환값이 `{` 한 글자로 잘리거나 파싱 에러 발생.
- **원인**: Gemini 2.5 Flash 모델은 내부적으로 "생각(Thinking)"을 거친 뒤 답변을 생성하는 사고형 모델. 생각 과정에 소모되는 토큰이 `maxOutputTokens` 예산에서 선차감됨. 기존 `maxOutputTokens: 300`으로는 생각만 하다가 예산이 바닥나 실제 JSON을 출력하지 못함.
- **해결**:
  1. `maxOutputTokens: 2048`로 대폭 확장.
  2. `thinkingConfig: { thinkingBudget: 0 }` 옵션을 부여하여 내부 사고를 생략하고 즉시 답변을 뱉어내도록 강제 (응답 속도 대폭 향상).
  3. AI 특성 상 가끔 "Here is the JSON:" 같은 인사말을 덧붙이므로, `responseText.match(/\{[\s\S]*\}/)` 정규식으로 순수 JSON 블록만 안전하게 추출하도록 파싱 로직 보강.

### 🚀 최적화 1: 모바일 카메라 촬영/전송 속도 10배 향상
- **문제**: `takePictureAsync` 시 딜레이가 길고, 셔터를 누른 후 로딩 스피너가 너무 오래 돎.
- **원인**: 모바일 기기의 원본 해상도(수천 픽셀) 사진을 Crop하고 곧바로 Base64로 인코딩하려다 보니 연산량과 페이로드가 수십 MB 단위로 폭증.
- **해결**: `takePictureAsync({ quality: 0.3 })`으로 1차 압축하고, `ImageManipulator` 단계에 `{ resize: { width: 800 } }` 액션을 추가하여 크롭 직후 이미지 크기를 획기적으로 줄인 뒤 인코딩. 전송 속도와 메모리 점유율을 대폭 개선.

### 🚀 최적화 2: 한국어 앨범 인식률을 위한 Query 다각화
- 기존에는 `"아티스트 - 앨범명"` 단일 문자열 하나에 의존하여 Discogs 검색 성공률이 낮았음 (특히 한글 앨범).
- **해결**: Gemini에게 `artist`, `album`, `tracks`(수록곡), `keywords`를 명시적으로 분리해서 JSON으로 주도록 프롬프트를 고도화.
  - "한국 가수면 정확히 한글로 유추하라"는 규칙 추가 (이문세를 '김두수' 등으로 오인하는 증상 방어).
  - 추출된 데이터를 분해하여 `[아티스트 - 앨범, 앨범단독, 아티스트단독, 트랙1, 트랙2, 키워드]` 순으로 검색 쿼리 배열을 풍성하게 만들어 Discogs 탐색 그물망을 촘촘하게 짬.

---

## 2026-07-02: 마이페이지 UI 정비 및 홈/위시리스트 공유(Share) 시스템 구축

### 🎯 오늘의 목표
마이페이지 세부 UI 버그·통일성 정리, 홈/위시리스트 화면에 브랜드 헤더·뷰 전환·정렬·공유 기능 신규 구축, 앨범 상세(웹+앱) 공유 기능 신설.

---

### ✅ 완료된 작업

#### 1. `fix(core-api)` — 시장 추정가(MARKET_PRICE) DB 미반영 근본 원인 수정
- `ALBUM_MASTER` 테이블에 `MARKET_PRICE` 컬럼 자체가 없어(`42703`) `createAlbumMaster`가 저장 때마다 값을 조용히 삭제하고 있었음. 삭제 라인 제거 + `supabase_schema.sql`에 컬럼 추가 SQL 반영(수동 실행 필요).

#### 2. `style/fix(mobile)` — 마이페이지 UI 정리
- 컬렉션 분석 카드 중 편집 가능한 카드를 골드 톤 + Feather 아이콘으로 시각적으로 구분.
- 금액이 커질 때 카드 밖으로 넘치던 문제(`adjustsFontSizeToFit`), 실제 지출액 카드의 공개/비공개 토글이 금액 텍스트와 겹치던 문제(칩을 `position: absolute`로 완전 분리) 수정.
- 닉네임 최대 12자 제한 신설(`NICKNAME_MAX_LENGTH`) 및 웹·앱 전체 입력창에 글자수 카운터 적용, 긴 닉네임이 헤더 레이아웃을 깨던 문제 수정.
- '글래스 효과 강도'를 로그아웃 버튼 위 "설정 열기/닫기" 토글로 재구성. 스크롤 인디케이터 숨김, 로그아웃 버튼 빨간색 강조, 회원 탈퇴 버튼 신설(웹 `DeleteAccountModal`과 동일 로직).

#### 3. `feat(mobile)` — 홈 / 위시리스트 화면 전면 개편
- 상단 공용 브랜드 헤더(`AppHeader`): 로고 + 타이틀 + 모드 배지, 우측에 그리드/테이블 뷰 전환 토글.
- 테이블 뷰(`VinylTableRow`)와 최신순/오래된순/가나다순/출시연도순 정렬 칩(`sortVinyls`, 웹 `VinylGrid`와 동일 기준) 추가.
- `FlatList`에 `style={{flex:1}}` 누락으로 스크롤이 아예 안 되던 버그, 그리드↔테이블 전환 시 `numColumns` 변경 크래시(각 리스트에 `key` 분리로 해결), 토스트가 하단 플로팅 탭바에 가려지던 문제 수정.

#### 4. `feat` — 컬렉션 · 위시리스트 · 앨범 상세 공유 기능 신규 구축 (웹 + 앱)
- 홈/위시리스트: "이미지 공유"(인스타그램 스토리)/"링크 공유" 바텀시트. 보유 앨범 4열 그리드 세로형(1080×1920) 공유 이미지 자동 생성.
- 앨범 상세(`DetailModal`, 웹+앱): 공유 버튼 신설. 커버 중심 세로형 스토리 이미지 생성 후 인스타그램 스토리/링크 공유.
- 앨범 상태별 상단 배지: 보유중 `COLLECTED`(골드 네온), 미보유 `JUST DROPPED`(마젠타 네온), 위시는 서부극 현상수배 포스터풍 `★ WANTED ★`(크림/황갈색, 세리프체, 회전). `letter-spacing` 트레일링 여백으로 텍스트가 쏠려 보이던 정렬 버그 수정.
- 워터마크를 "Curated by VinylA Collection"으로 통일하고, 웹 워터마크의 닉네임 줄바꿈/생략 버그(html2canvas의 flex 퍼센트 폭 계산 불안정) 근본 수정.
- 공유 링크가 존재하지 않는 사설 IP(`192.168.0.20:3000`)를 가리키고 있어 받는 사람이 열어볼 수 없던 버그 발견, 프로덕션 주소(`https://vinyla.vercel.app`)로 교체.
- `DetailModal`(RN `<Modal>`) 안에 공유 시트를 또 다른 `<Modal>`로 중첩하면 iOS 프리징이 재발할 수 있어, 공유 시트를 `<Modal>` 없는 절대 위치 오버레이로 재구현.

#### 5. `fix(mobile)` — 앨범 상세 하단 액션 버튼 크기 통일
- `btnPrimary`/`btnOutline`/`btnYoutube`의 높이가 아이콘 유무·폰트 크기 차이로 미묘하게 달라 보이던 문제를 공통 `BUTTON_HEIGHT(52)`로 고정.

---

### 📦 오늘 변경된 주요 파일
```
apps/mobile/
  src/screens/MyScreen.tsx, HomeScreen.tsx, WishScreen.tsx   ← MOD
  src/components/AppHeader.tsx                               ← NEW
  src/components/SortChipRow.tsx, VinylTableRow.tsx           ← NEW
  src/components/Modal/ShareOptionsSheet.tsx                  ← NEW
  src/components/Modal/DeleteAccountModal.tsx                 ← NEW
  src/components/Modal/DetailModal.tsx                        ← MOD
  src/components/Share/ShareableGridView.tsx                  ← NEW
  src/components/Share/ShareableStoryView.tsx                 ← NEW
  src/components/Toast/NativeToast.tsx                        ← MOD
  src/utils/sortVinyls.ts                                     ← NEW
apps/web/
  src/components/Share/StoryTemplate.tsx(.module.css)         ← MOD
  src/components/Share/ShareableGridTemplate.tsx               ← MOD
packages/core-api/
  src/constants.ts                                             ← NEW
  src/supabaseDb.ts                                            ← MOD
supabase_schema.sql                                            ← MOD (수동 실행 필요)
```

---

## 2026-07-09: 온보딩 리디자인, 검색 무한 스크롤, 로그인 복구 및 RLS 도입

### 🎯 목표
온보딩 첫인상을 브랜드 수준으로 끌어올리고, 검색을 "20장 한계"에서 해방시키고, 웹 로그인 불능 원인을 뿌리까지 추적한 뒤 DB를 실제 서비스 가능한 보안 상태로 만든다.

### ✅ 작업 내역

#### 1. `feat(mobile)` — 온보딩 에디토리얼 리디자인
- 좌측 정렬 타이포 체계(골드 오버라인 → 한글 헤드라인+골드 강조 단어 → 서브카피)와 고스트 스텝 넘버로 매거진 무드 구축.
- 스텝 1: 골드 림/그루브 레코드에 로고의 바닐라 오키드를 View로 그린 8개 각인 패턴(불투명도 0.3)을 얹고, 톤암이 레코드에 내려앉는 드롭 애니메이션 추가. 회전은 9초/바퀴로 체감 가능하게.
- 스텝 2: 📷 이모지 → 뷰파인더 + 골드 스캔라인 스윕 애니메이션.
- 하단 고정 페이지네이션 + 골드 원형 next 버튼(마지막 페이지에서 페이드아웃).
- 카피를 블루프린트 언어(비밀 박물관/자산화/LP 전시실)로 통일, 로그인 패널에 `VINYL + VANILLA` 태그 칩 + `Collection` 라인. 전 화면 "VinylA Collection" 대소문자 표기 통일.

#### 2. `feat(mobile)` — Discogs 검색 무한 스크롤
- `createDiscogsSearchSession`: dedupe 세트·iTunes 별칭·페이지 커서를 세션에 보존하는 `loadMore()` 패턴으로 리팩토링. 배치당 ~20장, 바닥 600px 전 자동 로드, 중복 재등장 없음.
- 장르 검색은 "클릭마다 다른 결과" 느낌(랜덤 시작 페이지)과 "세션 내 일관 페이징"을 양립.
- 검색 결과에서 왼쪽 가장자리 스와이프 → 장르 탐색 화면 복귀 제스처 (탐색 화면에서는 핸들러 미장착으로 완전 비활성).

#### 3. `fix(web)` + 인프라 — 로그인 완전 복구
- 로그인 유도 팝업의 `/login`(존재하지 않는 라우트) 링크 → `/` 수정.
- "버튼이 안 눌린다"는 증상을 헤드리스 Chrome으로 재현 시도 → 코드는 정상, 실제 원인은 **Supabase Site URL이 `exp://`(모바일 Expo URL)로 설정**되어 있어 인증 완료 후 브라우저가 열 수 없는 스킴으로 리다이렉트되던 것. URL Configuration 정리(localhost/**, vinyla.vercel.app/**, exp://**)로 해결.
- Apple 로그인을 Google과 공용 OAuth 핸들러로 구현(Supabase Apple provider 연동 시 활성화).

#### 4. `feat(db)` — MARKET_PRICE 검증 + RLS 정책
- MARKET_PRICE 컬럼 마이그레이션 실행 확인 후 쓰기→재조회→원복으로 검증. 시장 추정가 저장 정상화.
- 검증 중 anon key만으로 `ALBUM_MASTER`가 수정되는 것을 발견 → 4개 테이블 전체 RLS 적용: 공개 읽기(퍼블릭 대시보드/실시간 구독 보존), 로그인 쓰기, USER_VINYL·PROFILES는 `auth.uid()` 소유자만 쓰기. 익명 쓰기 차단 + 로그인 쓰기 정상 3단 검증 완료. 정책 SQL은 `supabase_schema.sql`에서 idempotent하게 관리.

#### 5. `fix` — 타입 에러 전량 해소, 프로덕션 빌드 그린
- `MockVinylData = ALBUM_MASTER & Partial<USER_VINYL>`(미보유 앨범엔 소유 필드가 없는 현실 반영), `mapToFrontendModel` 누락 필드 보강, `useAuthStore` 시그니처 정합.
- MyScreen 아바타 업로드의 `FileSystem` import 누락(런타임 크래시 상태) 발견·수정 — SDK 54는 `expo-file-system/legacy` 경로 필요.
- 모바일 tsc 0 에러, 웹 `next build` 통과. Vercel 배포 준비 완료.

### 📦 남은 것
- 웹 Vercel 프로덕션 배포 (`npx vercel` 연결 + 환경변수 등록)
- Apple Developer 계정 → Supabase Apple provider 연동 (스토어 제출 요건)
- EAS 빌드로 실기기 테스트 (`eas.json` 프로필 준비됨)

---

## 2026-07-14: 소셜 로드맵 3~5 — 바이닐 스토리 · 실시간 피드 · 취향 매칭/팔로우 (웹)

### 🎯 목표
소셜/참여 로드맵의 남은 세 기능을 웹에 구현한다 (상세 설계: `docs/SOCIAL_ROADMAP.md`). 웹 검증 후 모바일 이식 예정.

### ✅ 작업 내역

#### 1. `feat` — 오늘의 바이닐 스토리 (`/story`)
- 크론 없이 "조회 시 없으면 생성 후 DB 캐싱": `/api/vinyl-story/today`가 Gemini(JSON 모드)로 생성, day-of-year 결정론 앨범 선택 + upsert `ignoreDuplicates`로 동시 요청에도 하루 한 건 보장. iTunes Search로 600x600 커버(실패 시 텍스트만).
- `VINYL_STORY` 테이블: public read, 클라이언트 쓰기 정책 없음(service role만).
- 페이지: 오늘의 스토리 카드 + 지난 이야기 아카이브. AI 생성 고지 문구 포함.

#### 2. `feat` — 실시간 피드 (`/feed`)
- 신규 테이블 없음: `USER_VINYL`(이미 public read + Realtime 등록) `OWNED` 행을 `ADDED_AT` 내림차순으로, `ALBUM_MASTER` 조인 + `PROFILES` 닉네임 별도 조회. 구매 가격은 비노출.
- Realtime 구독으로 INSERT/WISH→OWNED 전환을 실시간 반영(등장 애니메이션), `USER_VINYL_ID` 중복 제거, 커서 페이지네이션.

#### 3. `feat` — 취향 매칭 & 팔로우
- DDL(수동 실행 필요): `USER_FOLLOW`(RLS: 전체 읽기/본인만 쓰기/자기 팔로우 금지) + `get_taste_matches` RPC(겹침 ÷ min(내, 상대) 집계를 DB에서) + EVENT_LOG `FOLLOW` 타입.
- `/feed` 상단 "나와 취향이 통하는 수집가" 추천 레일, `/user/[id]` 헤더 팔로우 버튼 + 일치율 배지(이미 로드된 데이터로 추가 쿼리 없이 계산). 팔로우는 낙관적 토글.

#### 4. 공통
- core-api 신규 모듈 `vinylStory.ts`/`feed.ts`/`follows.ts`, 사이드바에 피드·스토리 항목, i18n(ko/en) 전체 문구.
- `docs/SOCIAL_ROADMAP.md` 신설 — 기능별 설계/한계/모바일 파리티 TODO.

### 📦 남은 것
- Supabase SQL Editor에서 `supabase_schema.sql`의 2026-07-14 두 섹션(VINYL_STORY, USER_FOLLOW+RPC) 실행
- 로컬 실측(스토리 생성, 피드 실시간, 팔로우/매칭) 후 커밋·푸시
- 모바일 이식 (SOCIAL_ROADMAP.md 파리티 TODO)

#### 5. `feat` — 프로필 공개/비공개 + 팔로우 카운트 (같은 날 2차)
- `PROFILES.IS_PUBLIC` + `is_profile_public()` + `USER_VINYL` 읽기 정책 교체(본인/공개/관리자만) — 비공개 유저는 실시간 피드(Realtime 포함)·공유 프로필·취향 매칭에서 RLS 레벨로 자동 제외. `get_taste_matches`도 비공개 제외로 재정의.
- `/my`: 프로필 공개/비공개 토글 + 팔로워/팔로잉 카운트. `/user/[id]`·`/user/[id]/dashboard`: 팔로워/팔로잉 카운트 + 팔로우 버튼 + 비공개 잠금 안내 화면(본인·관리자 통과).
- core-api `profile.ts` 신설(`getProfileInfo`/`setMyProfileVisibility` — DISPLAY_NAME 미포함 upsert라 닉네임 쿨다운 트리거와 무관).

#### 6. `feat` — 팔로워/팔로잉 목록 + 팔로우 요청 (같은 날 3·4차)
- 스펙: 비공개여도 팔로워/팔로잉 "숫자"는 모두에게, "목록"은 본인(+관리자)만. 비공개 프로필 팔로우는 요청 → 수락 방식.
- DDL: `USER_FOLLOW` 읽기 정책(당사자/관리자/양쪽 공개), `FOLLOW_REQUEST` 테이블, SECURITY DEFINER RPC 3종(`get_follow_counts` 집계 전용, `get_follow_list` 접근검사 내장, `accept_follow_request` 수락 원자 처리).
- 팔로우 버튼 3상태(팔로우/팔로우 요청/요청됨/팔로잉), 비공개 잠금 화면에도 카운트+요청 버튼. `FollowListModal`에 요청 탭(수락/거절), `/my`에 "요청 N" 배지.

#### 7. `feat` — 전원 기본 비공개 전환 (같은 날 5차)
- 기존 유저 전원 `IS_PUBLIC=false` 초기화 + 컬럼 기본값 false + `is_profile_public()`을 opt-in으로 재정의(행 없는 계정도 비공개).
- 가입 설정(/setup)에 프로필 공개 선택(기본 비공개) + 안내 문구, `/my`에서 비공개 상태로 공유 링크 복사 시 경고 토스트.
- 운영 참고: 초기화 직후 실시간 피드·취향 매칭은 유저들이 공개 전환하기 전까지 비어 보임.

#### 8. `feat` — 수락된 팔로워의 비공개 콘텐츠 열람 (같은 날 6차)
- `can_view_profile()` 신설: 본인 OR 공개 OR 관리자 OR 수락된 팔로워. `USER_VINYL` 읽기 정책과 `get_follow_list`를 이 함수로 일원화 — 팔로워는 비공개 유저의 보관함·피드 노출·팔로우 목록을 볼 수 있다(인스타 비공개 계정 방식).
- 웹 잠금 화면 게이트에도 `followStatus === 'following'` 통과 조건 추가, 잠금 안내 문구에 "팔로우 요청이 수락되면 볼 수 있어요" 추가.

#### 9. `feat` — 프로필 대시보드 통합 + 공개 다이어리 히스토리 (같은 날 7차)
- 피드/추천 레일/팔로우 목록의 유저 클릭 → 컬렉션 공유 페이지(/user/[id])가 아닌 **프로필 대시보드**(/user/[id]/dashboard?n=닉네임)로 이동.
- 대시보드에 "스피닝 다이어리" 탭 신설 — 공개(IS_PUBLIC) 재생 기록만 표시(`getPublicListeningLog`), 탭 첫 클릭 시 지연 로딩.
- LISTENING_LOG 읽기 정책 7차: 공개 기록도 `can_view_profile()` 통과자(본인/공개/관리자/수락된 팔로워)만 — 프로필 프라이버시와 일원화.
- `/log`(내 다이어리)에 **날짜별/앨범별 뷰 스위처** — 앨범별은 앨범 단위로 재생 기록을 묶어 재생 횟수와 함께 표시.

#### 10. `feat` — 피드 에포크 + 다이어리 소셜 (같은 날 8차)
- **피드 에포크**: 기능 출시(2026-07-14 18:00 KST) 이전에 담긴 수집은 피드에서 영구 제외(`FEED_EPOCH` gte 필터 + Realtime enrich 가드). 기존 데이터는 "피드 공개" 동의 없이 만들어진 것이라는 판단 — 데이터 삭제 없이 컬렉션은 보존, 컬렉션 열람은 공개 opt-in이 통제.
- **다이어리 소셜**: SPIN_LOG_LIKE/COMMENT(답글 자기참조)/SAVE/REPORT 4개 테이블 — 모든 상호작용 RLS가 LISTENING_LOG 가시성(EXISTS 서브쿼리)에 연동되어 "볼 수 있는 기록"에만 가능. 댓글 삭제는 작성자 또는 기록 주인.
- `SpinSocialModal`(좋아요/댓글·답글/공유 링크 복사/저장/신고) — `/log`(카운트 버튼)와 대시보드 다이어리 탭(항목 클릭)에서 열림. 대시보드 `?tab=diary` 딥링크 지원(공유 링크가 다이어리 탭으로 바로 연결).

#### 11. `feat` — 알림함 (같은 날 9차)
- `NOTIFICATION` 테이블 + DB 트리거 9종: 다이어리/수집 게시물의 좋아요·댓글·답글, 팔로우 요청·수락·새 팔로워를 트리거가 적재(웹/모바일 어디서 발생해도 쌓임). 좋아요 취소·요청 취소 시 해당 알림 자동 삭제. 댓글 삭제 시 FK cascade. 클라이언트 INSERT 정책 없음, 수신자 본인만 조회/읽음처리.
- Realtime publication 등록 — 사이드바 알림 배지가 실시간 갱신(RLS로 본인 이벤트만 수신).
- `/notifications` 페이지(열람 시 전체 읽음 처리, 미읽음 강조, 타입별 아이콘/이동 링크) + 사이드바 '알림' 항목·미읽음 카운트 배지, core-api `notifications.ts`.

#### 12. `fix` — 소셜 모달 스크롤 (같은 날 10차)
- `SpinSocialModal`/`VinylSocialModal` 열림 중 body 스크롤 잠금(DetailModal과 동일 패턴) — 모달 위에서 휠을 굴리면 뒤 페이지가 스크롤되던 문제.
- 잠금 후 댓글이 안 보이는 2차 문제: 댓글 목록만 `flex:1` 스크롤 영역이라 위 콘텐츠(앨범 카드+미디어)가 크면 몇 px로 눌렸다. 헤더/댓글 입력창만 고정하고 앨범 카드~댓글 목록을 하나의 스크롤 영역으로 재구성(인스타 방식).

#### 13. `fix` — SIGNUP_NUMBER upsert 번호 소모 (같은 날 11차)
- 증상: 창단 멤버 넘버링이 32~35번째 유저에게 #36/#42/#43/#44로 부여됨.
- 원인: 번호를 BEFORE INSERT 트리거의 `nextval()`로 부여하는데, 닉네임 저장/변경이 PROFILES를 **upsert** — 기존 행이면 INSERT 분기가 시퀀스를 소모한 뒤 conflict→UPDATE로 빠져 번호만 유지되고 시퀀스는 전진.
- 수정(DDL, 수동 실행 필요): 부여를 AFTER INSERT 트리거로 이동(실제 삽입 시에만 발동, upsert의 UPDATE 경로에선 미발동), BEFORE 트리거는 INSERT 시 클라이언트 값 무효화 + 부여 후 불변 유지만 담당. 잘못 부여된 4명 재번호 + setval 원복.

#### 14. `fix` — 창단 멤버 배지 "#/100" 표시 (같은 날 12차)
- 증상: 컬렉션 0장인 창단 멤버(예: 아빠 #21)의 /my 배지가 "창단 멤버 #/100"으로 넘버 없이 표시.
- 원인: /my에서 `getSignupNumber` 호출이 `if (data.length > 0)` 블록 안 — 빈 컬렉션이면 조회 자체가 안 됨. 대시보드(공유 링크) 경로는 별도 fetch라 정상(프로덕션 로그인 실측으로 확인).
- 수정: 조회를 컬렉션 유무와 무관하게 effect 초입으로 이동 + `getBadgeText`에 넘버 부재 시 "창단 멤버"(숫자 없음) fallback 추가(로딩 중 "#/100" 깜빡임도 제거).

#### 15. `feat` — 사이드바 메뉴 통합 (같은 날 13차)
- 9개 메뉴 → 7개: '소셜'(피드+다이어리), '컬렉션'(컬렉션+위시리스트)으로 묶고 각 페이지 상단에 탭(`PageTabs`) 추가.
- 기존 라우트(/feed, /log, /collection, /wishlist)는 그대로 두고 탭이 Link로 오가는 방식 — 공유 링크/딥링크 무손상. 사이드바 활성 판정은 그룹 경로 match 배열로.

## 2026-07-15

### 🎯 목표: 소셜 기능 모바일 파리티

#### 1. `feat` — 모바일 소셜 포팅 (SOCIAL_ROADMAP 3~5.9)
- **탭 재구성**: 하단 탭 5개 유지 — 컬렉션(보관함+위시리스트, AppHeader 모드 배지로 전환), **소셜**(피드/다이어리 탭), 스캔, 검색, 마이. Wish 탭 제거.
- **SocialScreen**: 피드(실시간 구독 — useFocusEffect로 포커스 동안만, 커서 페이지네이션, 취향 매칭 레일+팔로우, 스토리 배너, VinylSocialModal) + 다이어리(내 기록 목록, ♥/💬 카운트, SpinSocialModal) + 헤더 알림 벨(미읽음 배지 Realtime).
- **신규 화면**: StoryScreen(오늘+아카이브), NotificationsScreen(열람 시 전체 읽음, 타입별 이동), UserProfileScreen(팔로우 3상태 버튼, 비공개 잠금, 팔로워/팔로잉 카운트, 컬렉션 그리드/공개 다이어리 탭) — RootNavigator 스택에 등록.
- **신규 모달**: VinylSocialModal(수집 게시물 좋아요/댓글/저장/신고), FollowListModal(팔로워/팔로잉/요청 탭, 수락·거절). ReportModal에 vinyl/vinylComment 타입 추가.
- **MyScreen**: 프로필 공개/비공개 토글 + 팔로워/팔로잉 카운트 + "요청 N" 배지(웹 /my 파리티). 창단 멤버 넘버 미조회 버그(빈 컬렉션)도 웹과 동일하게 수정.
- **DetailModal**: 보유 앨범에 "오늘 들었어요 🎧" 다이어리 작성(기분+메모+공개여부 — 미디어 첨부는 웹만).
- 검증: tsc(웹/모바일) + `expo export` 번들 성공. 남은 것: 오늘의 LP 랜덤픽 모바일, 다이어리 수정/삭제 모바일.
