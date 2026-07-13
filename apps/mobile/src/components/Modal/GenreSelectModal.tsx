import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

interface GenreSelectModalProps {
  visible: boolean;
  onClose: () => void;
  initialSelected: string[];
  onSave: (genres: string[]) => void;
}

const { width, height } = Dimensions.get('window');

const ALL_GENRES = [
  'Pop', 'Rock', 'Jazz', 'Electronic', 'Hip Hop', 'R&B / Soul', 'Folk', 
  'Classical', 'Blues', 'Reggae', 'Cinematic', 'Ambient', 'World', 
  'Latin', 'Funk', 'Disco', 'Punk', 'Alternative', 'Indie', 
  'K-Pop', 'J-Pop', 'City Pop', 'New Age', 'Soundtrack', 'Vocal', 'Musical',
  'Country', 'Heavy Metal', 'Hard Rock', 'Modern Rock', 'Brit Pop', 
  'Synth Pop', 'Techno', 'Trance', 'Bossa Nova', 'Ska', 'Crossover', 
  'Psychedelic', 'Chanson', 'Tango', 'Acid Jazz', 'Shoegazing'
];

export const GenreSelectModal = ({ visible, onClose, initialSelected, onSave }: GenreSelectModalProps) => {
  const { themeColors, glassIntensity } = useTheme();
  const { t } = useLocale();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setSelected(initialSelected || []);
    }
  }, [visible, initialSelected]);

  const toggleGenre = (genre: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selected.includes(genre)) {
      setSelected(prev => prev.filter(g => g !== genre));
    } else {
      setSelected(prev => [...prev, genre]);
    }
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(selected);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        <BlurView intensity={glassIntensity || 30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[styles.content, { backgroundColor: 'rgba(20,20,20,0.6)', borderColor: themeColors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>{t('mobile.genreSelect.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: themeColors.textPrimary, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.genreContainer}>
              {ALL_GENRES.map((genre) => {
                const isSelected = selected.includes(genre);
                return (
                  <TouchableOpacity
                    key={genre}
                    style={[
                      styles.genreBadge,
                      { borderColor: isSelected ? themeColors.accent : themeColors.border },
                      isSelected && { backgroundColor: 'rgba(212,175,55,0.1)' }
                    ]}
                    onPress={() => toggleGenre(genre)}
                  >
                    <Text style={[
                      { color: isSelected ? themeColors.background : themeColors.textSecondary, fontWeight: isSelected ? 'bold' : 'normal' }
                    ]}>
                      {t(`genres.${genre}` as any)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: themeColors.textPrimary }]} 
              onPress={handleSave}
            >
              <Text style={[styles.saveBtnText, { color: '#000' }]}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
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
    height: height * 0.6,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 20,
    paddingBottom: 40,
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
    paddingBottom: 20,
  },
  genreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  genreBadge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
  }
});
