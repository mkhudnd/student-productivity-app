// RewardSystem.js - Comprehensive gamification system for study motivation
// This utility provides:
// - Points-based reward system with base points and bonuses
// - Study streak tracking with milestone achievements  
// - Level progression system (Bronze → Silver → Gold → Platinum → Diamond)
// - Achievement system for reaching study milestones
// - Goal achievement detection and bonus rewards
// - User-specific data storage integration with AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';

// Reward Types
export const REWARD_TYPES = {
  CONSISTENCY: 'consistency',
  SESSION_COMPLETION: 'session_completion',
  WEEKLY_GOAL: 'weekly_goal',
  MONTHLY_GOAL: 'monthly_goal',
  PERFECT_WEEK: 'perfect_week',
  EARLY_BIRD: 'early_bird', // For studying early in the day
  NIGHT_OWL: 'night_owl',   // For late night study sessions
  POMODORO_MASTER: 'pomodoro_master', // For completing pomodoro sessions
};

// Achievement Levels
export const ACHIEVEMENT_LEVELS = {
  BRONZE: { name: 'Bronze', points: 100, color: '#CD7F32', icon: '🥉' },
  SILVER: { name: 'Silver', points: 250, color: '#C0C0C0', icon: '🥈' },
  GOLD: { name: 'Gold', points: 500, color: '#FFD700', icon: '🥇' },
  PLATINUM: { name: 'Platinum', points: 1000, color: '#E5E4E2', icon: '💎' },
  DIAMOND: { name: 'Diamond', points: 2000, color: '#B9F2FF', icon: '💍' },
};

// Streak Milestones
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365];

// Consistency Thresholds (percentage of planned time achieved)
export const CONSISTENCY_THRESHOLDS = {
  EXCELLENT: 0.95, // 95% or more
  GOOD: 0.80,      // 80-94%
  FAIR: 0.60,      // 60-79%
  POOR: 0.40,      // 40-59%
  MINIMAL: 0.20,   // 20-39%
};

class RewardSystemService {
  constructor() {
    this.storageKey = 'reward_system_data';
  }

  // Get user-specific storage key
  getStorageKey(user) {
    if (!user || !user.email) return this.storageKey;
    return `${this.storageKey}_${user.email}`;
  }

  // Initialize or load reward data
  async loadRewardData(user) {
    try {
      const data = await AsyncStorage.getItem(this.getStorageKey(user));
      if (data) {
        return JSON.parse(data);
      }
      return this.getDefaultRewardData();
    } catch (error) {
      console.error('Error loading reward data:', error);
      return this.getDefaultRewardData();
    }
  }

  // Save reward data
  async saveRewardData(rewardData, user) {
    try {
      await AsyncStorage.setItem(this.getStorageKey(user), JSON.stringify(rewardData));
    } catch (error) {
      console.error('Error saving reward data:', error);
    }
  }

  // Default reward data structure
  getDefaultRewardData() {
    return {
      totalPoints: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: null,
      achievements: [],
      recentRewards: [], // Last 10 rewards earned
      stats: {
        totalSessionsCompleted: 0,
        totalPlannedSessionsCompleted: 0,
        totalStudyTime: 0, // in seconds
        perfectDays: 0, // Days where all planned sessions were completed
        consistencyScore: 0, // Average consistency percentage
        weeklyGoalsAchieved: 0,
        monthlyGoalsAchieved: 0,
        earlyBirdSessions: 0, // Sessions before 9 AM
        nightOwlSessions: 0,  // Sessions after 9 PM
        pomodoroSessionsCompleted: 0,
      },
      dailyTargets: {
        studyMinutes: 120, // Default 2 hours
        sessions: 3,       // Default 3 sessions per day
      },
      lastRewardCalculation: null,
    };
  }

  // Calculate reward for completing a study session
  async calculateSessionReward(sessionData, plannedSession, user, dailyGoalMinutes = 120) {
    const rewardData = await this.loadRewardData(user);
    const rewards = [];
    let pointsEarned = 0;
    let goalAchieved = false;
    let goalType = '';

    const { actualDuration, plannedDuration, sessionType, completedAt, subjectName } = sessionData;
    const sessionDate = new Date(completedAt || new Date()).toISOString().slice(0, 10);

    // Check if daily goal was achieved with this session
    const todayTotalSeconds = await this.getTodayTotalStudyTime(user, sessionDate) + actualDuration;
    const dailyGoalSeconds = dailyGoalMinutes * 60;
    
    if (todayTotalSeconds >= dailyGoalSeconds && (todayTotalSeconds - actualDuration) < dailyGoalSeconds) {
      goalAchieved = true;
      goalType = 'Daily Study';
      
      // Add goal achievement reward
      const goalReward = {
        type: 'daily_goal',
        points: Math.max(50, Math.floor(dailyGoalMinutes * 0.5)), // Scale with goal size
        message: `🎯 Daily goal achieved! ${Math.round(todayTotalSeconds / 60)} minutes completed!`,
        earnedAt: new Date().toISOString(),
        goalMinutes: dailyGoalMinutes,
      };
      rewards.push(goalReward);
      pointsEarned += goalReward.points;
      
      // Update stats
      rewardData.stats.weeklyGoalsAchieved += 1;
    }

    // Base reward for completing any session
    const baseReward = {
      type: REWARD_TYPES.SESSION_COMPLETION,
      points: 10,
      message: `Completed ${Math.round(actualDuration / 60)} minute study session!`,
      earnedAt: new Date().toISOString(),
      sessionType: sessionType,
      subject: subjectName,
    };
    rewards.push(baseReward);
    pointsEarned += baseReward.points;

    // Bonus for completing planned sessions
    if (plannedSession && plannedDuration) {
      const consistencyPercentage = Math.min(actualDuration / plannedDuration, 1);
      const consistencyReward = this.calculateConsistencyReward(consistencyPercentage, plannedDuration);
      
      if (consistencyReward) {
        rewards.push({
          type: REWARD_TYPES.SESSION_COMPLETION,
          points: consistencyReward.points,
          message: consistencyReward.message,
          earnedAt: new Date().toISOString(),
          consistency: Math.round(consistencyPercentage * 100),
        });
        pointsEarned += consistencyReward.points;
      }

      // Update planned session completion stats
      rewardData.stats.totalPlannedSessionsCompleted += 1;
    }

    // Special session type bonuses
    if (sessionType === 'pomodoro') {
      rewards.push({
        type: REWARD_TYPES.POMODORO_MASTER,
        points: 5,
        message: 'Pomodoro technique mastery! 🍅',
        earnedAt: new Date().toISOString(),
      });
      pointsEarned += 5;
      rewardData.stats.pomodoroSessionsCompleted += 1;
    }

    // Time-based bonuses
    const hour = new Date(completedAt || new Date()).getHours();
    if (hour < 9) {
      rewards.push({
        type: REWARD_TYPES.EARLY_BIRD,
        points: 15,
        message: 'Early bird gets the worm! 🐦',
        earnedAt: new Date().toISOString(),
      });
      pointsEarned += 15;
      rewardData.stats.earlyBirdSessions += 1;
    } else if (hour >= 21) {
      rewards.push({
        type: REWARD_TYPES.NIGHT_OWL,
        points: 10,
        message: 'Night owl dedication! 🦉',
        earnedAt: new Date().toISOString(),
      });
      pointsEarned += 10;
      rewardData.stats.nightOwlSessions += 1;
    }

    // Update general stats
    rewardData.stats.totalSessionsCompleted += 1;
    rewardData.stats.totalStudyTime += actualDuration;

    // Calculate and update streak
    const streakReward = await this.updateStreak(rewardData, sessionDate);
    if (streakReward) {
      rewards.push(streakReward);
      pointsEarned += streakReward.points;
    }

    // Check for new achievements
    const achievementRewards = this.checkAchievements(rewardData);
    rewards.push(...achievementRewards);
    pointsEarned += achievementRewards.reduce((sum, reward) => sum + reward.points, 0);

    // Update total points and recent rewards
    rewardData.totalPoints += pointsEarned;
    rewardData.recentRewards.unshift(...rewards);
    rewardData.recentRewards = rewardData.recentRewards.slice(0, 20); // Keep last 20 rewards
    rewardData.lastRewardCalculation = new Date().toISOString();

    await this.saveRewardData(rewardData, user);

    return {
      rewards,
      totalPointsEarned: pointsEarned,
      newTotalPoints: rewardData.totalPoints,
      currentStreak: rewardData.currentStreak,
      achievements: achievementRewards,
      goalAchieved,
      goalType,
    };
  }

  // Calculate consistency reward based on planned vs actual time
  calculateConsistencyReward(consistencyPercentage, plannedDuration) {
    const plannedMinutes = Math.round(plannedDuration / 60);
    
    if (consistencyPercentage >= CONSISTENCY_THRESHOLDS.EXCELLENT) {
      return {
        points: Math.max(20, Math.floor(plannedMinutes * 0.5)), // Minimum 20, scale with duration
        message: `Excellent consistency! ${Math.round(consistencyPercentage * 100)}% of planned time! ⭐`,
      };
    } else if (consistencyPercentage >= CONSISTENCY_THRESHOLDS.GOOD) {
      return {
        points: Math.max(15, Math.floor(plannedMinutes * 0.3)),
        message: `Good consistency! ${Math.round(consistencyPercentage * 100)}% of planned time! 👍`,
      };
    } else if (consistencyPercentage >= CONSISTENCY_THRESHOLDS.FAIR) {
      return {
        points: Math.max(10, Math.floor(plannedMinutes * 0.2)),
        message: `Fair consistency! ${Math.round(consistencyPercentage * 100)}% of planned time! 👌`,
      };
    } else if (consistencyPercentage >= CONSISTENCY_THRESHOLDS.POOR) {
      return {
        points: 5,
        message: `Some progress! ${Math.round(consistencyPercentage * 100)}% of planned time!`,
      };
    }
    
    return null; // No reward for very low consistency
  }

  // Update study streak
  async updateStreak(rewardData, sessionDate) {
    const lastStudyDate = rewardData.lastStudyDate;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    if (!lastStudyDate) {
      // First study session ever
      rewardData.currentStreak = 1;
      rewardData.lastStudyDate = sessionDate;
      return {
        type: REWARD_TYPES.CONSISTENCY,
        points: 20,
        message: 'Started your study streak! Keep it up! 🔥',
        earnedAt: new Date().toISOString(),
        streak: 1,
      };
    }

    if (sessionDate === today && lastStudyDate === yesterdayStr) {
      // Continuing streak
      rewardData.currentStreak += 1;
      rewardData.lastStudyDate = sessionDate;
      
      // Check for streak milestones
      if (STREAK_MILESTONES.includes(rewardData.currentStreak)) {
        const milestoneReward = this.getStreakMilestoneReward(rewardData.currentStreak);
        rewardData.longestStreak = Math.max(rewardData.longestStreak, rewardData.currentStreak);
        return milestoneReward;
      }
    } else if (sessionDate === today && lastStudyDate !== today) {
      // Broken streak, restart
      const oldStreak = rewardData.currentStreak;
      rewardData.longestStreak = Math.max(rewardData.longestStreak, oldStreak);
      rewardData.currentStreak = 1;
      rewardData.lastStudyDate = sessionDate;
      
      if (oldStreak > 1) {
        return {
          type: REWARD_TYPES.CONSISTENCY,
          points: 5,
          message: `Streak reset! Previous: ${oldStreak} days. Starting fresh! 🔄`,
          earnedAt: new Date().toISOString(),
          streak: 1,
          previousStreak: oldStreak,
        };
      }
    }

    return null;
  }

  // Get reward for streak milestones
  getStreakMilestoneReward(streakDays) {
    const milestoneData = {
      3: { points: 50, message: '3-day streak! Building the habit! 🔥', emoji: '🔥' },
      7: { points: 100, message: '1 week streak! You\'re on fire! 🚀', emoji: '🚀' },
      14: { points: 200, message: '2 weeks strong! Consistency master! ⚡', emoji: '⚡' },
      30: { points: 500, message: '30-day streak! Incredible dedication! 🏆', emoji: '🏆' },
      50: { points: 750, message: '50 days! You\'re unstoppable! 💪', emoji: '💪' },
      100: { points: 1500, message: '100-day streak! Study legend! 👑', emoji: '👑' },
      365: { points: 5000, message: '1 YEAR STREAK! Absolute champion! 🎉', emoji: '🎉' },
    };

    const milestone = milestoneData[streakDays] || { points: streakDays * 10, message: `${streakDays}-day streak!`, emoji: '🔥' };

    return {
      type: REWARD_TYPES.CONSISTENCY,
      points: milestone.points,
      message: milestone.message,
      earnedAt: new Date().toISOString(),
      streak: streakDays,
      milestone: true,
      emoji: milestone.emoji,
    };
  }

  // Check for new achievements based on stats
  checkAchievements(rewardData) {
    const achievements = [];
    const stats = rewardData.stats;

    // Check various achievement thresholds
    const achievementChecks = [
      {
        id: 'first_100_sessions',
        threshold: 100,
        current: stats.totalSessionsCompleted,
        points: 200,
        message: 'Century Club! 100 study sessions completed! 💯',
        icon: '💯',
      },
      {
        id: 'first_500_sessions',
        threshold: 500,
        current: stats.totalSessionsCompleted,
        points: 500,
        message: 'Study Machine! 500 sessions completed! 🤖',
        icon: '🤖',
      },
      {
        id: 'first_50_planned',
        threshold: 50,
        current: stats.totalPlannedSessionsCompleted,
        points: 150,
        message: 'Planning Pro! 50 planned sessions completed! 📅',
        icon: '📅',
      },
      {
        id: 'first_100_hours',
        threshold: 360000, // 100 hours in seconds
        current: stats.totalStudyTime,
        points: 300,
        message: '100 Hours! Dedicated learner! ⏰',
        icon: '⏰',
      },
      {
        id: 'pomodoro_master_50',
        threshold: 50,
        current: stats.pomodoroSessionsCompleted,
        points: 250,
        message: 'Pomodoro Master! 50 focused sessions! 🍅',
        icon: '🍅',
      },
      {
        id: 'early_bird_25',
        threshold: 25,
        current: stats.earlyBirdSessions,
        points: 200,
        message: 'Early Bird Champion! 25 morning sessions! 🌅',
        icon: '🌅',
      },
    ];

    for (const check of achievementChecks) {
      const alreadyEarned = rewardData.achievements.some(a => a.id === check.id);
      if (!alreadyEarned && check.current >= check.threshold) {
        const achievement = {
          id: check.id,
          type: 'achievement',
          points: check.points,
          message: check.message,
          icon: check.icon,
          earnedAt: new Date().toISOString(),
          threshold: check.threshold,
        };
        
        achievements.push(achievement);
        rewardData.achievements.push(achievement);
      }
    }

    return achievements;
  }

  // Calculate daily progress and rewards
  async calculateDailyProgress(user) {
    const rewardData = await this.loadRewardData(user);
    const today = new Date().toISOString().slice(0, 10);
    
    // This would be called at the end of each day to check daily goals
    // Implementation depends on how you want to track daily completions
    
    return {
      totalPoints: rewardData.totalPoints,
      currentStreak: rewardData.currentStreak,
      todayProgress: {
        sessionsCompleted: 0, // Would need to calculate from today's sessions
        timeStudied: 0,       // Would need to calculate from today's sessions
        goalsAchieved: [],
      },
    };
  }

  // Get current user stats and level
  async getUserStats(user) {
    const rewardData = await this.loadRewardData(user);
    
    // Calculate current level based on points
    const level = this.calculateLevel(rewardData.totalPoints);
    
    return {
      totalPoints: rewardData.totalPoints,
      level: level,
      currentStreak: rewardData.currentStreak,
      longestStreak: rewardData.longestStreak,
      achievements: rewardData.achievements,
      recentRewards: rewardData.recentRewards.slice(0, 10),
      stats: rewardData.stats,
      nextLevelPoints: this.getNextLevelPoints(rewardData.totalPoints),
    };
  }

  // Level Calculation - determines user's current level based on total points earned
  // Uses a tier system where higher levels require exponentially more points
  calculateLevel(totalPoints) {
    const levels = Object.values(ACHIEVEMENT_LEVELS).sort((a, b) => a.points - b.points);
    
    for (let i = levels.length - 1; i >= 0; i--) {
      if (totalPoints >= levels[i].points) {
        return levels[i];
      }
    }
    
    return levels[0]; // Bronze level if under minimum
  }

  // Get points needed for next level
  getNextLevelPoints(currentPoints) {
    const levels = Object.values(ACHIEVEMENT_LEVELS).sort((a, b) => a.points - b.points);
    
    for (const level of levels) {
      if (currentPoints < level.points) {
        return level.points - currentPoints;
      }
    }
    
    return 0; // Already at max level
  }

  // Get today's total study time from AsyncStorage
  async getTodayTotalStudyTime(user, dateString) {
    try {
      const storageKey = `study_tracker_data_${user.email}`;
      const data = await AsyncStorage.getItem(storageKey);
      if (data) {
        const parsedData = JSON.parse(data);
        const todaySessions = (parsedData.sessions || []).filter(s => s.date === dateString);
        return todaySessions.reduce((sum, s) => sum + s.duration, 0);
      }
      return 0;
    } catch (error) {
      console.error('Error getting today\'s study time:', error);
      return 0;
    }
  }

  // Reset daily progress (to be called daily)
  async resetDailyProgress(user) {
    const rewardData = await this.loadRewardData(user);
    // Reset any daily counters if needed
    await this.saveRewardData(rewardData, user);
  }

  // Helper Functions for Study Time Calculation
  
  // Calculate total study time for today across all sessions
  // Used for goal achievement detection and marathon scholar achievement
  static async getTodayTotalStudyTime(currentUser) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for today study time calculation');
        return 0;
      }

      // Load study sessions from StudyTracker storage
      const studyTrackerKey = `study_tracker_data_${currentUser.email}`;
      const studyData = await AsyncStorage.getItem(studyTrackerKey);
      
      if (!studyData) {
        return 0; // No study data found
      }
      
      const parsedData = JSON.parse(studyData);
      const sessions = parsedData.sessions || [];
      
      // Filter sessions for today and sum their durations
      const today = new Date().toISOString().slice(0, 10);
      const todaySessions = sessions.filter(session => session.date === today);
      
      // Convert from seconds to minutes and sum
      const totalMinutes = todaySessions.reduce((total, session) => {
        return total + Math.round(session.duration / 60); // duration is in seconds
      }, 0);
      
      return totalMinutes;
      
    } catch (error) {
      console.error('Error calculating today total study time:', error);
      return 0;
    }
  }

  // Progress Tracking Functions - provide data for UI display
  
  // Get comprehensive user progress summary for reward displays
  static async getUserProgress(currentUser) {
    try {
      const userData = await this.getUserData(currentUser);
      const level = this.calculateLevel(userData.totalPoints);
      const todayStudyTime = await this.getTodayTotalStudyTime(currentUser);
      
      return {
        // Points and level information
        totalPoints: userData.totalPoints || 0,
        level: level,
        
        // Streak information
        currentStreak: userData.currentStreak || 0,
        longestStreak: userData.longestStreak || 0,
        
        // Session statistics
        totalSessions: userData.totalSessions || 0,
        plannedSessionsCompleted: userData.plannedSessionsCompleted || 0,
        pomodoroSessions: userData.pomodoroSessions || 0,
        
        // Achievement information
        achievements: userData.achievements || [],
        totalAchievements: Object.keys(this.ACHIEVEMENTS).length,
        
        // Daily progress
        todayStudyTime: todayStudyTime,
        dailyGoalsAchieved: userData.dailyGoalsAchieved || 0,
        
        // Timestamps
        lastStudyDate: userData.lastStudyDate,
        lastSessionDate: userData.lastSessionDate,
      };
    } catch (error) {
      console.error('Error getting user progress:', error);
      return {
        totalPoints: 0,
        level: this.calculateLevel(0),
        currentStreak: 0,
        longestStreak: 0,
        totalSessions: 0,
        achievements: [],
        todayStudyTime: 0,
      };
    }
  }

  // Get user's unlocked achievements with full details
  static async getUserAchievements(currentUser) {
    try {
      const userData = await this.getUserData(currentUser);
      const unlockedIds = userData.achievements || [];
      
      // Map achievement IDs to full achievement objects
      const unlockedAchievements = unlockedIds.map(id => {
        const achievement = Object.values(this.ACHIEVEMENTS).find(ach => ach.id === id);
        return achievement ? {
          ...achievement,
          unlockedDate: userData.lastSessionDate || new Date().toISOString().slice(0, 10)
        } : null;
      }).filter(Boolean); // Remove any null values
      
      // Calculate progress towards locked achievements
      const allAchievements = Object.values(this.ACHIEVEMENTS).map(achievement => {
        const isUnlocked = unlockedIds.includes(achievement.id);
        let progress = 0;
        
        if (!isUnlocked) {
          // Calculate progress based on achievement type
          switch (achievement.id) {
            case 'century_club':
              progress = Math.min((userData.totalSessions / achievement.requirement) * 100, 100);
              break;
            case 'planning_pro':
              progress = Math.min((userData.plannedSessionsCompleted / achievement.requirement) * 100, 100);
              break;
            case 'streak_warrior':
              progress = Math.min((userData.currentStreak / achievement.requirement) * 100, 100);
              break;
            case 'pomodoro_master':
              progress = Math.min((userData.pomodoroSessions / achievement.requirement) * 100, 100);
              break;
            default:
              progress = 0;
          }
        } else {
          progress = 100; // Achievement is unlocked
        }
        
        return {
          ...achievement,
          isUnlocked,
          progress,
          unlockedDate: isUnlocked ? userData.lastSessionDate : null
        };
      });
      
      return {
        unlocked: unlockedAchievements,
        all: allAchievements,
        totalUnlocked: unlockedAchievements.length,
        totalAvailable: Object.keys(this.ACHIEVEMENTS).length
      };
      
    } catch (error) {
      console.error('Error getting user achievements:', error);
      return {
        unlocked: [],
        all: Object.values(this.ACHIEVEMENTS).map(achievement => ({
          ...achievement,
          isUnlocked: false,
          progress: 0
        })),
        totalUnlocked: 0,
        totalAvailable: Object.keys(this.ACHIEVEMENTS).length
      };
    }
  }

  // Special Session Type Tracking - increment counters for specific session types
  
  // Increment planned session counter when user completes a scheduled session
  static async incrementPlannedSession(currentUser) {
    try {
      const userData = await this.getUserData(currentUser);
      userData.plannedSessionsCompleted = (userData.plannedSessionsCompleted || 0) + 1;
      await this.saveUserData(userData, currentUser);
      return userData.plannedSessionsCompleted;
    } catch (error) {
      console.error('Error incrementing planned session count:', error);
      return 0;
    }
  }

  // Increment Pomodoro session counter for technique-specific achievements
  static async incrementPomodoroSession(currentUser) {
    try {
      const userData = await this.getUserData(currentUser);
      userData.pomodoroSessions = (userData.pomodoroSessions || 0) + 1;
      await this.saveUserData(userData, currentUser);
      return userData.pomodoroSessions;
    } catch (error) {
      console.error('Error incrementing Pomodoro session count:', error);
      return 0;
    }
  }

  // Increment daily goals achieved counter
  static async incrementDailyGoal(currentUser) {
    try {
      const userData = await this.getUserData(currentUser);
      userData.dailyGoalsAchieved = (userData.dailyGoalsAchieved || 0) + 1;
      await this.saveUserData(userData, currentUser);
      return userData.dailyGoalsAchieved;
    } catch (error) {
      console.error('Error incrementing daily goal count:', error);
      return 0;
    }
  }

  // Data Reset and Management Functions
  
  // Reset user's reward data (for testing or user request)
  static async resetUserData(currentUser) {
    try {
      const defaultData = {
        totalPoints: 0,
        totalSessions: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastStudyDate: null,
        lastSessionDate: null,
        achievements: [],
        plannedSessionsCompleted: 0,
        pomodoroSessions: 0,
        dailyGoalsAchieved: 0,
      };
      
      await this.saveUserData(defaultData, currentUser);
      console.log('User reward data reset successfully');
      return true;
    } catch (error) {
      console.error('Error resetting user reward data:', error);
      return false;
    }
  }

  // Export user reward data for backup or analysis
  static async exportUserData(currentUser) {
    try {
      const userData = await this.getUserData(currentUser);
      const progress = await this.getUserProgress(currentUser);
      const achievements = await this.getUserAchievements(currentUser);
      
      return {
        exportDate: new Date().toISOString(),
        userEmail: currentUser.email,
        rawData: userData,
        progress: progress,
        achievements: achievements,
        level: this.calculateLevel(userData.totalPoints)
      };
    } catch (error) {
      console.error('Error exporting user reward data:', error);
      return null;
    }
  }
}

export const RewardSystem = new RewardSystemService(); 