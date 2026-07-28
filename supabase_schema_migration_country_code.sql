-- 사용자 국가 자동 감지 (2026-07-28)
--
-- 배경: 관리자 유저 테이블에 국가를 표시하기 위해 Vercel의
-- x-vercel-ip-country 요청 헤더로 로그인 시점의 국가를 서버(API 라우트)에서
-- 자동으로 캡처한다 (자기 입력 아님). ISO 3166-1 alpha-2 코드
-- (예: "KR", "US")를 그대로 저장한다. 로컬 개발(next dev)이나 Vercel 밖에서는
-- 헤더가 없어 NULL로 남는다 — 이 기능 이전 가입자도 동일하게 NULL.
--
-- 실행: Supabase SQL Editor에서 이 파일 전체를 실행

alter table public."PROFILES"
  add column if not exists "COUNTRY_CODE" text;
