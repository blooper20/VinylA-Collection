-- 자랑 하위 카테고리 추가: ONOCHU(오노추 = "오늘의 노래 추천") (2026-08-06)
-- Run this whole file manually in the Supabase SQL Editor.
--
-- ARRIVAL/COLLECTION/WISHLIST와 달리 이 카테고리는 "내 컬렉션"이 아니라
-- 애플뮤직 전체 카탈로그에서 검색한 노래를 다중 첨부한다 — 하지만 저장
-- 형태는 동일하다(검색 결과를 커뮤니티 등록 앨범으로 만들어 COMMUNITY_POST_ALBUM에
-- 붙이는 것뿐이라 이 마이그레이션은 CATEGORY 허용값만 넓히면 된다).
ALTER TABLE public."COMMUNITY_POST" DROP CONSTRAINT IF EXISTS "community_post_category_check";
ALTER TABLE public."COMMUNITY_POST" ADD CONSTRAINT "community_post_category_check"
  CHECK ("CATEGORY" IN ('ARRIVAL', 'FREE', 'QNA', 'INFO', 'LISTENING_ROOM', 'TIP', 'COLLECTION', 'WISHLIST', 'ONOCHU'));

DROP POLICY IF EXISTS "community_post_album_insert_own" ON public."COMMUNITY_POST_ALBUM";
CREATE POLICY "community_post_album_insert_own" ON public."COMMUNITY_POST_ALBUM" FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."COMMUNITY_POST" p
      WHERE p."POST_ID" = "COMMUNITY_POST_ALBUM"."POST_ID"
        AND p."AUTHOR_ID" = (select auth.uid())
        AND p."CATEGORY" IN ('ARRIVAL', 'COLLECTION', 'WISHLIST', 'ONOCHU')
    )
  );
