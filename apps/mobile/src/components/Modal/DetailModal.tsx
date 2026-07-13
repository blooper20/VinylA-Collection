import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, Animated, ScrollView, Dimensions, PanResponder, Linking, Easing, Pressable, ActivityIndicator, TextInput, Share, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { MockVinylData } from '@vinyla/shared-types';
import * as Haptics from 'expo-haptics';
import { FontAwesome5, Feather } from '@expo/vector-icons';
import { searchYouTube, createAlbumMaster, upsertUserVinyl, getAlbumMaster, useAuthStore, getAlbumExtraDetails, deleteUserVinylByAlbum, getUserVinyls, getErrorMessage } from '@vinyla/core-api';
import { useTheme, shadows, shape } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { CustomAlert } from '../../providers/AlertProvider';
import { ShareableStoryView } from '../Share/ShareableStoryView';
import { ShareOptionsSheet } from './ShareOptionsSheet';
import { shareToInstagramStory } from '../../utils/nativeShare';

interface DetailModalProps {
  album: MockVinylData | null;
  visible: boolean;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');
const cinematicEasing = Easing.bezier(0.45, 0, 0.55, 1);
const BUTTON_HEIGHT = 52;

const AnimatedButton = ({ onPress, style, children, isHeavy = false }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease)
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease)
    }).start();
  };

  return (
    <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          Haptics.impactAsync(isHeavy ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
          onPress?.();
        }}
        style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

export const DetailModal = ({ album, visible, onClose }: DetailModalProps) => {
  const insets = useSafeAreaInsets();
  const vinylAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  const [tracks, setTracks] = React.useState<string[]>([]);
  const [isTracksLoading, setIsTracksLoading] = React.useState<boolean>(false);
  const [realStatus, setRealStatus] = React.useState<string | null>(null);

  const { themeColors, glassIntensity } = useTheme();
  const { t } = useLocale();
  const styles = getStyles(themeColors, shadows, shape);

  const [alertVisible, setAlertVisible] = React.useState(false);
  const [alertTitle, setAlertTitle] = React.useState('');
  const [alertMessage, setAlertMessage] = React.useState('');
  const [onAlertClose, setOnAlertClose] = React.useState<(() => void) | null>(null);

  const [pricePromptVisible, setPricePromptVisible] = React.useState(false);
  const [priceInputValue, setPriceInputValue] = React.useState('');
  const [isEditingPriceOnly, setIsEditingPriceOnly] = React.useState(false);

  const showAlert = (title: string, message: string, onCloseCallback?: () => void) => {
    setAlertTitle(title);
    setAlertMessage(message);
    if (onCloseCallback) {
      setOnAlertClose(() => onCloseCallback);
    } else {
      setOnAlertClose(null);
    }
    setAlertVisible(true);
  };

  // New detailed states
  const [marketPrice, setMarketPrice] = React.useState<number | null>(null);
  const [purchasePrice, setPurchasePrice] = React.useState<number | null>(null);
  const [releaseDate, setReleaseDate] = React.useState<string>('');
  const [copyright, setCopyright] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');

  const { user } = useAuthStore();

  const [isShareSheetVisible, setShareSheetVisible] = React.useState(false);
  const [isSharingProcessing, setIsSharingProcessing] = React.useState(false);
  const shareViewRef = useRef<View>(null);

  useEffect(() => {
    if (visible && album) {
      setTracks(album.TRACKS || []);
      setPurchasePrice((album as any).PURCHASE_PRICE || null);
      setMarketPrice((album as any).MARKET_PRICE || null);
      setReleaseDate('');
      setCopyright('');
      setNotes('');

      setAlertVisible(false);
      setAlertTitle('');
      setAlertMessage('');
      setOnAlertClose(null);
      setPricePromptVisible(false);
      setPriceInputValue('');
      setIsEditingPriceOnly(false);
      
      // DB에서 이 앨범의 실제 상태(OWNED/WISH/없음)를 확인
      setRealStatus(album.STATUS || null);
      if (!album.STATUS && user?.id) {
        getUserVinyls(user.id).then((vinyls: any[]) => {
          const found = vinyls.find((v: any) => v.ALBUM_ID === album.ALBUM_ID);
          if (found) {
            setRealStatus(found.STATUS);
            setPurchasePrice(found.PURCHASE_PRICE || null);
          }
        }).catch(() => {});
      }

      panY.setValue(0);
      modalAnim.setValue(0);
      vinylAnim.setValue(0);
      spinAnim.setValue(0);

      Animated.parallel([
        Animated.timing(modalAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: cinematicEasing,
        }),
        Animated.timing(vinylAnim, {
          toValue: 1,
          duration: 800,
          delay: 150,
          useNativeDriver: true,
          easing: cinematicEasing,
        })
      ]).start(() => {
        // Fetch tracklist & details after animation completes to prevent UI jank
        setIsTracksLoading(true);
        getAlbumExtraDetails(album.ALBUM_ID, album.ARTIST, album.TITLE).then(details => {
          if (details.tracks && details.tracks.length > 0) setTracks(details.tracks);
          if (details.marketPrice) setMarketPrice(details.marketPrice);
          else if (!marketPrice && !(album as any).MARKET_PRICE) setMarketPrice(-1);
          if (details.releaseDate) setReleaseDate(details.releaseDate);
          if (details.copyright) setCopyright(details.copyright);
          if (details.notes) setNotes(details.notes);
        }).finally(() => {
          setIsTracksLoading(false);
        });

        // Start infinite spin after vinyl slides out
        Animated.loop(
          Animated.timing(spinAnim, {
            toValue: 1,
            duration: 10000, // 10 seconds for a full rotation
            useNativeDriver: true,
            easing: Easing.linear
          })
        ).start();
      });
    }
  }, [visible, album]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(vinylAnim, { toValue: 0, duration: 400, useNativeDriver: true, easing: cinematicEasing }),
      Animated.timing(modalAnim, { toValue: 0, duration: 500, delay: 50, useNativeDriver: true, easing: cinematicEasing }),
      Animated.timing(panY, { toValue: height, duration: 500, useNativeDriver: true, easing: cinematicEasing })
    ]).start(() => {
      onClose();
    });
  };

  const handleYoutubeListen = async () => {
    if (!album) return;
    const query = `${album.ARTIST} ${album.TITLE} full album`;
    const results = await searchYouTube(query);
    if (results && results.length > 0 && results[0]) {
      Linking.openURL(`https://www.youtube.com/watch?v=${results[0]}`);
    } else {
      Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
    }
  };

  const handleDiscogsSearch = async () => {
    if (!album) return;
    const query = `${album.ARTIST} ${album.TITLE}`;
    Linking.openURL(`https://www.discogs.com/search/?q=${encodeURIComponent(query)}`);
  };

  const handleShareLink = async () => {
    if (!album) {
      setShareSheetVisible(false);
      return;
    }
    try {
      setIsSharingProcessing(true);
      const baseUrl = process.env.EXPO_PUBLIC_WEB_URL || 'https://vinyla.vercel.app';
      const link = `${baseUrl}/collection?album=${album.ALBUM_ID}`;
      await Share.share({
        message: `🎧 ${album.ARTIST} - ${album.TITLE}\n\n${link}`,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSharingProcessing(false);
      setShareSheetVisible(false);
    }
  };

  const handleImageShare = async () => {
    try {
      setIsSharingProcessing(true);
      await shareToInstagramStory(shareViewRef);
    } catch (e) {
      console.error('Failed to share image', e);
      showAlert(t('common.error'), t('mobile.detail.imageShareFailed'));
    } finally {
      setIsSharingProcessing(false);
      setShareSheetVisible(false);
    }
  };

  const formatNumberWithCommas = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    if (!numericValue) return '';
    return parseInt(numericValue, 10).toLocaleString('ko-KR');
  };

  const handleEditPrice = () => {
    setIsEditingPriceOnly(true);
    setPriceInputValue(purchasePrice ? formatNumberWithCommas(String(purchasePrice)) : '');
    setPricePromptVisible(true);
  };

  const syncAlbumMasterIfNeeded = async (numericAlbumId: number, finalGenres: string[]) => {
    let master = await getAlbumMaster(numericAlbumId);
    // LP 재킷 고정 원칙(웹 DetailModal과 동일): 마스터에 커버가 없을 때만 채워넣는다.
    const isNewImageBetter = !!album!.IMAGE_URL && !master?.IMAGE_URL;
    
    // Web앱과 동일한 조건: master가 없거나, 장르 태그가 누락되었거나(단순 'Vinyl'만 있는 경우 포함), 이미지가 더 좋은 경우 ALBUM_MASTER 업데이트
    if (!master || !master.GENRES || master.GENRES.length === 0 || (master.GENRES.length === 1 && master.GENRES[0] === 'Vinyl') || (marketPrice && !master.MARKET_PRICE) || isNewImageBetter) {
      await createAlbumMaster({
        ALBUM_ID: numericAlbumId,
        TITLE: album!.TITLE,
        ARTIST: album!.ARTIST,
        RELEASE_YEAR: album!.RELEASE_YEAR,
        IMAGE_URL: album!.IMAGE_URL,
        VINYL_IMAGE_URL: album!.VINYL_IMAGE_URL || master?.VINYL_IMAGE_URL || '',
        CUSTOM_COLOR_HEX: album!.CUSTOM_COLOR_HEX || master?.CUSTOM_COLOR_HEX || '#000',
        CUSTOM_STYLE_TYPE: master?.CUSTOM_STYLE_TYPE || 'SOLID',
        TRACKS: tracks.length > 0 ? tracks : (master?.TRACKS || []),
        GENRES: finalGenres,
        MARKET_PRICE: marketPrice || master?.MARKET_PRICE || 0
      });
    }
  };

  const executeSaveAlbum = async (finalPrice: number) => {
    if (!album || !user) return;
    try {
      const finalGenres = (album.GENRES || []).filter(g => {
        const EXCLUDED_TAGS = ['South Korea', 'Japan', 'US', 'UK', 'Europe', 'Germany', 'France', 'Netherlands', 'Canada', 'Australia', 'Italy', 'Sweden', 'Taiwan', 'Brazil', 'Russia', 'Vinyl', 'LP', 'Album'];
        return !EXCLUDED_TAGS.includes(g);
      });

      const numericAlbumId = Number(album.ALBUM_ID);
      await syncAlbumMasterIfNeeded(numericAlbumId, finalGenres);

      const result = await upsertUserVinyl({
        USER_ID: user.id,
        ALBUM_ID: numericAlbumId,
        STATUS: 'OWNED',
        PURCHASE_DATE: new Date().toISOString(),
        PURCHASE_PRICE: finalPrice
      });

      setPurchasePrice(finalPrice);
      setRealStatus('OWNED');
      showAlert(
        t('mobile.detail.successTitle'),
        result?.isFirstEverSave ? t('detail.firstSaveCelebration') : t('mobile.detail.savedToCollection'),
        () => handleClose()
      );
    } catch (error) {
      console.error('Error saving album to collection:', error);
      showAlert(t('common.error'), getErrorMessage(error, t));
    }
  };

  const executeUpdatePriceOnly = async (finalPrice: number) => {
    if (!album || !user) return;
    try {
      await upsertUserVinyl({
        USER_ID: user.id,
        ALBUM_ID: Number(album.ALBUM_ID),
        STATUS: 'OWNED',
        PURCHASE_PRICE: finalPrice
      });
      setPurchasePrice(finalPrice);
      showAlert(t('mobile.detail.priceSavedTitle'), t('detail.priceSaved'), () => handleClose());
    } catch (e) {
      console.error(e);
      showAlert(t('common.error'), getErrorMessage(e, t));
    }
  };

  const handlePriceSubmit = (skipped: boolean) => {
    setPricePromptVisible(false);
    const numericPrice = skipped ? (purchasePrice || 0) : (Number(priceInputValue.replace(/[^0-9]/g, '')) || 0);
    
    if (isEditingPriceOnly) {
      executeUpdatePriceOnly(numericPrice);
    } else {
      executeSaveAlbum(numericPrice);
    }
  };



  const handleSave = async (status: 'OWNED' | 'WISH') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!album) return;

    if (!user) {
      showAlert(t('common.error'), t('detail.loginRequired'));
      return;
    }

    if (status === 'OWNED') {
      setIsEditingPriceOnly(false);
      setPriceInputValue(purchasePrice ? formatNumberWithCommas(String(purchasePrice)) : '');
      setPricePromptVisible(true);
    } else {
      try {
        const numericAlbumId = Number(album.ALBUM_ID);
        const finalGenres = (album.GENRES || []).filter(g => {
          const EXCLUDED_TAGS = ['South Korea', 'Japan', 'US', 'UK', 'Europe', 'Germany', 'France', 'Netherlands', 'Canada', 'Australia', 'Italy', 'Sweden', 'Taiwan', 'Brazil', 'Russia', 'Vinyl', 'LP', 'Album'];
          return !EXCLUDED_TAGS.includes(g);
        });
        
        await syncAlbumMasterIfNeeded(numericAlbumId, finalGenres);

        const result = await upsertUserVinyl({
          USER_ID: user.id,
          ALBUM_ID: numericAlbumId,
          STATUS: 'WISH',
          PURCHASE_PRICE: 0
        });
        setRealStatus('WISH');
        showAlert(
          t('mobile.detail.successTitle'),
          result?.isFirstEverSave ? t('detail.firstSaveCelebration') : t('mobile.detail.savedToWish'),
          () => handleClose()
        );
      } catch (error) {
        console.error('Error saving album to wish:', error);
        showAlert(t('common.error'), getErrorMessage(error, t));
      }
    }
  };

  const handleDelete = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!album) return;
    if (!user) {
      showAlert(t('common.error'), t('detail.loginRequired'));
      return;
    }
    try {
      await deleteUserVinylByAlbum(user.id, Number(album.ALBUM_ID));
      setRealStatus('NONE');
      showAlert(t('mobile.detail.successTitle'), t('mobile.detail.deletedFromCollection'), () => {
        handleClose();
      });
    } catch (e) {
      console.error(e);
      showAlert(t('common.error'), getErrorMessage(e, t));
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10 && gestureState.y0 < height * 0.4;
      },
      onPanResponderMove: Animated.event([null, { dy: panY }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          handleClose();
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  if (!album) return null;

  const coverTranslateX = vinylAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -35] });
  const vinylTranslateX = vinylAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 95] });
  const vinylRotate = vinylAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  const spinRotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const modalScale = modalAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] });

  const EXCLUDED_TAGS = ['South Korea', 'Japan', 'US', 'UK', 'Europe', 'Germany', 'France', 'Netherlands', 'Canada', 'Australia', 'Italy', 'Sweden', 'Taiwan', 'Brazil', 'Russia', 'Vinyl', 'LP', 'Album'];
  const genres = album.GENRES || [];
  const genreTags = genres.filter(tag => !EXCLUDED_TAGS.includes(tag)).slice(0, 4); // Only display top 4 genres

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
      <Animated.View style={[styles.container, { opacity: modalAnim }]}>
        <BlurView intensity={glassIntensity || 30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) }}>
          <Animated.View 
            style={[{ flex: 1, transform: [{ scale: modalScale }, { translateY: panY }] }]}
            {...panResponder.panHandlers}
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setShareSheetVisible(true)} style={styles.shareBtn}>
                <Feather name="share-2" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bounces={false}>
            <Animated.View style={[styles.coverContainer, { transform: [{ translateX: coverTranslateX }] }]}>
              <Animated.View 
                style={[
                  styles.vinyl, 
                  { 
                    transform: [
                      { translateX: vinylTranslateX },
                      { rotate: vinylRotate },
                      { rotate: spinRotate }
                    ] 
                  }
                ]} 
              >
                <View style={styles.vinylGrooves} />
                <View style={styles.vinylGrooves2} />
                <View style={[styles.vinylLabel, { backgroundColor: album.CUSTOM_COLOR_HEX || '#222' }]}>
                  <Image 
                    source={album.IMAGE_URL ? { uri: album.IMAGE_URL } : require('../../../assets/logo_real_transparent.png')} 
                    style={StyleSheet.absoluteFill} 
                    resizeMode={album.IMAGE_URL ? "cover" : "contain"}
                  />
                  <View style={styles.vinylHole} />
                </View>
              </Animated.View>
              <Image 
                source={album.IMAGE_URL ? { uri: album.IMAGE_URL } : require('../../../assets/logo_real_transparent.png')} 
                style={[styles.cover, !album.IMAGE_URL && { padding: 40, backgroundColor: '#161616', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }]} 
                resizeMode={album.IMAGE_URL ? "cover" : "contain"}
              />
            </Animated.View>

            <View style={styles.info}>
              <Text style={styles.title}>{album.TITLE}</Text>
              <Text style={styles.artist}>{album.ARTIST} • {album.RELEASE_YEAR}</Text>

              {/* Price Section */}
              <View style={styles.priceContainer}>
                <View style={styles.priceRow}>
                  <FontAwesome5 name="coins" size={14} color="#e9c349" />
                  <Text style={styles.marketPriceText}>{t('detail.marketPrice')} {marketPrice === -1 ? t('detail.marketPriceUnknown') : marketPrice ? `₩${marketPrice.toLocaleString()}` : t('common.loading')}</Text>
                </View>
                {realStatus === 'OWNED' && (
                  <TouchableOpacity onPress={handleEditPrice} style={[styles.priceRow, { marginTop: 6 }]}>
                    <FontAwesome5 name="receipt" size={14} color="#aaa" />
                    <Text style={styles.actualPriceText}>
                      {t('detail.actualPrice')} {purchasePrice ? `₩${purchasePrice.toLocaleString()}` : t('detail.notEntered')}
                    </Text>
                    <FontAwesome5 name="edit" size={12} color="#888" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Tags Section */}
              {(genreTags.length > 0) && (
                <View style={styles.tagsContainer}>
                  {genreTags.map((tag, i) => (
                    <View key={`g-${i}`} style={styles.tagBadge}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.tracklist}>
                <Text style={styles.tracklistHeader}>Tracklist</Text>
                {isTracksLoading ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#e9c349" />
                    <Text style={[styles.track, { textAlign: 'center', borderBottomWidth: 0, marginTop: 10, color: '#888' }]}>{t('mobile.detail.tracklistLoading')}</Text>
                  </View>
                ) : tracks.length > 0 ? tracks.map((track, i) => (
                  <Text key={i} style={styles.track}>{String(i + 1).padStart(2, '0')}. {track}</Text>
                )) : (
                  <Text style={[styles.track, { textAlign: 'center', borderBottomWidth: 0 }]}>{t('mobile.detail.noTracklist')}</Text>
                )}
              </View>

              {/* Extra Details */}
              {(releaseDate || copyright || notes) && (
                <View style={styles.extraDetailsContainer}>
                  {releaseDate && <Text style={styles.extraDetailText}><Text style={styles.extraDetailLabel}>{t('detail.releaseDate')}</Text> {releaseDate}</Text>}
                  {copyright && <Text style={styles.extraDetailText}><Text style={styles.extraDetailLabel}>{t('detail.label')}</Text> {copyright}</Text>}
                  {notes && <Text style={styles.extraNotes}>{notes}</Text>}
                </View>
              )}
            </View>

            {realStatus !== 'OWNED' && (
              <View style={styles.actions}>
                {realStatus === 'WISH' ? (
                  <AnimatedButton
                    style={styles.btnPrimary}
                    onPress={() => handleSave('OWNED')}
                  >
                    <Text style={styles.btnPrimaryText}>{t('detail.addToCollection')}</Text>
                  </AnimatedButton>
                ) : (
                  <>
                    <AnimatedButton
                      style={styles.btnPrimary}
                      onPress={() => handleSave('OWNED')}
                    >
                      <Text style={styles.btnPrimaryText}>{t('mobile.detail.addToCollectionNew')}</Text>
                    </AnimatedButton>
                    <AnimatedButton
                      style={styles.btnOutline}
                      onPress={() => handleSave('WISH')}
                    >
                      <Text style={styles.btnOutlineText}>{t('mobile.detail.addToWishlistBtn')}</Text>
                    </AnimatedButton>
                  </>
                )}
              </View>
            )}
            
            <View style={{ marginTop: realStatus === 'OWNED' ? 30 : 0 }}>
              <AnimatedButton 
                style={[styles.btnYoutube, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                onPress={handleYoutubeListen}
                isHeavy
              >
                <FontAwesome5 name="youtube" size={18} color="#fff" />
                <Text style={[styles.btnYoutubeText, { marginLeft: 8 }]}>{t('mobile.detail.listenOnYoutube')}</Text>
              </AnimatedButton>
              <AnimatedButton
                style={[styles.btnYoutube, { backgroundColor: '#333', marginTop: 10 }]}
                onPress={handleDiscogsSearch}
                isHeavy
              >
                <Text style={styles.btnYoutubeText}>{t('mobile.detail.searchOnDiscogs')}</Text>
              </AnimatedButton>
            </View>

            {(realStatus === 'OWNED' || realStatus === 'WISH') && (
              <View style={[styles.actions, { marginTop: 10 }]}>
                {realStatus === 'OWNED' ? (
                  <AnimatedButton
                    style={[styles.btnPrimary, { backgroundColor: '#d32f2f', borderColor: '#d32f2f' }]}
                    onPress={handleDelete}
                  >
                    <Text style={styles.btnPrimaryText}>{t('detail.removeFromCollection')}</Text>
                  </AnimatedButton>
                ) : (
                  <AnimatedButton
                    style={[styles.btnOutline, { borderColor: '#d32f2f', flex: 1 }]}
                    onPress={handleDelete}
                  >
                    <Text style={[styles.btnOutlineText, { color: '#d32f2f' }]}>{t('detail.removeFromWishlist')}</Text>
                  </AnimatedButton>
                )}
              </View>
            )}
          </ScrollView>
            </Animated.View>
          </View>

        <View style={styles.offscreenShare} pointerEvents="none">
          <ShareableStoryView
            ref={shareViewRef}
            album={album}
            username={user?.user_metadata?.displayName || t('common.defaultCollectorName')}
          />
        </View>

        <ShareOptionsSheet
          visible={isShareSheetVisible}
          onClose={() => setShareSheetVisible(false)}
          title={t('mobile.detail.shareSheetTitle')}
          isProcessing={isSharingProcessing}
          onShareLink={handleShareLink}
          onImageShare={handleImageShare}
        />

        <CustomAlert
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          onClose={() => {
            setAlertVisible(false);
            if (onAlertClose) onAlertClose();
          }}
        />
        {pricePromptVisible && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }]}
          >
            <BlurView intensity={glassIntensity || 30} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={{ width: '75%', padding: 24, borderRadius: 24, backgroundColor: 'rgba(20,20,20,0.8)', borderWidth: 1, borderColor: themeColors.border, alignItems: 'center' }}>
              <Text style={{ color: themeColors.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>{t('detail.priceInputTitle')}</Text>
              <Text style={{ color: themeColors.textSecondary, fontSize: 14, marginBottom: 20, textAlign: 'center' }}>{t('mobile.detail.priceInputQuestionShort')}</Text>
              <TextInput
                style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', color: themeColors.textPrimary, padding: 16, borderRadius: 12, fontSize: 18, textAlign: 'center', marginBottom: 24, borderWidth: 1, borderColor: themeColors.border }}
                keyboardType="numeric"
                keyboardAppearance="dark"
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={priceInputValue}
                autoFocus={true}
                onChangeText={(text) => setPriceInputValue(formatNumberWithCommas(text))}
              />
              <View style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
                <TouchableOpacity 
                  style={{ flex: 1, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} 
                  onPress={() => handlePriceSubmit(true)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: themeColors.textSecondary, fontSize: 16, fontWeight: 'bold' }}>{t('mobile.detail.skipBtn')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 14, backgroundColor: themeColors.accent, borderRadius: 16, alignItems: 'center' }}
                  onPress={() => handlePriceSubmit(false)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#000', fontSize: 16, fontWeight: 'bold' }}>{t('mobile.detail.saveBtn')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </Animated.View>
    </Modal>
  );
};

const getStyles = (themeColors: any, shadows: any, shape: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  offscreenShare: {
    position: 'absolute',
    top: -9999,
    left: 0,
  },
  scroll: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    width: '100%',
  },
  shareBtn: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 30,
  },
  closeBtn: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 30,
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  coverContainer: {
    width: width * 0.55,
    height: width * 0.55,
    alignSelf: 'center',
    marginBottom: 24,
    position: 'relative',
    ...shadows.strong,
  },
  cover: {
    width: '100%',
    height: '100%',
    borderRadius: shape.sm,
    zIndex: 2,
    ...shadows.medium,
  },
  vinyl: {
    position: 'absolute',
    top: '2%',
    left: '2%',
    width: '96%',
    height: '96%',
    borderRadius: 1000,
    zIndex: 1,
    backgroundColor: '#0e0e0e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)', // Softer border
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  vinylGrooves: {
    position: 'absolute',
    width: '85%',
    height: '85%',
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  vinylGrooves2: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  vinylLabel: {
    width: '45%',
    height: '45%',
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  vinylHole: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  info: {
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  artist: {
    color: '#a0a0a0',
    fontSize: 15,
    marginTop: 6,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  tracklist: {
    width: '100%',
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: shape.md,
    padding: 16,
    paddingBottom: 8,
  },
  track: {
    color: '#ddd',
    fontSize: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    gap: 12,
  },
  btnPrimary: {
    flex: 1,
    height: BUTTON_HEIGHT,
    backgroundColor: '#F0E6D2',
    paddingHorizontal: 16,
    borderRadius: shape.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  btnPrimaryText: {
    color: '#0a0a0a',
    fontWeight: '800',
    fontSize: 15,
  },
  btnOutline: {
    flex: 1,
    height: BUTTON_HEIGHT,
    backgroundColor: 'rgba(197, 160, 89, 0.05)', // Softer inner glow
    paddingHorizontal: 16,
    borderRadius: shape.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197, 160, 89, 0.15)',
  },
  btnOutlineText: {
    color: '#F0E6D2',
    fontWeight: '700',
    fontSize: 15,
  },
  btnYoutube: {
    height: BUTTON_HEIGHT,
    backgroundColor: 'rgba(180, 50, 50, 0.85)',
    paddingHorizontal: 16,
    borderRadius: shape.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    ...shadows.soft,
  },
  btnYoutubeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 1,
  },
  priceContainer: {
    marginTop: 20,
    width: '100%',
    paddingHorizontal: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  marketPriceText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  actualPriceText: {
    color: '#ccc',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    width: '100%',
    gap: 8,
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: shape.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tagText: {
    color: '#ddd',
    fontSize: 12,
    fontWeight: '600',
  },
  tracklistHeader: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  extraDetailsContainer: {
    marginTop: 20,
    width: '100%',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: shape.md,
  },
  extraDetailText: {
    color: '#bbb',
    fontSize: 13,
    marginBottom: 6,
  },
  extraDetailLabel: {
    color: '#fff',
    fontWeight: 'bold',
  },
  extraNotes: {
    color: '#999',
    fontSize: 12,
    marginTop: 10,
    fontStyle: 'italic',
    lineHeight: 18,
  }
});
