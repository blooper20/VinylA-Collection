import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  message = '통신이 원활하지 않습니다', 
  onRetry 
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <View style={styles.lpDisc} />
        <View style={styles.lpLabel} />
        <View style={styles.lpHole} />
      </View>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    opacity: 0.5,
  },
  lpDisc: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  lpLabel: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9c349',
  },
  lpHole: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000',
  },
  errorMessage: {
    color: '#e9c349',
    fontSize: 16,
    fontFamily: 'Bodoni Moda',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#e9c349',
    borderRadius: 8,
  },
  retryText: {
    color: '#e9c349',
    fontSize: 14,
    fontWeight: 'bold',
  }
});
