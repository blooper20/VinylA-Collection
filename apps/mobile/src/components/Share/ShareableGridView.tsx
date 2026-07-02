import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { MockVinylData } from '@vinyla/shared-types';

interface ShareableGridViewProps {
  albums: MockVinylData[];
  mode: 'collection' | 'wishlist';
  username: string;
}

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const COLUMNS = 4;
const MAX_ITEMS = 24;
const GRID_PADDING = 40;
const CELL_GAP = 16;
const CELL_SIZE = (CANVAS_WIDTH - GRID_PADDING * 2 - CELL_GAP * (COLUMNS - 1)) / COLUMNS;

export const ShareableGridView = forwardRef<View, ShareableGridViewProps>(
  ({ albums, mode, username }, ref) => {
    const isWishlist = mode === 'wishlist';
    const items = albums.slice(0, MAX_ITEMS);
    const remaining = albums.length - items.length;

    return (
      <View ref={ref} collapsable={false} style={styles.canvas}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../../assets/3d_logo_transparent.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandText}>VinylA Collection</Text>
        </View>

        <Text style={styles.title}>{isWishlist ? 'WISHLIST' : 'MY COLLECTION'}</Text>
        <Text style={styles.subtitle}>@{username} · {albums.length}장</Text>

        <View style={styles.grid}>
          {items.map((item, index) => {
            const showMoreOverlay = remaining > 0 && index === items.length - 1;
            return (
              <View key={String(item.ALBUM_ID ?? index)} style={styles.cell}>
                <Image
                  source={
                    item.IMAGE_URL
                      ? { uri: item.IMAGE_URL }
                      : require('../../../assets/logo_real_transparent.png')
                  }
                  style={styles.cover}
                  resizeMode={item.IMAGE_URL ? 'cover' : 'contain'}
                />
                {showMoreOverlay && (
                  <View style={styles.moreOverlay}>
                    <Text style={styles.moreText}>+{remaining}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Text style={styles.footer}>VINYLA.APP</Text>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#0f0c0a',
    alignItems: 'center',
    paddingTop: 120,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 44,
  },
  brandLogo: {
    width: 40,
    height: 40,
  },
  brandText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
  },
  title: {
    color: '#E9C349',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 24,
    marginBottom: 48,
  },
  grid: {
    width: CANVAS_WIDTH - GRID_PADDING * 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1816',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
  },
  footer: {
    position: 'absolute',
    bottom: 64,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 18,
    letterSpacing: 4,
    fontWeight: '700',
  },
});
