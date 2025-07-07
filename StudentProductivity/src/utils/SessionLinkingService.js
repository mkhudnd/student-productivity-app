// SessionLinkingService.js - Links planned calendar sessions to actual study sessions
// This service provides:
// - Connection between calendar events and study tracker sessions
// - Status management for planned sessions (planned → started → completed)
// - Real-time session tracking and updates
// - User-specific session data isolation and storage
// - Integration with reward system for planned session bonuses

import { AnalyticsService } from './analyticsService';
import { readJson, writeJson } from '../storage/fileStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_LINKS_FILE = 'sessionLinks.json';

export class SessionLinkingService {
  // Create user-specific storage key for session link data isolation
  // Each user's session links are stored separately to prevent data conflicts
  static getStorageKey(currentUser) {
    if (!currentUser || !currentUser.email) return 'session_links';
    return `session_links_${currentUser.email}`;
  }

  // Session Status Constants - defines the lifecycle of planned sessions
  static STATUS = {
    PLANNED: 'planned',     // Session is scheduled but not started
    STARTED: 'started',     // Session has begun but not completed
    COMPLETED: 'completed', // Session has been finished and saved
    CANCELLED: 'cancelled'  // Session was cancelled before completion
  };

  // Data Management Functions - handle loading and saving session link data
  
  // Load all session links for the current user from AsyncStorage
  static async getSessionLinks(currentUser = null) {
    try {
      if (!currentUser) {
        console.warn('No current user provided for session links');
        return [];
      }
      
      const storageKey = this.getStorageKey(currentUser);
      const data = await AsyncStorage.getItem(storageKey);
      
      if (data) {
        const sessionLinks = JSON.parse(data);
        // Ensure data is an array and contains valid session links
        return Array.isArray(sessionLinks) ? sessionLinks : [];
      }
      
      return []; // Return empty array if no data found
    } catch (error) {
      console.error('Error loading session links:', error);
      return [];
    }
  }

  // Save session links to AsyncStorage for the current user
  static async saveSessionLinks(sessionLinks, currentUser = null) {
    try {
      if (!currentUser) {
        console.error('No current user provided for saving session links');
        return false;
      }
      
      const storageKey = this.getStorageKey(currentUser);
      await AsyncStorage.setItem(storageKey, JSON.stringify(sessionLinks));
      return true;
    } catch (error) {
      console.error('Error saving session links:', error);
      return false;
    }
  }

  // Planned Session Management - handle creation and management of planned sessions
  
  // Create a new planned session link from calendar data
  // Converts calendar events into trackable study sessions
  static async createSessionLink(plannedSession, currentUser = null) {
    try {
      if (!currentUser) {
        console.error('No current user provided for creating session link');
        return null;
      }

      // Generate unique ID for the session link
      const sessionLink = {
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
        plannedSessionId: plannedSession.id,
        userId: currentUser.email,
        
        // Copy planned session details
        subjectId: plannedSession.subjectId,
        topic: plannedSession.topic || '',
        targetStartTime: plannedSession.startTime,
        targetEndTime: plannedSession.endTime,
        targetDuration: plannedSession.duration || 60, // Default 60 minutes
        
        // Session tracking fields
        status: this.STATUS.PLANNED,
        actualStartTime: null,
        actualEndTime: null,
        actualDuration: null,
        studySessionId: null, // Links to completed study session
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: plannedSession.notes || '',
      };

      // Load existing session links and add the new one
      const existingLinks = await this.getSessionLinks(currentUser);
      const updatedLinks = [...existingLinks, sessionLink];
      
      // Save updated links
      const saved = await this.saveSessionLinks(updatedLinks, currentUser);
      
      if (saved) {
        console.log('Created session link:', sessionLink.id);
        return sessionLink;
      } else {
        console.error('Failed to save session link');
        return null;
      }
    } catch (error) {
      console.error('Error creating session link:', error);
      return null;
    }
  }

  // Update an existing session link with new data
  static async updateSessionLink(sessionLink, currentUser = null) {
    try {
      if (!currentUser) {
        console.error('No current user provided for updating session link');
        return false;
      }

      const sessionLinks = await this.getSessionLinks(currentUser);
      const updatedLinks = sessionLinks.map(link =>
        link.id === sessionLink.id 
          ? { ...sessionLink, updatedAt: new Date().toISOString() }
          : link
      );

      return await this.saveSessionLinks(updatedLinks, currentUser);
    } catch (error) {
      console.error('Error updating session link:', error);
      return false;
    }
  }

  // Session Status Management - handle transitions between session states
  
  // Start a planned session - transition from 'planned' to 'started'
  static async startSession(plannedSessionId, currentUser = null) {
    try {
      if (!currentUser) {
        console.error('No current user provided for starting session');
        return null;
      }

      const sessionLinks = await this.getSessionLinks(currentUser);
      const sessionLink = sessionLinks.find(link => 
        link.plannedSessionId === plannedSessionId && 
        link.userId === currentUser.email
      );

      if (!sessionLink) {
        console.error('Session link not found for planned session:', plannedSessionId);
        return null;
      }

      // Update session to started status
      sessionLink.status = this.STATUS.STARTED;
      sessionLink.actualStartTime = new Date().toTimeString().slice(0, 5); // HH:MM format
      sessionLink.startedAt = new Date().toISOString();
      
      const updated = await this.updateSessionLink(sessionLink, currentUser);
      
      if (updated) {
        console.log('Started session:', sessionLink.id);
        return sessionLink;
      } else {
        console.error('Failed to update session link to started status');
        return null;
      }
    } catch (error) {
      console.error('Error starting session:', error);
      return null;
    }
  }

  // Complete a session - transition from 'started' to 'completed'
  // Links the session to a completed study tracker session
  static async completeSession(plannedSessionId, studySessionId, actualDuration, currentUser = null) {
    try {
      if (!currentUser) {
        console.error('No current user provided for completing session');
        return null;
      }

      const sessionLinks = await this.getSessionLinks(currentUser);
      const sessionLink = sessionLinks.find(link => 
        link.plannedSessionId === plannedSessionId && 
        link.userId === currentUser.email
      );

      if (!sessionLink) {
        console.error('Session link not found for planned session:', plannedSessionId);
        return null;
      }

      // Update session to completed status
      sessionLink.status = this.STATUS.COMPLETED;
      sessionLink.actualEndTime = new Date().toTimeString().slice(0, 5); // HH:MM format
      sessionLink.actualDuration = actualDuration; // Duration in minutes
      sessionLink.studySessionId = studySessionId;
      sessionLink.completedAt = new Date().toISOString();
      
      const updated = await this.updateSessionLink(sessionLink, currentUser);
      
      if (updated) {
        console.log('Completed session:', sessionLink.id);
        return sessionLink;
      } else {
        console.error('Failed to update session link to completed status');
        return null;
      }
    } catch (error) {
      console.error('Error completing session:', error);
      return null;
    }
  }

  // Reset session status back to planned (used when session is ended without completion)
  static async resetSessionStatus(plannedSessionId, currentUser = null) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for resetting session status');
        return null;
      }

      const sessionLink = await this.getSessionLinkByPlannedId(plannedSessionId, currentUser);
      if (sessionLink && sessionLink.userId === currentUser.email) {
        // Reset to planned status and clear actual time data
        sessionLink.status = 'planned';
        sessionLink.actualStartTime = null;
        sessionLink.startedAt = null;
        await this.updateSessionLink(sessionLink, currentUser);
        console.log('Reset session status to planned:', sessionLink);
        return sessionLink;
      }
      return null;
    } catch (error) {
      console.error('Error resetting session status:', error);
      return null;
    }
  }

  // Create a planned session from calendar and link it to analytics
  static async createPlannedSession(plannedSessionData, currentUser = null) {
    try {
      // Ensure we have a current user for data isolation
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for session creation');
        return null;
      }

      // Get subject name from subjects data if not provided
      let subjectName = plannedSessionData.subjectName;
      if (!subjectName && plannedSessionData.subjectId) {
        const subjects = await readJson('subjects.json') || [];
        const subject = subjects.find(s => s.id === plannedSessionData.subjectId);
        subjectName = subject ? subject.name : 'Unknown Subject';
      }

      // Record as a planner event in analytics
      const plannerEvent = await AnalyticsService.recordPlannerEvent({
        date: plannedSessionData.date,
        title: `Study: ${subjectName}`,
        startTime: plannedSessionData.startTime,
        endTime: plannedSessionData.endTime,
        category: 'study',
        completed: false,
        duration: plannedSessionData.plannedDuration,
        priority: 'medium',
        subjectId: plannedSessionData.subjectId,
        subjectName: subjectName,
        topic: plannedSessionData.topic,
        plannerType: 'study_session',
        isRecurring: plannedSessionData.isRecurring,
        recurringType: plannedSessionData.recurringType,
        userId: currentUser.email, // Add user ID for data isolation
      }, currentUser);

      // Create session link entry
      const sessionLink = {
        id: Date.now().toString(),
        userId: currentUser.email, // Add user ID for data isolation
        plannedSessionId: plannedSessionData.id,
        plannerEventId: plannerEvent?.id,
        subjectId: plannedSessionData.subjectId,
        subjectName: subjectName,
        date: plannedSessionData.date,
        topic: plannedSessionData.topic,
        plannedDuration: plannedSessionData.plannedDuration,
        targetStartTime: plannedSessionData.startTime,
        targetEndTime: plannedSessionData.endTime,
        actualStudySessionId: null,
        actualFocusSessionId: null,
        status: 'planned', // 'planned', 'started', 'completed', 'skipped'
        completedAt: null,
        efficiency: null,
        actualDuration: null,
        notes: '',
        createdAt: new Date().toISOString(),
        isRecurring: plannedSessionData.isRecurring,
        recurringType: plannedSessionData.recurringType,
      };

      await this.saveSessionLink(sessionLink);
      console.log('Created planned session link:', sessionLink);
      console.log('Session link saved to storage');
      return sessionLink;
    } catch (error) {
      console.error('Error creating planned session:', error);
      return null;
    }
  }

  // Get session links for a specific subject
  static async getSubjectSessionLinks(subjectId, dateRange = 30, currentUser = null) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for fetching subject session links');
        return [];
      }

      const links = await this.getAllSessionLinks(currentUser);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - dateRange);

      return links.filter(link => 
        link.subjectId === subjectId && 
        new Date(link.date) >= cutoffDate &&
        link.userId === currentUser.email // Filter by current user
      );
    } catch (error) {
      console.error('Error getting subject session links:', error);
      return [];
    }
  }

  // Get today's planned sessions
  static async getTodayPlannedSessions(currentUser = null) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for fetching today\'s planned sessions');
        return [];
      }

      const links = await this.getAllSessionLinks(currentUser);
      const today = new Date().toISOString().slice(0, 10);
      
      console.log('Getting today\'s planned sessions for date:', today);
      console.log('Total session links found:', links.length);
      
      const todaySessions = links.filter(link => 
        link.date === today && 
        (link.status === 'planned' || link.status === 'started') && 
        link.status !== 'cancelled' &&
        link.userId === currentUser.email // Filter by current user
      );
      
      console.log('Today\'s planned sessions found:', todaySessions.length);
      console.log('Sessions:', todaySessions);
      
      return todaySessions.sort((a, b) => {
        if (a.targetStartTime && b.targetStartTime) {
          return a.targetStartTime.localeCompare(b.targetStartTime);
        }
        return 0;
      });
    } catch (error) {
      console.error('Error getting today\'s planned sessions:', error);
      return [];
    }
  }

  // Mark a planned session as started when user begins study timer
  static async markSessionAsStarted(plannedSessionId, currentUser = null) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for marking session as started');
        return null;
      }

      const sessionLink = await this.getSessionLinkByPlannedId(plannedSessionId, currentUser);
      if (sessionLink && sessionLink.userId === currentUser.email) {
        sessionLink.status = 'started';
        sessionLink.actualStartTime = new Date().toTimeString().slice(0, 8);
        sessionLink.startedAt = new Date().toISOString();
        await this.updateSessionLink(sessionLink, currentUser);
        console.log('Marked session as started:', sessionLink);
        return sessionLink;
      }
      return null;
    } catch (error) {
      console.error('Error marking session as started:', error);
      return null;
    }
  }

  // Complete a planned session when study timer ends
  static async completeLinkedSession({
    plannedSessionId,
    actualDuration, // in seconds
    sessionType = 'manual',
    focusScore = null,
    productivity = null,
    understanding = null,
    notes = ''
  }, currentUser = null) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for completing session');
        return null;
      }

      const sessionLink = await this.getSessionLinkByPlannedId(plannedSessionId, currentUser);
      if (!sessionLink || sessionLink.userId !== currentUser.email) {
        console.log('No session link found for planned session or access denied:', plannedSessionId);
        return null;
      }

      const actualDurationMinutes = Math.round(actualDuration / 60);
      const efficiency = sessionLink.plannedDuration 
        ? Math.min(100, Math.round((actualDurationMinutes / sessionLink.plannedDuration) * 100))
        : null;

      // Record enhanced study session
      const studySession = await AnalyticsService.recordStudySession({
        date: sessionLink.date,
        subjectId: sessionLink.subjectId,
        subjectName: sessionLink.subjectName,
        topic: sessionLink.topic || '',
        duration: actualDurationMinutes,
        sessionType: sessionType,
        completed: true,
        focusScore,
        understanding,
        targetDuration: sessionLink.plannedDuration,
        efficiency,
        linkedPlannerEventId: sessionLink.plannerEventId,
        linkedPlannedSessionId: sessionLink.plannedSessionId,
        actualStartTime: sessionLink.actualStartTime,
        actualEndTime: new Date().toTimeString().slice(0, 8),
        userId: currentUser.email, // Add user ID for data isolation
      }, currentUser);

      // Update planner event as completed
      if (sessionLink.plannerEventId) {
        await this.updatePlannerEvent({
          id: sessionLink.plannerEventId,
          completed: true,
          actualStartTime: sessionLink.actualStartTime,
          actualEndTime: new Date().toTimeString().slice(0, 8),
          actualDuration: actualDurationMinutes,
          completionRating: productivity || focusScore || 7,
          linkedStudySessionId: studySession?.id,
        }, currentUser);
      }

      // Update session link
      sessionLink.status = 'completed';
      sessionLink.completedAt = new Date().toISOString();
      sessionLink.actualDuration = actualDurationMinutes;
      sessionLink.efficiency = efficiency;
      sessionLink.notes = notes;
      sessionLink.actualStudySessionId = studySession?.id;
      sessionLink.actualEndTime = new Date().toTimeString().slice(0, 8);
      sessionLink.focusScore = focusScore;
      sessionLink.productivity = productivity;
      sessionLink.understanding = understanding;

      await this.updateSessionLink(sessionLink, currentUser);
      console.log('Completed linked session:', sessionLink);
      return sessionLink;
    } catch (error) {
      console.error('Error completing linked session:', error);
      return null;
    }
  }

  // Get subject performance metrics
  static async getSubjectPerformance(subjectId, dateRange = 30, currentUser = null) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for getting subject performance');
        return null;
      }

      const links = await this.getSubjectSessionLinks(subjectId, dateRange, currentUser);
      const analytics = await AnalyticsService.getAnalyticsData(currentUser);
      
      // Filter analytics data by current user
      const userStudySessions = (analytics.studySessions || []).filter(session => 
        session.subjectId === subjectId && 
        session.userId === currentUser.email
      );

      const plannedSessions = links.filter(link => link.plannedSessionId);
      const completedSessions = links.filter(link => link.status === 'completed');

      return {
        subjectId,
        totalPlanned: plannedSessions.length,
        totalCompleted: completedSessions.length,
        completionRate: plannedSessions.length > 0 
          ? Math.round((completedSessions.length / plannedSessions.length) * 100)
          : 0,
        averageEfficiency: this.calculateAverage(completedSessions, 'efficiency'),
        averageFocusScore: this.calculateAverage(completedSessions, 'focusScore'),
        averageProductivity: this.calculateAverage(completedSessions, 'productivity'),
        averageUnderstanding: this.calculateAverage(completedSessions, 'understanding'),
        totalStudyTime: completedSessions.reduce((sum, session) => sum + (session.actualDuration || 0), 0),
        averageSessionTime: completedSessions.length > 0
          ? Math.round(completedSessions.reduce((sum, session) => sum + (session.actualDuration || 0), 0) / completedSessions.length)
          : 0,
        recentSessions: completedSessions.slice(-5).reverse(), // Last 5 sessions
      };
    } catch (error) {
      console.error('Error getting subject performance:', error);
      return null;
    }
  }

  // Update a planner event
  static async updatePlannerEvent(eventUpdate, currentUser = null) {
    try {
      const analytics = await AnalyticsService.getAnalyticsData(currentUser);
      const eventIndex = analytics.plannerEvents.findIndex(event => event.id === eventUpdate.id);
      
      if (eventIndex !== -1) {
        analytics.plannerEvents[eventIndex] = {
          ...analytics.plannerEvents[eventIndex],
          ...eventUpdate,
          lastUpdated: new Date().toISOString()
        };
        
        await writeJson('analytics.json', analytics);
        return analytics.plannerEvents[eventIndex];
      }
      return null;
    } catch (error) {
      console.error('Error updating planner event:', error);
      return null;
    }
  }

  // Helper methods for session link management
  static async saveSessionLink(sessionLink) {
    try {
      const links = await this.getAllSessionLinks();
      links.push(sessionLink);
      await writeJson(SESSION_LINKS_FILE, links);
      return sessionLink;
    } catch (error) {
      console.error('Error saving session link:', error);
      return null;
    }
  }

  static async getSessionLink(sessionLinkId) {
    try {
      const links = await this.getAllSessionLinks();
      return links.find(link => link.id === sessionLinkId) || null;
    } catch (error) {
      console.error('Error getting session link:', error);
      return null;
    }
  }

  static async getSessionLinkByPlannedId(plannedSessionId, currentUser = null) {
    try {
      const links = await this.getAllSessionLinks(currentUser);
      return links.find(link => link.plannedSessionId === plannedSessionId) || null;
    } catch (error) {
      console.error('Error getting session link by planned ID:', error);
      return null;
    }
  }

  static async getAllSessionLinks(currentUser = null) {
    try {
      const links = await readJson(SESSION_LINKS_FILE);
      if (currentUser && currentUser.email) {
        return links.filter(link => link.userId === currentUser.email);
      }
      return links || [];
    } catch (error) {
      return [];
    }
  }

  // Helper calculation methods
  static calculateAverage(sessions, field) {
    const values = sessions
      .map(session => session[field])
      .filter(value => value !== null && value !== undefined && !isNaN(value));
    
    if (values.length === 0) return null;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  }
} 