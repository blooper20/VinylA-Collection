import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Image } from 'react-native';
import {
  useAuthStore,
  ListeningLogWithAlbum,
  SpinSocialSummary,
  SpinComment,
  getSpinSocialSummary,
  getSpinLogComments,
  likeSpinLog,
  unlikeSpinLog,
  saveSpinLog,
  unsaveSpinLog,
  reportSpinLog,
  addSpinLogComment,
  deleteSpinLogComment,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { useTheme } from '@vinyla/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ReportModal } from './ReportModal';

interface SpinSocialModalProps {
  entry: ListeningLogWithAlbum;
  ownerName?: string | null;
  isVisible: boolean;
  onClose: () => void;
  onSummaryChange?: (logId: number, summary: SpinSocialSummary) => void;
}

export const SpinSocialModal: React.FC<SpinSocialModalProps> = ({ entry, ownerName, isVisible, onClose, onSummaryChange }) => {
  const { t } = useLocale();
  const { themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [summary, setSummary] = useState<SpinSocialSummary>({
    likeCount: 0, commentCount: 0, likedByMe: false, savedByMe: false,
  });
  const [comments, setComments] = useState<SpinComment[] | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: number, type: 'log' | 'comment' } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const logId = entry.LOG_ID;
  const album = entry.ALBUM_MASTER;

  const player = useVideoPlayer(entry.MEDIA_URL || '', player => {
    player.loop = true;
    player.play();
  });

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const applySummary = (next: SpinSocialSummary) => {
    setSummary(next);
    onSummaryChange?.(logId, next);
  };

  const loadComments = async () => {
    const list = await getSpinLogComments(logId);
    setComments(list);
  };

  useEffect(() => {
    if (isVisible) {
      getSpinSocialSummary([logId]).then((map) => {
        if (map[logId]) applySummary(map[logId]);
      });
      loadComments();
    }
  }, [logId, isVisible]);

  const toggleLike = async () => {
    if (!user) return showNotice(t('spinSocial.loginRequired'));
    const prev = summary;
    const next = {
      ...summary,
      likedByMe: !summary.likedByMe,
      likeCount: Math.max(0, summary.likeCount + (summary.likedByMe ? -1 : 1)),
    };
    applySummary(next);
    try {
      if (prev.likedByMe) await unlikeSpinLog(logId);
      else await likeSpinLog(logId);
    } catch {
      applySummary(prev);
    }
  };

  const toggleSave = async () => {
    if (!user) return showNotice(t('spinSocial.loginRequired'));
    const prev = summary;
    applySummary({ ...summary, savedByMe: !summary.savedByMe });
    try {
      if (prev.savedByMe) await unsaveSpinLog(logId);
      else await saveSpinLog(logId);
    } catch {
      applySummary(prev);
    }
  };

  const handleSubmitComment = async () => {
    if (!user) return showNotice(t('spinSocial.loginRequired'));
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addSpinLogComment(logId, commentInput, replyTo?.id);
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

  const handleDeleteComment = async (c: SpinComment) => {
    const removed = 1 + c.replies.length;
    try {
      await deleteSpinLogComment(c.COMMENT_ID);
      await loadComments();
      applySummary({ ...summary, commentCount: Math.max(0, summary.commentCount - removed) });
    } catch {
      showNotice(t('error.DB-003' as any));
    }
  };

  const canDelete = (c: SpinComment) => !!user && (user.id === c.USER_ID || user.id === entry.USER_ID);

  const renderComment = (c: SpinComment, isReply = false) => (
    <View key={c.COMMENT_ID} style={{ marginLeft: isReply ? 34 : 0, paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
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
          <TouchableOpacity onPress={() => setReportTarget({ id: c.COMMENT_ID, type: 'comment' })}>
            <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>{t('spinSocial.report')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {c.replies.map(r => renderComment(r, true))}
    </View>
  );

  return (
    <Modal visible={isVisible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}
      >
        <View style={{ backgroundColor: themeColors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingBottom: insets.bottom }}>
          <View style={{ flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: themeColors.border, alignItems: 'center' }}>
            {album && (
              <Image source={{ uri: album.IMAGE_URL }} style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: themeColors.textPrimary }} numberOfLines={1}>{album?.TITLE}</Text>
              <Text style={{ fontSize: 12, color: themeColors.textSecondary }} numberOfLines={1}>{album?.ARTIST}</Text>
              <Text style={{ fontSize: 11, color: themeColors.textSecondary, marginTop: 2 }}>
                {ownerName && `${ownerName} · `}
                {new Date(entry.LISTENED_AT).toLocaleDateString()} {entry.MOOD ? `· ${entry.MOOD}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
              <Text style={{ fontSize: 18, color: themeColors.textSecondary }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
            {entry.NOTE && (
              <Text style={{ padding: 16, fontSize: 14, color: themeColors.textPrimary, lineHeight: 20 }}>
                {entry.NOTE}
              </Text>
            )}

            {entry.MEDIA_URL && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                {entry.MEDIA_TYPE === 'video' ? (
                  <VideoView 
                    player={player} 
                    style={{ width: '100%', height: 250, borderRadius: 8, backgroundColor: '#000' }} 
                    allowsFullscreen 
                    allowsPictureInPicture 
                  />
                ) : (
                  <Image 
                    source={{ uri: entry.MEDIA_URL }} 
                    style={{ width: '100%', height: 250, borderRadius: 8, backgroundColor: '#000' }} 
                    resizeMode="contain" 
                  />
                )}
              </View>
            )}

            <View style={{ flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: themeColors.border, gap: 16 }}>
              <TouchableOpacity onPress={toggleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: summary.likedByMe ? themeColors.accent : themeColors.textSecondary, fontSize: 18 }}>
                  {summary.likedByMe ? '♥' : '♡'}
                </Text>
                <Text style={{ color: summary.likedByMe ? themeColors.accent : themeColors.textSecondary }}>{summary.likeCount}</Text>
              </TouchableOpacity>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: themeColors.textSecondary, fontSize: 18 }}>💬</Text>
                <Text style={{ color: themeColors.textSecondary }}>{summary.commentCount}</Text>
              </View>

              <TouchableOpacity onPress={toggleSave} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: summary.savedByMe ? themeColors.accent : themeColors.textSecondary, fontSize: 18 }}>
                  {summary.savedByMe ? '★' : '☆'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setReportTarget({ id: logId, type: 'log' })} style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>{t('spinSocial.report')}</Text>
              </TouchableOpacity>
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
        targetType={reportTarget?.type || 'log'}
      />
    </Modal>
  );
};
