import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

export const FloatingScanButton = ({ onPress }: { onPress?: () => void }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={onPress}>
        <View style={styles.innerCircle} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#000',
    shadowColor: '#e9c349',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e9c349',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#000',
  }
});
