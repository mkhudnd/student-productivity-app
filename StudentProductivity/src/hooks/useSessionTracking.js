import React, { useEffect, useRef, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import sessionTracker, { focusSessionTracker } from '../utils/SessionTracker';
import { AnalyticsService } from '../utils/analyticsService';
import { useUser } from '../context/UserContext';

// Hook for basic session tracking (no navigation dependency)
export function useBasicSessionTracking() {
  const { currentUser } = useUser();

  useEffect(() => {
    sessionTracker.initialize();
    return () => {
      sessionTracker.cleanup();
    };
  }, []);

  // Keep all analytics/session services aligned with the signed-in user.
  useEffect(() => {
    sessionTracker.setCurrentUser(currentUser);
    focusSessionTracker.setCurrentUser(currentUser);
    AnalyticsService.setCurrentUser(currentUser);
  }, [currentUser]);

  return {
    trackInteraction: sessionTracker.trackInteraction.bind(sessionTracker),
    getCurrentStats: sessionTracker.getCurrentSessionStats.bind(sessionTracker),
    resetSession: sessionTracker.resetSession.bind(sessionTracker),
  };
}

// Hook for automatic app session tracking (with navigation)
export function useSessionTracking() {
  const navigation = useNavigation();
  const { currentUser } = useUser();
  const currentRoute = useRef(null);

  useEffect(() => {
    sessionTracker.initialize();
    return () => {
      sessionTracker.cleanup();
    };
  }, []);

  useEffect(() => {
    sessionTracker.setCurrentUser(currentUser);
    AnalyticsService.setCurrentUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('state', (event) => {
      const routes = event.data.state?.routes;
      if (!routes?.length) return;

      const activeRoute = routes[routes.length - 1];
      const screenName = activeRoute.name;
      if (currentRoute.current !== screenName) {
        currentRoute.current = screenName;
        sessionTracker.trackScreenView(screenName);
      }
    });

    return unsubscribe;
  }, [navigation]);

  return {
    trackInteraction: sessionTracker.trackInteraction.bind(sessionTracker),
    getCurrentStats: sessionTracker.getCurrentSessionStats.bind(sessionTracker),
    resetSession: sessionTracker.resetSession.bind(sessionTracker),
  };
}

// Hook for focus session tracking
export function useFocusSession() {
  const { currentUser } = useUser();
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionStats, setSessionStats] = useState(null);

  useEffect(() => {
    focusSessionTracker.setCurrentUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    const interval = setInterval(() => {
      const stats = focusSessionTracker.getCurrentSessionStatus();
      setSessionStats(stats);
      setCurrentSession(stats);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const startSession = (sessionConfig) => {
    const sessionId = focusSessionTracker.startFocusSession(sessionConfig);
    const stats = focusSessionTracker.getCurrentSessionStatus();
    setCurrentSession(stats);
    setSessionStats(stats);
    return sessionId;
  };

  const endSession = async (sessionResults) => {
    const result = await focusSessionTracker.endFocusSession(sessionResults);
    setCurrentSession(null);
    setSessionStats(null);
    return result;
  };

  const recordInterruption = (interruptionData) =>
    focusSessionTracker.recordInterruption(interruptionData);

  const recordBreak = (breakData) => focusSessionTracker.recordBreak(breakData);

  const addGoal = (goal) => {
    focusSessionTracker.addGoal(goal);
    setSessionStats(focusSessionTracker.getCurrentSessionStatus());
  };

  const completeGoal = (goalIndex) => {
    focusSessionTracker.completeGoal(goalIndex);
    setSessionStats(focusSessionTracker.getCurrentSessionStatus());
  };

  return {
    currentSession,
    sessionStats,
    startSession,
    endSession,
    recordInterruption,
    recordBreak,
    addGoal,
    completeGoal,
    isActive: Boolean(currentSession),
  };
}

// Hook for screen-specific tracking
export function useScreenTracking(screenName) {
  const screenStartTime = useRef(null);
  const interactionCount = useRef(0);

  useFocusEffect(
    React.useCallback(() => {
      screenStartTime.current = new Date();
      interactionCount.current = 0;
      sessionTracker.trackScreenView(screenName);

      return () => {
        if (screenStartTime.current) {
          const duration = Math.round(
            (new Date() - screenStartTime.current) / 1000
          );
          console.log(
            `Screen ${screenName} viewed for ${duration} seconds with ${interactionCount.current} interactions`
          );
        }
      };
    }, [screenName])
  );

  const trackInteraction = (interactionType = 'tap') => {
    interactionCount.current += 1;
    sessionTracker.trackInteraction(interactionType);
  };

  return {
    trackInteraction,
    getScreenTime: () => {
      if (!screenStartTime.current) return 0;
      return Math.round((new Date() - screenStartTime.current) / 1000);
    },
    getInteractionCount: () => interactionCount.current,
  };
}

// Hook for analytics summary
export function useAnalyticsSummary(
  dateRange = 30,
  refreshInterval = 60000,
  currentUser = null
) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!currentUser) {
        setAnalytics(null);
        return;
      }
      const data = await AnalyticsService.getAnalyticsSummary(
        dateRange,
        currentUser
      );
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    const interval = setInterval(loadAnalytics, refreshInterval);
    return () => clearInterval(interval);
  }, [dateRange, refreshInterval, currentUser]);

  return {
    analytics,
    loading,
    error,
    refresh: loadAnalytics,
  };
}

// Hook for session insights
export function useSessionInsights(dateRange = 7, currentUser = null) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInsights = async () => {
      try {
        setLoading(true);
        if (!currentUser) {
          setInsights(null);
          return;
        }
        const data = await AnalyticsService.getSessionInsights(
          dateRange,
          currentUser
        );
        setInsights(data);
      } catch (error) {
        console.error('Error loading session insights:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, [dateRange, currentUser]);

  return {
    insights,
    loading,
    mostProductiveTime: insights?.mostProductiveTime,
    commonInterruptions: insights?.commonInterruptions,
    focusTrends: insights?.focusTrends,
    recommendations: insights?.recommendations || [],
  };
}
