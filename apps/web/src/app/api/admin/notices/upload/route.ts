import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/adminAuth';

// 공지사항 첨부 미디어(이미지/영상, 게시글당 여러 건) 업로드 — 공개
// notice-media 버킷에 저장한다. /api/spin-log/upload와 동일한 패턴이지만
// 15초/트리밍 제약은 없다(공지는 다이어리 클립이 아니라 일반 게시물 첨부).
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// mp4/mov만 허용 — webm은 iOS 앱(AVPlayer)이 재생하지 못한다.
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin } = auth;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field is required' }, { status: 400 });
  }

  // React Native(관리자 앱은 없지만 공용 코드 경로 대비)와 일부 브라우저는
  // application/octet-stream으로 넘어오는 경우가 있어 확장자로 보완한다.
  let baseType = file.type.split(';')[0].trim().toLowerCase();
  if (baseType === 'application/octet-stream' || !baseType) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'mp4') baseType = 'video/mp4';
    else if (ext === 'mov') baseType = 'video/quicktime';
    else if (ext === 'jpg' || ext === 'jpeg') baseType = 'image/jpeg';
    else if (ext === 'png') baseType = 'image/png';
    else if (ext === 'gif') baseType = 'image/gif';
    else if (ext === 'webp') baseType = 'image/webp';
  }

  const isImage = IMAGE_TYPES.includes(baseType);
  const isVideo = VIDEO_TYPES.includes(baseType);
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'unsupported file type' }, { status: 415 });
  }
  if (file.size > (isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }

  const ext = baseType === 'image/png' ? 'png'
    : baseType === 'image/gif' ? 'gif'
    : baseType === 'image/webp' ? 'webp'
    : baseType === 'video/quicktime' ? 'mov'
    : isVideo ? 'mp4' : 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await admin.storage
    .from('notice-media')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: baseType });
  if (error) {
    console.error('notice media upload failed:', error.message);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }

  const { data } = admin.storage.from('notice-media').getPublicUrl(path);
  return NextResponse.json({
    url: data.publicUrl,
    type: isImage ? 'image' : 'video',
  });
}
