import React from 'react';
import { 
  View, 
  StyleSheet, 
  StatusBar, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  Text,
  TouchableOpacity 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/**
 * StandardizedScreenLayout - A reusable layout component that ensures consistent 
 * structure across all screens in the Student Productivity app
 * 
 * Features:
 * - Consistent SafeAreaView and StatusBar handling
 * - Optional header with title and back button
 * - Optional keyboard avoidance
 * - Optional scroll functionality
 * - Theme-aware styling
 * - Standardized padding and margins
 */
export default function ScreenLayout({
  children,
  // Header options
  showHeader = false,
  headerTitle = '',
  showBackButton = false,
  headerIcon = null,
  headerRight = null,
  onBackPress = null,
  // Layout options
  scrollable = false,
  keyboardAvoidingView = false,
  // Style options
  contentContainerStyle = {},
  headerStyle = {},
  // Padding options
  horizontalPadding = true,
  verticalPadding = true,
  // Navigation prop (for default back functionality)
  navigation = null,
}) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  // Default back button handler
  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  // Header component
  const renderHeader = () => {
    if (!showHeader) return null;

    return (
      <View style={[styles.header, headerStyle]}>
        <View style={styles.headerLeft}>
          {showBackButton && (
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleBackPress}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons 
                name="chevron-back" 
                size={24} 
                color={theme.colors.text} 
              />
            </TouchableOpacity>
          )}
          {headerIcon && (
            <View style={styles.headerIconContainer}>
              <Ionicons 
                name={headerIcon} 
                size={24} 
                color={theme.colors.primary} 
              />
            </View>
          )}
        </View>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
        </View>

        <View style={styles.headerRight}>
          {headerRight}
        </View>
      </View>
    );
  };

  // Content container with optional padding
  const contentPadding = {
    paddingHorizontal: horizontalPadding ? 20 : 0,
    paddingVertical: verticalPadding ? 16 : 0,
  };

  // Main content component
  const renderContent = () => {
    if (scrollable) {
      return (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, contentPadding, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      );
    }

    return (
      <View style={[styles.content, contentPadding, contentContainerStyle]}>
        {children}
      </View>
    );
  };

  // Main layout wrapper
  const LayoutWrapper = keyboardAvoidingView ? KeyboardAvoidingView : View;
  const layoutProps = keyboardAvoidingView 
    ? {
        style: styles.keyboardView,
        behavior: Platform.OS === 'ios' ? 'padding' : 'height',
        keyboardVerticalOffset: 40
      }
    : { style: styles.container };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar 
        barStyle={theme.isDark ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background}
        translucent={false}
      />
      
      <LayoutWrapper {...layoutProps}>
        {renderHeader()}
        {renderContent()}
      </LayoutWrapper>
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 56,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 100,
    maxWidth: 150,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 100,
    maxWidth: 200,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
  },
  headerIconContainer: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
  },
}); 