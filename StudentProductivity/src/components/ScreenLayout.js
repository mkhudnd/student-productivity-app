import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { layout, spacing, typography } from '../theme/designSystem';

export default function ScreenLayout({
  children,
  showHeader = false,
  headerTitle = '',
  showBackButton = false,
  headerIcon = null,
  headerRight = null,
  onBackPress = null,
  scrollable = false,
  keyboardAvoidingView = false,
  contentContainerStyle = {},
  headerStyle = {},
  horizontalPadding = true,
  verticalPadding = true,
  navigation = null,
}) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const handleBackPress = () => {
    if (onBackPress) onBackPress();
    else if (navigation?.canGoBack()) navigation.goBack();
  };

  const contentPadding = {
    paddingHorizontal: horizontalPadding ? layout.screenPadding : 0,
    paddingVertical: verticalPadding ? spacing.md : 0,
  };

  const renderHeader = () => {
    if (!showHeader) return null;

    return (
      <View style={[styles.header, headerStyle]}>
        <View style={styles.headerSide}>
          {showBackButton ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleBackPress}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          ) : headerIcon ? (
            <View style={styles.headerIconContainer}>
              <Ionicons name={headerIcon} size={20} color={theme.colors.primary} />
            </View>
          ) : null}
        </View>

        <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>

        <View style={[styles.headerSide, styles.headerSideRight]}>
          {headerRight}
        </View>
      </View>
    );
  };

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

  const LayoutWrapper = keyboardAvoidingView ? KeyboardAvoidingView : View;
  const layoutProps = keyboardAvoidingView
    ? {
        style: styles.container,
        behavior: Platform.OS === 'ios' ? 'padding' : 'height',
        keyboardVerticalOffset: 40,
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
  header: {
    minHeight: 60,
    paddingHorizontal: layout.screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.separator,
    backgroundColor: theme.colors.background,
  },
  headerSide: {
    width: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.semibold,
    fontSize: typography.sizes.titleSmall,
    color: theme.colors.text,
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
