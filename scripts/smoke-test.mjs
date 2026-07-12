#!/usr/bin/env node
// Post-deploy production smoke test.
//
// Exercises the critical user journey end-to-end against LIVE production,
// exactly the way a real (Google-authenticated) user's browser does — the
// test account signs in through Supabase's password grant, which produces
// the same auth.uid()-bearing JWT and therefore hits the same RLS policies.
//
// Born from the 2026-07-11 DB-002 incident: an error-handling refactor made
// every first-ever album save throw, all 14 newly acquired users bounced,
// and nothing caught it because no check covered "save an album nobody has
// saved before" on production. Step 4 below is exactly that case.
//
// Usage:  node scripts/smoke-test.mjs
// Reads SMOKE_TEST_EMAIL / SMOKE_TEST_PASSWORD (and the Supabase keys) from
// apps/web/.env.local. Exits non-zero on any failure.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.SMOKE_SITE_URL || 'https://vinyla.vercel.app';

// ── env ─────────────────────────────────────────────────────────────────
const env = {};
for (const line of readFileSync(join(ROOT, 'apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY; // cleanup only
const EMAIL = env.SMOKE_TEST_EMAIL;
const PASSWORD = env.SMOKE_TEST_PASSWORD;
if (!SUPA || !ANON || !EMAIL || !PASSWORD) {
  console.error('missing env — need NEXT_PUBLIC_SUPABASE_URL/ANON_KEY and SMOKE_TEST_EMAIL/PASSWORD in apps/web/.env.local');
  process.exit(2);
}

// Fake, collision-free album id: below the Aladin offset (9e9), far above
// any real Discogs id. Unique per run so parallel/aborted runs never clash.
const TEST_ALBUM_ID = 8_900_000_000 + (Date.now() % 100_000_000);

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
};

const rest = (path, { token, method = 'GET', body, headers = {} } = {}) =>
  fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token || ANON}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

let failedEarly = false;
try {
  // 1. Sign in (same JWT shape/claims as a Google session; same RLS path)
  console.log(`\n▶ smoke test vs ${SITE}  (album id ${TEST_ALBUM_ID})`);
  const authRes = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const auth = await authRes.json();
  const token = auth.access_token;
  const userId = auth.user?.id;
  if (!check('1. test-account sign-in', !!token && !!userId, auth.error_description || auth.msg || '')) throw new Error('auth failed');

  // 2. Production search proxies answer
  const aladin = await (await fetch(`${SITE}/api/external/aladin-search?q=${encodeURIComponent('백예린')}`)).json().catch(() => null);
  check('2a. aladin-search proxy', Array.isArray(aladin?.items) && aladin.items.length > 0, `${aladin?.items?.length ?? 'no'} items`);
  const deezer = await (await fetch(`${SITE}/api/external/deezer-album?q=${encodeURIComponent('백예린 Flash and Core')}`)).json().catch(() => null);
  check('2b. deezer-album proxy', Array.isArray(deezer?.data) && !!deezer.data[0]?.cover_xl, deezer?.data?.[0]?.title || '');
  const apple = await (await fetch(`${SITE}/api/external/apple-tracks?id=1887773334`)).json().catch(() => null);
  check('2c. apple-tracks proxy', apple?.name === '개화' && apple?.tracks?.length > 0, `${apple?.name} / ${apple?.tracks?.length} tracks`);

  // 3. THE DB-002 case: reading a master row that does not exist must be a
  //    clean empty result, not an error (client uses maybeSingle → no
  //    object-coercion header here).
  const masterRead = await rest(`ALBUM_MASTER?ALBUM_ID=eq.${TEST_ALBUM_ID}&select=ALBUM_ID`, { token });
  const masterRows = await masterRead.json().catch(() => null);
  check('3. missing-master read is clean (DB-002 case)', masterRead.ok && Array.isArray(masterRows) && masterRows.length === 0, `HTTP ${masterRead.status}`);

  // 4. First-ever save: create master + user vinyl exactly like handleSave
  const masterIns = await rest('ALBUM_MASTER', {
    token, method: 'POST', headers: { Prefer: 'return=representation' },
    body: [{ ALBUM_ID: TEST_ALBUM_ID, TITLE: '[SMOKE TEST]', ARTIST: '[SMOKE TEST]', IMAGE_URL: '', RELEASE_YEAR: 2026 }],
  });
  check('4a. create ALBUM_MASTER (authenticated)', masterIns.ok, `HTTP ${masterIns.status} ${masterIns.ok ? '' : await masterIns.text()}`);

  const vinylIns = await rest('USER_VINYL', {
    token, method: 'POST', headers: { Prefer: 'return=representation' },
    body: [{ USER_ID: userId, ALBUM_ID: TEST_ALBUM_ID, STATUS: 'OWNED', PURCHASE_PRICE: 0 }],
  });
  const vinylRow = (await vinylIns.json().catch(() => []))[0];
  check('4b. save USER_VINYL (first-ever save path)', vinylIns.ok && !!vinylRow, `HTTP ${vinylIns.status}`);

  // 5. Read back through the same joined query the collection screen uses
  const readBack = await rest(`USER_VINYL?USER_ID=eq.${userId}&ALBUM_ID=eq.${TEST_ALBUM_ID}&select=*,ALBUM_MASTER(*)`, { token });
  const rows = await readBack.json().catch(() => []);
  check('5. collection read-back with join', readBack.ok && rows.length === 1 && rows[0]?.ALBUM_MASTER?.TITLE === '[SMOKE TEST]');

  // 6. Cleanup — user vinyl with the user's own token (RLS-guarded delete,
  //    same as the real delete flow); master row via service role (no user
  //    delete policy exists for masters, by design).
  const vinylDel = await rest(`USER_VINYL?USER_ID=eq.${userId}&ALBUM_ID=eq.${TEST_ALBUM_ID}`, { token, method: 'DELETE' });
  check('6a. cleanup USER_VINYL (user-token delete)', vinylDel.ok, `HTTP ${vinylDel.status}`);
  if (SERVICE) {
    const masterDel = await fetch(`${SUPA}/rest/v1/ALBUM_MASTER?ALBUM_ID=eq.${TEST_ALBUM_ID}`, {
      method: 'DELETE', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    check('6b. cleanup ALBUM_MASTER (service role)', masterDel.ok, `HTTP ${masterDel.status}`);
  }
} catch (e) {
  failedEarly = true;
  console.error('aborted:', e.message);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 && !failedEarly ? '✅ ALL PASS' : `❌ ${failed.length || 1} FAILURE(S)`} (${results.length} checks)`);
process.exit(failed.length === 0 && !failedEarly ? 0 : 1);
