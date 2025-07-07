import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { AnalyticsService } from '../utils/analyticsService';

const { width } = Dimensions.get('window');

export default function DayEndAnalytics({ visible, onClose, date = new Date().toISOString().slice(0, 10) }) {
  const { theme } = useTheme();
  const { currentUser } = useUser();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const styles = getStyles(theme);

  useEffect(() => {
    if (visible) {
      loadDayAnalytics();
    }
  }, [visible, date]);

  const loadDayAnalytics = async () => {
    setLoading(true);
    try {
      if (!currentUser) {
        setAnalytics(null);
        setLoading(false);
        return;
      }
      const data = await AnalyticsService.getAnalyticsData(currentUser);
      console.log('Raw analytics data:', data);
      console.log('Date filter:', date);
      
      // Filter events for the specific date
      const dayPlannerEvents = data.plannerEvents.filter(event => event.date === date);
      const dayStudySessions = data.studySessions.filter(session => session.date === date);

      console.log('Filtered planner events:', dayPlannerEvents);
      console.log('Filtered study sessions:', dayStudySessions);

      // Calculate planner statistics
      const plannerStats = {
        totalEvents: dayPlannerEvents.length,
        completedEvents: dayPlannerEvents.filter(e => e.completed).length,
        totalPlannedTime: dayPlannerEvents.reduce((sum, e) => sum + (e.duration || 0), 0),
        completionRate: dayPlannerEvents.length > 0 ? Math.round((dayPlannerEvents.filter(e => e.completed).length / dayPlannerEvents.length) * 100) : 0,
        categoryBreakdown: getCategoryBreakdown(dayPlannerEvents.filter(e => e.completed)),
      };

      // Calculate study statistics
      const studyStats = {
        totalSessions: dayStudySessions.length,
        totalStudyTime: dayStudySessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        averageSessionTime: dayStudySessions.length > 0 ? Math.round(dayStudySessions.reduce((sum, s) => sum + (s.duration || 0), 0) / dayStudySessions.length) : 0,
        subjectBreakdown: getSubjectBreakdown(dayStudySessions),
        pomodoroSessions: dayStudySessions.filter(s => s.sessionType === 'pomodoro').length,
        totalBreaks: dayStudySessions.reduce((sum, s) => sum + (s.breaks || 0), 0),
      };

      // Calculate productivity insights
      const insights = generateInsights(plannerStats, studyStats);

      const analyticsResult = {
        date,
        planner: plannerStats,
        study: studyStats,
        insights,
        combined: {
          totalActivities: plannerStats.totalEvents + studyStats.totalSessions,
          totalTime: plannerStats.totalPlannedTime + studyStats.totalStudyTime,
          productivityScore: calculateProductivityScore(plannerStats, studyStats),
        },
        // Add debug info
        debug: {
          rawDataSize: data.plannerEvents.length + data.studySessions.length,
          filteredDataSize: dayPlannerEvents.length + dayStudySessions.length,
          dateUsed: date,
        }
      };

      console.log('Final analytics result:', analyticsResult);
      setAnalytics(analyticsResult);
    } catch (error) {
      console.error('Error loading day analytics:', error);
      // Set a fallback analytics object with error info
      setAnalytics({
        error: true,
        errorMessage: error.message,
        date,
        planner: { totalEvents: 0, completedEvents: 0, totalPlannedTime: 0, completionRate: 0, categoryBreakdown: {} },
        study: { totalSessions: 0, totalStudyTime: 0, averageSessionTime: 0, subjectBreakdown: {}, pomodoroSessions: 0, totalBreaks: 0 },
        insights: [],
        combined: { totalActivities: 0, totalTime: 0, productivityScore: 0 }
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryBreakdown = (completedEvents) => {
    const breakdown = {};
    completedEvents.forEach(event => {
      const category = event.category || 'General';
      if (!breakdown[category]) {
        breakdown[category] = { count: 0, totalTime: 0 };
      }
      breakdown[category].count++;
      breakdown[category].totalTime += event.duration || 0;
    });
    return breakdown;
  };

  const getSubjectBreakdown = (sessions) => {
    const breakdown = {};
    sessions.forEach(session => {
      const subject = session.subjectName || 'Unknown';
      if (!breakdown[subject]) {
        breakdown[subject] = { count: 0, totalTime: 0 };
      }
      breakdown[subject].count++;
      breakdown[subject].totalTime += session.duration || 0;
    });
    return breakdown;
  };

  const calculateProductivityScore = (plannerStats, studyStats) => {
    // Base score from completion rates and time spent
    let score = 0;
    
    // Planner contribution (40% of score)
    score += (plannerStats.completionRate * 0.4);
    
    // Study contribution (40% of score)
    if (studyStats.totalStudyTime > 0) {
      // Award points for study time (up to 240 minutes = full 40 points)
      score += Math.min(40, (studyStats.totalStudyTime / 240) * 40);
    }
    
    // Bonus points (20% of score)
    // Consistent activity bonus
    if (plannerStats.totalEvents > 0 && studyStats.totalSessions > 0) {
      score += 10; // Used both systems
    }
    
    // Focus session bonus
    if (studyStats.pomodoroSessions > 0) {
      score += 5; // Used pomodoro technique
    }
    
    // High completion bonus
    if (plannerStats.completionRate >= 80) {
      score += 5; // High completion rate
    }
    
    return Math.min(100, Math.round(score));
  };

  const generateInsights = (plannerStats, studyStats) => {
    const insights = [];
    
    // Planner insights
    if (plannerStats.completionRate === 100 && plannerStats.totalEvents > 0) {
      insights.push({
        type: 'success',
        icon: 'checkmark-circle',
        title: 'Perfect Planner Day!',
        message: 'You completed all your planned tasks today.',
        color: '#4CAF50'
      });
    } else if (plannerStats.completionRate >= 80) {
      insights.push({
        type: 'good',
        icon: 'thumbs-up',
        title: 'Great Planning',
        message: `${plannerStats.completionRate}% completion rate is excellent!`,
        color: '#2196F3'
      });
    } else if (plannerStats.completionRate < 50 && plannerStats.totalEvents > 0) {
      insights.push({
        type: 'improvement',
        icon: 'bulb',
        title: 'Planning Opportunity',
        message: 'Consider breaking large tasks into smaller ones.',
        color: '#FF9800'
      });
    }

    // Study insights
    if (studyStats.totalStudyTime >= 240) { // 4 hours
      insights.push({
        type: 'success',
        icon: 'school',
        title: 'Dedicated Learner',
        message: `${Math.round(studyStats.totalStudyTime / 60)} hours of focused study time!`,
        color: '#4CAF50'
      });
    } else if (studyStats.totalStudyTime >= 120) { // 2 hours
      insights.push({
        type: 'good',
        icon: 'book',
        title: 'Good Study Momentum',
        message: 'Solid study session today. Keep it up!',
        color: '#2196F3'
      });
    }

    // Pomodoro insights
    if (studyStats.pomodoroSessions >= 4) {
      insights.push({
        type: 'success',
        icon: 'timer',
        title: 'Pomodoro Master',
        message: `Completed ${studyStats.pomodoroSessions} focused pomodoro sessions.`,
        color: '#E91E63'
      });
    }

    // Balanced day insight
    if (Object.keys(plannerStats.categoryBreakdown).length >= 3) {
      insights.push({
        type: 'success',
        icon: 'git-compare',
        title: 'Well-Balanced Day',
        message: 'You worked on multiple areas of your life today.',
        color: '#9C27B0'
      });
    }

    // Default encouragement if no insights
    if (insights.length === 0) {
      insights.push({
        type: 'neutral',
        icon: 'sunny',
        title: 'Every Day Counts',
        message: 'Small steps lead to big achievements. Keep going!',
        color: '#FFC107'
      });
    }

    return insights;
  };

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#2196F3';
    if (score >= 40) return '#FF9800';
    return '#F44336';
  };

  const getScoreEmoji = (score) => {
    if (score >= 90) return '🏆';
    if (score >= 80) return '🌟';
    if (score >= 70) return '🎯';
    if (score >= 60) return '💪';
    if (score >= 40) return '📈';
    return '🌱';
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent]}>
          {/* TEST: This should ALWAYS be visible if modal opens */}
          <View style={{ padding: 15, backgroundColor: 'red', margin: 5 }}>
            <Text style={{ color: 'white', fontSize: 16 }}>
              🔴 MODAL TEST - Loading: {loading ? 'YES' : 'NO'} | Data: {analytics ? 'YES' : 'NO'}
            </Text>
          </View>
          
          <ScrollView 
            style={[styles.scrollView]}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* TEST: ScrollView content test */}
            <View style={{ padding: 20, backgroundColor: 'blue', margin: 10 }}>
              <Text style={{ color: 'white', fontSize: 16 }}>
                🔵 SCROLLVIEW TEST - Can you see this blue box?
              </Text>
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Ionicons name="analytics" size={28} color={theme.colors.primary} />
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>Day Summary</Text>
                  <Text style={styles.headerDate}>{formatDate(date)}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <Ionicons name="hourglass" size={48} color={theme.colors.primary} />
                <Text style={styles.loadingText}>Analyzing your day...</Text>
              </View>
            ) : analytics ? (
              <>
                {/* Minimal Debug Info */}
                <View style={{ padding: 10, backgroundColor: '#f0f0f0', marginBottom: 10, borderRadius: 8 }}>
                  <Text style={{ fontSize: 12, color: '#333' }}>
                    Debug: Activities: {analytics.combined?.totalActivities || 0} | 
                    Planner: {analytics.planner?.totalEvents || 0} | 
                    Study: {analytics.study?.totalSessions || 0}
                  </Text>
                </View>

                {/* Productivity Score */}
                <View style={styles.scoreCard}>
                  <View style={styles.scoreHeader}>
                    <Text style={styles.scoreTitle}>Productivity Score</Text>
                    <Text style={styles.scoreEmoji}>{getScoreEmoji(analytics.combined.productivityScore)}</Text>
                  </View>
                  <Text style={[styles.scoreValue, { color: getScoreColor(analytics.combined.productivityScore) }]}>
                    {analytics.combined.productivityScore}/100
                  </Text>
                  <Text style={styles.scoreSubtitle}>
                    {analytics.combined.totalActivities} activities • {formatTime(analytics.combined.totalTime)} total time
                  </Text>
                </View>

                {/* Insights Section */}
                {analytics.insights.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>✨ Key Insights</Text>
                    {analytics.insights.map((insight, index) => (
                      <View key={index} style={[styles.insightCard, { borderLeftColor: insight.color }]}>
                        <Ionicons name={insight.icon} size={24} color={insight.color} />
                        <View style={styles.insightContent}>
                          <Text style={styles.insightTitle}>{insight.title}</Text>
                          <Text style={styles.insightMessage}>{insight.message}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Daily Planner Stats */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📅 Daily Planner</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{analytics.planner.totalEvents}</Text>
                      <Text style={styles.statLabel}>Planned Events</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={[styles.statValue, { color: '#4CAF50' }]}>{analytics.planner.completedEvents}</Text>
                      <Text style={styles.statLabel}>Completed</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={[styles.statValue, { color: '#2196F3' }]}>{analytics.planner.completionRate}%</Text>
                      <Text style={styles.statLabel}>Success Rate</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{formatTime(analytics.planner.totalPlannedTime)}</Text>
                      <Text style={styles.statLabel}>Planned Time</Text>
                    </View>
                  </View>

                  {/* Category Breakdown */}
                  {Object.keys(analytics.planner.categoryBreakdown).length > 0 && (
                    <View style={styles.breakdownContainer}>
                      <Text style={styles.breakdownTitle}>Time by Category</Text>
                      {Object.entries(analytics.planner.categoryBreakdown)
                        .sort(([,a], [,b]) => b.totalTime - a.totalTime)
                        .map(([category, data]) => (
                          <View key={category} style={styles.breakdownItem}>
                            <View style={styles.breakdownInfo}>
                              <Text style={styles.breakdownCategory}>{category}</Text>
                              <Text style={styles.breakdownDetails}>
                                {data.count} events • {formatTime(data.totalTime)}
                              </Text>
                            </View>
                            <View style={styles.breakdownBar}>
                              <View 
                                style={[
                                  styles.breakdownBarFill,
                                  { 
                                    width: `${Math.min(100, (data.totalTime / analytics.planner.totalPlannedTime) * 100)}%`,
                                    backgroundColor: getCategoryColor(category)
                                  }
                                ]} 
                              />
                            </View>
                          </View>
                        ))}
                    </View>
                  )}
                </View>

                {/* Study Tracker Stats */}
                {analytics.study.totalSessions > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📚 Study Sessions</Text>
                    <View style={styles.statsGrid}>
                      <View style={styles.statCard}>
                        <Text style={styles.statValue}>{analytics.study.totalSessions}</Text>
                        <Text style={styles.statLabel}>Study Sessions</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={[styles.statValue, { color: '#E91E63' }]}>{formatTime(analytics.study.totalStudyTime)}</Text>
                        <Text style={styles.statLabel}>Study Time</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={[styles.statValue, { color: '#9C27B0' }]}>{formatTime(analytics.study.averageSessionTime)}</Text>
                        <Text style={styles.statLabel}>Avg Session</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={[styles.statValue, { color: '#FF5722' }]}>{analytics.study.pomodoroSessions}</Text>
                        <Text style={styles.statLabel}>Pomodoro</Text>
                      </View>
                    </View>

                    {/* Subject Breakdown */}
                    {Object.keys(analytics.study.subjectBreakdown).length > 0 && (
                      <View style={styles.breakdownContainer}>
                        <Text style={styles.breakdownTitle}>Time by Subject</Text>
                        {Object.entries(analytics.study.subjectBreakdown)
                          .sort(([,a], [,b]) => b.totalTime - a.totalTime)
                          .map(([subject, data]) => (
                            <View key={subject} style={styles.breakdownItem}>
                              <View style={styles.breakdownInfo}>
                                <Text style={styles.breakdownCategory}>{subject}</Text>
                                <Text style={styles.breakdownDetails}>
                                  {data.count} sessions • {formatTime(data.totalTime)}
                                </Text>
                              </View>
                              <View style={styles.breakdownBar}>
                                <View 
                                  style={[
                                    styles.breakdownBarFill,
                                    { 
                                      width: `${Math.min(100, (data.totalTime / analytics.study.totalStudyTime) * 100)}%`,
                                      backgroundColor: theme.colors.primary
                                    }
                                  ]} 
                                />
                              </View>
                            </View>
                          ))}
                      </View>
                    )}
                  </View>
                )}

                {/* No Activity Message */}
                {analytics.combined.totalActivities === 0 && (
                  <View style={styles.noActivityContainer}>
                    <Ionicons name="calendar-outline" size={64} color={theme.colors.textSecondary} />
                    <Text style={styles.noActivityTitle}>Quiet Day</Text>
                    <Text style={styles.noActivityMessage}>
                      No planned events or study sessions recorded for today.
                      Tomorrow is a fresh start!
                    </Text>
                  </View>
                )}

                {/* Error State */}
                {analytics.error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={48} color="#F44336" />
                    <Text style={styles.errorTitle}>Error Loading Analytics</Text>
                    <Text style={styles.errorText}>{analytics.errorMessage}</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={48} color="#F44336" />
                <Text style={styles.errorText}>Unable to load analytics data</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Helper function to get category colors
const getCategoryColor = (category) => {
  const categoryColors = {
    'Study': '#4CAF50',
    'Exercise': '#2196F3',
    'Devotion': '#FFC107',
    'Assignments': '#FF9800',
    'Work': '#9C27B0',
    'Personal': '#00BCD4',
    'Health': '#E91E63',
    'Social': '#795548',
  };
  return categoryColors[category] || '#757575';
};

const getStyles = (theme) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    width: width - 32,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  headerDate: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  scoreCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginRight: 8,
  },
  scoreEmoji: {
    fontSize: 24,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  scoreSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  insightContent: {
    marginLeft: 12,
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  insightMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    minWidth: (width - 100) / 2 - 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  breakdownContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  breakdownItem: {
    marginBottom: 12,
  },
  breakdownInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  breakdownDetails: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  breakdownBar: {
    height: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: 8,
    borderRadius: 4,
  },
  noActivityContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  noActivityTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  noActivityMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    marginTop: 16,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 8,
  },
}); 