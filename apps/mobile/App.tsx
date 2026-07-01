import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator, linking } from './src/navigation/RootNavigator';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@vinyla/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AppContent = () => {
  const { theme, setGlassIntensity } = useTheme();
  
  useEffect(() => {
    AsyncStorage.getItem('glassIntensity').then((val) => {
      if (val) setGlassIntensity(Number(val));
    });
  }, [setGlassIntensity]);

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
