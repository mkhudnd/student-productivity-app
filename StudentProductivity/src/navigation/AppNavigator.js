import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import NavigationSessionTracker from '../components/NavigationSessionTracker';

// Import Auth screens
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';
// Import main screens
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
        tabBarIcon: ({ color, size }) => {
          let iconName;
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

// AppNavigator sets up the navigation structure for authentication
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <NavigationSessionTracker />
      <AppStack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        {/* Auth screens */}
        <AppStack.Screen name="Login" component={LoginScreen} />
        <AppStack.Screen name="Register" component={RegisterScreen} />
        <AppStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        {/* Main app screens (tab navigator) */}
        <AppStack.Screen name="MainTabs" component={MainTabs} />
        <AppStack.Screen name="DeckEditor" component={DeckEditorScreen} />
        <AppStack.Screen name="Study" component={StudyScreen} />
        <AppStack.Screen name="Analytics" component={AnalyticsScreen} />
      </AppStack.Navigator>
    </NavigationContainer>
  );
} 