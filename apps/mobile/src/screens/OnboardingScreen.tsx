import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated, Easing, Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { makeRedirectUri } from 'expo-auth-session';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithGoogle, useAuthStore, supabase } from '@vinyla/core-api';
import { useTheme, shadows, shape } from '@vinyla/ui';
import { useAlert } from '../providers/AlertProvider';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

// --- Custom TouchableScale Component ---
const TouchableScale = ({ onPress, children, style }: any) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(scale, {
      toValue: 0.95,
      duration: 150,
      easing: Easing.out(Easing.poly(4)),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.poly(4)),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={{ width: '100%', height: '100%' }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

export const OnboardingScreen = ({ navigation }: any) => {
  const { themeColors, glassIntensity } = useTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const styles = getStyles(themeColors, shadows, shape);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  // Continuous Rotation for Step 1
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 25000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false, listener: (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / width);
      if (currentIndex !== index) {
        setCurrentIndex(index);
        Haptics.selectionAsync();
      }
    }}
  );

  const handleGoogleLogin = async () => {
    try {
      const redirectUri = makeRedirectUri({
        scheme: 'vinyla',
        // removed path to keep the URI as simple as possible (e.g. exp://192.168.1.3:8081)
      });
      console.log('Redirect URI:', redirectUri);
      
      const data = await signInWithGoogle(redirectUri);
      
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri, { showInRecents: true });
        
        if (result.type === 'success' && result.url) {
          if (result.url.includes('error=')) {
            showAlert('OAuth Error', decodeURIComponent(result.url));
            return;
          }
          
          const extractParam = (url: string, param: string) => {
            const regex = new RegExp(`[?&#]${param}=([^&#]*)`);
            const match = regex.exec(url);
            return match ? decodeURIComponent(match[1]) : null;
          };
          
          const access_token = extractParam(result.url, 'access_token');
          const refresh_token = extractParam(result.url, 'refresh_token');
          const code = extractParam(result.url, 'code');
          
          let sessionError = null;
          
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            sessionError = error;
          } else if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            sessionError = error;
          } else {
            sessionError = new Error('No valid authentication tokens found in the redirect URL.');
          }
          
          if (sessionError) {
            showAlert('Session Error', sessionError.message);
          } else {
            useAuthStore.getState().initializeAuth();
          }
        }
      }
    } catch (error) {
      console.error('Google login failed:', error);
      showAlert('Login Error', 'An unexpected error occurred during login.');
    }
  };

  // Parallax Interpolations
  const getTranslateX = (index: number, speed: number) => {
    return scrollX.interpolate({
      inputRange: [(index - 1) * width, index * width, (index + 1) * width],
      outputRange: [width * speed, 0, -width * speed],
      extrapolate: 'clamp',
    });
  };

  return (
    <View style={styles.container}>
      {/* Absolute Dark Background */}
      <View style={StyleSheet.absoluteFillObject} backgroundColor={themeColors.background} />
      
      {/* Subtle Background Gradient */}
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.15)', 'transparent']}
        style={[StyleSheet.absoluteFillObject, { height: '60%' }]}
      />

      {/* Persistent brand mark — visible across every step, not just the login page */}
      <View style={[styles.brandBar, { top: insets.top + 14 }]} pointerEvents="none">
        <Image
          source={require('../../assets/3d_logo_transparent.png')}
          style={styles.brandBarLogo}
          resizeMode="contain"
        />
        <Text style={styles.brandBarText}>VINYLA</Text>
      </View>

      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {/* Step 1: The Pure Archive */}
        <View style={styles.page}>
          <Animated.View style={[styles.visualArea, { transform: [{ translateX: getTranslateX(0, 0.4) }] }]}>
            <View style={styles.vinylWrapper}>
              <Animated.View style={[styles.vinylRecord, { transform: [{ rotate: spin }] }]}>
                <View style={styles.vinylGroove1}>
                  <View style={styles.vinylGroove2}>
                    <View style={styles.vinylLabel}>
                      <View style={styles.vinylHole} />
                    </View>
                  </View>
                </View>
              </Animated.View>
              
              <View style={styles.albumCover}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.2)', 'transparent', 'rgba(255,255,255,0.05)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <Image
                  source={require('../../assets/3d_logo_transparent.png')}
                  style={styles.coverLogo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </Animated.View>
          <Animated.View style={[styles.textArea, { transform: [{ translateX: getTranslateX(0, 0.6) }] }]}>
            <Text style={styles.title} adjustsFontSizeToFit numberOfLines={1}>THE PURE</Text>
            <Text style={styles.title} adjustsFontSizeToFit numberOfLines={1}>ARCHIVE</Text>
            <Text style={styles.description}>노이즈 없는 당신만의 프라이빗 박물관</Text>
            <Text style={styles.subDescription}>오직 순정 아이템으로 채워가는 아카이빙</Text>
          </Animated.View>
        </View>

        {/* Step 2: Instant Assetization */}
        <View style={styles.page}>
          <Animated.View style={[styles.visualArea, { transform: [{ translateX: getTranslateX(1, 0.4) }] }]}>
            <View style={styles.scanViewfinder}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              
              <View style={styles.floatingScanBtn}>
                <Text style={styles.scanBtnIcon}>📷</Text>
              </View>
            </View>
          </Animated.View>
          <Animated.View style={[styles.textArea, { transform: [{ translateX: getTranslateX(1, 0.6) }] }]}>
            <Text style={styles.title} adjustsFontSizeToFit numberOfLines={1}>INSTANT</Text>
            <Text style={styles.title} adjustsFontSizeToFit numberOfLines={1}>ASSETIZATION</Text>
            <Text style={styles.description}>스캔 한 번으로 시작되는 컬렉션</Text>
            <Text style={styles.subDescription}>실물 LP를 가장 완벽하게 디지털 자산화하세요</Text>
          </Animated.View>
        </View>

        {/* Step 3: Unlock Your Vault */}
        <View style={styles.page}>
          <Animated.View style={[styles.textAreaTop, { transform: [{ translateX: getTranslateX(2, 0.4) }] }]}>
            <Text style={styles.title3}>UNLOCK</Text>
            <Text style={styles.title3}>YOUR VAULT</Text>
          </Animated.View>
          
          <Animated.View style={[styles.visualAreaBottom, { transform: [{ translateX: getTranslateX(2, 0.6) }] }]}>
            <BlurView intensity={glassIntensity || 30} tint="dark" style={styles.loginPanel}>
              <View style={styles.panelLogoWrapper}>
                <Image
                  source={require('../../assets/3d_logo_transparent.png')}
                  style={styles.panelLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.panelTitle}>VinylA</Text>
              <Text style={styles.panelSubtitle}>프리미엄 컬렉터의 세계로</Text>

              <TouchableScale style={styles.loginBtn} onPress={handleGoogleLogin}>
                <View style={styles.loginBtnInnerGoogle}>
                  <Text style={styles.loginBtnTextGoogle}>Continue with Google</Text>
                </View>
              </TouchableScale>
              
              <TouchableScale style={[styles.loginBtn, { marginTop: 12 }]} onPress={() => {}}>
                <View style={styles.loginBtnInnerApple}>
                  <Text style={styles.loginBtnTextApple}>Continue with Apple</Text>
                </View>
              </TouchableScale>
            </BlurView>
          </Animated.View>
        </View>

      </Animated.ScrollView>

      {/* Pagination */}
      <View style={styles.pagination}>
        {[0, 1, 2].map((i) => {
          const opacity = scrollX.interpolate({
            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          const dotWidth = scrollX.interpolate({
            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
            outputRange: [6, 20, 6],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View 
              key={i} 
              style={[styles.dot, { opacity, width: dotWidth }]} 
            />
          );
        })}
      </View>
    </View>
  );
};

const getStyles = (themeColors: any, shadows: any, shape: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  page: {
    width,
    height,
  },
  brandBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  brandBarLogo: {
    width: 22,
    height: 22,
  },
  brandBarText: {
    fontFamily: 'Bodoni',
    fontSize: 14,
    color: themeColors.textSecondary,
    letterSpacing: 4,
    opacity: 0.8,
  },
  visualArea: {
    flex: 1.1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: height * 0.05,
  },
  textArea: {
    flex: 0.9,
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 20,
  },
  textAreaTop: {
    flex: 0.9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: height * 0.05,
  },
  visualAreaBottom: {
    flex: 1.1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  title: {
    fontFamily: 'Bodoni',
    fontSize: 36,
    color: themeColors.accent,
    textAlign: 'center',
    letterSpacing: 2,
    lineHeight: 44,
  },
  title3: {
    fontFamily: 'Bodoni',
    fontSize: 42,
    color: themeColors.accent,
    textAlign: 'center',
    letterSpacing: 2,
    lineHeight: 50,
  },
  description: {
    fontFamily: 'Pretendard',
    fontSize: 15,
    color: themeColors.textPrimary,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 8,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  subDescription: {
    fontFamily: 'Pretendard',
    fontSize: 13,
    color: themeColors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  pagination: {
    position: 'absolute',
    bottom: height * 0.06,
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 4,
    borderRadius: 2,
    backgroundColor: themeColors.accent,
    marginHorizontal: 4,
  },
  // --- Step 1 ---
  vinylWrapper: {
    width: width * 0.75,
    height: width * 0.75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumCover: {
    position: 'absolute',
    left: 0,
    width: '75%',
    height: '100%',
    backgroundColor: '#111',
    borderRadius: shape.sm,
    ...shadows.strong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  coverLogo: {
    width: '62%',
    height: '62%',
  },
  vinylRecord: {
    position: 'absolute',
    right: 0,
    width: '85%',
    height: '85%',
    borderRadius: width,
    backgroundColor: '#0a0a0a',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    ...shadows.medium,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  vinylGroove1: {
    width: '85%',
    height: '85%',
    borderRadius: width,
    borderWidth: 1,
    borderColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylGroove2: {
    width: '70%',
    height: '70%',
    borderRadius: width,
    borderWidth: 1,
    borderColor: '#151515',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylLabel: {
    width: '35%',
    height: '35%',
    borderRadius: width,
    backgroundColor: themeColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylHole: {
    width: '15%',
    height: '15%',
    borderRadius: width,
    backgroundColor: '#000',
  },
  // --- Step 2 ---
  scanViewfinder: {
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: themeColors.accent,
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 1, borderLeftWidth: 1 },
  topRight: { top: 0, right: 0, borderTopWidth: 1, borderRightWidth: 1 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 1, borderLeftWidth: 1 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 1, borderRightWidth: 1 },
  floatingScanBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(197, 160, 89, 0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.glow,
  },
  scanBtnIcon: {
    fontSize: 24,
  },
  // --- Step 3 ---
  loginPanel: {
    width: width * 0.85,
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderRadius: shape.lg,
    backgroundColor: 'rgba(20, 20, 20, 0.4)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    alignItems: 'center',
    overflow: 'hidden',
    ...shadows.glow,
  },
  panelLogoWrapper: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    ...shadows.glow,
  },
  panelLogo: {
    width: '68%',
    height: '68%',
  },
  panelTitle: {
    fontFamily: 'Bodoni',
    fontSize: 32,
    color: themeColors.textPrimary,
    marginBottom: 6,
    letterSpacing: 2,
  },
  panelSubtitle: {
    fontFamily: 'Pretendard',
    fontSize: 14,
    color: themeColors.textSecondary,
    marginBottom: 40,
    letterSpacing: 0.5,
  },
  loginBtn: {
    width: '100%',
    height: 52,
  },
  loginBtnInnerGoogle: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0E6D2',
    borderRadius: shape.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.soft,
  },
  loginBtnTextGoogle: {
    fontFamily: 'Pretendard',
    fontSize: 15,
    color: '#0a0a0a',
    fontWeight: '600',
  },
  loginBtnInnerApple: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    borderRadius: shape.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
  },
  loginBtnTextApple: {
    fontFamily: 'Pretendard',
    fontSize: 15,
    color: themeColors.textPrimary,
    fontWeight: '600',
  }
});
