import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ActivityIndicator, Modal, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { useAuthStore, searchAppleMusicSongs, createCommunityAlbum, AppleMusicSongSearchResult, getErrorMessage } from '@vinyla/core-api';

export interface PickedSong { ALBUM_ID: number; TITLE: string; ARTIST: string; IMAGE_URL: string | null }

// "오노추(오늘의 노래 추천)" 글쓰기/수정 화면 전용 다중 선택 피커 —
// AlbumMultiSelectPicker는 내 컬렉션에서 고르지만, 이건 애플뮤직 전체
// 카탈로그를 검색해 고른다. 검색 결과를 고르는 즉시 커뮤니티 등록 앨범
// (createCommunityAlbum, SOURCE=APPLE_MUSIC)으로 만들어 실제 ALBUM_ID를
// 확보한다(웹 SongMultiSelectPicker.tsx와 동일).
export const SongMultiSelectPicker: React.FC<{
  value: PickedSong[];
  onChange: (next: PickedSong[]) => void;
}> = ({ value, onChange }) => {
  const insets = useSafeAreaInsets();
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const { user } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AppleMusicSongSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [resolvingTrackIds, setResolvingTrackIds] = useState<Set<number>>(new Set());
  // 같은 세션에서 이미 고른 트랙을 다시 누르면 해제되도록 trackId→ALBUM_ID 매핑을 기억한다.
  const [pickedTrackIds, setPickedTrackIds] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!isOpen) return;
    const term = query.trim();
    const timeout = setTimeout(() => {
      if (!term) { setResults([]); return; }
      setIsSearching(true);
      searchAppleMusicSongs(term).then(setResults).finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, isOpen]);

  const toggle = async (song: AppleMusicSongSearchResult) => {
    const existingAlbumId = pickedTrackIds[song.trackId];
    if (existingAlbumId !== undefined) {
      onChange(value.filter((v) => v.ALBUM_ID !== existingAlbumId));
      setPickedTrackIds((prev) => {
        const next = { ...prev };
        delete next[song.trackId];
        return next;
      });
      return;
    }
    if (!user?.id || resolvingTrackIds.has(song.trackId)) return;
    setResolvingTrackIds((prev) => new Set(prev).add(song.trackId));
    try {
      const { albumId } = await createCommunityAlbum(user.id, {
        title: song.trackName,
        artist: song.artistName,
        releaseYear: song.releaseYear ?? null,
        imageUrl: song.artworkUrl || null,
        tracks: [{ side: 'A', title: song.trackName }],
        source: 'APPLE_MUSIC',
        appleCollectionId: song.collectionId,
      });
      setPickedTrackIds((prev) => ({ ...prev, [song.trackId]: albumId }));
      onChange([
        ...value,
        { ALBUM_ID: albumId, TITLE: song.trackName, ARTIST: song.artistName, IMAGE_URL: song.artworkUrl || null },
      ]);
    } catch (e) {
      Alert.alert(t('common.error'), getErrorMessage(e, t));
    } finally {
      setResolvingTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(song.trackId);
        return next;
      });
    }
  };

  return (
    <>
      <TouchableOpacity style={[styles.pickerBtn, { borderColor: themeColors.border }]} onPress={() => setIsOpen(true)}>
        <Text style={{ color: themeColors.textPrimary, fontSize: 13 }}>
          {value.length > 0 ? t('communityBoard.songPickerSelectedCount', { count: value.length }) : t('communityBoard.songPickerCta')}
        </Text>
      </TouchableOpacity>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: themeColors.background, paddingTop: insets.top }}>
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <TouchableOpacity onPress={() => setIsOpen(false)} style={{ padding: 6 }}>
              <Feather name="chevron-down" size={22} color={themeColors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ color: themeColors.textPrimary, fontSize: 15, fontWeight: '700' }}>{t('communityBoard.songPickerCta')}</Text>
            <View style={{ width: 30 }} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('communityBoard.songPickerSearchPlaceholder')}
            placeholderTextColor={themeColors.textSecondary}
            style={[styles.input, { color: themeColors.textPrimary, borderColor: themeColors.border, margin: 16 }]}
          />
          {isSearching && <ActivityIndicator color={themeColors.accent} />}
          {!isSearching && !!query.trim() && results.length === 0 && (
            <Text style={{ color: themeColors.textSecondary, textAlign: 'center' }}>{t('communityBoard.songPickerEmpty')}</Text>
          )}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>
            {results.map((song) => {
              const selected = song.trackId in pickedTrackIds;
              const resolving = resolvingTrackIds.has(song.trackId);
              return (
                <TouchableOpacity
                  key={song.trackId}
                  style={[styles.row, resolving && { opacity: 0.5 }]}
                  onPress={() => toggle(song)}
                  disabled={resolving}
                >
                  <Image source={{ uri: song.artworkUrl || undefined }} style={styles.rowImg} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 13 }} numberOfLines={1}>{song.trackName}</Text>
                    <Text style={{ color: themeColors.textSecondary, fontSize: 11 }} numberOfLines={1}>{song.artistName}</Text>
                  </View>
                  <Feather name={selected ? 'check-circle' : 'circle'} size={18} color={selected ? themeColors.accent : themeColors.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: themeColors.accent }]} onPress={() => setIsOpen(false)}>
            <Text style={{ color: '#000', fontWeight: '700' }}>{t('communityBoard.songPickerDone')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  pickerBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowImg: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#000' },
  doneBtn: { margin: 16, padding: 12, borderRadius: 10, alignItems: 'center' },
});
