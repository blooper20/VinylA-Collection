import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/apiAuth';

// Uploads a support-inquiry attachment (screenshot / screen recording / GIF)
// to the public inquiry-attachments bucket. Goes through the service-role
// client on the server instead of client-side storage RLS policies — the
// authenticated-user gate lives here (requireUser), and the path is forced
// under the caller's own user id so uploads can't collide or impersonate.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB (bucket-level cap is also 50MB)

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { user, admin } = auth;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field is required' }, { status: 400 });
  }

  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'unsupported file type' }, { status: 415 });
  }
  if (file.size > (isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await admin.storage
    .from('inquiry-attachments')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (error) {
    console.error('inquiry attachment upload failed:', error.message);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }

  const { data } = admin.storage.from('inquiry-attachments').getPublicUrl(path);
  return NextResponse.json({
    url: data.publicUrl,
    type: isImage ? 'image' : 'video',
    name: file.name,
  });
}
