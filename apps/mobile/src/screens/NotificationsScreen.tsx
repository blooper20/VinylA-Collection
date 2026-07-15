import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import {
  useAuthStore,
  getNotifications,
  markAllNotificationsRead,
  NotificationItem,
  NotificationType,
} from '@vinyla/core-api';

const PAGE_SIZE = 30;

const TYPE_ICON: Record<NotificationType, keyof typeof Feather.glyphMap> = {
  SPIN_LIKE: 'heart',
  SPIN_COMMENT: 'message-circle',
  SPIN_REPLY: 'corner-down-right',
  VINYL_LIKE: 'heart',
  VINYL_COMMENT: 'message-circle',
  VINYL_REPLY: 'corner-down-right',
  FOLLOW_REQUEST: 'user-plus',
  FOLLOW_ACCEPTED: 'user-check',
  NEW_FOLLOWER: 'user',
  NOTICE: 'radio',
};

// 알림함 — 웹 /notifications의 모바일 버전. 열람 시 전체 읽음 처리.
export const NotificationsScreen = () => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<any>>();
  const { user } = useAuthStore();

  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const rows = await getNotifications({ limit: PAGE_SIZE });
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
      markAllNotificationsRead();
    })();
  }, [user?.id]);

  const loadMore = async () => {
    if (!items || items.length === 0 || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const last = items[items.length - 1];
      const more = await getNotifications({ limit: PAGE_SIZE, before: last.CREATED_AT });
      setItems((prev) => [...(prev || []), ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  const relativeTime = (iso: string): string => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return t('feed.justNow');
    if (m < 60) return t('feed.minutesAgo', { m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('feed.hoursAgo', { h });
    return t('feed.daysAgo', { d: Math.floor(h / 24) });
  };

  const handlePress = (n: NotificationItem) => {
    if (n.TYPE === 'NOTICE') {
      if (n.NOTICE_ID) navigation.navigate('NoticeDetail', { noticeId: n.NOTICE_ID });
      return;
    }
    if (n.TYPE === 'FOLLOW_ACCEPTED' || n.TYPE === 'NEW_FOLLOWER') {
      if (n.ACTOR_ID) navigation.navigate('UserProfile', { userId: n.ACTOR_ID, name: n.ACTOR_NAME });
      return;
    }
    if (n.TYPE === 'FOLLOW_REQUEST') {
      // 요청 수락/거절은 마이 탭의 팔로우 목록에서
      navigation.navigate('Main', { screen: 'My' });
      return;
    }
    // 다이어리/수집 게시물 알림 → 소셜 탭
    navigation.navigate('Main', { screen: 'Social' });
  };

  const styles = getStyles(themeColors);

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Feather name="chevron-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>{t('notif.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {items === null ? (
        <ActivityIndicator color={themeColors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n.NOTIFICATION_ID)}
          ListEmptyComponent={<Text style={{ color: themeColors.textSecondary, textAlign: 'center', marginTop: 40 }}>{t('notif.empty')}</Text>}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={themeColors.accent} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item: n }) => {
            const name = n.TYPE === 'NOTICE' ? (n.NOTICE_TITLE || t('notif.noticeFallbackTitle')) : (n.ACTOR_NAME || t('notif.anonymous'));
            const TOKEN = '__NAME__';
            const [before = '', after = ''] = t(`notif.${n.TYPE}` as any, { name: TOKEN }).split(TOKEN);
            return (
              <TouchableOpacity
                onPress={() => handlePress(n)}
                style={[styles.item, { borderColor: themeColors.border }, !n.READ_AT && { backgroundColor: 'rgba(212,175,55,0.06)' }]}
              >
                <View style={[styles.iconWrap, { backgroundColor: 'rgba(212,175,55,0.12)' }]}>
                  <Feather name={TYPE_ICON[n.TYPE] || 'bell'} size={15} color={themeColors.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: themeColors.textPrimary, fontSize: 13, lineHeight: 19 }}>
                    {before}
                    <Text style={{ fontWeight: '700' }}>{name}</Text>
                    {after}
                  </Text>
                  {!!n.COMMENT_PREVIEW && (
                    <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 3 }} numberOfLines={2}>
                      “{n.COMMENT_PREVIEW}”
                    </Text>
                  )}
                </View>
                <Text style={{ color: themeColors.textSecondary, fontSize: 11, marginLeft: 8 }}>{relativeTime(n.CREATED_AT)}</Text>
                {!n.READ_AT && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          }}
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
    borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#d4af37', marginLeft: 8 },
});
