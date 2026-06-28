import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity, Animated } from 'react-native';

const { width, height } = Dimensions.get('window');

const ONBOARDING_DATA = [
  { id: '1', title: 'Vinyl Noir', description: '당신만의 프라이빗 LP 갤러리' },
  { id: '2', title: 'Capture', description: '커버를 스캔하여 컬렉션에 추가하세요' },
  { id: '3', title: 'Discover', description: '새로운 디깅, 새로운 음악' },
];

export const OnboardingScreen = ({ navigation }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false, listener: (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / width);
      setCurrentIndex(index);
    }}
  );

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {ONBOARDING_DATA.map((item, index) => (
          <View style={styles.page} key={item.id}>
            <View style={styles.textContainer}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          </View>
        ))}
      </Animated.ScrollView>

      <View style={styles.pagination}>
        {ONBOARDING_DATA.map((_, i) => (
          <View key={i} style={[styles.dot, i === currentIndex && styles.activeDot]} />
        ))}
      </View>

      <View style={styles.authContainer}>
        <TouchableOpacity 
          style={styles.glassBtn} 
          onPress={async () => {
            try {
              const { signInWithGoogle } = await import('@vinyla/core-api');
              const { makeRedirectUri } = await import('expo-auth-session');
              
              const redirectUri = makeRedirectUri({
                scheme: 'vinyla',
                path: 'auth/callback',
              });
              
              await signInWithGoogle(redirectUri);
              // In a real app, you would listen for deep links using Linking.addEventListener
              // to handle the session once the browser redirects back to 'vinyla://auth/callback'.
            } catch (error) {
              console.error('Google login failed:', error);
            }
          }}
        >
          <Text style={styles.btnText}>Continue with Google</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  page: {
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 100,
  },
  title: {
    fontFamily: 'Bodoni Moda',
    fontSize: 42,
    color: '#e9c349',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontFamily: 'Pretendard',
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 28,
  },
  pagination: {
    position: 'absolute',
    bottom: 220,
    flexDirection: 'row',
    alignSelf: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 6,
  },
  activeDot: {
    backgroundColor: '#e9c349',
    width: 24,
  },
  authContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    paddingHorizontal: 24,
  },
  glassBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: 'Pretendard',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  }
});
