import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useBasicSessionTracking } from '../hooks/useSessionTracking';
import { useTheme } from '../context/ThemeContext';
import AppNavigator from '../navigation/AppNavigator';

export default function AppWrapper() {
  // Initialize basic session tracking for the entire app (no navigation dependency)
  useBasicSessionTracking();
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar 
        style={theme.isDark ? "light" : "dark"} 
        backgroundColor={theme.colors.background} 
        translucent={false} 
      />
      <AppNavigator />
    </View>
  );
} 