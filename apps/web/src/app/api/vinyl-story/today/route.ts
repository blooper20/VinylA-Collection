import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// "오늘의 바이닐 스토리" — 크론 없이 조회 시점에 없으면 생성해서 캐싱한다.
// 대부분의 요청은 그냥 오늘 자 캐시 행을 읽는 것으로 끝나 Gemini를 호출하지
// 않는다(하루에 한 번, 그날의 첫 방문자만 생성 비용을 낸다). 콘텐츠 자체가
// 로그인 없이도 보이는 매거진 성격이라 이 라우트는 인증을 요구하지 않는다
// (VINYL_STORY도 ALBUM_MASTER처럼 public read — service role만 기록 가능).
const CLASSIC_ALBUM_POOL: { artist: string; title: string }[] = [
  { artist: 'The Beatles', title: 'Abbey Road' },
  { artist: 'Pink Floyd', title: 'The Dark Side of the Moon' },
  { artist: 'Fleetwood Mac', title: 'Rumours' },
  { artist: 'Michael Jackson', title: 'Thriller' },
  { artist: 'Nirvana', title: 'Nevermind' },
  { artist: 'Radiohead', title: 'OK Computer' },
  { artist: 'David Bowie', title: 'The Rise and Fall of Ziggy Stardust' },
  { artist: 'Stevie Wonder', title: 'Songs in the Key of Life' },
  { artist: 'Marvin Gaye', title: "What's Going On" },
  { artist: 'The Rolling Stones', title: 'Exile on Main St.' },
  { artist: 'Led Zeppelin', title: 'Led Zeppelin IV' },
  { artist: 'Prince', title: 'Purple Rain' },
  { artist: 'Joni Mitchell', title: 'Blue' },
  { artist: 'Bob Dylan', title: 'Blood on the Tracks' },
  { artist: 'The Velvet Underground', title: 'The Velvet Underground & Nico' },
  { artist: 'Kate Bush', title: 'Hounds of Love' },
  { artist: 'Talking Heads', title: 'Remain in Light' },
  { artist: 'Steely Dan', title: 'Aja' },
  { artist: 'Aretha Franklin', title: 'I Never Loved a Man the Way I Love You' },
  { artist: 'The Clash', title: 'London Calling' },
  { artist: 'Miles Davis', title: 'Kind of Blue' },
  { artist: 'John Coltrane', title: 'A Love Supreme' },
  { artist: 'Al Green', title: "Let's Stay Together" },
  { artist: 'Sly and the Family Stone', title: "There's a Riot Goin' On" },
  { artist: 'Bruce Springsteen', title: 'Born to Run' },
  { artist: 'Bjork', title: 'Homogenic' },
  { artist: 'Portishead', title: 'Dummy' },
  { artist: 'D\'Angelo', title: 'Voodoo' },
  { artist: 'Lauryn Hill', title: 'The Miseducation of Lauryn Hill' },
  { artist: 'Outkast', title: 'Stankonia' },
  { artist: 'Daft Punk', title: 'Discovery' },
  { artist: 'The Smiths', title: 'The Queen Is Dead' },
  { artist: 'My Bloody Valentine', title: 'Loveless' },
  { artist: 'Neil Young', title: 'Harvest' },
  { artist: 'Carole King', title: 'Tapestry' },
  { artist: 'Steely Dan', title: 'Aja' },
  { artist: '서태지와 아이들', title: '서태지와 아이들 III' },
  { artist: '들국화', title: '들국화 1집' },
  { artist: '조용필', title: '창밖의 여자' },
  { artist: '산울림', title: '산울림 1집' },
  { artist: '유재하', title: '사랑하기 때문에' },
  { artist: '김광석', title: '다시 부르기' },
  { artist: '신중현과 엽전들', title: '신중현과 엽전들 1집' },
  { artist: 'H.O.T.', title: 'We Hate All Kinds of Violence' },
  { artist: '이문세', title: '이문세 4집' },
  { artist: '015B', title: '수필과 자동차' },
  { artist: '동물원', title: '동물원' },
  { artist: 'Serge Gainsbourg', title: 'Melody Nelson' },
  { artist: 'Antônio Carlos Jobim', title: 'Wave' },
  { artist: 'Weather Report', title: 'Heavy Weather' },
  { artist: 'Herbie Hancock', title: 'Head Hunters' },
  { artist: 'Curtis Mayfield', title: 'Superfly' },
  { artist: 'Massive Attack', title: 'Mezzanine' },
  { artist: 'Beastie Boys', title: 'Paul\'s Boutique' },
  { artist: 'A Tribe Called Quest', title: 'The Low End Theory' },
  { artist: 'Wu-Tang Clan', title: 'Enter the Wu-Tang (36 Chambers)' },
  { artist: 'The Cure', title: 'Disintegration' },
  { artist: 'Joy Division', title: 'Unknown Pleasures' },
  { artist: 'Kraftwerk', title: 'Trans-Europe Express' },
  { artist: 'Brian Eno', title: 'Ambient 1: Music for Airports' },
];

// iTunes 무료 검색으로 고화질 커버를 붙인다 — 실패해도 스토리 자체는 계속
// 진행(그래프울 디그레이데이션, 커버 없이 헤드라인/본문만 보여줘도 무방).
const fetchCoverArt = async (artist: string, title: string): Promise<string | null> => {
  try {
    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', `${artist} ${title}`);
    url.searchParams.set('entity', 'album');
    url.searchParams.set('limit', '1');
    url.searchParams.set('country', 'KR');
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const artwork = data?.results?.[0]?.artworkUrl100;
    return typeof artwork === 'string' ? artwork.replace('100x100bb', '600x600bb') : null;
  } catch {
    return null;
  }
};

const getKstDateString = (): string => {
  // KST(UTC+9) 기준 오늘 날짜 — 서버는 UTC로 도는 경우가 많아 그냥 new Date()로
  // 날짜를 구하면 자정 근처에 하루가 어긋난다.
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10); // YYYY-MM-DD
};

const getDayOfYear = (dateStr: string): number => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
};

const generateStory = async (
  artist: string,
  title: string
): Promise<{ headline: string; body: string }> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const prompt = `너는 음악 저널리스트야. 아래 명반의 발매 비하인드 스토리나 잘 알려지지 않은
흥미로운 사실을 소개하는 짧은 글을 써줘.

아티스트: ${artist}
앨범: ${title}

작성 지침:
- 헤드라인은 15자 내외로 호기심을 자극하게
- 본문은 200자~350자 내외 한국어, 3~4문장
- 확인되지 않은 소문이 아니라 실제로 알려진 사실 위주로
- 마크다운/특수기호 없이 순수 텍스트로

출력 형식은 무조건 아래와 같은 순수 JSON (마크다운 백틱 없이):
{
  "headline": "헤드라인",
  "body": "본문"
}`;

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.8,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  const responseText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('no JSON in Gemini response');
  const parsed = JSON.parse(jsonMatch[0]);
  if (typeof parsed.headline !== 'string' || typeof parsed.body !== 'string') {
    throw new Error('malformed story JSON');
  }
  return { headline: parsed.headline, body: parsed.body };
};

export async function GET() {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  const today = getKstDateString();

  const { data: existing } = await admin
    .from('VINYL_STORY')
    .select('*')
    .eq('STORY_DATE', today)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ story: existing });
  }

  // 없으면 오늘의 앨범을 결정론적으로 골라 생성한다 — 같은 날 동시에 여러
  // 요청이 들어와도 항상 같은 앨범을 고르므로, 아래 upsert의 ignoreDuplicates가
  // 행 중복만 막아주면 결과적으로 일관된 콘텐츠가 보장된다.
  const pick = CLASSIC_ALBUM_POOL[getDayOfYear(today) % CLASSIC_ALBUM_POOL.length];

  try {
    const [{ headline, body }, coverImageUrl] = await Promise.all([
      generateStory(pick.artist, pick.title),
      fetchCoverArt(pick.artist, pick.title),
    ]);
    const { error: upsertError } = await admin
      .from('VINYL_STORY')
      .upsert(
        [{
          STORY_DATE: today,
          ALBUM_ARTIST: pick.artist,
          ALBUM_TITLE: pick.title,
          COVER_IMAGE_URL: coverImageUrl,
          HEADLINE: headline,
          BODY: body,
        }],
        { onConflict: 'STORY_DATE', ignoreDuplicates: true }
      );
    if (upsertError) {
      console.error('[vinyl-story] upsert failed:', upsertError.message);
    }
  } catch (e) {
    console.error('[vinyl-story] generation failed:', e);
    // 생성 실패 시에도 "오늘의 앨범 후보"만이라도 보여줄 수 있게 폴백 응답
    return NextResponse.json({
      story: {
        STORY_DATE: today,
        ALBUM_ARTIST: pick.artist,
        ALBUM_TITLE: pick.title,
        HEADLINE: pick.title,
        BODY: '',
        CREATED_AT: new Date().toISOString(),
      },
      generated: false,
    });
  }

  // 방금 넣었거나(또는 동시 요청이 이겨서) 이미 있는 오늘 행을 다시 읽어온다.
  const { data: fresh } = await admin
    .from('VINYL_STORY')
    .select('*')
    .eq('STORY_DATE', today)
    .maybeSingle();

  return NextResponse.json({ story: fresh });
}
