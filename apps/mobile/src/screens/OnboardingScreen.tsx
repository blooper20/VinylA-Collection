import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated, Easing, Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { makeRedirectUri } from 'expo-auth-session';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
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
  const scanAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);

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

  // Scan line sweep for Step 2
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const scanTranslate = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-96, 96],
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

  const goNext = () => {
    scrollRef.current?.scrollTo({ x: Math.min(currentIndex + 1, 2) * width, animated: true });
  };

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

  // The gold "next" button fades away as the last page (login) approaches.
  const nextBtnOpacity = scrollX.interpolate({
    inputRange: [width, width * 2],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* Ambient gold wash */}
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.10)', 'transparent']}
        style={[StyleSheet.absoluteFillObject, { height: '55%' }]}
      />

      {/* Persistent brand mark */}
      <View style={[styles.brandBar, { top: insets.top + 14 }]} pointerEvents="none">
        <Image
          source={require('../../assets/3d_logo_transparent.png')}
          style={styles.brandBarLogo}
          resizeMode="contain"
        />
        <Text style={styles.brandBarText}>VINYLA</Text>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {/* Step 1: The Archive */}
        <View style={styles.page}>
          <Text style={styles.ghostNumber}>01</Text>

          <Animated.View style={[styles.visualArea, { transform: [{ translateX: getTranslateX(0, 0.4) }] }]}>
            <View style={styles.vinylWrapper}>
              <Animated.View style={[styles.vinylRecord, { transform: [{ rotate: spin }] }]}>
                <View style={styles.vinylGroove1}>
                  <View style={styles.vinylGroove2}>
                    <View style={styles.vinylGroove3}>
                      <LinearGradient colors={['#e6c96a', '#b8912e']} style={styles.vinylLabel}>
                        <View style={styles.vinylHole} />
                      </LinearGradient>
                    </View>
                  </View>
                </View>
              </Animated.View>
              {/* Static light sheen — stays put while the record spins under it */}
              <View style={styles.vinylSheenClip} pointerEvents="none">
                <LinearGradient
                  colors={['rgba(255,255,255,0.12)', 'transparent']}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.7, y: 0.8 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
            </View>
          </Animated.View>

          <Animated.View style={[styles.textArea, { transform: [{ translateX: getTranslateX(0, 0.6) }] }]}>
            <Text style={styles.overline}>01 · THE ARCHIVE</Text>
            <Text style={styles.headline}>
              오직 레코드만을 위한{'\n'}프라이빗 <Text style={styles.headlineAccent}>뮤지엄</Text>
            </Text>
            <Text style={styles.subCopy}>노이즈 없이, 순정 아이템으로만{'\n'}채워가는 나만의 아카이브</Text>
          </Animated.View>
        </View>

        {/* Step 2: One Scan */}
        <View style={styles.page}>
          <Text style={styles.ghostNumber}>02</Text>

          <Animated.View style={[styles.visualArea, { transform: [{ translateX: getTranslateX(1, 0.4) }] }]}>
            <View style={styles.scanViewfinder}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />

              {/* The "subject" being scanned */}
              <Image
                source={require('../../assets/3d_logo_transparent.png')}
                style={styles.scanSubject}
                resizeMode="contain"
              />

              {/* Sweeping scan line */}
              <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanTranslate }] }]}>
                <LinearGradient
                  colors={['transparent', 'rgba(233,195,73,0.9)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
            </View>
          </Animated.View>

          <Animated.View style={[styles.textArea, { transform: [{ translateX: getTranslateX(1, 0.6) }] }]}>
            <Text style={styles.overline}>02 · ONE SCAN</Text>
            <Text style={styles.headline}>
              스캔 한 번으로{'\n'}시작되는 <Text style={styles.headlineAccent}>컬렉션</Text>
            </Text>
            <Text style={styles.subCopy}>실물 LP를 가장 우아하게{'\n'}디지털 자산으로 옮기는 방법</Text>
          </Animated.View>
        </View>

        {/* Step 3: Your Vault */}
        <View style={styles.page}>
          <Text style={styles.ghostNumber}>03</Text>

          <Animated.View style={[styles.textAreaTop, { transform: [{ translateX: getTranslateX(2, 0.4) }] }]}>
            <Text style={styles.overline}>03 · YOUR VAULT</Text>
            <Text style={styles.headline}>
              이제, 당신의{'\n'}<Text style={styles.headlineAccent}>볼트</Text>를 열 차례
            </Text>
          </Animated.View>

          <Animated.View style={[styles.visualAreaBottom, { transform: [{ translateX: getTranslateX(2, 0.6) }] }]}>
            <BlurView intensity={glassIntensity || 30} tint="dark" style={styles.loginPanel}>
              <Image
                source={require('../../assets/3d_logo_transparent.png')}
                style={styles.panelLogo}
                resizeMode="contain"
              />
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

      {/* Pinned bottom bar: pagination left, next button right */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.pagination}>
          {[0, 1, 2].map((i) => {
            const opacity = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.25, 1, 0.25],
              extrapolate: 'clamp',
            });
            const dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [6, 22, 6],
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

        <Animated.View
          style={{ opacity: nextBtnOpacity }}
          pointerEvents={currentIndex === 2 ? 'none' : 'auto'}
        >
          <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
            <Feather name="arrow-right" size={20} color="#0a0a0a" />
          </TouchableOpacity>
        </Animated.View>
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
  ghostNumber: {
    position: 'absolute',
    top: height * 0.09,
    right: 16,
    fontFamily: 'Bodoni',
    fontSize: 150,
    lineHeight: 150,
    color: 'rgba(212, 175, 55, 0.07)',
  },
  visualArea: {
    flex: 1.1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: height * 0.06,
  },
  textArea: {
    flex: 0.9,
    alignItems: 'flex-start',
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  textAreaTop: {
    flex: 0.8,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingHorizontal: 32,
    paddingBottom: 12,
  },
  visualAreaBottom: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: height * 0.06,
  },
  overline: {
    fontFamily: 'Bodoni',
    fontSize: 12,
    color: themeColors.accent,
    letterSpacing: 3.5,
    marginBottom: 14,
  },
  headline: {
    fontFamily: 'Pretendard',
    fontSize: 27,
    fontWeight: '800',
    color: themeColors.textPrimary,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  headlineAccent: {
    color: themeColors.accent,
  },
  subCopy: {
    fontFamily: 'Pretendard',
    fontSize: 14,
    color: themeColors.textSecondary,
    lineHeight: 22,
    marginTop: 14,
    letterSpacing: 0.2,
  },
  // --- Pinned bottom bar ---
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 32,
    right: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    height: 4,
    borderRadius: 2,
    backgroundColor: themeColors.accent,
    marginRight: 8,
  },
  nextBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: themeColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.glow,
  },
  // --- Step 1 ---
  vinylWrapper: {
    width: width * 0.72,
    height: width * 0.72,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 56,
    elevation: 12,
  },
  vinylRecord: {
    width: '100%',
    height: '100%',
    borderRadius: width,
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#232323',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylGroove1: {
    width: '88%',
    height: '88%',
    borderRadius: width,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylGroove2: {
    width: '84%',
    height: '84%',
    borderRadius: width,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylGroove3: {
    width: '80%',
    height: '80%',
    borderRadius: width,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylLabel: {
    width: '56%',
    height: '56%',
    borderRadius: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylHole: {
    width: '10%',
    height: '10%',
    borderRadius: width,
    backgroundColor: '#000',
  },
  vinylSheenClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: width,
    overflow: 'hidden',
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
    width: 34,
    height: 34,
    borderColor: themeColors.accent,
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 10 },
  topRight: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 10 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 10 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 10 },
  scanSubject: {
    width: 130,
    height: 130,
    opacity: 0.85,
  },
  scanLine: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 2,
  },
  // --- Step 3 ---
  loginPanel: {
    width: width * 0.86,
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(20, 20, 20, 0.4)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    alignItems: 'center',
    overflow: 'hidden',
    ...shadows.glow,
  },
  panelLogo: {
    width: 92,
    height: 92,
    marginBottom: 12,
  },
  panelTitle: {
    fontFamily: 'Bodoni',
    fontSize: 30,
    color: themeColors.textPrimary,
    marginBottom: 6,
    letterSpacing: 2,
  },
  panelSubtitle: {
    fontFamily: 'Pretendard',
    fontSize: 14,
    color: themeColors.textSecondary,
    marginBottom: 32,
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
