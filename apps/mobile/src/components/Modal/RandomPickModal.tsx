import React from 'react';
import { View, Text, Modal, TouchableOpacity, Image, Animated, Easing, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
    revealAnim.setValue(0);
    spinAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    try {
      const [lastPlayedMap] = await Promise.all([
        user?.id ? getLastPlayedMap(user.id) : Promise.resolve({}),
        wait(MIN_REVEAL_MS),
      ]);
      setPicked(pickWeightedRandomAlbum(albums, lastPlayedMap));
      Animated.timing(revealAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
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
                {showResult ? (
                  <Animated.View style={{ opacity: revealAnim, transform: [{ scale: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>
                    {picked!.IMAGE_URL ? (
                      <Image source={{ uri: picked!.IMAGE_URL }} style={styles.cover} />
                    ) : (
                      <View style={[styles.cover, styles.coverFallback]}>
                        <Feather name="disc" size={64} color="rgba(233,195,73,0.5)" />
                      </View>
                    )}
                  </Animated.View>
                ) : (
                  <Animated.View style={[styles.cover, styles.coverFallback, { transform: [{ rotate }] }]}>
                    <Feather name="disc" size={64} color="rgba(233,195,73,0.5)" />
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
