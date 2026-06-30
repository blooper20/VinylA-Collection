import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, Animated, ScrollView, Dimensions, PanResponder, Linking, Alert, Easing, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { MockVinylData } from '@vinyla/shared-types';
import * as Haptics from 'expo-haptics';
import { FontAwesome5 } from '@expo/vector-icons';
import { searchYouTube, searchDiscogs, createAlbumMaster, upsertUserVinyl, getAlbumMaster, useAuthStore, getAlbumExtraDetails, deleteUserVinylByAlbum } from '@vinyla/core-api';

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
  const insets = useSafeAreaInsets();
  const vinylAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  const [tracks, setTracks] = React.useState<string[]>([]);
  const [isTracksLoading, setIsTracksLoading] = React.useState<boolean>(false);

  useEffect(() => {
    if (visible && album) {
      setTracks(album.TRACKS || []);

      panY.setValue(0);
      modalAnim.setValue(0);
      vinylAnim.setValue(0);
      spinAnim.setValue(0);

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
      ]).start(() => {
        // Fetch tracklist after animation completes to prevent UI jank
        if (!album.TRACKS || album.TRACKS.length === 0) {
          setIsTracksLoading(true);
          getAlbumExtraDetails(album.ALBUM_ID, album.ARTIST, album.TITLE).then(details => {
            if (details.tracks && details.tracks.length > 0) {
              setTracks(details.tracks);
            }
          }).finally(() => {
            setIsTracksLoading(false);
          });
        }

        // Start infinite spin after vinyl slides out
        Animated.loop(
          Animated.timing(spinAnim, {
            toValue: 1,
            duration: 10000, // 10 seconds for a full rotation
            useNativeDriver: true,
            easing: Easing.linear
          })
        ).start();
      });
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
      // 1. Ensure Album exists in ALBUM_MASTER, or update it if the new one has a better image
      let master = await getAlbumMaster(album.ALBUM_ID);
      
      const isNewImageBetter = album.IMAGE_URL?.includes('mzstatic.com') || album.IMAGE_URL?.includes('apple.com') || (album.IMAGE_URL && !master?.IMAGE_URL);
      
      if (!master || isNewImageBetter) {
        await createAlbumMaster({
          ALBUM_ID: album.ALBUM_ID,
          TITLE: album.TITLE,
          ARTIST: album.ARTIST,
          RELEASE_YEAR: album.RELEASE_YEAR,
          IMAGE_URL: album.IMAGE_URL,
          VINYL_IMAGE_URL: album.VINYL_IMAGE_URL || master?.VINYL_IMAGE_URL || '',
          CUSTOM_COLOR_HEX: album.CUSTOM_COLOR_HEX || master?.CUSTOM_COLOR_HEX || '#000',
          CUSTOM_STYLE_TYPE: master?.CUSTOM_STYLE_TYPE || 'SOLID',
          TRACKS: album.TRACKS && album.TRACKS.length > 0 ? album.TRACKS : (master?.TRACKS || [])
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

      Alert.alert('성공', `앨범이 저장되었습니다!`);
      handleClose();
    } catch (error) {
      console.error('Failed to save album:', error);
      Alert.alert('오류', '앨범 저장에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  const handleDelete = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!album) return;
    try {
      await deleteUserVinylByAlbum(user?.id || 1, album.ALBUM_ID);
      Alert.alert('성공', '보관함에서 삭제되었습니다.');
      handleClose();
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '삭제에 실패했습니다.');
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only intercept swipe down if started from the top area (header/cover)
        return gestureState.dy > 10 && gestureState.y0 < height * 0.4;
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

  const coverTranslateX = vinylAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -35]
  });

  const vinylTranslateX = vinylAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 95]
  });

  const vinylRotate = vinylAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg']
  });

  const spinRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const modalScale = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1]
  });

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
      <Animated.View style={[styles.container, { opacity: modalAnim }]}>
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) }}>
          <Animated.View 
            style={[{ flex: 1, transform: [{ scale: modalScale }, { translateY: panY }] }]}
            {...panResponder.panHandlers}
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
            <Animated.View style={[styles.coverContainer, { transform: [{ translateX: coverTranslateX }] }]}>
              <Animated.View 
                style={[
                  styles.vinyl, 
                  { 
                    transform: [
                      { translateX: vinylTranslateX },
                      { rotate: vinylRotate },
                      { rotate: spinRotate }
                    ] 
                  }
                ]} 
              >
                <View style={styles.vinylGrooves} />
                <View style={styles.vinylGrooves2} />
                <View style={[styles.vinylLabel, { backgroundColor: album.CUSTOM_COLOR_HEX || '#222' }]}>
                  <Image source={{ uri: album.IMAGE_URL }} style={StyleSheet.absoluteFill} />
                  <View style={styles.vinylHole} />
                </View>
              </Animated.View>
              <Image source={{ uri: album.IMAGE_URL }} style={styles.cover} />
            </Animated.View>

            <View style={styles.info}>
              <Text style={styles.title}>{album.TITLE}</Text>
              <Text style={styles.artist}>{album.ARTIST} • {album.RELEASE_YEAR}</Text>

              <View style={styles.tracklist}>
                {isTracksLoading ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#e9c349" />
                    <Text style={[styles.track, { textAlign: 'center', borderBottomWidth: 0, marginTop: 10, color: '#888' }]}>트랙리스트를 불러오는 중입니다...</Text>
                  </View>
                ) : tracks.length > 0 ? tracks.map((track, i) => (
                  <Text key={i} style={styles.track}>{i + 1}. {track}</Text>
                )) : (
                  <Text style={[styles.track, { textAlign: 'center', borderBottomWidth: 0 }]}>트랙리스트 정보가 없습니다</Text>
                )}
              </View>
            </View>

            {album.STATUS !== 'OWNED' && (
              <View style={styles.actions}>
                {album.STATUS === 'WISH' ? (
                  <AnimatedButton 
                    style={styles.btnPrimary}
                    onPress={() => handleSave('OWNED')}
                  >
                    <Text style={styles.btnPrimaryText}>보관함 추가</Text>
                  </AnimatedButton>
                ) : (
                  <>
                    <AnimatedButton 
                      style={styles.btnPrimary}
                      onPress={() => handleSave('OWNED')}
                    >
                      <Text style={styles.btnPrimaryText}>내 콜렉션에 추가</Text>
                    </AnimatedButton>
                    <AnimatedButton 
                      style={styles.btnOutline}
                      onPress={() => handleSave('WISH')}
                    >
                      <Text style={styles.btnOutlineText}>위시 추가</Text>
                    </AnimatedButton>
                  </>
                )}
              </View>
            )}
            
            <View style={{ marginTop: album.STATUS === 'OWNED' ? 30 : 0 }}>
              <AnimatedButton 
                style={[styles.btnYoutube, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                onPress={handleYoutubeListen}
                isHeavy
              >
                <FontAwesome5 name="youtube" size={18} color="#fff" />
                <Text style={[styles.btnYoutubeText, { marginLeft: 8 }]}>유튜브로 듣기</Text>
              </AnimatedButton>
              <AnimatedButton 
                style={[styles.btnYoutube, { backgroundColor: '#333', marginTop: 10 }]}
                onPress={handleDiscogsSearch}
                isHeavy
              >
                <Text style={styles.btnYoutubeText}>Discogs에서 검색</Text>
              </AnimatedButton>
            </View>

            {(album.STATUS === 'OWNED' || album.STATUS === 'WISH') && (
              <View style={[styles.actions, { marginTop: 10 }]}>
                {album.STATUS === 'OWNED' ? (
                  <AnimatedButton 
                    style={[styles.btnPrimary, { backgroundColor: '#d32f2f', borderColor: '#d32f2f' }]}
                    onPress={handleDelete}
                  >
                    <Text style={styles.btnPrimaryText}>보관함 삭제</Text>
                  </AnimatedButton>
                ) : (
                  <AnimatedButton 
                    style={[styles.btnOutline, { borderColor: '#d32f2f', flex: 1 }]}
                    onPress={handleDelete}
                  >
                    <Text style={[styles.btnOutlineText, { color: '#d32f2f' }]}>위시 삭제</Text>
                  </AnimatedButton>
                )}
              </View>
            )}
          </ScrollView>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    width: '100%',
  },
  closeBtn: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 30,
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  coverContainer: {
    width: width * 0.55,
    height: width * 0.55,
    alignSelf: 'center',
    marginBottom: 24,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
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
    top: '2%',
    left: '2%',
    width: '96%',
    height: '96%',
    borderRadius: 1000,
    zIndex: 1,
    backgroundColor: '#0e0e0e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  vinylGrooves: {
    position: 'absolute',
    width: '85%',
    height: '85%',
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  vinylGrooves2: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  vinylLabel: {
    width: '45%',
    height: '45%',
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  vinylHole: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  info: {
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  artist: {
    color: '#a0a0a0',
    fontSize: 15,
    marginTop: 6,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  tracklist: {
    width: '100%',
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    paddingBottom: 8,
  },
  track: {
    color: '#ddd',
    fontSize: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    gap: 12,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 15,
  },
  btnOutline: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnOutlineText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  btnYoutube: {
    backgroundColor: '#rgba(255,0,0,0.85)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnYoutubeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
  }
});
