import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@vinyla/ui';

export const AppHeader = () => {
  const insets = useSafeAreaInsets();
  const { themeColors } = useTheme();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Image
        source={require('../../assets/3d_logo_transparent.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.title, { color: themeColors.textPrimary }]}>VinylA Collection</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 10,
  },
  logo: {
    width: 30,
    height: 30,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
