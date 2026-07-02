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
