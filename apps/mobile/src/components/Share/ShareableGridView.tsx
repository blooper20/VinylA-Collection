import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { EditionCoverArt } from '../Edition/EditionCoverArt';
import { MockVinylData } from '@vinyla/shared-types';

interface ShareableGridViewProps {
  albums: MockVinylData[];
  mode: 'collection' | 'wishlist';
  username: string;
}

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const COLUMNS = 4;
// 공유 버튼 핸들러가 캡처 전에 이 개수만큼만 미리 로드(prefetch)하면 되므로 export한다.
export const MAX_ITEMS = 24;
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
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <Image
              source={require('../../../assets/3d_logo_transparent.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={styles.brandText}>VinylA Collection</Text>
          </View>

          <Text style={styles.title}>{isWishlist ? 'WISHLIST' : 'MY COLLECTION'}</Text>
          <Text style={styles.subtitle}>@{username}{isWishlist ? "'s WishList" : "'s Collection"}</Text>

          <View style={styles.grid}>
            {items.map((item, index) => {
              const showMoreOverlay = remaining > 0 && index === items.length - 1;
              return (
                <View key={String(item.USER_VINYL_ID ?? item.ALBUM_ID ?? index)} style={styles.cell}>
                  <Image
                    source={
                      item.IMAGE_URL
                        ? { uri: item.IMAGE_URL }
                        : require('../../../assets/logo_real_transparent.png')
                    }
                    style={styles.cover}
                    resizeMode={item.IMAGE_URL ? 'cover' : 'contain'}
                  />
                  {/* 한정반/사인반 표시도 공유 이미지에 함께 나간다 — 보관함 화면과
                      같은 컴포넌트를 써서 두 곳의 모양이 어긋나지 않게 한다 */}
                  <EditionCoverArt album={item} />
                  {showMoreOverlay && (
                    <View style={styles.moreOverlay}>
                      <Text style={styles.moreText}>+{remaining}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Watermark — matches web's ShareableGridTemplate footer */}
        <View style={styles.footer}>
          <Image
            source={require('../../../assets/logo_real_transparent.png')}
            style={styles.footerLogo}
            resizeMode="contain"
          />
          <Text style={styles.footerText} numberOfLines={1}>Curated by VinylA Collection</Text>
        </View>
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
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    width: CANVAS_WIDTH - GRID_PADDING * 2,
    paddingTop: 34,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  footerLogo: {
    width: 30,
    height: 30,
  },
  footerText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 22,
    fontStyle: 'italic',
    letterSpacing: 1,
  },
});
