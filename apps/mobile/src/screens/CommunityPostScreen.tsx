import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  TextInput, Alert, Modal, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import {
  useAuthStore,
  getCommunityPost,
  incrementCommunityPostViewCount,
  deleteCommunityPost,
  reportCommunityPost,
  getCommunityComments,
  addCommunityComment,
  deleteCommunityComment,
  likeCommunityComment,
  unlikeCommunityComment,
  reportCommunityComment,
  acceptCommunityAnswer,
  unacceptCommunityAnswer,
  getAlbumMaster,
  getErrorMessage,
  CommunityPostWithMeta,
  CommunityComment,
} from '@vinyla/core-api';
import { MockVinylData } from '@vinyla/shared-types';
import { ShowcaseCarousel } from '../components/Community/ShowcaseCarousel';
import { buildShowcaseItems } from '../utils/showcaseCarouselItems';
import { DetailModal } from '../components/Modal/DetailModal';

// 캐러셀은 화면 폭에서 상세 스크롤뷰의 좌우 패딩(16px×2)만큼 뺀 너비로 맞춘다.
const carouselSize = Dimensions.get('window').width - 32;

// 커뮤니티 게시글 상세 — 웹 /community/[postId]의 모바일 버전. 댓글/답변
// 스레드(1단계 대댓글)와 QnA 채택 버튼을 한 화면에서 처리한다.
export const CommunityPostScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const { user } = useAuthStore();
  const postId: number = route.params?.postId;

  const [post, setPost] = useState<CommunityPostWithMeta | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: number } | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);
  const [reportReason, setReportReason] = useState('');

  const loadComments = useCallback(() => {
    getCommunityComments(postId).then(setComments);
  }, [postId]);

  useEffect(() => {
    setIsLoading(true);
    setPost(null);
    Promise.all([getCommunityPost(postId), getCommunityComments(postId)])
      .then(([p, c]) => { setPost(p); setComments(c); })
      .catch(() => setPost(null)) // 삭제됐거나 RLS로 막힌 글 — 아래에서 "찾을 수 없음"으로 처리
      .finally(() => setIsLoading(false));
    incrementCommunityPostViewCount(postId);
  }, [postId]);

  const isAuthor = user?.id === post?.AUTHOR_ID;
  const isQna = post?.CATEGORY === 'QNA';

  const openAlbum = async (albumId: number) => {
    const master = await getAlbumMaster(albumId).catch(() => null);
    if (master) setSelectedAlbum(master as MockVinylData);
  };

  const handleDeletePost = () => {
    Alert.alert(t('communityBoard.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('communityBoard.deleteButton'), style: 'destructive', onPress: async () => {
          try {
            await deleteCommunityPost(postId);
            navigation.goBack();
          } catch (e) {
            Alert.alert(t('common.error'), getErrorMessage(e, t));
          }
        },
      },
    ]);
  };

  const submitComment = async () => {
    if (!content.trim()) return;
    try {
      await addCommunityComment(postId, content, replyTo?.id);
      setContent('');
      setReplyTo(null);
      loadComments();
    } catch (e) {
      Alert.alert(t('common.error'), getErrorMessage(e, t));
    }
  };

  const handleDeleteComment = (commentId: number) => {
    Alert.alert(t('communityBoard.deleteConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('communityBoard.deleteButton'), style: 'destructive', onPress: async () => { await deleteCommunityComment(commentId); loadComments(); } },
    ]);
  };

  const handleToggleLike = async (c: CommunityComment) => {
    try {
      if (c.LIKED_BY_ME) await unlikeCommunityComment(c.COMMENT_ID);
      else await likeCommunityComment(c.COMMENT_ID);
      loadComments();
    } catch { /* ignore */ }
  };

  const handleAccept = (commentId: number) => {
    Alert.alert(t('communityBoard.acceptConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('communityBoard.acceptCta'), onPress: async () => {
          try {
            await acceptCommunityAnswer(postId, commentId);
            setPost((p) => (p ? { ...p, ACCEPTED_COMMENT_ID: commentId } : p));
          } catch (e) {
            Alert.alert(t('common.error'), getErrorMessage(e, t));
          }
        },
      },
    ]);
  };

  const handleUnaccept = async () => {
    try {
      await unacceptCommunityAnswer(postId);
      setPost((p) => (p ? { ...p, ACCEPTED_COMMENT_ID: null } : p));
    } catch (e) {
      Alert.alert(t('common.error'), getErrorMessage(e, t));
    }
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    try {
      if (reportTarget.type === 'post') await reportCommunityPost(reportTarget.id, reportReason);
      else await reportCommunityComment(reportTarget.id, reportReason);
      Alert.alert(t('communityBoard.reportSuccess'));
    } catch (e) {
      Alert.alert(t('common.error'), getErrorMessage(e, t));
    } finally {
      setReportTarget(null);
      setReportReason('');
    }
  };

  const renderComment = (c: CommunityComment, isReply: boolean) => {
    const isAccepted = isQna && !isReply && post?.ACCEPTED_COMMENT_ID === c.COMMENT_ID;
    return (
      <View key={c.COMMENT_ID} style={[styles.commentItem, isReply && styles.commentReply, isAccepted && { backgroundColor: `${themeColors.accent}10`, borderRadius: 10, padding: 10 }]}>
        {isAccepted && <Text style={[styles.acceptedBadge, { color: themeColors.accent, borderColor: themeColors.accent }]}>{t('communityBoard.acceptedBadge')}</Text>}
        <View style={styles.commentHeader}>
          <Text style={{ color: themeColors.textPrimary, fontSize: 12, fontWeight: '600' }}>{c.DISPLAY_NAME || t('communityBoard.authorFallback')}</Text>
          <Text style={{ color: themeColors.textSecondary, fontSize: 10, marginLeft: 'auto' }}>{new Date(c.CREATED_AT).toLocaleDateString()}</Text>
        </View>
        <Text style={{ color: themeColors.textPrimary, fontSize: 13, marginTop: 4 }}>{c.CONTENT}</Text>
        <View style={styles.commentActions}>
          <TouchableOpacity onPress={() => handleToggleLike(c)} style={styles.commentActionBtn}>
            <Feather name="heart" size={13} color={c.LIKED_BY_ME ? themeColors.accent : themeColors.textSecondary} />
            {c.LIKE_COUNT > 0 && <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>{c.LIKE_COUNT}</Text>}
          </TouchableOpacity>
          {!isReply && (
            <TouchableOpacity onPress={() => setReplyTo({ id: c.COMMENT_ID, name: c.DISPLAY_NAME || t('communityBoard.authorFallback') })}>
              <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>{t('communityBoard.replyCta')}</Text>
            </TouchableOpacity>
          )}
          {isQna && !isReply && isAuthor && (
            <TouchableOpacity onPress={() => (isAccepted ? handleUnaccept() : handleAccept(c.COMMENT_ID))}>
              <Text style={{ color: themeColors.accent, fontSize: 11, fontWeight: '700' }}>
                {isAccepted ? t('communityBoard.acceptCancelCta') : t('communityBoard.acceptCta')}
              </Text>
            </TouchableOpacity>
          )}
          {user?.id === c.USER_ID && (
            <TouchableOpacity onPress={() => handleDeleteComment(c.COMMENT_ID)}>
              <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>{t('communityBoard.deleteButton')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setReportTarget({ type: 'comment', id: c.COMMENT_ID })}>
            <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>{t('communityBoard.reportCta')}</Text>
          </TouchableOpacity>
        </View>
        {c.replies.map((r) => renderComment(r, true))}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={themeColors.accent} />
      </View>
    );
  }

  // 삭제됐거나 RLS로 막힌 글 — 예전엔 post가 계속 null인 채로 위 스피너가
  // 영원히 돌아 뒤로 갈 방법도 없었다.
  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.background }}>
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
            <Feather name="arrow-left" size={22} color={themeColors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: themeColors.textSecondary, fontSize: 14, textAlign: 'center' }}>
            {t('communityBoard.postNotFound')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Feather name="chevron-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: themeColors.accent, fontSize: 11, fontWeight: '700' }}>
          {t(`communityBoard.categories.${post.CATEGORY}` as any)}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>{post.TITLE}</Text>
        <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginBottom: 12 }}>
          {post.AUTHOR_NAME || t('communityBoard.authorFallback')} · {new Date(post.CREATED_AT).toLocaleDateString()}
          {' · '}{t('communityBoard.viewCount', { count: post.VIEW_COUNT })}
        </Text>

        {post.CATEGORY === 'INFO' && post.PLACE_NAME && (
          <View style={[styles.locationBox, { backgroundColor: `${themeColors.accent}15` }]}>
            <Feather name="map-pin" size={14} color={themeColors.accent} />
            <Text style={{ color: themeColors.textPrimary, fontSize: 13, marginLeft: 6 }}>
              {post.PLACE_NAME}{post.PLACE_ADDRESS ? ` · ${post.PLACE_ADDRESS}` : ''}
            </Text>
          </View>
        )}

        {(post.albums.length > 0 || post.MEDIA_ITEMS.length > 0) && (
          <View style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden' }}>
            <ShowcaseCarousel
              items={buildShowcaseItems(post.albums, post.MEDIA_ITEMS)}
              onAlbumPress={openAlbum}
              size={carouselSize}
            />
          </View>
        )}

        <Text style={{ color: themeColors.textPrimary, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>{post.CONTENT}</Text>

        <View style={[styles.postActions, { borderBottomColor: themeColors.border }]}>
          {isAuthor && (
            <>
              <TouchableOpacity onPress={() => navigation.navigate('CommunityPostEdit', { postId })}>
                <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>{t('communityBoard.editButton')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeletePost}><Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>{t('communityBoard.deleteButton')}</Text></TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={() => setReportTarget({ type: 'post', id: postId })}>
            <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>{t('communityBoard.reportCta')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
          {isQna ? t('communityBoard.answersTitle') : t('communityBoard.commentsTitle')}
        </Text>
        {comments.length === 0 && <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>{t('communityBoard.empty')}</Text>}
        {comments.map((c) => renderComment(c, false))}
      </ScrollView>

      {user ? (
        <View style={[styles.inputBar, { borderTopColor: themeColors.border, backgroundColor: themeColors.background, paddingBottom: insets.bottom + 8 }]}>
          {replyTo && (
            <View style={styles.replyBanner}>
              <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>{t('communityBoard.replyingTo', { name: replyTo.name })}</Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}><Text style={{ color: themeColors.accent, fontSize: 11 }}>{t('communityBoard.replyCancel')}</Text></TouchableOpacity>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12 }}>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder={isQna ? t('communityBoard.answerPlaceholder') : t('communityBoard.commentPlaceholder')}
              placeholderTextColor={themeColors.textSecondary}
              style={[styles.input, { color: themeColors.textPrimary, borderColor: themeColors.border }]}
            />
            <TouchableOpacity onPress={submitComment} style={[styles.submitBtn, { backgroundColor: themeColors.accent }]}>
              <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>{t('communityBoard.commentSubmit')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <Modal visible={!!reportTarget} transparent animationType="fade" onRequestClose={() => setReportTarget(null)}>
        <View style={styles.reportBackdrop}>
          <View style={[styles.reportCard, { backgroundColor: themeColors.background }]}>
            <TextInput
              value={reportReason}
              onChangeText={setReportReason}
              placeholder={t('communityBoard.reportReasonPlaceholder')}
              placeholderTextColor={themeColors.textSecondary}
              style={[styles.reportInput, { color: themeColors.textPrimary, borderColor: themeColors.border }]}
              multiline
            />
            <TouchableOpacity onPress={submitReport} style={[styles.submitBtn, { backgroundColor: themeColors.accent }]}>
              <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>{t('communityBoard.reportSubmit')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <DetailModal
        album={selectedAlbum}
        visible={!!selectedAlbum}
        onClose={() => setSelectedAlbum(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: '700', marginTop: 4, marginBottom: 6 },
  locationBox: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, marginBottom: 12 },
  postActions: { flexDirection: 'row', gap: 16, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  commentItem: { paddingVertical: 10 },
  commentReply: { marginLeft: 24 },
  commentHeader: { flexDirection: 'row', alignItems: 'center' },
  commentActions: { flexDirection: 'row', gap: 14, marginTop: 6, alignItems: 'center' },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  acceptedBadge: { fontSize: 10, fontWeight: '700', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6, alignSelf: 'flex-start' },
  inputBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  replyBanner: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 6 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  submitBtn: { paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  reportBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  reportCard: { width: '85%', borderRadius: 12, padding: 16, gap: 10 },
  reportInput: { minHeight: 80, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, textAlignVertical: 'top' },
});
