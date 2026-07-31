-- 바이닐 에디션 다중 등록 (2026-07-30)
--
-- 배경: 같은 앨범이라도 컬러반/재발매반/사인반처럼 서로 다른 실물을
-- 여러 장 소장(또는 위시)하는 경우가 있다. 지금까지는 (USER_ID, ALBUM_ID)
-- UNIQUE 제약 때문에 같은 앨범을 다시 저장하면 upsert가 기존 행을 덮어써
-- 두 번째 등록이 불가능했다. 이 제약을 없애고, 각 등록 항목을 사람이
-- 구분할 수 있는 EDITION_LABEL을 추가한다. 기존 행은 EDITION_LABEL이
-- NULL인 "기본" 항목으로 그대로 남고 동작이 바뀌지 않는다.
--
-- 주의: upsertUserVinyl이 (USER_ID, ALBUM_ID) 유니크 제약(onConflict)에
-- 의존하지 않도록 코드가 먼저 배포된 뒤에 이 마이그레이션을 실행할 것 —
-- 순서가 바뀌면 그 함수의 upsert 호출이 즉시 에러를 던진다.
--
-- 실행: Supabase SQL Editor에서 이 파일 전체를 실행

alter table public."USER_VINYL"
  add column if not exists "EDITION_LABEL" text;

alter table public."USER_VINYL"
  drop constraint if exists "user_vinyl_user_album_key";

create index if not exists "user_vinyl_user_album_idx"
  on public."USER_VINYL" ("USER_ID", "ALBUM_ID");
