import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import {
  useAuthStore,
  searchAppleMusicAlbums,
  fetchAppleMusicAlbumTracks,
  reserveCommunityAlbumId,
  createCommunityAlbum,
  getCommunityAlbumById,
  communityAlbumHasOtherAdopters,
  updateCommunityAlbum,
  uploadUserCover,
  upsertUserVinyl,
  getErrorMessage,
  AppleMusicSearchResult,
} from '@vinyla/core-api';
import { useAlert } from '../providers/AlertProvider';

type FormSide = { heading: string; tracks: string[] };
type Source = 'APPLE_MUSIC' | 'MANUAL';

// AlbumTrack[]의 side별 flat 배열을 폼이 쓰는 "사이드 묶음" 구조로 되돌린다.
const tracksToSides = (tracks: { side?: string; title: string }[]): FormSide[] => {
  const groups: FormSide[] = [];
  for (const track of tracks) {
    const heading = track.side || 'A Side';
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.tracks.push(track.title);
    else groups.push({ heading, tracks: [track.title] });
  }
  return groups.length > 0 ? groups : [{ heading: 'A Side', tracks: [''] }];
};

// Discogs 카탈로그에 없는 앨범을 유저가 직접 등록한다(웹 /community-albums/new의
// 모바일 버전) — 애플뮤직 검색으로 커버·트랙리스트를 자동으로 가져오거나,
// 없으면 전부 수동 입력. 등록 즉시 본인 컬렉션에도 추가된다. route.params에
// albumId가 있으면 수정 모드(등록자 본인, 아직 아무도 안 담았을 때만 진입 가능
// — DetailModal이 그 조건을 미리 확인하고 링크를 보여준다).
export const CommunityAlbumRegisterScreen = ({ route }: any) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const { user } = useAuthStore();
  const { showAlert } = useAlert();
  const editAlbumId: number | undefined = route?.params?.albumId;

  const [appleQuery, setAppleQuery] = useState('');
  const [appleResults, setAppleResults] = useState<AppleMusicSearchResult[]>([]);
  const [isSearchingApple, setIsSearchingApple] = useState(false);
  const [hasSearchedApple, setHasSearchedApple] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [source, setSource] = useState<Source>('MANUAL');
  const [appleCollectionId, setAppleCollectionId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sides, setSides] = useState<FormSide[]>([{ heading: 'A Side', tracks: [''] }]);

  const [reservedAlbumId, setReservedAlbumId] = useState<number | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editState, setEditState] = useState<'loading' | 'ready' | 'not-found' | 'forbidden' | 'locked' | null>(
    editAlbumId ? 'loading' : null
  );

  useEffect(() => {
    if (!editAlbumId || user === undefined) return;
    if (!user) { setEditState('forbidden'); return; }
    getCommunityAlbumById(editAlbumId).then(async (album) => {
      if (!album) { setEditState('not-found'); return; }
      if (album.SUBMITTED_BY !== user.id) { setEditState('forbidden'); return; }
      if (await communityAlbumHasOtherAdopters(editAlbumId)) { setEditState('locked'); return; }
      setTitle(album.TITLE);
      setArtist(album.ARTIST);
      setReleaseYear(album.RELEASE_YEAR ? String(album.RELEASE_YEAR) : '');
      setImageUrl(album.IMAGE_URL);
      setSides(tracksToSides(album.TRACKS));
      setShowForm(true);
      setEditState('ready');
    }).catch(() => setEditState('not-found'));
  }, [editAlbumId, user]);

  const handleAppleSearch = async () => {
    if (!appleQuery.trim() || isSearchingApple) return;
    setIsSearchingApple(true);
    setHasSearchedApple(true);
    try {
      const results = await searchAppleMusicAlbums(appleQuery.trim());
      setAppleResults(results);
    } finally {
      setIsSearchingApple(false);
    }
  };

  const pickAppleResult = async (r: AppleMusicSearchResult) => {
    setIsSearchingApple(true);
    try {
      const page = await fetchAppleMusicAlbumTracks(r.collectionId);
      setSource('APPLE_MUSIC');
      setAppleCollectionId(r.collectionId);
      setTitle(page?.name || r.collectionName);
      setArtist(r.artistName);
      setReleaseYear(r.releaseYear ? String(r.releaseYear) : '');
      setImageUrl(r.artworkUrl || null);
      setSides([{ heading: 'A Side', tracks: page?.tracks?.length ? page.tracks : [''] }]);
      setShowForm(true);
    } finally {
      setIsSearchingApple(false);
    }
  };

  const startManualEntry = () => {
    setSource('MANUAL');
    setAppleCollectionId(null);
    setTitle('');
    setArtist('');
    setReleaseYear('');
    setImageUrl(null);
    setSides([{ heading: 'A Side', tracks: [''] }]);
    setShowForm(true);
  };

  const addSide = () => {
    setSides((prev) => [...prev, { heading: `${String.fromCharCode(65 + prev.length)} Side`, tracks: [''] }]);
  };
  const removeSide = (sideIdx: number) => setSides((prev) => prev.filter((_, i) => i !== sideIdx));
  const addTrack = (sideIdx: number) => {
    setSides((prev) => prev.map((s, i) => (i === sideIdx ? { ...s, tracks: [...s.tracks, ''] } : s)));
  };
  const removeTrack = (sideIdx: number, trackIdx: number) => {
    setSides((prev) =>
      prev.map((s, i) => (i === sideIdx ? { ...s, tracks: s.tracks.filter((_, ti) => ti !== trackIdx) } : s))
    );
  };
  const setTrackTitle = (sideIdx: number, trackIdx: number, value: string) => {
    setSides((prev) =>
      prev.map((s, i) =>
        i === sideIdx ? { ...s, tracks: s.tracks.map((tr, ti) => (ti === trackIdx ? value : tr)) } : s
      )
    );
  };

  const uploadCoverFromUri = async (uri: string) => {
    if (!user?.id || isUploadingCover) return;
    setIsUploadingCover(true);
    try {
      const albumId = editAlbumId ?? reservedAlbumId ?? (await reserveCommunityAlbumId());
      if (!editAlbumId) setReservedAlbumId(albumId);
      const response = await fetch(uri);
      const blob = await response.blob();
      const url = await uploadUserCover(albumId, blob);
      setImageUrl(url);
    } catch (e) {
      showAlert(t('common.error'), getErrorMessage(e, t));
    } finally {
      setIsUploadingCover(false);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(t('common.error'), '갤러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets?.length) uploadCoverFromUri(result.assets[0].uri);
  };

  // 최초 등록에만 확인을 거친다 — 한 번 등록하면 삭제할 방법이 없다는 걸
  // 저장 시점에 미리 알려서, 가볍게 테스트해본 데이터가 영구히 남는 걸
  // 막는다. 수정(editAlbumId 있음)은 이미 존재를 아는 데이터라 재확인 없음.
  const handleSubmitPress = () => {
    if (editAlbumId) { handleSubmit(); return; }
    Alert.alert(t('community.deleteWarningTitle'), t('community.deleteWarningMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('community.deleteWarningConfirm'), onPress: handleSubmit },
    ]);
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      showAlert(t('common.error'), t('detail.loginRequired'));
      return;
    }
    if (isSubmitting) return;
    const tracks = sides.flatMap((s) =>
      s.tracks.filter((tr) => tr.trim()).map((tr) => ({ side: s.heading.trim(), title: tr.trim() }))
    );
    setIsSubmitting(true);
    try {
      if (editAlbumId) {
        await updateCommunityAlbum(editAlbumId, {
          title,
          artist,
          releaseYear: releaseYear.trim() ? Number(releaseYear) : null,
          imageUrl,
          tracks,
        });
        showAlert(t('mobile.detail.successTitle') || 'Success', t('community.updateSuccess'), () =>
          navigation.navigate('CommunityAlbums')
        );
        return;
      }
      const { albumId } = await createCommunityAlbum(user.id, {
        albumId: reservedAlbumId ?? undefined,
        title,
        artist,
        releaseYear: releaseYear.trim() ? Number(releaseYear) : null,
        imageUrl,
        tracks,
        source,
        appleCollectionId,
      });
      await upsertUserVinyl({ USER_ID: user.id, ALBUM_ID: albumId, STATUS: 'OWNED' });
      showAlert(t('mobile.detail.successTitle') || 'Success', t('community.submitSuccess'), () =>
        navigation.navigate('CommunityAlbums')
      );
    } catch (e) {
      showAlert(t('common.error'), getErrorMessage(e, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (editState === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={themeColors.accent} />
      </View>
    );
  }
  if (editState === 'not-found' || editState === 'forbidden' || editState === 'locked') {
    const message =
      editState === 'locked' ? t('community.lockedByAdopters')
      : editState === 'forbidden' ? t('community.editableOnlyBySubmitter')
      : t('community.loadFailed');
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.background }}>
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
            <Feather name="chevron-left" size={24} color={themeColors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>{t('community.editButton')}</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={{ color: themeColors.textSecondary, padding: 20 }}>{message}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Feather name="chevron-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
          {editAlbumId ? t('community.editButton') : t('community.pageTitle')}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 60 }}>
        {!showForm && (
          <View>
            <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>
              {t('community.appleSearchStepTitle')}
            </Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.textInput, { flex: 1, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                placeholder={t('community.appleSearchPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={appleQuery}
                onChangeText={setAppleQuery}
                onSubmitEditing={handleAppleSearch}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={[styles.searchBtn, { backgroundColor: themeColors.accent }]}
                onPress={handleAppleSearch}
                disabled={isSearchingApple}
              >
                {isSearchingApple ? (
                  <ActivityIndicator size="small" color="#1a1a1a" />
                ) : (
                  <Text style={styles.searchBtnText}>{t('community.appleSearchButton')}</Text>
                )}
              </TouchableOpacity>
            </View>

            {appleResults.map((r) => (
              <TouchableOpacity
                key={r.collectionId}
                style={[styles.appleResultRow, { borderColor: themeColors.border }]}
                onPress={() => pickAppleResult(r)}
              >
                {r.artworkUrl && <Image source={{ uri: r.artworkUrl }} style={styles.appleResultCover} />}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.appleResultTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                    {r.collectionName}
                  </Text>
                  <Text style={[styles.appleResultArtist, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    {r.artistName}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            {hasSearchedApple && !isSearchingApple && appleResults.length === 0 && (
              <Text style={{ color: themeColors.textSecondary, marginBottom: 16 }}>
                {t('community.appleSearchNoResults')}
              </Text>
            )}

            <TouchableOpacity onPress={startManualEntry} style={{ marginTop: 8 }}>
              <Text style={{ color: themeColors.accent, textDecorationLine: 'underline' }}>
                {t('community.manualEntryCta')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {showForm && (
          <View>
            <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t('community.coverLabel')}</Text>
            <View style={styles.coverRow}>
              {imageUrl && <Image source={{ uri: imageUrl }} style={styles.coverPreview} />}
              <TouchableOpacity
                style={[styles.coverUploadBtn, { borderColor: themeColors.border }]}
                onPress={pickFromLibrary}
                disabled={isUploadingCover}
              >
                <Text style={{ color: themeColors.textPrimary, fontSize: 13 }}>
                  {isUploadingCover ? t('detail.coverPhotoUploading') : t('community.coverUploadCta')}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t('community.titleLabel')}</Text>
            <TextInput
              style={[styles.textInput, { color: themeColors.textPrimary, borderColor: themeColors.border }]}
              value={title}
              onChangeText={setTitle}
              placeholder={t('community.titlePlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.3)"
            />

            <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t('community.artistLabel')}</Text>
            <TextInput
              style={[styles.textInput, { color: themeColors.textPrimary, borderColor: themeColors.border }]}
              value={artist}
              onChangeText={setArtist}
              placeholder={t('community.artistPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.3)"
            />

            <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t('community.yearLabel')}</Text>
            <TextInput
              style={[styles.textInput, { color: themeColors.textPrimary, borderColor: themeColors.border }]}
              value={releaseYear}
              onChangeText={setReleaseYear}
              placeholder={t('community.yearPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="number-pad"
            />

            <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t('community.tracklistLabel')}</Text>
            {sides.map((side, sideIdx) => (
              <View key={sideIdx} style={[styles.sideBlock, { backgroundColor: themeColors.background === '#fcf9ee' ? '#f0ead9' : '#161616' }]}>
                <View style={styles.sideHeaderRow}>
                  <TextInput
                    style={[styles.textInput, { flex: 1, fontWeight: '700', color: themeColors.textPrimary, borderColor: themeColors.border }]}
                    value={side.heading}
                    onChangeText={(v) =>
                      setSides((prev) => prev.map((s, i) => (i === sideIdx ? { ...s, heading: v } : s)))
                    }
                  />
                  {sides.length > 1 && (
                    <TouchableOpacity onPress={() => removeSide(sideIdx)} style={{ padding: 8 }}>
                      <Feather name="trash-2" size={16} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
                {side.tracks.map((tr, trackIdx) => (
                  <View key={trackIdx} style={styles.trackRow}>
                    <TextInput
                      style={[styles.textInput, { flex: 1, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                      value={tr}
                      onChangeText={(v) => setTrackTitle(sideIdx, trackIdx, v)}
                      placeholder={t('detail.customPressingTrackPlaceholder', { n: trackIdx + 1 })}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                    {side.tracks.length > 1 && (
                      <TouchableOpacity onPress={() => removeTrack(sideIdx, trackIdx)} style={{ padding: 8 }}>
                        <Feather name="x" size={16} color={themeColors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity onPress={() => addTrack(sideIdx)}>
                  <Text style={{ color: themeColors.accent, fontSize: 13 }}>+ {t('community.addTrack')}</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={addSide} style={{ marginBottom: 24 }}>
              <Text style={{ color: themeColors.accent, fontSize: 13 }}>+ {t('community.addSide')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: themeColors.accent }]}
              onPress={handleSubmitPress}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#1a1a1a" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {editAlbumId ? t('community.updateButton') : t('community.submitButton')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
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
  headerTitle: { fontSize: 17, fontWeight: '700' },
  stepTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  searchBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 13 },
  appleResultRow: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  appleResultCover: { width: 48, height: 48, borderRadius: 6 },
  appleResultTitle: { fontSize: 13, fontWeight: '700' },
  appleResultArtist: { fontSize: 12, marginTop: 2 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  coverPreview: { width: 72, height: 72, borderRadius: 8 },
  coverUploadBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sideBlock: { borderRadius: 10, padding: 12, marginBottom: 16 },
  sideHeaderRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  trackRow: { flexDirection: 'row', alignItems: 'center' },
  submitBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 15 },
});
