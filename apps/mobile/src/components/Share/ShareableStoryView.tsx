import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MockVinylData } from '@vinyla/shared-types';

interface ShareableStoryViewProps {
  album: MockVinylData;
  username: string;
  overrideStatus?: string;
}

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const COVER_SIZE = 720;

const STATUS_NEON: Record<string, { label: string; color: string }> = {
  OWNED: { label: 'COLLECTED', color: '#ffd76a' },
  NONE: { label: 'JUST DROPPED', color: '#ff8bdc' },
  NEW: { label: 'NEW', color: '#6eff8b' },
};

export const ShareableStoryView = forwardRef<View, ShareableStoryViewProps>(
  ({ album, username, overrideStatus }, ref) => {
    const bgColor = album.CUSTOM_COLOR_HEX || '#2a2a2a';
    const status = overrideStatus || album.STATUS;
    const isWanted = status === 'WISH';
    const neon = STATUS_NEON[status as string] || STATUS_NEON.NONE;

    return (
      <View ref={ref} collapsable={false} style={styles.canvas}>
        <LinearGradient
          colors={[`${bgColor}66`, '#0a0a0a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {isWanted ? (
          <View style={styles.posterBadge}>
            <LinearGradient
              colors={['#f3e3bd', '#e6cf9b', '#dcc088']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={[styles.posterText, { marginRight: -6 }]} numberOfLines={1}>
              ★ WANTED ★
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.statusBadge,
              { borderColor: neon.color, backgroundColor: 'rgba(10,8,8,0.35)' },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: neon.color, textShadowColor: neon.color, marginRight: -5 },
              ]}
              numberOfLines={1}
            >
              {neon.label}
            </Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.coverShadowWrap}>
            <Image
              source={
                album.IMAGE_URL
                  ? { uri: album.IMAGE_URL }
                  : require('../../../assets/logo_real_transparent.png')
              }
              style={styles.cover}
              resizeMode={album.IMAGE_URL ? 'cover' : 'contain'}
            />
          </View>
          <Text style={styles.title} numberOfLines={2}>{album.TITLE}</Text>
          <Text style={styles.artist} numberOfLines={1}>{album.ARTIST}</Text>
        </View>

        <View style={styles.watermark}>
          <Text style={styles.user} numberOfLines={1}>@{username}</Text>
          <View style={styles.brandRow}>
            <Image
              source={require('../../../assets/logo_real_transparent.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={styles.brandText} numberOfLines={1}>Curated by VinylA Collection</Text>
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  statusText: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 5,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  // WISH: styled like an Old-West bounty poster instead of a neon sign
  posterBadge: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#3a2410',
    borderRadius: 6,
    paddingHorizontal: 36,
    paddingVertical: 14,
    overflow: 'hidden',
    transform: [{ rotate: '-2.5deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  posterText: {
    color: '#241505',
    fontFamily: 'Georgia',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 80,
  },
  coverShadowWrap: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1816',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 56,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  title: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  artist: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 30,
    textAlign: 'center',
  },
  watermark: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 60,
  },
  user: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 18,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandLogo: {
    width: 28,
    height: 28,
  },
  brandText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 20,
    fontStyle: 'italic',
    letterSpacing: 1,
  },
});
