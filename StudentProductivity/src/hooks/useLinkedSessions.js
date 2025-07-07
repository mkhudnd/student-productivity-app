import { useState, useEffect, useCallback } from 'react';
import { SessionLinkingService } from '../utils/SessionLinkingService';
import { useUser } from '../context/UserContext';

export function useLinkedSessions() {
  const { currentUser } = useUser();
  const [todayPlannedSessions, setTodayPlannedSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTodayPlannedSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const sessions = await SessionLinkingService.getTodayPlannedSessions(currentUser);
      setTodayPlannedSessions(sessions);
    } catch (err) {
      console.error('Error loading today\'s planned sessions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const markSessionAsStarted = useCallback(async (plannedSessionId) => {
    try {
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
  }, [currentUser]);

  const completeLinkedSession = useCallback(async (sessionData) => {
    try {
      const completedSession = await SessionLinkingService.completeLinkedSession(sessionData, currentUser);
      if (completedSession) {
        setTodayPlannedSessions(prev => 
          prev.map(session => 
            session.plannedSessionId === sessionData.plannedSessionId 
              ? { ...session, status: 'completed', actualDuration: completedSession.actualDuration }
              : session
          )
        );
      }
      return completedSession;
    } catch (err) {
      console.error('Error completing linked session:', err);
      setError(err.message);
      return null;
    }
  }, [currentUser]);

  useEffect(() => {
    loadTodayPlannedSessions();
  }, [loadTodayPlannedSessions]);

  return {
    todayPlannedSessions,
    loading,
    error,
    refreshSessions: loadTodayPlannedSessions,
    markSessionAsStarted,
    completeLinkedSession,
  };
}

export function useSubjectPerformance(subjectId, dateRange = 30) {
  const { currentUser } = useUser();
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadSubjectPerformance = useCallback(async () => {
    if (!subjectId) return;
    
    try {
      setLoading(true);
      setError(null);
      const performanceData = await SessionLinkingService.getSubjectPerformance(subjectId, dateRange, currentUser);
      setPerformance(performanceData);
    } catch (err) {
      console.error('Error loading subject performance:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [subjectId, dateRange, currentUser]);

  useEffect(() => {
    loadSubjectPerformance();
  }, [loadSubjectPerformance]);

  return {
    performance,
    loading,
    error,
    refreshPerformance: loadSubjectPerformance,
  };
}

export function useSubjectSessionLinks(subjectId, dateRange = 30) {
  const { currentUser } = useUser();
  const [sessionLinks, setSessionLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadSessionLinks = useCallback(async () => {
    if (!subjectId) return;
    
    try {
      setLoading(true);
      setError(null);
      const links = await SessionLinkingService.getSubjectSessionLinks(subjectId, dateRange, currentUser);
      setSessionLinks(links);
    } catch (err) {
      console.error('Error loading subject session links:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [subjectId, dateRange, currentUser]);

  useEffect(() => {
    loadSessionLinks();
  }, [loadSessionLinks]);

  return {
    sessionLinks,
    loading,
    error,
    refreshLinks: loadSessionLinks,
  };
} 