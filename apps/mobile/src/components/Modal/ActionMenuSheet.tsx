import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color?: string; // Optional custom color (e.g., for destructive actions like delete)
  isProcessing?: boolean;
  onPress: () => void;
}

interface ActionMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  options: ActionMenuItem[];
  bottomInset?: number;
}

// Deliberately not wrapped in RN's <Modal> — this can be nested inside other
// full-screen <Modal> screens (e.g. DetailModal/SpinSocialModal)
export const ActionMenuSheet = ({
  visible,
  onClose,
  options,
  bottomInset = 0,
}: ActionMenuSheetProps) => {
  const { themeColors, glassIntensity } = useTheme();
  const translateY = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 300, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setRendered(false));
    }
  }, [visible]);

  if (!rendered) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateY }], marginBottom: bottomInset }}>
        <BlurView
          intensity={glassIntensity || 30}
          tint="dark"
          style={[styles.content, { backgroundColor: 'rgba(20,20,20,0.7)', borderColor: themeColors.border }]}
        >
          <View style={[styles.handle, { backgroundColor: themeColors.border }]} />

          {options.map((opt) => {
            const itemColor = opt.color || themeColors.textPrimary;
            return (
              <TouchableOpacity
                key={opt.id}
                style={styles.row}
                onPress={() => {
                  opt.onPress();
                  onClose();
                }}
                disabled={opt.isProcessing}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrapper, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                  <Feather name={opt.icon} size={18} color={itemColor} />
                </View>
                <Text style={[styles.rowLabel, { color: itemColor }]}>{opt.label}</Text>
                {opt.isProcessing ? (
                  <ActivityIndicator size="small" color={themeColors.textSecondary} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </BlurView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});
