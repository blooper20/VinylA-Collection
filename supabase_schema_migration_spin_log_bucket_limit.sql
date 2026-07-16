-- spin-log-media 버킷의 file_size_limit을 25MB -> 50MB로 올린다.
-- 배경: apps/web/src/app/api/spin-log/upload/route.ts와
-- apps/mobile/src/components/Modal/SpinLogEditorModal.tsx는 이미 50MB 기준으로
-- 검증하도록 되어 있는데, 실제 Storage 버킷은 대시보드에서 25MB로 생성된 채
-- 방치되어 있었다. 그 결과 25~50MB 사이의 영상은 클라이언트/서버 검증은
-- 통과하지만 admin.storage.from('spin-log-media').upload(...) 호출에서
-- 버킷 자체 한도에 걸려 500으로 실패하고, 다이어리 텍스트 저장까지 함께
-- 취소된다.

UPDATE storage.buckets
SET file_size_limit = 52428800 -- 50MB
WHERE id = 'spin-log-media';

-- 확인: 아래 결과의 file_size_limit이 52428800(50MB)인지 확인한다.
SELECT id, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'spin-log-media';
