import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import {
  useAuthStore,
  createCommunityPost,
  uploadCommunityPostMedia,
  getErrorMessage,
} from '@vinyla/core-api';
import { CommunityPostCategory } from '@vinyla/shared-types';
import { ComingSoonNotice } from '../components/Community/ComingSoonNotice';
import { AlbumMultiSelectPicker, PickedAlbum } from '../components/Community/AlbumMultiSelectPicker';
import { SongMultiSelectPicker } from '../components/Community/SongMultiSelectPicker';

// LOCATION은 실제 DB 카테고리가 아니다 — 지도 SDK 도입 전까지 선택해도
// "준비 중" 안내만 뜨고 글쓰기 폼 자체가 나타나지 않는다.
type CategoryChoice = CommunityPostCategory | 'LOCATION';
const CATEGORIES: CategoryChoice[] = [
  'FREE', 'ARRIVAL', 'LISTENING_ROOM', 'COLLECTION', 'WISHLIST', 'ONOCHU', 'INFO', 'TIP', 'QNA', 'LOCATION',
];
// 이 카테고리들은 피드로 흡수돼 커뮤니티 게시판 목록에는 안 나온다
// (SocialScreen.tsx의 COMMUNITY_ALL_CATEGORIES와 정확히 상보 관계).
const SHOWCASE_CATEGORIES: CategoryChoice[] = ['ARRIVAL', 'LISTENING_ROOM', 'COLLECTION', 'WISHLIST', 'ONOCHU'];
const MAX_MEDIA = 5;
// 다이어리 기록 첨부(SpinLogEditorModal)와 동일한 상한 — 그쪽엔 이미 있는
// 업로드 전 용량 검증이 커뮤니티 글쓰기에는 빠져 있어, 큰 파일을 끝까지
// 올린 뒤에야 서버가 거부하는 낭비가 생겼다.
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime',
};

// 앨범 다중 첨부 피커는 "자랑" 계열 카테고리에서만 쓴다 — 오온음은 보유/위시
// 둘 다, 컬렉션은 보유만, 위시리스트는 위시만 고를 수 있게 소스를 제한한다
// (웹 community/new/page.tsx의 ALBUM_PICKER_SOURCE와 동일 매핑).
const ALBUM_PICKER_SOURCE: Partial<Record<CategoryChoice, 'owned' | 'wish' | 'both'>> = {
  ARRIVAL: 'both',
  COLLECTION: 'owned',
  WISHLIST: 'wish',
};

// 각 영상마다 자기 자신의 useVideoPlayer 인스턴스가 필요해 별도 컴포넌트로 분리(NoticeDetailScreen과 동일 패턴).
const NewPostVideoThumb = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={styles.mediaThumb} nativeControls={false} contentFit="cover" />;
};

// 커뮤니티 글쓰기 — 웹 /community/new의 모바일 버전. 정보게시판 위치는 v1
// 모바일에서 지도 SDK 없이 장소명/주소 텍스트 입력으로만 받는다(웹은 구글맵
// Places 연동, 모바일은 추후 네이티브 지도 SDK 파리티 작업 예정 — 이 앱의
// "웹 먼저, 검증 후 모바일 이식" 관례를 따름).
export const CommunityNewPostScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const { user } = useAuthStore();

  const [category, setCategory] = useState<CategoryChoice>('FREE');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<{ uri: string; type: 'image' | 'video' }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 앨범/노래 선택 결과는 AlbumMultiSelectPicker·SongMultiSelectPicker 둘 다
  // 이 하나의 배열을 공유한다 — 어느 쪽으로 고르든 최종적으로는 실제
  // ALBUM_ID 목록이라는 점이 같다(웹 community/new/page.tsx와 동일 설계).
  const [albums, setAlbums] = useState<PickedAlbum[]>([]);

  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');

  const pickImage = async () => {
    if (media.length >= MAX_MEDIA) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('mobile.detail.galleryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      const type: 'image' | 'video' = asset.type === 'video' ? 'video' : 'image';
      const realSize = new File(asset.uri).size ?? 0;
      if (realSize > (type === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES)) {
        const sizeMB = (realSize / (1024 * 1024)).toFixed(1);
        Alert.alert(t('common.error'), t('detail.spinLogMediaTooLargeWithSize', { size: sizeMB }));
        return;
      }
      setMedia((prev) => [...prev, { uri: asset.uri, type }]);
    }
  };

  const albumSource = ALBUM_PICKER_SOURCE[category];

  const handleSubmit = async () => {
    if (category === 'LOCATION') return; // 준비 중 카테고리 — 폼 자체가 안 보이므로 방어적 가드
    if (!user?.id) { Alert.alert(t('common.error'), t('communityBoard.loginRequired')); return; }
    if (!title.trim()) { Alert.alert(t('common.error'), t('communityBoard.submitFailedTitleRequired')); return; }
    if (!content.trim()) { Alert.alert(t('common.error'), t('communityBoard.submitFailedContentRequired')); return; }
    setIsSubmitting(true);
    try {
      const mediaItems = await Promise.all(
        media.map(async (m) => {
          const ext = (m.uri.split('.').pop() || (m.type === 'video' ? 'mp4' : 'jpg')).toLowerCase();
          const mimeType = MIME_BY_EXT[ext] || (m.type === 'video' ? 'video/mp4' : 'image/jpeg');
          return uploadCommunityPostMedia({ uri: m.uri, name: `media.${ext}`, type: mimeType });
        })
      );
      const postId = await createCommunityPost({
        category,
        title,
        content,
        mediaItems,
        albumIds: (ALBUM_PICKER_SOURCE[category] || category === 'ONOCHU') ? albums.map((a) => a.ALBUM_ID) : undefined,
        placeName: category === 'INFO' ? placeName : undefined,
        placeAddress: category === 'INFO' ? placeAddress : undefined,
      });
      // ARRIVAL 등 "자랑" 카테고리는 피드로 흡수돼 커뮤니티 목록엔 안 보인다
      // — 아무 안내 없이 그냥 넘어가면 "방금 쓴 글이 사라졌다"고 오해하기
      // 쉬워, 어디서 보이는지 한 번 짚어주고 넘어간다.
      if (SHOWCASE_CATEGORIES.includes(category)) {
        Alert.alert(
          t('communityBoard.showcaseSubmittedTitle'),
          t('communityBoard.showcaseSubmittedDesc'),
          [{ text: t('communityBoard.showcaseSubmittedOk'), onPress: () => navigation.replace('CommunityPost', { postId }) }]
        );
      } else {
        navigation.replace('CommunityPost', { postId });
      }
    } catch (e) {
      Alert.alert(t('common.error'), getErrorMessage(e, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Feather name="x" size={22} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: themeColors.textPrimary, fontSize: 16, fontWeight: '700' }}>{t('communityBoard.writeCta')}</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting || category === 'LOCATION'} style={{ padding: 6 }}>
          {isSubmitting ? <ActivityIndicator size="small" color={themeColors.accent} /> : (
            <Text style={{ color: category === 'LOCATION' ? themeColors.textSecondary : themeColors.accent, fontWeight: '700', fontSize: 14 }}>
              {t('communityBoard.submitButton')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                style={[
                  styles.categoryTab,
                  { borderColor: category === c ? themeColors.accent : themeColors.border },
                  category === c && { backgroundColor: `${themeColors.accent}20` },
                ]}
              >
                <Text style={{ color: category === c ? themeColors.accent : themeColors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                  {t(`communityBoard.categories.${c}` as any)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginBottom: 16 }}>
          {t(`communityBoard.categoryHint.${category}` as any)}
        </Text>

        {category === 'LOCATION' ? (
          <ComingSoonNotice />
        ) : (
        <>
        <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('communityBoard.titleLabel')}</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('communityBoard.titlePlaceholder')}
          placeholderTextColor={themeColors.textSecondary}
          style={[styles.input, { color: themeColors.textPrimary, borderColor: themeColors.border }]}
          maxLength={100}
        />

        <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('communityBoard.photoLabel')}</Text>
        <View style={styles.mediaGrid}>
          {media.map((m, i) => (
            <View key={i} style={styles.mediaThumbWrap}>
              {m.type === 'video' ? (
                <NewPostVideoThumb uri={m.uri} />
              ) : (
                <Image source={{ uri: m.uri }} style={styles.mediaThumb} />
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

        {category === 'ONOCHU' && (
          <>
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('communityBoard.songPickerLabel')}</Text>
            <SongMultiSelectPicker value={albums} onChange={setAlbums} />
          </>
        )}

        {category === 'INFO' && (
          <>
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('communityBoard.locationLabel')}</Text>
            <TextInput
              value={placeName}
              onChangeText={setPlaceName}
              placeholder={t('communityBoard.locationSearchPlaceholder')}
              placeholderTextColor={themeColors.textSecondary}
              style={[styles.input, { color: themeColors.textPrimary, borderColor: themeColors.border }]}
            />
            <TextInput
              value={placeAddress}
              onChangeText={setPlaceAddress}
              placeholder={t('communityBoard.locationSelected')}
              placeholderTextColor={themeColors.textSecondary}
              style={[styles.input, { color: themeColors.textPrimary, borderColor: themeColors.border, marginTop: 8 }]}
            />
          </>
        )}

        <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('communityBoard.contentLabel')}</Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder={t('communityBoard.contentPlaceholder')}
          placeholderTextColor={themeColors.textSecondary}
          style={[styles.textarea, { color: themeColors.textPrimary, borderColor: themeColors.border }]}
          multiline
          maxLength={5000}
        />
        </>
        )}
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
  categoryTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textarea: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 140, textAlignVertical: 'top' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mediaThumbWrap: { position: 'relative', width: 76, height: 76 },
  mediaThumb: { width: 76, height: 76, borderRadius: 10 },
  removeMediaBtn: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  addMediaBtn: { width: 76, height: 76, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
