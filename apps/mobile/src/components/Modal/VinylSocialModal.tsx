import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import {
  useAuthStore,
  FeedItem,
  VinylSocialSummary,
  VinylComment,
  getVinylSocialSummary,
  getVinylComments,
  toggleVinylLike,
  toggleVinylSave,
  addVinylComment,
  deleteVinylComment,
  getAlbumMaster,
} from '@vinyla/core-api';
import { MockVinylData } from '@vinyla/shared-types';
import { useLocale } from '@vinyla/i18n';
import { useTheme } from '@vinyla/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReportModal } from './ReportModal';
import { DetailModal } from './DetailModal';
import { ActionMenuSheet } from './ActionMenuSheet';
import { updateUserVinylIsPublic } from '@vinyla/core-api';

interface VinylSocialModalProps {
  entry: FeedItem;
  isVisible: boolean;
  onClose: () => void;
  onSummaryChange?: (userVinylId: number, summary: VinylSocialSummary) => void;
  onUpdate?: (updatedEntry: FeedItem) => void;
}

// 피드 수집 게시물의 소셜 상세 — 웹 VinylSocialModal의 모바일 버전(바텀시트).
export const VinylSocialModal: React.FC<VinylSocialModalProps> = ({ entry, isVisible, onClose, onSummaryChange, onUpdate }) => {
  const { t } = useLocale();
  const { themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const navigation = useNavigation<NavigationProp<any>>();

  const [summary, setSummary] = useState<VinylSocialSummary>({
    likeCount: 0, commentCount: 0, likedByMe: false, savedByMe: false,
  });
  const [comments, setComments] = useState<VinylComment[] | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: number, type: 'vinyl' | 'vinylComment' } | null>(null);
  const [fullAlbum, setFullAlbum] = useState<MockVinylData | null>(null);
  const [isAlbumLoading, setIsAlbumLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isActionMenuVisible, setIsActionMenuVisible] = useState(false);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);

  const id = entry.USER_VINYL_ID;
  const album = entry.ALBUM;

  // 웹 VinylSocialModal 파리티: 헤더 유저명 → 프로필, 앨범 카드 → 상세 모달
  const openProfile = () => {
    onClose();
    navigation.navigate('UserProfile', { userId: entry.USER_ID, name: entry.DISPLAY_NAME });
  };

  const handleAlbumPress = async () => {
    if (!album || isAlbumLoading) return;
    setIsAlbumLoading(true);
    try {
      const master = await getAlbumMaster(album.ALBUM_ID);
      if (master) setFullAlbum(master as MockVinylData);
      else showNotice(t('spinSocial.networkError'));
    } catch {
      showNotice(t('spinSocial.networkError'));
    } finally {
      setIsAlbumLoading(false);
    }
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const applySummary = (next: VinylSocialSummary) => {
    setSummary(next);
    onSummaryChange?.(id, next);
  };

  const loadComments = async () => {
    const list = await getVinylComments(id);
    setComments(list);
  };

  useEffect(() => {
    if (isVisible) {
      getVinylSocialSummary([id]).then((map) => {
        if (map[id]) applySummary(map[id]);
      });
      loadComments();
    }
  }, [id, isVisible]);

  const handleToggleLike = async () => {
    if (!user) return showNotice(t('spinSocial.loginRequired'));
    const prev = summary;
    applySummary({
      ...summary,
      likedByMe: !summary.likedByMe,
      likeCount: Math.max(0, summary.likeCount + (summary.likedByMe ? -1 : 1)),
    });
    try {
      await toggleVinylLike(id, prev.likedByMe);
    } catch {
      applySummary(prev);
    }
  };

  const handleToggleSave = async () => {
    if (!user) return showNotice(t('spinSocial.loginRequired'));
    const prev = summary;
    applySummary({ ...summary, savedByMe: !summary.savedByMe });
    try {
      await toggleVinylSave(id, prev.savedByMe);
    } catch {
      applySummary(prev);
    }
  };

  const handleSubmitComment = async () => {
    if (!user) return showNotice(t('spinSocial.loginRequired'));
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addVinylComment(id, commentInput, replyTo?.id);
      setCommentInput('');
      setReplyTo(null);
      await loadComments();
      applySummary({ ...summary, commentCount: summary.commentCount + 1 });
    } catch {
      showNotice(t('error.DB-001' as any));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (c: VinylComment) => {
    const removed = 1 + (c.REPLIES?.length || 0);
    try {
      await deleteVinylComment(c.COMMENT_ID);
      await loadComments();
      applySummary({ ...summary, commentCount: Math.max(0, summary.commentCount - removed) });
    } catch {
      showNotice(t('error.DB-003' as any));
    }
  };

  const canDelete = (c: VinylComment) => !!user && (user.id === c.USER_ID || user.id === entry.USER_ID);

  const renderComment = (c: VinylComment, isReply = false) => (
    <View key={c.COMMENT_ID} style={{ marginLeft: isReply ? 34 : 0, paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {c.PROFILE_IMAGE_URL ? (
          <Image source={{ uri: c.PROFILE_IMAGE_URL }} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        ) : (
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="user" size={11} color={themeColors.textSecondary} />
          </View>
        )}
        <Text style={{ fontSize: 13, fontWeight: '700', color: themeColors.accent }}>
          {c.DISPLAY_NAME || t('feed.anonymous')}
        </Text>
        <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
          {new Date(c.CREATED_AT).toLocaleDateString()}
        </Text>
      </View>
      <Text style={{ marginVertical: 4, fontSize: 13, color: c.IS_HIDDEN ? themeColors.textSecondary : themeColors.textPrimary, lineHeight: 18 }}>
        {c.IS_HIDDEN ? '관리자에 의해 비공개 처리된 댓글입니다.' : c.CONTENT}
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {!isReply && (
          <TouchableOpacity onPress={() => setReplyTo({ id: c.COMMENT_ID, name: c.DISPLAY_NAME || t('feed.anonymous') })}>
            <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>{t('spinSocial.reply')}</Text>
          </TouchableOpacity>
        )}
        {canDelete(c) && (
          <TouchableOpacity onPress={() => handleDeleteComment(c)}>
            <Text style={{ fontSize: 11, color: '#eb5757' }}>{t('spinSocial.delete')}</Text>
          </TouchableOpacity>
        )}
        {user && user.id !== c.USER_ID && !c.IS_HIDDEN && (
          <TouchableOpacity onPress={() => setReportTarget({ id: c.COMMENT_ID, type: 'vinylComment' })}>
            <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>{t('spinSocial.report')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {(c.REPLIES || []).map(r => renderComment(r, true))}
    </View>
  );

  return (
    <Modal visible={isVisible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}
      >
        <View style={{ backgroundColor: themeColors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingBottom: insets.bottom }}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: themeColors.border }}>
            {/* 유저 프로필 헤더 — 탭하면 프로필 화면으로 이동 (웹 파리티) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
              <TouchableOpacity onPress={openProfile} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                {entry.PROFILE_IMAGE_URL ? (
                  <Image source={{ uri: entry.PROFILE_IMAGE_URL }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                ) : (
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="user" size={17} color={themeColors.textSecondary} />
                  </View>
                )}
                <View style={{ flexShrink: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: themeColors.textPrimary }} numberOfLines={1}>
                    {entry.DISPLAY_NAME || t('feed.anonymous')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1, gap: 4 }}>
                    <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
                      {new Date(entry.ADDED_AT).toLocaleDateString()}
                    </Text>
                    {entry.IS_PUBLIC ? (
                      <Feather name="globe" size={10} color={themeColors.textSecondary} />
                    ) : (
                      <Feather name="lock" size={10} color={themeColors.textSecondary} />
                    )}
                  </View>
                </View>
                <Feather name="chevron-right" size={15} color={themeColors.textSecondary} style={{ opacity: 0.6 }} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
                <Text style={{ fontSize: 18, color: themeColors.textSecondary }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 앨범 카드 — 탭하면 앨범 상세 모달 (웹 파리티) */}
            <TouchableOpacity
              onPress={handleAlbumPress}
              disabled={isAlbumLoading}
              style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 14, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)' }}
            >
              {album?.IMAGE_URL ? (
                <Image source={{ uri: album.IMAGE_URL }} style={{ width: 44, height: 44, borderRadius: 6, marginRight: 12 }} />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 6, marginRight: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="disc" size={18} color={themeColors.textSecondary} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: themeColors.textPrimary }} numberOfLines={1}>{album?.TITLE}</Text>
                <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 1 }} numberOfLines={1}>{album?.ARTIST}</Text>
              </View>
              {isAlbumLoading ? (
                <ActivityIndicator size="small" color={themeColors.accent} />
              ) : (
                <Feather name="chevron-right" size={18} color={themeColors.textSecondary} style={{ opacity: 0.5 }} />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: themeColors.border, gap: 16 }}>
              <TouchableOpacity onPress={handleToggleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: summary.likedByMe ? themeColors.accent : themeColors.textSecondary, fontSize: 18 }}>
                  {summary.likedByMe ? '♥' : '♡'}
                </Text>
                <Text style={{ color: summary.likedByMe ? themeColors.accent : themeColors.textSecondary }}>{summary.likeCount}</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="message-circle" size={18} color={themeColors.textSecondary} />
                <Text style={{ color: themeColors.textSecondary }}>{summary.commentCount}</Text>
              </View>

              <TouchableOpacity onPress={handleToggleSave} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: summary.savedByMe ? themeColors.accent : themeColors.textSecondary, fontSize: 18 }}>
                  {summary.savedByMe ? '★' : '☆'}
                </Text>
              </TouchableOpacity>

              {user?.id === entry.USER_ID ? (
                <TouchableOpacity onPress={() => setIsActionMenuVisible(true)} style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', padding: 4 }}>
                  <Feather name="more-horizontal" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setReportTarget({ id, type: 'vinyl' })} style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>{t('spinSocial.report')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ padding: 16 }}>
              {comments === null ? (
                <ActivityIndicator color={themeColors.accent} />
              ) : comments.length === 0 ? (
                <Text style={{ textAlign: 'center', color: themeColors.textSecondary, padding: 20 }}>{t('spinSocial.empty')}</Text>
              ) : (
                comments.map(c => renderComment(c))
              )}
            </View>
          </ScrollView>

          {notice && (
            <Text style={{ color: themeColors.accent, textAlign: 'center', padding: 8, fontSize: 12 }}>{notice}</Text>
          )}

          <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: themeColors.border, flexDirection: 'row', alignItems: 'center' }}>
            {replyTo && (
              <View style={{ position: 'absolute', top: -25, left: 16, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>{t('spinSocial.replyingTo', { name: replyTo.name })}</Text>
                <TouchableOpacity onPress={() => setReplyTo(null)} style={{ marginLeft: 8 }}>
                  <Text style={{ color: themeColors.textSecondary, fontSize: 10 }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            <TextInput
              value={commentInput}
              onChangeText={setCommentInput}
              placeholder={user ? t('spinSocial.commentPlaceholder') : t('spinSocial.loginRequired')}
              placeholderTextColor={themeColors.textSecondary}
              editable={!!user && !submitting}
              style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', color: themeColors.textPrimary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100 }}
              multiline
            />
            <TouchableOpacity
              onPress={handleSubmitComment}
              disabled={!commentInput.trim() || !user || submitting}
              style={{ marginLeft: 12, opacity: (!commentInput.trim() || submitting) ? 0.5 : 1 }}
            >
              <Text style={{ color: themeColors.accent, fontWeight: '700' }}>{t('spinSocial.submit')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ReportModal
        isVisible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetId={reportTarget?.id || 0}
        targetType={reportTarget?.type || 'vinyl'}
      />
      <DetailModal
        album={fullAlbum}
        visible={!!fullAlbum}
        onClose={() => setFullAlbum(null)}
      />

      <ActionMenuSheet
        visible={isActionMenuVisible}
        onClose={() => setIsActionMenuVisible(false)}
        options={(() => {
          if (!user || user.id !== entry.USER_ID) return [];
          return [
            {
              id: 'public-toggle',
              label: `${entry.IS_PUBLIC ? t('detail.spinLogPrivate') : t('detail.spinLogPublic')}로 전환`,
              icon: entry.IS_PUBLIC ? 'lock' : 'globe',
              isProcessing: isTogglingPublic,
              onPress: () => {
                if (isTogglingPublic) return;

                const proceed = async () => {
                  setIsTogglingPublic(true);
                  try {
                    await updateUserVinylIsPublic(id, !entry.IS_PUBLIC);
                    onUpdate?.({ ...entry, IS_PUBLIC: !entry.IS_PUBLIC });
                  } catch (e) {
                    showNotice(t('spinSocial.networkError'));
                  } finally {
                    setIsTogglingPublic(false);
                    setIsActionMenuVisible(false);
                  }
                };

                if (entry.IS_PUBLIC) {
                  Alert.alert(
                    '비공개로 전환하시겠습니까?',
                    '비공개로 변경하면 피드에서 더 이상 확인할 수 없으며, 추후 마이페이지에서 다시 공개로 전환해야 합니다.',
                    [
                      { text: '취소', style: 'cancel' },
                      { text: '비공개로 전환', style: 'destructive', onPress: proceed }
                    ]
                  );
                } else {
                  proceed();
                }
              }
            }
          ];
        })()}
        bottomInset={insets.bottom}
      />
    </Modal>
  );
};
