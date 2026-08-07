import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ActivityIndicator, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { useAuthStore, searchMyAlbumsForPicker, PickerAlbumRow } from '@vinyla/core-api';

export interface PickedAlbum { ALBUM_ID: number; TITLE: string; ARTIST: string; IMAGE_URL: string | null }

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

// "오늘 온 전리품" 계열 글쓰기/수정 화면에서 내 컬렉션 앨범을 다중 선택하는
// 피커 — 글쓰기(CommunityNewPostScreen)와 수정(CommunityPostEditScreen)이
// 똑같은 것을 쓰므로 여기 하나로 뺐다(웹 AlbumMultiSelectPicker.tsx와 동일 역할).
//
// 컬렉션 전체를 한 번에 불러와 클라이언트에서 필터링하던 이전 버전은 컬렉션이
// 수백 장 이상인 유저에게 느렸다 — 검색어/상태를 서버(searchMyAlbumsForPicker)
// 에서 걸러 페이지 단위로만 가져오도록 바꿨다.
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
  const [items, setItems] = useState<PickerAlbumRow[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // 검색어가 바뀌는 동안(디바운스) 들어온 느린 이전 응답이 최신 검색 결과를
  // 덮어쓰지 않도록 요청마다 번호를 매긴다.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    searchMyAlbumsForPicker({ userId: user.id, source, query: debouncedQuery, limit: PAGE_SIZE })
      .then((rows) => {
        if (requestIdRef.current !== requestId) return;
        setItems(dedupe(rows));
        setHasMore(rows.length === PAGE_SIZE);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsLoading(false);
      });
  }, [isOpen, user?.id, source, debouncedQuery]);

  const dedupe = (rows: PickerAlbumRow[]): PickerAlbumRow[] => {
    // 같은 앨범을 owned/wish 둘 다로(또는 "또 등록"으로 같은 상태에 중복) 갖고
    // 있을 수 있어 상태별로 따로 중복 제거한다.
    const seen = new Set<string>();
    return rows.filter((r) => {
      const key = `${r.STATUS}:${r.ALBUM_ID}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const open = () => setIsOpen(true);

  const loadMore = () => {
    if (!user?.id || isLoading || isLoadingMore || !hasMore) return;
    const requestId = requestIdRef.current;
    setIsLoadingMore(true);
    searchMyAlbumsForPicker({ userId: user.id, source, query: debouncedQuery, limit: PAGE_SIZE, offset: items.length })
      .then((rows) => {
        if (requestIdRef.current !== requestId) return;
        setItems((prev) => dedupe([...prev, ...rows]));
        setHasMore(rows.length === PAGE_SIZE);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsLoadingMore(false);
      });
  };

  const toggle = (a: PickerAlbumRow) => {
    onChange(value.some((v) => v.ALBUM_ID === a.ALBUM_ID) ? value.filter((v) => v.ALBUM_ID !== a.ALBUM_ID) : [...value, a]);
  };

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
          {!isLoading && items.length === 0 && (
            <Text style={{ color: themeColors.textSecondary, textAlign: 'center' }}>{t('communityBoard.albumPickerEmpty')}</Text>
          )}
          {!isLoading && (
            <FlatList
              data={items}
              keyExtractor={(a) => `${a.STATUS}:${a.ALBUM_ID}`}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
              onEndReachedThreshold={0.4}
              onEndReached={loadMore}
              ListFooterComponent={isLoadingMore ? <ActivityIndicator color={themeColors.accent} style={{ marginVertical: 12 }} /> : null}
              renderItem={({ item: a }) => {
                const selected = value.some((v) => v.ALBUM_ID === a.ALBUM_ID);
                return (
                  <TouchableOpacity style={styles.row} onPress={() => toggle(a)}>
                    <Image source={{ uri: a.IMAGE_URL || undefined }} style={styles.rowImg} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: themeColors.textPrimary, fontSize: 13 }} numberOfLines={1}>{a.TITLE}</Text>
                      <Text style={{ color: themeColors.textSecondary, fontSize: 11 }} numberOfLines={1}>{a.ARTIST}</Text>
                    </View>
                    <Feather name={selected ? 'check-circle' : 'circle'} size={18} color={selected ? themeColors.accent : themeColors.textSecondary} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
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
