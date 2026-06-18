import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { TabNavigator } from './src/navigation/TabNavigator';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@vinyla/ui';

const AppContent = () => {
  const { theme } = useTheme();
  // We can dynamically change status bar style based on theme
  const statusBarStyle = theme === 'CLEAN_DOODLING' ? 'dark' : 'light';

  return (
    <NavigationContainer>
      <StatusBar style={statusBarStyle} />
      <TabNavigator />
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
