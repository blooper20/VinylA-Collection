import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/apiAuth';
import { searchDiscogsLazy, AlbumItem } from '@vinyla/core-api';

// Step 2 of the mobile scan flow (ported from apps/api so it actually runs
// in production on Vercel): gather Discogs candidates for the OCR queries,
// then ask Gemini to visually match the photographed cover against them.
// Auth-gated — this endpoint spends Gemini quota on every call.

interface CandidateAlbum {
  ALBUM_ID: number;
  TITLE: string;
  ARTIST: string;
  RELEASE_YEAR: number;
  IMAGE_URL: string;
  VINYL_IMAGE_URL: string;
  CUSTOM_COLOR_HEX: string;
  CUSTOM_STYLE_TYPE: string;
  GENRES: string[];
}

const MAX_BASE64_LENGTH = 4 * 1024 * 1024;
const MAX_QUERIES = 8;

async function fetchImageAsBase64(url: string): Promise<string | null> {
  if (!url || url.includes('spacer.gif') || !url.startsWith('https://')) return null;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'VinylA-Server/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer()).toString('base64');
  } catch {
    console.warn(`[scan] failed to fetch candidate image ${url}`);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'scan not configured' }, { status: 500 });
  }

  let body: { base64Image?: unknown; queries?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { base64Image, queries } = body;
  if (typeof base64Image !== 'string' || !Array.isArray(queries) || queries.length === 0) {
    return NextResponse.json({ error: 'missing base64Image or queries' }, { status: 400 });
  }
  if (base64Image.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: 'image too large' }, { status: 413 });
  }
  const cleanQueries = queries
    .filter((q): q is string => typeof q === 'string' && q.trim().length > 1)
    .slice(0, MAX_QUERIES);
  if (cleanQueries.length === 0) {
    return NextResponse.json({ error: 'missing base64Image or queries' }, { status: 400 });
  }

  try {
    // 1. Gather candidate albums from Discogs, trying queries in priority order
    const results: CandidateAlbum[] = [];
    for (let i = 0; i < cleanQueries.length; i++) {
      const q = cleanQueries[i];
      let foundMain = false;
      await searchDiscogsLazy(q, (album: AlbumItem) => {
        if (results.some((a) => a.ALBUM_ID === Number(album.id))) return;
        results.push({
          ALBUM_ID: Number(album.id) || Date.now() + Math.random(),
          TITLE: album.title || 'Unknown Title',
          ARTIST: album.artist || 'Unknown Artist',
          RELEASE_YEAR: parseInt(album.year) || 2024,
          IMAGE_URL: album.thumb || '',
          VINYL_IMAGE_URL: '',
          CUSTOM_COLOR_HEX: '#111',
          CUSTOM_STYLE_TYPE: 'SOLID',
          GENRES: album.genre || [],
        });
        foundMain = true;
      });

      if (foundMain) break;
      if (i < cleanQueries.length - 1) {
        // Discogs rate limit: pause between fallback queries
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    if (results.length === 0) {
      return NextResponse.json({ matchedIndex: -1, candidates: [] });
    }

    // Limit candidates to keep the VLM payload small
    const candidates = results.slice(0, 5);

    // 2. Fetch candidate cover images for visual comparison
    const candidateBase64s = await Promise.all(candidates.map((c) => fetchImageAsBase64(c.IMAGE_URL)));

    // 3. Interleave text + images into the VLM prompt
    type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
    const contentPayload: GeminiPart[] = [
      {
        text:
          'You are an expert vinyl record identifier. I will provide an Original Photo of an album cover, followed by several Candidate Albums (each with its artist, title, and cover image).\n\n' +
          'Your task: Carefully compare the Original Photo with the Candidate Album images. Find the exact visual match.\n\n' +
          'Return ONLY a JSON object: {"matchedIndex": <index>}. If none match, return {"matchedIndex": -1}.\n\n--- ORIGINAL PHOTO ---',
      },
      { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
    ];
    candidates.forEach((c, index) => {
      contentPayload.push({
        text: `\n--- CANDIDATE [${index}] ---\nArtist: ${c.ARTIST}\nTitle: ${c.TITLE}\nCover Image:`,
      });
      const img = candidateBase64s[index];
      contentPayload.push(img ? { inlineData: { mimeType: 'image/jpeg', data: img } } : { text: '(No image available)' });
    });

    const vlmRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Header instead of ?key= so the key never lands in proxy/server logs
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: contentPayload }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(60000),
      }
    );

    let matchedIndex = -1;
    if (vlmRes.ok) {
      const data = await vlmRes.json();
      const vlmText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      try {
        const parsed = JSON.parse(vlmText);
        if (typeof parsed.matchedIndex === 'number') matchedIndex = parsed.matchedIndex;
      } catch {
        console.error('[scan] failed to parse VLM JSON response');
      }
    } else {
      console.error('[scan] Gemini VLM error:', vlmRes.status);
    }

    return NextResponse.json({
      matchedIndex,
      candidates,
      bestMatch: matchedIndex >= 0 && matchedIndex < candidates.length ? candidates[matchedIndex] : null,
    });
  } catch (e) {
    console.error('[scan] endpoint error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
