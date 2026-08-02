import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/apiAuth';

// 커뮤니티 게시글 첨부 이미지 업로드 — spin-log/upload와 동일한 requireUser +
// service-role 패턴, 유저별 경로로 네임스페이스. 영상은 v1 범위 밖이라
// 이미지만 허용한다(NOTICE/spin-log와 달리 관리자 전용이 아니라 유저 생성
// 콘텐츠라 규모가 커질 수 있어 처음부터 사진만으로 좁혀둔다).
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB — 버킷 file_size_limit과 일치

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
    if (extMatch === 'jpg' || extMatch === 'jpeg') baseType = 'image/jpeg';
    else if (extMatch === 'png') baseType = 'image/png';
    else if (extMatch === 'gif') baseType = 'image/gif';
    else if (extMatch === 'webp') baseType = 'image/webp';
  }

  if (!IMAGE_TYPES.includes(baseType)) {
    return NextResponse.json({ error: 'unsupported file type' }, { status: 415 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }

  const ext = baseType === 'image/png' ? 'png'
    : baseType === 'image/gif' ? 'gif'
    : baseType === 'image/webp' ? 'webp'
    : 'jpg';
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await admin.storage
    .from('community-post-media')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: baseType });
  if (error) {
    console.error('community post media upload failed:', error.message);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }

  const { data } = admin.storage.from('community-post-media').getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, type: 'image' });
}
