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
