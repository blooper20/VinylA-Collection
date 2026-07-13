import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/apiAuth';

// Stores a user-photographed LP jacket in the public user-covers bucket.
// The client crops to a square before uploading (see DetailModal); this
// route only gates auth, validates the file, and writes under the caller's
// own user-id path. Same service-role pattern as /api/support/upload.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { user, admin } = auth;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const albumId = String(form?.get('albumId') || '');
  if (!(file instanceof File) || !/^\d+$/.test(albumId)) {
    return NextResponse.json({ error: 'file and numeric albumId are required' }, { status: 400 });
  }
  if (!IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'unsupported file type' }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }

  // Timestamped path (not a fixed per-album name): browsers/CDNs cache the
  // public URL aggressively, so replacing a cover must mint a NEW url for
  // the change to actually show.
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${user.id}/${albumId}-${Date.now()}.${ext}`;

  const { error } = await admin.storage
    .from('user-covers')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (error) {
    console.error('user cover upload failed:', error.message);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }

  const { data } = admin.storage.from('user-covers').getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
