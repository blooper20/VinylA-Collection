# VinylA Collection 💿

VinylA Collection은 개인 바이닐(LP) 수집품을 관리하고 자랑할 수 있는 통합 웹 및 모바일 앱 서비스입니다. 
보유한 바이닐과 위시리스트를 추가하고, 앨범의 세부 정보, 커버 아트워크, 트랙리스트, 그리고 YouTube 풀 앨범 링크 등을 관리할 수 있습니다.

## 🚀 기술 스택

- **Monorepo**: Turborepo 기반
- **Web App**: Next.js 16 (App Router, Turbopack)
- **Mobile App**: React Native (Expo)
- **Shared API/Logic**: `@vinyla/core-api` 패키지
- **Database / Auth**: Supabase (PostgreSQL + RLS)
- **External APIs**: Discogs API, iTunes Search API, YouTube Data API

## 🛡️ 시스템 아키텍처 및 최적화 내역

### 1. 보안 (Supabase RLS)
VinylA는 사용자 간 데이터 격리를 보장하기 위해 강력한 Row Level Security (RLS) 정책을 채택하고 있습니다.
- `USER_VINYL`: 자신의 컬렉션만 추가/조회/수정/삭제 가능
- `ALBUM_MASTER`: 관리자만 수정 가능, 일반 유저는 조회만 가능 (Upsert 방어)

### 2. 백엔드 성능 최적화 (RPC)
관리자 대시보드 등의 무거운 통계/집계 쿼리에서 발생하는 클라이언트-서버 간 불필요한 트래픽 및 JS 메모리 점유율 폭발을 방지하기 위해 Postgres 내장 RPC(Remote Procedure Call) 함수 `get_user_vinyl_counts` 등을 통해 데이터를 효율적으로 조회합니다.

### 3. 클라이언트 성능 최적화
모든 이미지 리소스(`next/image` 및 Expo Image)는 레이지 로딩과 캐싱을 통해 렌더링 성능을 극대화하며, 불필요한 마이그레이션 백그라운드 작업을 제거하여 앱 구동 속도를 높였습니다.

---

## 🛑 에러 코드 (Error Codes) 체계

사용자 경험 향상 및 고객 문의 대응을 위해 명확한 고유 에러 코드 체계를 사용합니다. 앱 또는 웹에서 에러 팝업/토스트에 노출되는 에러 코드의 의미는 아래와 같습니다.

### 🔐 AUTH (인증 에러)
- `AUTH-001`: 로그인이 필요한 기능에 접근했습니다 (세션 만료 등).
- `AUTH-002`: 사용자 정보를 불러올 수 없습니다.

### 🗄️ DB (데이터베이스 에러)
- `DB-001`: 데이터 저장 중 오류가 발생했습니다. (고유 제약조건 위반 또는 권한 부족)
- `DB-002`: 데이터를 불러오는 중 오류가 발생했습니다.
- `DB-003`: 데이터 삭제 중 오류가 발생했습니다.
- `DB-004`: 상세 정보 업데이트 중 오류가 발생했습니다.

### 🌐 EXT (외부 API 에러)
- `EXT-001`: Discogs 서버 연결이 지연되고 있습니다. (Rate Limit 또는 서비스 장애)
- `EXT-002`: Apple Music 서버 연결이 지연되고 있습니다.
- `EXT-003`: YouTube 검색 한도를 초과했습니다.
- `EXT-004`: 외부 서버 요청 시간이 초과되었습니다.

### 📶 NET (네트워크 에러)
- `NET-001`: 네트워크 연결 상태가 불안정하거나 오프라인 상태입니다. (저장 시 로컬 임시 보관함에 Fallback 처리됩니다.)

### ⚙️ SYS (시스템 에러)
- `SYS-001`: 알 수 없는 시스템 오류가 발생했습니다.

---

## 📦 실행 방법

```bash
# 의존성 설치
npm install

# 전체 패키지 빌드
npm run build

# Web 로컬 개발 서버 실행
npm run dev --filter=web

# Mobile (Expo) 로컬 개발 서버 실행
npm run dev --filter=mobile
```
