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
    
    // Bind methods
    this.handleAppStateChange = this.handleAppStateChange.bind(this);
  }

  // Initialize session tracking
  initialize() {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.startSession();
    
    // Listen for app state changes (modern React Native way)
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    
    console.log('SessionTracker initialized');
  }

  // Cleanup session tracking
  cleanup() {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    this.endSession();
    
    // Remove app state listener (modern React Native way)
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    
    console.log('SessionTracker cleaned up');
  }

  // Start a new session
  startSession() {
    this.sessionStartTime = new Date();
    this.interactions = 0;
    this.backgroundTime = 0;
    this.backgroundStartTime = null;
    
    console.log('New app session started at', this.sessionStartTime.toISOString());
  }

  // End current session and record it
  async endSession() {
    if (!this.sessionStartTime) return;
    
    const endTime = new Date();
    const totalDuration = Math.round((endTime - this.sessionStartTime) / 1000); // in seconds
    const activeTime = totalDuration - this.backgroundTime;
    
    const sessionData = {
      date: this.sessionStartTime.toISOString().slice(0, 10),
      startTime: this.sessionStartTime.toTimeString().slice(0, 8),
      endTime: endTime.toTimeString().slice(0, 8),
      duration: totalDuration,
      screen: this.currentScreen,
      interactions: this.interactions,
      backgroundTime: this.backgroundTime,
      activeTime: Math.max(0, activeTime),
    };

    try {
      await AnalyticsService.recordAppSession(sessionData);
      console.log('App session recorded:', sessionData);
    } catch (error) {
      console.error('Failed to record app session:', error);
    }

    // Reset session data
    this.sessionStartTime = null;
    this.interactions = 0;
    this.backgroundTime = 0;
    this.backgroundStartTime = null;
  }

  // Handle app state changes (foreground/background)
  handleAppStateChange(nextAppState) {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      this.handleAppGoesToBackground();
    } else if (nextAppState === 'active') {
      this.handleAppComesToForeground();
    }
  }

  // App goes to background
  handleAppGoesToBackground() {
    if (this.backgroundStartTime) return; // Already in background
    
    this.backgroundStartTime = new Date();
    console.log('App went to background at', this.backgroundStartTime.toISOString());
  }

  // App comes to foreground
  handleAppComesToForeground() {
    if (!this.backgroundStartTime) return; // Wasn't in background
    
    const foregroundTime = new Date();
    const backgroundDuration = Math.round((foregroundTime - this.backgroundStartTime) / 1000);
    this.backgroundTime += backgroundDuration;
    this.backgroundStartTime = null;
    
    console.log('App came to foreground, background time:', backgroundDuration, 'seconds');
  }

  // Track screen navigation
  trackScreenView(screenName) {
    this.currentScreen = screenName;
    console.log('Screen changed to:', screenName);
  }

  // Track user interaction
  trackInteraction(interactionType = 'tap') {
    this.interactions++;
    console.log('Interaction tracked:', interactionType, '- Total:', this.interactions);
  }

  // Get current session stats
  getCurrentSessionStats() {
    if (!this.sessionStartTime) return null;
    
    const now = new Date();
    const totalDuration = Math.round((now - this.sessionStartTime) / 1000);
    const activeTime = totalDuration - this.backgroundTime;
    
    return {
      startTime: this.sessionStartTime,
      duration: totalDuration,
      activeTime: Math.max(0, activeTime),
      backgroundTime: this.backgroundTime,
      interactions: this.interactions,
      currentScreen: this.currentScreen,
    };
  }

  // Force end session and start new one (useful for debugging or manual resets)
  async resetSession() {
    await this.endSession();
    this.startSession();
  }
}

// Create singleton instance
const sessionTracker = new SessionTracker();

export default sessionTracker;

// Focus Session Tracker for detailed study sessions
export class FocusSessionTracker {
  constructor() {
    this.currentFocusSession = null;
    this.sessionStartTime = null;
    this.interruptions = [];
    this.breaks = [];
    this.targetDuration = null;
    this.isActive = false;
  }

  // Start a focus session
  startFocusSession({
    subject,
    topic,
    targetDuration, // in seconds
    sessionType = 'deep_work', // 'pomodoro', 'deep_work', 'review', 'practice'
    environment = 'quiet',
    mood = 'good'
  }) {
    this.currentFocusSession = {
      id: Date.now().toString(),
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
    
    console.log('Focus session started:', this.currentFocusSession);
    return this.currentFocusSession.id;
  }

  // End focus session
  async endFocusSession({
    completed = false,
    focusScore = null, // 1-10
    productivity = null, // 1-10
    difficulty = null, // 1-10
    notes = '',
    goalsCompleted = []
  }) {
    if (!this.currentFocusSession || !this.sessionStartTime) {
      console.log('No active focus session to end');
      return null;
    }

    const endTime = new Date();
    const actualDuration = Math.round((endTime - this.sessionStartTime) / 1000);
    
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
      goalsCompleted,
    };

    try {
      const result = await AnalyticsService.recordFocusSession(sessionData);
      console.log('Focus session recorded:', result);
      
      // Reset session
      this.currentFocusSession = null;
      this.sessionStartTime = null;
      this.isActive = false;
      
      return result;
    } catch (error) {
      console.error('Failed to record focus session:', error);
      return null;
    }
  }

  // Record an interruption
  async recordInterruption({
    reason, // 'notification', 'call', 'distraction', 'break', 'emergency'
    source = 'external', // 'internal', 'external'
    duration = 0, // in seconds
    resumedSession = true
  }) {
    if (!this.currentFocusSession) return;

    const interruption = {
      timestamp: new Date().toISOString(),
      reason,
      source,
      duration,
      resumedSession
    };
    
    this.interruptions.push(interruption);
    
    // Also record in analytics
    try {
      await AnalyticsService.recordInterruption({
        sessionId: this.currentFocusSession.id,
        sessionType: 'focus_session',
        ...interruption
      });
    } catch (error) {
      console.error('Failed to record interruption:', error);
    }
    
    console.log('Interruption recorded:', interruption);
  }

  // Record a break
  async recordBreak({
    breakType = 'short', // 'short', 'long', 'meal', 'exercise'
    activity = '',
    duration = 0, // in seconds
    restfulness = null // 1-10
  }) {
    if (!this.currentFocusSession) return;

    const breakSession = {
      timestamp: new Date().toISOString(),
      breakType,
      activity,
      duration,
      restfulness
    };
    
    this.breaks.push(breakSession);
    
    // Also record in analytics
    try {
      await AnalyticsService.recordBreakSession({
        date: new Date().toISOString().slice(0, 10),
        startTime: new Date(Date.now() - duration * 1000).toTimeString().slice(0, 8),
        endTime: new Date().toTimeString().slice(0, 8),
        duration,
        breakType,
        activity,
        restfulness,
        linkedFocusSessionId: this.currentFocusSession.id
      });
    } catch (error) {
      console.error('Failed to record break session:', error);
    }
    
    console.log('Break recorded:', breakSession);
  }

  // Add a goal to current session
  addGoal(goal) {
    if (!this.currentFocusSession) return;
    this.currentFocusSession.goals.push(goal);
  }

  // Mark a goal as completed
  completeGoal(goalIndex) {
    if (!this.currentFocusSession || !this.currentFocusSession.goals[goalIndex]) return;
    
    const goal = this.currentFocusSession.goals[goalIndex];
    this.currentFocusSession.goalsCompleted.push({
      goal,
      completedAt: new Date().toISOString()
    });
  }

  // Get current session status
  getCurrentSessionStatus() {
    if (!this.currentFocusSession || !this.sessionStartTime) return null;
    
    const now = new Date();
    const elapsed = Math.round((now - this.sessionStartTime) / 1000);
    const remaining = this.targetDuration ? Math.max(0, this.targetDuration - elapsed) : null;
    
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

// Export focus session tracker instance
export const focusSessionTracker = new FocusSessionTracker(); 