import { AppState } from 'react-native';
import { AnalyticsService } from './analyticsService';

class SessionTracker {
  constructor() {
    this.currentSession = null;
    this.sessionStartTime = null;
    this.currentScreen = 'Unknown';
    this.interactions = 0;
    this.backgroundTime = 0;
    this.backgroundStartTime = null;
    this.isTracking = false;
    this.appStateSubscription = null;
    this.currentUser = null;

    this.handleAppStateChange = this.handleAppStateChange.bind(this);
  }

  setCurrentUser(user) {
    this.currentUser = user || null;
  }

  initialize() {
    if (this.isTracking) return;

    this.isTracking = true;
    this.startSession();
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );
  }

  cleanup() {
    if (!this.isTracking) return;

    this.isTracking = false;
    this.endSession();

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  startSession() {
    this.sessionStartTime = new Date();
    this.interactions = 0;
    this.backgroundTime = 0;
    this.backgroundStartTime = null;
  }

  async endSession() {
    if (!this.sessionStartTime) return null;

    const endTime = new Date();
    const totalDuration = Math.max(
      0,
      Math.round((endTime - this.sessionStartTime) / 1000)
    );
    const activeTime = Math.max(0, totalDuration - this.backgroundTime);

    const sessionData = {
      date: this.sessionStartTime.toISOString().slice(0, 10),
      startTime: this.sessionStartTime.toTimeString().slice(0, 8),
      endTime: endTime.toTimeString().slice(0, 8),
      duration: totalDuration,
      screen: this.currentScreen,
      interactions: this.interactions,
      backgroundTime: this.backgroundTime,
      activeTime,
    };

    try {
      return await AnalyticsService.recordAppSession(
        sessionData,
        this.currentUser
      );
    } catch (error) {
      console.error('Failed to record app session:', error);
      return null;
    } finally {
      this.sessionStartTime = null;
      this.interactions = 0;
      this.backgroundTime = 0;
      this.backgroundStartTime = null;
    }
  }

  handleAppStateChange(nextAppState) {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      this.handleAppGoesToBackground();
    } else if (nextAppState === 'active') {
      this.handleAppComesToForeground();
    }
  }

  handleAppGoesToBackground() {
    if (this.backgroundStartTime) return;
    this.backgroundStartTime = new Date();
  }

  handleAppComesToForeground() {
    if (!this.backgroundStartTime) return;

    const foregroundTime = new Date();
    const backgroundDuration = Math.max(
      0,
      Math.round((foregroundTime - this.backgroundStartTime) / 1000)
    );
    this.backgroundTime += backgroundDuration;
    this.backgroundStartTime = null;
  }

  trackScreenView(screenName) {
    this.currentScreen = screenName || 'Unknown';
  }

  trackInteraction() {
    this.interactions += 1;
  }

  getCurrentSessionStats() {
    if (!this.sessionStartTime) return null;

    const now = new Date();
    const totalDuration = Math.max(
      0,
      Math.round((now - this.sessionStartTime) / 1000)
    );
    const currentBackground = this.backgroundStartTime
      ? Math.max(0, Math.round((now - this.backgroundStartTime) / 1000))
      : 0;
    const backgroundTime = this.backgroundTime + currentBackground;

    return {
      startTime: this.sessionStartTime,
      duration: totalDuration,
      activeTime: Math.max(0, totalDuration - backgroundTime),
      backgroundTime,
      interactions: this.interactions,
      currentScreen: this.currentScreen,
    };
  }

  async resetSession() {
    await this.endSession();
    this.startSession();
  }
}

const sessionTracker = new SessionTracker();
export default sessionTracker;

export class FocusSessionTracker {
  constructor() {
    this.currentFocusSession = null;
    this.sessionStartTime = null;
    this.interruptions = [];
    this.breaks = [];
    this.targetDuration = null;
    this.isActive = false;
    this.currentUser = null;
  }

  setCurrentUser(user) {
    this.currentUser = user || null;
  }

  startFocusSession({
    subject,
    topic,
    targetDuration,
    sessionType = 'deep_work',
    environment = 'quiet',
    mood = 'good',
  }) {
    this.currentFocusSession = {
      id: `focus_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      subject,
      topic,
      sessionType,
      environment,
      mood,
      goals: [],
      goalsCompleted: [],
    };

    this.sessionStartTime = new Date();
    this.targetDuration = targetDuration;
    this.interruptions = [];
    this.breaks = [];
    this.isActive = true;

    return this.currentFocusSession.id;
  }

  async endFocusSession({
    completed = false,
    focusScore = null,
    productivity = null,
    difficulty = null,
    notes = '',
    goalsCompleted = [],
  }) {
    if (!this.currentFocusSession || !this.sessionStartTime) return null;

    const endTime = new Date();
    const actualDuration = Math.max(
      0,
      Math.round((endTime - this.sessionStartTime) / 1000)
    );

    const sessionData = {
      date: this.sessionStartTime.toISOString().slice(0, 10),
      startTime: this.sessionStartTime.toTimeString().slice(0, 8),
      endTime: endTime.toTimeString().slice(0, 8),
      duration: actualDuration,
      targetDuration: this.targetDuration,
      subject: this.currentFocusSession.subject,
      topic: this.currentFocusSession.topic,
      sessionType: this.currentFocusSession.sessionType,
      environment: this.currentFocusSession.environment,
      mood: this.currentFocusSession.mood,
      completed,
      interrupted: this.interruptions.length > 0,
      interruptions: this.interruptions,
      breaks: this.breaks,
      focusScore,
      productivity,
      difficulty,
      notes,
      goals: this.currentFocusSession.goals,
      goalsCompleted:
        goalsCompleted.length > 0
          ? goalsCompleted
          : this.currentFocusSession.goalsCompleted,
    };

    try {
      return await AnalyticsService.recordFocusSession(
        sessionData,
        this.currentUser
      );
    } catch (error) {
      console.error('Failed to record focus session:', error);
      return null;
    } finally {
      this.currentFocusSession = null;
      this.sessionStartTime = null;
      this.targetDuration = null;
      this.interruptions = [];
      this.breaks = [];
      this.isActive = false;
    }
  }

  async recordInterruption({
    reason,
    source = 'external',
    duration = 0,
    resumedSession = true,
  }) {
    if (!this.currentFocusSession) return null;

    const interruption = {
      timestamp: new Date().toISOString(),
      reason,
      source,
      duration,
      resumedSession,
    };

    this.interruptions.push(interruption);

    try {
      await AnalyticsService.recordInterruption(
        {
          sessionId: this.currentFocusSession.id,
          sessionType: 'focus_session',
          ...interruption,
        },
        this.currentUser
      );
    } catch (error) {
      console.error('Failed to record interruption:', error);
    }

    return interruption;
  }

  async recordBreak({
    breakType = 'short',
    activity = '',
    duration = 0,
    restfulness = null,
  }) {
    if (!this.currentFocusSession) return null;

    const breakSession = {
      timestamp: new Date().toISOString(),
      breakType,
      activity,
      duration,
      restfulness,
    };

    this.breaks.push(breakSession);

    try {
      await AnalyticsService.recordBreakSession(
        {
          date: new Date().toISOString().slice(0, 10),
          startTime: new Date(Date.now() - duration * 1000)
            .toTimeString()
            .slice(0, 8),
          endTime: new Date().toTimeString().slice(0, 8),
          duration,
          breakType,
          activity,
          restfulness,
          linkedFocusSessionId: this.currentFocusSession.id,
        },
        this.currentUser
      );
    } catch (error) {
      console.error('Failed to record break session:', error);
    }

    return breakSession;
  }

  addGoal(goal) {
    if (!this.currentFocusSession) return;
    this.currentFocusSession.goals.push(goal);
  }

  completeGoal(goalIndex) {
    if (!this.currentFocusSession?.goals?.[goalIndex]) return;

    const goal = this.currentFocusSession.goals[goalIndex];
    this.currentFocusSession.goalsCompleted.push({
      goal,
      completedAt: new Date().toISOString(),
    });
  }

  getCurrentSessionStatus() {
    if (!this.currentFocusSession || !this.sessionStartTime) return null;

    const elapsed = Math.max(
      0,
      Math.round((new Date() - this.sessionStartTime) / 1000)
    );
    const remaining = this.targetDuration
      ? Math.max(0, this.targetDuration - elapsed)
      : null;

    return {
      sessionId: this.currentFocusSession.id,
      subject: this.currentFocusSession.subject,
      topic: this.currentFocusSession.topic,
      sessionType: this.currentFocusSession.sessionType,
      elapsed,
      remaining,
      targetDuration: this.targetDuration,
      interruptions: this.interruptions.length,
      breaks: this.breaks.length,
      goals: this.currentFocusSession.goals.length,
      goalsCompleted: this.currentFocusSession.goalsCompleted.length,
      isActive: this.isActive,
    };
  }
}

export const focusSessionTracker = new FocusSessionTracker();
