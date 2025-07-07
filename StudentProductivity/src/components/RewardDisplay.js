import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RewardSystem, ACHIEVEMENT_LEVELS } from '../utils/RewardSystem';
import { useTheme } from '../context/ThemeContext';

const RewardDisplay = ({ 
  visible, 
  onClose, 
  rewards = [], 
  totalPointsEarned = 0, 
  newTotalPoints = 0, 
  currentStreak = 0,
  achievements = [],
  animationDuration = 300 
}) => {
  const { theme } = useTheme();
  const [animatedValue] = useState(new Animated.Value(0));
  const [currentRewardIndex, setCurrentRewardIndex] = useState(0);

  useEffect(() => {
    if (visible && rewards.length > 0) {
      startRewardAnimation();
    }
  }, [visible, rewards]);

  const startRewardAnimation = () => {
    animatedValue.setValue(0);
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: animationDuration,
        useNativeDriver: true,
      }),
      Animated.delay(2000), // Show each reward for 2 seconds
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      if (currentRewardIndex < rewards.length - 1) {
        setCurrentRewardIndex(currentRewardIndex + 1);
        startRewardAnimation();
      }
    });
  };

  const getRewardIcon = (reward) => {
    switch (reward.type) {
      case 'consistency':
        return reward.emoji || '🔥';
      case 'session_completion':
        return '✅';
      case 'pomodoro_master':
        return '🍅';
      case 'early_bird':
        return '🐦';
      case 'night_owl':
        return '🦉';
      case 'achievement':
        return reward.icon || '🏆';
      default:
        return '⭐';
    }
  };

  const getRewardColor = (reward) => {
    switch (reward.type) {
      case 'consistency':
        return '#FF6B6B';
      case 'session_completion':
        return '#4ECDC4';
      case 'pomodoro_master':
        return '#FF8C42';
      case 'early_bird':
        return '#45B7D1';
      case 'night_owl':
        return '#9B59B6';
      case 'achievement':
        return '#F39C12';
      default:
        return '#2ECC71';
    }
  };

  const getLevelProgress = () => {
    const levels = Object.values(ACHIEVEMENT_LEVELS).sort((a, b) => a.points - b.points);
    const currentLevel = levels.find(level => newTotalPoints >= level.points) || levels[0];
    const nextLevel = levels.find(level => newTotalPoints < level.points);
    
    if (!nextLevel) {
      return { currentLevel, progress: 100, pointsToNext: 0 };
    }
    
    const pointsInLevel = newTotalPoints - currentLevel.points;
    const pointsNeeded = nextLevel.points - currentLevel.points;
    const progress = (pointsInLevel / pointsNeeded) * 100;
    
    return { 
      currentLevel, 
      nextLevel, 
      progress, 
      pointsToNext: nextLevel.points - newTotalPoints 
    };
  };

  if (!visible || rewards.length === 0) return null;

  const currentReward = rewards[currentRewardIndex];
  const levelInfo = getLevelProgress();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container, 
            { backgroundColor: theme.cardBackground },
            {
              opacity: animatedValue,
              transform: [{
                scale: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1]
                })
              }]
            }
          ]}
        >
          {/* Close button */}
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>

          {/* Reward Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              🎉 Rewards Earned! 🎉
            </Text>
            <Text style={[styles.pointsTotal, { color: getRewardColor(currentReward) }]}>
              +{totalPointsEarned} Points
            </Text>
          </View>

          {/* Current Reward Display */}
          <View style={[styles.rewardCard, { backgroundColor: getRewardColor(currentReward) + '20' }]}>
            <Text style={styles.rewardIcon}>
              {getRewardIcon(currentReward)}
            </Text>
            <Text style={[styles.rewardMessage, { color: theme.text }]}>
              {currentReward.message}
            </Text>
            <View style={styles.rewardDetails}>
              <Text style={[styles.rewardPoints, { color: getRewardColor(currentReward) }]}>
                +{currentReward.points} Points
              </Text>
              {currentReward.streak && (
                <Text style={[styles.streakInfo, { color: theme.textSecondary }]}>
                  {currentReward.streak} Day Streak!
                </Text>
              )}
              {currentReward.consistency && (
                <Text style={[styles.consistencyInfo, { color: theme.textSecondary }]}>
                  {currentReward.consistency}% Consistency
                </Text>
              )}
            </View>
          </View>

          {/* Progress Indicator */}
          {rewards.length > 1 && (
            <View style={styles.progressIndicator}>
              {rewards.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor: index === currentRewardIndex 
                        ? getRewardColor(currentReward)
                        : theme.textSecondary + '40'
                    }
                  ]}
                />
              ))}
            </View>
          )}

          {/* Level Progress */}
          <View style={styles.levelSection}>
            <View style={styles.levelHeader}>
              <Text style={[styles.levelTitle, { color: theme.text }]}>
                {levelInfo.currentLevel.icon} {levelInfo.currentLevel.name} Level
              </Text>
              <Text style={[styles.totalPoints, { color: theme.text }]}>
                {newTotalPoints} Points
              </Text>
            </View>
            
            {levelInfo.nextLevel && (
              <>
                <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${levelInfo.progress}%`,
                        backgroundColor: levelInfo.currentLevel.color 
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.progressText, { color: theme.textSecondary }]}>
                  {levelInfo.pointsToNext} points to {levelInfo.nextLevel.icon} {levelInfo.nextLevel.name}
                </Text>
              </>
            )}
          </View>

          {/* Streak Display */}
          {currentStreak > 0 && (
            <View style={styles.streakSection}>
              <Text style={[styles.streakTitle, { color: theme.text }]}>
                🔥 Current Streak: {currentStreak} Days
              </Text>
            </View>
          )}

          {/* Achievements */}
          {achievements.length > 0 && (
            <View style={styles.achievementsSection}>
              <Text style={[styles.achievementsTitle, { color: theme.text }]}>
                🏆 New Achievements!
              </Text>
              {achievements.map((achievement, index) => (
                <View key={achievement.id} style={styles.achievementItem}>
                  <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                  <Text style={[styles.achievementText, { color: theme.text }]}>
                    {achievement.message}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            {currentRewardIndex < rewards.length - 1 ? (
              <TouchableOpacity 
                style={[styles.button, styles.nextButton, { backgroundColor: getRewardColor(currentReward) }]}
                onPress={() => {
                  setCurrentRewardIndex(currentRewardIndex + 1);
                  startRewardAnimation();
                }}
              >
                <Text style={styles.buttonText}>Next Reward</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.button, styles.doneButton, { backgroundColor: theme.primary }]}
                onPress={onClose}
              >
                <Text style={styles.buttonText}>Awesome!</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 1,
    padding: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  pointsTotal: {
    fontSize: 18,
    fontWeight: '600',
  },
  rewardCard: {
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
  },
  rewardIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  rewardMessage: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  rewardDetails: {
    alignItems: 'center',
  },
  rewardPoints: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  streakInfo: {
    fontSize: 14,
    fontWeight: '500',
  },
  consistencyInfo: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  levelSection: {
    marginBottom: 15,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalPoints: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 5,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
  streakSection: {
    alignItems: 'center',
    marginBottom: 15,
  },
  streakTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  achievementsSection: {
    marginBottom: 20,
  },
  achievementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  achievementIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  achievementText: {
    fontSize: 14,
    flex: 1,
  },
  actions: {
    alignItems: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 120,
  },
  nextButton: {
    // Color set dynamically
  },
  doneButton: {
    // Color set dynamically
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default RewardDisplay; 