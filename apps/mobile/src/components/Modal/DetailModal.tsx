import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, Animated, ScrollView, Dimensions, PanResponder, Linking } from 'react-native';
import { MockVinylData } from '@vinyla/shared-types';
import * as Haptics from 'expo-haptics';
import { searchYouTube, searchDiscogs } from '@vinyla/core-api';

interface DetailModalProps {
  album: MockVinylData | null;
  visible: boolean;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export const DetailModal = ({ album, visible, onClose }: DetailModalProps) => {
  const vinylAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && album) {
      panY.setValue(0);
      Animated.timing(vinylAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        easing: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
      }).start();
    } else {
      vinylAnim.setValue(0);
    }
  }, [visible, album]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(vinylAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handleYoutubeListen = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (!album) return;
    const query = `${album.ARTIST} ${album.TITLE} full album`;
    const results = await searchYouTube(query);
    if (results && results.length > 0) {
      const videoId = results[0].id?.videoId;
      if (videoId) {
        Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`);
        return;
      }
    }
    Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
  };

  const handleDiscogsSearch = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (!album) return;
    const query = `${album.ARTIST} ${album.TITLE}`;
    const results = await searchDiscogs(query);
    if (results && results.length > 0) {
      const uri = results[0].uri;
      if (uri) {
        Linking.openURL(`https://www.discogs.com${uri}`);
        return;
      }
    }
    Linking.openURL(`https://www.discogs.com/search/?q=${encodeURIComponent(query)}`);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: Animated.event([null, { dy: panY }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          handleClose();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!album) return null;

  const vinylTranslateX = vinylAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 80]
  });

  const vinylRotate = vinylAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg']
  });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        <Animated.View 
          style={[styles.header, { transform: [{ translateY: panY }] }]} 
          {...panResponder.panHandlers}
        >
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>↓</Text>
          </TouchableOpacity>
        </Animated.View>

        <ScrollView contentContainerStyle={styles.scroll} {...panResponder.panHandlers}>
          <Animated.View style={[styles.coverContainer, { transform: [{ translateY: panY }] }]}>
            <Animated.View 
              style={[
                styles.vinyl, 
                { 
                  backgroundColor: album.CUSTOM_COLOR_HEX, 
                  transform: [
                    { translateX: vinylTranslateX },
                    { rotate: vinylRotate }
                  ] 
                }
              ]} 
            />
            <Image source={{ uri: album.IMAGE_URL }} style={styles.cover} />
          </Animated.View>

          <Animated.View style={[styles.info, { transform: [{ translateY: panY }] }]}>
            <Text style={styles.title}>{album.TITLE}</Text>
            <Text style={styles.artist}>{album.ARTIST} • {album.RELEASE_YEAR}</Text>

            <View style={styles.tracklist}>
              {album.TRACKS?.map((track, i) => (
                <Text key={i} style={styles.track}>{i + 1}. {track}</Text>
              ))}
            </View>
          </Animated.View>

          <Animated.View style={[styles.actions, { transform: [{ translateY: panY }] }]}>
            <TouchableOpacity 
              style={styles.btnPrimary}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
            >
              <Text style={styles.btnPrimaryText}>Add to Collection</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.btnOutline}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <Text style={styles.btnOutlineText}>WISH</Text>
            </TouchableOpacity>
          </Animated.View>
          
          <Animated.View style={{ transform: [{ translateY: panY }] }}>
            <TouchableOpacity 
              style={styles.btnYoutube}
              onPress={handleYoutubeListen}
            >
              <Text style={styles.btnYoutubeText}>LISTEN ON YOUTUBE</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.btnYoutube, { backgroundColor: '#333', marginTop: 10 }]}
              onPress={handleDiscogsSearch}
            >
              <Text style={styles.btnYoutubeText}>SEARCH ON DISCOGS</Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
  },
  scroll: {
    padding: 20,
    paddingBottom: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 40,
    width: '100%',
  },
  closeBtn: {
    padding: 10,
    paddingHorizontal: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  closeText: {
    color: '#e9c349',
    fontSize: 24,
    fontWeight: 'bold',
  },
  coverContainer: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  vinyl: {
    position: 'absolute',
    top: '5%',
    left: '5%',
    width: '90%',
    height: '90%',
    borderRadius: 200,
    zIndex: 1,
    borderWidth: 10,
    borderColor: '#111',
  },
  info: {
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  artist: {
    color: '#8e9192',
    fontSize: 16,
    marginTop: 8,
  },
  tracklist: {
    width: '100%',
    marginTop: 30,
    paddingHorizontal: 10,
  },
  track: {
    color: '#ccc',
    fontSize: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    gap: 16,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#e9c349',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#000',
    fontWeight: 'bold',
  },
  btnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e9c349',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnOutlineText: {
    color: '#e9c349',
    fontWeight: 'bold',
  },
  btnYoutube: {
    backgroundColor: '#ff0000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  btnYoutubeText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});
