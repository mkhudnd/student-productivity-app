// SessionLinkingService.js
//
// Launch-hardening model:
// - StudyTracker's plannedSessions array is the canonical schedule.
// - This service stores only execution/link state (started/completed metadata).
// - Legacy AsyncStorage and sessionLinks.json records are merged forward.
//
// This removes the previous split-brain model where some links lived in
// AsyncStorage while others lived in sessionLinks.json and neither was
// guaranteed to be created when a calendar session was planned.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsService } from './analyticsService';
import { readJson } from '../storage/fileStorage';

const LEGACY_SESSION_LINKS_FILE = 'sessionLinks.json';

const EXECUTION_FIELDS = [
  'id',
  'plannedSessionId',
  'plannerEventId',
  'status',
  'actualStartTime',
  'actualEndTime',
  'actualDuration',
  'startedAt',
  'completedAt',
  'studySessionId',
  'actualStudySessionId',
  'actualFocusSessionId',
  'efficiency',
  'focusScore',
  'productivity',
  'understanding',
  'notes',
  'updatedAt',
];

export class SessionLinkingService {
  static STATUS = {
    PLANNED: 'planned',
    STARTED: 'started',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  };

  static getStorageKey(currentUser) {
    if (!currentUser?.email) return null;
    return `session_link_state_${currentUser.email}`;
  }

  static getLegacyStorageKey(currentUser) {
    if (!currentUser?.email) return null;
    return `session_links_${currentUser.email}`;
  }

  static getTrackerStorageKey(currentUser) {
    if (!currentUser?.email) return null;
    return `study_tracker_data_${currentUser.email}`;
  }

  static getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static createId(prefix = 'link') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  static async getTrackerData(currentUser) {
    if (!currentUser?.email) return null;

    try {
      const raw = await AsyncStorage.getItem(this.getTrackerStorageKey(currentUser));
      if (!raw) {
        return {
          subjects: [],
          sessions: [],
          goals: { dailyMinutes: 120 },
          plannedSessions: [],
        };
      }

      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        plannedSessions: Array.isArray(parsed.plannedSessions) ? parsed.plannedSessions : [],
      };
    } catch (error) {
      console.error('Error reading study tracker data for session links:', error);
      return null;
    }
  }

  static async saveTrackerData(trackerData, currentUser) {
    if (!currentUser?.email || !trackerData) return false;

    try {
      await AsyncStorage.setItem(
        this.getTrackerStorageKey(currentUser),
        JSON.stringify(trackerData)
      );
      return true;
    } catch (error) {
      console.error('Error saving tracker data for session links:', error);
      return false;
    }
  }

  static stateProjection(link) {
    const projected = {};
    EXECUTION_FIELDS.forEach((field) => {
      if (link[field] !== undefined) projected[field] = link[field];
    });

    projected.id = projected.id || this.createId('link');
    projected.plannedSessionId = projected.plannedSessionId || link.id;
    projected.status = projected.status || this.STATUS.PLANNED;
    projected.updatedAt = new Date().toISOString();
    return projected;
  }

  static dedupeState(items) {
    const byPlannedId = new Map();

    (items || []).forEach((item) => {
      if (!item) return;
      const plannedSessionId = item.plannedSessionId || item.id;
      if (!plannedSessionId) return;

      const normalized = this.stateProjection({
        ...item,
        plannedSessionId,
      });
      const existing = byPlannedId.get(plannedSessionId);

      if (!existing) {
        byPlannedId.set(plannedSessionId, normalized);
        return;
      }

      const existingUpdated = new Date(existing.updatedAt || existing.completedAt || existing.startedAt || 0);
      const candidateUpdated = new Date(
        normalized.updatedAt || normalized.completedAt || normalized.startedAt || 0
      );

      if (candidateUpdated >= existingUpdated) {
        byPlannedId.set(plannedSessionId, { ...existing, ...normalized });
      }
    });

    return Array.from(byPlannedId.values());
  }

  /**
   * Loads canonical execution state and folds in both legacy stores.
   * The merged result is immediately persisted under the new key.
   */
  static async getStoredLinkState(currentUser) {
    if (!currentUser?.email) return [];

    try {
      const canonicalKey = this.getStorageKey(currentUser);
      const legacyKey = this.getLegacyStorageKey(currentUser);

      const [canonicalRaw, legacyRaw, legacyFile] = await Promise.all([
        AsyncStorage.getItem(canonicalKey),
        AsyncStorage.getItem(legacyKey),
        readJson(LEGACY_SESSION_LINKS_FILE).catch(() => null),
      ]);

      const canonical = canonicalRaw ? JSON.parse(canonicalRaw) : [];
      const legacyLocal = legacyRaw ? JSON.parse(legacyRaw) : [];
      const legacyFileForUser = Array.isArray(legacyFile)
        ? legacyFile.filter((item) => item?.userId === currentUser.email)
        : [];

      const merged = this.dedupeState([
        ...(Array.isArray(canonical) ? canonical : []),
        ...(Array.isArray(legacyLocal) ? legacyLocal : []),
        ...legacyFileForUser,
      ]);

      await AsyncStorage.setItem(canonicalKey, JSON.stringify(merged));
      return merged;
    } catch (error) {
      console.error('Error loading session link state:', error);
      return [];
    }
  }

  static async saveStoredLinkState(states, currentUser) {
    if (!currentUser?.email) return false;

    try {
      const normalized = this.dedupeState(states);
      await AsyncStorage.setItem(this.getStorageKey(currentUser), JSON.stringify(normalized));
      return true;
    } catch (error) {
      console.error('Error saving session link state:', error);
      return false;
    }
  }

  static async upsertLinkState(link, currentUser) {
    if (!currentUser?.email || !link) return null;

    const plannedSessionId = link.plannedSessionId || link.id;
    if (!plannedSessionId) return null;

    const states = await this.getStoredLinkState(currentUser);
    const index = states.findIndex((item) => item.plannedSessionId === plannedSessionId);
    const next = this.stateProjection({
      ...(index >= 0 ? states[index] : {}),
      ...link,
      plannedSessionId,
      userId: currentUser.email,
    });

    if (index >= 0) states[index] = next;
    else states.push(next);

    const saved = await this.saveStoredLinkState(states, currentUser);
    return saved ? next : null;
  }

  static calculatePlannedDuration(session) {
    if (Number(session?.plannedDuration) > 0) return Number(session.plannedDuration);
    if (Number(session?.duration) > 0) return Number(session.duration);

    if (session?.startTime && session?.endTime) {
      const [startHour, startMinute] = session.startTime.split(':').map(Number);
      const [endHour, endMinute] = session.endTime.split(':').map(Number);
      if (
        [startHour, startMinute, endHour, endMinute].every((value) => !Number.isNaN(value))
      ) {
        let duration = endHour * 60 + endMinute - (startHour * 60 + startMinute);
        if (duration <= 0) duration += 24 * 60;
        return duration;
      }
    }

    return 60;
  }

  static normalizePlannedSession(plannedSession, subjects, currentUser, state = null) {
    const subject = (subjects || []).find((item) => item.id === plannedSession.subjectId);
    const plannedSessionId = plannedSession.id;

    return {
      id: state?.id || `link_${plannedSessionId}`,
      plannedSessionId,
      userId: currentUser.email,
      plannerEventId: state?.plannerEventId || null,
      subjectId: plannedSession.subjectId,
      subjectName: plannedSession.subjectName || subject?.name || 'Unknown Subject',
      date: plannedSession.date,
      topic: plannedSession.topic || '',
      plannedDuration: this.calculatePlannedDuration(plannedSession),
      targetDuration: this.calculatePlannedDuration(plannedSession),
      targetStartTime: plannedSession.startTime || null,
      targetEndTime: plannedSession.endTime || null,
      status: state?.status || this.STATUS.PLANNED,
      actualStartTime: state?.actualStartTime || null,
      actualEndTime: state?.actualEndTime || null,
      actualDuration: state?.actualDuration ?? null,
      startedAt: state?.startedAt || null,
      completedAt: state?.completedAt || null,
      studySessionId: state?.studySessionId || state?.actualStudySessionId || null,
      actualStudySessionId: state?.actualStudySessionId || state?.studySessionId || null,
      actualFocusSessionId: state?.actualFocusSessionId || null,
      efficiency: state?.efficiency ?? null,
      focusScore: state?.focusScore ?? null,
      productivity: state?.productivity ?? null,
      understanding: state?.understanding ?? null,
      notes: state?.notes || '',
      isRecurring: Boolean(plannedSession.isRecurring),
      recurringType: plannedSession.recurringType || null,
      createdAt: plannedSession.createdAt || null,
      updatedAt: state?.updatedAt || null,
    };
  }

  /**
   * Returns links derived from the actual Study Tracker calendar.
   * There is no second schedule anymore.
   */
  static async getSessionLinks(currentUser = null) {
    if (!currentUser?.email) return [];

    const [trackerData, states] = await Promise.all([
      this.getTrackerData(currentUser),
      this.getStoredLinkState(currentUser),
    ]);

    if (!trackerData) return [];

    const stateByPlannedId = new Map(
      states.map((state) => [state.plannedSessionId, state])
    );

    return trackerData.plannedSessions.map((plannedSession) =>
      this.normalizePlannedSession(
        plannedSession,
        trackerData.subjects,
        currentUser,
        stateByPlannedId.get(plannedSession.id)
      )
    );
  }

  static async saveSessionLinks(sessionLinks, currentUser = null) {
    if (!currentUser?.email) return false;
    return this.saveStoredLinkState(
      (sessionLinks || []).map((link) => this.stateProjection(link)),
      currentUser
    );
  }

  static async createSessionLink(plannedSession, currentUser = null) {
    if (!currentUser?.email || !plannedSession?.id) return null;

    const trackerData = await this.getTrackerData(currentUser);
    if (!trackerData) return null;

    const exists = trackerData.plannedSessions.some((item) => item.id === plannedSession.id);
    if (!exists) {
      trackerData.plannedSessions.push({
        ...plannedSession,
        plannedDuration: this.calculatePlannedDuration(plannedSession),
      });
      await this.saveTrackerData(trackerData, currentUser);
    }

    await this.upsertLinkState(
      {
        plannedSessionId: plannedSession.id,
        status: this.STATUS.PLANNED,
      },
      currentUser
    );

    return this.getSessionLinkByPlannedId(plannedSession.id, currentUser);
  }

  static async updateSessionLink(sessionLink, currentUser = null) {
    if (!currentUser?.email || !sessionLink) return false;
    const saved = await this.upsertLinkState(sessionLink, currentUser);
    return Boolean(saved);
  }

  static async startSession(plannedSessionId, currentUser = null) {
    return this.markSessionAsStarted(plannedSessionId, currentUser);
  }

  static async markSessionAsStarted(plannedSessionId, currentUser = null) {
    if (!currentUser?.email) return null;

    const existing = await this.getSessionLinkByPlannedId(plannedSessionId, currentUser);
    if (!existing) return null;

    await this.upsertLinkState(
      {
        ...existing,
        status: this.STATUS.STARTED,
        actualStartTime: new Date().toTimeString().slice(0, 8),
        startedAt: new Date().toISOString(),
      },
      currentUser
    );

    return this.getSessionLinkByPlannedId(plannedSessionId, currentUser);
  }

  static async completeSession(
    plannedSessionId,
    studySessionId,
    actualDuration,
    currentUser = null
  ) {
    if (!currentUser?.email) return null;

    const existing = await this.getSessionLinkByPlannedId(plannedSessionId, currentUser);
    if (!existing) return null;

    await this.upsertLinkState(
      {
        ...existing,
        status: this.STATUS.COMPLETED,
        actualEndTime: new Date().toTimeString().slice(0, 8),
        actualDuration,
        studySessionId,
        actualStudySessionId: studySessionId,
        completedAt: new Date().toISOString(),
      },
      currentUser
    );

    return this.getSessionLinkByPlannedId(plannedSessionId, currentUser);
  }

  static async resetSessionStatus(plannedSessionId, currentUser = null) {
    if (!currentUser?.email) return null;

    const existing = await this.getSessionLinkByPlannedId(plannedSessionId, currentUser);
    if (!existing) return null;

    await this.upsertLinkState(
      {
        ...existing,
        status: this.STATUS.PLANNED,
        actualStartTime: null,
        actualEndTime: null,
        actualDuration: null,
        startedAt: null,
        completedAt: null,
        studySessionId: null,
        actualStudySessionId: null,
        efficiency: null,
      },
      currentUser
    );

    return this.getSessionLinkByPlannedId(plannedSessionId, currentUser);
  }

  static async createPlannedSession(plannedSessionData, currentUser = null) {
    if (!currentUser?.email) return null;

    const trackerData = await this.getTrackerData(currentUser);
    if (!trackerData) return null;

    const subject = trackerData.subjects.find(
      (item) => item.id === plannedSessionData.subjectId
    );
    const subjectName =
      plannedSessionData.subjectName || subject?.name || 'Unknown Subject';
    const plannedSession = {
      ...plannedSessionData,
      id: plannedSessionData.id || this.createId('planned'),
      plannedDuration: this.calculatePlannedDuration(plannedSessionData),
    };

    const existingIndex = trackerData.plannedSessions.findIndex(
      (item) => item.id === plannedSession.id
    );
    if (existingIndex >= 0) trackerData.plannedSessions[existingIndex] = plannedSession;
    else trackerData.plannedSessions.push(plannedSession);

    const saved = await this.saveTrackerData(trackerData, currentUser);
    if (!saved) return null;

    const plannerEvent = await AnalyticsService.recordPlannerEvent(
      {
        date: plannedSession.date,
        title: `Study: ${subjectName}`,
        startTime: plannedSession.startTime,
        endTime: plannedSession.endTime,
        category: 'study',
        completed: false,
        duration: plannedSession.plannedDuration,
        priority: 'medium',
        subjectId: plannedSession.subjectId,
        subjectName,
        topic: plannedSession.topic,
        plannerType: 'study_session',
        isRecurring: plannedSession.isRecurring,
        recurringType: plannedSession.recurringType,
      },
      currentUser
    );

    await this.upsertLinkState(
      {
        plannedSessionId: plannedSession.id,
        plannerEventId: plannerEvent?.id || null,
        status: this.STATUS.PLANNED,
      },
      currentUser
    );

    return this.getSessionLinkByPlannedId(plannedSession.id, currentUser);
  }

  static async getSubjectSessionLinks(subjectId, dateRange = 30, currentUser = null) {
    if (!currentUser?.email) return [];

    const links = await this.getSessionLinks(currentUser);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - dateRange);
    const cutoffDate = this.getLocalDateString(cutoff);

    return links.filter(
      (link) => link.subjectId === subjectId && link.date >= cutoffDate
    );
  }

  static async getTodayPlannedSessions(currentUser = null) {
    if (!currentUser?.email) return [];

    const links = await this.getSessionLinks(currentUser);
    const today = this.getLocalDateString();

    return links
      .filter(
        (link) =>
          link.date === today &&
          [this.STATUS.PLANNED, this.STATUS.STARTED].includes(link.status)
      )
      .sort((a, b) => (a.targetStartTime || '').localeCompare(b.targetStartTime || ''));
  }

  static async completeLinkedSession(
    {
      plannedSessionId,
      actualDuration,
      sessionType = 'manual',
      focusScore = null,
      productivity = null,
      understanding = null,
      notes = '',
    },
    currentUser = null
  ) {
    if (!currentUser?.email) return null;

    const sessionLink = await this.getSessionLinkByPlannedId(
      plannedSessionId,
      currentUser
    );
    if (!sessionLink) return null;

    const actualDurationMinutes = Math.round((actualDuration || 0) / 60);
    const efficiency = sessionLink.plannedDuration
      ? Math.min(
          100,
          Math.round((actualDurationMinutes / sessionLink.plannedDuration) * 100)
        )
      : null;

    const actualEndTime = new Date().toTimeString().slice(0, 8);
    const studySession = await AnalyticsService.recordStudySession(
      {
        date: sessionLink.date,
        subjectId: sessionLink.subjectId,
        subjectName: sessionLink.subjectName,
        topic: sessionLink.topic || '',
        duration: actualDurationMinutes,
        sessionType,
        completed: true,
        focusScore,
        understanding,
        targetDuration: sessionLink.plannedDuration,
        efficiency,
        linkedPlannerEventId: sessionLink.plannerEventId,
        linkedPlannedSessionId: sessionLink.plannedSessionId,
        actualStartTime: sessionLink.actualStartTime,
        actualEndTime,
      },
      currentUser
    );

    if (sessionLink.plannerEventId) {
      await AnalyticsService.updatePlannerEvent(
        {
          id: sessionLink.plannerEventId,
          completed: true,
          actualStartTime: sessionLink.actualStartTime,
          actualEndTime,
          actualDuration: actualDurationMinutes,
          completionRating: productivity || focusScore || 7,
          linkedStudySessionId: studySession?.id,
        },
        currentUser
      );
    }

    await this.upsertLinkState(
      {
        ...sessionLink,
        status: this.STATUS.COMPLETED,
        completedAt: new Date().toISOString(),
        actualDuration: actualDurationMinutes,
        efficiency,
        notes,
        actualStudySessionId: studySession?.id || null,
        studySessionId: studySession?.id || null,
        actualEndTime,
        focusScore,
        productivity,
        understanding,
      },
      currentUser
    );

    return this.getSessionLinkByPlannedId(plannedSessionId, currentUser);
  }

  static async getSubjectPerformance(subjectId, dateRange = 30, currentUser = null) {
    if (!currentUser?.email) return null;

    const links = await this.getSubjectSessionLinks(subjectId, dateRange, currentUser);
    const plannedSessions = links.filter((link) => link.plannedSessionId);
    const completedSessions = links.filter(
      (link) => link.status === this.STATUS.COMPLETED
    );

    return {
      subjectId,
      totalPlanned: plannedSessions.length,
      totalCompleted: completedSessions.length,
      completionRate: plannedSessions.length
        ? Math.round((completedSessions.length / plannedSessions.length) * 100)
        : 0,
      averageEfficiency: this.calculateAverage(completedSessions, 'efficiency'),
      averageFocusScore: this.calculateAverage(completedSessions, 'focusScore'),
      averageProductivity: this.calculateAverage(completedSessions, 'productivity'),
      averageUnderstanding: this.calculateAverage(completedSessions, 'understanding'),
      totalStudyTime: completedSessions.reduce(
        (sum, session) => sum + (session.actualDuration || 0),
        0
      ),
      averageSessionTime: completedSessions.length
        ? Math.round(
            completedSessions.reduce(
              (sum, session) => sum + (session.actualDuration || 0),
              0
            ) / completedSessions.length
          )
        : 0,
      recentSessions: completedSessions.slice(-5).reverse(),
    };
  }

  static async updatePlannerEvent(eventUpdate, currentUser = null) {
    return AnalyticsService.updatePlannerEvent(eventUpdate, currentUser);
  }

  static async saveSessionLink(sessionLink, currentUser = null) {
    if (!currentUser?.email) return null;
    const state = await this.upsertLinkState(sessionLink, currentUser);
    return state ? this.getSessionLinkByPlannedId(state.plannedSessionId, currentUser) : null;
  }

  static async getSessionLink(sessionLinkId, currentUser = null) {
    if (!currentUser?.email) return null;
    const links = await this.getSessionLinks(currentUser);
    return links.find((link) => link.id === sessionLinkId) || null;
  }

  static async getSessionLinkByPlannedId(plannedSessionId, currentUser = null) {
    if (!currentUser?.email) return null;
    const links = await this.getSessionLinks(currentUser);
    return (
      links.find((link) => link.plannedSessionId === plannedSessionId) || null
    );
  }

  static async getAllSessionLinks(currentUser = null) {
    return this.getSessionLinks(currentUser);
  }

  static calculateAverage(sessions, field) {
    const values = sessions
      .map((session) => session[field])
      .filter(
        (value) => value !== null && value !== undefined && !Number.isNaN(Number(value))
      )
      .map(Number);

    if (!values.length) return null;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  }
}
