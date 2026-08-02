import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/apiAuth';

// 커뮤니티 게시글 첨부 이미지/영상 업로드 — spin-log/upload와 동일한
// requireUser + service-role 패턴, 유저별 경로로 네임스페이스. 타입 판정/
// 용량 제한은 NOTICE 업로드 라우트(api/admin/notices/upload)와 동일하다.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// mp4/mov만 허용 — webm은 iOS 앱(AVPlayer)이 재생하지 못한다.
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB — 버킷 file_size_limit과 일치

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { user, admin } = auth;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field is required' }, { status: 400 });
  }

  // React Native 업로드는 종종 application/octet-stream으로 넘어와 확장자로 보완한다.
  let baseType = file.type.split(';')[0].trim().toLowerCase();
  if (baseType === 'application/octet-stream' || !baseType) {
    const extMatch = file.name.split('.').pop()?.toLowerCase();
    if (extMatch === 'mp4') baseType = 'video/mp4';
    else if (extMatch === 'mov') baseType = 'video/quicktime';
    else if (extMatch === 'jpg' || extMatch === 'jpeg') baseType = 'image/jpeg';
    else if (extMatch === 'png') baseType = 'image/png';
    else if (extMatch === 'gif') baseType = 'image/gif';
    else if (extMatch === 'webp') baseType = 'image/webp';
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
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await admin.storage
    .from('community-post-media')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: baseType });
  if (error) {
    console.error('community post media upload failed:', error.message);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }

  const { data } = admin.storage.from('community-post-media').getPublicUrl(path);
  return NextResponse.json({
    url: data.publicUrl,
    type: isImage ? 'image' : 'video',
  });
}
