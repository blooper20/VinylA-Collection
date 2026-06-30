import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const height = (width * 16) / 9;

interface ShareTemplateProps {
  children: React.ReactNode;
  backgroundImage?: string;
}

export const ShareTemplate: React.FC<ShareTemplateProps> = ({ children, backgroundImage }) => {
  return (
    <View style={styles.container}>
      <ImageBackground
        source={backgroundImage ? { uri: backgroundImage } : undefined}
        style={styles.template}
        imageStyle={styles.imageStyle}
      >
        <View style={styles.content}>
          {children}
        </View>
        <Text style={styles.watermark}>Curated by VinylA</Text>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  template: {
    width: width,
    height: height,
    backgroundColor: '#1a1a1a',
    position: 'relative',
    overflow: 'hidden',
  },
  imageStyle: {
    opacity: 0.8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  watermark: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    fontFamily: 'Pretendard',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10
  },
});
