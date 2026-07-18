-- 앨범 트랙리스트 백필 (2026-07-18)
-- Run this whole file manually in the Supabase SQL Editor.
--
-- 트랙리스트는 지금까지 상세 모달을 열 때마다 외부 API(Discogs/iTunes/Apple
-- 앨범 페이지/Deezer)에서 라이브로 조회했다 — 느리고, 외부 API가 흔들리면
-- (iTunes lookup 503 등) 트랙이 아예 안 뜬다. 한 번 성공적으로 가져온
-- 트랙리스트를 ALBUM_MASTER."TRACKS"(jsonb)에 저장해 다음 열람부터 즉시 띄운다.
--
-- ALBUM_MASTER에는 클라이언트 UPDATE 정책이 없다(공유 데이터 악성 덮어쓰기
-- 방지) — 그래서 공지 조회수(increment_notice_view_count)와 같은 방식으로
-- SECURITY DEFINER 함수로 노출하되, "TRACKS가 비어 있을 때만" 채우게 해
-- 이미 저장된 트랙리스트를 덮어쓸 여지를 없앤다. 배열 길이도 100곡으로
-- 제한한다. 쓰기는 로그인 유저만(authenticated).

ALTER TABLE public."ALBUM_MASTER"
  ADD COLUMN IF NOT EXISTS "TRACKS" jsonb;

CREATE OR REPLACE FUNCTION public.set_album_tracks(p_album_id bigint, p_tracks jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF jsonb_typeof(p_tracks) <> 'array'
     OR jsonb_array_length(p_tracks) = 0
     OR jsonb_array_length(p_tracks) > 100 THEN
    RETURN;
  END IF;
  UPDATE public."ALBUM_MASTER"
     SET "TRACKS" = p_tracks
   WHERE "ALBUM_ID" = p_album_id
     AND ("TRACKS" IS NULL OR "TRACKS" = '[]'::jsonb);
END; $$;

-- Supabase는 default privileges로 새 함수에 anon/authenticated 각각에게
-- "명시적" EXECUTE를 부여한다 — FROM PUBLIC만으로는 anon 권한이 남는 것을
-- 라이브에서 확인(2026-07-18). anon을 반드시 명시해서 회수해야 한다.
REVOKE ALL ON FUNCTION public.set_album_tracks(bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_album_tracks(bigint, jsonb) TO authenticated;
