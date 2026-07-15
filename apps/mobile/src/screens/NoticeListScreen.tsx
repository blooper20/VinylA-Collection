import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { getPinnedNotices, getNotices } from '@vinyla/core-api';
import type { NOTICE } from '@vinyla/shared-types';

const PAGE_SIZE = 20;

// 공지사항 목록 — 웹 /notices의 모바일 버전. 상단 고정(최대 5개) + 최신순
// 페이지네이션. 작성/수정/삭제는 관리자 전용(웹 관리자 페이지에서만).
export const NoticeListScreen = () => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<any>>();

  const [pinned, setPinned] = useState<NOTICE[]>([]);
  const [items, setItems] = useState<NOTICE[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    (async () => {
      const [pinnedRows, rows] = await Promise.all([
        getPinnedNotices().catch(() => []),
        getNotices({ limit: PAGE_SIZE }).catch(() => []),
      ]);
      setPinned(pinnedRows);
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
    })();
  }, []);

  const loadMore = async () => {
    if (!items || items.length === 0 || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const last = items[items.length - 1];
      const more = await getNotices({ limit: PAGE_SIZE, beforeCreatedAt: last.CREATED_AT });
      setItems((prev) => [...(prev || []), ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  const styles = getStyles(themeColors);

  const renderItem = (n: NOTICE, isPinned: boolean) => {
    const thumb = n.MEDIA_ITEMS?.find((m) => m.type === 'image');
    return (
      <TouchableOpacity
        key={n.NOTICE_ID}
        style={[styles.item, { borderColor: isPinned ? 'rgba(212,175,55,0.35)' : themeColors.border }]}
        onPress={() => navigation.navigate('NoticeDetail', { noticeId: n.NOTICE_ID })}
      >
        {thumb ? (
          <Image source={{ uri: thumb.url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            {isPinned && (
              <View style={[styles.pinBadge, { backgroundColor: 'rgba(212,175,55,0.15)' }]}>
                <Text style={{ color: themeColors.accent, fontSize: 10, fontWeight: '700' }}>{t('notice.pinned')}</Text>
              </View>
            )}
            <Text style={{ color: themeColors.textPrimary, fontSize: 14, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>{n.TITLE}</Text>
          </View>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 4 }}>{new Date(n.CREATED_AT).toLocaleDateString()}</Text>
        </View>
      </TouchableOpacity>
    );
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

      {items === null ? (
        <ActivityIndicator color={themeColors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n.NOTICE_ID)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            pinned.length > 0 ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 10 }}>{t('notice.pinnedSection')}</Text>
                {pinned.map((n) => renderItem(n, true))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            pinned.length === 0 ? <Text style={{ color: themeColors.textSecondary, textAlign: 'center', marginTop: 40 }}>{t('notice.empty')}</Text> : null
          }
          renderItem={({ item }) => renderItem(item, false)}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={themeColors.accent} style={{ marginVertical: 16 }} /> : null}
        />
      )}
    </View>
  );
};

const getStyles = (themeColors: any) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  item: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10,
  },
  thumb: { width: 52, height: 52, borderRadius: 8 },
  pinBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, marginRight: 6 },
});
