import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface EmptyStateProps {
  title?: string;
  description?: string;
  buttonText?: string;
  onPressAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = '컬렉션이 비어 있습니다',
  description = '새로운 LP 앨범을 스캔하여 당신만의 멋진 진열대를 채워보세요.',
  buttonText = '앨범 스캔하기',
  onPressAction,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.shelfContainer}>
        {/* 빈 원목 진열대 디자인 요소 */}
        <View style={styles.shelfTop} />
        <View style={styles.shelfDivider} />
        <View style={styles.shelfBottom} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {onPressAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onPressAction}>
          <Text style={styles.actionButtonText}>{buttonText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e0e0e',
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
    color: '#e9c349',
    fontSize: 22,
    fontFamily: 'Bodoni Moda',
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  actionButton: {
    backgroundColor: '#e9c349',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    elevation: 3,
    shadowColor: '#e9c349',
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
