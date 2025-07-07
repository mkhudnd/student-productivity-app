import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubjectPerformance, useLinkedSessions } from '../hooks/useLinkedSessions';
import { useUser } from '../context/UserContext';

export default function SessionLinkingDemo({ subjectId, subjectName }) {
  const { currentUser } = useUser();
  const { performance, loading: perfLoading } = useSubjectPerformance(subjectId);
  const { todayPlannedSessions } = useLinkedSessions();
  const [expanded, setExpanded] = useState(false);

  // Don't render if no user is logged in
  if (!currentUser) {
    return null;
  }

  // Filter today's sessions for this subject
  const subjectPlannedSessions = todayPlannedSessions.filter(session => 
    session.subjectId === subjectId
  );

  if (!performance && !subjectPlannedSessions.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="link" size={20} color="#FFD600" />
          <Text style={styles.subjectName}>{subjectName}</Text>
          <Text style={styles.linkCount}>
            {subjectPlannedSessions.length} session{subjectPlannedSessions.length !== 1 ? 's' : ''} today
          </Text>
        </View>
        <Ionicons 
          name={expanded ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color="#666" 
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {/* Today's Planned Sessions */}
          {subjectPlannedSessions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📅 Today's Sessions</Text>
              {subjectPlannedSessions.map((session) => (
                <View key={session.id} style={styles.sessionItem}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTime}>
                      {session.targetStartTime ? 
                        `${session.targetStartTime} - ${session.targetEndTime}` : 
                        'No time set'
                      }
                    </Text>
                    {session.topic && (
                      <Text style={styles.sessionTopic}>{session.topic}</Text>
                    )}
                    <Text style={styles.sessionDuration}>
                      {session.plannedDuration} min planned
                    </Text>
                  </View>
                  <View style={styles.sessionStatus}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(session.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(session.status) }]}>
                      {session.status}
                    </Text>
                    {session.status === 'completed' && session.actualDuration && (
                      <Text style={styles.actualDuration}>
                        {session.actualDuration} min actual
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Performance Summary */}
          {performance && !perfLoading && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Performance (Last 30 Days)</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{performance.totalPlanned}</Text>
                  <Text style={styles.statLabel}>Planned</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{performance.totalCompleted}</Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{performance.completionRate}%</Text>
                  <Text style={styles.statLabel}>Success Rate</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{performance.totalStudyTime}</Text>
                  <Text style={styles.statLabel}>Total Minutes</Text>
                </View>
              </View>

              {/* Performance Metrics */}
              {(performance.averageEfficiency || performance.averageFocusScore || performance.averageProductivity) && (
                <View style={styles.metricsContainer}>
                  <Text style={styles.metricsTitle}>Quality Metrics</Text>
                  <View style={styles.metricsGrid}>
                    {performance.averageEfficiency && (
                      <View style={styles.metricItem}>
                        <Text style={styles.metricValue}>{performance.averageEfficiency}%</Text>
                        <Text style={styles.metricLabel}>Efficiency</Text>
                      </View>
                    )}
                    {performance.averageFocusScore && (
                      <View style={styles.metricItem}>
                        <Text style={styles.metricValue}>{performance.averageFocusScore}/10</Text>
                        <Text style={styles.metricLabel}>Focus</Text>
                      </View>
                    )}
                    {performance.averageProductivity && (
                      <View style={styles.metricItem}>
                        <Text style={styles.metricValue}>{performance.averageProductivity}/10</Text>
                        <Text style={styles.metricLabel}>Productivity</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Recent Sessions */}
              {performance.recentSessions && performance.recentSessions.length > 0 && (
                <View style={styles.recentContainer}>
                  <Text style={styles.recentTitle}>Recent Sessions</Text>
                  {performance.recentSessions.map((session) => (
                    <View key={session.id} style={styles.recentSession}>
                      <Text style={styles.recentDate}>{session.date}</Text>
                      <Text style={styles.recentDuration}>{session.actualDuration} min</Text>
                      {session.efficiency && (
                        <Text style={styles.recentEfficiency}>{session.efficiency}% efficiency</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Integration Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>🔗 Session Linking</Text>
            <Text style={styles.infoText}>
              • Calendar sessions are automatically linked to study sessions
            </Text>
            <Text style={styles.infoText}>
              • Completion data is tracked across planner and study tracker
            </Text>
            <Text style={styles.infoText}>
              • Analytics include efficiency and performance metrics
            </Text>
            <Text style={styles.infoText}>
              • Session insights help optimize study patterns
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const getStatusColor = (status) => {
  switch (status) {
    case 'planned': return '#FFD600';
    case 'started': return '#FF9800';
    case 'completed': return '#4CAF50';
    default: return '#666';
  }
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#333',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: expanded ? 1 : 0,
    borderBottomColor: '#444',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subjectName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    marginRight: 12,
  },
  linkCount: {
    color: '#FFD600',
    fontSize: 12,
    backgroundColor: '#FFD60020',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#FFD600',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTime: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sessionTopic: {
    color: '#FFD600',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  sessionDuration: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 2,
  },
  sessionStatus: {
    alignItems: 'flex-end',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  actualDuration: {
    fontSize: 10,
    color: '#AAA',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 4,
  },
  metricsContainer: {
    marginTop: 16,
  },
  metricsTitle: {
    color: '#FFD600',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  metricLabel: {
    color: '#AAA',
    fontSize: 11,
    marginTop: 2,
  },
  recentContainer: {
    marginTop: 16,
  },
  recentTitle: {
    color: '#FFD600',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  recentSession: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#555',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  recentDate: {
    color: '#fff',
    fontSize: 12,
  },
  recentDuration: {
    color: '#FFD600',
    fontSize: 12,
    fontWeight: 'bold',
  },
  recentEfficiency: {
    color: '#4CAF50',
    fontSize: 11,
  },
  infoContainer: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  infoTitle: {
    color: '#FFD600',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    color: '#AAA',
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 16,
  },
}); 