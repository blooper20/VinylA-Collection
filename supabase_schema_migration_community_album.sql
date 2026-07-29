-- 커뮤니티 등록 앨범 (유저 직접 앨범 등록, 위키형) (2026-07-29)
-- Run this whole file manually in the Supabase SQL Editor.
--
-- 문제: 검색 매칭 로직을 고쳐도 Discogs 카탈로그 자체에 없는 음반은 여전히
-- 못 찾는다. 이 한계를 풀기 위해, 유저가 애플뮤직 검색(자동 커버/트랙리스트
-- 확보) 또는 직접 입력으로 앨범 자체를 새로 등록할 수 있게 한다.
--
-- 설계: 별도 테이블이 아니라 ALBUM_MASTER를 확장한다 — 알라딘 소스 앨범도
-- 이미 ALADIN_ID_OFFSET(9,000,000,000)으로 오프셋된 ID를 이 테이블에 그대로
-- 저장해 createAlbumMaster/upsertUserVinyl 경로를 그대로 타는 선례가 있다
-- (packages/core-api/src/externalApi.ts). 커뮤니티 등록도 같은 패턴을 따라
-- USER_VINYL.ALBUM_ID FK, 앨범 카드/상세 렌더링 등 기존 로직을 전혀 건드리지
-- 않는다.
--
-- 커뮤니티 등록 앨범은 항상 전체 공개다(비공개 옵션 없음) — 비공개를 허용하면
-- 다른 유저가 그 앨범을 자기 컬렉션에 공개로 추가했을 때 디스커버리/소셜
-- 피드에서 RLS가 제목·커버를 가려 빈 카드로 보이는 문제가 생기기 때문에
-- 처음부터 배제했다.
--
-- ALBUM_MASTER.TRACKS는 이미 레거시로 폐기된 컬럼(supabase_schema_migration
-- _album_tracks.sql 이후 2026-07-25 마이그레이션에서 전부 NULL 처리, 다시는
-- 쓰지 않기로 함) — 되살려 쓰지 않고 커뮤니티 전용 COMMUNITY_TRACKS를 새로
-- 추가한다.

ALTER TABLE public."ALBUM_MASTER" ADD COLUMN IF NOT EXISTS "SUBMITTED_BY" uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."ALBUM_MASTER" ADD COLUMN IF NOT EXISTS "SOURCE" text NOT NULL DEFAULT 'DISCOGS';
ALTER TABLE public."ALBUM_MASTER" DROP CONSTRAINT IF EXISTS "album_master_source_check";
ALTER TABLE public."ALBUM_MASTER" ADD CONSTRAINT "album_master_source_check" CHECK ("SOURCE" IN ('DISCOGS', 'APPLE_MUSIC', 'MANUAL'));
ALTER TABLE public."ALBUM_MASTER" ADD COLUMN IF NOT EXISTS "APPLE_COLLECTION_ID" bigint;
ALTER TABLE public."ALBUM_MASTER" ADD COLUMN IF NOT EXISTS "COMMUNITY_TRACKS" jsonb;
ALTER TABLE public."ALBUM_MASTER" ADD COLUMN IF NOT EXISTS "CREATED_AT" timestamp with time zone DEFAULT now();

-- 커뮤니티 등록 앨범 전용 ID 공간. 알라딘 오프셋(9,000,000,000)과 충분히
-- 떨어뜨려 어떤 경우에도 겹치지 않게 한다. ALBUM_ID는 identity 컬럼이 아니라
-- 호출자가 직접 넣는 bigint라서, 클라이언트가 이 시퀀스를 직접 당길 수 있게
-- SECURITY DEFINER 함수 하나만 얇게 노출한다(유효성 검증/insert 자체는 앱
-- 레이어에서 하고, RLS가 소유권을 보장하므로 이 함수가 할 일은 ID 발급뿐).
CREATE SEQUENCE IF NOT EXISTS community_album_id_seq START WITH 20000000000;

CREATE OR REPLACE FUNCTION public.next_community_album_id()
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT nextval('community_album_id_seq') $$;

-- Supabase는 새 함수에 anon/authenticated에게 기본으로 EXECUTE를 부여한다 —
-- anon까지 ID를 발급받을 수 있으면 안 되므로 명시적으로 회수한다(2026-07-18
-- set_album_tracks 작업 때 확인된 것과 동일한 함정).
REVOKE ALL ON FUNCTION public.next_community_album_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_community_album_id() TO authenticated;

-- 커뮤니티 등록 목록(최근 등록순) 조회용 partial index. Discogs 소스 행이
-- 압도적으로 많아질 것이므로 SOURCE <> 'DISCOGS'로 좁혀야 이 인덱스가 계속
-- 작고 저렴하게 유지된다.
CREATE INDEX IF NOT EXISTS "idx_album_master_community"
  ON public."ALBUM_MASTER" ("CREATED_AT" DESC) WHERE "SOURCE" <> 'DISCOGS';

-- 같은 애플뮤직 앨범을 여러 유저가 등록하려 할 때 중복 행 대신 기존 행을
-- 재사용하기 위한 유니크 인덱스(NULL은 여러 개 허용 — 수동 입력엔 적용 안 됨).
CREATE UNIQUE INDEX IF NOT EXISTS "idx_album_master_apple_collection"
  ON public."ALBUM_MASTER" ("APPLE_COLLECTION_ID") WHERE "APPLE_COLLECTION_ID" IS NOT NULL;

-- 커뮤니티 목록 화면의 제목/아티스트 텍스트 검색(부분 문자열)을 위한 트라이그램
-- 인덱스. 이 프로젝트에 DB 직접 텍스트 검색이 처음 들어가는 것이라 신규 확장.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "idx_album_master_title_trgm" ON public."ALBUM_MASTER" USING gin ("TITLE" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_album_master_artist_trgm" ON public."ALBUM_MASTER" USING gin ("ARTIST" gin_trgm_ops);

-- INSERT 정책 강화: 기존엔 인증 유저면 아무 값이나 넣을 수 있어(WITH CHECK
-- true) SUBMITTED_BY를 남의 uuid로 스푸핑하거나 SOURCE='DISCOGS'를 자칭해
-- 캐노니컬 데이터를 오염시킬 길이 열려 있었다. 커뮤니티 브라우즈 화면이
-- 생기는 시점부터는 이게 실제 공격 표면이 되므로 여기서 막는다.
DROP POLICY IF EXISTS "album_master_insert_auth" ON public."ALBUM_MASTER";
CREATE POLICY "album_master_insert_auth" ON public."ALBUM_MASTER" FOR INSERT TO authenticated
  WITH CHECK (
    ("SUBMITTED_BY" IS NULL AND "SOURCE" = 'DISCOGS')
    OR ((select auth.uid()) = "SUBMITTED_BY" AND "SOURCE" <> 'DISCOGS')
  );

-- 캐노니컬(Discogs) 행은 SUBMITTED_BY가 항상 NULL이라 auth.uid()와 절대
-- 같아질 수 없다 — "캐노니컬 행은 수정 불가" 기존 불변조건이 그대로 유지된다.
--
-- 등록자 본인도 "다른 유저가 이미 담은 뒤"에는 수정할 수 없다(2026-07-29,
-- 2차) — 등록 직후 오타를 고치는 흔한 케이스는 살리되, 이미 다른 사람 컬렉션이
-- 이 데이터를 참조하기 시작한 뒤에 등록자가 제목/아티스트/트랙을 완전히
-- 바꿔버려 남의 컬렉션 표시가 몰래 바뀌는 위험은 막는다. USER_VINYL의 SELECT
-- RLS(can_view_profile)는 비공개 프로필 유저의 행을 가리므로, 정책 안에서
-- 그 테이블을 직접 EXISTS로 들여다보면 비공개 프로필 채택자를 놓친다 —
-- SECURITY DEFINER 함수로 RLS를 우회해 정확히 센다(get_custom_pressing_
-- selection_counts와 같은 이유).
CREATE OR REPLACE FUNCTION public.community_album_has_other_adopters(p_album_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."USER_VINYL" uv
    JOIN public."ALBUM_MASTER" am ON am."ALBUM_ID" = uv."ALBUM_ID"
    WHERE uv."ALBUM_ID" = p_album_id
      AND uv."USER_ID" <> am."SUBMITTED_BY"
  );
$$;
REVOKE ALL ON FUNCTION public.community_album_has_other_adopters(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_album_has_other_adopters(bigint) TO authenticated;

DROP POLICY IF EXISTS "album_master_update_own" ON public."ALBUM_MASTER";
CREATE POLICY "album_master_update_own" ON public."ALBUM_MASTER" FOR UPDATE TO authenticated
  USING (
    (select auth.uid()) = "SUBMITTED_BY"
    AND NOT public.community_album_has_other_adopters("ALBUM_ID")
  )
  WITH CHECK ((select auth.uid()) = "SUBMITTED_BY");

-- 하드 삭제는 v1 범위에서 만들지 않는다 — USER_VINYL.ALBUM_ID가 NOT NULL
-- REFERENCES ALBUM_MASTER(ON DELETE 절 없음, 기본 RESTRICT)라서, 다른 유저가
-- 이미 컬렉션에 추가한 커뮤니티 앨범을 삭제하면 FK 위반으로 실패한다.
-- 등록자가 실수를 고치고 싶으면 UPDATE만 가능하다(단, 위 조건대로 아무도
-- 담기 전까지만).
