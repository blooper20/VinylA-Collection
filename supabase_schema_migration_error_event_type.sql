-- 에러 코드 기록용 EVENT_LOG.EVENT_TYPE=ERROR 추가 (2026-07-27, supabase_schema.sql에 이미
-- 존재하던 스니펫을 실행하기 쉽게 별도 파일로 분리 — 지금까지 라이브에 실행되지 않아
-- errors.ts의 recordErrorOccurrence()가 매번 event_log_type_check 위반으로 조용히 실패,
-- "유저가 코드 DB-001을 문의하면 EVENT_LOG에서 실제 원인을 찾는다"는 진단 경로가 죽어있었다.
--
-- 이 사고(2026-07-31, upsertUserVinyl이 이미 삭제된 유니크 제약을 참조해 전체 저장 장애)를
-- 이 진단 로그로 훨씬 빨리 잡을 수 있었을 것 — 지금이라도 실행할 것.
--
-- 실행: Supabase SQL Editor에서 이 파일 전체를 실행

ALTER TABLE public."EVENT_LOG" DROP CONSTRAINT IF EXISTS "event_log_type_check";
ALTER TABLE public."EVENT_LOG" ADD CONSTRAINT "event_log_type_check"
  CHECK ("EVENT_TYPE" IN ('VISIT','SIGNUP','LOGIN','SEARCH','SCAN','ALBUM_ADD','WISH_ADD','SHARE','SPIN_LOG','RANDOM_PICK','FOLLOW','ERROR')) NOT VALID;
