import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@vinyla/ui';
import { Feather } from '@expo/vector-icons';

export type VinylViewMode = 'grid' | 'table';

interface AppHeaderProps {
  mode?: 'collection' | 'wishlist';
  onSharePress?: () => void;
  viewMode?: VinylViewMode;
  onViewModeChange?: (mode: VinylViewMode) => void;
}

export const AppHeader = ({ mode, onSharePress, viewMode, onViewModeChange }: AppHeaderProps) => {
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
        <View style={styles.bottomRow}>
          <View style={styles.leftGroup}>
            <View style={[styles.modeBadge, { borderColor: 'rgba(212,175,55,0.35)', backgroundColor: 'rgba(212,175,55,0.06)' }]}>
              <Feather name={isWishlist ? 'heart' : 'disc'} size={11} color={themeColors.accent} />
              <Text style={[styles.modeText, { color: themeColors.accent }]}>
                {isWishlist ? 'WISHLIST' : 'MY COLLECTION'}
              </Text>
            </View>

            {onSharePress && (
              <TouchableOpacity
                style={[styles.iconBtn, { borderColor: themeColors.border }]}
                onPress={onSharePress}
              >
                <Feather name="share-2" size={13} color={themeColors.textPrimary} />
              </TouchableOpacity>
            )}
          </View>

          {viewMode && onViewModeChange && (
            <View style={[styles.viewToggle, { borderColor: themeColors.border }]}>
              <TouchableOpacity
                style={[styles.viewToggleBtn, viewMode === 'grid' && { backgroundColor: 'rgba(212,175,55,0.15)' }]}
                onPress={() => onViewModeChange('grid')}
              >
                <Feather name="grid" size={13} color={viewMode === 'grid' ? themeColors.accent : themeColors.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.viewToggleDivider, { backgroundColor: themeColors.border }]} />
              <TouchableOpacity
                style={[styles.viewToggleBtn, viewMode === 'table' && { backgroundColor: 'rgba(212,175,55,0.15)' }]}
                onPress={() => onViewModeChange('table')}
              >
                <Feather name="list" size={13} color={viewMode === 'table' ? themeColors.accent : themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
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
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginLeft: 58,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
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
  iconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  viewToggleBtn: {
    width: 28,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleDivider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
  },
});
