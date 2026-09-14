import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenLayout from '../../components/ScreenLayout';
import {
  AppIcon,
  Card,
  IconButton,
  ScreenIntro,
  SectionHeader,
} from '../../components/ui';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { AnalyticsService } from '../../utils/analyticsService';
import { DataMigrationService } from '../../utils/dataMigration';
import { deleteJson } from '../../storage/fileStorage';
import { layout, radius, spacing, typography } from '../../theme/designSystem';

const DEFAULT_EXPORT_SETTINGS = {
  includePlannerData: true,
  includeTrackerData: true,
  includeAppUsageData: true,
  includeFocusSessionData: true,
  plannerNotifications: false,
  trackerNotifications: false,
};

export default function SettingsScreen({ navigation }) {
  const { theme, isDarkMode, themeMode, changeThemeMode, toggleTheme, systemTheme } = useTheme();
  const { currentUser, logoutUser } = useUser();
  const styles = getStyles(theme);
  const [exportSettings, setExportSettings] = useState(DEFAULT_EXPORT_SETTINGS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AnalyticsService.getExportSettings()
      .then((settings) => setExportSettings({ ...DEFAULT_EXPORT_SETTINGS, ...(settings || {}) }))
      .catch((error) => console.error('Error loading export settings:', error));
  }, []);

  const updateSetting = async (key, value) => {
    const next = { ...exportSettings, [key]: value };
    setExportSettings(next);
    try {
      await AnalyticsService.updateExportSettings(next);
    } catch (error) {
      setExportSettings(exportSettings);
      Alert.alert('Could not save setting', 'Please try again.');
    }
  };

  const exportCsv = async () => {
    setLoading(true);
    try {
      const csv = await AnalyticsService.exportToCSV(currentUser);
      await Share.share({ message: csv, title: 'Student Productivity data export' });
    } catch (error) {
      Alert.alert('Export unavailable', error.message || 'There is no data available to export yet.');
    } finally {
      setLoading(false);
    }
  };

  const clearMyStudyData = () => {
    Alert.alert(
      'Reset your study data?',
      'This removes your Plan, Focus, Learn and Progress data from this device. Your local account stays available.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset study data',
          style: 'destructive',
          onPress: async () => {
            if (!currentUser?.email) return;
            setLoading(true);
            try {
              const email = currentUser.email;
              await Promise.all([
                AsyncStorage.removeItem(`planner_data_${email}`),
                AsyncStorage.removeItem(`study_tracker_data_${email}`),
                AsyncStorage.removeItem(`focus_runtime_${email}`),
                DataMigrationService.cleanupUserData(email),
                AnalyticsService.clearAnalyticsData(currentUser),
              ]);
              Alert.alert('Study data reset', 'Your account is still available, but your study workspace is now empty.');
            } catch (error) {
              Alert.alert('Reset failed', 'Some study data could not be cleared. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const resetEntireApp = () => {
    Alert.alert(
      'Reset this app completely?',
      'This deletes every local account and all Student Productivity data stored by this installation. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await logoutUser();
              await AsyncStorage.clear();
              const files = [
                'users.json',
                'flashcards.json',
                'analytics.json',
                'planner.json',
                'settings.json',
                'exportSettings.json',
                'sessionLinks.json',
              ];
              await Promise.all(files.map(async (file) => {
                try { await deleteJson(file); } catch (error) { /* missing files are fine */ }
              }));
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            } catch (error) {
              Alert.alert('Reset failed', 'The app could not clear all local data.');
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenLayout
      scrollable
      horizontalPadding={false}
      verticalPadding={false}
      contentContainerStyle={styles.content}
      navigation={navigation}
    >
      <ScreenIntro
        eyebrow="Settings"
        title="Make the app yours"
        subtitle="Appearance, reminders, data export and local-device controls."
        right={<IconButton icon="close" onPress={() => navigation.goBack()} accessibilityLabel="Close settings" />}
      />

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>Working…</Text>
        </Card>
      ) : null}

      <SectionHeader title="Appearance" subtitle="One theme system across every workspace." style={styles.sectionSpace} />
      <Card style={styles.groupCard}>
        <SettingRow icon="contrast-outline" title="Dark mode" subtitle={themeMode === 'system' ? `Following system · ${systemTheme}` : isDarkMode ? 'Dark' : 'Light'} styles={styles} theme={theme}>
          <Switch
            value={themeMode === 'system' ? systemTheme === 'dark' : isDarkMode}
            onValueChange={toggleTheme}
            disabled={themeMode === 'system'}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={theme.colors.surface}
          />
        </SettingRow>
        <View style={styles.themeOptions}>
          {[
            ['system', 'System', `Follow device · ${systemTheme}`],
            ['light', 'Light', 'Always use light mode'],
            ['dark', 'Dark', 'Always use dark mode'],
          ].map(([mode, title, subtitle]) => (
            <TouchableOpacity
              key={mode}
              style={[styles.themeOption, themeMode === mode && styles.themeOptionActive]}
              onPress={() => changeThemeMode(mode)}
            >
              <View style={styles.themeOptionCopy}>
                <Text style={[styles.themeOptionTitle, themeMode === mode && styles.themeOptionTitleActive]}>{title}</Text>
                <Text style={styles.themeOptionSubtitle}>{subtitle}</Text>
              </View>
              <AppIcon
                name={themeMode === mode ? 'radio-button-on' : 'radio-button-off'}
                size={19}
                color={themeMode === mode ? theme.colors.primary : theme.colors.textMuted}
              />
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <SectionHeader title="Reminders" subtitle="Keep notification preferences in one place." style={styles.sectionSpace} />
      <Card style={styles.groupCard}>
        <SettingRow icon="notifications-outline" title="Plan reminders" subtitle="Reminders for planned study and tasks" styles={styles} theme={theme}>
          <Switch
            value={Boolean(exportSettings.plannerNotifications)}
            onValueChange={(value) => updateSetting('plannerNotifications', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={theme.colors.surface}
          />
        </SettingRow>
        <View style={styles.divider} />
        <SettingRow icon="alarm-outline" title="Focus reminders" subtitle="Study goals and session reminders" styles={styles} theme={theme}>
          <Switch
            value={Boolean(exportSettings.trackerNotifications)}
            onValueChange={(value) => updateSetting('trackerNotifications', value)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={theme.colors.surface}
          />
        </SettingRow>
      </Card>

      <SectionHeader title="Export" subtitle="Choose what is included when you share your data." style={styles.sectionSpace} />
      <Card style={styles.groupCard}>
        <SettingRow icon="calendar-outline" title="Plan data" subtitle="Tasks and planning activity" styles={styles} theme={theme}>
          <Switch value={Boolean(exportSettings.includePlannerData)} onValueChange={(value) => updateSetting('includePlannerData', value)} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor={theme.colors.surface} />
        </SettingRow>
        <View style={styles.divider} />
        <SettingRow icon="timer-outline" title="Study data" subtitle="Focus and tracked study activity" styles={styles} theme={theme}>
          <Switch value={Boolean(exportSettings.includeTrackerData)} onValueChange={(value) => updateSetting('includeTrackerData', value)} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor={theme.colors.surface} />
        </SettingRow>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionRow} onPress={exportCsv}>
          <AppIcon name="share-outline" size={21} color={theme.colors.primary} />
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Export study data</Text>
            <Text style={styles.actionSubtitle}>Share the selected data as CSV</Text>
          </View>
          <AppIcon name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </Card>

      <SectionHeader title="Data on this device" subtitle="Destructive actions stay clearly separated." style={styles.sectionSpace} />
      <Card style={styles.groupCard}>
        <TouchableOpacity style={styles.actionRow} onPress={clearMyStudyData}>
          <AppIcon name="refresh-outline" size={21} color={theme.colors.warning} />
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Reset my study data</Text>
            <Text style={styles.actionSubtitle}>Keep your account, clear Plan, Focus, Learn and Progress</Text>
          </View>
          <AppIcon name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionRow} onPress={resetEntireApp}>
          <AppIcon name="trash-outline" size={21} color={theme.colors.error} />
          <View style={styles.actionCopy}>
            <Text style={[styles.actionTitle, { color: theme.colors.error }]}>Reset entire app</Text>
            <Text style={styles.actionSubtitle}>Delete every local account and all app data</Text>
          </View>
          <AppIcon name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </Card>

      <Text style={styles.version}>Student Productivity · V2</Text>
    </ScreenLayout>
  );
}

function SettingRow({ icon, title, subtitle, children, styles, theme }) {
  return (
    <View style={styles.settingRow}>
      <AppIcon name={icon} size={21} color={theme.colors.primary} />
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  sectionSpace: { marginTop: spacing.xxl },
  loadingCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  groupCard: { padding: 0, overflow: 'hidden' },
  settingRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  settingCopy: { flex: 1 },
  settingTitle: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
  },
  settingSubtitle: {
    fontFamily: typography.regular,
    fontSize: 10,
    lineHeight: 15,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator,
    marginLeft: 52,
  },
  themeOptions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.separator,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  themeOption: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  themeOptionActive: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  themeOptionCopy: { flex: 1 },
  themeOptionTitle: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.text,
  },
  themeOptionTitleActive: { color: theme.colors.primary },
  themeOptionSubtitle: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  actionRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionCopy: { flex: 1 },
  actionTitle: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
  },
  actionSubtitle: {
    fontFamily: typography.regular,
    fontSize: 10,
    lineHeight: 15,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  version: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
