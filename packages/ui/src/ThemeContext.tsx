"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { colors } from './tokens';

export type ThemeType = 'DARK_BLACK' | 'MOODY_WALNUT' | 'CLEAN_DOODLING';

interface ThemeContextProps {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  themeColors: typeof colors.theme.DARK_BLACK;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<ThemeType>('DARK_BLACK');

  // Handle CSS variables for Web inside a generic provider if needed, 
  // but it's cleaner to handle web `data-theme` inside Web's layout 
  // using a useEffect hook syncing with this context if we want to share.
  // For mobile, we just pass the themeColors down.
  const themeColors = colors.theme[theme];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
