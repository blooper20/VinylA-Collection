import { EventType, ClientPlatform } from '@vinyla/shared-types';
import { supabase } from './supabase';

const detectPlatform = (): ClientPlatform =>
  typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative' ? 'MOBILE' : 'WEB';

/**
 * Fire-and-forget usage metric for the admin dashboard.
 * Never blocks or breaks the calling UX: failures are only warned,
 * and unauthenticated sessions are a silent no-op (EVENT_LOG RLS
 * requires the row's USER_ID to match auth.uid()).
 */
export const logEvent = async (
  eventType: EventType,
  meta?: Record<string, unknown>,
  platform: ClientPlatform = detectPlatform()
): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    // VISIT is the only event the anon role may write (RLS-enforced) —
    // it powers pre-login acquisition tracking. Everything else needs a session.
    if (!userId && eventType !== 'VISIT') return;

    const { error } = await supabase.from('EVENT_LOG').insert({
      EVENT_TYPE: eventType,
      USER_ID: eventType === 'VISIT' ? null : userId,
      PLATFORM: platform,
      META: meta ?? null,
    });
    if (error) console.warn('logEvent failed:', error.message);
  } catch (e: any) {
    console.warn('logEvent failed:', e?.message || e);
  }
};

// ── First-touch attribution (web) ────────────────────────────────
// Stored once in localStorage on the very first visit; attached to the
// SIGNUP event so the dashboard can answer "어떤 경로로 가입했나".
const FIRST_TOUCH_KEY = 'vinyla_first_touch';

export type FirstTouch = {
  source: string;      // utm_source > referrer host > 'direct' > 'share'
  referrer: string;
  path: string;
  utmMedium?: string;
  utmCampaign?: string;
  sharedFrom?: string; // /user/[id] 공유 링크로 진입한 경우 그 사용자 id
  at: string;
};

export const classifySource = (referrer: string, path: string, utmSource?: string | null): string => {
  if (utmSource) return utmSource.toLowerCase();
  if (path.startsWith('/user/')) return 'share';
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('google')) return 'google';
    if (host.includes('naver')) return 'naver';
    if (host.includes('youtube')) return 'youtube';
    if (host.includes('twitter') || host === 'x.com' || host === 't.co') return 'x';
    return host;
  } catch {
    return 'direct';
  }
};

export const captureFirstTouch = (): FirstTouch | null => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const existing = localStorage.getItem(FIRST_TOUCH_KEY);
    if (existing) return JSON.parse(existing);

    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    const referrer = document.referrer || '';
    const sharedMatch = path.match(/^\/user\/([^/]+)/);
    const touch: FirstTouch = {
      source: classifySource(referrer, path, params.get('utm_source')),
      referrer,
      path,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      sharedFrom: sharedMatch?.[1],
      at: new Date().toISOString(),
    };
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(touch));
    return touch;
  } catch {
    return null;
  }
};

export const getFirstTouch = (): FirstTouch | null => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FIRST_TOUCH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
