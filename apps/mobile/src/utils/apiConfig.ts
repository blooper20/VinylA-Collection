import Constants from 'expo-constants';

// Local Node.js VLM/scan server (apps/api) always runs on port 3001;
// the web app always runs on port 3000. Keep this in sync with
// apps/api/src/index.ts's PORT fallback.
const API_PORT = 3001;

// A physical device can't reach the dev machine via `localhost`, and the
// machine's LAN IP changes across networks/reboots, so hardcoding it here
// used to go stale and break scanning. Instead, derive it from Metro's own
// host (the same IP the phone already used to load the JS bundle), which is
// always correct for the current dev session.
export const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:${API_PORT}`;
  }

  return `http://localhost:${API_PORT}`;
};
