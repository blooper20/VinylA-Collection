import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { useAuthStore, NICKNAME_MAX_LENGTH } from '@vinyla/core-api';

const INTERESTS = ['Jazz', 'Rock', 'Classical', 'Hip-Hop', 'Pop', 'Electronic', 'R&B', 'Folk'];

export const SetupScreen = () => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const { user, updateProfile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const styles = getStyles(themeColors);

  // null = 사용자가 아직 직접 수정하지 않음 → Google 계정 이름을 기본값으로 보여준다.
  const [editedName, setEditedName] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const googleName = (user?.user_metadata?.full_name || user?.user_metadata?.name || '').slice(0, NICKNAME_MAX_LENGTH);
  const name = editedName ?? googleName;

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMsg(t('setup.nameRequired'));
      return;
    }
    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await updateProfile(name, selectedInterests);
      // RootNavigator swaps Setup -> Main automatically once displayName is set.
    } catch (error) {
      console.error('Failed to update profile:', error);
      setErrorMsg(t('setup.saveFailed'));
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Welcome to VinylA</Text>
        <Text style={styles.subtitle}>{t('setup.subtitle')}</Text>

        <View style={styles.formGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{t('setup.nicknameLabel')}</Text>
            <Text style={styles.counter}>
              {t('setup.nicknameCounter', { current: name.length, max: NICKNAME_MAX_LENGTH })}
            </Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder={t('setup.nicknamePlaceholder')}
            placeholderTextColor={themeColors.textSecondary}
            value={name}
            maxLength={NICKNAME_MAX_LENGTH}
            onChangeText={(text) => setEditedName(text.slice(0, NICKNAME_MAX_LENGTH))}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('setup.interestsLabel')}</Text>
          <View style={styles.tagsContainer}>
            {INTERESTS.map(interest => {
              const isSelected = selectedInterests.includes(interest);
              return (
                <TouchableOpacity
                  key={interest}
                  style={[styles.tag, isSelected && styles.tagSelected]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>{interest}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          <Text style={styles.submitBtnText}>{isSubmitting ? t('setup.savingButton') : t('setup.startButton')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const getStyles = (themeColors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  brand: {
    fontFamily: 'Bodoni',
    fontSize: 28,
    color: themeColors.textPrimary,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: themeColors.textSecondary,
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 28,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: themeColors.textPrimary,
  },
  counter: {
    fontSize: 12,
    color: themeColors.textSecondary,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: themeColors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: themeColors.textPrimary,
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 6,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  tagSelected: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderColor: themeColors.accent,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: themeColors.textSecondary,
  },
  tagTextSelected: {
    color: themeColors.accent,
  },
  submitBtn: {
    marginTop: 12,
    backgroundColor: themeColors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
});
