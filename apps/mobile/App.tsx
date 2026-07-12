import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator, linking } from './src/navigation/RootNavigator';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@vinyla/ui';
import { LocaleProvider, useLocale } from '@vinyla/i18n';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@vinyla/core-api';

const AppContent = () => {
  const { theme, setGlassIntensity } = useTheme();
  const { locale, setLocale } = useLocale();

  useEffect(() => {
    AsyncStorage.getItem('glassIntensity').then((val) => {
      if (val) setGlassIntensity(Number(val));
    });
  }, [setGlassIntensity]);

  useEffect(() => {
    AsyncStorage.getItem('locale').then((val) => {
      if (val === 'ko' || val === 'en') setLocale(val);
      else setLocale(Localization.getLocales()[0]?.languageCode === 'en' ? 'en' : 'ko');
    });
  }, [setLocale]);

  useEffect(() => {
    AsyncStorage.setItem('locale', locale);
  }, [locale]);

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
        <LocaleProvider>
          <AlertProvider>
            <AppContent />
          </AlertProvider>
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
