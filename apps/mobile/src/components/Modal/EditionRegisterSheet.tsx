import React from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useLocale } from '@vinyla/i18n';

const EDITION_PRESET_KEYS = [
  'colored', 'clear', 'splatter', 'marbled', 'pictureDisc', 'limited',
  'reissue', 'originalPressing', 'deluxeBoxSet', 'signed', 'import',
  'domestic', 'heavyweight180g',
] as const;

interface EditionRegisterSheetProps {
  visible: boolean;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: (editionLabel: string, price: number) => void;
}

// "또 등록" 시트 — 이미 소장/위시에 있는 앨범을 초반/재반/컬러반처럼 별도
// 항목으로 새로 등록할 때 에디션 라벨(프리셋 칩 + 자유 입력)과 구매가를
// 입력받는다. 셸은 CoverPickerModal과 동일한 패턴(투명 Modal + 어두운
// 배경 + 카드).
export const EditionRegisterSheet = ({ visible, isBusy, onCancel, onConfirm }: EditionRegisterSheetProps) => {
  const { t } = useLocale();
  const [selectedPreset, setSelectedPreset] = React.useState<string | null>(null);
  const [label, setLabel] = React.useState('');
  const [priceInput, setPriceInput] = React.useState('');

  React.useEffect(() => {
    if (visible) {
      setSelectedPreset(null);
      setLabel('');
      setPriceInput('');
    }
  }, [visible]);

  const handlePresetPress = (key: string) => {
    const presetLabel = t(`detail.editionPresets.${key}` as any);
    setSelectedPreset(key);
    setLabel(presetLabel);
  };

  const handleConfirm = () => {
    const trimmed = label.trim();
    if (!trimmed || isBusy) return;
    onConfirm(trimmed, Number(priceInput.replace(/[^0-9]/g, '')) || 0);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#1a1814', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>{t('detail.registerAnotherEdition')}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>{t('detail.editionRegisterHint')}</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 16 }}
            contentContainerStyle={{ gap: 8 }}
          >
            {EDITION_PRESET_KEYS.map((key) => {
              const active = selectedPreset === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => handlePresetPress(key)}
                  disabled={isBusy}
                  style={{
                    borderWidth: 1,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderColor: active ? '#e6b93c' : 'rgba(255,255,255,0.12)',
                    backgroundColor: active ? 'rgba(230,185,60,0.14)' : 'transparent',
                  }}
                >
                  <Text style={{ color: active ? '#e6b93c' : 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                    {t(`detail.editionPresets.${key}` as any)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TextInput
            value={label}
            onChangeText={(value) => { setLabel(value); setSelectedPreset(null); }}
            placeholder={t('detail.editionLabelPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            editable={!isBusy}
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.16)',
              color: '#fff',
              fontSize: 15,
            }}
          />

          <TextInput
            value={priceInput}
            onChangeText={(value) => setPriceInput(value.replace(/[^0-9]/g, ''))}
            placeholder={t('detail.pricePlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            keyboardType="numeric"
            editable={!isBusy}
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.16)',
              color: '#fff',
              fontSize: 15,
              textAlign: 'center',
            }}
          />

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
            <TouchableOpacity
              onPress={onCancel}
              disabled={isBusy}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center' }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={isBusy || !label.trim()}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 20, backgroundColor: '#e6b93c', alignItems: 'center', opacity: (isBusy || !label.trim()) ? 0.6 : 1 }}
            >
              {isBusy ? (
                <ActivityIndicator color="#1a1814" />
              ) : (
                <Text style={{ color: '#1a1814', fontSize: 13, fontWeight: '700' }}>{t('common.save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
