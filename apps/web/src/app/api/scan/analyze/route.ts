import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/apiAuth';

// Step 1 of the mobile scan flow: Gemini OCR/analysis of the photographed
// album cover. Runs server-side so the Gemini key never ships in the app
// binary (it used to be EXPO_PUBLIC_ and extractable from the bundle).
const PROMPT = `너는 LP 레코드 전문가이자 시각 예술 분석가야.
첨부된 앨범 커버 이미지를 보고 다음을 분석해줘.

수행할 작업:
1. 주 앨범 식별: 이미지에 적힌 텍스트와 디자인을 종합하여 정확한 아티스트(Artist)와 앨범명(Album)을 분리해서 추출해라. 한국 가수의 앨범이라면 아티스트 이름과 앨범명, 트랙 이름을 한글로 정확하게 유추해서 적어라. (오타나 잘린 글자도 문맥에 맞게 완벽히 교정할 것)
2. 트랙리스트 식별: 앨범 표지에 곡 제목(Track)들이 적혀 있다면 식별 가능한 곡 제목들을 추출해라.
3. 시각적 키워드: 이미지의 분위기, 색감, 피사체 등을 묘사하는 키워드 3개를 영어로 추출해라.

출력 형식은 무조건 아래와 같은 순수 JSON 형식이어야 해. (마크다운 백틱 없이):
{
  "artist": "가수 이름",
  "album": "앨범 이름",
  "tracks": ["트랙1", "트랙2"],
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`;

// ~4MB of base64 ≈ 3MB image; the client crops/resizes to ~800px first.
const MAX_BASE64_LENGTH = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'scan not configured' }, { status: 500 });
  }

  let base64Image: unknown;
  try {
    ({ base64Image } = await request.json());
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (typeof base64Image !== 'string' || base64Image.length === 0) {
    return NextResponse.json({ error: 'missing base64Image' }, { status: 400 });
  }
  if (base64Image.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: 'image too large' }, { status: 413 });
  }

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Header instead of ?key= so the key never lands in proxy/server logs
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!res.ok) {
      console.error('[scan/analyze] Gemini error:', res.status);
      return NextResponse.json({ error: 'vision analysis failed' }, { status: 502 });
    }

    const data = await res.json();
    const responseText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ artist: '', album: '', tracks: [], keywords: [] });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      artist: typeof parsed.artist === 'string' ? parsed.artist : '',
      album: typeof parsed.album === 'string' ? parsed.album : '',
      tracks: Array.isArray(parsed.tracks) ? parsed.tracks.filter((t: unknown) => typeof t === 'string') : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((k: unknown) => typeof k === 'string') : [],
    });
  } catch (e) {
    console.error('[scan/analyze] failed:', e);
    return NextResponse.json({ error: 'vision analysis failed' }, { status: 502 });
  }
}
