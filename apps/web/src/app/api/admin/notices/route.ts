import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/adminAuth';

const MAX_MEDIA_ITEMS = 10;

type NoticeMediaItem = { url: string; type: 'image' | 'video' };

const parseInput = (body: any): { title: string; content: string; mediaItems: NoticeMediaItem[]; isPinned: boolean; isCommentsEnabled: boolean } | null => {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const isPinned = body?.isPinned === true;
  // 명시적으로 false를 보낸 경우만 끔 — 기본은 댓글 허용
  const isCommentsEnabled = body?.isCommentsEnabled !== false;
  const mediaItems = Array.isArray(body?.mediaItems)
    ? body.mediaItems.filter((m: any) => m && typeof m.url === 'string' && (m.type === 'image' || m.type === 'video')).slice(0, MAX_MEDIA_ITEMS)
    : [];
  if (!title || !content) return null;
  return { title, content, mediaItems, isPinned, isCommentsEnabled };
};

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin, user } = auth;

  const body = await request.json().catch(() => null);
  const parsed = parseInput(body);
  if (!parsed) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('NOTICE')
    .insert({
      TITLE: parsed.title,
      CONTENT: parsed.content,
      MEDIA_ITEMS: parsed.mediaItems,
      IS_PINNED: parsed.isPinned,
      IS_COMMENTS_ENABLED: parsed.isCommentsEnabled,
      AUTHOR_ID: user.id,
    })
    .select()
    .single();

  if (error) {
    // DB 트리거가 5개 초과 고정 시도를 P0001로 거부한다
    if (error.message?.includes('notice_pin_limit_reached')) {
      return NextResponse.json({ error: 'pin-limit-reached' }, { status: 409 });
    }
    console.error('notice create failed:', error.message);
    return NextResponse.json({ error: 'create failed' }, { status: 500 });
  }

  return NextResponse.json({ notice: data });
}
