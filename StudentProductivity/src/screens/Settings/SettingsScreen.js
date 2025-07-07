import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Switch,
  Alert,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import ScreenLayout from '../../components/ScreenLayout';
import { AnalyticsService } from '../../utils/analyticsService';
import { writeJson, deleteJson } from '../../storage/fileStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen({ navigation }) {
  const { theme, isDarkMode, themeMode, changeThemeMode, toggleTheme, systemTheme } = useTheme();
  const [exportSettings, setExportSettings] = useState({
    includePlannerData: true,
    includeTrackerData: true,
    plannerNotifications: false,
    trackerNotifications: false,
  });
  const [loading, setLoading] = useState(false);
  
  const styles = getStyles(theme);

  useEffect(() => {
    loadExportSettings();
  }, []);

  const loadExportSettings = async () => {
    try {
      const settings = await AnalyticsService.getExportSettings();
      setExportSettings(settings);
    } catch (error) {
      console.error('Error loading export settings:', error);
    }
  };

  const updateExportSetting = async (key, value) => {
    try {
      const newSettings = { ...exportSettings, [key]: value };
      setExportSettings(newSettings);
      await AnalyticsService.updateExportSettings(newSettings);
    } catch (error) {
      console.error('Error updating export setting:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
    }
  };

  const handleCSVExport = async () => {
    setLoading(true);
    try {
      const csvContent = await AnalyticsService.exportToCSV();
      
      // Create a shareable CSV file
      const fileName = `study_data_${new Date().toISOString().slice(0, 10)}.csv`;
      
      if (Share) {
        await Share.share({
          message: csvContent,
          title: 'Study Data Export',
        });
      } else {
        Alert.alert(
          'Export Ready',
          'Your data has been prepared for export. Copy the data from the next alert.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Copy Data', 
              onPress: () => {
                Alert.alert('CSV Data', csvContent, [
                  { text: 'Done', style: 'default' }
                ]);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      Alert.alert(
        'Export Error',
        error.message || 'Failed to export data. Please check your export settings and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleThemeModeChange = (mode) => {
    changeThemeMode(mode);
    
    if (mode === 'system') {
      Alert.alert(
        'System Theme',
        `Theme will follow your device's system theme (currently ${systemTheme}).`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleResetAppData = async () => {
    Alert.alert(
      'Reset Everything',
      'This will permanently delete ALL your data including:\n\n• Your user account and login info\n• Daily planner tasks and events\n• All flashcard decks and cards\n• Study tracker subjects and sessions\n• Analytics and progress data\n• All app settings and preferences\n\nThis action cannot be undone and you will need to create a new account. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Everything', 
          style: 'destructive',
          onPress: confirmResetAppData
        }
      ]
    );
  };

  const handleResetAppDataKeepAccount = async () => {
    Alert.alert(
      'Reset App Data (Keep Account)',
      'This will permanently delete your study data while preserving your account:\n\n✅ KEEP:\n• Your user account and login info\n• App settings and preferences\n\n❌ DELETE:\n• Daily planner tasks and events\n• All flashcard decks and cards\n• Study tracker subjects and sessions\n• Analytics and progress data\n• Session tracking data\n\nThis action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset Data Only', 
          style: 'destructive',
          onPress: confirmResetAppDataKeepAccount
        }
      ]
    );
  };

  const confirmResetAppData = () => {
    Alert.alert(
      'Final Confirmation',
      'Are you absolutely sure you want to delete ALL app data? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Yes, Delete Everything', 
          style: 'destructive',
          onPress: performResetAppData
        }
      ]
    );
  };

  const confirmResetAppDataKeepAccount = () => {
    Alert.alert(
      'Final Confirmation',
      'Are you absolutely sure you want to delete all study data while keeping your account? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Yes, Reset Study Data', 
          style: 'destructive',
          onPress: performResetAppDataKeepAccount
        }
      ]
    );
  };

  const performResetAppData = async () => {
    setLoading(true);
    
    try {
      // Clear AsyncStorage (Study Tracker data and Planner data)
      await AsyncStorage.clear();
      
      // Alternatively, clear specific keys for more granular control:
      const asyncStorageKeysToDelete = [
        'study_tracker_data',  // Study tracker data
        'planner_data',        // Daily planner data
      ];
      
      for (const key of asyncStorageKeysToDelete) {
        try {
          await AsyncStorage.removeItem(key);
        } catch (error) {
          console.log(`AsyncStorage key ${key} may not exist or already deleted`);
        }
      }
      
      // Clear all JSON files
      const filesToDelete = [
        'users.json',           // User authentication data
        'flashcards.json',      // Flashcard decks and cards
        'analytics.json',       // Analytics and export settings
        'planner.json',         // Daily planner data (if stored in JSON)
        'settings.json',        // App settings (if stored in JSON)
        'export_settings.json'  // Export preferences
      ];
      
      // Delete all data files
      for (const file of filesToDelete) {
        try {
          await deleteJson(file);
        } catch (error) {
          console.log(`File ${file} may not exist or already deleted`);
        }
      }
      
      // Clear analytics data specifically
      await AnalyticsService.clearAnalyticsData();
      
      // Reset export settings to defaults
      const defaultExportSettings = {
        includePlannerData: true,
        includeTrackerData: true,
        plannerNotifications: false,
        trackerNotifications: false,
      };
      
      await AnalyticsService.updateExportSettings(defaultExportSettings);
      setExportSettings(defaultExportSettings);
      
      setLoading(false);
      
      Alert.alert(
        'Reset Complete',
        'All app data has been successfully deleted. The app will now restart with clean data.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to login/auth screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error resetting app data:', error);
      setLoading(false);
      Alert.alert(
        'Reset Failed',
        'There was an error resetting some app data. Please try again or restart the app manually.',
        [{ text: 'OK' }]
      );
    }
  };

  const performResetAppDataKeepAccount = async () => {
    setLoading(true);
    
    try {
      // Clear specific AsyncStorage keys for study data only (preserve user account)
      const asyncStorageKeysToDelete = [
        'study_tracker_data',     // Study tracker data
        'planner_data',          // Daily planner data
        'export_settings',       // Export preferences
        'sessionTracking',       // Session tracking data
        'linkedSessions',        // Calendar-session links
        'subject_performance',   // Subject performance data
      ];
      
      for (const key of asyncStorageKeysToDelete) {
        try {
          await AsyncStorage.removeItem(key);
          console.log(`Cleared AsyncStorage key: ${key}`);
        } catch (error) {
          console.log(`AsyncStorage key ${key} may not exist or already deleted`);
        }
      }
      
      // Clear specific JSON files (preserve users.json and theme settings)
      const filesToDelete = [
        'flashcards.json',      // Flashcard decks and cards
        'analytics.json',       // Analytics and session data
        'planner.json',         // Daily planner data (if stored in JSON)
        'session_links.json',   // Session linking data
        'planned_sessions.json' // Planned session data
      ];
      
      // Delete study data files
      for (const file of filesToDelete) {
        try {
          await deleteJson(file);
          console.log(`Deleted file: ${file}`);
        } catch (error) {
          console.log(`File ${file} may not exist or already deleted`);
        }
      }
      
      // Clear analytics data specifically but preserve export settings structure
      await AnalyticsService.clearAnalyticsData();
      
      // Reset export settings to defaults (preserve the settings structure)
      const defaultExportSettings = {
        includePlannerData: true,
        includeTrackerData: true,
        plannerNotifications: false,
        trackerNotifications: false,
      };
      
      await AnalyticsService.updateExportSettings(defaultExportSettings);
      setExportSettings(defaultExportSettings);
      
      setLoading(false);
      
      Alert.alert(
        'Reset Complete',
        'All study data has been successfully deleted while preserving your account. You can continue using the app with a fresh start.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to home or refresh current screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs', params: { screen: 'Home' } }],
              });
            }
          }
        ]
      );
      
    } catch (error) {
      setLoading(false);
      Alert.alert(
        'Reset Error',
        'An error occurred while resetting app data. Some data may not have been cleared. Please try again.'
      );
      console.error('Reset app data error:', error);
    }
  };

  const SettingItem = ({ icon, title, subtitle, children, onPress, showArrow = false }) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={24} color={theme.colors.primary} />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.settingRight}>
        {children}
        {showArrow && (
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={theme.colors.textSecondary} 
          />
        )}
      </View>
    </TouchableOpacity>
  );

  const ThemeOption = ({ mode, title, subtitle, isSelected, onSelect }) => (
    <TouchableOpacity 
      style={[styles.themeOption, isSelected && styles.themeOptionSelected]} 
      onPress={() => onSelect(mode)}
    >
      <View style={styles.themeOptionContent}>
        <Text style={[styles.themeOptionTitle, isSelected && styles.themeOptionTitleSelected]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.themeOptionSubtitle, isSelected && styles.themeOptionSubtitleSelected]}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
        {isSelected && <View style={styles.radioButtonInner} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenLayout
      showHeader={true}
      headerTitle="Settings"
      headerIcon="settings-outline"
      scrollable={true}
      navigation={navigation}
    >
        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          
          {/* Quick Theme Toggle */}
          <SettingItem
            icon="contrast-outline"
            title="Dark Mode"
            subtitle={
              themeMode === 'system' 
                ? `Following system (${systemTheme})` 
                : `${isDarkMode ? 'Dark' : 'Light'} theme`
            }
          >
            <Switch
              value={themeMode === 'system' ? systemTheme === 'dark' : isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ 
                false: theme.colors.border, 
                true: theme.colors.primary 
              }}
              thumbColor={isDarkMode ? theme.colors.surface : theme.colors.background}
              disabled={themeMode === 'system'}
            />
          </SettingItem>

          {/* Theme Mode Selection */}
          <View style={styles.themeSelection}>
            <Text style={styles.themeSelectionTitle}>Theme Mode</Text>
            
            <ThemeOption
              mode="system"
              title="Follow System"
              subtitle={`Currently ${systemTheme}`}
              isSelected={themeMode === 'system'}
              onSelect={handleThemeModeChange}
            />
            
            <ThemeOption
              mode="light"
              title="Light Mode"
              subtitle="Always use light theme"
              isSelected={themeMode === 'light'}
              onSelect={handleThemeModeChange}
            />
            
            <ThemeOption
              mode="dark"
              title="Dark Mode"
              subtitle="Always use dark theme"
              isSelected={themeMode === 'dark'}
              onSelect={handleThemeModeChange}
            />
          </View>
        </View>

        {/* App Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>
          
          <SettingItem
            icon="notifications-outline"
            title="Daily Planner Notifications"
            subtitle="Reminders for planned study sessions"
          >
            <Switch
              value={exportSettings.plannerNotifications}
              onValueChange={(value) => updateExportSetting('plannerNotifications', value)}
              trackColor={{ 
                false: theme.colors.border, 
                true: theme.colors.primary 
              }}
              thumbColor={theme.colors.surface}
            />
          </SettingItem>
          
          <SettingItem
            icon="alarm-outline"
            title="Study Tracker Notifications"
            subtitle="Alerts for study goals and breaks"
          >
            <Switch
              value={exportSettings.trackerNotifications}
              onValueChange={(value) => updateExportSetting('trackerNotifications', value)}
              trackColor={{ 
                false: theme.colors.border, 
                true: theme.colors.primary 
              }}
              thumbColor={theme.colors.surface}
            />
          </SettingItem>
          
          <SettingItem
            icon="document-attach-outline"
            title="Export Data to CSV"
            subtitle="Download your study data"
            showArrow
            onPress={handleCSVExport}
          />
        </View>

        {/* Study Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Study Settings</Text>
          
          <SettingItem
            icon="stats-chart-outline"
            title="Analytics"
            subtitle="Study tracking and insights"
            showArrow
            onPress={() => navigation.navigate('Analytics')}
          />
          
          <SettingItem
            icon="calendar-outline"
            title="Export Daily Planner Data"
            subtitle="Include planner data in exports"
          >
            <Switch
              value={exportSettings.includePlannerData}
              onValueChange={(value) => updateExportSetting('includePlannerData', value)}
              trackColor={{ 
                false: theme.colors.border, 
                true: theme.colors.primary 
              }}
              thumbColor={theme.colors.surface}
            />
          </SettingItem>
          
          <SettingItem
            icon="timer-outline"
            title="Export Study Tracker Data"
            subtitle="Include tracker data in exports"
          >
            <Switch
              value={exportSettings.includeTrackerData}
              onValueChange={(value) => updateExportSetting('includeTrackerData', value)}
              trackColor={{ 
                false: theme.colors.border, 
                true: theme.colors.primary 
              }}
              thumbColor={theme.colors.surface}
            />
          </SettingItem>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <SettingItem
            icon="information-circle-outline"
            title="App Version"
            subtitle="1.0.0"
          />
        </View>

        {/* Reset Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          
          <TouchableOpacity 
            style={[styles.resetButton, loading && styles.resetButtonDisabled]}
            onPress={handleResetAppDataKeepAccount}
            disabled={loading}
          >
            <Ionicons name="refresh-outline" size={20} color={loading ? theme.colors.textSecondary : '#FF9800'} />
            <View style={styles.resetButtonContent}>
              <Text style={[styles.resetButtonText, { color: loading ? theme.colors.textSecondary : '#FF9800' }]}>
                {loading ? 'Resetting...' : 'Reset Study Data'}
              </Text>
              <Text style={styles.resetButtonSubtitle}>
                Clear all study data, keep account
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.resetButton, styles.resetButtonDanger, loading && styles.resetButtonDisabled]}
            onPress={handleResetAppData}
            disabled={loading}
          >
            <Ionicons name="trash-outline" size={20} color={loading ? theme.colors.textSecondary : theme.colors.error} />
            <View style={styles.resetButtonContent}>
              <Text style={[styles.resetButtonText, loading && styles.resetButtonTextDisabled]}>
                {loading ? 'Resetting...' : 'Reset Everything'}
              </Text>
              <Text style={styles.resetButtonSubtitle}>
                Delete all data including account
              </Text>
            </View>
          </TouchableOpacity>
        </View>
    </ScreenLayout>
  );
}

const getStyles = (theme) => StyleSheet.create({
  section: {
    marginTop: 24,
  },
  lastSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeSelection: {
    marginTop: 16,
  },
  themeSelectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 12,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background,
  },
  themeOptionContent: {
    flex: 1,
  },
  themeOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  themeOptionTitleSelected: {
    color: theme.colors.primary,
  },
  themeOptionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  themeOptionSubtitleSelected: {
    color: theme.colors.primary,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: theme.colors.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FF9800',
    marginBottom: 12,
  },
  resetButtonDanger: {
    borderColor: theme.colors.error,
  },
  resetButtonContent: {
    flex: 1,
    marginLeft: 12,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FF9800',
  },
  resetButtonSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  resetButtonDisabled: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    opacity: 0.5,
  },
  resetButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
}); 