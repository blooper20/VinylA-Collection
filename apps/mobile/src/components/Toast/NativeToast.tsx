import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, StyleSheet } from 'react-native';
import { useTheme } from '@vinyla/ui';
import * as Haptics from 'expo-haptics';

interface NativeToastProps {
  message: string;
  visible: boolean;
  onHide?: () => void;
}

export const NativeToast: React.FC<NativeToastProps> = ({ message, visible, onHide }) => {
  const { themeColors } = useTheme();
  const styles = getStyles(themeColors);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.bezier(0.45, 0, 0.55, 1),
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            easing: Easing.bezier(0.45, 0, 0.55, 1),
            useNativeDriver: true,
          }).start(() => {
            if (onHide) onHide();
          });
        }, 2000);
      });
    }
  }, [visible, opacity, onHide]);

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const getStyles = (themeColors: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: themeColors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    zIndex: 999,
  },
  text: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
