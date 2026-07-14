import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/apiAuth';

// Uploads a spinning-diary media attachment (a photo of the jacket/needle
// drop, or a short clip of the record playing) to the public
// spin-log-media bucket. Same requireUser + service-role pattern as
// /api/support/upload — auth lives here, path is namespaced under the
// caller's own user id.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25MB — plenty for a ~15s clip; bucket-level cap matches

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { user, admin } = auth;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field is required' }, { status: 400 });
  }

  // 브라우저의 MediaRecorder(트리밍 결과물)가 만드는 MIME 타입은
  // "video/webm;codecs=vp8,opus"처럼 코덱 파라미터가 붙어 나온다 — 화이트
  // 리스트와 완전 일치 비교하면 이런 값이 전부 415로 튕겨나가므로, 세미콜론
  // 앞부분만 비교한다.
  const baseType = file.type.split(';')[0].trim().toLowerCase();
  const isImage = IMAGE_TYPES.includes(baseType);
  const isVideo = VIDEO_TYPES.includes(baseType);
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'unsupported file type' }, { status: 415 });
  }
  if (file.size > (isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }
  // 15초 제한은 클라이언트가 <video> 메타데이터로 먼저 검사한다 — 서버에서
  // 영상 길이를 재려면 ffprobe 같은 별도 인프라가 필요해 이 프로젝트의
  // 기존 "Graceful Degradation" 방침대로 용량 상한을 2차 방어선으로만 둔다.

  const ext = baseType === 'image/png' ? 'png'
    : baseType === 'image/gif' ? 'gif'
    : baseType === 'image/webp' ? 'webp'
    : baseType === 'video/webm' ? 'webm'
    : baseType === 'video/quicktime' ? 'mov'
    : isVideo ? 'mp4' : 'jpg';
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // 버킷의 allowed_mime_types는 코덱 파라미터 없는 단순 타입으로 등록돼
  // 있어, 원본 file.type을 그대로 넘기면(예: "video/webm;codecs=vp9,opus")
  // Supabase Storage 자체가 500으로 거부한다 — baseType(세미콜론 앞부분)을
  // 넘긴다. 실제 파일 바이트는 그대로라 재생에는 영향이 없다.
  const { error } = await admin.storage
    .from('spin-log-media')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: baseType });
  if (error) {
    console.error('spin log media upload failed:', error.message);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }

  const { data } = admin.storage.from('spin-log-media').getPublicUrl(path);
  return NextResponse.json({
    url: data.publicUrl,
    type: isImage ? 'image' : 'video',
  });
}
