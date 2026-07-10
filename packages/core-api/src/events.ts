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
    if (!userId) return;

    const { error } = await supabase.from('EVENT_LOG').insert({
      EVENT_TYPE: eventType,
      USER_ID: userId,
      PLATFORM: platform,
      META: meta ?? null,
    });
    if (error) console.warn('logEvent failed:', error.message);
  } catch (e: any) {
    console.warn('logEvent failed:', e?.message || e);
  }
};
