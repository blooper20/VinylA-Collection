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
