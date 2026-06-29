import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, Animated, ScrollView, Dimensions, PanResponder, Linking, Alert, Easing, Pressable } from 'react-native';
import { MockVinylData } from '@vinyla/shared-types';
import * as Haptics from 'expo-haptics';
import { searchYouTube, searchDiscogs, createAlbumMaster, upsertUserVinyl, getAlbumMaster, useAuthStore, getAlbumTracks } from '@vinyla/core-api';

interface DetailModalProps {
  album: MockVinylData | null;
  visible: boolean;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');
const cinematicEasing = Easing.bezier(0.45, 0, 0.55, 1);

const AnimatedButton = ({ onPress, style, children, isHeavy = false }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease)
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease)
    }).start();
  };

  return (
    <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          Haptics.impactAsync(isHeavy ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
          onPress?.();
        }}
        style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

export const DetailModal = ({ album, visible, onClose }: DetailModalProps) => {
  const vinylAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  const [tracks, setTracks] = React.useState<string[]>([]);

  useEffect(() => {
    if (visible && album) {
      setTracks(album.TRACKS || []);
      if (!album.TRACKS || album.TRACKS.length === 0) {
        getAlbumTracks(album.ALBUM_ID).then(fetchedTracks => {
          if (fetchedTracks.length > 0) {
            setTracks(fetchedTracks);
          }
        });
      }

      panY.setValue(0);
      modalAnim.setValue(0);
      vinylAnim.setValue(0);
      
      Animated.parallel([
        Animated.timing(modalAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: cinematicEasing,
        }),
        Animated.timing(vinylAnim, {
          toValue: 1,
          duration: 800,
          delay: 150,
          useNativeDriver: true,
          easing: cinematicEasing,
        })
      ]).start();
    }
  }, [visible, album]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Smooth exit: LP goes back inside while the modal slides down/fades
    Animated.parallel([
      Animated.timing(vinylAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
        easing: cinematicEasing,
      }),
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 500,
        delay: 50,
        useNativeDriver: true,
        easing: cinematicEasing,
      }),
      Animated.timing(panY, {
        toValue: height,
        duration: 500,
        useNativeDriver: true,
        easing: cinematicEasing,
      })
    ]).start(() => {
      onClose();
    });
  };

  const handleYoutubeListen = async () => {
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

  const { user } = useAuthStore();

  const handleSave = async (status: 'OWNED' | 'WISH') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!album) return;

    try {
      // 1. Ensure Album exists in ALBUM_MASTER
      let master = await getAlbumMaster(album.ALBUM_ID);
      if (!master) {
        await createAlbumMaster({
          ALBUM_ID: album.ALBUM_ID,
          TITLE: album.TITLE,
          ARTIST: album.ARTIST,
          RELEASE_YEAR: album.RELEASE_YEAR,
          IMAGE_URL: album.IMAGE_URL,
          VINYL_IMAGE_URL: album.VINYL_IMAGE_URL || '',
          CUSTOM_COLOR_HEX: album.CUSTOM_COLOR_HEX || '#000',
          CUSTOM_STYLE_TYPE: 'SOLID',
          TRACKS: album.TRACKS || []
        });
      }

      // 2. Insert into USER_VINYL
      await upsertUserVinyl({
        USER_ID: user?.id || 1,
        ALBUM_ID: album.ALBUM_ID,
        STATUS: status,
        PURCHASE_DATE: new Date().toISOString(),
        PURCHASE_PRICE: 0
      });

      Alert.alert('Success', `Album saved as ${status}!`);
      handleClose();
    } catch (error) {
      console.error('Failed to save album:', error);
      Alert.alert('Error', 'Failed to save album. Please try again.');
    }
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
    outputRange: [0, 100]
  });

  const vinylRotate = vinylAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg']
  });

  const modalScale = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1]
  });

  return (
    <Modal visible={visible} animationType="none" transparent>
      <Animated.View style={[styles.container, { opacity: modalAnim }]}>
        <Animated.View 
          style={[{ flex: 1, transform: [{ scale: modalScale }, { translateY: panY }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>↓</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.coverContainer}>
              <Animated.View 
                style={[
                  styles.vinyl, 
                  { 
                    backgroundColor: album.CUSTOM_COLOR_HEX || '#000', 
                    transform: [
                      { translateX: vinylTranslateX },
                      { rotate: vinylRotate }
                    ] 
                  }
                ]} 
              />
              <Image source={{ uri: album.IMAGE_URL }} style={styles.cover} />
            </View>

            <View style={styles.info}>
              <Text style={styles.title}>{album.TITLE}</Text>
              <Text style={styles.artist}>{album.ARTIST} • {album.RELEASE_YEAR}</Text>

              <View style={styles.tracklist}>
                {tracks.length > 0 ? tracks.map((track, i) => (
                  <Text key={i} style={styles.track}>{i + 1}. {track}</Text>
                )) : (
                  <Text style={[styles.track, { textAlign: 'center', borderBottomWidth: 0 }]}>No tracklist available</Text>
                )}
              </View>
            </View>

            <View style={styles.actions}>
              <AnimatedButton 
                style={styles.btnPrimary}
                onPress={() => handleSave('OWNED')}
              >
                <Text style={styles.btnPrimaryText}>Add to Collection</Text>
              </AnimatedButton>
              <AnimatedButton 
                style={styles.btnOutline}
                onPress={() => handleSave('WISH')}
              >
                <Text style={styles.btnOutlineText}>WISH</Text>
              </AnimatedButton>
            </View>
            
            <View>
              <AnimatedButton 
                style={styles.btnYoutube}
                onPress={handleYoutubeListen}
                isHeavy
              >
                <Text style={styles.btnYoutubeText}>LISTEN ON YOUTUBE</Text>
              </AnimatedButton>
              <AnimatedButton 
                style={[styles.btnYoutube, { backgroundColor: '#333', marginTop: 10 }]}
                onPress={handleDiscogsSearch}
                isHeavy
              >
                <Text style={styles.btnYoutubeText}>SEARCH ON DISCOGS</Text>
              </AnimatedButton>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
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
