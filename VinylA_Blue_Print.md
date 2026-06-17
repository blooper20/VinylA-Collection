# 🎼 [VinylA Collection] 통합 마스터 정의서 요약

## 1. 프로젝트 개요 & 철학
*   **프로젝트명**: VinylA Collection (바이닐라 컬렉션)
*   **기획 목적**: 디지털 스트리밍에서 벗어나 실물 LP 고유의 피지컬 가치(재킷, LP 알맹이, 수록곡)를 자산화하고 보관하는 프라이빗 아카이빙 플랫폼.
*   **네이밍 유래**: 순정(순수) 상태를 의미하는 **'바닐라(Vanilla)'**와 **'바이닐(Vinyl)'**의 합성어로, 외부 노이즈 없이 아티스트의 원본 앨범 데이터만으로 비밀 박물관을 채워 나간다는 의미.
*   **타깃 디바이스**: 
    *   **PC 웹 브라우저**: 메인 컬렉션 탐색(다중 필터) 및 청음 콘솔 기능 제공.
    *   **모바일 웹/앱**: 실물 LP 등록, 카메라 스캔 및 상세 조회 기능 중심.

---

## 2. UI/UX 디자인 가이드라인
*   **MVP 핵심 테마**: **순수 검은색 (Pure Deep Black, `#000000`)**
    *   콘텐츠(컬러 LP 디스크, 앨범 아트워크)의 시각적 대비와 몰입도를 극대화.
    *   팝업창, 검색창, 필터 패널 등에 **반투명 글래스모피즘(Glassmorphism)**을 적용하여 모던한 청음실 분위기 연출.
*   **테마 확장 아키텍처 (Roadmap)**: `data-theme` 속성 전환으로 배경 테마 변경 가능하도록 설계.
    *   `DARK_BLACK` (기본값): 순수 딥 블랙
    *   `MOODY_WALNUT`: 어두운 원목 진열장 무드
    *   `NEON_CYBER`: 붉고 푸른 네온사인이 감도는 심야 살롱 무드

---

## 3. 화면별 레이아웃 및 인터랙션 규격

### 🖥️ PC 메인 화면 (보관함 진열창)
*   **30구 그리드 시스템**: 1920×1080 해상도 기준, 스크롤 없이 **5열 × 6행 (또는 6열 × 5행)**의 진열 상태 유지.
*   **LP 슬라이딩 호버 애니메이션**: 앨범에 마우스 오버(Hover) 시, LP 알맹이가 우측으로 약 **90px~100px** 가량 스르륵 미끄러져 나오는 연출. (그리드 내부의 시스템 여백 확보 필수)
*   **상세 팝업**: 클릭 시 배경 화면이 블러(Blur) 처리되며 화면 중앙에 **와이드 이분할 상세창** 렌더링.

### 📱 모바일 화면 (Mobile 전용)
*   모바일 환경에 맞춰 미니멀하게 압축된 풀스크린 고해상도 구동.
*   **하단 플로팅 탭 바(Floating Tab Bar)**: 중앙의 '스캔' 버튼 영역이 위로 볼록하게 돌출된 원형 UI(FAB) 구조.
*   **5대 탭 세부 기능**:
    1.  **🏠 홈 (Home)**: 소유한 LP 리스트 표시 (순수 딥 블랙 배경).
    2.  **🖤 위시 (Wish)**: 위시리스트 LP 표시. 홈과 동일한 레이아웃이나 **데이터 필터**가 다름. 홈 탭과의 인지적 구분을 위해 미세한 그래픽 톤 및 글래스모피즘 불투명도 차이 부여.
    3.  **📷 스캔 (Scan - 중앙 FAB)**: 카메라 스캔 화면. LP 재킷 인식 후 외부 음악 DB와 매핑하여 보유/위시 등록 팝업 즉시 노출.
    4.  **🔍 검색 (Search)**: 아티스트, 앨범, 수록곡, 장르 키워드로 내 보관함 및 외부 DB를 통합 검색 및 필터링.
    5.  **⚙️ 마이페이지 (My)**: 계정 관리, 푸시 알림 설정(신보, 위시 재고), 테마 제어 등.

---

## 4. 백엔드 데이터 모델링

### 📊 1. 앨범 마스터 테이블 (`ALBUM_MASTER`)
LP 앨범의 메타데이터 및 알맹이(디스크) 스타일 지정.
```sql
CREATE TABLE ALBUM_MASTER (
    ALBUM_ID BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '앨범 고유 식별자',
    TITLE VARCHAR(255) NOT NULL COMMENT '앨범명',
    ARTIST VARCHAR(255) NOT NULL COMMENT '아티스트명',
    RELEASE_YEAR INT COMMENT '발매 연도',
    IMAGE_URL VARCHAR(1000) COMMENT '고해상도 재킷 커버 이미지 경로',
    VINYL_IMAGE_URL VARCHAR(1000) COMMENT '실물 LP 알맹이 누끼 이미지 경로',
    CUSTOM_COLOR_HEX VARCHAR(7) COMMENT '유저가 지정한 알맹이 HEX 색상 코드',
    CUSTOM_STYLE_TYPE VARCHAR(20) COMMENT '유저가 지정한 알맹이 질감 (SOLID, TRANSLUCENT, SPLATTER)'
);

## 파일구조
vinyla-monorepo/
│
├── apps/                        # 실제 배포 및 구동되는 애플리케이션 영역
│   ├── web/                     # 🖥️ PC 데스크톱 웹 앱 (Vercel 배포용, Next.js 등 권장)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── grid/        # 5열 x 6행(30구) 그리드 진열장 컴포넌트 [1]
│   │   │   │   ├── modal/       # 배경 블러 처리 및 와이드 이분할 상세 팝업창 [1]
│   │   │   │   └── animations/  # LP 알맹이가 90~100px 미끄러져 나오는 Hover 애니메이션 (Power2.inOut 적용) [1, 4]
│   │   │   └── pages/           # 홈(Expanded Gallery), 디스커버리(검색), 마스터 리스트(위시) 등 [5, 6]
│   │   └── package.json
│   │
│   └── mobile/                  # 📱 모바일 앱 (iOS/Android, React Native/Expo 등 권장)
│       ├── src/
│       │   ├── navigation/      # 하단 5대 탭 (홈, 위시, 스캔, 검색, 마이) 라우팅 [2]
│       │   ├── components/
│       │   │   ├── tabbar/      # 위로 튀어나온 볼록형 플로팅 스캔 버튼(FAB) UI [2, 3]
│       │   │   └── animations/  # 상세 진입 시 부드러운 슬라이드 및 햅틱 피드백 등 모바일 터치 전용 제어 [7, 8]
│       │   ├── screens/         # 모바일 전용 2열 그리드 및 핀조명 스타일 적용 화면 [9]
│       │   └── features/
│       │       └── scan/        # 스마트폰 카메라 제어 및 LP 실물 스캔(인식) 로직 [3]
│       └── package.json
│
├── packages/                    # 📦 웹과 앱이 100% 공통으로 공유하는 모듈 영역
│   ├── ui/                      # 공통 UI 컴포넌트 및 디자인 시스템
│   │   ├── src/
│   │   │   ├── themes/          # 순수 딥 블랙(#000000), Cinematic Woody Library(#0e0e0e), Clean Doodling(#fcf9ee) 등 테마 토큰 [10-12]
│   │   │   ├── typography/      # Bodoni Moda, Hanken Grotesk, Anybody 폰트 설정 [13, 14]
│   │   │   └── elements/        # 글래스모피즘(Glassmorphism) 유틸리티 등 공통 스타일 [12]
│   │   └── package.json
│   │
│   ├── shared-types/            # 공통 데이터 타입 (TypeScript 사용 시)
│   │   ├── src/
│   │   │   ├── db/              # 마스터 정의서의 DB 스키마 기반 타입 정의
│   │   │   │   ├── ALBUM_MASTER.ts # 앨범명, 아트워크, 알맹이 커스텀 색상/질감 등 [15]
│   │   │   │   ├── USER_VINYL.ts   # 보유/위시 상태(OWNED, WISH), 구매가 등 [15]
│   │   │   │   └── VINYL_TAG.ts    # 장르, 국가 등 태그 정보 [15]
│   │   │   └── api.ts           # 외부 스트리밍 API 및 DB 응답 규격
│   │   └── package.json
│   │
│   └── core-api/                # 백엔드(Render 배포) 및 외부 API 통신 로직
│       ├── src/
│       │   ├── clients/         # Axios 또는 Fetch 클라이언트 설정
│       │   ├── external/        # 대규모 외부 음악 DB 검색 및 매핑 연동 로직 [3]
│       │   └── hooks/           # 커스텀 훅 (예: useAlbumSearch, useVinylScan)
│       └── package.json
│
├── package.json                 # 모노레포 최상위 설정 파일
└── README.md                    # 프로젝트 가이드
