import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { BlurView } from 'expo-blur';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DeleteAccountModal = ({ visible, onClose, onConfirm }: DeleteAccountModalProps) => {
  const { themeColors, glassIntensity } = useTheme();
  const { t } = useLocale();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} disabled={isDeleting} />
        <BlurView intensity={glassIntensity || 30} tint="dark" style={[styles.content, { backgroundColor: 'rgba(20,20,20,0.7)', borderColor: 'rgba(255,82,82,0.3)' }]}>
          <View style={[styles.iconWrapper, { backgroundColor: 'rgba(255,82,82,0.12)' }]}>
            <Text style={styles.iconText}>⚠️</Text>
          </View>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{t('deleteAccount.title')}</Text>
          <Text style={[styles.body, { color: themeColors.textSecondary }]}>
            {t('deleteAccount.body')}
          </Text>
          <View style={[styles.warningBox, { backgroundColor: 'rgba(255,82,82,0.08)', borderColor: 'rgba(255,82,82,0.3)' }]}>
            <Text style={styles.warningText}>
              {t('deleteAccount.warning')}
            </Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btnCancel, { borderColor: themeColors.border }]}
              onPress={onClose}
              disabled={isDeleting}
            >
              <Text style={[styles.btnCancelText, { color: themeColors.textPrimary }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnDelete, isDeleting && { opacity: 0.6 }]}
              onPress={handleConfirm}
              disabled={isDeleting}
            >
              <Text style={styles.btnDeleteText}>{isDeleting ? t('deleteAccount.processing') : t('deleteAccount.confirmButton')}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    overflow: 'hidden',
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  warningBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  warningText: {
    color: '#ff5252',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnCancel: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  btnDelete: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#ff5252',
  },
  btnDeleteText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
});
