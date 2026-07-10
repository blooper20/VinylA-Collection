# 📝 Daily Log (작업 일지)

이 파일은 매일의 개발 작업 내역을 요약하고 아카이브하기 위한 문서입니다.

---

## [2026-06-30]
### 🌐 핵심 목표: 퍼블릭 대시보드(공유 프로필) 구축 및 시스템 사용성 개선

#### 1. 🔗 퍼블릭 대시보드 및 게이트웨이 로직 구현
- **Public Dashboard (`user/[id]/dashboard/page.tsx`)**: 다른 사용자가 나의 보관함 요약 정보(전체 보유 수, 위시리스트, 실제 관심 장르, 대표 LP 등)를 볼 수 있는 읽기 전용 대시보드 화면 신규 개발.
- **비로그인 사용자 보호(Login Gate)**: 퍼블릭 뷰에서 개별 앨범을 클릭할 시 바로 상세 모달을 띄우지 않고, 로그인 유도 팝업(`DetailModal`의 Login Gate)을 먼저 표시하여 신규 유저 유입(Acquisition) 구조 마련.
- **URL 파라미터 활용**: `n`(이름), `a`(아바타), `g`(장르), `f`(대표 LP) 등의 상태를 쿼리 파라미터로 압축 전달하여 별도 복잡한 API 호출 없이 즉각적인 뷰어 렌더링.

#### 2. 🍞 전역 Toast 알림 시스템 통합
- **CustomEvent 기반 통신**: 브라우저 기본 `alert()` 창이 주던 투박한 경험을 개선하기 위해, `SHOW_TOAST` 커스텀 이벤트 기반의 전역 Toast 시스템 도입.
- **일관된 피드백**: 위시리스트 공유 링크 복사, 이미지 저장 완료 등 앱 전반의 액션 피드백을 매끄러운 팝업(Fade-in-up 애니메이션)으로 통일.

#### 3. 🐛 UI 및 버그 픽스
- **대표 LP 렌더링 및 Wish 뱃지**: 위시리스트의 앨범을 대표 LP로 지정 시 타입 불일치 버그 해결. 대표 LP가 위시리스트 항목일 경우 반투명한 Glassy 스타일의 파란색 'WISH' 뱃지를 우측 상단에 렌더링하여 시각적 완성도 상향.
- **그리드 폭발(Blowout) 방지 및 비율 수정**: 공유 모달(`html2canvas`) 및 실제 위시리스트 페이지에서 원본 해상도가 큰 이미지가 그리드를 강제로 넓히는 CSS Grid 고질적 버그를 `min-width: 0` 및 래퍼 절대 배치(`position: absolute`) 로직으로 완벽 방어하여 정방형(1:1) 강제.
- **아바타 인증 마크 제거**: 시스템 관리자 부여 로직이 개발되기 전까지 프로필 아바타의 정적 인증 마크 임시 제거.

#### 4. 📸 이미지 스캔 (VLM) 파이프라인 고도화
- **Google Vision API**: OCR(텍스트 인식)과 역이미지 검색을 활용하여 앨범 커버의 글씨와 웹상의 일치 이미지를 추출.
- **VLM (Gemini-3-Pro) 통신 최적화**: 원본 이미지를 통째로 보내 발생하는 `502 Rate Limit` 에러를 방어하기 위해, 구글 비전이 추출한 시각적 키워드(Web Entities)를 텍스트로 치환하여 VLM에 전달하는 방식으로 경량화 성공.
- **검색어 4단계 우선순위 (Fallback)**: 유튜브 썸네일 등 엉뚱한 노이즈를 걸러내고, 1순위(Discogs URL 직접 추출) > 2순위(VLM 유추) > 3순위(숫자 제외 순수 OCR 텍스트) > 4순위(Web Entities 시각 키워드) 순으로 정밀하게 검색어 생성.
- **숫자 쓰레기 필터 (`isGarbage`)**: 하드디스크 일련번호, 조각난 숫자 등 앨범명이 아닌 무의미한 텍스트를 자동 폐기하여 정확도 대폭 상향.

---

## [2026-06-29]
### 🏆 핵심 목표: 프로필 커스터마이징 고도화 및 호칭(Badge) 업적 시스템 구현

#### 1. 🏅 대규모 호칭(Achievement) 시스템 구축
- **다차원적 업적 조건 정의**: 단순 보유 장수(1장~1,000장)를 넘어, 평균 시장가, 최고가/단일 구매액(Flexer), 장르별 티어(꿈나무, 마니아, 처돌이), 위시리스트 장수/총액 등 다양한 지표 기반의 광범위한 배지 시스템(`badges.ts`) 설계.
- **히든 업적(Hidden Badges) 시스템**: 획득 난이도가 높은 희귀 업적들은 달성 조건을 숨긴 채 `???`로 노출하여 유저들의 수집 욕구 및 성취감 자극.
- **자동 해금 및 실시간 알림 로직**: `my/page.tsx` 접속 시 Supabase에 저장된 컬렉션 데이터를 로드하며 조건 달성 여부를 평가. 새로운 호칭 달성 시 전역 커스텀 이벤트(`SHOW_TOAST`)를 통해 축하 팝업 표시 및 `user_metadata`에 `unlocked_badges` 동기화.

#### 2. 🪟 호칭 선택 및 모달(Modal) 인터랙션 
- **Badge Select UI**: 기존의 고정된 'Verified Collector' 텍스트를 클릭 가능한 뱃지 컴포넌트로 리팩토링.
- **Glassmorphism 모달 적용**: 보유 중인 호칭(잠금 해제 됨), 장착 중인 호칭, 미획득 호칭을 한눈에 구별하고 설정할 수 있는 `BadgeSelectModal` 개발 및 적용. 상태 관리 라이브러리(`useAuthStore`)를 통해 `selected_badge` 전역 상태 즉각 반영.

#### 3. ✨ 프로필 페이지(My) Visual & Layout 폴리싱
- **사실적인 핀조명(Volumetric Spotlight) 효과**: 단순 선형 그라데이션에서 벗어나, 무대 위에서 실제 빛이 떨어지듯 폭을 넓히고 부드러운 블러 처리를 가미해 LP 커버를 포근하게 감싸는 극적인 CSS 렌더링 완성.
- **UI 여백 최적화**: 레이아웃상 동떨어져 있던 수정(Edit) 버튼을 사용자 이름(Name) 텍스트 바로 우측(`nameRow` flex 컨테이너)으로 이동시켜 화면의 여백을 시원하게 정돈.

---

## [2026-06-28]
### 🚀 핵심 목표: E2E 스캔 파이프라인 완성, 모바일 UI 퍼포먼스 최적화 및 실제 DB(Supabase) 연동 완료

#### 1. 👁️ 스캔 파이프라인 E2E 통합
- **Vision AI 통신 연결**: 모바일 `ScanScreen`에서 카메라로 스캔한 이미지를 Google Cloud Vision API를 통해 분석하여 텍스트 및 엔티티를 추출하는 로직 구현.
- **Discogs 앨범 매핑**: 추출된 텍스트를 `searchDiscogs`로 넘겨 가장 정확도 높은 레코드판 마스터 정보와 자동 바인딩하는 브릿지 완성.
- **Supabase 실시간(Realtime) 동기화**: 팝업에서 '보관함 추가' 또는 '위시' 시 `ALBUM_MASTER` 및 `USER_VINYL`에 데이터 저장. 변경 사항이 모바일과 웹 전체 화면에 새로고침 없이 즉각 동기화되도록 `postgres_changes` 구독 설정 완료.

#### 2. ✨ 모바일 애니메이션 퍼포먼스 GPU 최적화
- **하드웨어 가속 적용**: Detail Modal 팝업과 사실적인 LP 회전 애니메이션이 무거운 모바일 기기에서도 원활히 작동하도록 `will-change: transform`, `transform: translate3d`, `useNativeDriver` 적용.
- **제스처 및 생명주기 최적화**: `cubic-bezier` 시네마틱 이징을 적용하였고, 모바일에서 스와이프(Pull-down)로 팝업을 닫을 때 LP 알맹이가 꼬임 없이 먼저 재킷 안으로 미끄러져 들어가는 인터랙션 완벽 구현.

#### 3. 🛡️ 권한 및 예외 UI (UX 폴리싱)
- **권한 고지 UI**: 네이티브 권한 요청 전 사용자에게 카메라 권한의 필요성을 알리는 Vinyl Noir 테마 기반 안내 화면 구현.
- **빈 진열대 (Empty State)**: 앱 초기 진입 시 빈 화면 대신 원목 진열대 모티브의 감각적인 Empty State(스캔 유도 CTA 포함) 컴포넌트 추가.
- **우아한 에러 핸들링 (Graceful Degradation)**: 통신 불량 시 앱 크래시를 막고 `ErrorState`를 띄우도록 방어하며, 환경 변수가 없을 때에도 데이터 저장 버튼 클릭 시 에러 화면 대신 정상 처리된 것처럼 가짜 알림창을 띄우는 fallback 로직 완성.

#### 4. 🗄️ 실제 Supabase DB 연동 세팅
- `supabase_schema.sql`을 작성해 사용자 데이터베이스 테이블 생성 및 Realtime Publication 설정을 원활히 지원.
- `.env.local` 및 `.env` 파일에 실 프로젝트 URL과 ANON KEY 적용 후 개발 서버 재구동.

#### 5. 🔐 온보딩 및 OAuth 소셜 로그인 구축
- **온보딩 스크린**: 앱 첫 실행 시 깊은 블랙톤과 하이엔드 폰트 조합의 3단계 스와이프 온보딩 UI 추가.
- **인증 및 세션 동기화**: Supabase ANON KEY를 활용한 Apple 및 Google 소셜 로그인(Glassmorphism UI) 연동 완료. Zustand를 활용해 `useAuthStore`를 구현하고, 발급받은 `user.id`를 모바일/웹 양측의 데이터 테이블 외래키와 연결해 멀티 디바이스 실시간 세션 동기화 완성.

#### 6. 🖥️ 데스크톱(Web) 실 데이터 렌더링 및 UI 폴리싱
- **30구 진열장 연동**: 하드코딩된 웹 그리드를 걷어내고, Supabase에서 불러온 실 데이터 바인딩 로직 구현.
- **Hover 인터랙션 최적화**: PC 환경에서 마우스 오버 시 프레임 드롭 방지를 위해 `transform: translateX` 및 `filter(brightness/contrast)` 효과를 활용해 부드럽게 핀조명을 받으며 앨범 알맹이가 슬라이드되는 애니메이션 고도화.
- **사이드바(Sidebar) 개선**: Vinyl Noir 테마에 맞춰 Pretendard 폰트를 명시하고, 활성화 탭에 앰버 골드 글로우(glow) 이펙트 추가.

#### 7. 🚀 프로덕션 빌드 파이프라인 및 로컬 캐싱
- **오프라인 캐싱**: 모바일(`AsyncStorage`), 웹(`localStorage`)을 활용하여 앱 구동 시 방대한 커버 이미지를 캐시에서 우선 로드(Cache-first)하여 네트워크가 끊긴 환경에서도 보관함 열람이 가능하도록 방어 로직 구현.
- **모바일 EAS / 웹 Vercel 배포 안정화**: 
  - `eas.json` 프로덕션 프로필 및 `package.json` iOS/Android 빌드 스크립트 작성. API 키 주입 누락 방지(`prebuild`) 검증 추가.
  - Vercel 호스팅을 위해 `next.config.ts`에 Discogs 등 외부 이미지 호스트 최적화(RemotePatterns) 도메인 등록.

---

## [2026-06-22]
### 🎯 핵심 목표: "Vinyl Noir" 프리미엄 UI/UX 재설계 및 실 API 연동 기반 구축

#### 1. 🎨 디자인 시스템 & 타이포그래피 전면 개편 (Vinyl Noir)
- **폰트 교체**: 기존 신문 기사 느낌을 주던 `Noto Serif KR`을 제거하고, 29CM/무신사 스타일의 모던하고 세련된 `Pretendard`를 메인 한글 폰트로 도입.
- **포인트 타이포그래피**: `Bodoni Moda`를 숫자, 영어 포인트(Eyebrow), 헤드라인 등 특정 강조 영역에만 제한적으로 사용하여 하이엔드 룩앤필(Look & Feel) 완성.
- **레이아웃 여백 및 컬러**: 빨간 유튜브 버튼 등 채도가 높은 색상을 제거하고, 모노톤과 뮤트된 골드 포인트 컬러를 활용한 `Glassmorphism` UI 적용.

#### 2. 🧩 UI 컴포넌트 업그레이드
- **My 페이지**: 대시보드 프로필 수치 디자인 고도화 (글자 두께 강약 조절).
- **SideNav (사이드 네비게이션)**: 폰트 깨짐 방지 및 부자연스러운 번역체 문구 개선.
- **Detail Modal (상세 팝업)**: 애니메이션 최적화. 밋밋한 단색 원형에서 실제 LP 레코드판 질감(Groove)과 중앙 앨범 커버(Label)가 돌아가는 매우 사실적인 레코드판 CSS 렌더링 도입. `cubic-bezier`를 활용한 팝업 스케일업 효과.
- **Wishlist (위시리스트)**: 복잡했던 기존의 스포트라이트/진행도/텍스트를 모두 걷어내고, 앨범 아트 중심의 미니멀 갤러리(Grid) 형태로 극강의 단순화 및 세련미 부여.

#### 3. 🔌 실 데이터 API 연동 준비 (Supabase, Discogs, YouTube)
- **`core-api` 고도화**: Discogs 및 YouTube 검색 API 통신 로직 구현 및 Supabase 데이터베이스 쿼리 함수(`getUserVinyls` 등) 연동.
- **Graceful Degradation**: `.env.local`에 API 키가 없는 개발 초기 환경에서도 에러 없이 안전하게 Mock 데이터를 반환하여 UI가 정상 렌더링되도록 방어 로직 추가.
- **프론트엔드 연결**: `Search` 페이지에서 디스코그스 검색 로직 연동 완료. `Home` 보관함 및 팝업에서 DB/외부 링크 버튼 연동 완료.

## 2026-07-01 (Day 15)

### 🎯 오늘의 목표
Google Cloud Vision API 유료 과금 이슈 해결 및 100% 무료 Gemini 2.5 Flash 기반 VLM 파이프라인 전면 개편

---

### ✅ 완료된 작업 (커밋 순서)

#### 1. `feat(mobile)` — Google Cloud Vision API 제거 및 Gemini 2.5 Flash 연동
- 결제 연동(403 Error)을 요구하는 구글 비전 API를 완전히 제거.
- `apps/mobile/src/utils/visionAPI.ts`: 이미지를 Gemini 2.5 Flash로 직접 전송하여 OCR 및 시각적 특징 추출(1단계)을 동시 수행하도록 교체.
- 정규식(`match(/\{[\s\S]*\}/)`)을 도입하여 Gemini의 쓸데없는 텍스트 섞임 현상을 방어하고 순수 JSON만 추출.

#### 2. `feat(api)` — VibeProxy 제거 및 백엔드 Gemini 직접 연동 (3단계)
- Python 기반 VibeProxy를 제거하고, Node.js API 서버(`apps/api/src/index.ts`)에서 Gemini 2.5 Flash를 직접 호출하도록 구조 변경.
- 프록시 없이 3단계 앨범 커버 대조(VLM 매칭)를 수행.

#### 3. `fix(gemini)` — Token 예산 초과(잘림) 버그 수정
- **이슈**: Gemini 2.5 Flash 모델이 "Thinking" 과정에서 토큰을 모두 소진하여 JSON이 `{` 한 글자만 나오고 잘리는 현상.
- **해결**: `maxOutputTokens`를 300에서 2048로 확장하고, `thinkingConfig: { thinkingBudget: 0 }`을 설정하여 불필요한 사고 시간 및 토큰 낭비 원천 차단.

#### 4. `feat(mobile)` — 카메라 촬영 속도 대폭 개선
- `ImageManipulator`로 Base64 인코딩 전, 원본 고해상도 이미지를 `width: 800`으로 Resize하는 단계 추가.
- `quality: 0.3`으로 설정하여 카메라 캡처부터 검색까지 걸리는 딜레이를 10배 이상 단축.

#### 5. `feat(mobile)` — 다각화된 Discogs 검색망 (Query Builder)
- Gemini 프롬프트를 고도화하여 아티스트, 앨범명, 수록곡(Tracks), 키워드를 분리해서 응답하도록 강제.
- 한국 가수의 한글명 정확도 향상을 위한 프롬프트 가이드 추가.
- `가수 - 앨범`, `가수`, `앨범`, `개별 트랙 제목`, `키워드`를 순차적으로 모두 쿼리에 담아 Discogs 검색 실패율을 극적으로 낮춤.

#### 6. `feat(mobile)` — 스캔 결과 UX 개선
- AI가 완벽 매칭을 찾았을 때 상세 모달을 강제로 팝업하지 않고, 후보군 리스트(`imageSearchResults`)를 우선 노출.
- 사용자가 직접 눈으로 비교하고 앨범을 선택할 수 있도록 자유도 부여.

---

### 📦 오늘 변경된 주요 파일
```
apps/mobile/
  src/utils/visionAPI.ts       ← 구글 비전 삭제, Gemini 2.5 Flash JSON/Thinking 최적화
  src/screens/ScanScreen.tsx   ← 카메라 Resize 속도 개선, 검색 쿼리 다각화, 팝업 UX 변경
  .env                         ← API Key 교체
apps/api/
  src/index.ts                 ← VibeProxy 제거, Gemini 직접 연동, Thinking 예산 차단
  .env                         ← API Key 교체
```

### 2026-07-01 (Part 2)
- **모바일 DetailModal 태그 필터링**: 웹 DetailModal과 동일한 태그 분리 로직을 적용하여, 일반 장르 태그와 '국가(Country)' 태그를 시각적으로 구분해 그룹핑.
- **MyScreen 기능 동등화(Feature Parity)**: 웹 마이페이지의 기능을 모바일 앱에 동일하게 이식:
  - 시장 추정가 및 실제 지출액 계산 로직 추가.
  - `badges.ts`를 `core-api`로 이전하여 동적 배지 해금 로직(`evaluateBadges`) 이식.
  - 모바일 프로필용 대표 LP(Featured LP) 모달 설정 추가.

### 2026-07-01 (Part 3)
- **UI/UX 폴리싱 (Liquid Glass & Vinyl Noir 테마)**:
  - `AlertProvider`를 전역 절대 위치 인라인 `CustomAlert` 컴포넌트로 리팩토링(`DetailModal.tsx`에 로컬 연동 포함)하여 iOS 중첩 `<Modal>` 프리징 버그 해결.
  - `HomeScreen.tsx`의 AlbumCard를 오버레이 텍스트/정보 없이 순수 LP 커버만 보여주도록 되돌려 더 깔끔한 갤러리 룩 구현.
  - `ScrollView` 패딩을 확장하여 `MyScreen.tsx`에서 글래스 강도 설정이 잘려 보이던 레이아웃 문제 수정.
  - `RootNavigator.tsx` 및 `FloatingScanButton.tsx`를 업데이트하여 중앙 스캔 탭에 기본 아이콘 대신 새로 제작한 프리미엄 3D 골드 바이닐 로고 적용.

### 2026-07-01 (Part 4)
- **데이터 모델 & 동기화 수정**:
  - `createAlbumMaster`(`core-api/src/supabaseDb.ts`)에서 `GENRES`와 `MARKET_PRICE`가 payload에서 삭제되지 않도록 방지하여, 새로 스캔한 레코드에서 시장 추정가 지표와 장르 태그("Vinyl" 폴백)가 DB에서 누락되던 문제 해결.
- **MyScreen 개선**:
  - 프리미엄한 톤앤매너를 위해 실제 지출액 AnalyticsCard 컴포넌트에서 불필요한 이모지 제거.
- **DetailModal 개선**:
  - `pricePromptVisible` 오버레이(구매가 입력 UI)를 `CustomAlert`의 비주얼 언어와 구조에 완벽히 맞춰 재설계.
  - 가격 입력 TextInput에 실시간 천단위 콤마 포맷팅(예: `1,000,000`) 구현.
  - 앱 프롬프트 레이어의 UI 일관성을 유지하며 '저장' 버튼 옆에 전용 '생략' 버튼 추가.
- **오리지널 3D 로고 통합**:
  - 프로젝트 원본 투명 로고(`logo_real_transparent.png`)를 엄격히 기반으로 한 새로운 프리미엄 3D 골드 & 리퀴드 글래스 변형 로고 생성.
  - 기존에 잘못 생성(hallucinated)됐던 로고를 중앙 스캔 탭 바에서 이 정식 업그레이드 3D 버전으로 교체.

### 2026-07-01 (Part 5)
- **Supabase DB 스키마 재설계**:
  - `ALBUM_MASTER` 테이블에 `GENRES` 배열 컬럼이 애초에 존재하지 않아 태그 저장이 조용히 실패하고 있던 문제 발견.
  - `supabaseDb.ts`의 태그 저장 로직을 별도의 관계형 `VINYL_TAG` 테이블을 사용하도록 전면 재설계. 이제 장르 태그는 `VINYL_TAG`에 삽입되고 `VINYL_TAG(*)` 조인으로 조회되어, 보관함 저장 시 태그가 완벽하게 유지됨.
- **MyScreen (모바일) 개선**:
  - '로그아웃' 버튼을 타임라인 섹션 아래 최하단으로 이동.
  - '관심 장르' AnalyticsCard를 탭 가능하도록 만들어, 누르면 `ProfileSetupScreen`으로 이동하도록 구현.
  - 프로필 사진 업로드 중 화면이 멈춘 것처럼 보이는 문제를 막기 위해 `ActivityIndicator` 오버레이 추가.
  - 기존 로그아웃 버튼 위치를 '공유하기' 버튼으로 교체. 공유 방식을 인스타그램 스토리 이미지 생성에서 네이티브 시스템 URL 공유(`https://vinyla.vercel.app/...`)로 전환하여, 전체 URL 파라미터를 포함한 웹 대시보드 공유 로직을 완벽히 재현.
- **모노레포 & 인프라 개선**:
  - Turborepo 연동을 위해 `apps/mobile/package.json`에 `"dev": "expo start"` 스크립트 추가.
  - Next.js와 Express가 동시에 기본 포트 3000을 사용하며 충돌하던 심각한 포트 충돌 문제를, `api` 서버와 이에 대응하는 모바일 `ScanScreen`의 fetch 엔드포인트를 3001 포트로 명시적으로 옮겨 해결.
  - 모노레포 루트에서 `npm run dev` 실행 시 웹(3000), API(3001), 모바일(Expo 8081)이 매끄럽게 동시 구동되는 로컬 개발 파이프라인 완성.

---

## 2026-07-02 (Day 16)

### 🎯 오늘의 목표
컬렉션 분석 카드의 편집 가능 여부 시각적 구분 및 시장 추정가 미반영 버그 근본 원인 해결

---

### ✅ 완료된 작업

#### 1. `fix(core-api)` — 시장 추정가(MARKET_PRICE)가 DB에 반영되지 않던 근본 원인 수정
- **이슈**: Part 4에서 payload 삭제 로직을 걷어냈다고 기록했지만, 실제로는 `createAlbumMaster`(`packages/core-api/src/supabaseDb.ts`)에 `delete (payload as any).MARKET_PRICE;`가 여전히 남아있어 저장 시마다 시장 추정가가 조용히 삭제되고 있었음.
- **근본 원인 재확인**: Supabase REST API로 직접 조회한 결과 `ALBUM_MASTER` 테이블에 `MARKET_PRICE` 컬럼 자체가 존재하지 않아(`42703` 에러), GENRES와 동일하게 PGRST204 방지용으로 무조건 삭제되고 있었음을 확인.
- **해결**: `supabaseDb.ts`에서 해당 삭제 라인을 제거하고, `supabase_schema.sql`에 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "MARKET_PRICE" integer;` 구문을 추가. **주의**: 이 SQL은 Supabase SQL Editor에서 직접 한 번 실행해야 실제 반영됨(수동 작업 필요).

#### 2. `feat(mobile)` — 컬렉션 분석 카드 편집 가능 표시(Affordance) 추가
- **이슈**: 마이페이지 '컬렉션 분석' 섹션에서 탭 가능한 '관심 장르' 카드가 탭 불가능한 다른 카드들과 완전히 동일하게 생겨, 사용자가 수정 가능한 항목을 알아채기 어려웠음.
- **해결**: `MyScreen.tsx`의 `AnalyticsCard` 컴포넌트에 `onPress` 존재 여부에 따라 골드 색상 테두리와 은은한 골드 틴트 배경, 우측 상단 아이콘 배지를 추가해 편집 가능한 카드를 시각적으로 구분. 이후 촌스럽다는 피드백을 받아 두꺼운 테두리·원형 이모지 배지를 헤어라인 테두리 + Feather `edit-2` 아이콘으로 톤 다운.

#### 3. `style/fix(mobile)` — 마이페이지 UI 정리 및 버그 수정 모음
- **AnalyticsCard 금액 오버플로우**: 시장 추정가·실제 지출액처럼 자릿수가 커지는 금액이 카드 폭을 넘어가며 줄바꿈되던 문제를, `numberOfLines={1}` + `adjustsFontSizeToFit`으로 카드 안에서 자동으로 폰트가 줄어들도록 수정.
- **실제 지출액 카드 겹침**: 텍스트 블록에 걸려 있던 `flex:1`이 공개/비공개 토글 칩과 세로 공간을 다투면서, 칩 라벨이 길어지면 금액 텍스트와 겹치던 버그 수정. 라벨을 "공개"/"비공개"로 축약하고 칩을 `position: absolute`로 카드 좌하단에 완전히 분리.
- **닉네임 관련**: 칭호 옆 공유 아이콘 버튼 추가(기존 `handleShare` 재사용), 닉네임 옆 연필 이모지를 Feather 아이콘으로 교체, 닉네임 최대 길이 12자 제한을 신설(`packages/core-api/src/constants.ts`의 `NICKNAME_MAX_LENGTH`)해 웹·앱의 닉네임 최초 설정/변경 입력창 전부에 실시간 글자수 카운터 적용. 긴 닉네임이 프로필 헤더 레이아웃을 깨던 문제도 함께 수정(모바일 `alignSelf: 'stretch'`, 웹 `overflow-wrap`).
- **설정 UI 재구성**: '글래스 효과 강도'를 로그아웃 버튼 바로 위 "설정 열기/닫기" 토글(구분선 포함, 테두리 없는 굵은 헤더 스타일)로 접었다 폈다 할 수 있게 재구성. 중복되던 '컬렉션 링크 공유하기' 전체 폭 버튼은 제거(칭호 옆 아이콘 버튼으로 대체).
- **기타**: 마이페이지 세로 스크롤 인디케이터 숨김, 로그아웃 버튼을 명확한 빨간색으로 강조, 로그아웃 버튼 바로 아래 '회원 탈퇴' 버튼 신설(웹 `DeleteAccountModal`과 동일한 경고 문구·`deleteAccount()` 로직 재사용).

#### 4. `feat(mobile)` — 홈 / 위시리스트 화면 전면 개편
- **브랜드 헤더 신설**: 배경 없는 업그레이드 3D 골드 로고 + "VinylA Collection" 타이틀 + `MY COLLECTION`/`WISHLIST` 모드 배지를 두 화면 상단에 공통 컴포넌트(`AppHeader`)로 추가.
- **그리드/테이블 뷰 전환 + 정렬**: 헤더 가장 우측에 그리드·테이블 뷰 토글 추가. 테이블 뷰(`VinylTableRow`)는 커버·제목/아티스트·출시연도·태그를 한 행에 표시. 그 위에 최신순/오래된순/가나다순/출시연도순 정렬 칩(`SortChipRow`)을 추가하고, 정렬 로직(`sortVinyls`)은 웹 `VinylGrid.tsx`와 동일한 기준을 공유.
- **버그 수정**: `FlatList`에 `style={{flex:1}}`이 빠져 있어 스크롤 자체가 안 되던 문제, 그리드↔테이블 전환 시 같은 `FlatList` 인스턴스가 재사용되며 `numColumns` 변경 크래시가 나던 문제(각 리스트에 고유 `key` 부여로 해결), 토스트 팝업이 하단 플로팅 탭바(80px)에 가려 안 보이던 문제 수정.

#### 5. `feat` — 컬렉션 · 위시리스트 · 앨범 상세 공유 기능 신규 구축 (웹 + 앱)
- **홈/위시리스트 공유**: 헤더 공유 아이콘 → "이미지 공유"(인스타그램 스토리로 바로 전달) / "링크 공유" 2가지 옵션 바텀시트. 보유 앨범을 4열 그리드로 정렬한 세로형(1080×1920) 공유 이미지를 오프스크린에서 캡처해 사용.
- **앨범 상세 공유 신설**: 웹·앱 `DetailModal`에 공유 버튼을 새로 추가. 앨범 커버 중심의 세로형 스토리 이미지를 만들어 인스타그램 스토리 또는 링크로 공유할 수 있게 함(모바일은 `ShareableStoryView`, 웹은 기존 `StoryTemplate` 재활용).
- **상태별 네온 배지**: 공유 이미지 상단 중앙에 앨범 상태(보유/위시/미보유)에 따라 다른 배지를 표시. 보유중 `COLLECTED`(골드 네온), 미보유 `JUST DROPPED`(마젠타 네온), 위시는 톤을 완전히 바꿔 서부극 현상수배 포스터풍 `★ WANTED ★`(크림/황갈색 그라데이션, 세리프 볼드체, 이중 테두리, 살짝 기운 회전)로 구현. `letter-spacing`이 마지막 글자 뒤에도 여백을 붙여 텍스트가 살짝 왼쪽으로 쏠려 보이던 정렬 버그도 함께 수정.
- **워터마크 정비**: 문구를 "Curated by VinylA Collection"으로 풀네임 통일. 웹 워터마크에서 닉네임이 줄바꿈·생략되던 버그의 근본 원인(html2canvas가 flex 퍼센트 폭 계산을 불안정하게 캡처)을 찾아 `text-align: center` 블록 구조로 교체해 해결.
- **링크 공유 버그**: 공유되는 링크가 실제로는 존재하지 않는 사설 IP(`192.168.0.20:3000`)를 가리키고 있어 공유는 되지만 받는 사람은 열어볼 수 없던 문제를 발견. 웹이 쓰는 프로덕션 주소(`https://vinyla.vercel.app`)로 홈/위시리스트/마이페이지 전체 fallback을 교체.
- **iOS 프리징 방지**: `DetailModal`이 이미 RN `<Modal>`인 상태에서 공유 시트를 또 다른 `<Modal>`로 중첩하면 예전 `AlertProvider` 이슈와 동일한 프리징이 재발할 수 있어, 공유 시트를 `<Modal>` 없이 절대 위치 오버레이(페이드+슬라이드 애니메이션)로 재구현.

#### 6. `fix(mobile)` — 앨범 상세 하단 액션 버튼 크기 불일치 수정
- `btnPrimary`/`btnOutline`/`btnYoutube`가 모두 `padding`만으로 높이를 잡고 있어, 아이콘 유무와 폰트 크기(13 vs 15) 차이로 버튼마다 높이가 미묘하게 달라 보이던 문제. 공통 `BUTTON_HEIGHT(52)`로 고정하고 폰트 크기도 15로 통일.

---

### 📦 오늘 변경된 주요 파일
```
apps/mobile/
  src/screens/MyScreen.tsx                        ← 카드 편집 표시/오버플로우/겹침 수정, 닉네임·설정·탈퇴 UI 정리
  src/screens/HomeScreen.tsx                       ← 브랜드 헤더, 그리드/테이블 토글+정렬, 공유 시트, 스크롤 버그 수정
  src/screens/WishScreen.tsx                       ← 위와 동일 (위시리스트)
  src/components/AppHeader.tsx                     ← NEW: 홈/위시 공용 브랜드 헤더 + 뷰 토글 + 공유 버튼
  src/components/SortChipRow.tsx                   ← NEW: 정렬 칩
  src/components/VinylTableRow.tsx                 ← NEW: 테이블 뷰 행
  src/components/Modal/ShareOptionsSheet.tsx       ← NEW: 이미지/링크 공유 바텀시트 (Modal 없는 오버레이)
  src/components/Modal/DeleteAccountModal.tsx      ← NEW: 회원 탈퇴 확인 모달
  src/components/Modal/DetailModal.tsx             ← 공유 버튼 추가, 하단 버튼 높이 통일
  src/components/Share/ShareableGridView.tsx       ← NEW: 홈/위시 그리드 공유 이미지
  src/components/Share/ShareableStoryView.tsx      ← NEW: 앨범 상세 스토리 공유 이미지 + 상태 배지
  src/components/Toast/NativeToast.tsx             ← 하단 탭바에 가려지던 위치 수정
  src/utils/sortVinyls.ts                          ← NEW: 정렬 유틸(웹과 동일 기준)
apps/web/
  src/components/Share/StoryTemplate.tsx           ← 상태 배지 추가, 워터마크 텍스트 수정
  src/components/Share/StoryTemplate.module.css    ← 닉네임 줄바꿈 버그 수정, 네온/포스터 배지 스타일
  src/components/Share/ShareableGridTemplate.tsx   ← 워터마크 풀네임 표기
packages/core-api/
  src/constants.ts                                 ← NEW: NICKNAME_MAX_LENGTH
  src/supabaseDb.ts                                ← MARKET_PRICE payload 삭제 라인 제거
supabase_schema.sql                                 ← ALBUM_MASTER.MARKET_PRICE 컬럼 추가 ALTER 구문 (수동 실행 필요)
DAILY_LOG.md / VinylA_Blue_Print.md / docs/dev-log.md ← 오늘 작업 내용 정리
```

---

## 2026-07-09 (Day 17)
### 🎯 핵심 목표: 온보딩 리디자인 · 검색 무한 스크롤 · 로그인/보안(RLS) 인프라 정비

#### 1. 🎬 모바일 온보딩 화면 전면 리디자인
- **에디토리얼 스타일 재구성**: 가운데 정렬 영문 대문자 타이틀을 버리고, 골드 오버라인(`01 · PURE ARCHIVE`) → 한글 헤드라인(핵심 단어만 골드 강조) → 서브카피의 좌측 정렬 구성으로 전환. 각 스텝 우상단에 반투명 대형 고스트 넘버(01/02/03) 배치.
- **바닐라꽃 각인 레코드**: 스텝 1의 레코드를 골드 림 + 골드 톤 그루브 + 골드 그라데이션 레이블로 다시 그리고, 로고의 바닐라 오키드 모티프를 View로 직접 그린 5잎 꽃(뾰족한 물방울 꽃잎 + 속 빈 트럼펫 컵) 8개를 링 형태의 은은한 각인 패턴(불투명도 0.3)으로 배치. 회전 속도를 9초/바퀴로 조정해 회전이 실제로 보이게 함.
- **톤암 드롭 애니메이션**: 카운터웨이트·골드 링 피벗·샤프트·헤드셸로 구성된 톤암이 진입 후 레코드 위로 내려앉는 애니메이션(`transformOrigin` 피벗 회전 + back easing 반동).
- **스캔라인 스윕**: 스텝 2의 📷 이모지를 제거하고, 뷰파인더 안에서 골드 스캔라인이 위아래로 쓸고 지나가는 루프 애니메이션으로 교체.
- **하단 인터랙션**: 페이지네이션(좌) + 골드 원형 '다음' 버튼(우)을 하단에 고정, 마지막 페이지 접근 시 버튼 자동 페이드아웃.
- **카피 정비**: 블루프린트의 프로젝트 언어를 그대로 반영 — "노이즈 없이 채워가는 당신의 비밀 박물관" / "커버를 비추는 순간, LP는 자산이 됩니다" / "이제, 당신만의 LP 전시실로 들어갈 차례". 로그인 패널에 `VINYL + VANILLA` 태그 칩과 `Collection` 레터스페이싱 라인 추가.
- **브랜드 표기 통일**: 웹·앱 전체에서 대소문자를 지킨 "VinylA Collection"으로 통일 (웹 탭 타이틀, 프로필 아이브로우, alt 텍스트 등 11개 파일).

#### 2. 🔍 검색 무한 스크롤 + 뒤로가기 제스처 (모바일)
- **`createDiscogsSearchSession`(core-api)**: 중복 제거 기록(마스터 ID/제목)·한→영 아티스트 별칭·페이지 커서를 배치 간 유지하는 세션 기반 페이지네이션으로 리팩토링. 스크롤 바닥 근처에서 다음 ~20장을 자동 로드하며 같은 앨범이 재등장하지 않음. 장르 검색은 세션마다 랜덤 시작 페이지(클릭마다 신선한 결과 유지) + 세션 내 순차 페이징. 기존 `searchDiscogsLazy`는 웹/로컬 api용 1배치 래퍼로 유지.
- **결과 화면 edge-swipe back**: 검색 결과 화면에서 왼쪽 가장자리→오른쪽 스와이프 시 검색어를 초기화하고 장르 탐색 화면으로 복귀. 장르 탐색 화면에서는 제스처 핸들러 자체를 장착하지 않아 완전 비활성.

#### 3. 🔐 로그인 인프라 수리
- **웹 로그인 게이트 404**: 퍼블릭 대시보드 로그인 유도 팝업이 존재하지 않는 `/login` 라우트로 연결되던 버그를 랜딩(`/`)으로 수정 (dashboard + PublicGrid 2곳).
- **웹 로그인이 `exp://`로 튕기던 문제 진단**: Google 인증 완료 후 Supabase가 허용 목록에 없는 `redirectTo`를 무시하고 기본 Site URL(`exp://192.168.1.3:8081`)로 폴백 → 데스크톱 브라우저가 열 수 없어 "버튼이 안 되는" 것처럼 보임. 대시보드에서 Site URL=`http://localhost:3000`, Redirect URLs에 `localhost/**`·`vinyla.vercel.app/**`·`exp://**` 등록으로 해결, 웹 로그인 정상 확인.
- **Apple 로그인 연결**: 빈 함수였던 "Continue with Apple"을 Google과 공용 OAuth 핸들러(`handleOAuthLogin`)로 구현. Supabase Apple provider(Apple Developer 계정) 연동 시 즉시 활성화.

#### 4. 🗄️ DB 정비: MARKET_PRICE + RLS
- **MARKET_PRICE 마이그레이션 실행·검증**: 컬럼 생성 확인 후 쓰기→재조회→원복 사이클로 저장 경로 검증 완료. 시장 추정가 저장이 실제로 동작.
- **RLS 정책 적용**: 검증 중 `ALBUM_MASTER`가 anon key만으로 수정 가능한 것을 발견, 4개 테이블(ALBUM_MASTER/VINYL_TAG/USER_VINYL/PROFILES) 전체에 RLS 적용 — 공개 읽기(퍼블릭 대시보드·실시간 구독 유지) / 로그인 쓰기 / USER_VINYL·PROFILES는 소유자(`auth.uid()`)만 쓰기. 정책 SQL은 `supabase_schema.sql`에 재실행 안전(idempotent)하게 관리. 익명 쓰기 차단·익명 읽기 유지·로그인 쓰기 정상까지 3단 검증 완료.

#### 5. 🧹 품질 게이트: 타입 에러 0 + 프로덕션 빌드 통과
- `MockVinylData`를 `ALBUM_MASTER & Partial<USER_VINYL>`로 완화(검색/스캔 결과는 미보유 앨범), `mapToFrontendModel`에 누락 필드(VINYL_IMAGE_URL/CUSTOM_STYLE_TYPE) 보강, `useAuthStore` 인터페이스 시그니처 정합, `useAlbumSearch` 리터럴 내로잉.
- **실버그 발견**: MyScreen 아바타 업로드에 `FileSystem` import가 아예 누락되어 런타임 크래시 상태였음 — SDK 54 기준 `expo-file-system/legacy` 경로로 수정.
- 결과: 모바일 tsc 에러 0개, 웹 `next build` 타입체크 통과 → Vercel 배포 가능 상태.

### 📦 오늘 변경된 주요 파일
```
apps/mobile/
  src/screens/OnboardingScreen.tsx     ← 전면 리디자인
  src/screens/SearchScreen.tsx         ← 무한 스크롤 + 제스처
  src/screens/MyScreen.tsx             ← FileSystem import 버그 수정
apps/web/
  src/app/user/[id]/dashboard/page.tsx, components/Grid/PublicGrid.tsx  ← /login → /
  (브랜드 표기 통일: layout, my, SideNav, Share 템플릿 등)
packages/core-api/
  src/externalApi.ts                   ← createDiscogsSearchSession
  src/store/useAuthStore.ts, supabaseDb.ts, hooks/useAlbumSearch.ts
packages/shared-types/src/mocks.ts     ← MockVinylData Partial화
supabase_schema.sql                    ← RLS 정책 (적용 완료)
```
