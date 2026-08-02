-- community-post-media 버킷에 영상 첨부를 허용한다.
-- 배경: 커뮤니티 게시글은 처음엔 사진만 허용했지만(오온음/청음실 등 사진
-- 위주 게시판이라도 짧은 영상을 붙이고 싶은 수요가 있어) NOTICE와 동일하게
-- 사진+영상을 함께 받도록 확장한다. COMMUNITY_POST.MEDIA_ITEMS는 이미
-- NOTICE.MEDIA_ITEMS와 같은 [{url, type}] 모양을 그대로 재사용하고 있고,
-- DB CHECK 제약(community_post_media_items_is_array/_max_5)도 배열 길이만
-- 검증하므로 스키마 변경은 필요 없다 — 버킷의 allowed_mime_types/
-- file_size_limit만 notice-media와 동일하게 맞추면 된다.
-- mp4/mov만 허용 — webm은 iOS 앱(AVPlayer)이 재생하지 못한다(notice-media와 동일 이유).

UPDATE storage.buckets
SET
  file_size_limit = 52428800, -- 10MB -> 50MB (notice-media와 동일)
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime']
WHERE id = 'community-post-media';

-- 확인: allowed_mime_types에 video/mp4, video/quicktime이 포함되고
-- file_size_limit이 52428800(50MB)인지 확인한다.
SELECT id, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'community-post-media';
