-- 공지사항 조회수 (2026-07-15)
-- Run this whole file manually in the Supabase SQL Editor.
-- supabase_schema_migration_notice.sql이 먼저 실행돼 있어야 한다(NOTICE 테이블 필요).
--
-- NOTICE에는 클라이언트 UPDATE 정책이 없다(작성/수정/삭제는 관리자 서버
-- 라우트만) — 그래서 조회수 증가는 일반 UPDATE 대신 SECURITY DEFINER 함수로
-- 노출한다. 이 함수는 VIEW_COUNT 딱 한 컬럼만 건드리므로 다른 컬럼을 조작할
-- 여지가 없다. 로그인 여부와 무관하게 누구나 공지를 볼 수 있으므로 anon도
-- 호출할 수 있게 EXECUTE 권한을 anon/authenticated 모두에 준다.

ALTER TABLE public."NOTICE"
  ADD COLUMN IF NOT EXISTS "VIEW_COUNT" bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_notice_view_count(p_notice_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public."NOTICE" SET "VIEW_COUNT" = "VIEW_COUNT" + 1 WHERE "NOTICE_ID" = p_notice_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.increment_notice_view_count(bigint) TO anon, authenticated;
