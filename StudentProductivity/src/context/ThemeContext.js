import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [themeMode, setThemeMode] = useState('system'); // 'system', 'light', 'dark'
  const [isDarkMode, setIsDarkMode] = useState(systemTheme === 'dark');

  // Load theme preference from storage
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('themeMode');
        if (savedTheme) {
          setThemeMode(savedTheme);
          if (savedTheme === 'system') {
            setIsDarkMode(systemTheme === 'dark');
          } else {
            setIsDarkMode(savedTheme === 'dark');
          }
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      }
    };
    
    loadThemePreference();
  }, [systemTheme]);

  // Listen to system theme changes when in system mode
  useEffect(() => {
    if (themeMode === 'system') {
      setIsDarkMode(systemTheme === 'dark');
    }
  }, [systemTheme, themeMode]);

  // Save theme preference to storage
  const saveThemePreference = async (mode) => {
    try {
      await AsyncStorage.setItem('themeMode', mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const changeThemeMode = (mode) => {
    setThemeMode(mode);
    saveThemePreference(mode);
    
    if (mode === 'system') {
      setIsDarkMode(systemTheme === 'dark');
    } else {
      setIsDarkMode(mode === 'dark');
    }
  };

  const toggleTheme = () => {
    const newMode = isDarkMode ? 'light' : 'dark';
    changeThemeMode(newMode);
  };

  const theme = {
    isDark: isDarkMode,
    mode: themeMode,
    colors: {
      // Background colors
      background: isDarkMode ? '#181818' : '#f9f9f9',
      surface: isDarkMode ? '#232323' : '#ffffff',
      card: isDarkMode ? '#2C2C2C' : '#ffffff',
      
      // Text colors
      text: isDarkMode ? '#ffffff' : '#222222',
      textSecondary: isDarkMode ? '#aaaaaa' : '#888888',
      textInverse: isDarkMode ? '#222222' : '#ffffff',
      
      // Primary colors
      primary: isDarkMode ? '#FFD600' : '#2196F3',
      primaryText: isDarkMode ? '#181818' : '#ffffff',
      
      // Status colors
      success: isDarkMode ? '#69db7c' : '#4CAF50',
      error: isDarkMode ? '#ff6b6b' : '#F44336',
      warning: isDarkMode ? '#FFD600' : '#FFC107',
      info: isDarkMode ? '#4dabf7' : '#2196F3',
      
      // Border colors
      border: isDarkMode ? '#333333' : '#e0e0e0',
      separator: isDarkMode ? '#333333' : '#f0f0f0',
      
      // Input colors
      input: isDarkMode ? '#333333' : '#f0f0f0',
      inputText: isDarkMode ? '#ffffff' : '#222222',
      placeholder: isDarkMode ? '#aaaaaa' : '#888888',
      
      // Tab colors
      tabBackground: isDarkMode ? '#181818' : '#ffffff',
      tabBorder: isDarkMode ? '#232323' : '#e0e0e0',
      tabActive: isDarkMode ? '#ffffff' : '#222222',
      tabInactive: isDarkMode ? '#bbbbbb' : '#888888',
    }
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