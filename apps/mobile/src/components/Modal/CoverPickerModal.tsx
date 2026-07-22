import React from 'react';
import { Modal, View, Text, TouchableOpacity, Image } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useLocale } from '@vinyla/i18n';

interface CoverPickerModalProps {
  visible: boolean;
  // Only present for a fresh Aladin-sourced search result — undefined
  // whenever the item was Discogs-sourced or is being reopened after saving.
  candidates?: { appleMusic?: string; aladin?: string; discogs?: string };
  currentUrl: string;
  onSelect: (url: string) => void;
  onTakePhoto: () => void;
  onCancel: () => void;
}

// Shown once, right when the user chooses to save a fresh (never-saved)
// album — lets them pick which cover to save it with (Apple Music / Aladin /
// Discogs, whichever the search actually found) or shoot their own jacket
// photo instead, rather than silently defaulting to one. Also reachable via
// the "앨범 재킷 변경" button on an already-owned album, where there are
// usually no alternate catalog candidates and this reduces to just the
// take-a-photo option. Shell mirrors SpinLogEditorModal.
export const CoverPickerModal = ({ visible, candidates, currentUrl, onSelect, onTakePhoto, onCancel }: CoverPickerModalProps) => {
  const { t } = useLocale();
  const sourceOptions = ([
    ['appleMusic', candidates?.appleMusic, t('detail.coverPickAppleMusic')],
    ['aladin', candidates?.aladin, t('detail.coverPickAladin')],
    ['discogs', candidates?.discogs, t('detail.coverPickDiscogs')],
  ] as const).filter((opt): opt is [typeof opt[0], string, string] => !!opt[1]);

  // 대체 후보가 없을 때(대부분의 이미 소장한 앨범)는 "직접 촬영"만 덩그러니
  // 남지 않도록, 지금 쓰이는 커버도 하나의 선택지로 보여준다 — 이미 후보
  // 목록에 같은 이미지가 있으면 중복 표시하지 않는다.
  const hasCurrentAsSource = sourceOptions.some(([, url]) => url === currentUrl);
  const options = (!hasCurrentAsSource && currentUrl)
    ? [['existing', currentUrl, t('detail.coverPickExisting')] as const, ...sourceOptions]
    : sourceOptions;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#1a1814', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', alignSelf: 'flex-start' }}>{t('detail.coverPickLabel')}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4, alignSelf: 'flex-start' }}>{t('detail.coverPickHint')}</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16, justifyContent: 'center' }}>
            {options.map(([key, url, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => onSelect(url)}
                style={{
                  alignItems: 'center',
                  gap: 6,
                  padding: 4,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: currentUrl === url ? '#fff' : 'transparent',
                }}
              >
                <Image source={{ uri: url }} style={{ width: 96, height: 96, borderRadius: 8 }} resizeMode="cover" />
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={onTakePhoto}
              style={{ alignItems: 'center', gap: 6, padding: 4, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' }}
            >
              <View style={{
                width: 96, height: 96, borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderStyle: 'dashed',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <FontAwesome5 name="camera" size={22} color="rgba(255,255,255,0.6)" />
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{t('detail.coverPickTakePhoto')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={onCancel}
            style={{ marginTop: 18, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' }}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
