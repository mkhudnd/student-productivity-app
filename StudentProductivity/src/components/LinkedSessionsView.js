import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';

export default function LinkedSessionsView({ 
  onStartSession, 
  refreshTrigger, 
  timerSubject, 
  timerActive, 
  timerTopic,
  plannedSessions = [],
  subjects = []
}) {
  const { currentUser } = useUser();
  const { theme } = useTheme();
  const [todayPlannedSessions, setTodayPlannedSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [manualRefresh, setManualRefresh] = useState(0);

  // Check if app is ready to avoid navigation issues
  useEffect(() => {
    const readyTimer = setTimeout(() => {
      setIsAppReady(true);
    }, 2000); // Wait 2 seconds for app to fully initialize
    
    return () => clearTimeout(readyTimer);
  }, []);

  // Trigger refresh when timer subject changes (especially when it becomes null)
  useEffect(() => {
    if (isAppReady) {
      setManualRefresh(prev => prev + 1);
    }
  }, [timerSubject, isAppReady]);

  // Load today's planned sessions from props
  useEffect(() => {
    if (!isAppReady) return;
    
    const loadSessions = () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('LinkedSessionsView: Processing planned sessions from props...');
        
        // Get today's date
        const today = new Date().toISOString().slice(0, 10);
        
        // Filter planned sessions for today and transform to expected format
        const todaySessions = (plannedSessions || [])
          .filter(session => session.date === today)
          .map(session => {
            // Find subject name
            const subject = subjects.find(s => s.id === session.subjectId);
            const subjectName = subject ? subject.name : 'Unknown Subject';
            
            return {
              id: session.id,
              plannedSessionId: session.id,
              subjectId: session.subjectId,
              subjectName: subjectName,
              topic: session.topic || '',
              date: session.date,
              plannedDuration: session.plannedDuration || 60,
              targetStartTime: session.startTime || null,
              targetEndTime: session.endTime || null,
              status: 'planned', // Default status
              actualStartTime: null,
              actualEndTime: null,
              actualDuration: null,
              isRecurring: session.isRecurring || false,
              recurringType: session.recurringType || null,
            };
          });
        
        console.log('LinkedSessionsView: Today\'s sessions:', todaySessions);
        setTodayPlannedSessions(todaySessions);
      } catch (err) {
        console.error('Error processing today\'s planned sessions:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [isAppReady, refreshTrigger, manualRefresh, plannedSessions, subjects]); // Use plannedSessions and subjects

  const markSessionAsStarted = async (plannedSessionId) => {
    try {
      const { SessionLinkingService } = await import('../utils/SessionLinkingService');
      const updatedSession = await SessionLinkingService.markSessionAsStarted(plannedSessionId, currentUser);
      if (updatedSession) {
        setTodayPlannedSessions(prev => 
          prev.map(session => 
            session.plannedSessionId === plannedSessionId 
              ? { ...session, status: 'started', actualStartTime: updatedSession.actualStartTime }
              : session
          )
        );
      }
      return updatedSession;
    } catch (err) {
      console.error('Error marking session as started:', err);
      setError(err.message);
      return null;
    }
  };

  const handleStartSession = async (session) => {
    const currentStatus = getSessionStatus(session);
    const actionText = currentStatus === 'resumed' ? 'Resume' : 'Start';
    const messageText = currentStatus === 'resumed' 
      ? `Resume studying ${session.subjectName}${session.topic ? ` - ${session.topic}` : ''}?`
      : `Start studying ${session.subjectName}${session.topic ? ` - ${session.topic}` : ''}?`;

    Alert.alert(
      `${actionText} Study Session`,
      messageText,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          onPress: async () => {
            // Only mark as started if it's not already started
            if (currentStatus !== 'resumed') {
              await markSessionAsStarted(session.plannedSessionId);
            }
            if (onStartSession) {
              onStartSession(session);
            }
          }
        }
      ]
    );
  };

  // Helper function to normalize topic names for better matching
  const normalizeTopicName = (topicName) => {
    if (!topicName) return '';
    return topicName.toLowerCase().trim().replace(/\s+/g, ' ');
  };

  // Helper function to check if topics match (exact or partial)
  const topicsMatch = (topic1, topic2) => {
    if (!topic1 && !topic2) return true;
    if (!topic1 || !topic2) return false;
    
    const normalized1 = normalizeTopicName(topic1);
    const normalized2 = normalizeTopicName(topic2);
    
    // Exact match
    if (normalized1 === normalized2) return true;
    
    // Partial match - one contains the other (for cases like "topic 1" and "topic")
    return normalized1.includes(normalized2) || normalized2.includes(normalized1);
  };

  // Helper function to display topic name in a simplified format
  const getDisplayTopicName = (topicName) => {
    if (!topicName) return '';
    
    // If topic name is very long, try to shorten it
    if (topicName.length > 20) {
      // Look for common patterns to shorten
      const shortened = topicName
        .replace(/\btopic\s+(\d+)\b/i, 'T$1') // "topic 1" -> "T1"
        .replace(/\bchapter\s+(\d+)\b/i, 'Ch$1') // "chapter 1" -> "Ch1"
        .replace(/\bsection\s+(\d+)\b/i, 'S$1'); // "section 1" -> "S1"
      
      if (shortened.length <= 20) {
        return shortened;
      }
      
      // If still too long, truncate with ellipsis
      return topicName.substring(0, 17) + '...';
    }
    
    return topicName;
  };

  // Get dynamic status based on timer state
  const getSessionStatus = (session) => {
    // Check if this session is currently being studied
    if (timerSubject && timerSubject.id === session.subjectId && 
        topicsMatch(session.topic, timerTopic)) {
      return timerActive ? 'studying' : 'paused';
    }
    
    // If no timer is active and session was started but not completed, it should be resumed
    if (session.status === 'started' && !timerSubject) {
      return 'resumed';
    }
    
    // If session was started but there's a different active session, show as started
    if (session.status === 'started' && timerSubject && 
        (timerSubject.id !== session.subjectId || 
         !topicsMatch(session.topic, timerTopic))) {
      return 'resumed';
    }
    
    // Return original status for completed or planned sessions
    return session.status;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'planned': return 'time-outline';
      case 'studying': return 'book-outline';
      case 'paused': return 'pause-circle-outline';
      case 'resumed': return 'play-skip-forward-outline';
      case 'completed': return 'checkmark-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'planned': return '#FFD600';
      case 'studying': return '#4CAF50';
      case 'paused': return '#FF9800';
      case 'resumed': return '#2196F3';
      case 'completed': return '#4CAF50';
      default: return '#666';
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.slice(0, 5); // HH:MM
  };

  const styles = getStyles(theme);

  if (!isAppReady || loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>
          {!isAppReady ? 'Initializing...' : 'Loading planned sessions...'}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error loading sessions: {error}</Text>
      </View>
    );
  }

  if (todayPlannedSessions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Today's Planned Sessions</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={() => setManualRefresh(prev => prev + 1)}
          >
            <Ionicons name="refresh" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.emptyText}>No planned sessions for today</Text>
        <Text style={styles.emptySubtext}>Add sessions in the calendar to see them here</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Today's Planned Sessions</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={() => setManualRefresh(prev => prev + 1)}
        >
          <Ionicons name="refresh" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
      
      {todayPlannedSessions.map((session) => {
        const currentStatus = getSessionStatus(session);
        
        return (
          <View key={session.id} style={styles.sessionCard}>
            <View style={styles.sessionHeader}>
              <View style={styles.sessionInfo}>
                <Text style={styles.subjectName}>{session.subjectName}</Text>
                {session.topic && (
                  <Text style={styles.topicText}>{getDisplayTopicName(session.topic)}</Text>
                )}
                <View style={styles.timeInfo}>
                  {session.targetStartTime && session.targetEndTime && (
                    <Text style={styles.timeText}>
                      🕒 {formatTime(session.targetStartTime)} - {formatTime(session.targetEndTime)}
                    </Text>
                  )}
                  <Text style={styles.durationText}>
                    📚 {session.plannedDuration} min
                  </Text>
                </View>
              </View>
              
              <View style={styles.statusContainer}>
                <Ionicons 
                  name={getStatusIcon(currentStatus)} 
                  size={24} 
                  color={getStatusColor(currentStatus)} 
                />
                <Text style={[styles.statusText, { color: getStatusColor(currentStatus) }]}>
                  {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
                </Text>
              </View>
            </View>

            {currentStatus === 'planned' && (
              <TouchableOpacity 
                style={styles.startButton}
                onPress={() => handleStartSession(session)}
              >
                <Ionicons name="play" size={16} color="#181818" />
                <Text style={styles.startButtonText}>Start Session</Text>
              </TouchableOpacity>
            )}

            {currentStatus === 'studying' && (
              <View style={styles.inProgressInfo}>
                <Text style={[styles.inProgressText, { color: '#4CAF50' }]}>
                  📚 Currently studying...
                </Text>
              </View>
            )}

            {currentStatus === 'paused' && (
              <View style={styles.inProgressInfo}>
                <Text style={[styles.inProgressText, { color: '#FF9800' }]}>
                  ⏸️ Session paused
                </Text>
              </View>
            )}

            {currentStatus === 'resumed' && session.actualStartTime && (
              <View style={styles.resumeContainer}>
                <View style={styles.resumeTextContainer}>
                  <Text style={[styles.inProgressText, { color: '#2196F3' }]}>
                    🔄 Ready to resume
                  </Text>
                  <Text style={[styles.resumeTimeText, { color: '#2196F3' }]}>
                    Started at {formatTime(session.actualStartTime)}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.resumeButton}
                  onPress={() => handleStartSession(session)}
                >
                  <Ionicons name="play" size={16} color="#2196F3" />
                  <Text style={styles.resumeButtonText}>Resume</Text>
                </TouchableOpacity>
              </View>
            )}

            {currentStatus === 'completed' && (
              <View style={styles.completedInfo}>
                <Text style={styles.completedText}>
                  ✅ Completed • {session.actualDuration} min
                </Text>
                {session.efficiency && (
                  <Text style={styles.efficiencyText}>
                    Efficiency: {session.efficiency}%
                  </Text>
                )}
              </View>
            )}

            {session.isRecurring && (
              <View style={styles.recurringBadge}>
                <Ionicons name="repeat" size={12} color={theme.colors.textSecondary} />
                <Text style={styles.recurringText}>
                  {session.recurringType === 'daily' ? 'Daily' : 
                   session.recurringType === 'weekly' ? 'Weekly' : 'Recurring'}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    flex: 1,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    marginLeft: 12,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorText: {
    color: '#FF5722',
    textAlign: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontSize: 14,
  },
  sessionCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD600',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionInfo: {
    flex: 1,
    marginRight: 12,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  topicText: {
    fontSize: 14,
    color: '#FFD600',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  timeInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  timeText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  durationText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  statusContainer: {
    alignItems: 'center',
    minWidth: 60,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#FFD600',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  startButtonText: {
    color: '#181818',
    fontWeight: 'bold',
    fontSize: 14,
  },
  inProgressInfo: {
    backgroundColor: '#FF9800',
    padding: 8,
    borderRadius: 6,
  },
  inProgressText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  completedInfo: {
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 6,
  },
  completedText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  efficiencyText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.9,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 4,
  },
  recurringText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  resumeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    flex: 1,
  },
  resumeTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  resumeTimeText: {
    fontSize: 12,
    color: '#2196F3',
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    flexShrink: 0,
  },
  resumeButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
}); 