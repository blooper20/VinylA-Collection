import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useTheme, shadows } from '@vinyla/ui';

export const FloatingScanButton = (props: any) => {
  const { themeColors } = useTheme();
  const styles = getStyles(themeColors, shadows);
  return (
    <View style={[props.style, { justifyContent: 'flex-start', alignItems: 'center' }]} pointerEvents="box-none">
      <View style={styles.container}>
        <TouchableOpacity style={styles.button} onPress={props.onPress} activeOpacity={0.9}>
          <Image 
            source={require('../../../assets/3d_logo_transparent.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getStyles = (themeColors: any, shadows: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: -25, // Push it up above the tab bar
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    width: 70,
    height: 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 999,
  },
  button: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 70,
    height: 70,
    // No border radius so we don't clip the transparent leaves!
  }
});
