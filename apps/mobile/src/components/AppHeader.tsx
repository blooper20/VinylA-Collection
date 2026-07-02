import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@vinyla/ui';
import { Feather } from '@expo/vector-icons';

interface AppHeaderProps {
  mode?: 'collection' | 'wishlist';
}

export const AppHeader = ({ mode }: AppHeaderProps) => {
  const insets = useSafeAreaInsets();
  const { themeColors } = useTheme();
  const isWishlist = mode === 'wishlist';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.brandRow}>
        <Image
          source={require('../../assets/3d_logo_transparent.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>VinylA Collection</Text>
      </View>

      {mode && (
        <View style={[styles.modeBadge, { borderColor: 'rgba(212,175,55,0.35)', backgroundColor: 'rgba(212,175,55,0.06)' }]}>
          <Feather name={isWishlist ? 'heart' : 'disc'} size={11} color={themeColors.accent} />
          <Text style={[styles.modeText, { color: themeColors.accent }]}>
            {isWishlist ? 'WISHLIST' : 'MY COLLECTION'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 46,
    height: 46,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    marginLeft: 58,
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
