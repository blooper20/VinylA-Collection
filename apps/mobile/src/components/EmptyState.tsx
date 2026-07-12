import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';

interface EmptyStateProps {
  title?: string;
  description?: string;
  buttonText?: string;
  onPressAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  buttonText,
  onPressAction,
}) => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const styles = getStyles(themeColors);
  return (
    <View style={styles.container}>
      <View style={styles.shelfContainer}>
        {/* 빈 원목 진열대 디자인 요소 */}
        <View style={styles.shelfTop} />
        <View style={styles.shelfDivider} />
        <View style={styles.shelfBottom} />
      </View>
      <Text style={styles.title}>{title || t('mobile.emptyState.title')}</Text>
      <Text style={styles.description}>{description || t('mobile.emptyState.description')}</Text>
      {onPressAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onPressAction}>
          <Text style={styles.actionButtonText}>{buttonText || t('mobile.emptyState.buttonText')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const getStyles = (themeColors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  shelfContainer: {
    width: 200,
    height: 120,
    marginBottom: 40,
    justifyContent: 'space-between',
    opacity: 0.8,
  },
  shelfTop: {
    height: 12,
    backgroundColor: '#3e2723', // Walnut color
    borderRadius: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#1e100c',
  },
  shelfDivider: {
    flex: 1,
    marginHorizontal: 20,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderColor: '#2d1b15',
    backgroundColor: 'transparent',
  },
  shelfBottom: {
    height: 16,
    backgroundColor: '#3e2723',
    borderRadius: 4,
    borderTopWidth: 2,
    borderTopColor: '#5c3a21',
  },
  title: {
    color: themeColors.accent,
    fontSize: 22,
    fontFamily: 'Bodoni Moda',
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    color: themeColors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  actionButton: {
    backgroundColor: themeColors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    elevation: 3,
    shadowColor: themeColors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  actionButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
