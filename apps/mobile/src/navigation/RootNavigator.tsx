import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { SetupScreen } from '../screens/SetupScreen';
import { StoryScreen } from '../screens/StoryScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { NoticeDetailScreen } from '../screens/NoticeDetailScreen';
import { TabNavigator } from './TabNavigator';
import { tabLinkingConfig } from './TabNavigator';
import { useAuthStore } from '@vinyla/core-api';
import { LinkingOptions } from '@react-navigation/native';

export const linking: LinkingOptions<any> = {
  prefixes: ['vinyla://'],
  config: {
    screens: {
      Main: tabLinkingConfig,
    },
  },
};

const Stack = createNativeStackNavigator();

export const RootNavigator = () => {
  const { user, isLoading, initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, []);

  if (isLoading) {
    return null; // Or a splash screen
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
        </>
      )}
    </Stack.Navigator>
  );
};
