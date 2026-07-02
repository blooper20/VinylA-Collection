import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';

interface ShareOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  isProcessing?: boolean;
  onSaveImage: () => void;
  onCopyImage: () => void;
  onShareLink: () => void;
}

export const ShareOptionsSheet = ({
  visible,
  onClose,
  title,
  isProcessing,
  onSaveImage,
  onCopyImage,
  onShareLink,
}: ShareOptionsSheetProps) => {
  const { themeColors, glassIntensity } = useTheme();

  const options: { id: string; label: string; icon: 'download' | 'copy' | 'share-2'; onPress: () => void }[] = [
    { id: 'save', label: '이미지 저장', icon: 'download', onPress: onSaveImage },
    { id: 'copy', label: '이미지 복사', icon: 'copy', onPress: onCopyImage },
    { id: 'link', label: '링크 공유', icon: 'share-2', onPress: onShareLink },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} disabled={isProcessing} />
        <BlurView
          intensity={glassIntensity || 30}
          tint="dark"
          style={[styles.content, { backgroundColor: 'rgba(20,20,20,0.7)', borderColor: themeColors.border }]}
        >
          <View style={[styles.handle, { backgroundColor: themeColors.border }]} />
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{title}</Text>

          {options.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={styles.row}
              onPress={opt.onPress}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(212,175,55,0.1)' }]}>
                <Feather name={opt.icon} size={18} color={themeColors.accent} />
              </View>
              <Text style={[styles.rowLabel, { color: themeColors.textPrimary }]}>{opt.label}</Text>
              {isProcessing ? (
                <ActivityIndicator size="small" color={themeColors.textSecondary} />
              ) : (
                <Feather name="chevron-right" size={18} color={themeColors.textSecondary} />
              )}
            </TouchableOpacity>
          ))}
        </BlurView>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.6,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});
