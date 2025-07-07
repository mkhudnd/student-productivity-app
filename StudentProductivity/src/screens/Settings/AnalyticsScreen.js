import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { AnalyticsService } from '../../utils/analyticsService';
import ScreenLayout from '../../components/ScreenLayout';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen({ navigation }) {
  const { theme } = useTheme();
  const { currentUser } = useUser();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(30);
  
  const styles = getStyles(theme);

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, currentUser]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      if (!currentUser) {
        setAnalytics(null);
        setLoading(false);
        return;
      }
      const data = await AnalyticsService.getAnalyticsSummary(dateRange, currentUser);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetCharts = () => {
    Alert.alert(
      'Reset Analytics Data',
      'This will permanently delete all your analytics data including study sessions, planner events, and progress tracking. This action cannot be undone.\n\nAre you sure you want to continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const success = await AnalyticsService.clearAnalyticsData();
              if (success) {
                Alert.alert(
                  'Analytics Reset',
                  'All analytics data has been successfully cleared. Charts will now show empty data.',
                  [{ text: 'OK', onPress: loadAnalytics }]
                );
              } else {
                Alert.alert(
                  'Reset Failed',
                  'Failed to reset analytics data. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Error resetting analytics:', error);
              Alert.alert(
                'Reset Error',
                'An error occurred while resetting analytics data.',
                [{ text: 'OK' }]
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const StatCard = ({ title, value, subtitle, icon, color = theme.colors.primary }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const SectionHeader = ({ title, subtitle }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );

  const DateRangeSelector = () => (
    <View style={styles.dateRangeContainer}>
      <Text style={styles.dateRangeLabel}>Time Period:</Text>
      <View style={styles.dateRangeButtons}>
        {[7, 30, 90].map((days) => (
          <TouchableOpacity
            key={days}
            style={[
              styles.dateRangeButton,
              dateRange === days && styles.dateRangeButtonActive
            ]}
            onPress={() => setDateRange(days)}
          >
            <Text style={[
              styles.dateRangeButtonText,
              dateRange === days && styles.dateRangeButtonTextActive
            ]}>
              {days}d
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <ScreenLayout
        showHeader={true}
        headerTitle="Analytics"
        headerIcon="analytics-outline"
        navigation={navigation}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (!analytics) {
    return (
      <ScreenLayout
        showHeader={true}
        headerTitle="Analytics"
        headerIcon="analytics-outline"
        navigation={navigation}
      >
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Data Available</Text>
          <Text style={styles.emptySubtitle}>
            Start using the daily planner and study tracker to see your analytics here.
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      showHeader={true}
      headerTitle="Analytics"
      headerIcon="analytics-outline"
      scrollable={true}
      headerRight={
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={loadAnalytics} style={styles.headerButton}>
            <Ionicons name="refresh" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleResetCharts} style={styles.headerButton}>
            <Ionicons name="trash-outline" size={20} color="#FF4444" />
          </TouchableOpacity>
        </View>
      }
      navigation={navigation}
    >
        <DateRangeSelector />

        {/* Overview Stats */}
        <SectionHeader 
          title="Overview" 
          subtitle={`Last ${dateRange} days`}
        />
        
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Activities"
            value={analytics.combined.totalActivities}
            subtitle="Sessions & Events"
            icon="calendar-outline"
            color="#4CAF50"
          />
          <StatCard
            title="Total Time"
            value={formatTime(analytics.combined.totalTime)}
            subtitle="Planned & Studied"
            icon="time-outline"
            color="#2196F3"
          />
        </View>

        {/* Study Tracker Analytics */}
        <SectionHeader 
          title="Study Tracker" 
          subtitle="Learning progress"
        />
        
        <View style={styles.statsGrid}>
          <StatCard
            title="Study Sessions"
            value={analytics.study.totalSessions}
            subtitle="Total completed"
            icon="book-outline"
            color="#FF9800"
          />
          <StatCard
            title="Study Time"
            value={formatTime(analytics.study.totalStudyTime)}
            subtitle="Time invested"
            icon="timer-outline"
            color="#9C27B0"
          />
          <StatCard
            title="Average Session"
            value={formatTime(analytics.study.averageSessionTime)}
            subtitle="Per session"
            icon="trending-up-outline"
            color="#00BCD4"
          />
          <StatCard
            title="Study Streak"
            value={`${analytics.study.streakDays} days`}
            subtitle="Current streak"
            icon="flame-outline"
            color="#FF5722"
          />
        </View>

        {/* Subject Breakdown */}
        {Object.keys(analytics.study.subjectBreakdown).length > 0 && (
          <>
            <SectionHeader 
              title="Subject Breakdown" 
              subtitle="Time distribution"
            />
            
            <View style={styles.subjectContainer}>
              {Object.entries(analytics.study.subjectBreakdown)
                .sort(([,a], [,b]) => b.totalTime - a.totalTime)
                .map(([subject, data]) => (
                  <View key={subject} style={styles.subjectItem}>
                    <View style={styles.subjectInfo}>
                      <Text style={styles.subjectName}>{subject}</Text>
                      <Text style={styles.subjectStats}>
                        {data.count} sessions • {formatTime(data.totalTime)}
                      </Text>
                    </View>
                    <View style={styles.subjectProgress}>
                      <View 
                        style={[
                          styles.subjectProgressBar,
                          { 
                            width: `${Math.min(100, (data.totalTime / analytics.study.totalStudyTime) * 100)}%` 
                          }
                        ]} 
                      />
                    </View>
                  </View>
                ))}
            </View>
          </>
        )}

        {/* Daily Planner Analytics */}
        <SectionHeader 
          title="Daily Planner" 
          subtitle="Planning efficiency"
        />
        
        <View style={styles.statsGrid}>
          <StatCard
            title="Planned Events"
            value={analytics.planner.totalEvents}
            subtitle="Total scheduled"
            icon="calendar-outline"
            color="#3F51B5"
          />
          <StatCard
            title="Completed Events"
            value={analytics.planner.completedEvents}
            subtitle="Successfully done"
            icon="checkmark-circle-outline"
            color="#4CAF50"
          />
          <StatCard
            title="Completion Rate"
            value={`${analytics.planner.completionRate}%`}
            subtitle="Success rate"
            icon="pie-chart-outline"
            color="#FF9800"
          />
          <StatCard
            title="Planned Time"
            value={formatTime(analytics.planner.totalPlannedTime)}
            subtitle="Total scheduled"
            icon="time-outline"
            color="#E91E63"
          />
        </View>

        <View style={styles.bottomPadding} />
    </ScreenLayout>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  dateRangeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginRight: 12,
  },
  dateRangeButtons: {
    flexDirection: 'row',
  },
  dateRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    marginRight: 8,
  },
  dateRangeButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  dateRangeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  dateRangeButtonTextActive: {
    color: '#fff',
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statCard: {
    width: (width - 52) / 2,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    margin: 6,
    borderLeftWidth: 4,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  subjectContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  subjectItem: {
    marginBottom: 16,
  },
  subjectInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  subjectStats: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  subjectProgress: {
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
  },
  subjectProgressBar: {
    height: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  bottomPadding: {
    height: 32,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
  },
}); 