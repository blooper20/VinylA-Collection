import React from 'react';
import { View, Text, Modal, TouchableOpacity, Image, Animated, Easing, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore, getLastPlayedMap, pickWeightedRandomAlbum } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { MockVinylData } from '@vinyla/shared-types';

// "오늘 뭐 듣지?" — 웹 RandomPickModal 파리티. 보관함의 OWNED 앨범 중 오래
// 안 들은(또는 한 번도 기록되지 않은) 앨범에 가중치를 준 랜덤 픽. 결과에서
// "이 앨범으로 다이어리 쓰기"를 누르면 DetailModal을 열어 스피닝 다이어리
// 작성 흐름으로 이어준다.

// 뽑는 연출이 너무 순식간에 끝나지 않도록 최소 대기 시간을 둔다 — 실제
// getLastPlayedMap 조회와 병렬로 흘러가므로 체감상 추가 지연은 거의 없다.
const MIN_REVEAL_MS = 700;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface RandomPickModalProps {
  visible: boolean;
  albums: MockVinylData[];
  onClose: () => void;
  onOpenAlbum: (album: MockVinylData) => void;
}

export const RandomPickModal = ({ visible, albums, onClose, onOpenAlbum }: RandomPickModalProps) => {
  const { user } = useAuthStore();
  const { t } = useLocale();
  const [picked, setPicked] = React.useState<MockVinylData | null>(null);
  const [isRevealing, setIsRevealing] = React.useState(false);
  const spinAnim = React.useRef(new Animated.Value(0)).current;
  const revealAnim = React.useRef(new Animated.Value(0)).current;

  const runPick = React.useCallback(async () => {
    if (albums.length === 0) return;
    setPicked(null);
    setIsRevealing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    revealAnim.setValue(0);
    spinAnim.setValue(0);
    // 턴테이블이 도는 듯한 등속 회전 — 빠른 팽이 회전 대신 33RPM 느낌으로 느긋하게
    const loop = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    try {
      const [lastPlayedMap] = await Promise.all([
        user?.id ? getLastPlayedMap(user.id) : Promise.resolve({}),
        wait(MIN_REVEAL_MS),
      ]);
      setPicked(pickWeightedRandomAlbum(albums, lastPlayedMap));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // 디스크가 잦아들며 커버가 스프링으로 떠오르는 크로스페이드
      Animated.spring(revealAnim, { toValue: 1, friction: 8, tension: 50, useNativeDriver: true }).start();
    } finally {
      loop.stop();
      setIsRevealing(false);
    }
  }, [albums, user?.id, revealAnim, spinAnim]);

  React.useEffect(() => {
    if (visible) runPick();
    // 모달이 열리면 바로 한 번 뽑는다 (웹과 동일한 마운트 시 자동 실행)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const rotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const showResult = !!picked && !isRevealing;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel={t('common.cancel')}>
            <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <Text style={styles.eyebrow}>{t('randomPick.eyebrow')}</Text>
          <Text style={styles.title}>{t('randomPick.title')}</Text>

          {albums.length === 0 ? (
            <Text style={styles.emptyText}>{t('randomPick.empty')}</Text>
          ) : (
            <>
              <View style={styles.stage}>
                {/* 뽑는 동안: LP 디스크가 턴테이블처럼 회전 */}
                <Animated.View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: revealAnim.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp' }),
                      transform: [{ scale: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }],
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Animated.View style={[styles.vinylDisc, { transform: [{ rotate }] }]}>
                    <View style={[styles.vinylGroove, { width: '86%', height: '86%' }]} />
                    <View style={[styles.vinylGroove, { width: '72%', height: '72%' }]} />
                    <View style={[styles.vinylGroove, { width: '58%', height: '58%' }]} />
                    <View style={styles.vinylSheen} />
                    <View style={styles.vinylLabel}>
                      <Text style={styles.vinylLabelText}>VINYLA</Text>
                      <View style={styles.vinylHole} />
                    </View>
                  </Animated.View>
                </Animated.View>

                {/* 결과: 커버가 은은한 금빛 글로우와 함께 스프링으로 떠오른다 */}
                {picked && (
                  <Animated.View
                    style={[
                      styles.coverGlow,
                      {
                        opacity: revealAnim,
                        transform: [
                          { scale: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
                          { translateY: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                        ],
                      },
                    ]}
                  >
                    {picked.IMAGE_URL ? (
                      <Image source={{ uri: picked.IMAGE_URL }} style={styles.cover} />
                    ) : (
                      <View style={[styles.cover, styles.coverFallback]}>
                        <Feather name="disc" size={64} color="rgba(233,195,73,0.5)" />
                      </View>
                    )}
                  </Animated.View>
                )}
              </View>

              {showResult && (
                <View style={{ alignItems: 'center', marginTop: 16 }}>
                  <Text style={styles.resultArtist} numberOfLines={1}>{picked!.ARTIST}</Text>
                  <Text style={styles.resultTitle} numberOfLines={2}>{picked!.TITLE}</Text>
                </View>
              )}

              <View style={{ marginTop: 20, gap: 10, width: '100%' }}>
                {showResult && (
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => { onOpenAlbum(picked!); onClose(); }}>
                    <Text style={styles.primaryBtnText}>{t('randomPick.openCta')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.secondaryBtn} onPress={runPick} disabled={isRevealing}>
                  <Text style={styles.secondaryBtnText}>
                    {isRevealing ? t('randomPick.revealing') : t('randomPick.tryAgain')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 28,
  },
  modal: {
    backgroundColor: '#1a1814',
    borderRadius: 20,
    padding: 24,
    paddingTop: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
  },
  eyebrow: {
    color: '#e9c349',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 20,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  stage: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylDisc: {
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: '#0d0c0a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  vinylGroove: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  vinylSheen: {
    position: 'absolute',
    top: 10,
    left: 24,
    width: 44,
    height: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    transform: [{ rotate: '-32deg' }],
  },
  vinylLabel: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(233,195,73,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.6)',
  },
  vinylLabelText: {
    color: '#1a1814',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  vinylHole: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0d0c0a',
  },
  coverGlow: {
    borderRadius: 14,
    shadowColor: '#e9c349',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 10,
    backgroundColor: '#1a1814',
  },
  cover: {
    width: 180,
    height: 180,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(233,195,73,0.25)',
  },
  resultArtist: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  primaryBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#e9c349',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#1a1814',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    fontSize: 15,
  },
});
