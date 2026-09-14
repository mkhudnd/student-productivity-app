import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makePalette } from '../theme/designSystem';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const systemTheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('system');
  const [isDarkMode, setIsDarkMode] = useState(systemTheme === 'dark');

  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('themeMode');
        const mode = savedTheme || 'system';
        setThemeMode(mode);
        setIsDarkMode(mode === 'system' ? systemTheme === 'dark' : mode === 'dark');
      } catch (error) {
        console.error('Error loading theme preference:', error);
      }
    };

    loadThemePreference();
  }, []);

  useEffect(() => {
    if (themeMode === 'system') {
      setIsDarkMode(systemTheme === 'dark');
    }
  }, [systemTheme, themeMode]);

  const changeThemeMode = async (mode) => {
    setThemeMode(mode);
    setIsDarkMode(mode === 'system' ? systemTheme === 'dark' : mode === 'dark');

    try {
      await AsyncStorage.setItem('themeMode', mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const toggleTheme = () => {
    changeThemeMode(isDarkMode ? 'light' : 'dark');
  };

  const theme = {
    isDark: isDarkMode,
    mode: themeMode,
    colors: makePalette(isDarkMode),
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDarkMode,
        themeMode,
        changeThemeMode,
        toggleTheme,
        systemTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
