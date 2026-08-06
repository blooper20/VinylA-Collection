import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import {
  useAuthStore,
  getCommunityPost,
  updateCommunityPost,
  uploadCommunityPostMedia,
  getErrorMessage,
  CommunityPostWithMeta,
} from '@vinyla/core-api';
import { AlbumMultiSelectPicker, PickedAlbum } from '../components/Community/AlbumMultiSelectPicker';
import { SongMultiSelectPicker } from '../components/Community/SongMultiSelectPicker';

const MAX_MEDIA = 5;
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime',
};

// 자랑 하위 카테고리 중 앨범 다중 첨부가 있는 3개만 소스를 다르게 제한한다
// (웹 community/[postId]/edit/page.tsx의 ALBUM_PICKER_SOURCE와 동일 매핑).
const ALBUM_PICKER_SOURCE: Partial<Record<string, 'owned' | 'wish' | 'both'>> = {
  ARRIVAL: 'both',
  COLLECTION: 'owned',
  WISHLIST: 'wish',
};

// 기존 첨부(원격 URL)와 새로 고른 로컬 파일을 하나의 배열로 같이 다룬다 —
// 제출 시점에 kind로 구분해서 새 파일만 업로드한다.
type MediaSlot =
  | { kind: 'existing'; url: string; type: 'image' | 'video' }
  | { kind: 'new'; uri: string; type: 'image' | 'video' };

// 각 영상마다 자기 자신의 useVideoPlayer 인스턴스가 필요해 별도 컴포넌트로 분리.
const EditVideoThumb = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={styles.mediaThumb} nativeControls={false} contentFit="cover" />;
};

// 게시글 수정 — 웹 /community/[postId]/edit의 모바일 버전. 카테고리는 글쓰기
// 시점에만 고르고 수정 화면에서는 바꿀 수 없다(카테고리 전용 필드의 정합성
// 문제 — 웹과 동일한 이유).
export const CommunityPostEditScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const { user } = useAuthStore();
  const postId: number = route.params?.postId;

  const [post, setPost] = useState<CommunityPostWithMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<MediaSlot[]>([]);
  const [albums, setAlbums] = useState<PickedAlbum[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(postId)) return;
    getCommunityPost(postId).then((p) => {
      setPost(p);
      if (p) {
        setTitle(p.TITLE);
        setContent(p.CONTENT);
        setMedia(p.MEDIA_ITEMS.map((m) => ({ kind: 'existing', url: m.url, type: m.type })));
        setAlbums(p.albums.map((a) => ({ ALBUM_ID: a.ALBUM_ID, TITLE: a.TITLE, ARTIST: a.ARTIST, IMAGE_URL: a.IMAGE_URL })));
      }
    }).finally(() => setIsLoading(false));
  }, [postId]);

  const isAuthor = !!post && user?.id === post.AUTHOR_ID;
  const albumSource = post ? ALBUM_PICKER_SOURCE[post.CATEGORY] : undefined;
  const isSongCategory = post?.CATEGORY === 'ONOCHU';

  const pickImage = async () => {
    if (media.length >= MAX_MEDIA) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), '갤러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setMedia((prev) => [...prev, { kind: 'new', uri: asset.uri, type: asset.type === 'video' ? 'video' : 'image' }]);
    }
  };

  const handleSubmit = async () => {
    if (!post) return;
    if (!title.trim()) { Alert.alert(t('common.error'), t('communityBoard.submitFailedTitleRequired')); return; }
    if (!content.trim()) { Alert.alert(t('common.error'), t('communityBoard.submitFailedContentRequired')); return; }
    setIsSubmitting(true);
    try {
      const mediaItems = await Promise.all(
        media.map(async (m) => {
          if (m.kind === 'existing') return { url: m.url, type: m.type };
          const ext = (m.uri.split('.').pop() || (m.type === 'video' ? 'mp4' : 'jpg')).toLowerCase();
          const mimeType = MIME_BY_EXT[ext] || (m.type === 'video' ? 'video/mp4' : 'image/jpeg');
          return uploadCommunityPostMedia({ uri: m.uri, name: `media.${ext}`, type: mimeType });
        })
      );
      await updateCommunityPost(postId, {
        title,
        content,
        mediaItems,
        albumIds: (albumSource || isSongCategory) ? albums.map((a) => a.ALBUM_ID) : undefined,
      });
      navigation.replace('CommunityPost', { postId });
    } catch (e) {
      Alert.alert(t('common.error'), getErrorMessage(e, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !post) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={themeColors.accent} />
      </View>
    );
  }

  if (!isAuthor) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: themeColors.textSecondary, fontSize: 14 }}>{t('communityBoard.editableOnlyBySubmitter')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Feather name="x" size={22} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: themeColors.textPrimary, fontSize: 16, fontWeight: '700' }}>{t('communityBoard.editButton')}</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting} style={{ padding: 6 }}>
          {isSubmitting ? <ActivityIndicator size="small" color={themeColors.accent} /> : (
            <Text style={{ color: themeColors.accent, fontWeight: '700', fontSize: 14 }}>
              {t('communityBoard.updateButton')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        <Text style={{ color: themeColors.accent, fontSize: 11, fontWeight: '700', marginBottom: 16 }}>
          {t(`communityBoard.categories.${post.CATEGORY}` as any)}
        </Text>

        <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('communityBoard.titleLabel')}</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={[styles.input, { color: themeColors.textPrimary, borderColor: themeColors.border }]}
          maxLength={100}
        />

        <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('communityBoard.photoLabel')}</Text>
        <View style={styles.mediaGrid}>
          {media.map((m, i) => (
            <View key={i} style={styles.mediaThumbWrap}>
              {m.type === 'video' ? (
                <EditVideoThumb uri={m.kind === 'existing' ? m.url : m.uri} />
              ) : (
                <Image source={{ uri: m.kind === 'existing' ? m.url : m.uri }} style={styles.mediaThumb} />
              )}
              <TouchableOpacity style={styles.removeMediaBtn} onPress={() => setMedia((prev) => prev.filter((_, idx) => idx !== i))}>
                <Feather name="x" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {media.length < MAX_MEDIA && (
            <TouchableOpacity style={[styles.addMediaBtn, { borderColor: themeColors.border }]} onPress={pickImage}>
              <Feather name="camera" size={18} color={themeColors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={{ color: themeColors.textSecondary, fontSize: 11, marginTop: 4 }}>{t('communityBoard.photoLimit')}</Text>

        {!!albumSource && (
          <>
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('communityBoard.albumPickerLabel')}</Text>
            <AlbumMultiSelectPicker value={albums} onChange={setAlbums} source={albumSource} />
          </>
        )}

        {isSongCategory && (
          <>
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('communityBoard.songPickerLabel')}</Text>
            <SongMultiSelectPicker value={albums} onChange={setAlbums} />
          </>
        )}

        <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('communityBoard.contentLabel')}</Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          style={[styles.textarea, { color: themeColors.textPrimary, borderColor: themeColors.border }]}
          multiline
          maxLength={5000}
        />
      </ScrollView>
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
  label: { fontSize: 12, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textarea: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 140, textAlignVertical: 'top' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mediaThumbWrap: { position: 'relative', width: 76, height: 76 },
  mediaThumb: { width: 76, height: 76, borderRadius: 10 },
  removeMediaBtn: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  addMediaBtn: { width: 76, height: 76, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
