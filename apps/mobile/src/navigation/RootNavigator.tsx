import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ProfileSetupScreen } from '../screens/ProfileSetupScreen';
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

  const hasProfile = user?.user_metadata?.displayName;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : !hasProfile ? (
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      ) : (
        <Stack.Screen name="Main" component={TabNavigator} />
      )}
    </Stack.Navigator>
  );
};
