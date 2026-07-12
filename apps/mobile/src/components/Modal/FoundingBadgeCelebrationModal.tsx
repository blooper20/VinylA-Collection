import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';

interface FoundingBadgeCelebrationModalProps {
  visible: boolean;
  onClose: () => void;
  signupNumber: number | null;
}

const HOLO_COLORS = ['#ff6ec4', '#ffd76e', '#6effe0', '#6e9fff', '#d76eff'] as const;
const PARTICLE_ANGLES = Array.from({ length: 16 }, (_, i) => (i * 360) / 16);

export const FoundingBadgeCelebrationModal: React.FC<FoundingBadgeCelebrationModalProps> = ({ visible, onClose, signupNumber }) => {
  const { glassIntensity } = useTheme();
  const { t } = useLocale();

  const cardScale = useRef(new Animated.Value(0.6)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const holoAnim = useRef(new Animated.Value(0)).current;
  const particleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    cardScale.setValue(0.6);
    cardOpacity.setValue(0);
    particleAnim.setValue(0);

    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 60 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(particleAnim, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, { toValue: 1.15, duration: 1250, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(glowScale, { toValue: 1, duration: 1250, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(holoAnim, { toValue: 1, duration: 3000, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, [visible, cardScale, cardOpacity, glowScale, holoAnim, particleAnim]);

  const holoShimmerTranslate = holoAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 100] });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <Animated.View style={[styles.glow, { transform: [{ scale: glowScale }] }]} pointerEvents="none" />

        {PARTICLE_ANGLES.map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const translateX = particleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * 160] });
          const translateY = particleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * 160] });
          const particleOpacity = particleAnim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] });
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.particle,
                {
                  backgroundColor: HOLO_COLORS[i % HOLO_COLORS.length],
                  opacity: particleOpacity,
                  transform: [{ translateX }, { translateY }],
                },
              ]}
            />
          );
        })}

        <Animated.View style={[styles.cardWrapper, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
          <BlurView intensity={glassIntensity || 40} tint="dark" style={styles.card}>
            <View style={styles.iconWrapper}>
              <LinearGradient colors={HOLO_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Animated.View style={[styles.iconShimmer, { transform: [{ translateX: holoShimmerTranslate }] }]}>
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.6)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <FontAwesome5 name="award" size={40} color="#fff" />
            </View>

            <Text style={styles.title}>{t('founding.celebrationTitle')}</Text>
            <Text style={styles.body}>{t('founding.celebrationBody', { number: signupNumber ?? '' })}</Text>

            <TouchableOpacity style={styles.confirmBtn} onPress={onClose}>
              <Text style={styles.confirmBtnText}>{t('founding.confirmButton')}</Text>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(255, 215, 110, 0.25)',
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardWrapper: {
    width: '86%',
    maxWidth: 360,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 110, 0.4)',
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 16, 14, 0.85)',
  },
  iconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  iconShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 36,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 26,
  },
  confirmBtn: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 12,
    backgroundColor: '#ffd76e',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000',
  },
});
