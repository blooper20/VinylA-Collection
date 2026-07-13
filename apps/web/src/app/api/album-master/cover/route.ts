import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/apiAuth';

// ALBUM_MASTER deliberately has NO client update policy (RLS) to stop
// malicious overwrites of shared data — but that also froze covers forever:
// once a master row existed, a stale/wrong IMAGE_URL could never be
// corrected, even after the search pipeline started returning the real LP
// jacket. This route is the narrow, gated exception:
//   - caller must be signed in (requireUser)
//   - the new URL must come from a known cover source: the catalog CDNs the
//     search pipeline uses, or our own user-covers bucket (the "apply to
//     everyone" option of the jacket-photo feature). Arbitrary URLs are
//     rejected, which keeps the original threat model (junk/hotlinked
//     overwrites) closed.
const ALLOWED_HOSTS = [
  'mzstatic.com',
  'apple.com',
  'discogs.com',
  'aladin.co.kr',
  'dzcdn.net',
  'supabase.co',
];

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { admin } = auth;

  const body = await request.json().catch(() => null);
  const albumId = Number(body?.albumId);
  const imageUrl = String(body?.imageUrl || '');
  if (!Number.isSafeInteger(albumId) || albumId <= 0 || !imageUrl) {
    return NextResponse.json({ error: 'albumId and imageUrl are required' }, { status: 400 });
  }

  let host: string;
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== 'https:') throw new Error('https only');
    host = parsed.hostname;
  } catch {
    return NextResponse.json({ error: 'invalid imageUrl' }, { status: 400 });
  }
  const allowed = ALLOWED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
  if (!allowed) {
    return NextResponse.json({ error: 'imageUrl host not allowed' }, { status: 403 });
  }

  const { error } = await admin
    .from('ALBUM_MASTER')
    .update({ IMAGE_URL: imageUrl })
    .eq('ALBUM_ID', albumId);
  if (error) {
    console.error('album master cover update failed:', error.message);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
