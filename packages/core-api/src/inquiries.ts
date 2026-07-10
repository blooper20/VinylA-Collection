import { INQUIRY, INQUIRY_REPLY, InquiryCategory, ClientPlatform } from '@vinyla/shared-types';
import { supabase } from './supabase';

export type InquiryWithReplies = INQUIRY & { INQUIRY_REPLY: INQUIRY_REPLY[] };

/**
 * 사용자 문의 생성. RLS: 본인 USER_ID + STATUS='OPEN'만 허용.
 */
export const createInquiry = async (
  category: InquiryCategory,
  title: string,
  content: string,
  platform: ClientPlatform = 'WEB'
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
