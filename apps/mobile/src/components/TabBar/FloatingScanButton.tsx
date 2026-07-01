import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useTheme, shadows } from '@vinyla/ui';

export const FloatingScanButton = ({ onPress }: { onPress?: () => void }) => {
  const { themeColors } = useTheme();
  const styles = getStyles(themeColors, shadows);
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={onPress}>
        <Image 
          source={require('../../../assets/3d_logo.jpg')}
          style={styles.logoImage}
        />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (themeColors: any, shadows: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: themeColors.background,
    ...shadows.glow,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: themeColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
  },
  logoImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  }
});
