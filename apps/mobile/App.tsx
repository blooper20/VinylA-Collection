import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator, linking } from './src/navigation/RootNavigator';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@vinyla/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@vinyla/core-api';

const AppContent = () => {
  const { theme, setGlassIntensity } = useTheme();

  useEffect(() => {
    AsyncStorage.getItem('glassIntensity').then((val) => {
      if (val) setGlassIntensity(Number(val));
    });
  }, [setGlassIntensity]);

  // Refresh the auth token only while the app is foregrounded — RN can't
  // rely on timers in the background, so returning from background with a
  // stale token would otherwise fail requests until relaunch.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    supabase.auth.startAutoRefresh();
    return () => sub.remove();
  }, []);

  // We can dynamically change status bar style based on theme
  const statusBarStyle = theme === 'CLEAN_DOODLING' ? 'dark' : 'light';

  return (
    <NavigationContainer linking={linking}>
      <StatusBar style={statusBarStyle} />
      <RootNavigator />
    </NavigationContainer>
  );
};

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from './src/providers/AlertProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AlertProvider>
          <AppContent />
        </AlertProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
