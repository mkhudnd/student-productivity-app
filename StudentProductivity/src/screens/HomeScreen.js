// HomeScreen.js - Main dashboard and landing page for the Student Productivity App
// This screen provides:
// - Welcome message and user greeting
// - Quick access navigation to all major app features
// - User context integration for personalized experience
// - Clean, accessible interface following Material Design principles
// - Theme-aware styling with light/dark mode support

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Poppins_700Bold, Poppins_400Regular, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { readJson } from '../storage/fileStorage';
import ScreenLayout from '../components/ScreenLayout';

const SCREEN_WIDTH = Dimensions.get('window').width;

// HomeScreen Component - serves as the main dashboard for user navigation
export default function HomeScreen({ navigation }) {
  const [fontsLoaded] = useFonts({ 
    Poppins_700Bold, 
    Poppins_400Regular, 
    Poppins_600SemiBold 
  });
  const { theme } = useTheme();
  const { currentUser } = useUser();
  const [studyStats, setStudyStats] = useState({
    totalDecks: 0,
    totalCards: 0,
    cardsStudiedToday: 0,
    streakDays: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  
  useEffect(() => {
    loadStudyStats();
  }, []);

  async function loadStudyStats() {
    try {
      // Only load stats if user is logged in
      if (!currentUser) {
        setStudyStats({ totalDecks: 0, totalCards: 0, cardsStudiedToday: 0, streakDays: 0 });
        setRecentActivity([]);
        return;
      }

      // Load user's flashcard statistics
      const { FlashcardService } = require('../utils/flashcardService');
      const flashcards = await FlashcardService.getUserFlashcardDecks(currentUser);
      const totalDecks = flashcards.length;
      const totalCards = flashcards.reduce((sum, deck) => sum + deck.cards.length, 0);
      
      // Get today's date
      const today = new Date().toISOString().slice(0, 10);
      const cardsStudiedToday = flashcards.reduce((sum, deck) => {
        return sum + deck.cards.filter(card => card.lastStudied === today).length;
      }, 0);

      // Calculate study streak (simplified)
      let streakDays = 1; // Start with 1 for today if studied
      if (cardsStudiedToday === 0) streakDays = 0;

      setStudyStats({
        totalDecks,
        totalCards,
        cardsStudiedToday,
        streakDays
      });

      // Set recent activity (last 3 decks with recent activity)
      const recentDecks = flashcards
        .filter(deck => deck.cards.some(card => card.lastStudied))
        .sort((a, b) => {
          const aLastStudied = Math.max(...a.cards.map(card => card.lastStudied ? new Date(card.lastStudied).getTime() : 0));
          const bLastStudied = Math.max(...b.cards.map(card => card.lastStudied ? new Date(card.lastStudied).getTime() : 0));
          return bLastStudied - aLastStudied;
        })
        .slice(0, 3);

      setRecentActivity(recentDecks);
    } catch (error) {
      console.error('Error loading study stats:', error);
    }
  }

  if (!fontsLoaded) return null;

  const goToTab = (tab) => {
    navigation.replace('MainTabs', { screen: tab });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '☀️ Good morning';
    if (hour < 17) return '☀️ Good afternoon';
    return '🌙 Good evening';
  };

  // Quick Access Features Configuration - defines main app features with navigation
  // Each feature includes an icon, title, description, and navigation target
  const features = [
    {
      id: 'planner',
      icon: 'calendar-outline',
      title: 'Daily Planner',
      description: 'Schedule your study sessions and manage tasks',
      screen: 'Planner',
      color: theme.colors.primary,
    },
    {
      id: 'tracker',
      icon: 'timer-outline', 
      title: 'Study Tracker',
      description: 'Track your study time and monitor progress',
      screen: 'Tracker',
      color: '#4CAF50',
    },
    {
      id: 'flashcards',
      icon: 'library-outline',
      title: 'Flashcards',
      description: 'Create and study flashcard decks with spaced repetition',
      screen: 'Flashcards',
      color: '#FF9800',
    },
    {
      id: 'profile',
      icon: 'person-outline',
      title: 'Profile',
      description: 'View your progress and manage settings',
      screen: 'Profile',
      color: '#607D8B',
    }
  ];

  // Navigation Handler - handles feature card taps and navigation
  const handleFeaturePress = (feature) => {
    try {
      navigation.navigate(feature.screen);
    } catch (error) {
      console.error('Navigation error:', error);
      // Could implement error handling or fallback navigation here
    }
  };

  // Feature Card Component - renders individual feature cards with icons and descriptions
  const FeatureCard = ({ feature }) => (
    <TouchableOpacity
      style={[styles.featureCard, { borderLeftColor: feature.color }]}
      onPress={() => handleFeaturePress(feature)}
      accessibilityRole="button"
      accessibilityLabel={`Navigate to ${feature.title}`}
      accessibilityHint={feature.description}
    >
      {/* Feature Icon */}
      <View style={[styles.featureIcon, { backgroundColor: `${feature.color}20` }]}>
        <Ionicons name={feature.icon} size={28} color={feature.color} />
      </View>
      
      {/* Feature Content */}
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{feature.title}</Text>
        <Text style={styles.featureDescription}>{feature.description}</Text>
      </View>
      
      {/* Navigation Arrow */}
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  // Apply theme-based styles
  const styles = getStyles(theme);

  // Main Render - displays the complete home screen interface
  return (
    <ScreenLayout
      scrollable={true}
      showHeader={true}
      headerTitle="Home"
      headerIcon="home-outline"
      headerRight={
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Ionicons name="person-circle-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      }
      navigation={navigation}
    >
        {/* Welcome Section - greeting and date info */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>
            {getGreeting()}
          </Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
          <Text style={styles.appTagline}>Student Productivity App • Stay focused, stay organized</Text>
        </View>

        {/* Today's Overview Section */}
        <View style={styles.overviewSection}>
          <Text style={styles.overviewTitle}>Today's Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Ionicons name="library-outline" size={24} color={theme.colors.primary} />
                <Text style={styles.statNumber}>{studyStats.totalDecks}</Text>
                <Text style={styles.statLabel}>Decks</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="card-outline" size={24} color="#4CAF50" />
                <Text style={styles.statNumber}>{studyStats.totalCards}</Text>
                <Text style={styles.statLabel}>Cards</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Ionicons name="checkmark-circle-outline" size={24} color="#FF9800" />
                <Text style={styles.statNumber}>{studyStats.cardsStudiedToday}</Text>
                <Text style={styles.statLabel}>Studied Today</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="flame-outline" size={24} color="#F44336" />
                <Text style={styles.statNumber}>{studyStats.streakDays}</Text>
                <Text style={styles.statLabel}>Day Streak</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions Section */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity 
              style={[styles.quickActionBtn, styles.primaryAction]}
              onPress={() => navigation.navigate('Flashcards')}
            >
              <Ionicons name="add-circle-outline" size={20} color="white" />
              <Text style={styles.quickActionText}>New Deck</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.quickActionBtn, styles.secondaryAction]}
              onPress={() => navigation.navigate('Flashcards')}
            >
              <Ionicons name="play-outline" size={20} color="white" />
              <Text style={styles.quickActionText}>Study Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Features</Text>
          
          {/* Features List - displays all available app features */}
          <View style={styles.featuresContainer}>
            {features.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </View>
        </View>
    </ScreenLayout>
  );
}

const getStyles = (theme) => StyleSheet.create({
  // Welcome Section
  welcomeSection: { 
    marginBottom: 24
  },
  welcomeText: { 
    fontSize: 24, 
    fontFamily: 'Poppins_700Bold', 
    color: theme.colors.text,
    marginBottom: 4
  },
  dateText: { 
    fontSize: 14, 
    fontFamily: 'Poppins_400Regular', 
    color: theme.colors.textSecondary,
    marginBottom: 8
  },
  appTagline: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: theme.colors.textSecondary,
    fontStyle: 'italic'
  },
  settingsButton: { 
    padding: 8 
  },
  
  // Today's Overview
  overviewSection: {
    marginBottom: 24
  },
  overviewTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: theme.colors.text,
    marginBottom: 16
  },
  statsGrid: {
    gap: 12
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  statNumber: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    color: theme.colors.text,
    marginTop: 8,
    marginBottom: 4
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: theme.colors.textSecondary,
    textAlign: 'center'
  },
  
  // Quick Actions
  quickActionsSection: {
    marginBottom: 24
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8
  },
  primaryAction: {
    backgroundColor: '#2196F3'
  },
  secondaryAction: {
    backgroundColor: '#4CAF50'
  },
  quickActionText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: 'white'
  },
  
  // Features Section
  featuresSection: {
    marginBottom: 24
  },
  sectionTitle: { 
    fontSize: 18, 
    fontFamily: 'Poppins_600SemiBold', 
    color: theme.colors.text, 
    marginBottom: 16 
  },
  
  // Features Container
  featuresContainer: { 
    gap: 12,
    paddingBottom: 20
  },
  featureCard: { 
    backgroundColor: theme.colors.card, 
    borderRadius: 16, 
    padding: 20, 
    flexDirection: 'row', 
    alignItems: 'center',
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  featureIcon: { 
    width: 56, 
    height: 56, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginRight: 16
  },
  featureContent: { 
    flex: 1 
  },
  featureTitle: { 
    fontSize: 16, 
    fontFamily: 'Poppins_600SemiBold', 
    color: theme.colors.text,
    marginBottom: 4
  },
  featureDescription: { 
    fontSize: 14, 
    fontFamily: 'Poppins_400Regular', 
    color: theme.colors.textSecondary 
  }
}); 