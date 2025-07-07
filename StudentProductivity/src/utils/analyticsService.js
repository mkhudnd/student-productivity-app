import { readJson, writeJson } from '../storage/fileStorage';

const ANALYTICS_FILE = 'analytics.json';
const EXPORT_SETTINGS_FILE = 'exportSettings.json';

// Default export settings
const DEFAULT_EXPORT_SETTINGS = {
  includePlannerData: true,
  includeTrackerData: true,
  includeAppUsageData: true,
  includeFocusSessionData: true,
  plannerNotifications: false,
  trackerNotifications: false,
};

export class AnalyticsService {
  // Get export settings
  static async getExportSettings() {
    try {
      const settings = await readJson(EXPORT_SETTINGS_FILE);
      return settings || DEFAULT_EXPORT_SETTINGS;
    } catch (error) {
      return DEFAULT_EXPORT_SETTINGS;
    }
  }

  // Update export settings
  static async updateExportSettings(newSettings) {
    try {
      const currentSettings = await this.getExportSettings();
      const updatedSettings = { ...currentSettings, ...newSettings };
      await writeJson(EXPORT_SETTINGS_FILE, updatedSettings);
      return updatedSettings;
    } catch (error) {
      console.error('Error updating export settings:', error);
      throw error;
    }
  }

  // Record app usage session
  static async recordAppSession(sessionData, currentUser = null) {
    try {
      const analytics = await this.getAnalyticsData();
      const session = {
        id: Date.now().toString(),
        type: 'app_usage',
        timestamp: new Date().toISOString(),
        date: sessionData.date || new Date().toISOString().slice(0, 10),
        startTime: sessionData.startTime,
        endTime: sessionData.endTime,
        duration: sessionData.duration, // in seconds
        screen: sessionData.screen, // which screen/feature was used
        interactions: sessionData.interactions || 0, // number of user interactions
        backgroundTime: sessionData.backgroundTime || 0, // time spent in background
        activeTime: sessionData.activeTime || sessionData.duration, // time actively using app
        userId: currentUser ? currentUser.email : 'anonymous', // Add user ID
      };

      if (!analytics.appSessions) {
        analytics.appSessions = [];
      }
      analytics.appSessions.push(session);
      await this.updateLastUpdated(analytics);
      await writeJson(ANALYTICS_FILE, analytics);
      return session;
    } catch (error) {
      console.error('Error recording app session:', error);
    }
  }

  // Record focus session (detailed study session tracking)
  static async recordFocusSession(sessionData, currentUser = null) {
    try {
      const analytics = await this.getAnalyticsData();
      const session = {
        id: Date.now().toString(),
        type: 'focus_session',
        timestamp: new Date().toISOString(),
        date: sessionData.date || new Date().toISOString().slice(0, 10),
        startTime: sessionData.startTime,
        endTime: sessionData.endTime,
        duration: sessionData.duration, // in seconds
        targetDuration: sessionData.targetDuration, // planned duration
        subject: sessionData.subject,
        topic: sessionData.topic,
        sessionType: sessionData.sessionType, // 'pomodoro', 'deep_work', 'review', 'practice'
        completed: sessionData.completed || false,
        interrupted: sessionData.interrupted || false,
        interruptions: sessionData.interruptions || [],
        breaks: sessionData.breaks || [],
        focusScore: sessionData.focusScore, // 1-10 rating
        productivity: sessionData.productivity, // 1-10 rating
        difficulty: sessionData.difficulty, // 1-10 rating
        notes: sessionData.notes || '',
        goals: sessionData.goals || [],
        goalsCompleted: sessionData.goalsCompleted || [],
        environment: sessionData.environment, // 'quiet', 'moderate', 'noisy'
        mood: sessionData.mood, // 'excellent', 'good', 'neutral', 'poor'
        userId: currentUser ? currentUser.email : 'anonymous', // Add user ID
      };

      if (!analytics.focusSessions) {
        analytics.focusSessions = [];
      }
      analytics.focusSessions.push(session);
      await this.updateLastUpdated(analytics);
      await writeJson(ANALYTICS_FILE, analytics);
      return session;
    } catch (error) {
      console.error('Error recording focus session:', error);
    }
  }

  // Record break session
  static async recordBreakSession(sessionData, currentUser = null) {
    try {
      const analytics = await this.getAnalyticsData();
      const breakSession = {
        id: Date.now().toString(),
        type: 'break_session',
        timestamp: new Date().toISOString(),
        date: sessionData.date || new Date().toISOString().slice(0, 10),
        startTime: sessionData.startTime,
        endTime: sessionData.endTime,
        duration: sessionData.duration, // in seconds
        breakType: sessionData.breakType, // 'short', 'long', 'meal', 'exercise'
        activity: sessionData.activity, // what they did during break
        restfulness: sessionData.restfulness, // 1-10 rating
        linkedFocusSessionId: sessionData.linkedFocusSessionId,
        userId: currentUser ? currentUser.email : 'anonymous', // Add user ID
      };

      if (!analytics.breakSessions) {
        analytics.breakSessions = [];
      }
      analytics.breakSessions.push(breakSession);
      await this.updateLastUpdated(analytics);
      await writeJson(ANALYTICS_FILE, analytics);
      return breakSession;
    } catch (error) {
      console.error('Error recording break session:', error);
    }
  }

  // Record session interruption
  static async recordInterruption(interruptionData, currentUser = null) {
    try {
      const analytics = await this.getAnalyticsData();
      const interruption = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        sessionId: interruptionData.sessionId,
        sessionType: interruptionData.sessionType,
        duration: interruptionData.duration,
        reason: interruptionData.reason, // 'notification', 'call', 'distraction', 'break', 'emergency'
        source: interruptionData.source, // 'internal', 'external'
        resumedSession: interruptionData.resumedSession || false,
        userId: currentUser ? currentUser.email : 'anonymous', // Add user ID
      };

      if (!analytics.interruptions) {
        analytics.interruptions = [];
      }
      analytics.interruptions.push(interruption);
      await this.updateLastUpdated(analytics);
      await writeJson(ANALYTICS_FILE, analytics);
      return interruption;
    } catch (error) {
      console.error('Error recording interruption:', error);
    }
  }

  // Record planner event
  static async recordPlannerEvent(eventData, currentUser = null) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for recording planner event');
        return null;
      }

      const analytics = await this.getAnalyticsData(currentUser);
      const event = {
        id: Date.now().toString(),
        type: 'planner',
        timestamp: new Date().toISOString(),
        date: eventData.date,
        title: eventData.title,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        category: eventData.category || 'general',
        completed: eventData.completed || false,
        duration: eventData.duration || 0,
        priority: eventData.priority,
        actualStartTime: eventData.actualStartTime,
        actualEndTime: eventData.actualEndTime,
        actualDuration: eventData.actualDuration,
        completionRating: eventData.completionRating, // how well they completed it
        userId: currentUser.email, // Add user ID for data isolation
      };

      analytics.plannerEvents.push(event);
      await this.updateLastUpdated(analytics);
      await writeJson(ANALYTICS_FILE, analytics);
      return event;
    } catch (error) {
      console.error('Error recording planner event:', error);
    }
  }

  // Record study session (enhanced)
  static async recordStudySession(sessionData, currentUser = null) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for recording study session');
        return null;
      }

      const analytics = await this.getAnalyticsData(currentUser);
      const session = {
        id: Date.now().toString(),
        type: 'study',
        timestamp: new Date().toISOString(),
        date: sessionData.date,
        subjectId: sessionData.subjectId,
        subjectName: sessionData.subjectName,
        topic: sessionData.topic,
        duration: sessionData.duration,
        sessionType: sessionData.sessionType || 'manual', // manual, planned, pomodoro
        completed: sessionData.completed || false,
        focusScore: sessionData.focusScore || null,
        breaks: sessionData.breaks || 0,
        // Enhanced tracking
        targetDuration: sessionData.targetDuration,
        efficiency: sessionData.efficiency, // actual vs planned progress
        understanding: sessionData.understanding, // 1-10 self-assessment
        materials: sessionData.materials || [], // books, videos, etc.
        location: sessionData.location,
        linkedPlannerEventId: sessionData.linkedPlannerEventId,
        userId: currentUser.email, // Add user ID for data isolation
      };

      analytics.studySessions.push(session);
      await this.updateLastUpdated(analytics);
      await writeJson(ANALYTICS_FILE, analytics);
      return session;
    } catch (error) {
      console.error('Error recording study session:', error);
    }
  }

  // Update last updated timestamp
  static async updateLastUpdated(analytics) {
    analytics.lastUpdated = new Date().toISOString();
    return analytics;
  }

  // Get analytics data (enhanced)
  static async getAnalyticsData(currentUser = null) {
    try {
      const data = await readJson(ANALYTICS_FILE);
      const defaultData = {
        plannerEvents: [],
        studySessions: [],
        appSessions: [],
        focusSessions: [],
        breakSessions: [],
        interruptions: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      if (!data) return defaultData;

      // Filter data by current user if provided
      if (currentUser && currentUser.email) {
        return {
          ...data,
          plannerEvents: (data.plannerEvents || []).filter(event => 
            event.userId === currentUser.email
          ),
          studySessions: (data.studySessions || []).filter(session => 
            session.userId === currentUser.email
          ),
          appSessions: (data.appSessions || []).filter(session => 
            session.userId === currentUser.email
          ),
          focusSessions: (data.focusSessions || []).filter(session => 
            session.userId === currentUser.email
          ),
          breakSessions: (data.breakSessions || []).filter(session => 
            session.userId === currentUser.email
          ),
          interruptions: (data.interruptions || []).filter(interruption => 
            interruption.userId === currentUser.email
          ),
        };
      }

      // If no current user, return empty data to prevent seeing other users' data
      return {
        plannerEvents: [],
        studySessions: [],
        appSessions: [],
        focusSessions: [],
        breakSessions: [],
        interruptions: [],
        createdAt: data.createdAt || new Date().toISOString(),
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    } catch (error) {
      return {
        plannerEvents: [],
        studySessions: [],
        appSessions: [],
        focusSessions: [],
        breakSessions: [],
        interruptions: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  // Get comprehensive analytics summary
  static async getAnalyticsSummary(dateRange = 30, currentUser = null) {
    try {
      const data = await this.getAnalyticsData(currentUser);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - dateRange);

      const recentEvents = data.plannerEvents.filter(
        event => new Date(event.timestamp) >= cutoffDate
      );
      const recentSessions = data.studySessions.filter(
        session => new Date(session.timestamp) >= cutoffDate
      );
      const recentAppSessions = (data.appSessions || []).filter(
        session => new Date(session.timestamp) >= cutoffDate
      );
      const recentFocusSessions = (data.focusSessions || []).filter(
        session => new Date(session.timestamp) >= cutoffDate
      );
      const recentBreaks = (data.breakSessions || []).filter(
        session => new Date(session.timestamp) >= cutoffDate
      );
      const recentInterruptions = (data.interruptions || []).filter(
        interruption => new Date(interruption.timestamp) >= cutoffDate
      );

      // Calculate planner stats
      const plannerStats = {
        totalEvents: recentEvents.length,
        completedEvents: recentEvents.filter(e => e.completed).length,
        totalPlannedTime: recentEvents.reduce((sum, e) => sum + (e.duration || 0), 0),
        completionRate: recentEvents.length > 0 
          ? Math.round((recentEvents.filter(e => e.completed).length / recentEvents.length) * 100)
          : 0,
        averageCompletionRating: this.calculateAverageRating(recentEvents, 'completionRating'),
      };

      // Calculate study stats
      const studyStats = {
        totalSessions: recentSessions.length,
        totalStudyTime: recentSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        averageSessionTime: recentSessions.length > 0
          ? Math.round(recentSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / recentSessions.length)
          : 0,
        subjectBreakdown: this.getSubjectBreakdown(recentSessions),
        streakDays: this.calculateStreakDays(recentSessions),
        averageFocusScore: this.calculateAverageRating(recentSessions, 'focusScore'),
        averageUnderstanding: this.calculateAverageRating(recentSessions, 'understanding'),
      };

      // Calculate app usage stats
      const appStats = {
        totalSessions: recentAppSessions.length,
        totalAppTime: recentAppSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        averageSessionTime: recentAppSessions.length > 0
          ? Math.round(recentAppSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / recentAppSessions.length)
          : 0,
        screenBreakdown: this.getScreenBreakdown(recentAppSessions),
        totalInteractions: recentAppSessions.reduce((sum, s) => sum + (s.interactions || 0), 0),
      };

      // Calculate focus session stats
      const focusStats = {
        totalSessions: recentFocusSessions.length,
        totalFocusTime: recentFocusSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        completedSessions: recentFocusSessions.filter(s => s.completed).length,
        averageFocusScore: this.calculateAverageRating(recentFocusSessions, 'focusScore'),
        averageProductivity: this.calculateAverageRating(recentFocusSessions, 'productivity'),
        totalInterruptions: recentInterruptions.length,
        averageBreaksPerSession: recentFocusSessions.length > 0
          ? recentFocusSessions.reduce((sum, s) => sum + (s.breaks?.length || 0), 0) / recentFocusSessions.length
          : 0,
      };

      return {
        dateRange,
        planner: plannerStats,
        study: studyStats,
        app: appStats,
        focus: focusStats,
        combined: {
          totalActivities: plannerStats.totalEvents + studyStats.totalSessions + focusStats.totalSessions,
          totalTime: plannerStats.totalPlannedTime + studyStats.totalStudyTime + focusStats.totalFocusTime,
          productivityScore: this.calculateProductivityScore(plannerStats, studyStats, focusStats),
        }
      };
    } catch (error) {
      console.error('Error getting analytics summary:', error);
      return null;
    }
  }

  // Calculate average rating for a specific field
  static calculateAverageRating(items, field) {
    const validRatings = items
      .map(item => item[field])
      .filter(rating => rating !== null && rating !== undefined && !isNaN(rating));
    
    if (validRatings.length === 0) return null;
    
    return Math.round((validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length) * 10) / 10;
  }

  // Get screen breakdown for app usage
  static getScreenBreakdown(appSessions) {
    const breakdown = {};
    appSessions.forEach(session => {
      const screen = session.screen || 'Unknown';
      if (!breakdown[screen]) {
        breakdown[screen] = { count: 0, totalTime: 0, totalInteractions: 0 };
      }
      breakdown[screen].count++;
      breakdown[screen].totalTime += session.duration || 0;
      breakdown[screen].totalInteractions += session.interactions || 0;
    });
    return breakdown;
  }

  // Calculate productivity score (enhanced)
  static calculateProductivityScore(plannerStats, studyStats, focusStats) {
    let score = 0;
    
    // Planner contribution (30%)
    score += (plannerStats.completionRate * 0.3);
    
    // Study time contribution (30%)
    if (studyStats.totalStudyTime > 0) {
      score += Math.min(30, (studyStats.totalStudyTime / 240) * 30);
    }
    
    // Focus session contribution (25%)
    if (focusStats.totalSessions > 0) {
      const focusCompletion = (focusStats.completedSessions / focusStats.totalSessions) * 100;
      score += (focusCompletion * 0.25);
    }
    
    // Bonus factors (15%)
    if (plannerStats.averageCompletionRating >= 8) score += 5;
    if (studyStats.averageFocusScore >= 8) score += 5;
    if (focusStats.averageProductivity >= 8) score += 5;
    
    return Math.min(100, Math.round(score));
  }

  // Get subject breakdown
  static getSubjectBreakdown(sessions) {
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
  }

  // Calculate study streak
  static calculateStreakDays(sessions) {
    if (sessions.length === 0) return 0;

    const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().slice(0, 10);
    
    for (let i = 0; i < dates.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      const expectedDateStr = expectedDate.toISOString().slice(0, 10);
      
      if (dates[i] === expectedDateStr) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }

  // Get detailed session insights
  static async getSessionInsights(dateRange = 7, currentUser = null) {
    try {
      const data = await this.getAnalyticsData(currentUser);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - dateRange);

      const recentFocusSessions = (data.focusSessions || []).filter(
        session => new Date(session.timestamp) >= cutoffDate
      );
      const recentInterruptions = (data.interruptions || []).filter(
        interruption => new Date(interruption.timestamp) >= cutoffDate
      );

      return {
        mostProductiveTime: this.findMostProductiveTimeSlot(recentFocusSessions),
        commonInterruptions: this.analyzeInterruptions(recentInterruptions),
        focusTrends: this.analyzeFocusTrends(recentFocusSessions),
        recommendations: this.generateRecommendations(recentFocusSessions, recentInterruptions),
      };
    } catch (error) {
      console.error('Error getting session insights:', error);
      return null;
    }
  }

  // Find most productive time slot
  static findMostProductiveTimeSlot(focusSessions) {
    const timeSlots = {};
    
    focusSessions.forEach(session => {
      if (session.startTime && session.productivity) {
        const hour = new Date(`2000-01-01T${session.startTime}`).getHours();
        const timeSlot = `${hour}:00-${hour + 1}:00`;
        
        if (!timeSlots[timeSlot]) {
          timeSlots[timeSlot] = { sessions: 0, totalProductivity: 0, averageProductivity: 0 };
        }
        
        timeSlots[timeSlot].sessions++;
        timeSlots[timeSlot].totalProductivity += session.productivity;
        timeSlots[timeSlot].averageProductivity = timeSlots[timeSlot].totalProductivity / timeSlots[timeSlot].sessions;
      }
    });

    // Find the time slot with highest average productivity (minimum 2 sessions)
    let bestSlot = null;
    let bestProductivity = 0;
    
    Object.entries(timeSlots).forEach(([slot, data]) => {
      if (data.sessions >= 2 && data.averageProductivity > bestProductivity) {
        bestProductivity = data.averageProductivity;
        bestSlot = { timeSlot: slot, ...data };
      }
    });

    return bestSlot;
  }

  // Analyze interruptions
  static analyzeInterruptions(interruptions) {
    const reasonCounts = {};
    const sourceCounts = {};
    
    interruptions.forEach(interruption => {
      reasonCounts[interruption.reason] = (reasonCounts[interruption.reason] || 0) + 1;
      sourceCounts[interruption.source] = (sourceCounts[interruption.source] || 0) + 1;
    });

    return {
      totalInterruptions: interruptions.length,
      commonReasons: Object.entries(reasonCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3),
      commonSources: Object.entries(sourceCounts)
        .sort(([,a], [,b]) => b - a),
      averageDuration: interruptions.length > 0
        ? interruptions.reduce((sum, i) => sum + (i.duration || 0), 0) / interruptions.length
        : 0,
    };
  }

  // Analyze focus trends
  static analyzeFocusTrends(focusSessions) {
    if (focusSessions.length === 0) return null;

    const sortedSessions = focusSessions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    const focusScores = sortedSessions.map(s => s.focusScore).filter(score => score !== null);
    const productivityScores = sortedSessions.map(s => s.productivity).filter(score => score !== null);
    
    return {
      focusTrend: this.calculateTrend(focusScores),
      productivityTrend: this.calculateTrend(productivityScores),
      completionRate: (sortedSessions.filter(s => s.completed).length / sortedSessions.length) * 100,
      averageSessionLength: sortedSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sortedSessions.length,
    };
  }

  // Calculate trend (improving, declining, stable)
  static calculateTrend(scores) {
    if (scores.length < 2) return 'insufficient_data';
    
    const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    
    const difference = secondAvg - firstAvg;
    
    if (difference > 0.5) return 'improving';
    if (difference < -0.5) return 'declining';
    return 'stable';
  }

  // Generate recommendations
  static generateRecommendations(focusSessions, interruptions) {
    const recommendations = [];
    
    // Analyze session length
    const avgDuration = focusSessions.length > 0
      ? focusSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / focusSessions.length
      : 0;
    
    if (avgDuration > 0 && avgDuration < 1800) { // Less than 30 minutes
      recommendations.push({
        type: 'session_length',
        message: 'Consider longer focus sessions (30-45 minutes) for better deep work.',
        priority: 'medium',
      });
    }
    
    // Analyze interruptions
    if (interruptions.length > focusSessions.length * 0.5) {
      recommendations.push({
        type: 'interruptions',
        message: 'High interruption rate detected. Consider turning off notifications during focus time.',
        priority: 'high',
      });
    }
    
    // Analyze completion rate
    const completionRate = focusSessions.length > 0
      ? (focusSessions.filter(s => s.completed).length / focusSessions.length) * 100
      : 0;
    
    if (completionRate < 70) {
      recommendations.push({
        type: 'completion',
        message: 'Low session completion rate. Try breaking tasks into smaller chunks.',
        priority: 'high',
      });
    }
    
    return recommendations;
  }

  // Export to CSV (enhanced)
  static async exportToCSV() {
    try {
      const settings = await this.getExportSettings();
      const data = await this.getAnalyticsData();
      
      let csvContent = '';
      
      if (settings.includePlannerData && data.plannerEvents.length > 0) {
        csvContent += 'DAILY PLANNER DATA\n';
        csvContent += 'Date,Title,Start Time,End Time,Duration (min),Category,Completed,Priority,Completion Rating,Timestamp\n';
        
        data.plannerEvents.forEach(event => {
          csvContent += `${event.date},"${event.title}",${event.startTime},${event.endTime},${event.duration},"${event.category}",${event.completed},"${event.priority || 'N/A'}",${event.completionRating || 'N/A'},${event.timestamp}\n`;
        });
        
        csvContent += '\n';
      }
      
      if (settings.includeTrackerData && data.studySessions.length > 0) {
        csvContent += 'STUDY TRACKER DATA\n';
        csvContent += 'Date,Subject,Topic,Duration (min),Session Type,Completed,Breaks,Focus Score,Understanding,Timestamp\n';
        
        data.studySessions.forEach(session => {
          csvContent += `${session.date},"${session.subjectName}","${session.topic}",${session.duration},"${session.sessionType}",${session.completed},${session.breaks},${session.focusScore || 'N/A'},${session.understanding || 'N/A'},${session.timestamp}\n`;
        });
        
        csvContent += '\n';
      }

      if (settings.includeFocusSessionData && data.focusSessions && data.focusSessions.length > 0) {
        csvContent += 'FOCUS SESSION DATA\n';
        csvContent += 'Date,Subject,Topic,Duration (min),Target Duration (min),Session Type,Completed,Focus Score,Productivity,Mood,Environment,Interruptions,Timestamp\n';
        
        data.focusSessions.forEach(session => {
          csvContent += `${session.date},"${session.subject || 'N/A'}","${session.topic || 'N/A'}",${Math.round((session.duration || 0) / 60)},${Math.round((session.targetDuration || 0) / 60)},"${session.sessionType}",${session.completed},${session.focusScore || 'N/A'},${session.productivity || 'N/A'},"${session.mood || 'N/A'}","${session.environment || 'N/A'}",${session.interruptions?.length || 0},${session.timestamp}\n`;
        });
        
        csvContent += '\n';
      }

      if (settings.includeAppUsageData && data.appSessions && data.appSessions.length > 0) {
        csvContent += 'APP USAGE DATA\n';
        csvContent += 'Date,Screen,Duration (min),Interactions,Active Time (min),Background Time (min),Timestamp\n';
        
        data.appSessions.forEach(session => {
          csvContent += `${session.date},"${session.screen}",${Math.round((session.duration || 0) / 60)},${session.interactions || 0},${Math.round((session.activeTime || 0) / 60)},${Math.round((session.backgroundTime || 0) / 60)},${session.timestamp}\n`;
        });
      }
      
      if (!csvContent) {
        throw new Error('No data available for export based on current settings');
      }
      
      return csvContent;
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw error;
    }
  }

  // Clear all analytics data
  static async clearAnalyticsData() {
    try {
      await writeJson(ANALYTICS_FILE, {
        plannerEvents: [],
        studySessions: [],
        appSessions: [],
        focusSessions: [],
        breakSessions: [],
        interruptions: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error clearing analytics data:', error);
      return false;
    }
  }
} 