import React from 'react';
import { View } from 'react-native';
import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppWrapper from './src/components/AppWrapper';
import { ThemeProvider } from './src/context/ThemeContext';
import { UserProvider } from './src/context/UserContext';

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#F6F7FB' }} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <UserProvider>
          <AppWrapper />
        </UserProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
