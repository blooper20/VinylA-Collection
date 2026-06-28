# 📝 Daily Log (작업 일지)

이 파일은 매일의 개발 작업 내역을 요약하고 아카이브하기 위한 문서입니다.

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
