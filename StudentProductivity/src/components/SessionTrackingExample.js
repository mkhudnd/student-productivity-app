import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  useSessionTracking,
  useFocusSession,
  useScreenTracking,
  useAnalyticsSummary,
  useSessionInsights,
} from '../hooks/useSessionTracking';

export default function SessionTrackingExample() {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  // App session tracking
  const { trackInteraction, getCurrentStats } = useSessionTracking();

  // Screen-specific tracking
  const { trackInteraction: trackScreenInteraction, getScreenTime } = useScreenTracking('SessionTrackingExample');

  // Focus session tracking
  const {
    currentSession,
    sessionStats,
    startSession,
    endSession,
    recordInterruption,
    recordBreak,
    addGoal,
    completeGoal,
    isActive,
  } = useFocusSession();

  // Analytics and insights
  const { analytics, loading: analyticsLoading } = useAnalyticsSummary(7);
  const { insights, recommendations } = useSessionInsights(7);

  // Local state
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionConfig, setSessionConfig] = useState({
    subject: 'Mathematics',
    topic: 'Calculus',
    targetDuration: 1800, // 30 minutes
    sessionType: 'deep_work',
    environment: 'quiet',
    mood: 'good',
  });

  const handleStartFocusSession = () => {
    const sessionId = startSession(sessionConfig);
    setShowSessionModal(false);
    Alert.alert('Focus Session Started', `Session ID: ${sessionId}`);
  };

  const handleEndFocusSession = async () => {
    const result = await endSession({
      completed: true,
      focusScore: 8,
      productivity: 7,
      difficulty: 6,
      notes: 'Good focus session, completed most goals',
    });
    Alert.alert('Focus Session Ended', 'Session recorded successfully!');
  };

  const handleRecordInterruption = () => {
    recordInterruption({
      reason: 'notification',
      source: 'external',
      duration: 30,
      resumedSession: true,
    });
    Alert.alert('Interruption Recorded', 'Notification interruption logged');
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Session Tracking Demo</Text>

      {/* App Session Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 App Session</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            trackInteraction('button_press');
            trackScreenInteraction('demo_button');
            const stats = getCurrentStats();
            Alert.alert(
              'Current Session Stats',
              `Duration: ${formatTime(stats?.duration || 0)}\n` +
              `Active Time: ${formatTime(stats?.activeTime || 0)}\n` +
              `Interactions: ${stats?.interactions || 0}\n` +
              `Screen: ${stats?.currentScreen || 'Unknown'}`
            );
          }}
        >
          <Text style={styles.buttonText}>View App Session Stats</Text>
        </TouchableOpacity>
      </View>

      {/* Focus Session Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 Focus Session</Text>
        
        {!isActive ? (
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={() => setShowSessionModal(true)}
          >
            <Text style={styles.buttonText}>Start Focus Session</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionText}>
                📚 {sessionStats?.subject} - {sessionStats?.topic}
              </Text>
              <Text style={styles.sessionText}>
                ⏱️ {formatTime(sessionStats?.elapsed || 0)} / {formatTime(sessionStats?.targetDuration || 0)}
              </Text>
              <Text style={styles.sessionText}>
                🎯 Goals: {sessionStats?.goalsCompleted}/{sessionStats?.goals}
              </Text>
              <Text style={styles.sessionText}>
                ⚠️ Interruptions: {sessionStats?.interruptions}
              </Text>
            </View>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.smallButton]}
                onPress={() => addGoal('Complete chapter 5')}
              >
                <Text style={styles.buttonText}>Add Goal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.smallButton]}
                onPress={handleRecordInterruption}
              >
                <Text style={styles.buttonText}>Record Interruption</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.button, styles.endButton]}
              onPress={handleEndFocusSession}
            >
              <Text style={styles.buttonText}>End Session</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Analytics Summary */}
      {!analyticsLoading && analytics && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Analytics (Last 7 Days)</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{analytics.combined.totalActivities}</Text>
              <Text style={styles.statLabel}>Total Activities</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{Math.round(analytics.combined.totalTime / 60)}h</Text>
              <Text style={styles.statLabel}>Total Time</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{analytics.study.streakDays}</Text>
              <Text style={styles.statLabel}>Study Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{analytics.combined.productivityScore}</Text>
              <Text style={styles.statLabel}>Productivity</Text>
            </View>
          </View>
        </View>
      )}

      {/* Session Insights & Recommendations */}
      {insights && recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Session Insights</Text>
          {recommendations.map((rec, index) => (
            <View key={index} style={styles.recommendationCard}>
              <View style={styles.recommendationHeader}>
                <Ionicons 
                  name={rec.priority === 'high' ? 'warning' : 'information-circle'} 
                  size={20} 
                  color={rec.priority === 'high' ? '#FF5722' : '#2196F3'} 
                />
                <Text style={styles.recommendationType}>{rec.type.replace('_', ' ').toUpperCase()}</Text>
              </View>
              <Text style={styles.recommendationText}>{rec.message}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Focus Session Configuration Modal */}
      <Modal
        visible={showSessionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSessionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Start Focus Session</Text>
            
            <Text style={styles.modalLabel}>Subject: {sessionConfig.subject}</Text>
            <Text style={styles.modalLabel}>Topic: {sessionConfig.topic}</Text>
            <Text style={styles.modalLabel}>Duration: {Math.round(sessionConfig.targetDuration / 60)} minutes</Text>
            <Text style={styles.modalLabel}>Type: {sessionConfig.sessionType}</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setShowSessionModal(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.startButton]}
                onPress={handleStartFocusSession}
              >
                <Text style={styles.buttonText}>Start Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  section: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 4,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  endButton: {
    backgroundColor: '#F44336',
  },
  cancelButton: {
    backgroundColor: '#757575',
  },
  smallButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  sessionInfo: {
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  sessionText: {
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  recommendationCard: {
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recommendationType: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
}); 