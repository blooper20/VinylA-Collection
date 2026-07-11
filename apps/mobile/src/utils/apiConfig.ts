import Constants from 'expo-constants';

// All server-proxied calls (scan, Discogs/YouTube proxies) are served by the
// Next.js web app's API routes. In dev that's `next dev` on port 3000; in
// production it's the deployed Vercel app.
const API_PORT = 3000;
const PROD_API_URL = 'https://vinyla.vercel.app';

// A physical device can't reach the dev machine via `localhost`, and the
// machine's LAN IP changes across networks/reboots, so hardcoding it here
// used to go stale and break scanning. Instead, derive it from Metro's own
// host (the same IP the phone already used to load the JS bundle), which is
// always correct for the current dev session. Store/production builds have
// no Metro host and fall back to the deployed web app.
export const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:${API_PORT}`;
  }

  return PROD_API_URL;
};
