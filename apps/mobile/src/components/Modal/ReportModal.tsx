import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { reportSpinLog, reportSpinComment, reportVinyl, reportVinylComment } from '@vinyla/core-api';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';

interface ReportModalProps {
  isVisible: boolean;
  onClose: () => void;
  targetId: number;
  // log/comment = 스피닝 다이어리, vinyl/vinylComment = 수집 게시물
  targetType: 'log' | 'comment' | 'vinyl' | 'vinylComment';
  onReportSuccess?: () => void;
}

const REPORT_REASON_KEYS = ['spam', 'adult', 'illegal', 'hate', 'privacy', 'offensive', 'other'] as const;

export const ReportModal: React.FC<ReportModalProps> = ({ isVisible, onClose, targetId, targetType, onReportSuccess }) => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const REPORT_REASONS = REPORT_REASON_KEYS.map((key) => t(`report.reasons.${key}` as any));
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      if (targetType === 'log') {
        await reportSpinLog(targetId, reason, details);
      } else if (targetType === 'comment') {
        await reportSpinComment(targetId, reason, details);
      } else if (targetType === 'vinyl') {
        await reportVinyl(targetId, reason, details);
      } else {
        await reportVinylComment(targetId, reason, details);
      }
      Alert.alert(t('common.success'), t('report.successMessage'));
      if (onReportSuccess) onReportSuccess();
      onClose();
      setReason(REPORT_REASONS[0]);
      setDetails('');
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('report.failedMessage'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>{t('report.title')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.closeButton, { color: themeColors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t('report.reasonLabel')}</Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              {REPORT_REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.radioRow,
                    { borderColor: reason === r ? themeColors.accent : themeColors.border }
                  ]}
                  onPress={() => setReason(r)}
                >
                  <View style={[styles.radioCircle, { borderColor: reason === r ? themeColors.accent : themeColors.textSecondary }]}>
                    {reason === r && <View style={[styles.radioDot, { backgroundColor: themeColors.accent }]} />}
                  </View>
                  <Text style={[styles.radioText, { color: reason === r ? themeColors.accent : themeColors.textPrimary }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: themeColors.textPrimary, marginTop: 24 }]}>{t('report.detailsLabel')}</Text>
            <TextInput
              style={[styles.detailsInput, { color: themeColors.textPrimary, borderColor: themeColors.border, backgroundColor: 'rgba(255,255,255,0.05)' }]}
              placeholder={t('report.detailsPlaceholder')}
              placeholderTextColor={themeColors.textSecondary}
              value={details}
              onChangeText={setDetails}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
            <TouchableOpacity style={[styles.button, styles.cancelButton, { borderColor: themeColors.border }]} onPress={onClose} disabled={isSubmitting}>
              <Text style={[styles.buttonText, { color: themeColors.textSecondary }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.submitButton]} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.buttonText, { color: '#fff' }]}>{t('report.submit')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderRadius: 16,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 20,
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  radioText: {
    fontSize: 14,
  },
  detailsInput: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  submitButton: {
    backgroundColor: '#ff4b4b',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
