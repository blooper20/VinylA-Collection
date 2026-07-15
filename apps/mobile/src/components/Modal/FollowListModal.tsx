import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import {
  useAuthStore,
  getFollowList,
  FollowListEntry,
  getIncomingFollowRequests,
  FollowRequestEntry,
  acceptFollowRequest,
  rejectFollowRequest,
} from '@vinyla/core-api';

type TabKey = 'followers' | 'following' | 'requests';

interface FollowListModalProps {
  isVisible: boolean;
  onClose: () => void;
  userId: string;
  initialTab?: TabKey;
  /** 요청 수락/거절 후 카운트 갱신용 */
  onChanged?: () => void;
  /** 목록에서 유저 탭 시 (모달 닫힌 뒤 프로필로 이동) */
  onPressUser?: (userId: string, name: string | null) => void;
}

// 팔로워/팔로잉/요청 목록 바텀시트 — 웹 FollowListModal의 모바일 버전.
// 요청 탭은 본인 것일 때만 노출(수락/거절).
export const FollowListModal: React.FC<FollowListModalProps> = ({ isVisible, onClose, userId, initialTab = 'followers', onChanged, onPressUser }) => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const isMe = user?.id === userId;

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [followers, setFollowers] = useState<FollowListEntry[] | null>(null);
  const [following, setFollowing] = useState<FollowListEntry[] | null>(null);
  const [requests, setRequests] = useState<FollowRequestEntry[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisible) return;
    setTab(initialTab);
    getFollowList(userId, 'followers').then(setFollowers);
    getFollowList(userId, 'following').then(setFollowing);
    if (isMe) getIncomingFollowRequests().then(setRequests);
  }, [isVisible, userId, isMe, initialTab]);

  const handleAccept = async (requesterId: string) => {
    if (busyId) return;
    setBusyId(requesterId);
    try {
      await acceptFollowRequest(requesterId);
      setRequests((prev) => (prev || []).filter((r) => r.USER_ID !== requesterId));
      getFollowList(userId, 'followers').then(setFollowers);
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (requesterId: string) => {
    if (busyId) return;
    setBusyId(requesterId);
    try {
      await rejectFollowRequest(requesterId);
      setRequests((prev) => (prev || []).filter((r) => r.USER_ID !== requesterId));
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'followers', label: t('publicGrid.followers') },
    { key: 'following', label: t('publicGrid.following') },
    ...(isMe ? [{ key: 'requests' as TabKey, label: t('publicGrid.requestsTab'), count: requests?.length || 0 }] : []),
  ];

  const activeList = tab === 'followers' ? followers : tab === 'following' ? following : requests;

  return (
    <Modal visible={isVisible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} style={{ backgroundColor: themeColors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingBottom: insets.bottom + 8 }}>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: themeColors.border }}>
            {tabs.map((tb) => (
              <TouchableOpacity key={tb.key} onPress={() => setTab(tb.key)} style={{ paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: tab === tb.key ? 2 : 0, borderBottomColor: themeColors.accent }}>
                <Text style={{ color: tab === tb.key ? themeColors.textPrimary : themeColors.textSecondary, fontWeight: '600', fontSize: 14 }}>
                  {tb.label}{tb.count ? ` ${tb.count}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={onClose} style={{ marginLeft: 'auto', padding: 14 }}>
              <Text style={{ color: themeColors.textSecondary, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {activeList === null ? (
            <ActivityIndicator color={themeColors.accent} style={{ marginVertical: 30 }} />
          ) : activeList.length === 0 ? (
            <Text style={{ color: themeColors.textSecondary, textAlign: 'center', paddingVertical: 30 }}>{t('publicGrid.followListEmpty')}</Text>
          ) : (
            <FlatList
              data={activeList as (FollowListEntry | FollowRequestEntry)[]}
              keyExtractor={(e) => e.USER_ID}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    onPress={() => { onClose(); onPressUser?.(item.USER_ID, item.DISPLAY_NAME); }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(212,175,55,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: themeColors.accent, fontWeight: '700' }}>
                        {(item.DISPLAY_NAME || '?').slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 14, fontWeight: '600', marginLeft: 12, flex: 1 }} numberOfLines={1}>
                      {item.DISPLAY_NAME || t('feed.anonymous')}
                    </Text>
                  </TouchableOpacity>
                  {tab === 'requests' && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        disabled={busyId === item.USER_ID}
                        onPress={() => handleAccept(item.USER_ID)}
                        style={{ backgroundColor: themeColors.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 }}
                      >
                        <Text style={{ color: '#1a1814', fontSize: 12, fontWeight: '700' }}>{t('publicGrid.accept')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={busyId === item.USER_ID}
                        onPress={() => handleReject(item.USER_ID)}
                        style={{ borderWidth: 1, borderColor: themeColors.border, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 }}
                      >
                        <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700' }}>{t('publicGrid.reject')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};
