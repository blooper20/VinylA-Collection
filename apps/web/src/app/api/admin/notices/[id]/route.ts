import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/adminAuth';

type Ctx = { params: Promise<{ id: string }> };

const MAX_MEDIA_ITEMS = 10;

type NoticeMediaItem = { url: string; type: 'image' | 'video' };

const parseInput = (body: any): { title: string; content: string; mediaItems: NoticeMediaItem[]; isPinned: boolean; isCommentsEnabled: boolean } | null => {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const isPinned = body?.isPinned === true;
  const isCommentsEnabled = body?.isCommentsEnabled !== false;
  const mediaItems = Array.isArray(body?.mediaItems)
    ? body.mediaItems.filter((m: any) => m && typeof m.url === 'string' && (m.type === 'image' || m.type === 'video')).slice(0, MAX_MEDIA_ITEMS)
    : [];
  if (!title || !content) return null;
  return { title, content, mediaItems, isPinned, isCommentsEnabled };
};

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin } = auth;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = parseInput(body);
  if (!parsed) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('NOTICE')
    .update({
      TITLE: parsed.title,
      CONTENT: parsed.content,
      MEDIA_ITEMS: parsed.mediaItems,
      IS_PINNED: parsed.isPinned,
      IS_COMMENTS_ENABLED: parsed.isCommentsEnabled,
      UPDATED_AT: new Date().toISOString(),
    })
    .eq('NOTICE_ID', Number(id))
    .select()
    .single();

  if (error) {
    if (error.message?.includes('notice_pin_limit_reached')) {
      return NextResponse.json({ error: 'pin-limit-reached' }, { status: 409 });
    }
    console.error('notice update failed:', error.message);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }

  return NextResponse.json({ notice: data });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin } = auth;
  const { id } = await ctx.params;

  const { error } = await admin.from('NOTICE').delete().eq('NOTICE_ID', Number(id));
  if (error) {
    console.error('notice delete failed:', error.message);
    return NextResponse.json({ error: 'delete failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
