import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@vinyla/ui';
import * as Haptics from 'expo-haptics';
import { TAB_BAR_HEIGHT } from '../../constants/layout';

interface NativeToastProps {
  message: string;
  visible: boolean;
  onHide?: () => void;
}

export const NativeToast: React.FC<NativeToastProps> = ({ message, visible, onHide }) => {
  const { themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(themeColors, TAB_BAR_HEIGHT + insets.bottom + 20);
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

const getStyles = (themeColors: any, bottomOffset: number) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: bottomOffset,
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
