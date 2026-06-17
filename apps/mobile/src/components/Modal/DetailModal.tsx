import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Image } from 'react-native';
import { MockVinylData } from '@vinyla/shared-types';

interface Props {
  album: MockVinylData | null;
  visible: boolean;
  onClose: () => void;
}

export const DetailModal = ({ album, visible, onClose }: Props) => {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && album) {
      slideAnim.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 80, // Slide out 80px
        duration: 800,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, album]);

  if (!album) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.coverContainer}>
            <Animated.View 
              style={[
                styles.vinyl, 
                { 
                  backgroundColor: album.CUSTOM_COLOR_HEX, 
                  transform: [
                    { translateX: slideAnim },
                    { rotate: slideAnim.interpolate({ inputRange: [0, 80], outputRange: ['0deg', '90deg'] }) }
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
              {album.TRACKS?.map((track, i) => (
                <Text key={i} style={styles.track}>{i + 1}. {track}</Text>
              ))}
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>Add to Collection</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnOutline}>
              <Text style={styles.btnOutlineText}>WISH</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.btnYoutube}>
            <Text style={styles.btnYoutubeText}>LISTEN ON YOUTUBE</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    padding: 20,
    paddingBottom: 60,
  },
  header: {
    alignItems: 'flex-end',
    marginBottom: 20,
    marginTop: 40,
  },
  closeBtn: {
    padding: 10,
  },
  closeText: {
    color: '#e9c349',
    fontSize: 16,
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
