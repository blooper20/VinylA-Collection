import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated, Easing, Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { makeRedirectUri } from 'expo-auth-session';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { signInWithGoogle, signInWithApple, useAuthStore, supabase } from '@vinyla/core-api';
import { useTheme, shadows, shape } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { useAlert } from '../providers/AlertProvider';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');
const RECORD_SIZE = width * 0.76;

// Ring of engraved blossoms scattered between the label and the rim.
// Alternating radius/size/tilt breaks the symmetry so the spin is visible.
const BLOSSOM_PATTERN = Array.from({ length: 8 }).map((_, i) => {
  const angleDeg = i * 45 + (i % 2 === 0 ? 0 : 14);
  const angle = (angleDeg * Math.PI) / 180;
  const radius = RECORD_SIZE * (i % 2 === 0 ? 0.4 : 0.31);
  const size = i % 3 === 0 ? 26 : 19;
  return {
    size,
    tilt: (i * 53) % 360,
    left: RECORD_SIZE / 2 + Math.cos(angle) * radius - size / 2,
    top: RECORD_SIZE / 2 + Math.sin(angle) * radius - size / 2,
  };
});

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

// Vanilla-orchid blossom drawn with plain Views: five pointed teardrop
// petals around a hollow gold cup, rendered as faint gold linework so it
// reads like an engraving on the vinyl surface rather than a sticker.
const VanillaBlossom = ({ size, style, opacity = 0.5 }: { size: number; style?: any; opacity?: number }) => {
  const p = size * 0.4; // petal bounding square
  return (
    <View style={[{ width: size, height: size, opacity }, style]} pointerEvents="none">
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            StyleSheet.absoluteFillObject,
            { alignItems: 'center', transform: [{ rotate: `${i * 72}deg` }] },
          ]}
        >
          {/* teardrop: fully rounded except one corner → pointed tip, aimed outward */}
          <View
            style={{
              width: p,
              height: p,
              marginTop: size * 0.03,
              borderRadius: p * 0.5,
              borderBottomRightRadius: 0,
              backgroundColor: 'rgba(239, 227, 200, 0.05)',
              borderWidth: 1,
              borderColor: 'rgba(197, 160, 89, 0.5)',
              transform: [{ rotate: '-135deg' }],
            }}
          />
        </View>
      ))}
      {/* hollow trumpet cup at the center */}
      <View
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size * 0.22,
          height: size * 0.22,
          marginLeft: -size * 0.11,
          marginTop: -size * 0.11,
          borderRadius: size * 0.11,
          borderWidth: 1,
          borderColor: 'rgba(197, 160, 89, 0.65)',
          backgroundColor: 'rgba(197, 160, 89, 0.12)',
        }}
      />
    </View>
  );
};

export const OnboardingScreen = ({ navigation }: any) => {
  const { themeColors, glassIntensity } = useTheme();
  const { t } = useLocale();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const styles = getStyles(themeColors, shadows, shape);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const armAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);

  // Continuous Rotation for Step 1
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 9000,
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

  // Tonearm dropping onto the record in Step 1
  useEffect(() => {
    Animated.sequence([
      Animated.delay(700),
      Animated.timing(armAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const scanTranslate = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-96, 96],
  });

  // Swings clockwise from resting off the record's edge down onto the grooves.
  const armRotate = armAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-24deg', '6deg'],
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

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    try {
      const redirectUri = makeRedirectUri({
        scheme: 'vinyla',
        // removed path to keep the URI as simple as possible (e.g. exp://192.168.1.3:8081)
      });
      console.log('Redirect URI:', redirectUri);

      const data = provider === 'apple'
        ? await signInWithApple(redirectUri)
        : await signInWithGoogle(redirectUri);

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
      console.error(`${provider} login failed:`, error);
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
        <Text style={styles.brandBarText}>VinylA Collection</Text>
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

                {/* Faint blossom pattern engraved across the disc, spinning with it */}
                {BLOSSOM_PATTERN.map((b, i) => (
                  <VanillaBlossom
                    key={i}
                    size={b.size}
                    opacity={0.3}
                    style={{
                      position: 'absolute',
                      left: b.left,
                      top: b.top,
                      transform: [{ rotate: `${b.tilt}deg` }],
                    }}
                  />
                ))}
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

              {/* Tonearm dropping onto the record */}
              <Animated.View
                style={[styles.tonearm, { transform: [{ rotate: armRotate }] }]}
                pointerEvents="none"
              >
                <View style={styles.tonearmWeight} />
                <View style={styles.tonearmPivot}>
                  <View style={styles.tonearmPivotDot} />
                </View>
                <View style={styles.tonearmShaft} />
                <View style={styles.tonearmHead} />
              </Animated.View>
            </View>
          </Animated.View>

          <Animated.View style={[styles.textArea, { transform: [{ translateX: getTranslateX(0, 0.6) }] }]}>
            <Text style={styles.overline}>01 · PURE ARCHIVE</Text>
            <Text style={styles.headline}>
              {t('mobile.onboarding.step1HeadlineLine1')}{'\n'}{t('mobile.onboarding.step1HeadlineLine2Prefix')}<Text style={styles.headlineAccent}>{t('mobile.onboarding.step1HeadlineAccent')}</Text>
            </Text>
            <Text style={styles.subCopy}>{t('mobile.onboarding.step1Sub')}</Text>
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
            <Text style={styles.overline}>02 · SCAN & ARCHIVE</Text>
            <Text style={styles.headline}>
              {t('mobile.onboarding.step2HeadlineLine1')}{'\n'}{t('mobile.onboarding.step2HeadlineLine2Prefix')}<Text style={styles.headlineAccent}>{t('mobile.onboarding.step2HeadlineAccent')}</Text>{t('mobile.onboarding.step2HeadlineSuffix')}
            </Text>
            <Text style={styles.subCopy}>{t('mobile.onboarding.step2Sub')}</Text>
          </Animated.View>
        </View>

        {/* Step 3: Your Vault */}
        <View style={styles.page}>
          <Text style={styles.ghostNumber}>03</Text>

          <Animated.View style={[styles.textAreaTop, { transform: [{ translateX: getTranslateX(2, 0.4) }] }]}>
            <Text style={styles.overline}>03 · UNLOCK YOUR VAULT</Text>
            <Text style={styles.headline}>
              {t('mobile.onboarding.step3HeadlineLine1')}{'\n'}<Text style={styles.headlineAccent}>{t('mobile.onboarding.step3HeadlineAccent')}</Text>{t('mobile.onboarding.step3HeadlineSuffix')}
            </Text>
          </Animated.View>

          <Animated.View style={[styles.visualAreaBottom, { transform: [{ translateX: getTranslateX(2, 0.6) }] }]}>
            <BlurView intensity={glassIntensity || 30} tint="dark" style={styles.loginPanel}>
              <Image
                source={require('../../assets/3d_logo_transparent.png')}
                style={styles.panelLogo}
                resizeMode="contain"
              />
              <View style={styles.panelTag}>
                <Text style={styles.panelTagText}>VINYL + VANILLA</Text>
              </View>
              <Text style={styles.panelTitle}>VinylA</Text>
              <Text style={styles.panelCollection}>Collection</Text>
              <Text style={styles.panelSubtitle}>{t('mobile.onboarding.panelSubtitle')}</Text>

              <TouchableScale style={styles.loginBtn} onPress={() => handleOAuthLogin('google')}>
                <View style={styles.loginBtnInnerGoogle}>
                  <Text style={styles.loginBtnTextGoogle}>Continue with Google</Text>
                </View>
              </TouchableScale>

              <TouchableScale style={[styles.loginBtn, { marginTop: 12 }]} onPress={() => handleOAuthLogin('apple')}>
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
    letterSpacing: 2,
    marginRight: -2,
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
    width: RECORD_SIZE,
    height: RECORD_SIZE,
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
    borderRadius: RECORD_SIZE / 2,
    backgroundColor: '#0d0d0d',
    borderWidth: 2,
    borderColor: 'rgba(197, 160, 89, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylGroove1: {
    width: '90%',
    height: '90%',
    borderRadius: width,
    borderWidth: 1,
    borderColor: 'rgba(197, 160, 89, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylGroove2: {
    width: '84%',
    height: '84%',
    borderRadius: width,
    borderWidth: 1,
    borderColor: 'rgba(197, 160, 89, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylGroove3: {
    width: '82%',
    height: '82%',
    borderRadius: width,
    borderWidth: 1,
    borderColor: 'rgba(197, 160, 89, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylLabel: {
    width: '46%',
    height: '46%',
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
  tonearm: {
    position: 'absolute',
    top: -width * 0.03,
    right: width * 0.015,
    alignItems: 'center',
    zIndex: 5,
    // Rotate around the pivot bearing, not the arm's center:
    // pivot circle center sits 30px from the top (weight 14 + gap 2 + radius 14).
    transformOrigin: ['50%', 30, 0],
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  tonearmWeight: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2c2c2c',
    borderWidth: 1,
    borderColor: '#454545',
    marginBottom: 2,
  },
  tonearmPivot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#181818',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tonearmPivotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.8)',
  },
  tonearmShaft: {
    width: 3,
    height: width * 0.34,
    backgroundColor: '#a8a8a8',
    marginTop: -2,
  },
  tonearmHead: {
    width: 11,
    height: 26,
    borderRadius: 3,
    backgroundColor: '#C5A059',
    marginTop: -1,
    transform: [{ rotate: '10deg' }],
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
  panelTag: {
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    backgroundColor: 'rgba(212, 175, 55, 0.07)',
    borderRadius: shape.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  panelTagText: {
    fontFamily: 'Bodoni',
    fontSize: 10,
    color: themeColors.accent,
    letterSpacing: 2.5,
    // cancel letter-spacing's trailing gap so the text sits centered in the pill
    marginRight: -2.5,
  },
  panelTitle: {
    fontFamily: 'Bodoni',
    fontSize: 30,
    color: themeColors.textPrimary,
    marginBottom: 2,
    letterSpacing: 2,
  },
  panelCollection: {
    fontFamily: 'Bodoni',
    fontSize: 12,
    color: themeColors.accent,
    letterSpacing: 6,
    marginRight: -6,
    marginBottom: 10,
    opacity: 0.9,
  },
  panelSubtitle: {
    fontFamily: 'Pretendard',
    fontSize: 13,
    color: themeColors.textSecondary,
    marginBottom: 30,
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
