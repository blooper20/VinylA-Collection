import { INQUIRY, INQUIRY_REPLY, InquiryCategory, ClientPlatform, InquiryAttachment } from '@vinyla/shared-types';
import { supabase } from './supabase';
import { getProxyBaseUrl } from './externalApi';

export type InquiryWithReplies = INQUIRY & { INQUIRY_REPLY: INQUIRY_REPLY[] };

/**
 * 문의 첨부 파일 업로드 (이미지·GIF·영상). 서버 라우트가 인증을 검증하고
 * inquiry-attachments 버킷의 본인 경로에 저장한 공개 URL을 돌려준다.
 */
export const uploadInquiryAttachment = async (file: File | Blob & { name?: string }): Promise<InquiryAttachment> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('로그인이 필요합니다.');

  const form = new FormData();
  form.append('file', file as File);
  const res = await fetch(`${getProxyBaseUrl()}/api/support/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `업로드 실패 (${res.status})`);
  }
  return (await res.json()) as InquiryAttachment;
};

/**
 * 사용자 문의 생성. RLS: 본인 USER_ID + STATUS='OPEN'만 허용.
 */
export const createInquiry = async (
  category: InquiryCategory,
  title: string,
  content: string,
  platform: ClientPlatform = 'WEB',
  attachments: InquiryAttachment[] = []
): Promise<INQUIRY> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('로그인이 필요합니다.');

  const { data, error } = await supabase
    .from('INQUIRY')
    .insert({
      USER_ID: session.user.id,
      CATEGORY: category,
      TITLE: title,
      CONTENT: content,
      PLATFORM: platform,
      ...(attachments.length > 0 ? { ATTACHMENTS: attachments } : {}),
    })
    .select()
    .single();

  if (error) throw error;
  return data as INQUIRY;
};

/**
 * 내 문의 목록 + 답변 스레드 (최신순). RLS가 본인 것만 반환.
 */
export const fetchMyInquiries = async (): Promise<InquiryWithReplies[]> => {
  const { data, error } = await supabase
    .from('INQUIRY')
    .select('*, INQUIRY_REPLY(*)')
    .order('CREATED_AT', { ascending: false });

  if (error) throw error;
  return ((data as InquiryWithReplies[]) || []).map((inq) => ({
    ...inq,
    INQUIRY_REPLY: [...(inq.INQUIRY_REPLY || [])].sort(
      (a, b) => a.CREATED_AT.localeCompare(b.CREATED_AT)
    ),
  }));
};

/**
 * 내 문의 수정 — 관리자가 아직 열람하지 않은(ADMIN_READ_AT null) 문의만.
 * 서버 라우트가 소유권·미열람 조건을 강제한다. 이미 확인된 문의면
 * 'already-read' 에러를 던진다.
 */
export const updateMyInquiry = async (
  inquiryId: number,
  category: InquiryCategory,
  title: string,
  content: string
): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('로그인이 필요합니다.');

  const res = await fetch(`${getProxyBaseUrl()}/api/support/inquiry-edit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inquiryId, category, title, content }),
  });
  if (res.status === 409) throw new Error('관리자가 이미 확인한 문의는 수정할 수 없습니다.');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || '문의 수정에 실패했습니다.');
  }
};

/**
 * 내 문의 스레드 열람 기록 — 관리자 답변에 READ_AT을 찍는다.
 * 실패해도 UX를 막지 않는 부가 동작이라 조용히 무시한다.
 */
export const markInquiryRepliesRead = async (inquiryId: number): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch(`${getProxyBaseUrl()}/api/support/replies-read`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inquiryId }),
    });
  } catch { /* ignore */ }
};

/**
 * 내 문의에 추가 답글 작성. RLS: 본인 문의 + IS_ADMIN=false만 허용.
 */
export const addUserReply = async (inquiryId: number, content: string): Promise<INQUIRY_REPLY> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('로그인이 필요합니다.');

  const { data, error } = await supabase
    .from('INQUIRY_REPLY')
    .insert({
      INQUIRY_ID: inquiryId,
      USER_ID: session.user.id,
      IS_ADMIN: false,
      CONTENT: content,
    })
    .select()
    .single();

  if (error) throw error;
  return data as INQUIRY_REPLY;
};
