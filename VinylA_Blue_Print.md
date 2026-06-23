# 🎼 [VinylA Collection] 통합 마스터 정의서

## 1. 프로젝트 개요 & 철학
*   **프로젝트명**: VinylA Collection (바이닐라 컬렉션)
*   **기획 목적**: 디지털 스트리밍에서 벗어나 실물 LP 고유의 피지컬 가치(재킷, LP 알맹이, 수록곡)를 자산화하고 보관하는 프라이빗 아카이빙 플랫폼.
*   **네이밍 유래**: 순정(순수) 상태를 의미하는 **'바닐라(Vanilla)'**와 **'바이닐(Vinyl)'**의 합성어로, 외부 노이즈 없이 아티스트의 원본 앨범 데이터만으로 비밀 박물관을 채워 나간다는 의미.
*   **타깃 디바이스**: 
    *   **PC 웹 브라우저**: 메인 컬렉션 탐색(다중 필터) 및 청음 콘솔 기능 제공.
    *   **모바일 웹/앱**: 실물 LP 등록, 카메라 스캔 및 상세 조회 기능 중심.

---

## 2. UI/UX 디자인 가이드라인 (Vinyl Noir)
*   **MVP 핵심 테마**: **Vinyl Noir (Pure Deep Black & Glassmorphism)**
    *   콘텐츠(아트워크)의 시각적 대비와 몰입도를 극대화하는 깊은 흑색 배경 (`var(--bg-deep)` 등).
    *   모달 팝업, 내비게이션 바 등에 **강력한 블러 효과(Glassmorphism)**를 적용하여 고급스러운 청음실 무드 연출.
*   **타이포그래피 시스템**:
    *   **주요 텍스트 (Body & UI)**: `Pretendard` (모던하고 극도로 깔끔한 산세리프 폰트로 하이엔드 쇼핑몰/에디토리얼 감성 제공)
    *   **강조 및 디스플레이 (Headline & Eyebrow)**: `Bodoni Moda` (잡지 타이틀이나 번호 등에 쓰여 클래식하고 우아한 무드 부여)
*   **마이크로 인터랙션**:
    *   **버튼 및 카드 Hover**: 촌스럽지 않은 부드러운 스케일업과 그림자 강화.
    *   **상세 팝업 (Detail Modal) LP 연출**: 팝업 오픈 시 `cubic-bezier`로 팝업이 부드럽게 커지며, 앨범 커버 뒤에서 **리얼한 홈(Groove)이 파여있는 CSS LP판**이 미끄러져 나와 천천히 회전. 중앙(Label)에는 해당 앨범 커버가 부착되어 높은 사실감 부여.

---

## 3. 화면별 아키텍처 및 특징

### 🖥️ PC 전용 화면 구조
*   **🏠 Home (보관함)**: 소유한 앨범을 보여주는 갤러리 뷰. 호버 시 앨범 커버가 살짝 떠오르는 부드러운 반응성.
*   **🖤 Wishlist (위시리스트)**: 복잡한 데이터(가격, 스토어 수)를 배제하고, 앨범 커버 중심의 **'미니멀 갤러리' (Archive)** 형태로 시각적 단순화 극대화.
*   **🔍 Search (검색)**: Discogs API 실시간 연동. 입력 즉시 Masonry/Grid 기반으로 앨범 결과 노출.
*   **👤 My (마이페이지)**: 프로필 요약 수치(보유 장수, 위시 장수) 및 설정 관리가 가능한 대시보드. 두께 강약을 활용한 세련된 타이포그래피.
*   **상세 팝업 (Detail Modal)**: 앨범 클릭 시 블러 배경과 함께 오픈. 트랙리스트 표시 및 YouTube Data API 연동으로 `Listen on YouTube` 기능 제공.

### 📱 모바일 화면 (Mobile 전용)
*   모바일 환경에 맞춰 미니멀하게 압축된 풀스크린 고해상도 구동.
*   **하단 플로팅 탭 바(Floating Tab Bar)**: 중앙의 '스캔' 버튼 영역이 위로 볼록하게 돌출된 원형 UI(FAB) 구조.

---

## 4. 백엔드 및 API 아키텍처 (Graceful Degradation)
앱은 `.env.local`에 API 키가 없는 상황에서도 터지지 않도록 **방어 로직(Mock Data Fallback)**이 설계되어 있습니다.

### 외부 연동 (packages/core-api)
*   **Discogs API**: 전 세계 LP 데이터베이스 검색. (`searchDiscogs`)
*   **YouTube Data API**: 앨범 트랙리스트나 Full Album 자동 매핑 청음. (`searchYouTube`)
*   **Supabase (PostgreSQL)**: 유저의 컬렉션 및 위시리스트 데이터를 영구 보관. (`getUserVinyls`, `upsertVinyl`)

### 데이터 모델링 (`ALBUM_MASTER` / `USER_VINYL`)
```sql
CREATE TABLE ALBUM_MASTER (
    ALBUM_ID BIGINT AUTO_INCREMENT PRIMARY KEY,
    TITLE VARCHAR(255) NOT NULL,
    ARTIST VARCHAR(255) NOT NULL,
    RELEASE_YEAR INT,
    IMAGE_URL VARCHAR(1000)
    -- 실제 데이터 기반으로 확장을 고려한 기본 골격
);
```

---

## 5. 모노레포 폴더 구조
```text
vinyla-monorepo/
├── apps/
│   ├── web/                     # 🖥️ Next.js 웹 앱 (Vercel 배포)
│   │   ├── src/app/             # Home, Wishlist, Search, My 라우팅
│   │   ├── src/components/      # Grid, Modal, Navigation (사이드바)
│   │   └── package.json
│   └── mobile/                  # 📱 Expo / React Native 앱
├── packages/
│   ├── core-api/                # 🔗 외부 연동 (Discogs, YouTube, Supabase) 및 Fallback 처리
│   ├── shared-types/            # 📦 공통 타입 (MockVinylData 등)
│   ├── ui/                      # 디자인 시스템 (차후 분리용)
├── DAILY_LOG.md                 # 📝 데일리 작업 및 변경 사항 아카이브
├── turbo.json
└── package.json
```
