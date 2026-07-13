import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/apiAuth';

// ALBUM_MASTER deliberately has NO client update policy (RLS) to stop
// malicious overwrites of shared data — this route is the narrow, gated
// exception for cover management. Definitions it enforces:
//   IMAGE_URL          — the cover everyone currently sees
//   ORIGINAL_IMAGE_URL — the last CATALOG cover (search-pipeline sources;
//                        never a user photo). "기존 커버" means this.
// Rules:
//   * setting a catalog-host URL updates BOTH fields (a fresher catalog
//     cover becomes the new "original")
//   * setting a user-covers URL updates IMAGE_URL and, when no backup
//     exists yet, snapshots the previous catalog cover into
//     ORIGINAL_IMAGE_URL first — so a publish can always be undone,
//     across sessions
//   * action:"revert" restores IMAGE_URL from ORIGINAL_IMAGE_URL
// Arbitrary hosts are rejected (anti-vandalism model unchanged).
const CATALOG_HOSTS = ['mzstatic.com', 'apple.com', 'discogs.com', 'aladin.co.kr', 'dzcdn.net'];
const USER_COVER_HOST = 'supabase.co';

const hostOf = (url: string): string | null => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.hostname : null;
  } catch {
    return null;
  }
};
const matches = (host: string, domains: string[]) =>
  domains.some((d) => host === d || host.endsWith(`.${d}`));
const isUserCoverUrl = (url: string): boolean => {
  const h = hostOf(url);
  return !!h && matches(h, [USER_COVER_HOST]) && url.includes('/user-covers/');
};

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { admin } = auth;

  const body = await request.json().catch(() => null);
  const albumId = Number(body?.albumId);
  if (!Number.isSafeInteger(albumId) || albumId <= 0) {
    return NextResponse.json({ error: 'albumId is required' }, { status: 400 });
  }

  let { data: row, error: readErr } = await admin
    .from('ALBUM_MASTER')
    .select('IMAGE_URL, ORIGINAL_IMAGE_URL')
    .eq('ALBUM_ID', albumId)
    .maybeSingle();
  if (readErr?.message?.includes('ORIGINAL_IMAGE_URL')) {
    // 컬럼 마이그레이션 전 — 백업 기능 없이 동작
    ({ data: row, error: readErr } = await admin
      .from('ALBUM_MASTER')
      .select('IMAGE_URL')
      .eq('ALBUM_ID', albumId)
      .maybeSingle());
  }
  if (readErr || !row) {
    return NextResponse.json({ error: 'album not found' }, { status: 404 });
  }
  const currentImage: string = row.IMAGE_URL || '';
  const currentOriginal: string = row.ORIGINAL_IMAGE_URL || '';

  // ── revert: 기존(카탈로그) 커버로 복원 ─────────────────────────────
  if (body?.action === 'revert') {
    if (currentOriginal) {
      const { error } = await admin
        .from('ALBUM_MASTER')
        .update({ IMAGE_URL: currentOriginal })
        .eq('ALBUM_ID', albumId);
      if (error) return NextResponse.json({ error: 'update failed' }, { status: 500 });
      return NextResponse.json({ ok: true, imageUrl: currentOriginal });
    }
    if (currentImage && !isUserCoverUrl(currentImage)) {
      // 마스터가 이미 카탈로그 커버 — 복원할 것도 없이 그 자체가 기존 커버
      return NextResponse.json({ ok: true, imageUrl: currentImage });
    }
    // 백업이 없고 현재 커버도 유저 사진: 클라이언트가 카탈로그 커버를 새로
    // 구해 set으로 치유해야 하는 케이스
    return NextResponse.json({ error: 'no-original' }, { status: 409 });
  }

  // ── set: 커버 교체 (+ 기존 커버 백업 관리) ─────────────────────────
  const imageUrl = String(body?.imageUrl || '');
  const host = imageUrl ? hostOf(imageUrl) : null;
  if (!host) {
    return NextResponse.json({ error: 'valid https imageUrl is required' }, { status: 400 });
  }

  const payload: Record<string, string> = { IMAGE_URL: imageUrl };
  if (matches(host, CATALOG_HOSTS)) {
    payload.ORIGINAL_IMAGE_URL = imageUrl;
  } else if (isUserCoverUrl(imageUrl)) {
    if (!currentOriginal && currentImage && !isUserCoverUrl(currentImage)) {
      payload.ORIGINAL_IMAGE_URL = currentImage;
    }
  } else {
    return NextResponse.json({ error: 'imageUrl host not allowed' }, { status: 403 });
  }

  const { error } = await admin.from('ALBUM_MASTER').update(payload).eq('ALBUM_ID', albumId);
  if (error) {
    // ORIGINAL_IMAGE_URL 컬럼 마이그레이션 전이면 백업 없이 커버만 교체
    // (기능 저하일 뿐 실패는 아님)
    if (error.message?.includes('ORIGINAL_IMAGE_URL')) {
      const { error: retryErr } = await admin
        .from('ALBUM_MASTER')
        .update({ IMAGE_URL: imageUrl })
        .eq('ALBUM_ID', albumId);
      if (!retryErr) return NextResponse.json({ ok: true, migrated: false });
    }
    console.error('album master cover update failed:', error.message);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
