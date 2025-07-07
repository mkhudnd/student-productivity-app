import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RewardSystem, ACHIEVEMENT_LEVELS } from '../utils/RewardSystem';
import { useTheme } from '../context/ThemeContext';

const RewardSummaryCard = ({ user, onPress }) => {
  const { theme } = useTheme();
  const [rewardData, setRewardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRewardData();
  }, [user]);

  const loadRewardData = async () => {
    if (!user) return;
    
    try {
      const data = await RewardSystem.getUserStats(user);
      setRewardData(data);
    } catch (error) {
      console.error('Error loading reward data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh reward data when called from parent
  const refresh = () => {
    loadRewardData();
  };

  if (loading || !rewardData) {
    return (
      <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading rewards...
        </Text>
      </View>
    );
  }

  const { totalPoints, level, currentStreak, nextLevelPoints } = rewardData;

  return (
    <TouchableOpacity 
      style={[styles.container, { backgroundColor: theme.cardBackground }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.levelIcon}>{level.icon}</Text>
          <Text style={[styles.title, { color: theme.text }]}>
            Rewards
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {/* Points */}
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: level.color }]}>
            {totalPoints.toLocaleString()}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Points
          </Text>
        </View>

        {/* Level */}
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: level.color }]}>
            {level.name}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Level
          </Text>
        </View>

        {/* Streak */}
        <View style={styles.statItem}>
          <View style={styles.streakContainer}>
            <Text style={styles.streakIcon}>🔥</Text>
            <Text style={[styles.statValue, { color: '#FF6B6B' }]}>
              {currentStreak}
            </Text>
          </View>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Day Streak
          </Text>
        </View>
      </View>

      {/* Progress to Next Level */}
      {nextLevelPoints > 0 && (
        <View style={styles.progressSection}>
          <Text style={[styles.progressText, { color: theme.textSecondary }]}>
            {nextLevelPoints} points to next level
          </Text>
          <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: level.color,
                  width: `${Math.max(10, 100 - (nextLevelPoints / 100) * 100)}%`
                }
              ]} 
            />
          </View>
        </View>
      )}

      {/* Recent Achievement */}
      {rewardData.achievements.length > 0 && (
        <View style={styles.achievementSection}>
          <Text style={[styles.achievementText, { color: theme.textSecondary }]}>
            Latest: {rewardData.achievements[rewardData.achievements.length - 1].message}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Forward ref to expose refresh method
React.forwardRef((props, ref) => {
  const [component, setComponent] = useState(null);
  
  React.useImperativeHandle(ref, () => ({
    refresh: () => {
      if (component && component.refresh) {
        component.refresh();
      }
    }
  }));

  return <RewardSummaryCard ref={setComponent} {...props} />;
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 10,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  progressSection: {
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  achievementSection: {
    marginTop: 4,
  },
  achievementText: {
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default RewardSummaryCard; 