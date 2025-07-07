// App.js Main application entry point 
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppWrapper from './src/components/AppWrapper';
import { ThemeProvider } from './src/context/ThemeContext';
import { UserProvider } from './src/context/UserContext';

  export default function App() {
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
