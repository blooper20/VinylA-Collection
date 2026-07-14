# 소셜/참여(Social & Engagement) 로드맵

체류 시간과 재방문을 늘리기 위한 소셜 기능 묶음. **웹을 먼저 완성하고, 검증된 UX를 모바일 앱(apps/mobile)에 이식**하는 순서로 진행한다.

| # | 기능 | 웹 | 모바일 |
|---|------|-----|--------|
| 1 | 스피닝 다이어리 (Listening Log) | ✅ 완료 | ⬜ 예정 |
| 2 | 오늘의 LP 추천 (랜덤 픽) | ✅ 완료 | ⬜ 예정 |
| 3 | 오늘의 바이닐 스토리 (매거진) | ✅ 완료 (2026-07-14) | ⬜ 예정 |
| 4 | 실시간 피드 (Discovery Feed) | ✅ 완료 (2026-07-14) | ⬜ 예정 |
| 5 | 취향 매칭 & 유저 팔로우 | ✅ 완료 (2026-07-14) | ⬜ 예정 |

## 3. 오늘의 바이닐 스토리

매일 자정(KST)마다 명반 한 장의 발매 비하인드/숨겨진 이야기를 보여주는 매거진 콘텐츠.

- **아키텍처**: 크론 없음. `/api/vinyl-story/today`(웹 서버 라우트)가 조회 시점에 오늘 자 행이 없으면 Gemini(`gemini-2.5-flash`, JSON 모드)로 생성해 `VINYL_STORY` 테이블에 캐싱. 그날의 첫 방문자만 생성 비용을 낸다.
- **앨범 선정**: `CLASSIC_ALBUM_POOL`(국내외 명반 풀)에서 day-of-year 결정론 선택 — 동시 요청에도 같은 앨범이 골라지고, upsert `ignoreDuplicates`가 행 중복을 막는다.
- **커버**: iTunes Search API(무료)로 600x600 아트워크. 실패해도 스토리는 텍스트만으로 진행.
- **RLS**: public read / 클라이언트 쓰기 정책 없음(service role만 기록).
- **화면**: `/story` — 오늘의 스토리 카드 + 지난 이야기 아카이브 10건.
- **모바일 이식 시**: `getTodayVinylStory()`/`getVinylStoryArchive()`(core-api)를 그대로 사용. 생성 라우트는 웹(vinyla.vercel.app)을 공용 백엔드로 쓴다(`getProxyBaseUrl`).

## 4. 실시간 피드 (Discovery Feed)

다른 수집가가 방금 어떤 LP를 보관함에 담았는지 보여주는 피드.

- **데이터 소스**: 신규 테이블 없음. `USER_VINYL`(public read, Realtime publication 등록됨)의 `STATUS='OWNED'` 행을 `ADDED_AT` 내림차순 조회, `ALBUM_MASTER` 조인 + `PROFILES` 닉네임 별도 조회.
- **실시간**: Supabase Realtime 구독(`subscribeToDiscoveryFeed`) — INSERT와 WISH→OWNED UPDATE를 새 소식으로 반영. `USER_VINYL_ID`로 중복 제거.
- **프라이버시**: 구매 가격(`PURCHASE_PRICE`)은 피드에 노출하지 않는다. 아바타는 auth user_metadata에만 있어 타인 것은 못 읽음 → 이니셜 아바타 폴백.
- **알려진 한계(v1)**: 위시→보유 전환은 UPDATE라 `ADDED_AT`(최초 담은 시각) 기준 정렬에서 상단에 다시 떠오르지 않는다(실시간 구독으로는 잡힘).
- **화면**: `/feed` — LIVE 배지, 상대 시간 표기, 카드 클릭 시 해당 유저 공개 보관함(`/user/[id]`) 이동, 커서(`beforeAddedAt`) 페이지네이션.
- **모바일 이식 시**: `getDiscoveryFeed()`/`subscribeToDiscoveryFeed()` 그대로 사용. FlatList + `onEndReached`로 페이지네이션.

## 5. 취향 매칭 & 유저 팔로우

- **DDL**(`supabase_schema.sql` 2026-07-14 섹션, SQL Editor 수동 실행): `USER_FOLLOW` 테이블(RLS: 전체 읽기 / 본인 `FOLLOWER_ID`만 INSERT·DELETE, 자기 팔로우 금지 CHECK) + `get_taste_matches(p_user_id, p_limit)` RPC + `EVENT_LOG`에 `FOLLOW` 이벤트 타입.
- **일치율 정의**: 겹치는 OWNED 앨범 수 ÷ min(내 수집 수, 상대 수집 수) × 100. "상대가 내 컬렉션의 부분집합이면 100%"인 관대한 정의(추천 문구용). RPC와 프로필 화면 클라이언트 계산이 같은 정의를 쓴다.
- **집계 위치**: DB(RPC) — 클라이언트에서 전체 USER_VINYL을 긁지 않는다.
- **화면**: `/feed` 상단 "나와 취향이 통하는 수집가" 가로 레일(일치율·겹침 수·팔로우 버튼, 닉네임 클릭 → `/user/[id]`), `/user/[id]`·`/user/[id]/dashboard` 헤더에 팔로워/팔로잉 카운트 + 팔로우 버튼 + 일치율 배지, `/my`에 내 카운트 표시. 팔로우는 낙관적 토글(실패 시 원복), 중복 팔로우(23505)는 성공 취급.
- **모바일 이식 시**: `getTasteMatches()`/`followUser()`/`unfollowUser()`/`getMyFollowingIds()`/`getFollowCounts()` 그대로 사용.

## 5.5 프로필 공개/비공개 (2026-07-14 2차)

- **DDL**(`supabase_schema.sql` "프로필 공개/비공개" 섹션, SQL Editor 수동 실행): `PROFILES.IS_PUBLIC`(기본 true), `is_profile_public()` 함수, `USER_VINYL` 읽기 정책 교체 — 본인 OR 공개 프로필 OR 관리자(JWT `app_metadata.role='admin'`)만 조회. `get_taste_matches`도 비공개 유저 제외로 재정의.
- **동작 원리**: 차단이 RLS 레벨이므로 실시간 피드(Realtime WALRUS 포함)·공유 프로필·취향 매칭·퍼블릭 대시보드에서 **자동으로** 빠진다. 클라이언트 잠금 화면(`/user/[id]`, `/user/[id]/dashboard`)은 "왜 안 보이는지" 안내용.
- **설정 UI**: `/my` 프로필 영역의 공개/비공개 토글(`setMyProfileVisibility` — UPDATE 우선, 행 없으면 닉네임 포함 INSERT).
- **기본값 = 비공개 (2026-07-14 5차)**: 새 개념이라 "원치 않은 공개"를 막기 위해 기존 유저 전원 비공개로 초기화 + 컬럼 기본값 false + `is_profile_public()`을 opt-in(명시적 IS_PUBLIC=true만 공개)으로 재정의 — PROFILES 행 없는 계정도 자동 비공개. 가입 설정(/setup)에 공개 설정 선택지(기본 비공개)와 안내 문구를 노출하고, `/my`에서 비공개 상태로 공유 링크 복사 시 경고 토스트를 띄운다.
- **운영 참고**: 전원 비공개 초기화 직후에는 실시간 피드·취향 매칭이 비어 보인다 — 유저가 공개로 전환해야 노출된다.
- **팔로워 열람 (2026-07-14 6차)**: 열람 판정을 `can_view_profile()`(본인/공개/관리자/**수락된 팔로워**)로 일원화 — `USER_VINYL` 읽기 정책과 `get_follow_list`가 이 함수를 쓴다. 수락된 팔로워는 비공개 유저의 보관함·피드 노출·팔로우 목록을 볼 수 있다(로그인한 팔로워의 피드/Realtime에는 RLS가 알아서 포함시킨다). 취향 매칭 추천은 여전히 공개 프로필만.
- **모바일 이식 시**: `getProfileInfo()`/`setMyProfileVisibility()` 그대로 사용, 마이 화면에 토글 추가.

## 5.6 팔로워/팔로잉 목록 + 팔로우 요청 (2026-07-14 3·4차)

**스펙**: 비공개 프로필이어도 팔로워/팔로잉 **숫자는 모두에게 공개**, **목록은 본인(+관리자)만**. 공개 프로필은 목록도 공개. 비공개 프로필 팔로우는 **요청 → 대상자 수락** 방식(인스타그램식).

- **DDL 3차** ("팔로우 목록 프라이버시"): `USER_FOLLOW` 읽기 정책 — 당사자 OR 관리자 OR 양쪽 모두 공개일 때만 행 반환 (직접 테이블 조회 경로 방어).
- **DDL 4차** ("팔로우 요청 + 카운트/목록 RPC"):
  - `FOLLOW_REQUEST` 테이블 — RLS: 당사자만 조회, 본인 명의만 생성, 요청자(취소)/대상자(거절)만 삭제.
  - `get_follow_counts(p_user)` — SECURITY DEFINER 집계 전용(숫자만 노출, 비공개 포함 누구나).
  - `get_follow_list(p_user, p_type, p_limit)` — SECURITY DEFINER, 접근 검사 내장(본인/관리자/공개 프로필). 목록 소유자의 공개 여부만 따지므로 비공개 유저도 남의 공개 목록에는 닉네임으로 나타난다.
  - `accept_follow_request(p_requester)` — 대상자 본인만. USER_FOLLOW INSERT 정책(본인 명의만)을 대상자가 우회할 수 없어 DEFINER RPC로 팔로우 생성+요청 삭제를 원자 처리.
- **팔로우 버튼 3상태**: `팔로우`(공개, 즉시) / `팔로우 요청`(비공개) / `요청됨`(클릭 시 취소) / `팔로잉`(클릭 시 언팔). 비공개 잠금 화면에도 카운트+요청 버튼 노출.
- **UI**: 카운트 클릭 → `FollowListModal`(팔로워/팔로잉/요청 탭 — 요청 탭은 본인만, 수락·거절 버튼). `/my`에 "요청 N" 배지.
- **모바일 이식 시**: `getFollowList`/`requestFollow`/`cancelFollowRequest`/`getMyOutgoingRequestIds`/`getIncomingFollowRequests`/`acceptFollowRequest`/`rejectFollowRequest` 그대로 사용, 바텀시트 권장.

## 5.7 프로필 대시보드 통합 + 공개 다이어리 (2026-07-14 7차)

- **프로필 진입점 통일**: 피드·추천 레일·팔로우 목록에서 유저 클릭 시 `/user/[id]/dashboard?n=닉네임`으로 이동 (컬렉션 공유 페이지 `/user/[id]`는 공유 링크 전용으로 유지).
- **대시보드 다이어리 탭**: 공개(IS_PUBLIC) 재생 기록만 `getPublicListeningLog()`로 표시. LISTENING_LOG 읽기 정책도 `can_view_profile()`과 일원화(7차 DDL) — 비공개 프로필의 공개 기록은 팔로워만.
- **/log 뷰 스위처**: 날짜별(기본, Letterboxd식) / 앨범별(앨범 단위 그룹 + 재생 횟수). 페이지네이션된 로드분 기준으로 그룹핑.
- **모바일 이식 시**: `getPublicListeningLog()` 그대로 사용.

## 5.8 피드 에포크 + 다이어리 소셜 (2026-07-14 8차)

- **피드 에포크**: `FEED_EPOCH`(2026-07-14T09:00:00Z) 이전 `ADDED_AT`의 수집은 피드에 노출하지 않는다 — 기능 출시 전 데이터는 피드 공개 동의 없이 만들어진 것. 컬렉션 데이터 자체는 보존.
- **다이어리 소셜 DDL 8차**: `SPIN_LOG_LIKE`/`SPIN_LOG_COMMENT`(PARENT_COMMENT_ID 1단계 답글)/`SPIN_LOG_SAVE`(본인만 조회)/`SPIN_LOG_REPORT`(관리자·신고자만 조회). 전 테이블 정책이 LISTENING_LOG RLS를 EXISTS로 타므로 비공개 기록엔 상호작용 불가. 댓글 삭제 = 작성자 OR 기록 주인.
- **UI**: `SpinSocialModal` — 좋아요(낙관적 토글)/댓글·답글/공유(대시보드 다이어리 탭 딥링크 복사)/저장/신고(사유 입력). `/log` 각 기록의 ♥·💬 카운트 버튼, 대시보드 다이어리 탭 항목 클릭으로 열림.
- **모바일 이식 시**: core-api `spinSocial.ts` 전부 재사용, 모달 → 바텀시트.

## 5.9 알림함 (2026-07-14 9차)

- **DDL 9차**: `NOTIFICATION` 테이블(수신자 본인만 조회/읽음/삭제, 클라이언트 INSERT 없음) + SECURITY DEFINER 트리거 — SPIN/VINYL 좋아요·댓글·답글, FOLLOW_REQUEST(요청/취소 시 알림 정리), USER_FOLLOW(수락 시 요청자에게 FOLLOW_ACCEPTED, 직접 팔로우 시 NEW_FOLLOWER; auth.uid()로 구분). Realtime publication 등록.
- **UI**: `/notifications`(열람 시 전체 읽음, 타입별 아이콘·이동 링크, 커서 페이지네이션) + 사이드바 미읽음 배지(Realtime + NOTIFICATIONS_READ 이벤트로 즉시 갱신).
- **모바일 이식 시**: `notifications.ts` 그대로 사용, 탭 아이콘 배지 + 알림 화면.

## 모바일 파리티 TODO (웹 검증 후)

- [ ] 스토리 탭/화면 (3) — core-api 재사용, 매거진 카드 UI
- [ ] 피드 탭/화면 (4) — FlatList + Realtime 구독 수명주기(포그라운드 재구독) 주의
- [ ] 추천 수집가 레일 + 팔로우 버튼 (5)
- [ ] 공개 프로필 화면에 팔로우 버튼/일치율 배지 (5)
- [ ] 하단 탭 구성 재검토 (홈/위시/스캔/검색/마이에 피드·스토리 진입점 추가)

## 후속 아이디어 (미착수)

- 팔로잉 전용 피드 필터 ("전체" ↔ "팔로잉")
- 팔로워/팔로잉 목록 화면 + 마이페이지 카운트
- 스피닝 다이어리 공개 기록을 피드에 섞기 (LISTENING_LOG도 데이터 소스로)
- 새 팔로워/취향 매칭 알림
