import { readJson, writeJson } from '../storage/fileStorage';

const ANALYTICS_FILE = 'analytics.json';
const EXPORT_SETTINGS_FILE = 'exportSettings.json';

const DEFAULT_EXPORT_SETTINGS = {
  includePlannerData: true,
  includeTrackerData: true,
  includeAppUsageData: true,
  includeFocusSessionData: true,
  plannerNotifications: false,
  trackerNotifications: false,
};

const COLLECTIONS = [
  'plannerEvents',
  'studySessions',
  'appSessions',
  'focusSessions',
  'breakSessions',
  'interruptions',
];

const nowIso = () => new Date().toISOString();

export class AnalyticsService {
  static currentUser = null;

  static setCurrentUser(user) {
    this.currentUser = user || null;
  }

  static createEmptyData() {
    const now = nowIso();
    return {
      plannerEvents: [],
      studySessions: [],
      appSessions: [],
      focusSessions: [],
      breakSessions: [],
      interruptions: [],
      createdAt: now,
      lastUpdated: now,
    };
  }

  static normalizeData(data) {
    const normalized = {
      ...this.createEmptyData(),
      ...(data || {}),
    };

    COLLECTIONS.forEach((key) => {
      normalized[key] = Array.isArray(normalized[key]) ? normalized[key] : [];
    });

    return normalized;
  }

  /**
   * Internal raw read. Never expose this object directly to UI code.
   * Writes must always start from the complete raw dataset so one user's
   * operation cannot overwrite another user's records.
   */
  static async readAllAnalyticsData() {
    try {
      const data = await readJson(ANALYTICS_FILE);
      return this.normalizeData(data);
    } catch (error) {
      console.error('Error reading analytics data:', error);
      return this.createEmptyData();
    }
  }

  static async writeAllAnalyticsData(data) {
    const normalized = this.normalizeData(data);
    normalized.lastUpdated = nowIso();
    await writeJson(ANALYTICS_FILE, normalized);
    return normalized;
  }

  static resolveUser(currentUser = null) {
    return currentUser || this.currentUser || null;
  }

  static createId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  static async appendRecord(collection, record) {
    const analytics = await this.readAllAnalyticsData();
    analytics[collection].push(record);
    await this.writeAllAnalyticsData(analytics);
    return record;
  }

  static async getExportSettings() {
    try {
      const settings = await readJson(EXPORT_SETTINGS_FILE);
      return { ...DEFAULT_EXPORT_SETTINGS, ...(settings || {}) };
    } catch (error) {
      return DEFAULT_EXPORT_SETTINGS;
    }
  }

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

  static async recordAppSession(sessionData, currentUser = null) {
    try {
      const user = this.resolveUser(currentUser);
      const session = {
        ...sessionData,
        id: this.createId('app'),
        type: 'app_usage',
        timestamp: nowIso(),
        date: sessionData.date || new Date().toISOString().slice(0, 10),
        interactions: sessionData.interactions || 0,
        backgroundTime: sessionData.backgroundTime || 0,
        activeTime: sessionData.activeTime ?? sessionData.duration ?? 0,
        userId: user?.email || 'anonymous',
      };

      return await this.appendRecord('appSessions', session);
    } catch (error) {
      console.error('Error recording app session:', error);
      return null;
    }
  }

  static async recordFocusSession(sessionData, currentUser = null) {
    try {
      const user = this.resolveUser(currentUser);
      const session = {
        ...sessionData,
        id: this.createId('focus'),
        type: 'focus_session',
        timestamp: nowIso(),
        date: sessionData.date || new Date().toISOString().slice(0, 10),
        completed: Boolean(sessionData.completed),
        interrupted: Boolean(sessionData.interrupted),
        interruptions: Array.isArray(sessionData.interruptions) ? sessionData.interruptions : [],
        breaks: Array.isArray(sessionData.breaks) ? sessionData.breaks : [],
        goals: Array.isArray(sessionData.goals) ? sessionData.goals : [],
        goalsCompleted: Array.isArray(sessionData.goalsCompleted) ? sessionData.goalsCompleted : [],
        notes: sessionData.notes || '',
        userId: user?.email || 'anonymous',
      };

      return await this.appendRecord('focusSessions', session);
    } catch (error) {
      console.error('Error recording focus session:', error);
      return null;
    }
  }

  static async recordBreakSession(sessionData, currentUser = null) {
    try {
      const user = this.resolveUser(currentUser);
      const breakSession = {
        ...sessionData,
        id: this.createId('break'),
        type: 'break_session',
        timestamp: nowIso(),
        date: sessionData.date || new Date().toISOString().slice(0, 10),
        userId: user?.email || 'anonymous',
      };

      return await this.appendRecord('breakSessions', breakSession);
    } catch (error) {
      console.error('Error recording break session:', error);
      return null;
    }
  }

  static async recordInterruption(interruptionData, currentUser = null) {
    try {
      const user = this.resolveUser(currentUser);
      const interruption = {
        ...interruptionData,
        id: this.createId('interrupt'),
        timestamp: interruptionData.timestamp || nowIso(),
        resumedSession: Boolean(interruptionData.resumedSession),
        userId: user?.email || 'anonymous',
      };

      return await this.appendRecord('interruptions', interruption);
    } catch (error) {
      console.error('Error recording interruption:', error);
      return null;
    }
  }

  static async recordPlannerEvent(eventData, currentUser = null) {
    try {
      const user = this.resolveUser(currentUser);
      if (!user?.email) {
        console.error('No current user provided for recording planner event');
        return null;
      }

      const event = {
        ...eventData,
        id: this.createId('planner'),
        type: 'planner',
        timestamp: nowIso(),
        category: eventData.category || 'general',
        completed: Boolean(eventData.completed),
        duration: eventData.duration || 0,
        userId: user.email,
      };

      return await this.appendRecord('plannerEvents', event);
    } catch (error) {
      console.error('Error recording planner event:', error);
      return null;
    }
  }

  static async updatePlannerEvent(eventUpdate, currentUser = null) {
    try {
      const user = this.resolveUser(currentUser);
      if (!user?.email || !eventUpdate?.id) return null;

      const analytics = await this.readAllAnalyticsData();
      const eventIndex = analytics.plannerEvents.findIndex(
        (event) => event.id === eventUpdate.id && event.userId === user.email
      );

      if (eventIndex === -1) return null;

      analytics.plannerEvents[eventIndex] = {
        ...analytics.plannerEvents[eventIndex],
        ...eventUpdate,
        userId: user.email,
        lastUpdated: nowIso(),
      };

      await this.writeAllAnalyticsData(analytics);
      return analytics.plannerEvents[eventIndex];
    } catch (error) {
      console.error('Error updating planner event:', error);
      return null;
    }
  }

  static async recordStudySession(sessionData, currentUser = null) {
    try {
      const user = this.resolveUser(currentUser);
      if (!user?.email) {
        console.error('No current user provided for recording study session');
        return null;
      }

      const session = {
        ...sessionData,
        id: this.createId('study'),
        type: 'study',
        timestamp: nowIso(),
        sessionType: sessionData.sessionType || 'manual',
        completed: Boolean(sessionData.completed),
        focusScore: sessionData.focusScore ?? null,
        breaks: sessionData.breaks ?? 0,
        materials: Array.isArray(sessionData.materials) ? sessionData.materials : [],
        userId: user.email,
      };

      return await this.appendRecord('studySessions', session);
    } catch (error) {
      console.error('Error recording study session:', error);
      return null;
    }
  }

  static async updateLastUpdated(analytics) {
    analytics.lastUpdated = nowIso();
    return analytics;
  }

  /**
   * User-facing read. With no authenticated user we intentionally return an
   * empty dataset instead of leaking records belonging to another local user.
   */
  static async getAnalyticsData(currentUser = null) {
    try {
      const user = this.resolveUser(currentUser);
      const data = await this.readAllAnalyticsData();

      if (!user?.email) {
        return {
          ...this.createEmptyData(),
          createdAt: data.createdAt,
          lastUpdated: data.lastUpdated,
        };
      }

      return {
        ...data,
        plannerEvents: data.plannerEvents.filter((event) => event.userId === user.email),
        studySessions: data.studySessions.filter((session) => session.userId === user.email),
        appSessions: data.appSessions.filter((session) => session.userId === user.email),
        focusSessions: data.focusSessions.filter((session) => session.userId === user.email),
        breakSessions: data.breakSessions.filter((session) => session.userId === user.email),
        interruptions: data.interruptions.filter((item) => item.userId === user.email),
      };
    } catch (error) {
      console.error('Error getting analytics data:', error);
      return this.createEmptyData();
    }
  }

  static async getAnalyticsSummary(dateRange = 30, currentUser = null) {
    try {
      const data = await this.getAnalyticsData(currentUser);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - dateRange);

      const recentEvents = data.plannerEvents.filter(
        (event) => new Date(event.timestamp) >= cutoffDate
      );
      const recentSessions = data.studySessions.filter(
        (session) => new Date(session.timestamp) >= cutoffDate
      );
      const recentAppSessions = data.appSessions.filter(
        (session) => new Date(session.timestamp) >= cutoffDate
      );
      const recentFocusSessions = data.focusSessions.filter(
        (session) => new Date(session.timestamp) >= cutoffDate
      );
      const recentInterruptions = data.interruptions.filter(
        (item) => new Date(item.timestamp) >= cutoffDate
      );

      const plannerStats = {
        totalEvents: recentEvents.length,
        completedEvents: recentEvents.filter((event) => event.completed).length,
        totalPlannedTime: recentEvents.reduce((sum, event) => sum + (event.duration || 0), 0),
        completionRate: recentEvents.length
          ? Math.round((recentEvents.filter((event) => event.completed).length / recentEvents.length) * 100)
          : 0,
        averageCompletionRating: this.calculateAverageRating(recentEvents, 'completionRating'),
      };

      const studyStats = {
        totalSessions: recentSessions.length,
        totalStudyTime: recentSessions.reduce((sum, session) => sum + (session.duration || 0), 0),
        averageSessionTime: recentSessions.length
          ? Math.round(
              recentSessions.reduce((sum, session) => sum + (session.duration || 0), 0) /
                recentSessions.length
            )
          : 0,
        subjectBreakdown: this.getSubjectBreakdown(recentSessions),
        streakDays: this.calculateStreakDays(recentSessions),
        averageFocusScore: this.calculateAverageRating(recentSessions, 'focusScore'),
        averageUnderstanding: this.calculateAverageRating(recentSessions, 'understanding'),
      };

      const appStats = {
        totalSessions: recentAppSessions.length,
        totalAppTime: recentAppSessions.reduce((sum, session) => sum + (session.duration || 0), 0),
        averageSessionTime: recentAppSessions.length
          ? Math.round(
              recentAppSessions.reduce((sum, session) => sum + (session.duration || 0), 0) /
                recentAppSessions.length
            )
          : 0,
        screenBreakdown: this.getScreenBreakdown(recentAppSessions),
        totalInteractions: recentAppSessions.reduce(
          (sum, session) => sum + (session.interactions || 0),
          0
        ),
      };

      const focusStats = {
        totalSessions: recentFocusSessions.length,
        totalFocusTime: recentFocusSessions.reduce((sum, session) => sum + (session.duration || 0), 0),
        completedSessions: recentFocusSessions.filter((session) => session.completed).length,
        averageFocusScore: this.calculateAverageRating(recentFocusSessions, 'focusScore'),
        averageProductivity: this.calculateAverageRating(recentFocusSessions, 'productivity'),
        totalInterruptions: recentInterruptions.length,
        averageBreaksPerSession: recentFocusSessions.length
          ? recentFocusSessions.reduce(
              (sum, session) =>
                sum + (Array.isArray(session.breaks) ? session.breaks.length : Number(session.breaks || 0)),
              0
            ) / recentFocusSessions.length
          : 0,
      };

      return {
        dateRange,
        planner: plannerStats,
        study: studyStats,
        app: appStats,
        focus: focusStats,
        combined: {
          totalActivities:
            plannerStats.totalEvents + studyStats.totalSessions + focusStats.totalSessions,
          totalTime:
            plannerStats.totalPlannedTime + studyStats.totalStudyTime + focusStats.totalFocusTime,
          productivityScore: this.calculateProductivityScore(
            plannerStats,
            studyStats,
            focusStats
          ),
        },
      };
    } catch (error) {
      console.error('Error getting analytics summary:', error);
      return null;
    }
  }

  static calculateAverageRating(items, field) {
    const validRatings = items
      .map((item) => item[field])
      .filter((rating) => rating !== null && rating !== undefined && !Number.isNaN(Number(rating)))
      .map(Number);

    if (!validRatings.length) return null;
    return Math.round((validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length) * 10) / 10;
  }

  static getScreenBreakdown(appSessions) {
    const breakdown = {};
    appSessions.forEach((session) => {
      const screen = session.screen || 'Unknown';
      if (!breakdown[screen]) {
        breakdown[screen] = { count: 0, totalTime: 0, totalInteractions: 0 };
      }
      breakdown[screen].count += 1;
      breakdown[screen].totalTime += session.duration || 0;
      breakdown[screen].totalInteractions += session.interactions || 0;
    });
    return breakdown;
  }

  static calculateProductivityScore(plannerStats, studyStats, focusStats) {
    let score = plannerStats.completionRate * 0.3;

    if (studyStats.totalStudyTime > 0) {
      score += Math.min(30, (studyStats.totalStudyTime / 240) * 30);
    }

    if (focusStats.totalSessions > 0) {
      const focusCompletion =
        (focusStats.completedSessions / focusStats.totalSessions) * 100;
      score += focusCompletion * 0.25;
    }

    if ((plannerStats.averageCompletionRating || 0) >= 8) score += 5;
    if ((studyStats.averageFocusScore || 0) >= 8) score += 5;
    if ((focusStats.averageProductivity || 0) >= 8) score += 5;

    return Math.min(100, Math.round(score));
  }

  static getSubjectBreakdown(sessions) {
    const breakdown = {};
    sessions.forEach((session) => {
      const subject = session.subjectName || 'Unknown';
      if (!breakdown[subject]) breakdown[subject] = { count: 0, totalTime: 0 };
      breakdown[subject].count += 1;
      breakdown[subject].totalTime += session.duration || 0;
    });
    return breakdown;
  }

  static calculateStreakDays(sessions) {
    if (!sessions.length) return 0;

    const dates = [...new Set(sessions.map((session) => session.date))].sort().reverse();
    let streak = 0;

    for (let i = 0; i < dates.length; i += 1) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      const expectedDateString = expectedDate.toISOString().slice(0, 10);
      if (dates[i] !== expectedDateString) break;
      streak += 1;
    }

    return streak;
  }

  static async getSessionInsights(dateRange = 7, currentUser = null) {
    try {
      const data = await this.getAnalyticsData(currentUser);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - dateRange);

      const recentFocusSessions = data.focusSessions.filter(
        (session) => new Date(session.timestamp) >= cutoffDate
      );
      const recentInterruptions = data.interruptions.filter(
        (item) => new Date(item.timestamp) >= cutoffDate
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

  static findMostProductiveTimeSlot(focusSessions) {
    const timeSlots = {};

    focusSessions.forEach((session) => {
      if (!session.startTime || session.productivity === null || session.productivity === undefined) return;
      const hour = Number(session.startTime.split(':')[0]);
      if (Number.isNaN(hour)) return;
      const timeSlot = `${hour}:00-${hour + 1}:00`;
      if (!timeSlots[timeSlot]) {
        timeSlots[timeSlot] = { sessions: 0, totalProductivity: 0, averageProductivity: 0 };
      }
      timeSlots[timeSlot].sessions += 1;
      timeSlots[timeSlot].totalProductivity += Number(session.productivity) || 0;
      timeSlots[timeSlot].averageProductivity =
        timeSlots[timeSlot].totalProductivity / timeSlots[timeSlot].sessions;
    });

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

  static analyzeInterruptions(interruptions) {
    const reasonCounts = {};
    const sourceCounts = {};

    interruptions.forEach((item) => {
      reasonCounts[item.reason] = (reasonCounts[item.reason] || 0) + 1;
      sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
    });

    return {
      totalInterruptions: interruptions.length,
      commonReasons: Object.entries(reasonCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3),
      commonSources: Object.entries(sourceCounts).sort(([, a], [, b]) => b - a),
      averageDuration: interruptions.length
        ? interruptions.reduce((sum, item) => sum + (item.duration || 0), 0) /
          interruptions.length
        : 0,
    };
  }

  static analyzeFocusTrends(focusSessions) {
    if (!focusSessions.length) return null;

    const sortedSessions = [...focusSessions].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    const focusScores = sortedSessions
      .map((session) => session.focusScore)
      .filter((score) => score !== null && score !== undefined)
      .map(Number);
    const productivityScores = sortedSessions
      .map((session) => session.productivity)
      .filter((score) => score !== null && score !== undefined)
      .map(Number);

    return {
      focusTrend: this.calculateTrend(focusScores),
      productivityTrend: this.calculateTrend(productivityScores),
      completionRate:
        (sortedSessions.filter((session) => session.completed).length / sortedSessions.length) * 100,
      averageSessionLength:
        sortedSessions.reduce((sum, session) => sum + (session.duration || 0), 0) /
        sortedSessions.length,
    };
  }

  static calculateTrend(scores) {
    if (scores.length < 2) return 'insufficient_data';
    const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    const firstAverage = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAverage =
      secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    const difference = secondAverage - firstAverage;
    if (difference > 0.5) return 'improving';
    if (difference < -0.5) return 'declining';
    return 'stable';
  }

  static generateRecommendations(focusSessions, interruptions) {
    const recommendations = [];
    const averageDuration = focusSessions.length
      ? focusSessions.reduce((sum, session) => sum + (session.duration || 0), 0) /
        focusSessions.length
      : 0;

    if (averageDuration > 0 && averageDuration < 1800) {
      recommendations.push({
        type: 'session_length',
        message: 'Consider longer focus sessions (30-45 minutes) for better deep work.',
        priority: 'medium',
      });
    }

    if (interruptions.length > focusSessions.length * 0.5) {
      recommendations.push({
        type: 'interruptions',
        message: 'High interruption rate detected. Consider turning off notifications during focus time.',
        priority: 'high',
      });
    }

    const completionRate = focusSessions.length
      ? (focusSessions.filter((session) => session.completed).length / focusSessions.length) * 100
      : 100;

    if (focusSessions.length && completionRate < 70) {
      recommendations.push({
        type: 'completion',
        message: 'Low session completion rate. Try breaking tasks into smaller chunks.',
        priority: 'high',
      });
    }

    return recommendations;
  }

  static escapeCsv(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  static async exportToCSV(currentUser = null) {
    try {
      const user = this.resolveUser(currentUser);
      if (!user?.email) {
        throw new Error('Sign in before exporting your study data.');
      }

      const settings = await this.getExportSettings();
      const data = await this.getAnalyticsData(user);
      let csvContent = '';

      if (settings.includePlannerData && data.plannerEvents.length) {
        csvContent += 'DAILY PLANNER DATA\n';
        csvContent += 'Date,Title,Start Time,End Time,Duration (min),Category,Completed,Priority,Completion Rating,Timestamp\n';
        data.plannerEvents.forEach((event) => {
          csvContent += [
            event.date,
            this.escapeCsv(event.title),
            event.startTime || '',
            event.endTime || '',
            event.duration || 0,
            this.escapeCsv(event.category),
            event.completed,
            this.escapeCsv(event.priority || 'N/A'),
            event.completionRating ?? 'N/A',
            event.timestamp,
          ].join(',') + '\n';
        });
        csvContent += '\n';
      }

      if (settings.includeTrackerData && data.studySessions.length) {
        csvContent += 'STUDY TRACKER DATA\n';
        csvContent += 'Date,Subject,Topic,Duration (min),Session Type,Completed,Breaks,Focus Score,Understanding,Timestamp\n';
        data.studySessions.forEach((session) => {
          csvContent += [
            session.date,
            this.escapeCsv(session.subjectName),
            this.escapeCsv(session.topic),
            session.duration || 0,
            this.escapeCsv(session.sessionType),
            session.completed,
            Array.isArray(session.breaks) ? session.breaks.length : session.breaks || 0,
            session.focusScore ?? 'N/A',
            session.understanding ?? 'N/A',
            session.timestamp,
          ].join(',') + '\n';
        });
        csvContent += '\n';
      }

      if (settings.includeFocusSessionData && data.focusSessions.length) {
        csvContent += 'FOCUS SESSION DATA\n';
        csvContent += 'Date,Subject,Topic,Duration (min),Target Duration (min),Session Type,Completed,Focus Score,Productivity,Mood,Environment,Interruptions,Timestamp\n';
        data.focusSessions.forEach((session) => {
          csvContent += [
            session.date,
            this.escapeCsv(session.subject || 'N/A'),
            this.escapeCsv(session.topic || 'N/A'),
            Math.round((session.duration || 0) / 60),
            Math.round((session.targetDuration || 0) / 60),
            this.escapeCsv(session.sessionType),
            session.completed,
            session.focusScore ?? 'N/A',
            session.productivity ?? 'N/A',
            this.escapeCsv(session.mood || 'N/A'),
            this.escapeCsv(session.environment || 'N/A'),
            Array.isArray(session.interruptions) ? session.interruptions.length : 0,
            session.timestamp,
          ].join(',') + '\n';
        });
        csvContent += '\n';
      }

      if (settings.includeAppUsageData && data.appSessions.length) {
        csvContent += 'APP USAGE DATA\n';
        csvContent += 'Date,Screen,Duration (min),Interactions,Active Time (min),Background Time (min),Timestamp\n';
        data.appSessions.forEach((session) => {
          csvContent += [
            session.date,
            this.escapeCsv(session.screen),
            Math.round((session.duration || 0) / 60),
            session.interactions || 0,
            Math.round((session.activeTime || 0) / 60),
            Math.round((session.backgroundTime || 0) / 60),
            session.timestamp,
          ].join(',') + '\n';
        });
      }

      if (!csvContent) {
        throw new Error('No data available for export based on your current settings.');
      }

      return csvContent;
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw error;
    }
  }

  static async clearAnalyticsData(currentUser = null) {
    try {
      const user = currentUser ? this.resolveUser(currentUser) : null;

      if (!user?.email) {
        await writeJson(ANALYTICS_FILE, this.createEmptyData());
        return true;
      }

      const analytics = await this.readAllAnalyticsData();
      COLLECTIONS.forEach((key) => {
        analytics[key] = analytics[key].filter((item) => item.userId !== user.email);
      });
      await this.writeAllAnalyticsData(analytics);
      return true;
    } catch (error) {
      console.error('Error clearing analytics data:', error);
      return false;
    }
  }
}
