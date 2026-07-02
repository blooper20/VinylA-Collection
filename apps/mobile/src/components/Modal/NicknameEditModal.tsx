import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { NICKNAME_MAX_LENGTH } from '@vinyla/core-api';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

interface NicknameEditModalProps {
  visible: boolean;
  onClose: () => void;
  initialNickname: string;
  onSave: (nickname: string) => Promise<void>;
}

const { height } = Dimensions.get('window');

export const NicknameEditModal = ({ visible, onClose, initialNickname, onSave }: NicknameEditModalProps) => {
  const { themeColors, glassIntensity } = useTheme();
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setNickname(initialNickname || '');
      setErrorMsg('');
      setLoading(false);
    }
  }, [visible, initialNickname]);

  const handleSave = async () => {
    if (!nickname.trim()) {
      setErrorMsg('닉네임을 입력해주세요.');
      return;
    }
    if (nickname === initialNickname) {
      onClose();
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setErrorMsg('');
    try {
      await onSave(nickname.trim());
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <BlurView intensity={glassIntensity || 30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[styles.content, { backgroundColor: 'rgba(20,20,20,0.6)', borderColor: themeColors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>닉네임 변경</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={loading}>
              <Text style={{ color: themeColors.textPrimary, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.body}>
            <View style={[styles.alertBox, { backgroundColor: 'rgba(255,152,0,0.1)', borderColor: '#ff9800' }]}>
              <Text style={styles.alertText}>⚠️ 닉네임은 다른 사용자와 중복될 수 없으며, 한 번 변경하면 30일 동안 다시 변경할 수 없습니다.</Text>
            </View>

            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>새 닉네임</Text>
              <Text style={[styles.counter, { color: themeColors.textSecondary }]}>
                {nickname.length}/{NICKNAME_MAX_LENGTH}자
              </Text>
            </View>
            <TextInput
              style={[styles.input, { color: themeColors.textPrimary, borderColor: errorMsg ? '#f44336' : themeColors.border }]}
              value={nickname}
              onChangeText={(text) => {
                setNickname(text.slice(0, NICKNAME_MAX_LENGTH));
                setErrorMsg('');
              }}
              placeholder="닉네임을 입력하세요"
              placeholderTextColor={themeColors.textSecondary}
              maxLength={NICKNAME_MAX_LENGTH}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={[
                styles.saveBtn, 
                { backgroundColor: themeColors.textPrimary },
                (loading || !nickname.trim()) && { opacity: 0.5 }
              ]} 
              onPress={handleSave}
              disabled={loading || !nickname.trim()}
            >
              <Text style={[styles.saveBtnText, { color: '#000' }]}>{loading ? '저장 중...' : '저장하기'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 8,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  alertBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  alertText: {
    color: '#ff9800',
    fontSize: 14,
    lineHeight: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  counter: {
    fontSize: 12,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 8,
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 20,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
  }
});
