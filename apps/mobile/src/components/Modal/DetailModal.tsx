import React, { useEffect, useRef } from 'react';
import { Alert, View, Text, StyleSheet, Modal, Image, TouchableOpacity, Animated, ScrollView, Dimensions, PanResponder, Linking, Easing, Pressable, ActivityIndicator, TextInput, Share, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { MockVinylData, AlbumTrack } from '@vinyla/shared-types';
import * as Haptics from 'expo-haptics';
import { FontAwesome5, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { searchYouTube, createAlbumMaster, upsertUserVinyl, getAlbumMaster, useAuthStore, getAlbumExtraDetails, deleteUserVinylByAlbum, getUserVinyls, getErrorMessage, updateAlbumMasterImage, uploadUserCover, setUserVinylCover, revertAlbumMasterCover, logSpin, getDiscogsReleaseVersions, updateUserVinylReleaseId, DiscogsReleaseVersion, getCustomPressingsForAlbum, getCustomPressingById, createCustomPressing, updateCustomPressing, deleteCustomPressing, selectCustomPressing, CustomPressing, communityAlbumHasOtherAdopters } from '@vinyla/core-api';
import { useTheme, shadows, shape } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { CustomAlert } from '../../providers/AlertProvider';
import { ShareableStoryView } from '../Share/ShareableStoryView';
import { ShareOptionsSheet } from './ShareOptionsSheet';
import { SpinLogEditorModal } from './SpinLogEditorModal';
import { CoverPickerModal } from './CoverPickerModal';
import { shareToInstagramStory } from '../../utils/nativeShare';

interface DetailModalProps {
  album: MockVinylData | null;
  visible: boolean;
  onClose: () => void;
  // Alternate covers for Aladin-sourced search results only (Apple Music is
  // already the default in `album.IMAGE_URL`) — lets the user pick instead
  // of silently locking in whichever source the search happened to prefer.
  coverCandidates?: { appleMusic?: string; aladin?: string; discogs?: string };
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

export const DetailModal = ({ album, visible, onClose, coverCandidates }: DetailModalProps) => {
  const navigation = useNavigation<NavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const vinylAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  const [tracks, setTracks] = React.useState<AlbumTrack[]>([]);
  const [isTracksLoading, setIsTracksLoading] = React.useState<boolean>(false);
  // true일 때만 "정확한 실물반" 트랙(사이드 포함) — false면 디지털 소스
  // 폴백(마스터 대표 트랙/iTunes/Apple/Deezer)이라 실제 소장반과 다를 수 있다.
  const [isExactRelease, setIsExactRelease] = React.useState(false);
  const [releaseId, setReleaseId] = React.useState<number | undefined>(
    album?.DISCOGS_RELEASE_ID ? Number(album.DISCOGS_RELEASE_ID) : undefined
  );
  const [pressingPickerOpen, setPressingPickerOpen] = React.useState(false);
  const [pressingVersions, setPressingVersions] = React.useState<DiscogsReleaseVersion[]>([]);
  const [isLoadingPressings, setIsLoadingPressings] = React.useState(false);
  const [customPressingId, setCustomPressingId] = React.useState<number | undefined>(
    album?.CUSTOM_PRESSING_ID ? Number(album.CUSTOM_PRESSING_ID) : undefined
  );
  const [activeCustomPressing, setActiveCustomPressing] = React.useState<CustomPressing | null>(null);
  const [communityPressings, setCommunityPressings] = React.useState<CustomPressing[]>([]);
  const [showCustomPressingForm, setShowCustomPressingForm] = React.useState(false);
  const [customFormTitle, setCustomFormTitle] = React.useState('');
  const [customFormIsPublic, setCustomFormIsPublic] = React.useState(true);
  const [customFormSides, setCustomFormSides] = React.useState<{ heading: string; tracks: string[] }[]>([
    { heading: 'A Side', tracks: [''] },
  ]);
  const [isSubmittingCustomPressing, setIsSubmittingCustomPressing] = React.useState(false);
  const [editingPressingId, setEditingPressingId] = React.useState<number | null>(null);
  const [deletingPressing, setDeletingPressing] = React.useState<CustomPressing | null>(null);
  const [isDeletingPressing, setIsDeletingPressing] = React.useState(false);
  const [realStatus, setRealStatus] = React.useState<string | null>(null);
  // 스피닝 다이어리 작성 (웹 SpinLogModal 파리티 — 기분+메모+미디어+공개여부)
  const [isSpinModalOpen, setIsSpinModalOpen] = React.useState(false);

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
  // 커뮤니티 등록 앨범 전용: 등록자 본인이고, 아직 다른 유저가 담지 않았을
  // 때만 "수정하기" 링크를 보여준다.
  const [communityLocked, setCommunityLocked] = React.useState(true);

  // Cover photo state
  const [isUploadingCover, setIsUploadingCover] = React.useState(false);
  const [myPhoto, setMyPhoto] = React.useState<string | null>(null);
  const [masterImage, setMasterImage] = React.useState<string | null>(null);
  const [coverUrl, setCoverUrl] = React.useState<string>('');
  // Shown when the user actually chooses to save a fresh album (not on every
  // open) — see handleSave below. Also reachable via the "앨범 재킷 변경" button.
  const [coverPickerOpen, setCoverPickerOpen] = React.useState(false);
  // What to do once the user resolves the picker — only set while a fresh
  // (never-saved) album's save is pending.
  const [pendingSaveAction, setPendingSaveAction] = React.useState<'OWNED' | 'WISH' | null>(null);


  const { user } = useAuthStore();

  const [isShareSheetVisible, setShareSheetVisible] = React.useState(false);
  const [shareTag, setShareTag] = React.useState<string>(album?.STATUS || 'NONE');
  const [isSharingProcessing, setIsSharingProcessing] = React.useState(false);
  const shareViewRef = useRef<View>(null);

  useEffect(() => {
    if (visible && album) {
      setTracks([]);
      setIsExactRelease(false);
      setActiveCustomPressing(null);
      setReleaseId(album.DISCOGS_RELEASE_ID ? Number(album.DISCOGS_RELEASE_ID) : undefined);
      setCustomPressingId(album.CUSTOM_PRESSING_ID ? Number(album.CUSTOM_PRESSING_ID) : undefined);
      setPurchasePrice((album as any).PURCHASE_PRICE || null);
      setMarketPrice((album as any).MARKET_PRICE || null);
      setReleaseDate('');
      setCopyright('');
      setNotes('');
      setMyPhoto((album as any).CUSTOM_IMAGE_URL || null);
      setMasterImage(album.IMAGE_URL || null);
      setCoverUrl(album.IMAGE_URL || '');
      setCoverPickerOpen(false);
      setPendingSaveAction(null);
      setShareTag(album.STATUS || 'NONE');

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
            setShareTag(found.STATUS);
            setPurchasePrice(found.PURCHASE_PRICE || null);
            setMyPhoto(found.CUSTOM_IMAGE_URL || null);
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
        const albumSource = (album as any).SOURCE;
        const customPressingIdAtFetch = album.CUSTOM_PRESSING_ID ? Number(album.CUSTOM_PRESSING_ID) : undefined;
        if (albumSource && albumSource !== 'DISCOGS') {
          // 커뮤니티 등록(위키형) 앨범이면 등록 시 저장된 트랙을 그대로 쓴다 —
          // Discogs/디지털 소스 자체가 없는 앨범이라 외부 조회가 의미 없다.
          setTracks((album as any).COMMUNITY_TRACKS || []);
          setIsExactRelease(true);
          setIsTracksLoading(false);
          // Discogs 매물이 없는 앨범이라 시장가를 조회할 대상 자체가 없다 —
          // '불러오는 중...'에 영원히 머무르지 않도록 명시적으로 '정보 없음' 처리.
          if (!marketPrice && !(album as any).MARKET_PRICE) setMarketPrice(-1);
          // 등록자 본인일 때만 "수정하기" 노출 여부를 확인 — 다른 유저가 이미
          // 담았으면 RLS도 수정을 막으므로 미리 잠금 상태를 알아둔다.
          if (user?.id && user.id === (album as any).SUBMITTED_BY) {
            communityAlbumHasOtherAdopters(Number(album.ALBUM_ID)).then(setCommunityLocked);
          } else {
            setCommunityLocked(true);
          }
        } else if (customPressingIdAtFetch) {
          // 커뮤니티 프레싱을 골랐으면 그 트랙을 그대로 쓴다 — Discogs/디지털
          // 소스 조회 자체가 필요 없다.
          getCustomPressingById(customPressingIdAtFetch).then((p) => {
            if (p) {
              setTracks(p.TRACKS);
              setIsExactRelease(true);
              setActiveCustomPressing(p);
            }
          }).finally(() => setIsTracksLoading(false));
        } else {
          const releaseIdAtFetch = album.DISCOGS_RELEASE_ID ? Number(album.DISCOGS_RELEASE_ID) : undefined;
          getAlbumExtraDetails(album.ALBUM_ID, album.ARTIST, album.TITLE, releaseIdAtFetch).then(details => {
            if (details.tracks && details.tracks.length > 0) {
              setTracks(details.tracks);
              setIsExactRelease(!!details.isExactRelease);
            }
            if (details.marketPrice) setMarketPrice(details.marketPrice);
            else if (!marketPrice && !(album as any).MARKET_PRICE) setMarketPrice(-1);
            if (details.releaseDate) setReleaseDate(details.releaseDate);
            if (details.copyright) setCopyright(details.copyright);
            if (details.notes) setNotes(details.notes);
          }).finally(() => {
            setIsTracksLoading(false);
          });
        }

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

  React.useEffect(() => {
    if (!myPhoto || masterImage !== null) return;
    let alive = true;
    getAlbumMaster(Number(album?.ALBUM_ID))
      .then((m) => { if (alive) setMasterImage(m?.IMAGE_URL || ''); })
      .catch(() => {});
    return () => { alive = false; };
  }, [myPhoto, masterImage, album]);

  const coverScope = myPhoto && masterImage === myPhoto ? 'everyone' : 'mine';

  // 사이드 정보(A/B/...)가 하나라도 있으면 사이드별로 묶어서 보여주고,
  // 전부 없으면(디지털 폴백 소스) 기존처럼 평평한 번호 목록으로 표시한다.
  const trackSideGroups = React.useMemo(() => {
    if (!tracks.some((tr) => tr.side)) return null;
    const groups: { side: string; tracks: AlbumTrack[] }[] = [];
    for (const tr of tracks) {
      const side = tr.side || '';
      const last = groups[groups.length - 1];
      if (last && last.side === side) last.tracks.push(tr);
      else groups.push({ side, tracks: [tr] });
    }
    return groups;
  }, [tracks]);

  const openPressingPicker = async () => {
    if (!album) return;
    setPressingPickerOpen(true);
    if (pressingVersions.length === 0) {
      setIsLoadingPressings(true);
      getDiscogsReleaseVersions(album.ALBUM_ID, album.TITLE)
        .then(setPressingVersions)
        .finally(() => setIsLoadingPressings(false));
    }
    getCustomPressingsForAlbum(album.ALBUM_ID).then(setCommunityPressings).catch(() => {});
  };

  // 유저가 "프레싱 선택"에서 자기 소장반을 직접 고르면 USER_VINYL에 반영하고
  // (이미 저장된 앨범일 때만 — 검색 중 미저장 앨범은 저장 시 반영됨) 그
  // release id로 트랙을 다시 조회한다.
  const handlePickPressing = async (version: DiscogsReleaseVersion) => {
    if (!album) return;
    setPressingPickerOpen(false);
    if ((album as any).USER_VINYL_ID) {
      await updateUserVinylReleaseId(Number((album as any).USER_VINYL_ID), version.releaseId).catch(() => {});
    }
    setCustomPressingId(undefined);
    setReleaseId(version.releaseId);
    setIsTracksLoading(true);
    try {
      const details = await getAlbumExtraDetails(album.ALBUM_ID, album.ARTIST, album.TITLE, version.releaseId);
      if (details.tracks.length > 0) {
        setTracks(details.tracks);
        setIsExactRelease(!!details.isExactRelease);
      }
    } finally {
      setIsTracksLoading(false);
    }
  };

  const handlePickCustomPressing = async (pressing: CustomPressing) => {
    if (!album) return;
    setPressingPickerOpen(false);
    if ((album as any).USER_VINYL_ID) {
      await selectCustomPressing(Number((album as any).USER_VINYL_ID), pressing.PRESSING_ID).catch(() => {});
    }
    setReleaseId(undefined);
    setCustomPressingId(pressing.PRESSING_ID);
    setTracks(pressing.TRACKS);
    setIsExactRelease(true);
    setActiveCustomPressing(pressing);
  };

  const addCustomFormSide = () => {
    setCustomFormSides((prev) => [...prev, { heading: `${String.fromCharCode(65 + prev.length)} Side`, tracks: [''] }]);
  };
  const addCustomFormTrack = (sideIdx: number) => {
    setCustomFormSides((prev) => prev.map((s, i) => (i === sideIdx ? { ...s, tracks: [...s.tracks, ''] } : s)));
  };
  const removeCustomFormTrack = (sideIdx: number, trackIdx: number) => {
    setCustomFormSides((prev) => prev.map((s, i) => (i === sideIdx ? { ...s, tracks: s.tracks.filter((_, ti) => ti !== trackIdx) } : s)));
  };
  const removeCustomFormSide = (sideIdx: number) => {
    setCustomFormSides((prev) => prev.filter((_, i) => i !== sideIdx));
  };

  const resetCustomForm = () => {
    setShowCustomPressingForm(false);
    setEditingPressingId(null);
    setCustomFormTitle('');
    setCustomFormIsPublic(true);
    setCustomFormSides([{ heading: 'A Side', tracks: [''] }]);
  };

  const startCreatePressing = () => {
    resetCustomForm();
    setShowCustomPressingForm(true);
  };

  // 기존 트랙(side별 평평한 배열)을 폼이 쓰는 "사이드 묶음" 구조로 되돌린다 —
  // 화면에 보여줄 때 쓰는 trackSideGroups와 같은 묶기 로직.
  const startEditPressing = (p: CustomPressing) => {
    const groups: { heading: string; tracks: string[] }[] = [];
    for (const track of p.TRACKS) {
      const heading = track.side || 'A Side';
      const last = groups[groups.length - 1];
      if (last && last.heading === heading) last.tracks.push(track.title);
      else groups.push({ heading, tracks: [track.title] });
    }
    setEditingPressingId(p.PRESSING_ID);
    setCustomFormTitle(p.TITLE);
    setCustomFormIsPublic(p.IS_PUBLIC);
    setCustomFormSides(groups.length > 0 ? groups : [{ heading: 'A Side', tracks: [''] }]);
    setShowCustomPressingForm(true);
  };

  const confirmDeletePressing = async () => {
    if (!album || !deletingPressing || isDeletingPressing) return;
    setIsDeletingPressing(true);
    try {
      await deleteCustomPressing(deletingPressing.PRESSING_ID);
      const fresh = await getCustomPressingsForAlbum(album.ALBUM_ID);
      setCommunityPressings(fresh);
      if (customPressingId === deletingPressing.PRESSING_ID) {
        setCustomPressingId(undefined);
        setActiveCustomPressing(null);
      }
      setDeletingPressing(null);
    } catch (e) {
      showAlert(t('common.error'), getErrorMessage(e, t));
    } finally {
      setIsDeletingPressing(false);
    }
  };

  const handleSubmitCustomPressing = async () => {
    if (!album || !user?.id || isSubmittingCustomPressing) return;
    const allTracks = customFormSides.flatMap((s) =>
      s.tracks.filter((tr) => tr.trim()).map((tr) => ({ side: s.heading.trim(), title: tr.trim() }))
    );
    if (!customFormTitle.trim() || allTracks.length === 0) {
      showAlert(t('common.error'), t('mobile.detail.customPressingIncomplete'));
      return;
    }
    setIsSubmittingCustomPressing(true);
    try {
      const pressingId = editingPressingId
        ? (await updateCustomPressing(editingPressingId, customFormTitle, allTracks, customFormIsPublic), editingPressingId)
        : await createCustomPressing(album.ALBUM_ID, user.id, customFormTitle, allTracks, customFormIsPublic);
      resetCustomForm();
      const fresh = await getCustomPressingsForAlbum(album.ALBUM_ID);
      setCommunityPressings(fresh);
      const affected = fresh.find((p) => p.PRESSING_ID === pressingId);
      if (affected && (pressingId === customPressingId || !editingPressingId)) {
        await handlePickCustomPressing(affected);
      }
    } catch (e) {
      showAlert(t('common.error'), getErrorMessage(e, t));
    } finally {
      setIsSubmittingCustomPressing(false);
    }
  };

  const restoreCatalogCover = async (numericAlbumId: number): Promise<string> => {
    const reverted = await revertAlbumMasterCover(numericAlbumId);
    if (reverted) return reverted;
    const details = await getAlbumExtraDetails(numericAlbumId, album!.ARTIST, album!.TITLE).catch(() => null);
    if (details?.highResCover) {
      await updateAlbumMasterImage(numericAlbumId, details.highResCover);
      return details.highResCover;
    }
    return '';
  };

  const handleCropConfirm = async (uri: string) => {
    if (!user?.id || isUploadingCover || !album) return;
    setIsUploadingCover(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const numericAlbumId = Number(album.ALBUM_ID);
      const url = await uploadUserCover(numericAlbumId, blob);
      setCoverUrl(url);
      if (pendingSaveAction) {
        // 아직 USER_VINYL 행이 없는 새 앨범 — setUserVinylCover(UPDATE)는
        // 대상 행이 없어 조용히 무시되므로, 곧 이어질 저장(payload의
        // CUSTOM_IMAGE_URL)에 실려서 함께 생성되도록 넘긴다.
        const action = pendingSaveAction;
        setPendingSaveAction(null);
        proceedWithSave(action);
      } else {
        await setUserVinylCover(user.id, numericAlbumId, url);
        setMyPhoto(url);
        showAlert(t('mobile.detail.successTitle') || 'Success', t('detail.coverPhotoSaved') || '커버 사진이 저장되었습니다.');
      }
    } catch (e) {
      console.error('cover photo update failed', e);
      showAlert(t('common.error'), getErrorMessage(e, t));
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleCoverPhoto = async () => {
    if (!user?.id || isUploadingCover || !album) return;
    Alert.alert(
      t('mobile.detail.coverPhotoTitle') || '커버 사진 촬영',
      t('mobile.detail.coverPhotoDesc') || '사진을 어떻게 가져올까요?',
      [
        {
          text: t('mobile.detail.camera') || '카메라',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              showAlert(t('common.error'), '카메라 권한이 필요합니다.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              handleCropConfirm(result.assets[0].uri);
            }
          }
        },
        {
          text: t('mobile.detail.gallery') || '갤러리',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              showAlert(t('common.error'), '갤러리 접근 권한이 필요합니다.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              handleCropConfirm(result.assets[0].uri);
            }
          }
        },
        { text: t('common.cancel'), style: 'cancel' }
      ]
    );
  };

  const handleUseOriginalCover = async () => {
    if (!user?.id || !myPhoto || isUploadingCover || !album) return;
    setIsUploadingCover(true);
    try {
      const numericAlbumId = Number(album.ALBUM_ID);
      const restored = await restoreCatalogCover(numericAlbumId);
      await setUserVinylCover(user.id, numericAlbumId, null);
      setMyPhoto(null);
      if (restored) {
        setMasterImage(restored);
        showAlert(t('mobile.detail.successTitle') || 'Success', t('detail.coverUseOriginalDone') || '기존 커버로 복원되었습니다.');
      } else {
        showAlert(t('common.error'), t('detail.coverRestoreFailed') || '카탈로그 커버 복원에 실패했습니다.');
      }
    } catch (e) {
      showAlert(t('common.error'), getErrorMessage(e, t));
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleScopeChange = async (next: 'mine' | 'everyone') => {
    if (!user?.id || !myPhoto || isUploadingCover || next === coverScope || !album) return;
    setIsUploadingCover(true);
    try {
      const numericAlbumId = Number(album.ALBUM_ID);
      if (next === 'everyone') {
        await updateAlbumMasterImage(numericAlbumId, myPhoto);
        setMasterImage(myPhoto);
        showAlert(t('mobile.detail.successTitle') || 'Success', t('detail.coverScopeAppliedEveryone') || '마스터 커버로 적용되었습니다.');
      } else {
        const restored = await restoreCatalogCover(numericAlbumId);
        if (restored) {
          setMasterImage(restored);
          showAlert(t('mobile.detail.successTitle') || 'Success', t('detail.coverScopeRevertedMine') || '내 사진으로만 남도록 변경되었습니다.');
        } else {
          showAlert(t('common.error'), t('detail.coverRestoreFailed') || '카탈로그 커버 복원에 실패했습니다.');
        }
      }
    } catch (e) {
      showAlert(t('common.error'), getErrorMessage(e, t));
    } finally {
      setIsUploadingCover(false);
    }
  };

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

    // 검색 파이프라인 개선 전 저장된 마스터의 옛 커버 갱신 (웹 DetailModal과 동일):
    // 검색에서 새로 열어 저장할 때 지금 보이는 실물 LP 커버로 마스터를 교체한다.
    // 저장 전 커버 선택 모달에서 "직접 촬영"을 고른 경우 coverUrl 자체가 개인
    // 사진(Supabase Storage URL)일 수 있으므로, 공유 마스터에는 항상 원래
    // 카탈로그 이미지로 대체해 반영한다.
    const isPersonalPhoto = coverUrl.includes('supabase.co');
    const masterImageCandidate = isPersonalPhoto ? album!.IMAGE_URL : coverUrl;
    const isCatalogCover = !!masterImageCandidate &&
      !(album as any).CUSTOM_IMAGE_URL &&
      !masterImageCandidate.includes('supabase.co') &&
      !masterImageCandidate.includes('unsplash.com');
    if (master?.IMAGE_URL && isCatalogCover && masterImageCandidate !== master.IMAGE_URL) {
      await updateAlbumMasterImage(numericAlbumId, masterImageCandidate).catch(() => {});
    }
    // LP 재킷 고정 원칙(웹 DetailModal과 동일): 마스터에 커버가 없을 때만 채워넣는다.
    const isNewImageBetter = !!masterImageCandidate && !master?.IMAGE_URL;

    // Web앱과 동일한 조건: master가 없거나, 장르 태그가 누락되었거나(단순 'Vinyl'만 있는 경우 포함), 이미지가 더 좋은 경우 ALBUM_MASTER 업데이트
    if (!master || !master.GENRES || master.GENRES.length === 0 || (master.GENRES.length === 1 && master.GENRES[0] === 'Vinyl') || (marketPrice && !master.MARKET_PRICE) || isNewImageBetter) {
      await createAlbumMaster({
        ALBUM_ID: numericAlbumId,
        TITLE: album!.TITLE,
        ARTIST: album!.ARTIST,
        RELEASE_YEAR: album!.RELEASE_YEAR,
        IMAGE_URL: masterImageCandidate || album!.IMAGE_URL,
        VINYL_IMAGE_URL: album!.VINYL_IMAGE_URL || master?.VINYL_IMAGE_URL || '',
        CUSTOM_COLOR_HEX: album!.CUSTOM_COLOR_HEX || master?.CUSTOM_COLOR_HEX || '#000',
        CUSTOM_STYLE_TYPE: master?.CUSTOM_STYLE_TYPE || 'SOLID',
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
        ...(coverUrl.includes('supabase.co') ? { CUSTOM_IMAGE_URL: coverUrl } : {}),
        STATUS: 'OWNED',
        PURCHASE_DATE: new Date().toISOString(),
        PURCHASE_PRICE: finalPrice,
        ...(releaseId ? { DISCOGS_RELEASE_ID: releaseId } : {}),
        ...(customPressingId ? { CUSTOM_PRESSING_ID: customPressingId } : {})
      });

      setPurchasePrice(finalPrice);
      setRealStatus('OWNED');
      setShareTag('OWNED');
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



  // 실제 저장 로직 (기존 handleSave 본문 그대로) — 커버 선택 모달이 있다면
  // 그걸 거친 뒤에, 없다면(대체 후보가 없는 흔한 경우) 곧바로 호출된다.
  const proceedWithSave = async (status: 'OWNED' | 'WISH') => {
    if (!album || !user) return;

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
          ...(coverUrl.includes('supabase.co') ? { CUSTOM_IMAGE_URL: coverUrl } : {}),
          STATUS: 'WISH',
          PURCHASE_PRICE: 0,
          ...(releaseId ? { DISCOGS_RELEASE_ID: releaseId } : {}),
          ...(customPressingId ? { CUSTOM_PRESSING_ID: customPressingId } : {})
        });
        setRealStatus('WISH');
        setShareTag('WISH');
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

  // "보관함 추가"/"위시" 버튼의 실제 진입점 — 새 앨범이고 대체 커버 후보나
  // 직접 촬영 옵션 중 고를 게 있으면 먼저 커버 선택 모달을 띄우고, 그
  // 결과(onSelect/onTakePhoto)가 이어서 원래 저장을 계속한다.
  const handleSave = (status: 'OWNED' | 'WISH') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!album) return;

    if (!user) {
      showAlert(t('common.error'), t('detail.loginRequired'));
      return;
    }

    const coverChoiceCount = (coverCandidates ? Object.keys(coverCandidates).length : 0) + 1;
    const isFreshAlbum = !realStatus;
    if (isFreshAlbum && coverChoiceCount > 1) {
      setPendingSaveAction(status);
      setCoverPickerOpen(true);
      return;
    }

    proceedWithSave(status);
  };

  // "앨범 재킷 변경" 버튼 — 대체 커버 후보가 없어도(대부분의 이미 소장한
  // 앨범) "직접 촬영" 하나만 있는 채로 항상 통합 모달을 띄운다.
  const handleChangeJacketClick = () => {
    setCoverPickerOpen(true);
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
      setShareTag('NONE');
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
                    source={(myPhoto || coverUrl) ? { uri: myPhoto || coverUrl } : require('../../../assets/logo_real_transparent.png')}
                    style={StyleSheet.absoluteFill}
                    resizeMode={(myPhoto || coverUrl) ? "cover" : "contain"}
                  />
                  <View style={styles.vinylHole} />
                </View>
              </Animated.View>
              <Image
                source={(myPhoto || coverUrl) ? { uri: myPhoto || coverUrl } : require('../../../assets/logo_real_transparent.png')}
                style={[styles.cover, !(myPhoto || coverUrl) && { padding: 40, backgroundColor: '#161616', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }]}
                resizeMode={(myPhoto || coverUrl) ? "cover" : "contain"}
              />

              {realStatus === 'OWNED' && (
                <View style={styles.coverControls}>
                  <View style={styles.coverBtnRow}>
                    {myPhoto && (
                      <TouchableOpacity style={styles.coverUndoBtn} onPress={handleUseOriginalCover} disabled={isUploadingCover}>
                        <FontAwesome5 name="undo" size={14} color="#fff" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.coverCameraBtn} onPress={handleChangeJacketClick} disabled={isUploadingCover}>
                      {isUploadingCover ? <ActivityIndicator color="#000" size="small" /> : <FontAwesome5 name="camera" size={16} color="#000" />}
                    </TouchableOpacity>
                  </View>
                  {myPhoto && (
                    <View style={styles.coverScopeToggle}>
                      <TouchableOpacity 
                        style={[styles.coverScopeBtn, coverScope === 'mine' && styles.coverScopeActive]} 
                        onPress={() => handleScopeChange('mine')}
                        disabled={isUploadingCover}
                      >
                        <Text style={[styles.coverScopeText, coverScope === 'mine' && styles.coverScopeTextActive]}>{t('detail.coverScopeMineShort') || '나만 보기'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.coverScopeBtn, coverScope === 'everyone' && styles.coverScopeActive]} 
                        onPress={() => handleScopeChange('everyone')}
                        disabled={isUploadingCover}
                      >
                        <Text style={[styles.coverScopeText, coverScope === 'everyone' && styles.coverScopeTextActive]}>{t('detail.coverScopeEveryoneShort') || '전체 공개'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
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

              {/* 스피닝 다이어리 기록 (보유 앨범만) — 앱의 다크 럭스 톤에 맞춘 절제된 CTA */}
              {realStatus === 'OWNED' && (
                <AnimatedButton
                  onPress={() => setIsSpinModalOpen(true)}
                  style={{
                    width: '100%',
                    marginTop: 14,
                    borderRadius: shape.md,
                    backgroundColor: 'rgba(240,230,210,0.06)',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: 'rgba(212,175,55,0.45)',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: BUTTON_HEIGHT }}>
                    <Feather name="music" size={15} color="#d4af37" />
                    <Text style={{ color: '#F0E6D2', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 }}>{t('detail.spinLogButton')}</Text>
                  </View>
                </AnimatedButton>
              )}

              {/* Tags Section */}
              {(genreTags.length > 0) && (
                <View style={styles.tagsContainer}>
                  {genreTags.map((tag, i) => {
                    const tTag = t(`genres.${tag}` as any);
                    const displayTag = tTag && !tTag.startsWith('genres.') ? tTag : tag;
                    return (
                      <View key={`g-${i}`} style={styles.tagBadge}>
                        <Text style={styles.tagText}>{displayTag}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={styles.tracklist}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.tracklistHeader}>Tracklist</Text>
                  {(!(album as any)?.SOURCE || (album as any).SOURCE === 'DISCOGS') && (
                    <TouchableOpacity onPress={openPressingPicker}>
                      <Text style={{ color: '#888', fontSize: 12, textDecorationLine: 'underline' }}>
                        {t('mobile.detail.choosePressing')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {(album as any)?.SOURCE && (album as any).SOURCE !== 'DISCOGS' &&
                    user?.id === (album as any).SUBMITTED_BY && !communityLocked && (
                    <TouchableOpacity
                      onPress={() => navigation.navigate('CommunityAlbumRegister', { albumId: Number(album.ALBUM_ID) })}
                    >
                      <Text style={{ color: '#888', fontSize: 12, textDecorationLine: 'underline' }}>
                        {t('community.editButton')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {tracks.length > 0 && !isExactRelease && (
                  <Text style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>
                    {t('mobile.detail.tracklistNotExact')}
                  </Text>
                )}
                {activeCustomPressing && (
                  <Text style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>
                    {t('mobile.detail.customPressingByline', { title: activeCustomPressing.TITLE })}{' '}
                    <Text
                      style={{ color: '#e9c349', textDecorationLine: 'underline' }}
                      onPress={() => navigation.navigate('UserProfile', { userId: activeCustomPressing.SUBMITTED_BY, name: activeCustomPressing.submitterName })}
                    >
                      {activeCustomPressing.submitterName || t('feed.anonymous')}
                    </Text>
                  </Text>
                )}
                {isTracksLoading ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#e9c349" />
                    <Text style={[styles.track, { textAlign: 'center', borderBottomWidth: 0, marginTop: 10, color: '#888' }]}>{t('mobile.detail.tracklistLoading')}</Text>
                  </View>
                ) : trackSideGroups ? (
                  trackSideGroups.map((group, gi) => (
                    <View key={gi} style={{ marginBottom: 12 }}>
                      <Text style={{ color: '#e9c349', fontSize: 12, marginBottom: 4 }}>
                        {t('mobile.detail.side', { side: group.side })}
                      </Text>
                      {group.tracks.map((track, i) => (
                        <Text key={i} style={styles.track}>{track.position || String(i + 1).padStart(2, '0')}. {track.title}</Text>
                      ))}
                    </View>
                  ))
                ) : tracks.length > 0 ? tracks.map((track, i) => (
                  <Text key={i} style={styles.track}>{String(i + 1).padStart(2, '0')}. {track.title}</Text>
                )) : (
                  <Text style={[styles.track, { textAlign: 'center', borderBottomWidth: 0 }]}>{t('mobile.detail.noTracklist')}</Text>
                )}
              </View>

              <Modal visible={pressingPickerOpen} transparent animationType="fade" onRequestClose={() => setPressingPickerOpen(false)}>
                <Pressable style={styles.pressingBackdrop} onPress={() => setPressingPickerOpen(false)}>
                  <Pressable style={[styles.pressingSheet, { maxHeight: '85%' }]} onPress={(e) => e.stopPropagation()}>
                    <ScrollView>
                      <Text style={styles.pressingTitle}>{t('mobile.detail.choosePressing')}</Text>
                      {isLoadingPressings ? (
                        <ActivityIndicator size="small" color="#e9c349" style={{ marginVertical: 20 }} />
                      ) : pressingVersions.length === 0 ? (
                        <Text style={{ color: '#888', paddingVertical: 10 }}>{t('mobile.detail.noPressingsFound')}</Text>
                      ) : (
                        pressingVersions.map((v) => (
                          <TouchableOpacity
                            key={v.releaseId}
                            style={[styles.pressingRow, v.releaseId === releaseId && styles.pressingRowActive]}
                            onPress={() => handlePickPressing(v)}
                          >
                            {v.thumb ? <Image source={{ uri: v.thumb }} style={styles.pressingThumb} /> : null}
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#fff' }} numberOfLines={1}>{v.title}</Text>
                              <Text style={{ color: '#888', fontSize: 11 }} numberOfLines={1}>
                                {[v.country, v.released, v.format].filter(Boolean).join(' · ')}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))
                      )}

                      <Text style={[styles.pressingTitle, { fontSize: 14, marginTop: 20 }]}>{t('mobile.detail.communityPressings')}</Text>
                      {communityPressings.length === 0 ? (
                        <Text style={{ color: '#888', paddingVertical: 6 }}>{t('mobile.detail.noCommunityPressings')}</Text>
                      ) : (
                        communityPressings.map((p) => (
                          <View
                            key={p.PRESSING_ID}
                            style={[styles.pressingRow, p.PRESSING_ID === customPressingId && styles.pressingRowActive]}
                          >
                            <TouchableOpacity style={{ flex: 1 }} onPress={() => handlePickCustomPressing(p)}>
                              <Text style={{ color: '#fff', fontWeight: '600' }} numberOfLines={1}>
                                {p.TITLE}
                                {!p.IS_PUBLIC && (
                                  <Text style={{ color: '#888', fontSize: 11, fontWeight: '400' }}> ({t('mobile.detail.privateOnlyMe')})</Text>
                                )}
                              </Text>
                              <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                                {t('mobile.detail.pressingSelectedByCount', { count: p.selectionCount })}
                              </Text>
                            </TouchableOpacity>
                            <Text
                              style={{ color: '#e9c349', fontSize: 12, textDecorationLine: 'underline', marginRight: p.SUBMITTED_BY === user?.id ? 10 : 0 }}
                              onPress={() => navigation.navigate('UserProfile', { userId: p.SUBMITTED_BY, name: p.submitterName })}
                            >
                              {p.submitterName || t('feed.anonymous')}
                            </Text>
                            {p.SUBMITTED_BY === user?.id && (
                              <View style={{ flexDirection: 'row', gap: 6 }}>
                                <TouchableOpacity style={styles.pressingIconBtn} onPress={() => startEditPressing(p)}>
                                  <Feather name="edit-2" size={13} color="#ccc" />
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.pressingIconBtn, styles.pressingIconBtnDanger]} onPress={() => setDeletingPressing(p)}>
                                  <Feather name="trash-2" size={13} color="#ff5252" />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        ))
                      )}

                      {(album as any)?.USER_VINYL_ID && !showCustomPressingForm && (
                        <TouchableOpacity
                          onPress={startCreatePressing}
                          style={{ marginTop: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(233,195,73,0.4)', borderRadius: 8, padding: 10, alignItems: 'center' }}
                        >
                          <Text style={{ color: '#e9c349', fontWeight: '600' }}>{t('mobile.detail.addCustomPressing')}</Text>
                        </TouchableOpacity>
                      )}

                      {showCustomPressingForm && (
                        <View style={{ marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 14 }}>
                          <Text style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>{t('mobile.detail.customPressingTitleLabel')}</Text>
                          <TextInput
                            value={customFormTitle}
                            onChangeText={setCustomFormTitle}
                            placeholder={t('mobile.detail.customPressingTitlePlaceholder')}
                            placeholderTextColor="#666"
                            style={styles.customPressingInput}
                          />
                          {customFormSides.map((side, sideIdx) => (
                            <View key={sideIdx} style={{ marginTop: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10 }}>
                              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                <TextInput
                                  value={side.heading}
                                  onChangeText={(v) => setCustomFormSides((prev) => prev.map((s, i) => (i === sideIdx ? { ...s, heading: v } : s)))}
                                  placeholder="A Side"
                                  placeholderTextColor="#666"
                                  style={[styles.customPressingInput, { flex: 1, fontWeight: '700' }]}
                                />
                                {customFormSides.length > 1 && (
                                  <TouchableOpacity onPress={() => removeCustomFormSide(sideIdx)}>
                                    <Text style={{ color: '#d32f2f', fontSize: 18 }}>✕</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                              {side.tracks.map((track, trackIdx) => (
                                <View key={trackIdx} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6 }}>
                                  <TextInput
                                    value={track}
                                    onChangeText={(v) => setCustomFormSides((prev) => prev.map((s, i) => (i === sideIdx ? { ...s, tracks: s.tracks.map((tr, ti) => (ti === trackIdx ? v : tr)) } : s)))}
                                    placeholder={t('mobile.detail.customPressingTrackPlaceholder', { n: trackIdx + 1 })}
                                    placeholderTextColor="#666"
                                    style={[styles.customPressingInput, { flex: 1 }]}
                                  />
                                  {side.tracks.length > 1 && (
                                    <TouchableOpacity onPress={() => removeCustomFormTrack(sideIdx, trackIdx)}>
                                      <Text style={{ color: '#d32f2f', fontSize: 18 }}>✕</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              ))}
                              <TouchableOpacity onPress={() => addCustomFormTrack(sideIdx)} style={{ marginTop: 6 }}>
                                <Text style={{ color: '#e9c349', fontSize: 12 }}>+ {t('mobile.detail.addTrack')}</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                          <TouchableOpacity onPress={addCustomFormSide} style={{ marginTop: 10, marginBottom: 14 }}>
                            <Text style={{ color: '#e9c349', fontSize: 13 }}>+ {t('mobile.detail.addSide')}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => setCustomFormIsPublic((prev) => !prev)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}
                          >
                            <Feather name={customFormIsPublic ? 'check-square' : 'square'} size={16} color="#e9c349" />
                            <Text style={{ color: '#fff', fontSize: 13 }}>{t('mobile.detail.customPressingPublicToggle')}</Text>
                          </TouchableOpacity>

                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              onPress={resetCustomForm}
                              style={{ flex: 1, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 6, alignItems: 'center' }}
                            >
                              <Text style={{ color: '#fff' }}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={handleSubmitCustomPressing}
                              disabled={isSubmittingCustomPressing}
                              style={{ flex: 1, padding: 10, backgroundColor: '#e9c349', borderRadius: 6, alignItems: 'center' }}
                            >
                              <Text style={{ color: '#1a1710', fontWeight: '700' }}>
                                {isSubmittingCustomPressing
                                  ? t('mobile.detail.tracklistLoading')
                                  : editingPressingId
                                  ? t('mobile.detail.updateCustomPressing')
                                  : t('mobile.detail.submitCustomPressing')}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </ScrollView>
                  </Pressable>
                </Pressable>
              </Modal>

              <Modal visible={!!deletingPressing} transparent animationType="fade" onRequestClose={() => !isDeletingPressing && setDeletingPressing(null)}>
                <View style={styles.confirmOverlay}>
                  <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => !isDeletingPressing && setDeletingPressing(null)} disabled={isDeletingPressing} />
                  <BlurView intensity={glassIntensity || 30} tint="dark" style={styles.confirmContent}>
                    <View style={styles.confirmIconWrapper}>
                      <Feather name="trash-2" size={20} color="#ff5252" />
                    </View>
                    <Text style={styles.confirmTitle}>{t('mobile.detail.deleteCustomPressingTitle')}</Text>
                    {deletingPressing && (
                      <Text style={styles.confirmMessage}>{t('mobile.detail.deleteCustomPressingMessage', { title: deletingPressing.TITLE })}</Text>
                    )}
                    <View style={styles.confirmActions}>
                      <TouchableOpacity
                        style={styles.confirmBtnCancel}
                        onPress={() => setDeletingPressing(null)}
                        disabled={isDeletingPressing}
                      >
                        <Text style={styles.confirmBtnCancelText}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.confirmBtnDelete, isDeletingPressing && { opacity: 0.6 }]}
                        onPress={confirmDeletePressing}
                        disabled={isDeletingPressing}
                      >
                        <Text style={styles.confirmBtnDeleteText}>
                          {isDeletingPressing ? t('common.loading') : t('common.delete')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </BlurView>
                </View>
              </Modal>

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
            album={myPhoto ? { ...album, IMAGE_URL: masterImage || album.IMAGE_URL, CUSTOM_IMAGE_URL: myPhoto } as any : album}
            username={user?.user_metadata?.displayName || t('common.defaultCollectorName')}
            overrideStatus={shareTag}
          />
        </View>

        <ShareOptionsSheet
          visible={isShareSheetVisible}
          onClose={() => setShareSheetVisible(false)}
          title={t('mobile.detail.shareSheetTitle')}
          isProcessing={isSharingProcessing}
          onShareLink={handleShareLink}
          onImageShare={handleImageShare}
        >
          <View style={{ marginBottom: 24, gap: 8 }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
              {t('detail.tagSelectPrompt')}
            </Text>
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 }}>
              {[
                { value: 'OWNED', label: 'COLLECTED' },
                { value: 'WISH', label: 'WANTED' },
                { value: 'NONE', label: 'JUST DROPPED' },
                { value: 'NEW', label: 'NEW' }
              ].map(tag => (
                <TouchableOpacity
                  key={tag.value}
                  onPress={() => setShareTag(tag.value)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    backgroundColor: shareTag === tag.value ? 'rgba(255,255,255,0.15)' : 'transparent',
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Text style={{
                    color: shareTag === tag.value ? '#fff' : 'rgba(255,255,255,0.5)',
                    fontSize: 10,
                    fontWeight: shareTag === tag.value ? '700' : '500',
                    textAlign: 'center'
                  }}>
                    {tag.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ShareOptionsSheet>

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

        {/* 스피닝 다이어리 작성 모달 — 공용 에디터(미디어 첨부 포함) */}
        <SpinLogEditorModal
          visible={isSpinModalOpen}
          title={t('detail.spinLogTitle')}
          hint={t('detail.spinLogHint')}
          submitLabel={t('detail.spinLogSave')}
          submittingLabel={t('detail.spinLogSaving')}
          onClose={() => setIsSpinModalOpen(false)}
          onSubmit={async (values) => {
            if (!user?.id || !album) {
              // album/user가 비어 있으면 업로드까지 끝낸 미디어가 그대로 버려지고
              // 아무 피드백도 없이 저장이 무산된다 — 조용히 삼키지 않고 알린다.
              Alert.alert('', '앨범 정보를 확인하지 못해 저장하지 못했습니다. 다시 시도해주세요.');
              return;
            }
            await logSpin(user.id, Number(album.ALBUM_ID), values.mood, values.note, values.media, values.isPublic);
            setIsSpinModalOpen(false);
            Alert.alert('', t('detail.spinLogSaved'));
          }}
        />

        <CoverPickerModal
          visible={coverPickerOpen}
          candidates={coverCandidates}
          currentUrl={coverUrl}
          onSelect={(url) => {
            setCoverUrl(url);
            setCoverPickerOpen(false);
            if (pendingSaveAction) {
              const action = pendingSaveAction;
              setPendingSaveAction(null);
              proceedWithSave(action);
            }
          }}
          onTakePhoto={() => {
            setCoverPickerOpen(false);
            handleCoverPhoto();
          }}
          onCancel={() => { setCoverPickerOpen(false); setPendingSaveAction(null); }}
        />
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
  coverControls: {
    position: 'absolute',
    bottom: -15,
    right: -15,
    zIndex: 10,
    alignItems: 'flex-end',
    gap: 8,
  },
  coverBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coverUndoBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(20,20,20,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  coverCameraBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e9c349',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
  coverScopeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20,20,20,0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  coverScopeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  coverScopeActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  coverScopeText: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: 'bold',
  },
  coverScopeTextActive: {
    color: '#fff',
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
  pressingBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pressingSheet: {
    backgroundColor: '#131313',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(233,195,73,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  pressingTitle: {
    color: '#F0E6D2',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  pressingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  pressingRowActive: {
    backgroundColor: 'rgba(233,195,73,0.1)',
    borderColor: 'rgba(233,195,73,0.35)',
  },
  pressingThumb: {
    width: 42,
    height: 42,
    borderRadius: 6,
  },
  pressingIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pressingIconBtnDanger: {
    backgroundColor: 'rgba(255,82,82,0.12)',
  },
  customPressingInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  confirmContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,82,82,0.3)',
    backgroundColor: 'rgba(20,20,20,0.85)',
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  confirmIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,82,82,0.12)',
    marginBottom: 14,
  },
  confirmTitle: {
    color: '#F0E6D2',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmMessage: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmBtnCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  confirmBtnCancelText: {
    color: '#F0E6D2',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtnDelete: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#ff5252',
  },
  confirmBtnDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
