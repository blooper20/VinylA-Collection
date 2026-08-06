import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { useAuthStore, getUserVinyls } from '@vinyla/core-api';

export interface PickedAlbum { ALBUM_ID: number; TITLE: string; ARTIST: string; IMAGE_URL: string | null }
interface PickedAlbumWithStatus extends PickedAlbum { STATUS: 'OWNED' | 'WISH' }

// "오늘 온 전리품" 계열 글쓰기/수정 화면에서 내 컬렉션 앨범을 다중 선택하는
// 피커 — 글쓰기(CommunityNewPostScreen)와 수정(CommunityPostEditScreen)이
// 똑같은 것을 쓰므로 여기 하나로 뺐다(웹 AlbumMultiSelectPicker.tsx와 동일 역할).
export const AlbumMultiSelectPicker: React.FC<{
  value: PickedAlbum[];
  onChange: (next: PickedAlbum[]) => void;
  /** 'owned'=컬렉션(보유만), 'wish'=위시리스트(위시만), 'both'=오온음(기본, 둘 다) */
  source?: 'owned' | 'wish' | 'both';
}> = ({ value, onChange, source = 'both' }) => {
  const insets = useSafeAreaInsets();
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const { user } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [allAlbums, setAllAlbums] = useState<PickedAlbumWithStatus[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const open = () => {
    setIsOpen(true);
    if (!user?.id || hasLoaded) return;
    setIsLoading(true);
    getUserVinyls(user.id)
      .then((rows: any[]) => {
        const list: PickedAlbumWithStatus[] = rows
          .filter((r) => r.ALBUM_MASTER && (r.STATUS === 'OWNED' || r.STATUS === 'WISH'))
          .map((r) => ({
            ALBUM_ID: r.ALBUM_MASTER.ALBUM_ID,
            TITLE: r.ALBUM_MASTER.TITLE,
            ARTIST: r.ALBUM_MASTER.ARTIST,
            IMAGE_URL: r.ALBUM_MASTER.IMAGE_URL || null,
            STATUS: r.STATUS,
          }));
        // 같은 앨범을 owned/wish 둘 다로 갖고 있을 수 있어 상태별로 따로 중복 제거한다.
        const seenOwned = new Set<number>();
        const seenWish = new Set<number>();
        setAllAlbums(list.filter((a) => {
          const seen = a.STATUS === 'OWNED' ? seenOwned : seenWish;
          if (seen.has(a.ALBUM_ID)) return false;
          seen.add(a.ALBUM_ID);
          return true;
        }));
        setHasLoaded(true);
      })
      .finally(() => setIsLoading(false));
  };

  const toggle = (a: PickedAlbum) => {
    onChange(value.some((v) => v.ALBUM_ID === a.ALBUM_ID) ? value.filter((v) => v.ALBUM_ID !== a.ALBUM_ID) : [...value, a]);
  };

  const filtered = allAlbums.filter((a) => {
    if (source === 'owned' && a.STATUS !== 'OWNED') return false;
    if (source === 'wish' && a.STATUS !== 'WISH') return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return a.TITLE.toLowerCase().includes(q) || a.ARTIST.toLowerCase().includes(q);
  });

  return (
    <>
      <TouchableOpacity style={[styles.pickerBtn, { borderColor: themeColors.border }]} onPress={open}>
        <Text style={{ color: themeColors.textPrimary, fontSize: 13 }}>
          {value.length > 0 ? t('communityBoard.albumPickerSelectedCount', { count: value.length }) : t('communityBoard.albumPickerCta')}
        </Text>
      </TouchableOpacity>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: themeColors.background, paddingTop: insets.top }}>
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <TouchableOpacity onPress={() => setIsOpen(false)} style={{ padding: 6 }}>
              <Feather name="chevron-down" size={22} color={themeColors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ color: themeColors.textPrimary, fontSize: 15, fontWeight: '700' }}>{t('communityBoard.albumPickerCta')}</Text>
            <View style={{ width: 30 }} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('communityBoard.albumPickerSearchPlaceholder')}
            placeholderTextColor={themeColors.textSecondary}
            style={[styles.input, { color: themeColors.textPrimary, borderColor: themeColors.border, margin: 16 }]}
          />
          {isLoading && <ActivityIndicator color={themeColors.accent} />}
          {!isLoading && filtered.length === 0 && (
            <Text style={{ color: themeColors.textSecondary, textAlign: 'center' }}>{t('communityBoard.albumPickerEmpty')}</Text>
          )}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>
            {filtered.map((a) => {
              const selected = value.some((v) => v.ALBUM_ID === a.ALBUM_ID);
              return (
                <TouchableOpacity key={a.ALBUM_ID} style={styles.row} onPress={() => toggle(a)}>
                  <Image source={{ uri: a.IMAGE_URL || undefined }} style={styles.rowImg} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 13 }} numberOfLines={1}>{a.TITLE}</Text>
                    <Text style={{ color: themeColors.textSecondary, fontSize: 11 }} numberOfLines={1}>{a.ARTIST}</Text>
                  </View>
                  <Feather name={selected ? 'check-circle' : 'circle'} size={18} color={selected ? themeColors.accent : themeColors.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: themeColors.accent }]} onPress={() => setIsOpen(false)}>
            <Text style={{ color: '#000', fontWeight: '700' }}>{t('communityBoard.albumPickerDone')}</Text>
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
