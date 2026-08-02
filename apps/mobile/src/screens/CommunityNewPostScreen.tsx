import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import {
  useAuthStore,
  createCommunityPost,
  uploadCommunityPostMedia,
  getUserVinyls,
  getErrorMessage,
} from '@vinyla/core-api';
import { CommunityPostCategory } from '@vinyla/shared-types';
import { ComingSoonNotice } from '../components/Community/ComingSoonNotice';

// LOCATION은 실제 DB 카테고리가 아니다 — 지도 SDK 도입 전까지 선택해도
// "준비 중" 안내만 뜨고 글쓰기 폼 자체가 나타나지 않는다.
type CategoryChoice = CommunityPostCategory | 'LOCATION';
const CATEGORIES: CategoryChoice[] = ['FREE', 'ARRIVAL', 'LISTENING_ROOM', 'INFO', 'TIP', 'QNA', 'LOCATION'];
const MAX_MEDIA = 5;

interface PickedAlbum { ALBUM_ID: number; TITLE: string; ARTIST: string; IMAGE_URL: string | null }

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
  const [media, setMedia] = useState<{ uri: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [albums, setAlbums] = useState<PickedAlbum[]>([]);
  const [albumPickerOpen, setAlbumPickerOpen] = useState(false);
  const [allAlbums, setAllAlbums] = useState<PickedAlbum[]>([]);
  const [albumQuery, setAlbumQuery] = useState('');
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);

  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');

  const pickImage = async () => {
    if (media.length >= MAX_MEDIA) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), '갤러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.length) {
      setMedia((prev) => [...prev, { uri: result.assets[0].uri }]);
    }
  };

  const openAlbumPicker = () => {
    setAlbumPickerOpen(true);
    if (!user?.id || allAlbums.length > 0) return;
    setIsLoadingAlbums(true);
    getUserVinyls(user.id)
      .then((rows: any[]) => {
        const list: PickedAlbum[] = rows
          .filter((r) => r.ALBUM_MASTER)
          .map((r) => ({
            ALBUM_ID: r.ALBUM_MASTER.ALBUM_ID,
            TITLE: r.ALBUM_MASTER.TITLE,
            ARTIST: r.ALBUM_MASTER.ARTIST,
            IMAGE_URL: r.ALBUM_MASTER.IMAGE_URL || null,
          }));
        const seen = new Set<number>();
        setAllAlbums(list.filter((a) => (seen.has(a.ALBUM_ID) ? false : (seen.add(a.ALBUM_ID), true))));
      })
      .finally(() => setIsLoadingAlbums(false));
  };

  const toggleAlbum = (a: PickedAlbum) => {
    setAlbums((prev) => (prev.some((v) => v.ALBUM_ID === a.ALBUM_ID) ? prev.filter((v) => v.ALBUM_ID !== a.ALBUM_ID) : [...prev, a]));
  };

  const filteredAlbums = allAlbums.filter((a) => {
    const q = albumQuery.trim().toLowerCase();
    if (!q) return true;
    return a.TITLE.toLowerCase().includes(q) || a.ARTIST.toLowerCase().includes(q);
  });

  const handleSubmit = async () => {
    if (category === 'LOCATION') return; // 준비 중 카테고리 — 폼 자체가 안 보이므로 방어적 가드
    if (!user?.id) { Alert.alert(t('common.error'), t('communityBoard.loginRequired')); return; }
    if (!title.trim()) { Alert.alert(t('common.error'), t('communityBoard.submitFailedTitleRequired')); return; }
    if (!content.trim()) { Alert.alert(t('common.error'), t('communityBoard.submitFailedContentRequired')); return; }
    setIsSubmitting(true);
    try {
      const mediaItems = await Promise.all(
        media.map(async (m) => {
          const response = await fetch(m.uri);
          const blob = await response.blob();
          return uploadCommunityPostMedia(blob);
        })
      );
      const postId = await createCommunityPost({
        category,
        title,
        content,
        mediaItems,
        albumIds: category === 'ARRIVAL' ? albums.map((a) => a.ALBUM_ID) : undefined,
        placeName: category === 'INFO' ? placeName : undefined,
        placeAddress: category === 'INFO' ? placeAddress : undefined,
      });
      navigation.replace('CommunityPost', { postId });
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
              <Image source={{ uri: m.uri }} style={styles.mediaThumb} />
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

        {category === 'ARRIVAL' && (
          <>
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('communityBoard.albumPickerLabel')}</Text>
            <TouchableOpacity style={[styles.pickerBtn, { borderColor: themeColors.border }]} onPress={openAlbumPicker}>
              <Text style={{ color: themeColors.textPrimary, fontSize: 13 }}>
                {albums.length > 0 ? t('communityBoard.albumPickerSelectedCount', { count: albums.length }) : t('communityBoard.albumPickerCta')}
              </Text>
            </TouchableOpacity>
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

      <Modal visible={albumPickerOpen} animationType="slide" onRequestClose={() => setAlbumPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: themeColors.background, paddingTop: insets.top }}>
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <TouchableOpacity onPress={() => setAlbumPickerOpen(false)} style={{ padding: 6 }}>
              <Feather name="chevron-down" size={22} color={themeColors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ color: themeColors.textPrimary, fontSize: 15, fontWeight: '700' }}>{t('communityBoard.albumPickerCta')}</Text>
            <View style={{ width: 30 }} />
          </View>
          <TextInput
            value={albumQuery}
            onChangeText={setAlbumQuery}
            placeholder={t('communityBoard.albumPickerSearchPlaceholder')}
            placeholderTextColor={themeColors.textSecondary}
            style={[styles.input, { color: themeColors.textPrimary, borderColor: themeColors.border, margin: 16 }]}
          />
          {isLoadingAlbums && <ActivityIndicator color={themeColors.accent} />}
          {!isLoadingAlbums && filteredAlbums.length === 0 && (
            <Text style={{ color: themeColors.textSecondary, textAlign: 'center' }}>{t('communityBoard.albumPickerEmpty')}</Text>
          )}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>
            {filteredAlbums.map((a) => {
              const selected = albums.some((v) => v.ALBUM_ID === a.ALBUM_ID);
              return (
                <TouchableOpacity key={a.ALBUM_ID} style={styles.albumRow} onPress={() => toggleAlbum(a)}>
                  <Image source={{ uri: a.IMAGE_URL || undefined }} style={styles.albumRowImg} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 13 }} numberOfLines={1}>{a.TITLE}</Text>
                    <Text style={{ color: themeColors.textSecondary, fontSize: 11 }} numberOfLines={1}>{a.ARTIST}</Text>
                  </View>
                  <Feather name={selected ? 'check-circle' : 'circle'} size={18} color={selected ? themeColors.accent : themeColors.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: themeColors.accent }]} onPress={() => setAlbumPickerOpen(false)}>
            <Text style={{ color: '#000', fontWeight: '700' }}>{t('communityBoard.albumPickerDone')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
  pickerBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  albumRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  albumRowImg: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#000' },
  doneBtn: { margin: 16, padding: 12, borderRadius: 10, alignItems: 'center' },
});
