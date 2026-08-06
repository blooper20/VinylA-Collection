import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { CoverImage } from '../CoverImage';
import { ShowcaseCarouselItem } from '../../utils/showcaseCarouselItems';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 각 영상마다 자기 자신의 useVideoPlayer 인스턴스가 필요해 별도 컴포넌트로 분리
// (CommunityPostScreen/CommunityNewPostScreen과 동일 패턴).
const CarouselVideo = ({ url, size }: { url: string; size: number }) => {
  const player = useVideoPlayer(url, (p) => { p.loop = true; });
  return <VideoView player={player} style={{ width: size, height: size }} allowsFullscreen allowsPictureInPicture nativeControls />;
};

// 사진/영상 + 첨부 앨범(오노추의 노래 포함)을 하나의 스와이프형 캐러셀로
// 보여준다 — 웹의 ShowcaseCarousel과 동일한 구성(앨범 먼저, 사진/영상 다음).
export const ShowcaseCarousel: React.FC<{
  items: ShowcaseCarouselItem[];
  onAlbumPress?: (albumId: number) => void;
  size?: number;
}> = ({ items, onAlbumPress, size = SCREEN_WIDTH }) => {
  const [index, setIndex] = useState(0);

  if (items.length === 0) return null;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / size));
  };

  return (
    <View>
      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        renderItem={({ item }) =>
          item.kind === 'video' ? (
            <View style={{ width: size, height: size }}>
              <CarouselVideo url={item.url} size={size} />
            </View>
          ) : item.kind === 'photo' ? (
            <CoverImage
              uri={item.url}
              fallback={require('../../../assets/logo_real_transparent.png')}
              style={{ width: size, height: size }}
              resizeMode="cover"
            />
          ) : (
            <TouchableOpacity
              style={{ width: size, height: size }}
              onPress={() => onAlbumPress?.(item.albumId)}
              activeOpacity={0.9}
            >
              <CoverImage
                uri={item.imageUrl}
                fallback={require('../../../assets/logo_real_transparent.png')}
                style={{ width: size, height: size }}
                resizeMode="cover"
              />
              <View style={styles.caption}>
                <Text style={styles.captionTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.captionArtist} numberOfLines={1}>{item.artist}</Text>
              </View>
            </TouchableOpacity>
          )
        }
      />
      {items.length > 1 && (
        <View style={styles.dots}>
          {items.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  caption: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  captionTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  captionArtist: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  dots: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#fff' },
});
