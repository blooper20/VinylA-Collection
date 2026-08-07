import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { SetupScreen } from '../screens/SetupScreen';
import { StoryScreen } from '../screens/StoryScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { NoticeDetailScreen } from '../screens/NoticeDetailScreen';
import { CommunityAlbumsScreen } from '../screens/CommunityAlbumsScreen';
import { CommunityAlbumRegisterScreen } from '../screens/CommunityAlbumRegisterScreen';
import { CommunityPostScreen } from '../screens/CommunityPostScreen';
import { CommunityNewPostScreen } from '../screens/CommunityNewPostScreen';
import { CommunityPostEditScreen } from '../screens/CommunityPostEditScreen';
import { TabNavigator } from './TabNavigator';
import { useAuthStore } from '@vinyla/core-api';
import { LinkingOptions } from '@react-navigation/native';

// vinyla://<닉네임> 형태의 공유 링크 — UserProfileScreen이 username 파라미터를
// 받아 실제 유저 id로 직접 조회한다(예전엔 이 경로가 엉뚱하게 "마이" 탭으로
// 연결돼 있었다).
export const linking: LinkingOptions<any> = {
  prefixes: ['vinyla://'],
  config: {
    screens: {
      UserProfile: ':username',
    },
  },
};

const Stack = createNativeStackNavigator();

export const RootNavigator = () => {
  const { user, isLoading, initializeAuth } = useAuthStore();
  const { themeColors } = useTheme();

  useEffect(() => {
    initializeAuth();
  }, []);

  if (isLoading) {
    // 세션 확인(getSession)이 느리거나 오프라인이면 그냥 빈 화면만 몇 초간
    // 떠 있었다 — 앱이 멈춘 것처럼 보이지 않도록 최소한의 스피너를 보여준다.
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={themeColors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : !user.user_metadata?.displayName ? (
        <Stack.Screen name="Setup" component={SetupScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="Story" component={StoryScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
          <Stack.Screen name="NoticeDetail" component={NoticeDetailScreen} />
          <Stack.Screen name="CommunityAlbums" component={CommunityAlbumsScreen} />
          <Stack.Screen name="CommunityAlbumRegister" component={CommunityAlbumRegisterScreen} />
          <Stack.Screen name="CommunityPost" component={CommunityPostScreen} />
          <Stack.Screen name="CommunityNewPost" component={CommunityNewPostScreen} />
          <Stack.Screen name="CommunityPostEdit" component={CommunityPostEditScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
