-- 프로필 사진 공개 컬럼 (2026-07-15)
--
-- 배경: 아바타가 auth.users.raw_user_meta_data->>'avatar_url'에만 있어서
-- 다른 유저의 화면(피드, 소셜 모달, 댓글, 프로필)에서는 읽을 방법이 없었다.
-- public read인 PROFILES에 PROFILE_IMAGE_URL을 추가하고, 앞으로는 클라이언트
-- (useAuthStore의 아바타 저장 경로)가 함께 동기화한다.
--
-- 참고: 웹 vinylSocial.ts는 이미 이 컬럼을 조회하고 있었다 — 컬럼이 없어서
-- 댓글 닉네임 조회가 42703으로 통째로 실패하던 버그도 이 마이그레이션으로
-- 해소된다 (코드 쪽에도 폴백을 추가함).
--
-- 실행: Supabase SQL Editor에서 이 파일 전체를 실행

alter table public."PROFILES"
  add column if not exists "PROFILE_IMAGE_URL" text;

-- 기존 유저 백필 — auth 메타데이터의 avatar_url을 소급 반영.
-- '/logo.png'는 "사진 없음" 기본값이라 제외한다.
update public."PROFILES" p
set "PROFILE_IMAGE_URL" = u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
where u.id = p."USER_ID"
  and coalesce(u.raw_user_meta_data ->> 'avatar_url', '') not in ('', '/logo.png');
