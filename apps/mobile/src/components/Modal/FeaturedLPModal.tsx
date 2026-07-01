import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';
import { useTheme } from '@vinyla/ui';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { MockVinylData } from '@vinyla/shared-types';

interface FeaturedLPModalProps {
  visible: boolean;
  onClose: () => void;
  albums: MockVinylData[];
  currentFeaturedId: number | null;
  onSelect: (albumId: number | null) => void;
}

const { width, height } = Dimensions.get('window');

export const FeaturedLPModal = ({ visible, onClose, albums, currentFeaturedId, onSelect }: FeaturedLPModalProps) => {
  const { themeColors } = useTheme();
  
  const handleSelect = (id: number | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(id);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[styles.content, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>대표 LP 설정</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: themeColors.textPrimary, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.scroll}>
            <TouchableOpacity 
              style={[
                styles.albumItem, 
                { borderColor: currentFeaturedId === null ? themeColors.accent : themeColors.border },
                currentFeaturedId === null && { backgroundColor: 'rgba(212,175,55,0.05)' }
              ]}
              onPress={() => handleSelect(null)}
            >
              <View style={[styles.emptyCover, { borderColor: themeColors.border }]}>
                <Text style={{ color: themeColors.textSecondary }}>✕</Text>
              </View>
              <Text style={[styles.albumTitle, { color: themeColors.textPrimary }]}>선택 안함</Text>
            </TouchableOpacity>

            {albums.map((album) => (
              <TouchableOpacity 
                key={album.ALBUM_ID}
                style={[
                  styles.albumItem, 
                  { borderColor: currentFeaturedId === album.ALBUM_ID ? themeColors.accent : themeColors.border },
                  currentFeaturedId === album.ALBUM_ID && { backgroundColor: 'rgba(212,175,55,0.05)' }
                ]}
                onPress={() => handleSelect(album.ALBUM_ID)}
              >
                <Image 
                  source={album.IMAGE_URL ? { uri: album.IMAGE_URL } : require('../../../assets/logo_real_transparent.png')}
                  style={styles.coverImage}
                  resizeMode={album.IMAGE_URL ? "cover" : "contain"}
                />
                <View style={styles.albumInfo}>
                  <Text style={[styles.albumTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>{album.TITLE}</Text>
                  <Text style={[styles.albumArtist, { color: themeColors.textSecondary }]} numberOfLines={1}>{album.ARTIST}</Text>
                </View>
                <View style={[
                  styles.statusBadge, 
                  { 
                    backgroundColor: album.STATUS === 'WISH' ? 'rgba(255, 152, 0, 0.1)' : 'rgba(0, 255, 255, 0.1)', 
                    borderColor: album.STATUS === 'WISH' ? '#ff9800' : '#00ffff' 
                  }
                ]}>
                  <Text style={[
                    styles.statusText, 
                    { color: album.STATUS === 'WISH' ? '#ff9800' : '#00ffff' }
                  ]}>
                    {album.STATUS === 'WISH' ? 'WISH' : 'COLLECTED'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    height: height * 0.7,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 8,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  albumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  coverImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  emptyCover: {
    width: 50,
    height: 50,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumInfo: {
    flex: 1,
  },
  albumTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  albumArtist: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  }
});
