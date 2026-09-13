import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import NavigationSessionTracker from '../components/NavigationSessionTracker';

// Auth screens
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';

// Main screens
import HomeScreen from '../screens/HomeScreen';
import DeckListScreen from '../screens/Flashcards/DeckListScreen';
import DeckEditorScreen from '../screens/Flashcards/DeckEditorScreen';
import StudyScreen from '../screens/Flashcards/StudyScreen';
import PlannerScreen from '../screens/Planner/PlannerScreen';
import StudyTrackerScreen from '../screens/Tracker/StudyTrackerScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import AnalyticsScreen from '../screens/Settings/AnalyticsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const AppStack = createStackNavigator();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

function MainTabs() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBackground,
          borderTopColor: theme.colors.tabBorder,
          height: Platform.OS === 'ios' ? 84 + insets.bottom : 68 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.tabActive,
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarLabelStyle: { fontFamily: 'Poppins_400Regular', fontSize: 12 },
        tabBarIcon: ({ color }) => {
          let iconName = 'ellipse-outline';
          if (route.name === 'Home') iconName = 'home-outline';
          else if (route.name === 'Planner') iconName = 'calendar-outline';
          else if (route.name === 'Flashcards') iconName = 'book-outline';
          else if (route.name === 'Tracker') iconName = 'stats-chart-outline';
          else if (route.name === 'Settings') iconName = 'settings-outline';
          else if (route.name === 'Profile') iconName = 'person-outline';
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Planner" component={PlannerScreen} />
      <Tab.Screen name="Flashcards" component={DeckListScreen} />
      <Tab.Screen name="Tracker" component={StudyTrackerScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/**
 * Keeps the root navigation state aligned with authentication state.
 * This fixes two launch-blocking cases:
 * 1. a persisted user was still sent to Login after an app restart;
 * 2. logging out could leave the user inside MainTabs.
 */
function AuthNavigationSynchronizer({ currentUser, isLoading }) {
  useEffect(() => {
    if (isLoading || !navigationRef.isReady()) return;

    const state = navigationRef.getRootState();
    const activeRoute = state?.routes?.[state.index ?? 0]?.name;
    const targetRoute = currentUser ? 'MainTabs' : 'Login';

    const isAuthRoute = ['Login', 'Register', 'ForgotPassword'].includes(activeRoute);
    const needsReset = currentUser ? isAuthRoute : activeRoute !== 'Login';

    if (needsReset) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: targetRoute }],
      });
    }
  }, [currentUser, isLoading]);

  return null;
}

export default function AppNavigator() {
  const { theme } = useTheme();
  const { currentUser, isLoading } = useUser();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <NavigationSessionTracker />
      <AuthNavigationSynchronizer currentUser={currentUser} isLoading={isLoading} />
      <AppStack.Navigator
        initialRouteName={currentUser ? 'MainTabs' : 'Login'}
        screenOptions={{ headerShown: false }}
      >
        <AppStack.Screen name="Login" component={LoginScreen} />
        <AppStack.Screen name="Register" component={RegisterScreen} />
        <AppStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <AppStack.Screen name="MainTabs" component={MainTabs} />
        <AppStack.Screen name="DeckEditor" component={DeckEditorScreen} />
        <AppStack.Screen name="Study" component={StudyScreen} />
        <AppStack.Screen name="Analytics" component={AnalyticsScreen} />
      </AppStack.Navigator>
    </NavigationContainer>
  );
}
