import React from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, Image, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { uploadSpinLogMedia, SpinMedia, getErrorMessage } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';

// 스피닝 다이어리 작성/수정 공용 시트 — DetailModal(작성)과 SocialScreen
// 다이어리 탭(수정)이 같은 폼을 쓴다(웹의 SpinLogModal/인라인 수정 폼 파리티).
// 미디어 업로드는 저장 시점에 이 컴포넌트가 직접 처리하고, 부모에는 업로드가
// 끝난 최종 SpinMedia|null만 넘긴다 — 부모는 logSpin/updateSpinLog만 다르다.

const MOOD_PRESETS = ['🤩', '🙂', '😌', '😐', '😢'] as const;
const NOTE_MAX_LENGTH = 500;
const MAX_VIDEO_SECONDS = 15;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50MB

type MediaState =
  | { kind: 'none' }
  | { kind: 'existing'; url: string; type: 'image' | 'video' }
  | { kind: 'new'; uri: string; type: 'image' | 'video' };

export interface SpinLogEditorValues {
  mood?: string;
  note: string;
  isPublic: boolean;
  media: SpinMedia | null;
}

interface SpinLogEditorModalProps {
  visible: boolean;
  title: string;
  hint?: string;
  submitLabel: string;
  submittingLabel: string;
  initial?: {
    mood?: string | null;
    note?: string | null;
    isPublic?: boolean;
    mediaUrl?: string | null;
    mediaType?: 'image' | 'video' | null;
  };
  onClose: () => void;
  /** 업로드까지 끝난 값을 받는다. 저장 성공 시 부모가 모달을 닫는다. */
  onSubmit: (values: SpinLogEditorValues) => Promise<void>;
}

export const SpinLogEditorModal = ({ visible, title, hint, submitLabel, submittingLabel, initial, onClose, onSubmit }: SpinLogEditorModalProps) => {
  const { t } = useLocale();
  const [mood, setMood] = React.useState<string | undefined>(undefined);
  const [note, setNote] = React.useState('');
  const [isPublic, setIsPublic] = React.useState(true);
  const [media, setMedia] = React.useState<MediaState>({ kind: 'none' });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setMood(initial?.mood || undefined);
    setNote(initial?.note || '');
    setIsPublic(initial?.isPublic ?? true);
    setMedia(
      initial?.mediaUrl
        ? { kind: 'existing', url: initial.mediaUrl, type: initial.mediaType || 'image' }
        : { kind: 'none' }
    );
    setIsSubmitting(false);
    // 열릴 때마다 initial 스냅샷으로 리셋 — 편집 대상이 바뀌어도 이전 입력이 남지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const validateAndSetAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const type: 'image' | 'video' = asset.type === 'video' ? 'video' : 'image';
    if (asset.fileSize && asset.fileSize > (type === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES)) {
      Alert.alert('', t('detail.spinLogMediaTooLarge'));
      return;
    }
    setMedia({ kind: 'new', uri: asset.uri, type });
  };

  // 사진/영상을 따로 고르게 한다. 영상의 경우 OS 기본 에디터를 우회하여 VideoTrimModal에서 처리한다.
  const pickFromLibrary = async (kind: 'image' | 'video') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('', t('mobile.detail.galleryPermission') || '갤러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(
      kind === 'video'
        ? { 
            mediaTypes: ['videos'], 
            allowsEditing: true, 
            videoMaxDuration: MAX_VIDEO_SECONDS,
            videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720 
          }
        : { mediaTypes: ['images'], allowsEditing: false, quality: 0.8 }
    );
    if (!result.canceled && result.assets.length > 0) {
      validateAndSetAsset(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('', t('mobile.detail.cameraPermission') || '카메라 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ 
      quality: 0.8, 
      mediaTypes: ['images', 'videos'], 
      allowsEditing: true, 
      videoMaxDuration: MAX_VIDEO_SECONDS,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium
    });
    if (!result.canceled && result.assets.length > 0) {
      validateAndSetAsset(result.assets[0]);
    }
  };

  const handleAddMedia = () => {
    Alert.alert(t('detail.spinLogMediaAdd'), t('detail.spinLogMediaLimits'), [
      { text: t('mobile.detail.camera') || '카메라', onPress: takePhoto },
      { text: t('mobile.detail.galleryPhoto') || '갤러리에서 사진 선택', onPress: () => pickFromLibrary('image') },
      { text: t('mobile.detail.galleryVideo') || '갤러리에서 영상 선택', onPress: () => pickFromLibrary('video') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  // 새로 고른 미디어를 업로드해 SpinMedia로 변환. 이미지는 JPEG으로 재인코딩
  // 한다 — iOS 갤러리의 HEIC 원본은 서버 화이트리스트(jpeg/png/gif/webp)에
  // 걸려 415가 나기 때문. 영상은 mp4/mov 그대로 올린다.
  const resolveMedia = async (): Promise<SpinMedia | null> => {
    if (media.kind === 'none') return null;
    if (media.kind === 'existing') return { url: media.url, type: media.type };
    let uploadUri = media.uri;
    if (media.type === 'image') {
      const manipulated = await ImageManipulator.manipulateAsync(media.uri, [], {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      uploadUri = manipulated.uri;
    }
    const blob = await (await fetch(uploadUri)).blob();
    const ext = uploadUri.split('.').pop() || (media.type === 'video' ? 'mp4' : 'jpg');
    const file = Object.assign(blob, { name: `media.${ext}` });
    return uploadSpinLogMedia(file);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const resolved = await resolveMedia();
      await onSubmit({ mood, note, isPublic, media: resolved });
    } catch (e) {
      Alert.alert('', getErrorMessage(e, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !isSubmitting && onClose()}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#1a1814', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>{title}</Text>
          {!!hint && <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>{hint}</Text>}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {MOOD_PRESETS.map((m) => (
              <TouchableOpacity
                key={m}
                disabled={isSubmitting}
                onPress={() => setMood(mood === m ? undefined : m)}
                style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: mood === m ? '#e9c349' : 'rgba(255,255,255,0.12)', backgroundColor: mood === m ? 'rgba(233,195,73,0.15)' : 'transparent' }}
              >
                <Text style={{ fontSize: 20 }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('detail.spinLogNotePlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            editable={!isSubmitting}
            multiline
            maxLength={NOTE_MAX_LENGTH}
            style={{ marginTop: 14, minHeight: 80, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, textAlignVertical: 'top' }}
          />

          {/* 미디어 첨부 — 미리보기(이미지) 또는 영상 칩 + 제거 버튼 */}
          {media.kind === 'none' ? (
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={handleAddMedia}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignSelf: 'flex-start' }}
            >
              <Feather name="camera" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' }}>{t('detail.spinLogMediaAdd')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
              {media.type === 'image' ? (
                <Image
                  source={{ uri: media.kind === 'existing' ? media.url : media.uri }}
                  style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' }}
                />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <Feather name="film" size={16} color="#e9c349" />
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{t('detail.spinLogVideoAttached')}</Text>
                </View>
              )}
              <TouchableOpacity
                disabled={isSubmitting}
                onPress={() => setMedia({ kind: 'none' })}
                style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: 11, backgroundColor: '#3a3630', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                accessibilityLabel={t('detail.spinLogMediaRemove')}
              >
                <Feather name="x" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{t('detail.spinLogVisibilityLabel')}</Text>
            {([true, false] as const).map((v) => (
              <TouchableOpacity
                key={String(v)}
                disabled={isSubmitting}
                onPress={() => setIsPublic(v)}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: isPublic === v ? '#e9c349' : 'rgba(255,255,255,0.12)', backgroundColor: isPublic === v ? 'rgba(233,195,73,0.15)' : 'transparent' }}
              >
                <Text style={{ color: isPublic === v ? '#e9c349' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' }}>
                  {v ? t('detail.spinLogPublic') : t('detail.spinLogPrivate')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={onClose}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '700' }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={{ flex: 1, flexDirection: 'row', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: '#e9c349', alignItems: 'center', justifyContent: 'center', opacity: isSubmitting ? 0.6 : 1 }}
            >
              {isSubmitting && <ActivityIndicator size="small" color="#1a1814" />}
              <Text style={{ color: '#1a1814', fontWeight: '800' }}>
                {isSubmitting ? submittingLabel : submitLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
