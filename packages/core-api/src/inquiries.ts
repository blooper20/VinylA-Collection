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
