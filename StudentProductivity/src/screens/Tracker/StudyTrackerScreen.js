// StudyTrackerScreen.js - Main screen for tracking study sessions and managing subjects
// This component handles:
// - Timer functionality (regular and Pomodoro modes)r
// - Subject and topic management
// - Session tracking and analytics
// - Calendar integration with planned sessions
// - Reward system integration
// - Goal setting and progress tracking

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, Modal, StyleSheet, Alert, ScrollView, Switch, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import ScreenLayout from '../../components/ScreenLayout';
import SchedulingPrompt from '../../components/SchedulingPrompt';
import { getNeglectedSubjects } from '../../utils/scheduling';
import StudyCalendar from '../../components/StudyCalendar';
import LinkedSessionsView from '../../components/LinkedSessionsView';
import { AnalyticsService } from '../../utils/analyticsService';
import { RewardSystem } from '../../utils/RewardSystem';
import RewardDisplay from '../../components/RewardDisplay';
import RewardSummaryCard from '../../components/RewardSummaryCard';
import FloatingTimer from '../../components/FloatingTimer';
import RewardPopup from '../../components/RewardPopup';
import {
  POMODORO_PHASES,
  FOCUS_DURATION_SECONDS,
  BREAK_DURATION_SECONDS,
  schedulePomodoroNotification,
  cancelAllPomodoroNotifications
} from '../../utils/pomodoro';

const SCREEN_WIDTH = Dimensions.get('window').width;

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Completed'];

// Main component - handles all study tracking functionality
export default function StudyTrackerScreen({ navigation }) {
  // Theme and user context hooks for styling and user-specific data
  const { theme } = useTheme();
  const { currentUser } = useUser();
  
  // Function to create user-specific storage keys for data isolation
  // Each user's data is stored separately based on their email
  const getStorageKey = () => {
    if (!currentUser || !currentUser.email) return 'study_tracker_data';
    return `study_tracker_data_${currentUser.email}`;
  };

  // Core state management for study tracking
  const [subjects, setSubjects] = useState([]);           // Array of subjects with topics
  const [sessions, setSessions] = useState([]);           // Completed study sessions
  const [goals, setGoals] = useState({ dailyMinutes: 120 }); // User study goals (default 2 hours)
  const [todayMinutes, setTodayMinutes] = useState(0);     // Minutes studied today
  const [todaySeconds, setTodaySeconds] = useState(0);     // Seconds studied today (for precision)
  const [streak, setStreak] = useState(0);                // Daily study streak
  const [plannedSessions, setPlannedSessions] = useState([]); // Planned sessions from calendar
  const [isLoading, setIsLoading] = useState(true);       // Loading state for data fetch
  const [refreshLinkedSessions, setRefreshLinkedSessions] = useState(0); // Trigger for refreshing linked sessions

  // Modal state management for UI interactions
  const [modalVisible, setModalVisible] = useState(false);     // Subject creation/edit modal
  const [subjectName, setSubjectName] = useState('');          // Input for subject name
  const [editingSubject, setEditingSubject] = useState(null);  // Subject being edited

  // Topic management state for organizing study content within subjects
  const [topicModalVisible, setTopicModalVisible] = useState(false); // Topic management modal
  const [topicSubject, setTopicSubject] = useState(null);            // Subject whose topics are being managed
  const [newTopicName, setNewTopicName] = useState('');              // Input for new topic name

  // Timer state management for study session tracking
  const [timerActive, setTimerActive] = useState(false);    // Whether timer is currently running
  const [timerSeconds, setTimerSeconds] = useState(0);      // Current timer value in seconds
  const [timerSubject, setTimerSubject] = useState(null);   // Subject being studied
  const [timerTopic, setTimerTopic] = useState('');         // Specific topic being studied
  const timerRef = useRef(null);                            // Reference for timer interval

  // Goal and reminder settings
  const [goalInput, setGoalInput] = useState(goals.dailyMinutes.toString()); // Input field for goal setting
  const [reminderTime, setReminderTime] = useState('18:00');                 // Daily reminder time

  // Smart scheduling system state - suggests neglected topics
  const [showPrompt, setShowPrompt] = useState(false);  // Whether to show neglected topics prompt
  const [neglected, setNeglected] = useState([]);       // Array of neglected topics

  // Pomodoro timer functionality state
  const [isPomodoroMode, setIsPomodoroMode] = useState(false);           // Toggle between regular and Pomodoro timer
  const [pomodoroPhase, setPomodoroPhase] = useState(POMODORO_PHASES.IDLE); // Current Pomodoro phase
  const [pomodoroCycles, setPomodoroCycles] = useState(0);               // Number of completed Pomodoro cycles

  // Topic creation state for new subjects
  const [newSubjectTopics, setNewSubjectTopics] = useState([]);    // Topics to add when creating new subject
  const [newSubjectTopicName, setNewSubjectTopicName] = useState(''); // Input for topic when creating subject

  // Topic selection modal for starting sessions
  const [topicSelectionModalVisible, setTopicSelectionModalVisible] = useState(false); // Modal for selecting topic when starting session
  const [selectedSubjectForTopic, setSelectedSubjectForTopic] = useState(null); // Subject selected for topic selection

  // New topic creation modal for session start
  const [newTopicForSessionModalVisible, setNewTopicForSessionModalVisible] = useState(false); // Modal for creating new topic during session start
  const [selectedSubjectForNewTopic, setSelectedSubjectForNewTopic] = useState(null); // Subject selected for new topic creation
  const [newTopicForSessionName, setNewTopicForSessionName] = useState(''); // Input for new topic name during session start

  // Reward system state management
  const [showRewardModal, setShowRewardModal] = useState(false);    // Full reward details modal
  const [showRewardPopup, setShowRewardPopup] = useState(false);    // Quick reward notification popup
  const [currentRewards, setCurrentRewards] = useState([]);        // Current reward data to display
  const [rewardSummaryRef, setRewardSummaryRef] = useState(null);   // Reference to reward summary component
  
  // Floating timer UI state for scrolling behavior
  const [showFloatingTimer, setShowFloatingTimer] = useState(false); // Show compact timer when scrolled
  const [timerSectionRef, setTimerSectionRef] = useState(null);      // Reference to main timer section

  // Planned session time tracking to auto-end sessions when time lapses
  const [timeLapseAlertShown, setTimeLapseAlertShown] = useState(false); // Prevent repeated time lapse alerts

  // Load from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        // Don't attempt to load data if no user is logged in
        if (!currentUser) {
          setIsLoading(false);
          return;
        }
        
        // Load user-specific data from AsyncStorage
        const data = await AsyncStorage.getItem(getStorageKey());
        if (data) {
          const parsedData = JSON.parse(data);
          // Set all state with loaded data or defaults if data is missing
          setSubjects(parsedData.subjects || []);
          setSessions(parsedData.sessions || []);
          setGoals(parsedData.goals || { dailyMinutes: 120 });
          setPlannedSessions(parsedData.plannedSessions || []);
          // Initialize goal input field with loaded goals
          if (parsedData.goals && parsedData.goals.dailyMinutes) {
            setGoalInput(parsedData.goals.dailyMinutes.toString());
          }
        }
      } catch (error) {
        console.error('Error loading study tracker data:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [currentUser]); // Re-run when user changes

  // Save to AsyncStorage - automatically saves data when state changes
  useEffect(() => {
    // Only save if user is logged in and initial loading is complete
    if (currentUser && !isLoading) {
      AsyncStorage.setItem(getStorageKey(), JSON.stringify({ subjects, sessions, goals, plannedSessions }));
    }
  }, [subjects, sessions, goals, plannedSessions, currentUser, isLoading]);

  // Calculate today's study progress from completed sessions
  useEffect(() => {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().slice(0, 10);
    
    // Filter sessions for today and calculate total time
    const todaySessions = (sessions || []).filter(s => s.date === today);
    const totalSeconds = todaySessions.reduce((sum, s) => sum + s.duration, 0);
    
    // Update progress tracking state
    setTodaySeconds(totalSeconds);
    setTodayMinutes(Math.round(totalSeconds / 60));
  }, [sessions]); // Recalculate when sessions change

  // Main timer logic - handles both regular timer and Pomodoro functionality
  useEffect(() => {
    if (timerActive) {
      // Set up interval to update timer every second
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => {
          if (isPomodoroMode) {
            // Pomodoro mode: countdown timer with phase transitions
            if (s > 0) {
              return s - 1; // Count down each second
            } else { 
              // Pomodoro phase ended (timer reached 0)
              if (pomodoroPhase === POMODORO_PHASES.FOCUS) {
                // Focus period ended - switch to break and save session
                setPomodoroPhase(POMODORO_PHASES.BREAK);
                schedulePomodoroNotification(POMODORO_PHASES.BREAK, BREAK_DURATION_SECONDS);
                setPomodoroCycles(c => c + 1);
                
                // Save the completed focus session
                if (timerSubject) {
                  const session = {
                    id: Date.now().toString(),
                    subjectId: timerSubject.id,
                    topic: timerTopic,
                    duration: FOCUS_DURATION_SECONDS,
                    date: new Date().toISOString().slice(0, 10),
                    notes: 'Pomodoro Focus Session',
                  };
                  setSessions(prevSessions => [...prevSessions, session]);

                  // Record analytics data for completed Pomodoro session
                  AnalyticsService.recordStudySession({
                    date: session.date,
                    subjectId: timerSubject.id,
                    subjectName: timerSubject.name,
                    topic: timerTopic || 'General',
                    duration: Math.round(FOCUS_DURATION_SECONDS / 60), // Convert to minutes
                    sessionType: 'pomodoro',
                    completed: true,
                    breaks: pomodoroCycles + 1, // +1 because we just completed a cycle
                  }, currentUser);
                }
                return BREAK_DURATION_SECONDS; // Start break countdown
              } else if (pomodoroPhase === POMODORO_PHASES.BREAK) {
                // Break period ended - switch back to focus
                setPomodoroPhase(POMODORO_PHASES.FOCUS);
                schedulePomodoroNotification(POMODORO_PHASES.FOCUS, FOCUS_DURATION_SECONDS);
                return FOCUS_DURATION_SECONDS; // Start focus countdown
              }
              return 0; // Fallback case
            }
          } else { 
            // Regular timer mode: count up continuously
            return s + 1;
          }
        });
      }, 1000);
    } else {
      // Timer not active - clear the interval
      clearInterval(timerRef.current);
    }
    
    // Cleanup function to prevent memory leaks
    return () => clearInterval(timerRef.current);
  }, [timerActive, isPomodoroMode, pomodoroPhase, timerSubject, timerTopic, setSessions]);

  // Check for planned session time lapse and auto-end session
  // This monitors if a planned study session has exceeded its scheduled end time
  useEffect(() => {
    // Only check if timer is active and we have a subject
    if (!timerActive || !timerSubject) return;

    const checkPlannedSessionTime = async () => {
      try {
        // Get today's planned sessions from the session linking service
        const { SessionLinkingService } = await import('../../utils/SessionLinkingService');
        const todayPlanned = await SessionLinkingService.getTodayPlannedSessions(currentUser);
        
        // Find the planned session that matches the current active session
        const matchingPlanned = todayPlanned.find(planned => 
          planned.subjectId === timerSubject.id && 
          planned.status === 'started' &&
          (!planned.topic || planned.topic === timerTopic)
        );

        // Check if session has an end time and we haven't already shown the alert
        if (matchingPlanned && matchingPlanned.targetEndTime && !timeLapseAlertShown) {
          const now = new Date();
          const currentTime = now.toTimeString().slice(0, 5); // Get HH:MM format
          
          // Parse the planned end time into minutes for comparison
          const [endHour, endMin] = matchingPlanned.targetEndTime.split(':').map(Number);
          const [currentHour, currentMin] = currentTime.split(':').map(Number);
          
          const endTimeMinutes = endHour * 60 + endMin;
          const currentTimeMinutes = currentHour * 60 + currentMin;
          
          // Check if current time has passed the planned end time
          if (currentTimeMinutes >= endTimeMinutes) {
            console.log('Planned session time has lapsed, automatically ending session');
            setTimeLapseAlertShown(true); // Prevent repeated alerts
            
            // Show user dialog asking what to do when time has lapsed
            Alert.alert(
              'Planned Session Time Ended',
              `Your planned study session for ${timerSubject.name} was scheduled to end at ${matchingPlanned.targetEndTime}. The session will now be automatically saved and ended.`,
              [
                {
                  text: 'Continue Studying',
                  onPress: () => {
                    // Allow user to continue studying past planned time
                    console.log('User chose to continue studying past planned time');
                  }
                },
                {
                  text: 'End Session',
                  style: 'default',
                  onPress: async () => {
                    // Automatically end and save the session
                    await handleEndSession();
                  }
                }
              ]
            );
          }
        }
      } catch (error) {
        console.error('Error checking planned session time:', error);
      }
    };

    // Check every minute to avoid excessive API calls
    const intervalId = setInterval(checkPlannedSessionTime, 60000);
    
    // Also check immediately when the effect runs
    checkPlannedSessionTime();

    // Cleanup interval on unmount or dependency change
    return () => clearInterval(intervalId);
  }, [timerActive, timerSubject, timerTopic, currentUser, timeLapseAlertShown]);

  // Smart scheduling system - detects neglected topics and suggests study sessions
  useEffect(() => {
    if (subjects && Array.isArray(subjects)) {
      // Use utility function to find topics not studied in 3+ days
      const neglectedList = getNeglectedSubjects(subjects, 3);
      console.log('Neglected subjects found:', neglectedList);
      setNeglected(neglectedList || []);
      setShowPrompt((neglectedList || []).length > 0); // Show prompt if neglected topics exist
    } else {
      // Clear neglected topics if no subjects
      setNeglected([]);
      setShowPrompt(false);
    }
  }, [subjects]); // Re-run when subjects change

  // Calculate today's study streak
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todaySessions = (sessions || []).filter(s => s.date === today);
    const totalSeconds = todaySessions.reduce((sum, s) => sum + s.duration, 0);
    setTodayMinutes(totalSeconds / 60); // Keep as minutes for goal comparison
    setTodaySeconds(totalSeconds); // Store total seconds for display

    // Streak calculation (simple version)
    let streakCount = 0;
    let date = new Date();
    while (true) {
      const dateStr = date.toISOString().slice(0, 10);
      if ((sessions || []).some(s => s.date === dateStr)) {
        streakCount++;
        date.setDate(date.getDate() - 1);
      } else {
        break;
      }
    }
    setStreak(streakCount);
  }, [sessions]);

  // Subject CRUD (Create, Read, Update, Delete) Operations
  // Function to add a new subject to the subjects array
  const handleAddSubject = () => {
    if (!subjectName.trim()) return; // Don't add empty subjects
    
    // Create new subject with unique ID and topics
    setSubjects([...subjects, { 
      id: Date.now().toString(), 
      name: subjectName, 
      topics: newSubjectTopics, 
      progress: 'Not Started' 
    }]);
    
    // Reset form state after adding
    setSubjectName('');
    setNewSubjectTopics([]);
    setNewSubjectTopicName('');
    setModalVisible(false);
  };
  
  // Function to update an existing subject's name
  const handleEditSubject = () => {
    setSubjects(subjects.map(s => 
      s.id === editingSubject.id ? { ...s, name: subjectName } : s
    ));
    
    // Reset editing state
    setEditingSubject(null);
    setSubjectName('');
    setModalVisible(false);
  };
  
  // Function to delete a subject and all associated data
  const handleDeleteSubject = (id) => {
    const subjectToDelete = subjects.find(s => s.id === id);
    if (!subjectToDelete) return;

    // Check for associated data that will also be deleted
    const associatedPlannedSessions = (plannedSessions || []).filter(ps => ps.subjectId === id);
    const associatedCompletedSessions = (sessions || []).filter(s => s.subjectId === id);
    
    // Build confirmation message showing what will be deleted
    let confirmationMessage = `Are you sure you want to delete "${subjectToDelete.name}"?`;
    
    if (associatedPlannedSessions.length > 0 || associatedCompletedSessions.length > 0) {
      confirmationMessage += '\n\nThis will also delete:';
      
      if (associatedCompletedSessions.length > 0) {
        confirmationMessage += `\n• ${associatedCompletedSessions.length} completed study session(s)`;
      }
      
      if (associatedPlannedSessions.length > 0) {
        confirmationMessage += `\n• ${associatedPlannedSessions.length} planned session(s)`;
      }
      
      confirmationMessage += '\n\nThis action cannot be undone.';
    }

    // Show confirmation dialog before deletion
    Alert.alert(
      'Delete Subject',
      confirmationMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            // Delete the subject and all associated data
            setSubjects(prev => prev.filter(s => s.id !== id));
            setPlannedSessions(prev => prev.filter(ps => ps.subjectId !== id));
            setSessions(prev => prev.filter(s => s.subjectId !== id));
            
            // Show confirmation of deletion
            const deletedItems = [];
            if (associatedCompletedSessions.length > 0) {
              deletedItems.push(`${associatedCompletedSessions.length} completed session(s)`);
            }
            if (associatedPlannedSessions.length > 0) {
              deletedItems.push(`${associatedPlannedSessions.length} planned session(s)`);
            }
            
            const message = deletedItems.length > 0 
              ? `Subject "${subjectToDelete.name}" and ${deletedItems.join(' and ')} have been deleted.`
              : `Subject "${subjectToDelete.name}" has been deleted.`;
            
            Alert.alert('Subject Deleted', message);
          }
        }
      ]
    );
  };

  // Topic CRUD Operations - for managing topics within subjects
  // Function to open the topic management modal for a specific subject
  const openTopicModal = (subject) => {
    setTopicSubject(subject);
    setTopicModalVisible(true);
    setNewTopicName('');
  };
  
  // Function to add a new topic to the current subject
  const handleAddTopic = () => {
    if (!newTopicName.trim()) return; // Don't add empty topics
    
    const trimmedTopicName = newTopicName.trim();
    
    // Check for duplicate topics in the same subject to prevent confusion
    const existingTopics = topicSubject?.topics || [];
    const isDuplicate = existingTopics.some(topic => 
      topic.name.toLowerCase() === trimmedTopicName.toLowerCase()
    );
    
    if (isDuplicate) {
      Alert.alert('Duplicate Topic', 'This topic already exists for this subject.');
      return;
    }
    
    // Create the new topic object
    const newTopic = { 
      name: trimmedTopicName, 
      lastStudied: null, 
      progress: 'Not Started' 
    };
    
    // Update subjects state with the new topic
    setSubjects(prev => {
      const updatedSubjects = prev.map(s =>
        s.id === topicSubject.id
          ? { ...s, topics: [...(s.topics || []), newTopic] }
          : s
      );
      
      // Log for debugging
      console.log('Updated subjects with new topic:', trimmedTopicName);
      console.log('Updated subject topics count:', updatedSubjects.find(s => s.id === topicSubject.id)?.topics?.length);
      
      return updatedSubjects;
    });
    
    // Update the topicSubject state to reflect the new topic immediately in the modal
    setTopicSubject(prev => {
      const updatedTopicSubject = {
        ...prev,
        topics: [...(prev.topics || []), newTopic]
      };
      
      console.log('Updated topicSubject topics count:', updatedTopicSubject.topics.length);
      return updatedTopicSubject;
    });
    
    setNewTopicName(''); // Clear input field
    
    // Show success feedback without additional alert to avoid blocking UI updates
    console.log(`Topic "${trimmedTopicName}" added successfully to ${topicSubject.name}`);
    
    // Force a small delay to ensure state updates are processed
    setTimeout(() => {
      console.log('Topic addition completed - UI should be updated');
    }, 100);
  };
  
  // Function to delete a topic from the current subject
  const handleDeleteTopic = (topicName) => {
    Alert.alert(
      'Delete Topic',
      `Are you sure you want to delete "${topicName}"? This will also remove any associated study session data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Remove topic from subjects state
            setSubjects(prev => {
              const updatedSubjects = prev.map(s =>
                s.id === topicSubject.id
                  ? { ...s, topics: (s.topics || []).filter(t => t.name !== topicName) }
                  : s
              );
              
              // Log for debugging
              console.log('Deleted topic:', topicName);
              console.log('Updated subject topics count:', updatedSubjects.find(s => s.id === topicSubject.id)?.topics?.length);
              
              return updatedSubjects;
            });
            
            // Update the topicSubject state to reflect the deletion immediately in the modal
            setTopicSubject(prev => {
              const updatedTopicSubject = {
                ...prev,
                topics: (prev.topics || []).filter(t => t.name !== topicName)
              };
              
              console.log('Updated topicSubject topics count after deletion:', updatedTopicSubject.topics.length);
              return updatedTopicSubject;
            });
            
            // Also remove any sessions associated with this topic
            setSessions(prev => prev.filter(s => 
              !(s.subjectId === topicSubject.id && s.topic === topicName)
            ));
            
            // Show confirmation without blocking UI updates
            console.log(`Topic "${topicName}" deleted successfully from ${topicSubject.name}`);
          }
        }
      ]
    );
  };
  
  // Function to close the topic management modal
  const closeTopicModal = () => {
    setTopicModalVisible(false);
    setTopicSubject(null);
    setNewTopicName('');
  };

  // Timer Control Functions - manage study session timers
  // Function to start a timer for a specific subject and topic
  const handleStartTimer = (subject, topic = '') => {
    // Check if there's already an active session to prevent conflicts
    if (timerSubject) {
      Alert.alert(
        'Active Session Detected',
        `You already have an active session for "${timerSubject.name}". What would you like to do?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Stop Current & Start New', 
            style: 'destructive',
            onPress: async () => {
              // Stop and save current session, then start new one
              await handleStopTimer();
              startNewSession(subject, topic);
            }
          },
          { 
            text: 'Pause Current & Start New', 
            onPress: () => {
              // Just pause current session and start new one
              setTimerActive(false);
              startNewSession(subject, topic);
            }
          }
        ]
      );
      return;
    }
    
    // No active session, start new one directly
    startNewSession(subject, topic);
  };

  // Helper function to initialize a new study session
  const startNewSession = (subject, topic = '') => {
    setTimerSubject(subject);
    setTimerTopic(topic); 
    setTimeLapseAlertShown(false); // Reset time lapse alert for new session

    if (isPomodoroMode) {
      // Set up Pomodoro timer with focus phase
      setPomodoroPhase(POMODORO_PHASES.FOCUS);
      setTimerSeconds(FOCUS_DURATION_SECONDS);
      schedulePomodoroNotification(POMODORO_PHASES.FOCUS, FOCUS_DURATION_SECONDS);
      setPomodoroCycles(0);
    } else {
      // Set up regular timer starting from 0
      setTimerSeconds(0);
    }
    setTimerActive(true);
  };
  
  // Function to pause the timer without ending the session
  const handlePauseTimer = () => {
    setTimerActive(false);
    // Timer state is preserved - user can resume later
  };

  // Function to stop the timer and save the completed study session
  const handleStopTimer = async () => {
    setTimerActive(false);
    
    // Create session object with study data
        const session = {
          id: Date.now().toString(),
          subjectId: timerSubject.id,
          topic: timerTopic,
      duration: timerSeconds, // Duration in seconds
      date: new Date().toISOString().slice(0, 10), // Today's date in YYYY-MM-DD format
      notes: '',
    };
    
    // Add session to completed sessions list
    setSessions(prevSessions => [...prevSessions, session]);

    // Record analytics data for tracking study patterns
          AnalyticsService.recordStudySession({
            date: session.date,
            subjectId: timerSubject.id,
            subjectName: timerSubject.name,
            topic: timerTopic || 'General',
      duration: Math.round(timerSeconds / 60), // Convert to minutes
      sessionType: isPomodoroMode ? 'pomodoro' : 'regular',
            completed: true,
            breaks: isPomodoroMode ? pomodoroCycles : 0,
          }, currentUser);

    // Calculate and display rewards for the completed session
    const rewardResult = await RewardSystem.calculateSessionReward(
      timerSubject.id,
      Math.round(timerSeconds / 60), // Duration in minutes
      currentUser,
      goals.dailyMinutes // Daily goal for bonus calculation
    );

    // Show reward notification if rewards were earned
    if (rewardResult && rewardResult.totalPoints > 0) {
      setCurrentRewards([rewardResult]);
      setShowRewardPopup(true);
      
      // Refresh reward summary display
      if (rewardSummaryRef?.refreshData) {
        rewardSummaryRef.refreshData();
      }
    }

    // Update subject's last studied timestamp and progress status
    setSubjects(prev => prev.map(s => {
      if (s.id === timerSubject.id) {
        const updatedSubject = { ...s, lastStudied: new Date().toISOString() };
        
        // Update specific topic if one was selected
        if (timerTopic) {
          // Initialize topics array if it doesn't exist
          if (!s.topics) {
            updatedSubject.topics = [];
          }
          
          // Check if the topic exists in the subject's topics array
          const topicExists = (updatedSubject.topics || []).some(t => t.name === timerTopic);
          
          if (topicExists) {
            // Update existing topic
            updatedSubject.topics = updatedSubject.topics.map(t => 
              t.name === timerTopic 
                ? { ...t, lastStudied: new Date().toISOString(), progress: 'In Progress' }
                : t
            );
          } else {
            // Add new topic if it doesn't exist
            updatedSubject.topics = [
              ...(updatedSubject.topics || []),
              {
                name: timerTopic,
                lastStudied: new Date().toISOString(),
                progress: 'In Progress'
              }
            ];
          }
        }
        return updatedSubject;
      }
      return s;
    }));
  };

  // Function to completely end a session and clear all timer state
  const handleEndSession = async () => {
    // First stop the timer and save the session
    await handleStopTimer();
    
    // Reset any started planned sessions back to 'planned' status so they show start button again
    if (timerSubject) {
      try {
        const { SessionLinkingService } = await import('../../utils/SessionLinkingService');
        const todayPlanned = await SessionLinkingService.getTodayPlannedSessions(currentUser);
        const matchingPlanned = todayPlanned.find(planned => 
          planned.subjectId === timerSubject.id && 
          planned.status === 'started' &&
          (!planned.topic || planned.topic === timerTopic)
        );

        // Reset the planned session status to allow it to be started again
        if (matchingPlanned) {
          await SessionLinkingService.resetSessionStatus(matchingPlanned.id, currentUser);
        }
      } catch (error) {
        console.error('Error resetting planned session status:', error);
      }
    }
    
    // Clear all timer-related state completely
    setTimerSubject(null);
    setTimerTopic('');
    setPomodoroCycles(0);
    setTimeLapseAlertShown(false); // Reset time lapse alert when ending session
    
    // Trigger refresh of linked sessions to update the UI
    setRefreshLinkedSessions(prev => prev + 1);
  };

  // Function to resume a paused timer
  const handleResumeTimer = () => {
    setTimerActive(true);
    // Timer continues from where it was paused
  };

  // Notification System - handles Pomodoro timer notifications
  // Function to schedule push notifications for Pomodoro phase changes
  const schedulePomodoroNotification = async (phase, durationSeconds) => {
    try {
      // Cancel any existing notifications to avoid conflicts
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      // Determine notification content based on phase
      const isBreak = phase === POMODORO_PHASES.BREAK;
      const title = isBreak ? 'Break Time!' : 'Focus Time!';
      const body = isBreak 
        ? 'Time for a 5-minute break. Relax and recharge!' 
        : 'Back to work! Start your next focus session.';
      
      // Schedule notification to fire when the current phase ends
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
        },
        trigger: {
          seconds: durationSeconds, // Fire after the phase duration
        },
      });
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  // Goal Management Functions
  // Function to update the user's daily study goal
  const updateGoal = () => {
    const newGoal = parseInt(goalInput) || 120; // Default to 120 minutes if invalid input
    setGoals({ ...goals, dailyMinutes: newGoal });
    console.log('Goal updated to:', newGoal, 'minutes');
  };

  // Calendar Integration Functions
  // Function to handle adding a new planned session from the calendar
  const handleAddPlannedSession = (newSession) => {
    const sessionWithId = { ...newSession, id: Date.now().toString() };
    setPlannedSessions(prev => [...prev, sessionWithId]);
  };

  // Function to handle editing an existing planned session
  const handleEditPlannedSession = (sessionId, updatedSession) => {
    setPlannedSessions(prev => 
      prev.map(session => 
        session.id === sessionId ? { ...session, ...updatedSession } : session
      )
    );
  };

  // Function to handle deleting a planned session
  const handleDeletePlannedSession = (sessionId) => {
    setPlannedSessions(prev => prev.filter(session => session.id !== sessionId));
  };

  // Function to handle deleting completed sessions from calendar
  const handleDeleteCompletedSession = (sessionId) => {
    console.log('Deleting completed session:', sessionId);
    setSessions(prev => prev.filter(session => session.id !== sessionId));
  };

  // UI Scroll Handling - manages floating timer visibility
  // Function to handle scroll events and show/hide floating timer
  const handleScroll = (event) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    // Show floating timer when scrolled past the timer section (approximately 400px)
    setShowFloatingTimer(timerSubject && scrollY > 400);
  };

  // Function to scroll back to the main timer section
  const scrollToTimer = () => {
    // This would scroll to the timer section - you could implement this with a ref
    setShowFloatingTimer(false);
  };

  // Topic creation for new subjects - allows adding multiple topics when creating a subject
  // Add topic to new subject being created
  const handleAddNewSubjectTopic = () => {
    if (!newSubjectTopicName.trim()) return; // Don't add empty topics
    
    // Check for duplicate topics in the new subject being created
    const isDuplicate = newSubjectTopics.some(topic => 
      topic.name.toLowerCase().trim() === newSubjectTopicName.toLowerCase().trim()
    );
    
    if (isDuplicate) {
      Alert.alert('Duplicate Topic', 'This topic already exists.');
      return;
    }
    
    // Add topic to the temporary list for new subject
    setNewSubjectTopics(prev => [...prev, { name: newSubjectTopicName, lastStudied: null, progress: 'Not Started' }]);
    setNewSubjectTopicName(''); // Clear input field
  };

  // Remove topic from new subject being created
  const handleRemoveNewSubjectTopic = (topicName) => {
    setNewSubjectTopics(prev => prev.filter(t => t.name !== topicName));
  };

  // Function to add a new topic during study session creation
  const handleAddNewTopicForSession = (subject) => {
    setSelectedSubjectForNewTopic(subject);
    setNewTopicForSessionName('');
    setNewTopicForSessionModalVisible(true);
  };

  // Function to handle creating new topic and starting session
  const handleCreateTopicAndStartSession = () => {
    if (!newTopicForSessionName || !newTopicForSessionName.trim()) {
      Alert.alert('Error', 'Please enter a topic name.');
      return;
    }

    const trimmedTopicName = newTopicForSessionName.trim();
    
    // Check for duplicate topics
    const existingTopics = selectedSubjectForNewTopic.topics || [];
    const isDuplicate = existingTopics.some(topic => 
      topic.name.toLowerCase() === trimmedTopicName.toLowerCase()
    );
    
    if (isDuplicate) {
      Alert.alert('Duplicate Topic', 'This topic already exists for this subject.');
      return;
    }

    // Add the new topic to the subject immediately
    const newTopic = {
      name: trimmedTopicName,
      lastStudied: null,
      progress: 'Not Started'
    };

    setSubjects(prev => prev.map(s =>
      s.id === selectedSubjectForNewTopic.id
        ? { ...s, topics: [...(s.topics || []), newTopic] }
        : s
    ));

    // Close the modal
    setNewTopicForSessionModalVisible(false);
    setSelectedSubjectForNewTopic(null);
    setNewTopicForSessionName('');

    // Start the timer with the new topic
    handleStartTimer(selectedSubjectForNewTopic, trimmedTopicName);
    
    // Show confirmation
    Alert.alert('Success!', `${trimmedTopicName} has been added to ${selectedSubjectForNewTopic.name} and your study session has started.`);
  };

  // Session linking with planned sessions - connects timer to calendar events
  const onStartSession = async (session) => {
    const subject = subjects.find(s => s.id === session.subjectId);
    if (subject) {
      // Start timer for the planned session
      await handleStartTimer(subject, session.topic);
    }
  };

  // Chart Data Preparation - create data for the analytics bar chart
  // This processes session data to create chart-compatible format
  const chartData = React.useMemo(() => {
    console.log('Chart data recalculation - Subjects:', subjects?.length, 'Sessions:', sessions?.length);
    
    if (!subjects || !sessions || subjects.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          data: [0]
        }]
      };
    }

    // Calculate total study time per subject in minutes
    const subjectData = subjects.map(subject => {
      const subjectSessions = sessions.filter(s => s.subjectId === subject.id);
      const totalSeconds = subjectSessions.reduce((sum, s) => sum + s.duration, 0);
      const totalMinutes = Math.round(totalSeconds / 60);
      
      console.log(`Subject: ${subject.name}, Sessions: ${subjectSessions.length}, Total Minutes: ${totalMinutes}`);
      
      return {
        label: subject.name.length > 8 ? subject.name.substring(0, 8) + '...' : subject.name,
        value: totalMinutes,
        hasData: totalMinutes > 0
      };
    });

    // If no subjects have study time, show all subjects with 0 values
    const hasAnyData = subjectData.some(item => item.value > 0);
    
    let finalData;
    if (!hasAnyData) {
      // Show all subjects with 0 values if no one has studied yet
      finalData = subjectData.slice(0, 5).map(item => ({ ...item, value: 0 }));
    } else {
      // Show only subjects with study time, but ensure minimum of 1 subject is shown
      const dataWithStudyTime = subjectData.filter(item => item.value > 0);
      finalData = dataWithStudyTime.length > 0 ? dataWithStudyTime.slice(0, 5) : subjectData.slice(0, 1);
    }

    // If still no data, return minimal chart data
    if (finalData.length === 0) {
      return {
        labels: ['No Subjects'],
        datasets: [{
          data: [0]
        }]
      };
    }

    console.log('Final chart data:', finalData);

    // Return proper BarChart format
    return {
      labels: finalData.map(item => item.label),
      datasets: [{
        data: finalData.map(item => item.value)
      }]
    };
  }, [subjects, sessions]);

  // Reminder Management - handles setting daily study reminders
  const handleSetReminder = async () => {
    try {
      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(reminderTime)) {
        Alert.alert('Invalid Time', 'Please enter time in HH:MM format (24-hour)');
        return;
      }

      // Here you could implement actual notification scheduling
      // For now, we'll just show a confirmation
      Alert.alert(
        'Reminder Set',
        `Daily study reminder set for ${reminderTime}`,
        [{ text: 'OK' }]
      );
      
      // Save reminder time to user preferences
      const userData = await AsyncStorage.getItem(getStorageKey());
      if (userData) {
        const parsedData = JSON.parse(userData);
        parsedData.reminderTime = reminderTime;
        await AsyncStorage.setItem(getStorageKey(), JSON.stringify(parsedData));
      }
      
      console.log('Reminder set for:', reminderTime);
    } catch (error) {
      console.error('Error setting reminder:', error);
      Alert.alert('Error', 'Failed to set reminder. Please try again.');
    }
  };

  // Reset Progress - resets today's study progress and statistics
  const handleResetToday = () => {
    Alert.alert(
      'Reset Today\'s Progress',
      'Are you sure you want to reset all of today\'s study progress? This will remove all sessions from today and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            try {
              const today = new Date().toISOString().slice(0, 10);
              
              // Remove today's sessions
              const filteredSessions = (sessions || []).filter(session => session.date !== today);
              setSessions(filteredSessions);
              
              // Reset today's progress counters
              setTodayMinutes(0);
              setTodaySeconds(0);
              
              // End current session if active
              if (timerSubject) {
                setTimerActive(false);
                setTimerSubject(null);
                setTimerTopic('');
                setPomodoroCycles(0);
              }
              
              Alert.alert('Progress Reset', 'Today\'s study progress has been reset.');
            } catch (error) {
              console.error('Error resetting today\'s progress:', error);
              Alert.alert('Error', 'Failed to reset progress. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Reset Chart Data Only - resets analytics but keeps subjects and current progress
  const handleResetChartData = () => {
    Alert.alert(
      'Reset Chart Data',
      'This will permanently delete all your analytics and session history data, but keep your subjects and current progress. Chart data will be cleared but you can continue studying.\n\nThis action cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset Charts', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear all sessions (this will reset charts)
              setSessions([]);
              
              // Reset today's progress
              setTodayMinutes(0);
              setTodaySeconds(0);
              setStreak(0);

              // Clear analytics data
              await AnalyticsService.clearAnalyticsData();

              Alert.alert(
                'Chart Data Reset',
                'All chart and analytics data has been cleared. Your subjects remain intact.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Error resetting chart data:', error);
              Alert.alert('Error', 'Failed to reset chart data. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Reset All Data - comprehensive reset for all study data and analytics
  const handleResetAllData = () => {
    Alert.alert(
      'Reset All Data',
      'This will permanently delete ALL your study data including:\n\n• All study sessions\n• All subjects and topics\n• All analytics data\n• All planned sessions\n• Progress tracking\n\nThis action cannot be undone. Are you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset Everything', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Stop any active timer
              if (timerActive) {
                setTimerActive(false);
                clearInterval(timerRef.current);
                cancelAllPomodoroNotifications();
              }

              // Reset all state to initial values
              setSubjects([]);
              setSessions([]);
              setPlannedSessions([]);
              setTodayMinutes(0);
              setTodaySeconds(0);
              setStreak(0);
              setTimerSeconds(0);
              setTimerSubject(null);
              setTimerTopic('');
              setPomodoroPhase(POMODORO_PHASES.IDLE);
              setPomodoroCycles(0);
              setGoals({ dailyMinutes: 120 });
              setGoalInput('120');

              // Clear analytics data
              await AnalyticsService.clearAnalyticsData();

              Alert.alert(
                'Data Reset Complete',
                'All study data has been successfully deleted. You can start fresh with a clean slate.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Error resetting all data:', error);
              Alert.alert('Error', 'Failed to reset all data. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Smart Scheduling - handles adding neglected topics to planned sessions
  const handleAddToPlan = (neglectedItem) => {
    try {
      console.log('Adding neglected item to plan:', neglectedItem);
      
      // Validate the neglected item has required data
      if (!neglectedItem || !neglectedItem.subjectId || !neglectedItem.topic) {
        console.error('Invalid neglected item:', neglectedItem);
        Alert.alert('Error', 'Invalid topic data. Please try again.');
        return;
      }

      // Find the subject to get its name for display
      const subject = subjects.find(s => s.id === neglectedItem.subjectId);
      const subjectName = subject ? subject.name : neglectedItem.subject || 'Unknown Subject';
      const topicName = neglectedItem.topic || 'Unknown Topic';

      // Create a new planned session for the neglected topic
      const newPlannedSession = {
        id: Date.now().toString(),
        subjectId: neglectedItem.subjectId,
        topic: topicName,
        startTime: new Date().toTimeString().slice(0, 5), // Current time
        endTime: new Date(Date.now() + 60 * 60 * 1000).toTimeString().slice(0, 5), // 1 hour later
        duration: 60, // 60 minutes
        date: new Date().toISOString().slice(0, 10), // Today
        notes: `Catch-up session for neglected topic: ${topicName}`,
        priority: 'high'
      };

      // Add to planned sessions
      setPlannedSessions(prev => [...prev, newPlannedSession]);
      
      // Show confirmation
      Alert.alert(
        'Added to Plan',
        `${topicName} from ${subjectName} has been added to your study plan for today.`,
        [{ text: 'OK' }]
      );
      
      console.log('Added neglected topic to plan:', newPlannedSession);
    } catch (error) {
      console.error('Error adding to plan:', error);
      Alert.alert('Error', 'Failed to add to plan. Please try again.');
    }
  };

  // Smart Scheduling - dismisses the neglected topics prompt
  const handleDismissPrompt = () => {
    try {
      setShowPrompt(false);
      
      // Optionally, you could set a "don't show again today" flag
      console.log('Neglected topics prompt dismissed');
    } catch (error) {
      console.error('Error dismissing prompt:', error);
    }
  };

  // Apply theme styles - ensure getStyles is available when called
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16, paddingTop: 16 },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: theme.colors.text },
    content: { paddingBottom: 32 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 },
    timerCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
    timerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    timerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    timerText: { marginLeft: 8 },
    timerDisplayContainer: { alignItems: 'center', marginVertical: 16 },
    mainTimerDisplay: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
    timerTime: { fontSize: 32, color: theme.colors.text, fontWeight: 'bold' },
    timerColon: { fontSize: 32, color: theme.colors.text, fontWeight: 'bold', marginHorizontal: 4 },
    timerMetaInfo: { alignItems: 'center' },
    timerSeconds: { fontSize: 16, color: theme.colors.primary, fontWeight: 'bold', marginBottom: 4 },
    timerControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 8 },
    timerButton: { flexDirection: 'row', alignItems: 'center', padding: 8 },
    timerButtonText: { fontSize: 16, color: theme.colors.primary, marginLeft: 8 },
    stopButton: { padding: 8 },
    stopButtonText: { color: '#F44336', fontWeight: 'bold' },
    endButton: { padding: 8 },
    endButtonText: { color: '#FF6B35', fontWeight: 'bold' },
    pomodoroToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    pomodoroLabel: { fontSize: 16, color: theme.colors.text },
    timerSubject: { fontSize: 16, color: theme.colors.text, fontWeight: 'bold' },
    timerTopic: { fontSize: 14, color: theme.colors.textSecondary },
    progressCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
    progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    progressInfo: { flex: 1 },
    progressTitle: { fontSize: 16, color: theme.colors.text, fontWeight: 'bold' },
    progressSubtitle: { fontSize: 14, color: theme.colors.textSecondary },
    streakCard: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
    streakInfo: { flex: 1 },
    streakTitle: { fontSize: 16, color: theme.colors.text, fontWeight: 'bold' },
    streakValue: { fontSize: 14, color: theme.colors.textSecondary },
    subjectCard: { backgroundColor: theme.colors.card, borderRadius: 8, marginBottom: 8 },
    subjectHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    subjectInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    subjectText: { marginLeft: 8 },
    subjectName: { fontSize: 16, color: theme.colors.text, fontWeight: 'bold' },
    subjectTopics: { fontSize: 14, color: theme.colors.textSecondary },
    subjectActions: { flexDirection: 'row', alignItems: 'center' },
    actionButton: { padding: 8 },
    addButton: { backgroundColor: theme.colors.primary, padding: 12, borderRadius: 8, marginTop: 8, alignItems: 'center' },
    addButtonText: { color: theme.colors.background, fontWeight: 'bold', fontSize: 16 },
    emptyCard: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyTitle: { fontSize: 16, color: theme.colors.text, marginTop: 8 },
    emptySubtitle: { fontSize: 14, color: theme.colors.textSecondary },
    settingCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
    settingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    settingInfo: { flex: 1 },
    settingTitle: { fontSize: 16, color: theme.colors.text, fontWeight: 'bold' },
    settingSubtitle: { fontSize: 14, color: theme.colors.textSecondary },
    goalInputContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    goalInput: { backgroundColor: theme.colors.background, color: theme.colors.text, borderRadius: 8, padding: 10, fontSize: 16, width: '60%' },
    goalSaveBtn: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18 },
    goalSaveBtnText: { color: theme.colors.background, fontWeight: 'bold' },
    reminderInputContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    reminderInput: { backgroundColor: theme.colors.background, color: theme.colors.text, borderRadius: 8, padding: 10, fontSize: 16, width: '40%' },
    reminderSaveBtn: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18 },
    reminderSaveBtnText: { color: theme.colors.background, fontWeight: 'bold' },
    resetSection: { 
      flexDirection: 'row', 
      justifyContent: 'space-around', 
      marginTop: 16,
      paddingHorizontal: 8,
    },
    resetButton: { 
      backgroundColor: '#F44336', 
      borderRadius: 8, 
      paddingVertical: 10, 
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      marginHorizontal: 4,
      minHeight: 44,
    },
    resetChartButton: {
      backgroundColor: '#FF9800',
    },
    resetAllButton: {
      backgroundColor: '#D32F2F',
    },
    resetButtonText: { 
      color: '#fff', 
      fontWeight: 'bold', 
      textAlign: 'center',
      fontSize: 12,
      marginLeft: 4,
    },
    chartCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
    calendarCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 24, width: '90%', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: theme.colors.primary, textAlign: 'center' },
    input: { backgroundColor: theme.colors.background, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 8, color: theme.colors.text },
    topicsSection: { marginTop: 12 },
    topicsTitle: { fontWeight: 'bold', marginBottom: 4, color: theme.colors.text },
    topicItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    topicName: { flex: 1, color: theme.colors.text },
    addTopicContainer: { flexDirection: 'row', marginTop: 4 },
    topicInput: { flex: 1, color: theme.colors.text },
    addTopicBtn: { padding: 8 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
    cancelBtn: { backgroundColor: theme.colors.background, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, marginLeft: 8 },
    cancelBtnText: { color: theme.colors.text, fontWeight: 'bold' },
    saveBtn: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, marginLeft: 8 },
    saveBtnText: { color: theme.colors.background, fontWeight: 'bold' },
    progressBarContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    progressBarBg: { height: 10, backgroundColor: theme.colors.background, borderRadius: 5, marginRight: 8, width: '80%' },
    progressBar: { height: 10, backgroundColor: theme.colors.primary, borderRadius: 5 },
    progressPercent: { fontSize: 14, color: theme.colors.text, fontWeight: 'bold' },
    timerMode: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: 'bold', textTransform: 'uppercase' },
    progressDetail: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
    streakDetail: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
    analyticsCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16, marginBottom: 16 },
    analyticsTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 16 },
    subjectAnalytics: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.background },
    subjectAnalyticsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    subjectAnalyticsName: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, flex: 1 },
    subjectAnalyticsTime: { fontSize: 16, color: theme.colors.primary, fontWeight: 'bold' },
    subjectAnalyticsDetails: { marginLeft: 0 },
    subjectAnalyticsDetail: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 2 },
    chartTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8, textAlign: 'center' },
    chartLegend: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.background },
    chartLegendTitle: { fontSize: 14, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 },
    chartLegendItem: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 4 },
    noChartDataContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      minHeight: 200,
    },
    noChartDataText: {
      fontSize: 16,
      color: theme.colors.text,
      marginTop: 12,
      fontWeight: 'bold',
    },
    noChartDataSubtext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    debugInfo: { 
      marginTop: 16, 
      padding: 12, 
      backgroundColor: theme.colors.background, 
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border || theme.colors.textSecondary,
    },
    debugText: { 
      fontSize: 10, 
      color: theme.colors.textSecondary, 
      marginBottom: 2,
      fontFamily: 'monospace'
    },
    
    // Topic Selection Modal Styles
    modalSubtitle: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    topicSelectionButton: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: theme.colors.background, 
      borderRadius: 8, 
      padding: 12, 
      marginVertical: 4,
      borderWidth: 1,
      borderColor: theme.colors.border || theme.colors.background
    },
    topicSelectionButtonText: { 
      color: theme.colors.text, 
      fontSize: 16, 
      marginLeft: 12,
      flex: 1
    },
    modalDivider: { 
      height: 1, 
      backgroundColor: theme.colors.border || theme.colors.background, 
      marginVertical: 16 
    },
    topicsListTitle: { 
      fontSize: 16, 
      fontWeight: 'bold', 
      color: theme.colors.text, 
      marginBottom: 8 
    },
    topicsScrollView: { 
      maxHeight: 200,
      marginBottom: 16
    },
    
    // New Topic Creation Modal Styles
    topicValidationContainer: {
      marginTop: 12,
    },
    topicValidationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    topicValidationText: {
      fontSize: 12,
      flex: 1,
    },
    disabledBtn: {
      backgroundColor: theme.colors.textSecondary,
      opacity: 0.5,
    },
    disabledBtnText: {
      color: theme.colors.background,
      opacity: 0.7,
    },
  });

  // Show loading state while data is being loaded from AsyncStorage
  if (isLoading) {
    return (
      <ScreenLayout
        showHeader={true}
        headerTitle="Study Tracker"
        headerIcon="timer-outline"
        navigation={navigation}
      >
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="hourglass-outline" size={48} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Loading...</Text>
        </View>
      </ScreenLayout>
    );
  }

  // Main UI Render - displays the complete study tracker interface
  return (
    <ScreenLayout
      showHeader={true}
      headerTitle="Study Tracker"
      headerIcon="timer-outline"
      scrollable={true}
      navigation={navigation}
    >
        {/* Active Timer Section - shows when a study session is in progress */}
        {timerSubject && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Session</Text>
            <View style={styles.timerCard}>
              {/* Timer Header - displays subject and topic being studied */}
              <View style={styles.timerHeader}>
                <View style={styles.timerInfo}>
                  <Ionicons name="timer-outline" size={24} color={theme.colors.primary} />
                  <View style={styles.timerText}>
                    <Text style={styles.timerSubject}>{timerSubject?.name || 'General Study'}</Text>
                    <Text style={styles.timerTopic}>{timerTopic || 'No topic selected'}</Text>
                  </View>
                </View>
              </View>
              
              {/* Timer Display - shows current time and session information */}
              <View style={styles.timerDisplayContainer}>
                <View style={styles.mainTimerDisplay}>
                  {/* Minutes display */}
                  <Text style={styles.timerTime}>
                    {Math.floor(timerSeconds / 60)}
                  </Text>
                  <Text style={styles.timerColon}>:</Text>
                  {/* Seconds display with zero padding */}
                  <Text style={styles.timerTime}>
                    {(timerSeconds % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
                {/* Meta information about timer state and mode */}
                <View style={styles.timerMetaInfo}>
                  <Text style={styles.timerSeconds}>
                    {isPomodoroMode 
                      ? `${timerSeconds} seconds remaining`
                      : `${timerSeconds} seconds elapsed`
                    }
                  </Text>
                  <Text style={styles.timerMode}>
                    {isPomodoroMode 
                      ? (pomodoroPhase === 'focus' ? 'FOCUS SESSION' : 'BREAK TIME')
                      : 'STUDY SESSION'
                    }
                  </Text>
                </View>
              </View>

              {/* Timer Control Buttons - pause/resume, stop, and end session */}
              <View style={styles.timerControls}>
                {/* Pause/Resume Button */}
                <TouchableOpacity 
                  style={styles.timerButton} 
                  onPress={() => {
                    if (timerActive) {
                      handlePauseTimer();
                    } else {
                      setTimerActive(true);
                    }
                  }}
                >
                  <Ionicons 
                    name={timerActive ? "pause-outline" : "play-outline"} 
                    size={20} 
                    color={theme.colors.primary} 
                  />
                  <Text style={styles.timerButtonText}>
                    {timerActive ? "Pause" : "Resume"}
                  </Text>
                </TouchableOpacity>
                {/* Stop Button - saves session and resets timer */}
                <TouchableOpacity style={[styles.timerButton, styles.stopButton]} onPress={handleStopTimer}>
                  <Ionicons name="stop-outline" size={20} color="#F44336" />
                  <Text style={[styles.timerButtonText, styles.stopButtonText]}>Stop</Text>
                </TouchableOpacity>
                {/* End Session Button - completely ends session and clears state */}
                <TouchableOpacity style={[styles.timerButton, styles.endButton]} onPress={handleEndSession}>
                  <Ionicons name="exit-outline" size={20} color="#FF6B35" />
                  <Text style={[styles.timerButtonText, styles.endButtonText]}>End Session</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.pomodoroToggle}>
                <Text style={styles.pomodoroLabel}>Pomodoro Mode</Text>
                <Switch
                  value={isPomodoroMode}
                  onValueChange={() => {
                    if (timerActive) {
                      Alert.alert(
                        'Switch Timer Mode', 
                        'You have an active timer. What would you like to do?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Pause & Switch', 
                            onPress: () => {
                              setTimerActive(false);
                              setIsPomodoroMode(!isPomodoroMode);
                              if (!isPomodoroMode) {
                                setPomodoroPhase(POMODORO_PHASES.FOCUS);
                                setTimerSeconds(FOCUS_DURATION_SECONDS);
                              } else {
                                // Keep current time when switching from pomodoro to regular
                                if (pomodoroPhase === POMODORO_PHASES.FOCUS) {
                                  setTimerSeconds(FOCUS_DURATION_SECONDS - timerSeconds);
                                }
                              }
                            }
                          }
                        ]
                      );
                      return;
                    }
                    setIsPomodoroMode(!isPomodoroMode);
                    if (!isPomodoroMode) {
                      setPomodoroPhase(POMODORO_PHASES.FOCUS);
                      setTimerSeconds(FOCUS_DURATION_SECONDS);
                    } else {
                      setTimerSeconds(0);
                    }
                  }}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={theme.colors.surface}
                />
              </View>
            </View>
          </View>
        )}

        {/* Reward Summary */}
        <RewardSummaryCard 
          user={currentUser}
          ref={setRewardSummaryRef}
          onPress={() => {
            // Could open a detailed rewards screen here
            console.log('Reward summary tapped');
          }}
        />

        {/* Progress Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Progress</Text>
          
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Ionicons name="trending-up-outline" size={24} color={theme.colors.primary} />
              <View style={styles.progressInfo}>
                <Text style={styles.progressTitle}>Study Goal Progress</Text>
                <Text style={styles.progressSubtitle}>
                  {Math.floor(todaySeconds / 3600)}h {Math.floor((todaySeconds % 3600) / 60)}m {todaySeconds % 60}s of {Math.floor(goals.dailyMinutes / 60)}h {goals.dailyMinutes % 60}m
                </Text>
                <Text style={styles.progressDetail}>
                  Total: {todaySeconds} seconds ({Math.round(todayMinutes)} minutes)
                </Text>
              </View>
            </View>
            
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBg}>
                <View 
                  style={[
                    styles.progressBar, 
                    { width: `${Math.min((todayMinutes / goals.dailyMinutes) * 100, 100)}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressPercent}>
                {Math.round((todayMinutes / goals.dailyMinutes) * 100)}%
              </Text>
            </View>
          </View>

          <View style={styles.streakCard}>
            <Ionicons name="flame-outline" size={24} color={theme.colors.primary} />
            <View style={styles.streakInfo}>
              <Text style={styles.streakTitle}>Study Streak</Text>
              <Text style={styles.streakValue}>{streak} days</Text>
              <Text style={styles.streakDetail}>
                Keep it up! Average: {streak > 0 ? Math.round(todaySeconds / streak) : 0}s per day
              </Text>
            </View>
          </View>
        </View>

        {/* Subjects Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Study Subjects</Text>
          
          {(subjects || []).length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="school-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={styles.emptyTitle}>No subjects yet</Text>
              <Text style={styles.emptySubtitle}>Add your first subject to start tracking</Text>
            </View>
          ) : (
            (subjects || []).map((subject) => (
              <View key={`${subject.id}-${subject.topics?.length || 0}`} style={styles.subjectCard}>
                <View style={styles.subjectHeader}>
                  <View style={styles.subjectInfo}>
                    <Ionicons name="book-outline" size={24} color={theme.colors.primary} />
                    <View style={styles.subjectText}>
                      <Text style={styles.subjectName}>{subject.name}</Text>
                      <Text style={styles.subjectTopics}>
                        {subject.topics?.length > 0 ? `${subject.topics.length} topics` : 'No topics'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.subjectActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => {
                        // If subject has topics, show custom topic selection modal
                        if (subject.topics && subject.topics.length > 0) {
                          setSelectedSubjectForTopic(subject);
                          setTopicSelectionModalVisible(true);
                        } else {
                          // No topics, show option to add topic or start without
                          Alert.alert(
                            'Start Study Session',
                            `${subject.name} has no topics yet. Would you like to add a topic or start studying without a specific topic?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { 
                                text: 'No Specific Topic', 
                                onPress: () => handleStartTimer(subject, '')
                              },
                              {
                                text: 'Add Topic First',
                                onPress: () => handleAddNewTopicForSession(subject)
                              }
                            ]
                          );
                        }
                      }}
                    >
                      <Ionicons name="play-outline" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => openTopicModal(subject)}
                    >
                      <Ionicons name="list-outline" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => {
                        setEditingSubject(subject);
                        setSubjectName(subject.name);
                        setModalVisible(true);
                      }}
                    >
                      <Ionicons name="create-outline" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleDeleteSubject(subject.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
          
          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Ionicons name="add-outline" size={24} color={theme.colors.background} />
            <Text style={styles.addButtonText}>Add Subject</Text>
          </TouchableOpacity>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingHeader}>
              <Ionicons name="flag-outline" size={24} color={theme.colors.primary} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Daily Goal</Text>
                <Text style={styles.settingSubtitle}>Set your daily study target</Text>
              </View>
            </View>
            <View style={styles.goalInputContainer}>
              <TextInput
                style={styles.goalInput}
                placeholder="Minutes"
                placeholderTextColor={theme.colors.textSecondary}
                value={goalInput}
                onChangeText={setGoalInput}
                keyboardType="numeric"
              />
              <TouchableOpacity style={styles.goalSaveBtn} onPress={updateGoal}>
                <Text style={styles.goalSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingHeader}>
              <Ionicons name="notifications-outline" size={24} color={theme.colors.primary} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Study Reminder</Text>
                <Text style={styles.settingSubtitle}>Daily reminder time</Text>
              </View>
            </View>
            <View style={styles.reminderInputContainer}>
              <TextInput
                style={styles.reminderInput}
                placeholder="HH:MM (24h)"
                placeholderTextColor={theme.colors.textSecondary}
                value={reminderTime}
                onChangeText={setReminderTime}
              />
              <TouchableOpacity style={styles.reminderSaveBtn} onPress={handleSetReminder}>
                <Text style={styles.reminderSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.resetSection}>
            <TouchableOpacity style={styles.resetButton} onPress={handleResetToday}>
              <Ionicons name="refresh-outline" size={16} color="#FFF" />
              <Text style={styles.resetButtonText}>Reset Today</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.resetButton, styles.resetChartButton]} onPress={handleResetChartData}>
              <Ionicons name="bar-chart-outline" size={16} color="#FFF" />
              <Text style={styles.resetButtonText}>Reset Charts</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.resetButton, styles.resetAllButton]} onPress={handleResetAllData}>
              <Ionicons name="trash-outline" size={16} color="#FFF" />
              <Text style={styles.resetButtonText}>Reset All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Analytics Section */}
        {(sessions || []).length > 0 && (subjects || []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Analytics</Text>
            
            {/* Detailed Time Breakdown */}
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>Detailed Time Analysis</Text>
              {(subjects || []).slice(0, 5).map(subject => {
                const subjectSessions = (sessions || []).filter(s => s.subjectId === subject.id);
                const totalSeconds = subjectSessions.reduce((sum, s) => sum + s.duration, 0);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                const sessionCount = subjectSessions.length;
                
                if (totalSeconds === 0) return null;
                
                return (
                  <View key={subject.id} style={styles.subjectAnalytics}>
                    <View style={styles.subjectAnalyticsHeader}>
                      <Text style={styles.subjectAnalyticsName}>{subject.name}</Text>
                      <Text style={styles.subjectAnalyticsTime}>
                        {hours > 0 && `${hours}h `}{minutes > 0 && `${minutes}m `}{seconds}s
                      </Text>
                    </View>
                    <View style={styles.subjectAnalyticsDetails}>
                      <Text style={styles.subjectAnalyticsDetail}>
                        {totalSeconds} total seconds • {sessionCount} sessions
                      </Text>
                      <Text style={styles.subjectAnalyticsDetail}>
                        Avg: {sessionCount > 0 ? Math.round(totalSeconds / sessionCount) : 0}s per session
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
            
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Study Time by Subject (Minutes)</Text>
              {chartData && chartData.labels && chartData.labels.length > 0 ? (
                <BarChart
                  data={chartData}
                  width={SCREEN_WIDTH - 64}
                  height={200}
                  yAxisLabel=""
                  yAxisSuffix=" min"
                  showValuesOnTopOfBars={true}
                  fromZero={true}
                  chartConfig={{
                    backgroundColor: theme.colors.background,
                    backgroundGradientFrom: theme.colors.background,
                    backgroundGradientTo: theme.colors.background,
                    decimalPlaces: 0,
                    color: (opacity = 1) => theme.colors.primary,
                    labelColor: (opacity = 1) => theme.colors.text,
                    style: { borderRadius: 16 },
                    propsForDots: { r: "3", strokeWidth: "1", stroke: theme.colors.primary },
                    barPercentage: 0.7,
                    fillShadowGradient: theme.colors.primary,
                    fillShadowGradientOpacity: 0.8,
                  }}
                  style={{ 
                    marginVertical: 8, 
                    borderRadius: 16,
                    paddingRight: 20, // Add padding to prevent label cutoff
                  }}
                />
              ) : (
                <View style={styles.noChartDataContainer}>
                  <Ionicons name="bar-chart-outline" size={48} color={theme.colors.textSecondary} />
                  <Text style={styles.noChartDataText}>No chart data available</Text>
                  <Text style={styles.noChartDataSubtext}>
                    {subjects?.length === 0 ? 'Add subjects to see chart data' : 'Complete study sessions to see chart data'}
                  </Text>
                </View>
              )}
              
              {/* Chart Legend with Seconds */}
              <View style={styles.chartLegend}>
                <Text style={styles.chartLegendTitle}>Study Time Breakdown:</Text>
                {(subjects || []).map(subject => {
                  const totalSeconds = (sessions || [])
                    .filter(s => s.subjectId === subject.id)
                    .reduce((sum, s) => sum + s.duration, 0);
                  
                  return (
                    <Text key={subject.id} style={styles.chartLegendItem}>
                      {subject.name}: {totalSeconds > 0 ? `${totalSeconds}s (${(totalSeconds / 60).toFixed(1)} min)` : 'No study time yet'}
                    </Text>
                  );
                })}
                
                {/* Debug Information */}
                <View style={styles.debugInfo}>
                  <Text style={styles.debugText}>
                    Debug: {subjects?.length || 0} subjects, {sessions?.length || 0} sessions total
                  </Text>
                  <Text style={styles.debugText}>
                    Chart Labels: {chartData.labels?.join(', ') || 'None'}
                  </Text>
                  <Text style={styles.debugText}>
                    Chart Values: {chartData.datasets?.[0]?.data?.join(', ') || 'None'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Calendar Section */}
        {/* Today's Planned Sessions */}
        <View style={styles.section}>
          <LinkedSessionsView 
            refreshTrigger={refreshLinkedSessions}
            timerSubject={timerSubject}
            timerActive={timerActive}
            timerTopic={timerTopic}
            onStartSession={onStartSession}
            plannedSessions={plannedSessions}
            subjects={subjects}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Study Calendar</Text>
          <View style={styles.calendarCard}>
            <StudyCalendar 
              sessions={sessions || []} 
              subjects={subjects || []}
              plannedSessions={plannedSessions || []}
              onAddPlannedSession={handleAddPlannedSession}
              onEditPlannedSession={handleEditPlannedSession}
              onDeletePlannedSession={handleDeletePlannedSession}
              onDeleteCompletedSession={handleDeleteCompletedSession}
            />
          </View>
        </View>

      {/* Smart Scheduling Prompt */}
      {showPrompt && (neglected || []).length > 0 && (
        <SchedulingPrompt
          neglected={neglected || []}
          onAddToPlan={handleAddToPlan}
          onDismiss={handleDismissPrompt}
        />
      )}

      {/* Subject Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingSubject ? 'Edit Subject' : 'Add Subject'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Subject name"
              placeholderTextColor={theme.colors.textSecondary}
              value={subjectName}
              onChangeText={setSubjectName}
            />
            {!editingSubject && (
              <View style={styles.topicsSection}>
                <Text style={styles.topicsTitle}>Topics (optional):</Text>
                {(newSubjectTopics || []).map((item, index) => (
                  <View key={item.name + index} style={styles.topicItem}>
                    <Text style={styles.topicName}>{item.name}</Text>
                    <TouchableOpacity onPress={() => handleRemoveNewSubjectTopic(item.name)}>
                      <Ionicons name="close-outline" size={20} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.addTopicContainer}>
                  <TextInput
                    style={[styles.input, styles.topicInput]}
                    placeholder="New topic name"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={newSubjectTopicName}
                    onChangeText={setNewSubjectTopicName}
                  />
                  <TouchableOpacity style={styles.addTopicBtn} onPress={handleAddNewSubjectTopic}>
                    <Ionicons name="add-outline" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => {
                  setModalVisible(false);
                  setEditingSubject(null);
                  setSubjectName('');
                  setNewSubjectTopics([]);
                  setNewSubjectTopicName('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveBtn} 
                onPress={editingSubject ? handleEditSubject : handleAddSubject}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Topic Modal */}
      <Modal visible={topicModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manage Topics - {topicSubject?.name}</Text>
            {(topicSubject?.topics || []).map((item, index) => (
              <View key={item.name + index} style={styles.topicItem}>
                <Text style={styles.topicName}>{item.name}</Text>
                <TouchableOpacity onPress={() => handleDeleteTopic(item.name)}>
                  <Ionicons name="close-outline" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.addTopicContainer}>
              <TextInput
                style={[styles.input, styles.topicInput]}
                placeholder="New topic name"
                placeholderTextColor={theme.colors.textSecondary}
                value={newTopicName}
                onChangeText={setNewTopicName}
              />
              <TouchableOpacity style={styles.addTopicBtn} onPress={handleAddTopic}>
                <Ionicons name="add-outline" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeTopicModal}>
                <Text style={styles.cancelBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Topic Selection Modal for Starting Sessions */}
      <Modal visible={topicSelectionModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Topic - {selectedSubjectForTopic?.name}</Text>
            <Text style={styles.modalSubtitle}>
              Choose a topic to study or start without a specific topic
            </Text>
            
            {/* General Session Options */}
            <TouchableOpacity 
              style={styles.topicSelectionButton}
              onPress={() => {
                setTopicSelectionModalVisible(false);
                handleStartTimer(selectedSubjectForTopic, '');
                setSelectedSubjectForTopic(null);
              }}
            >
              <Ionicons name="play-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.topicSelectionButtonText}>No Specific Topic</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.topicSelectionButton}
              onPress={() => {
                setTopicSelectionModalVisible(false);
                handleAddNewTopicForSession(selectedSubjectForTopic);
                setSelectedSubjectForTopic(null);
              }}
            >
              <Ionicons name="add-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.topicSelectionButtonText}>Add New Topic</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.modalDivider} />
            
            {/* Existing Topics */}
            <Text style={styles.topicsListTitle}>Existing Topics:</Text>
            <ScrollView style={styles.topicsScrollView} showsVerticalScrollIndicator={false}>
              {(selectedSubjectForTopic?.topics || []).map((topic, index) => (
                <TouchableOpacity 
                  key={topic.name + index}
                  style={styles.topicSelectionButton}
                  onPress={() => {
                    setTopicSelectionModalVisible(false);
                    handleStartTimer(selectedSubjectForTopic, topic.name);
                    setSelectedSubjectForTopic(null);
                  }}
                >
                  <Ionicons name="bookmark-outline" size={20} color={theme.colors.textSecondary} />
                  <Text style={styles.topicSelectionButtonText}>{topic.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => {
                  setTopicSelectionModalVisible(false);
                  setSelectedSubjectForTopic(null);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Topic Creation Modal for Session Start */}
      <Modal visible={newTopicForSessionModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Topic</Text>
            <Text style={styles.modalSubtitle}>
              Add a new topic to {selectedSubjectForNewTopic?.name} and start studying
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Enter topic name"
              placeholderTextColor={theme.colors.textSecondary}
              value={newTopicForSessionName}
              onChangeText={setNewTopicForSessionName}
              autoFocus={true}
              maxLength={50}
            />
            
            {/* Validation feedback */}
            {newTopicForSessionName.trim() && (
              <View style={styles.topicValidationContainer}>
                {(() => {
                  const trimmedName = newTopicForSessionName.trim();
                  const existingTopics = selectedSubjectForNewTopic?.topics || [];
                  const isDuplicate = existingTopics.some(topic => 
                    topic.name.toLowerCase() === trimmedName.toLowerCase()
                  );
                  
                  return (
                    <View style={styles.topicValidationRow}>
                      <Ionicons 
                        name={isDuplicate ? "close-circle" : "checkmark-circle"} 
                        size={16} 
                        color={isDuplicate ? "#F44336" : "#4CAF50"} 
                      />
                      <Text style={[
                        styles.topicValidationText,
                        { color: isDuplicate ? "#F44336" : "#4CAF50" }
                      ]}>
                        {isDuplicate 
                          ? "This topic name already exists"
                          : `"${trimmedName}" is available`
                        }
                      </Text>
                    </View>
                  );
                })()}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => {
                  setNewTopicForSessionModalVisible(false);
                  setSelectedSubjectForNewTopic(null);
                  setNewTopicForSessionName('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.saveBtn,
                  (!newTopicForSessionName.trim() || 
                   (selectedSubjectForNewTopic?.topics || []).some(topic => 
                     topic.name.toLowerCase() === newTopicForSessionName.trim().toLowerCase()
                   )) && styles.disabledBtn
                ]}
                onPress={handleCreateTopicAndStartSession}
                disabled={
                  !newTopicForSessionName.trim() || 
                  (selectedSubjectForNewTopic?.topics || []).some(topic => 
                    topic.name.toLowerCase() === newTopicForSessionName.trim().toLowerCase()
                  )
                }
              >
                <Text style={[
                  styles.saveBtnText,
                  (!newTopicForSessionName.trim() || 
                   (selectedSubjectForNewTopic?.topics || []).some(topic => 
                     topic.name.toLowerCase() === newTopicForSessionName.trim().toLowerCase()
                   )) && styles.disabledBtnText
                ]}>Add & Start Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Timer */}
      {showFloatingTimer && timerSubject && (
        <FloatingTimer
          timerSubject={timerSubject}
          timerTopic={timerTopic}
          timerSeconds={timerSeconds}
          timerActive={timerActive}
          isPomodoroMode={isPomodoroMode}
          pomodoroPhase={pomodoroPhase}
          onPause={handlePauseTimer}
          onResume={() => setTimerActive(true)}
          onStop={handleStopTimer}
          onEndSession={handleEndSession}
          onScrollToTimer={scrollToTimer}
        />
      )}

      {/* Reward Popup */}
      <RewardPopup
        visible={showRewardPopup}
        onClose={() => setShowRewardPopup(false)}
        rewards={currentRewards?.rewards || []}
        totalPointsEarned={currentRewards?.totalPointsEarned || 0}
        currentStreak={currentRewards?.currentStreak || 0}
        isGoalAchieved={currentRewards?.goalAchieved || false}
        goalType={currentRewards?.goalType || ''}
        autoHide={true}
        duration={4000}
      />

      {/* Reward Display Modal - Keep for detailed view */}
      <RewardDisplay
        visible={showRewardModal}
        onClose={() => setShowRewardModal(false)}
        rewards={currentRewards?.rewards || []}
        totalPointsEarned={currentRewards?.totalPointsEarned || 0}
        newTotalPoints={currentRewards?.newTotalPoints || 0}
        currentStreak={currentRewards?.currentStreak || 0}
        achievements={currentRewards?.achievements || []}
      />
    </ScreenLayout>
  );
}