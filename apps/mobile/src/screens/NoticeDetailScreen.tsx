import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  useAuthStore,
  getNotice,
  getNoticeComments,
  addNoticeComment,
  deleteNoticeComment,
  likeNoticeComment,
  unlikeNoticeComment,
  incrementNoticeViewCount,
  NoticeComment,
} from '@vinyla/core-api';
import type { NOTICE, NoticeMediaItem } from '@vinyla/shared-types';

// 각 영상마다 자기 자신의 useVideoPlayer 인스턴스가 필요해 별도 컴포넌트로 분리.
const NoticeVideo = ({ url }: { url: string }) => {
  const player = useVideoPlayer(url, (p) => { p.loop = true; });
  return (
    <VideoView
      player={player}
      style={styles.mediaVideo}
      allowsFullscreen
      allowsPictureInPicture
      nativeControls
    />
  );
};

// 공지사항 상세 — 웹 /notices/[id]의 모바일 버전. 댓글은 공지별로 관리자가
// 열고 닫을 수 있다(IS_COMMENTS_ENABLED) — 닫혀 있으면 입력창 대신 안내만.
export const NoticeDetailScreen = () => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<Record<string, { noticeId: number }>, string>>();
  const { noticeId } = route.params || ({} as any);
  const { user } = useAuthStore();
  const isAdmin = user?.app_metadata?.role === 'admin';

  const [notice, setNotice] = useState<NOTICE | null | undefined>(undefined);
  const [comments, setComments] = useState<NoticeComment[] | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!noticeId) return;
    getNotice(noticeId).then((n) => {
      setNotice(n);
      if (n) incrementNoticeViewCount(noticeId);
    }).catch(() => setNotice(null));
  }, [noticeId]);

  const loadComments = useCallback(() => {
    if (!noticeId) return;
    getNoticeComments(noticeId).then(setComments).catch(() => setComments([]));
  }, [noticeId]);

  useEffect(loadComments, [loadComments]);

  const handleSubmitComment = async () => {
    if (!noticeId || !commentInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addNoticeComment(noticeId, commentInput);
      setCommentInput('');
      loadComments();
    } catch (e: any) {
      Alert.alert('', e?.message || '댓글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: number) => {
    Alert.alert('', t('log.deleteConfirm'), [
      { text: t('log.deleteConfirmNo'), style: 'cancel' },
      {
        text: t('log.deleteConfirmYes'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNoticeComment(commentId);
            setComments((prev) => (prev || []).filter((c) => c.COMMENT_ID !== commentId));
          } catch (e: any) {
            Alert.alert('', e?.message || '댓글 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const handleToggleLike = async (c: NoticeComment) => {
    if (!user) return;
    setComments((prev) =>
      (prev || []).map((x) =>
        x.COMMENT_ID === c.COMMENT_ID
          ? { ...x, LIKED_BY_ME: !x.LIKED_BY_ME, LIKE_COUNT: Math.max(0, x.LIKE_COUNT + (x.LIKED_BY_ME ? -1 : 1)) }
          : x
      )
    );
    try {
      if (c.LIKED_BY_ME) await unlikeNoticeComment(c.COMMENT_ID);
      else await likeNoticeComment(c.COMMENT_ID);
    } catch {
      loadComments();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Feather name="chevron-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>{t('notice.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {notice === undefined ? (
          <ActivityIndicator color={themeColors.accent} style={{ marginTop: 40 }} />
        ) : notice === null ? (
          <Text style={{ color: themeColors.textSecondary, textAlign: 'center', marginTop: 40 }}>{t('notice.notFound')}</Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              {notice.IS_PINNED && (
                <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(212,175,55,0.15)', marginRight: 8, marginBottom: 4 }}>
                  <Text style={{ color: themeColors.accent, fontSize: 10, fontWeight: '700' }}>{t('notice.pinned')}</Text>
                </View>
              )}
              <Text style={{ color: themeColors.textPrimary, fontSize: 20, fontWeight: '800', lineHeight: 28, flexShrink: 1 }}>{notice.TITLE}</Text>
            </View>
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginBottom: 18 }}>
              {new Date(notice.CREATED_AT).toLocaleString()} · {t('notice.views', { count: notice.VIEW_COUNT })}
            </Text>

            <Text style={{ color: themeColors.textPrimary, fontSize: 15, lineHeight: 24, marginBottom: 20 }}>{notice.CONTENT}</Text>

            {(notice.MEDIA_ITEMS || []).map((m: NoticeMediaItem, idx: number) => (
              <View key={idx} style={{ marginBottom: 14 }}>
                {m.type === 'video' ? (
                  <NoticeVideo url={m.url} />
                ) : (
                  <Image source={{ uri: m.url }} style={styles.mediaImage} resizeMode="cover" />
                )}
              </View>
            ))}

            <View style={{ marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: themeColors.border }}>
              <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 12 }}>{t('notice.commentsTitle')}</Text>

              {comments === null ? (
                <ActivityIndicator color={themeColors.accent} />
              ) : comments.length === 0 ? (
                <Text style={{ color: themeColors.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>{t('notice.commentEmpty')}</Text>
              ) : (
                comments.map((c) => {
                  const canDelete = !!user && (user.id === c.USER_ID || isAdmin);
                  return (
                    <View key={c.COMMENT_ID} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: themeColors.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: themeColors.accent }}>{c.DISPLAY_NAME || t('feed.anonymous')}</Text>
                        <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>{new Date(c.CREATED_AT).toLocaleDateString()}</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: themeColors.textPrimary, lineHeight: 19, marginVertical: 4 }}>{c.CONTENT}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <TouchableOpacity onPress={() => handleToggleLike(c)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Feather name="heart" size={13} color={c.LIKED_BY_ME ? themeColors.accent : themeColors.textSecondary} />
                          <Text style={{ fontSize: 12, color: c.LIKED_BY_ME ? themeColors.accent : themeColors.textSecondary }}>{c.LIKE_COUNT}</Text>
                        </TouchableOpacity>
                        {canDelete && (
                          <TouchableOpacity onPress={() => handleDeleteComment(c.COMMENT_ID)}>
                            <Text style={{ fontSize: 11, color: '#eb5757' }}>{t('spinSocial.delete')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}

              {notice.IS_COMMENTS_ENABLED ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
                  <TextInput
                    value={commentInput}
                    onChangeText={setCommentInput}
                    placeholder={user ? t('spinSocial.commentPlaceholder') : t('spinSocial.loginRequired')}
                    placeholderTextColor={themeColors.textSecondary}
                    editable={!!user && !submitting}
                    maxLength={500}
                    style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', color: themeColors.textPrimary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 13 }}
                  />
                  <TouchableOpacity
                    onPress={handleSubmitComment}
                    disabled={!user || submitting || !commentInput.trim()}
                    style={{ opacity: (!user || submitting || !commentInput.trim()) ? 0.5 : 1 }}
                  >
                    <Text style={{ color: themeColors.accent, fontWeight: '700', fontSize: 13 }}>{t('spinSocial.submit')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={{ color: themeColors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 14 }}>{t('notice.commentsDisabled')}</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  mediaImage: { width: '100%', height: 220, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  mediaVideo: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#000' },
});
