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
import { typography } from '../theme/designSystem';
import NavigationSessionTracker from '../components/NavigationSessionTracker';

import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';

import TodayScreen from '../screens/TodayScreen';
import PlanScreen from '../screens/PlanScreen';
import FocusScreen from '../screens/FocusScreen';
import DeckListScreen from '../screens/Flashcards/DeckListScreen';
import DeckEditorScreen from '../screens/Flashcards/DeckEditorScreen';
import StudyScreen from '../screens/Flashcards/StudyScreen';
import StudyTrackerScreen from '../screens/Tracker/StudyTrackerScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import AnalyticsScreen from '../screens/Settings/AnalyticsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const AppStack = createStackNavigator();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

const TAB_PRESENTATION = {
  Home: { label: 'Today', icon: 'today-outline', activeIcon: 'today' },
  Planner: { label: 'Plan', icon: 'calendar-outline', activeIcon: 'calendar' },
  Tracker: { label: 'Focus', icon: 'timer-outline', activeIcon: 'timer' },
  Flashcards: { label: 'Learn', icon: 'layers-outline', activeIcon: 'layers' },
  Progress: { label: 'Progress', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
};

function MainTabs() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const presentation = TAB_PRESENTATION[route.name] || TAB_PRESENTATION.Home;

        return {
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: theme.colors.tabBackground,
            borderTopColor: theme.colors.tabBorder,
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 82 + insets.bottom : 66 + insets.bottom,
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 8),
            paddingTop: 7,
          },
          tabBarActiveTintColor: theme.colors.tabActive,
          tabBarInactiveTintColor: theme.colors.tabInactive,
          tabBarLabel: presentation.label,
          tabBarLabelStyle: {
            fontFamily: typography.regular,
            fontSize: 11,
            marginTop: 1,
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? presentation.activeIcon : presentation.icon}
              size={21}
              color={color}
            />
          ),
        };
      }}
    >
      <Tab.Screen name="Home" component={TodayScreen} />
      <Tab.Screen name="Planner" component={PlanScreen} />
      <Tab.Screen name="Tracker" component={FocusScreen} />
      <Tab.Screen name="Flashcards" component={DeckListScreen} />
      <Tab.Screen name="Progress" component={AnalyticsScreen} />
    </Tab.Navigator>
  );
}

function AuthNavigationSynchronizer({ currentUser, isLoading }) {
  useEffect(() => {
    if (isLoading || !navigationRef.isReady()) return;

    const state = navigationRef.getRootState();
    const activeRoute = state?.routes?.[state.index ?? 0]?.name;
    const isAuthRoute = ['Login', 'Register', 'ForgotPassword'].includes(activeRoute);
    const needsReset = currentUser ? isAuthRoute : !isAuthRoute;

    if (needsReset) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: currentUser ? 'MainTabs' : 'Login' }],
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
        <AppStack.Screen name="TrackerLegacy" component={StudyTrackerScreen} />
        <AppStack.Screen name="Analytics" component={AnalyticsScreen} />
        <AppStack.Screen name="Settings" component={SettingsScreen} />
        <AppStack.Screen name="Profile" component={ProfileScreen} />
      </AppStack.Navigator>
    </NavigationContainer>
  );
}
