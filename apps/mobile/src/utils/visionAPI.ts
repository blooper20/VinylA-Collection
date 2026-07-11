import axios from 'axios';
import { supabase } from '@vinyla/core-api';
import { getApiBaseUrl } from './apiConfig';

export type VinylCoverAnalysis = {
  artist: string;
  album: string;
  tracks: string[];
  keywords: string[];
};

// Step 1 of the scan flow. The Gemini call itself lives in the server route
// (/api/scan/analyze) — the key used to be EXPO_PUBLIC_ and extractable from
// the app binary. The route is auth-gated, so the session token is required.
export const detectVinylCover = async (base64Image: string): Promise<VinylCoverAnalysis> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('로그인이 필요합니다.');
  }

  const response = await axios.post(
    `${getApiBaseUrl()}/api/scan/analyze`,
    { base64Image },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      timeout: 40000,
    }
  );

  return {
    artist: response.data?.artist || '',
    album: response.data?.album || '',
    tracks: Array.isArray(response.data?.tracks) ? response.data.tracks : [],
    keywords: Array.isArray(response.data?.keywords) ? response.data.keywords : [],
  };
};
