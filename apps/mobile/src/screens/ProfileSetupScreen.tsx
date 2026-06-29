import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@vinyla/core-api';

const { width } = Dimensions.get('window');

const INTERESTS = ['Jazz', 'Rock', 'Classical', 'Hip-Hop', 'Pop', 'Electronic', 'R&B', 'Folk'];

export const ProfileSetupScreen = () => {
  const [name, setName] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const { updateProfile } = useAuthStore();
  const navigation = useNavigation<any>();

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    
    try {
      await updateProfile(name, selectedInterests);
      navigation.replace('Main');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('프로필 설정에 실패했습니다.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Welcome to Vinyl Noir</Text>
      <Text style={styles.subtitle}>당신만의 컬렉션을 시작하기 위해 프로필을 완성해주세요.</Text>

      <Text style={styles.label}>이름</Text>
      <TextInput 
        style={styles.input}
        placeholder="이름을 입력하세요"
        placeholderTextColor="#666"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>관심 장르 (선택)</Text>
      <View style={styles.tagsContainer}>
        {INTERESTS.map(interest => {
          const isSelected = selectedInterests.includes(interest);
          return (
            <TouchableOpacity 
              key={interest} 
              style={[styles.tag, isSelected && styles.tagSelected]}
              onPress={() => toggleInterest(interest)}
            >
              <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>{interest}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={handleSave}>
        <Text style={styles.submitBtnText}>시작하기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 24,
    paddingTop: 80,
    minHeight: '100%',
  },
  title: {
    fontFamily: 'Bodoni Moda',
    fontSize: 32,
    color: '#e9c349',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'Pretendard',
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 40,
    lineHeight: 24,
  },
  label: {
    fontFamily: 'Pretendard',
    fontSize: 14,
    color: '#fff',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 32,
    fontFamily: 'Pretendard',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 60,
  },
  tag: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
  },
  tagSelected: {
    borderColor: '#e9c349',
    backgroundColor: '#e9c349',
  },
  tagText: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Pretendard',
    fontSize: 14,
  },
  tagTextSelected: {
    color: '#000',
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 'auto',
  },
  submitBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Pretendard',
  }
});
