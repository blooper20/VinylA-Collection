import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

interface FlashEffectProps {
  visible: boolean;
  onComplete?: () => void;
}

export const FlashEffect: React.FC<FlashEffectProps> = ({ visible, onComplete }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 50, // 0.05s
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 50, // 0.05s, total 0.1s
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (onComplete) onComplete();
      });
    }
  }, [visible, opacity, onComplete]);

  return (
    <Animated.View style={[styles.flash, { opacity }]} pointerEvents="none" />
  );
};

const styles = StyleSheet.create({
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    zIndex: 9999,
  },
});
