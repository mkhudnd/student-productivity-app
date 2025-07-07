import React, { useState, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, FlatList, TextInput, Alert, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';

export default function StudyCalendar({ sessions, subjects, onAddPlannedSession, plannedSessions = [], onEditPlannedSession, onDeletePlannedSession, onDeleteCompletedSession }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [plannedSubject, setPlannedSubject] = useState('');
  const [plannedDuration, setPlannedDuration] = useState('');
  const [plannedTopic, setPlannedTopic] = useState('');
  
  // Time blocking states
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [useTimeBlocking, setUseTimeBlocking] = useState(false);
  
  // Recurring session states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState('daily'); // daily, weekly, weekdays
  const [recurringEndDate, setRecurringEndDate] = useState('');

  // Edit session states
  const [editingSession, setEditingSession] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Month navigation state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return getCurrentMonthString(today);
  });

  // Helper function to get local date string (YYYY-MM-DD) without timezone conversion
  function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper function to get current month string (YYYY-MM)
  function getCurrentMonthString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  // Month navigation functions
  const goToPreviousMonth = () => {
    try {
      const [year, month] = currentMonth.split('-').map(Number);
      if (isNaN(year) || isNaN(month)) return;
      
      const prevMonth = new Date(year, month - 2, 1); // month - 2 because month is 1-indexed
      setCurrentMonth(getCurrentMonthString(prevMonth));
    } catch (error) {
      console.error('Error navigating to previous month:', error);
    }
  };

  const goToNextMonth = () => {
    try {
      const [year, month] = currentMonth.split('-').map(Number);
      if (isNaN(year) || isNaN(month)) return;
      
      const nextMonth = new Date(year, month, 1); // month is already 1-indexed, so this gives us next month
      setCurrentMonth(getCurrentMonthString(nextMonth));
    } catch (error) {
      console.error('Error navigating to next month:', error);
    }
  };

  const goToToday = () => {
    try {
      const today = new Date();
      setCurrentMonth(getCurrentMonthString(today));
    } catch (error) {
      console.error('Error navigating to today:', error);
    }
  };

  // Get month name for display
  const getMonthName = (monthString) => {
    try {
      if (!monthString || typeof monthString !== 'string') {
        const today = new Date();
        return today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      
      const [year, month] = monthString.split('-').map(Number);
      if (isNaN(year) || isNaN(month)) {
        const today = new Date();
        return today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      
      const date = new Date(year, month - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch (error) {
      console.error('Error getting month name:', error);
      const today = new Date();
      return today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  // Calculate study intensity and create marked dates
  const markedDates = useMemo(() => {
    const marked = {};
    const dailyMinutes = {};

    // Calculate total minutes per day from completed sessions
    if (sessions && Array.isArray(sessions)) {
      sessions.forEach(s => {
        if (!dailyMinutes[s.date]) dailyMinutes[s.date] = 0;
        dailyMinutes[s.date] += s.duration / 60;
      });
    }

    // Mark completed sessions with color-coded intensity
    Object.keys(dailyMinutes).forEach(date => {
      const minutes = dailyMinutes[date];
      let color = '#FFD600'; // Default yellow
      
      if (minutes >= 180) color = '#4CAF50'; // Green for 3+ hours
      else if (minutes >= 120) color = '#FF9800'; // Orange for 2+ hours  
      else if (minutes >= 60) color = '#FFD600'; // Yellow for 1+ hour
      else color = '#FF5722'; // Red for < 1 hour

      marked[date] = {
        marked: true,
        dotColor: color,
        selectedColor: color,
      };
    });

    // Mark planned sessions with a different style
    if (plannedSessions && Array.isArray(plannedSessions)) {
      plannedSessions.forEach(ps => {
        if (marked[ps.date]) {
          // If there's already a completed session, show both dots
          marked[ps.date].dots = [
            { color: marked[ps.date].dotColor }, // Completed session dot
            { color: '#2196F3' } // Planned session dot (blue)
          ];
          marked[ps.date].marked = false; // Remove single dot
          marked[ps.date].markingType = 'multi-dot';
        } else {
          // Only planned session for this date
          marked[ps.date] = {
            marked: true,
            dotColor: '#2196F3', // Blue for planned sessions
            selectedColor: '#2196F3',
          };
        }
      });
    }

    // Mark today
    const today = getLocalDateString(new Date());
    if (!marked[today]) {
      marked[today] = { 
        marked: false,
        selected: true,
        selectedColor: '#333',
      };
    } else {
      marked[today].selected = true;
    }

    return marked;
  }, [sessions, plannedSessions]);

  // Get sessions for selected date
  const sessionsForDate = selectedDate && sessions && Array.isArray(sessions)
    ? sessions.filter(s => s.date === selectedDate)
    : [];

  // Get planned sessions for selected date
  const plannedSessionsForDate = selectedDate && plannedSessions && Array.isArray(plannedSessions)
    ? plannedSessions.filter(ps => ps.date === selectedDate)
    : [];

  // Helper to get subject name by id - Define this before using it in useMemo
  const getSubjectName = (id) => {
    try {
      if (!subjects || !Array.isArray(subjects)) {
        return 'Unknown Subject';
      }
      const subj = subjects.find(s => s.id === id);
      return subj ? subj.name : 'Unknown Subject';
    } catch (error) {
      console.error('Error in getSubjectName:', error);
      return 'Unknown Subject';
    }
  };

  // Helper functions for time blocking
  const validateTimeFormat = (time) => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  };

  const calculateDurationFromTimes = (start, end) => {
    if (!validateTimeFormat(start) || !validateTimeFormat(end)) return 0;
    
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;
    
    if (endTotalMin <= startTotalMin) {
      // Handle next day scenario
      return (24 * 60 - startTotalMin) + endTotalMin;
    }
    
    return endTotalMin - startTotalMin;
  };

  // Generate recurring sessions with local date handling
  const generateRecurringSessions = (baseSession, type, endDate) => {
    const sessions = [];
    const startDate = new Date(baseSession.date + 'T00:00:00'); // Parse as local date
    const endDateTime = new Date(endDate + 'T00:00:00'); // Parse as local date
    
    if (endDateTime <= startDate) return [baseSession];
    
    let currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + 1); // Start from next day
    
    while (currentDate <= endDateTime) {
      let shouldAdd = false;
      
      if (type === 'daily') {
        shouldAdd = true;
      } else if (type === 'weekly') {
        shouldAdd = currentDate.getDay() === startDate.getDay();
      } else if (type === 'weekdays') {
        const dayOfWeek = currentDate.getDay();
        shouldAdd = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
      }
      
      if (shouldAdd && getLocalDateString(currentDate) !== baseSession.date) {
        const newSession = {
          ...baseSession,
          id: `${baseSession.id}_${getLocalDateString(currentDate)}`,
          date: getLocalDateString(currentDate),
        };
        sessions.push(newSession);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return [baseSession, ...sessions];
  };

  // Validate date format helper
  const isValidDate = (dateString) => {
    if (!dateString) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = new Date(dateString + 'T00:00:00'); // Parse as local date
    return date instanceof Date && !isNaN(date);
  };

  // Calculate stats for selected date
  const dateStats = useMemo(() => {
    if (!selectedDate || (sessionsForDate.length === 0 && plannedSessionsForDate.length === 0)) return null;
    
    const totalMinutes = sessionsForDate.reduce((sum, s) => sum + s.duration / 60, 0);
    const plannedMinutes = plannedSessionsForDate.reduce((sum, ps) => sum + ps.plannedDuration, 0);
    const subjectBreakdown = {};
    
    sessionsForDate.forEach(s => {
      const subjectName = getSubjectName(s.subjectId);
      if (!subjectBreakdown[subjectName]) subjectBreakdown[subjectName] = 0;
      subjectBreakdown[subjectName] += s.duration / 60;
    });

    return {
      totalMinutes: Math.round(totalMinutes),
      totalHours: (totalMinutes / 60).toFixed(1),
      sessionCount: sessionsForDate.length,
      plannedMinutes: Math.round(plannedMinutes),
      plannedHours: (plannedMinutes / 60).toFixed(1),
      plannedCount: plannedSessionsForDate.length,
      subjectBreakdown,
    };
  }, [selectedDate, sessionsForDate, plannedSessionsForDate, subjects]);

  // Calculate weekly/monthly stats with local dates
  const getWeeklyStats = () => {
    if (!sessions || !Array.isArray(sessions)) {
      return { totalMinutes: 0, totalHours: '0.0', sessionCount: 0 };
    }
    
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = getLocalDateString(weekStart);
    
    const weekSessions = sessions.filter(s => s.date >= weekStartStr);
    const totalMinutes = weekSessions.reduce((sum, s) => sum + s.duration / 60, 0);
    
    return {
      totalMinutes: Math.round(totalMinutes),
      totalHours: (totalMinutes / 60).toFixed(1),
      sessionCount: weekSessions.length,
    };
  };

  const getMonthlyStats = () => {
    if (!sessions || !Array.isArray(sessions)) {
      return { totalMinutes: 0, totalHours: '0.0', sessionCount: 0 };
    }
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = getLocalDateString(monthStart);
    
    const monthSessions = sessions.filter(s => s.date >= monthStartStr);
    const totalMinutes = monthSessions.reduce((sum, s) => sum + s.duration / 60, 0);
    
    return {
      totalMinutes: Math.round(totalMinutes),
      totalHours: (totalMinutes / 60).toFixed(1),
      sessionCount: monthSessions.length,
    };
  };

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
    setModalVisible(true);
    
    // Show informational message for past dates
    const today = getLocalDateString(new Date());
    if (day.dateString < today) {
      // Small delay to ensure modal is open first
      setTimeout(() => {
        Alert.alert('Viewing Past Date', 'You can view your completed sessions but cannot plan new sessions for past dates.');
      }, 100);
    }
  };

  const handlePlanSession = () => {
    // Check if selected date is in the past (unless editing existing session)
    if (!isEditMode) {
      const today = getLocalDateString(new Date());
      if (selectedDate < today) {
        Alert.alert('Error', 'Cannot plan sessions in the past. Please select today or a future date.');
        return;
      }
    }

    if (!plannedSubject.trim()) {
      Alert.alert('Error', 'Please select a subject');
      return;
    }

    let finalDuration;
    let sessionStartTime = '';
    let sessionEndTime = '';

    if (useTimeBlocking) {
      if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
        Alert.alert('Error', 'Please enter valid time format (HH:MM)');
        return;
      }
      
      finalDuration = calculateDurationFromTimes(startTime, endTime);
      if (finalDuration <= 0) {
        Alert.alert('Error', 'End time must be after start time');
        return;
      }
      
      sessionStartTime = startTime;
      sessionEndTime = endTime;
    } else {
      const duration = parseInt(plannedDuration);
      if (!duration || duration <= 0) {
        Alert.alert('Error', 'Please enter a valid duration');
        return;
      }
      finalDuration = duration;
    }

    // Find subject by name to get ID
    const selectedSubjectObj = subjects.find(s => s.name === plannedSubject);
    if (!selectedSubjectObj) {
      Alert.alert('Error', 'Selected subject not found');
      return;
    }

    const baseSession = {
      id: isEditMode ? editingSession.id : Date.now().toString(),
      date: selectedDate,
      subjectId: selectedSubjectObj.id,
      topic: plannedTopic.trim() || null,
      plannedDuration: finalDuration,
      startTime: sessionStartTime || null,
      endTime: sessionEndTime || null,
      isRecurring: isRecurring,
      recurringType: isRecurring ? recurringType : null,
    };

    if (isEditMode) {
      // Update existing session
      if (onEditPlannedSession) {
        onEditPlannedSession(baseSession);
      }
      Alert.alert('Session Updated!', `Study session updated for ${selectedDate}`);
    } else {
      // Create new session(s)
      let sessionsToAdd = [baseSession];
      let sessionCount = 1;

      if (isRecurring && recurringEndDate) {
        if (!isValidDate(recurringEndDate)) {
          Alert.alert('Error', 'Please enter a valid end date');
          return;
        }
        
        if (recurringEndDate <= selectedDate) {
          Alert.alert('Error', 'End date must be after the start date');
          return;
        }
        
        sessionsToAdd = generateRecurringSessions(baseSession, recurringType, recurringEndDate);
        sessionCount = sessionsToAdd.length;
      }

      // Add all sessions
      if (onAddPlannedSession) {
        sessionsToAdd.forEach(session => {
          onAddPlannedSession(session);
        });
      }
      
      const message = sessionCount === 1 
        ? `${finalDuration} min study session planned for ${selectedDate}${sessionStartTime ? ` from ${sessionStartTime} to ${sessionEndTime}` : ''}`
        : `${sessionCount} recurring sessions planned (${finalDuration} min each)`;
        
      Alert.alert('Session(s) Planned!', message);
    }

    // Reset form
    resetEditForm();
    setPlanModalVisible(false);
  };

  // Helper functions for editing
  const handleEditSession = (session) => {
    setEditingSession(session);
    setPlannedSubject(getSubjectName(session.subjectId));
    setPlannedTopic(session.topic || '');
    setPlannedDuration(session.plannedDuration.toString());
    
    if (session.startTime && session.endTime) {
      setUseTimeBlocking(true);
      setStartTime(session.startTime);
      setEndTime(session.endTime);
    } else {
      setUseTimeBlocking(false);
    }
    
    if (session.isRecurring) {
      setIsRecurring(true);
      setRecurringType(session.recurringType);
    } else {
      setIsRecurring(false);
    }
    
    setIsEditMode(true);
    setModalVisible(false);
    setPlanModalVisible(true);
  };

  const handleDeleteSession = (session) => {
    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete this ${session.isRecurring ? 'recurring ' : ''}study session?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            if (onDeletePlannedSession) {
              onDeletePlannedSession(session.id);
            }
          }
        }
      ]
    );
  };

  const handleDeleteCompletedSession = (session) => {
    Alert.alert(
      'Delete Completed Session',
      `Are you sure you want to delete this completed study session?\n\nSubject: ${getSubjectName(session.subjectId)}\nDuration: ${Math.round(session.duration / 60)} min\n${session.topic ? `Topic: ${session.topic}\n` : ''}${session.notes ? `Notes: ${session.notes}\n` : ''}\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            if (onDeleteCompletedSession) {
              onDeleteCompletedSession(session.id);
            }
          }
        }
      ]
    );
  };

  const resetEditForm = () => {
    setEditingSession(null);
    setIsEditMode(false);
    setPlannedSubject('');
    setPlannedDuration('');
    setPlannedTopic('');
    setStartTime('');
    setEndTime('');
    setUseTimeBlocking(false);
    setIsRecurring(false);
    setRecurringEndDate('');
  };

  const weeklyStats = getWeeklyStats();
  const monthlyStats = getMonthlyStats();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Study Calendar</Text>
      
      {/* Today's Date Display */}
      <View style={styles.todayDateContainer}>
        <Text style={styles.todayDateText}>
          Today: {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Text>
      </View>
      
      {/* Month Navigation Header */}
      <View style={styles.monthNavContainer}>
        <TouchableOpacity style={styles.navButton} onPress={goToPreviousMonth}>
          <Ionicons name="chevron-back" size={24} color="#FFD600" />
        </TouchableOpacity>
        
        <View style={styles.monthDisplayContainer}>
          <Text style={styles.monthTitle}>{getMonthName(currentMonth)}</Text>
          <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.navButton} onPress={goToNextMonth}>
          <Ionicons name="chevron-forward" size={24} color="#FFD600" />
        </TouchableOpacity>
      </View>
      
      {/* Stats Overview */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>This Week</Text>
          <Text style={styles.statValue}>{weeklyStats.totalHours}h</Text>
          <Text style={styles.statSubtext}>{weeklyStats.sessionCount} sessions</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>This Month</Text>
          <Text style={styles.statValue}>{monthlyStats.totalHours}h</Text>
          <Text style={styles.statSubtext}>{monthlyStats.sessionCount} sessions</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <Text style={styles.legendTitle}>Study Intensity:</Text>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#FF5722' }]} />
          <Text style={styles.legendText}>Under 1h</Text>
          <View style={[styles.legendDot, { backgroundColor: '#FFD600' }]} />
          <Text style={styles.legendText}>1-2h</Text>
          <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
          <Text style={styles.legendText}>2-3h</Text>
          <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>3h+</Text>
          <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
          <Text style={styles.legendText}>Planned</Text>
        </View>
      </View>

      <View style={styles.calendarContainer}>
        <Calendar
          current={getLocalDateString(new Date())} // Set to today's date
          markedDates={markedDates}
          onDayPress={handleDayPress}
          onMonthChange={(month) => {
            const monthString = `${month.year}-${String(month.month).padStart(2, '0')}`;
            setCurrentMonth(monthString);
          }}
          enableSwipeMonths={true} // Enable swipe navigation
          hideArrows={false} // Show arrows for navigation
          disableMonthChange={false} // Allow month changes via swipe
          theme={{
            backgroundColor: '#181818',
            calendarBackground: '#181818',
            dayTextColor: '#fff',
            monthTextColor: '#FFD600',
            selectedDayBackgroundColor: '#FFD600',
            selectedDayTextColor: '#181818',
            todayTextColor: '#FFD600',
            textSectionTitleColor: '#FFD600',
          }}
          style={{ borderRadius: 12 }}
        />
      </View>

      {/* Session Details Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Sessions on {selectedDate}</Text>
              
              {dateStats && (
                <View style={styles.dateStatsContainer}>
                  <Text style={styles.dateStatsTitle}>Daily Summary</Text>
                  
                  {dateStats.sessionCount > 0 && (
                    <>
                      <Text style={styles.dateStatsText}>✅ Completed: {dateStats.totalHours} hours ({dateStats.totalMinutes} min)</Text>
                      <Text style={styles.dateStatsText}>📚 Sessions: {dateStats.sessionCount}</Text>
                    </>
                  )}
                  
                  {dateStats.plannedCount > 0 && (
                    <>
                      <Text style={styles.dateStatsText}>📅 Planned: {dateStats.plannedHours} hours ({dateStats.plannedMinutes} min)</Text>
                      <Text style={styles.dateStatsText}>🎯 Planned Sessions: {dateStats.plannedCount}</Text>
                    </>
                  )}
                  
                  {dateStats.sessionCount > 0 && (
                    <>
                      <Text style={styles.subjectBreakdownTitle}>Subject Breakdown:</Text>
                      {Object.entries(dateStats.subjectBreakdown).map(([subject, minutes]) => (
                        <Text key={subject} style={styles.subjectBreakdownText}>
                          {subject}: {Math.round(minutes)} min
                        </Text>
                      ))}
                    </>
                  )}
                </View>
              )}

              {/* Completed Sessions */}
              {sessionsForDate.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>✅ Completed Sessions</Text>
                  {sessionsForDate.map((item) => (
                    <View key={item.id} style={styles.sessionRow}>
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionSubject}>{getSubjectName(item.subjectId)}</Text>
                        {item.topic && <Text style={styles.sessionTopic}>{item.topic}</Text>}
                        {item.notes && <Text style={styles.sessionNotes}>{item.notes}</Text>}
                      </View>
                      <View style={styles.sessionActions}>
                        <Text style={styles.sessionDuration}>{Math.round(item.duration / 60)} min</Text>
                        <View style={styles.actionButtons}>
                          <TouchableOpacity 
                            style={styles.deleteButton}
                            onPress={() => handleDeleteCompletedSession(item)}
                          >
                            <Text style={styles.deleteButtonText}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* Planned Sessions */}
              {plannedSessionsForDate.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>📅 Planned Sessions</Text>
                  {plannedSessionsForDate.map((item) => (
                    <View key={item.id} style={[styles.sessionRow, styles.plannedSessionRow]}>
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionSubject}>{getSubjectName(item.subjectId)}</Text>
                        {item.topic && <Text style={styles.sessionTopic}>{item.topic}</Text>}
                        {item.startTime && item.endTime && (
                          <Text style={styles.sessionTime}>
                            🕒 {item.startTime} - {item.endTime}
                          </Text>
                        )}
                        {item.isRecurring && (
                          <Text style={styles.recurringBadge}>
                            🔄 {item.recurringType === 'daily' ? 'Daily' : 
                                item.recurringType === 'weekly' ? 'Weekly' : 'Weekdays'}
                          </Text>
                        )}
                      </View>
                      <View style={styles.sessionActions}>
                        <Text style={styles.plannedDuration}>{item.plannedDuration} min</Text>
                        <View style={styles.actionButtons}>
                          <TouchableOpacity 
                            style={styles.editButton}
                            onPress={() => handleEditSession(item)}
                          >
                            <Text style={styles.editButtonText}>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.deleteButton}
                            onPress={() => handleDeleteSession(item)}
                          >
                            <Text style={styles.deleteButtonText}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {sessionsForDate.length === 0 && plannedSessionsForDate.length === 0 && (
                <Text style={styles.emptyText}>No sessions recorded or planned</Text>
              )}

              <View style={styles.modalActions}>
                {(() => {
                  const today = getLocalDateString(new Date());
                  const isPastDate = selectedDate < today;
                  
                  return (
                    <>
                      {!isPastDate && (
                        <TouchableOpacity 
                          style={styles.planBtn} 
                          onPress={() => {
                            setModalVisible(false);
                            setPlanModalVisible(true);
                          }}
                        >
                          <Text style={styles.planBtnText}>Plan Session</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity 
                        style={[styles.closeBtn, isPastDate && { flex: 1 }]} 
                        onPress={() => setModalVisible(false)}
                      >
                        <Text style={styles.closeBtnText}>Close</Text>
                      </TouchableOpacity>
                    </>
                  );
                })()}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Plan Session Modal */}
      <Modal visible={planModalVisible} transparent animationType="slide" onRequestClose={() => setPlanModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{isEditMode ? 'Edit Study Session' : 'Plan Study Session'}</Text>
            <Text style={styles.planDate}>Date: {selectedDate}</Text>
            
            <ScrollView 
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: '75%' }}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <Text style={styles.inputLabel}>Subject:</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {(subjects || []).map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.subjectChip,
                      plannedSubject === item.name && styles.subjectChipSelected
                    ]}
                    onPress={() => {
                      console.log('Subject selected:', item.name);
                      setPlannedSubject(item.name);
                    }}
                  >
                    <Text style={[
                      styles.subjectChipText,
                      plannedSubject === item.name && styles.subjectChipTextSelected
                    ]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Time Blocking Toggle */}
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Time Blocking:</Text>
                <TouchableOpacity
                  style={[styles.toggleBtn, useTimeBlocking && styles.toggleBtnActive]}
                  onPress={() => setUseTimeBlocking(!useTimeBlocking)}
                >
                  <Text style={[styles.toggleBtnText, useTimeBlocking && styles.toggleBtnTextActive]}>
                    {useTimeBlocking ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Time inputs or Duration input */}
              {useTimeBlocking ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.inputLabel}>Time Block:</Text>
                  <View style={styles.timeRow}>
                    <TextInput
                      style={[styles.input, styles.timeInput]}
                      placeholder="09:00"
                      value={startTime}
                      onChangeText={(text) => {
                        // Only allow numbers and colon
                        let cleanText = text.replace(/[^0-9:]/g, '');
                        
                        // Handle auto colon insertion
                        if (cleanText.length === 2 && cleanText.indexOf(':') === -1) {
                          cleanText = cleanText + ':';
                        } else if (cleanText.length === 3 && cleanText.indexOf(':') === -1) {
                          cleanText = cleanText.slice(0, 2) + ':' + cleanText.slice(2);
                        }
                        
                        // Limit to 5 characters (HH:MM)
                        if (cleanText.length > 5) {
                          cleanText = cleanText.slice(0, 5);
                        }
                        
                        setStartTime(cleanText);
                      }}
                      keyboardType="numeric"
                      maxLength={5}
                    />
                    <Text style={styles.timeToText}>to</Text>
                    <TextInput
                      style={[styles.input, styles.timeInput]}
                      placeholder="11:00"
                      value={endTime}
                      onChangeText={(text) => {
                        // Only allow numbers and colon
                        let cleanText = text.replace(/[^0-9:]/g, '');
                        
                        // Handle auto colon insertion
                        if (cleanText.length === 2 && cleanText.indexOf(':') === -1) {
                          cleanText = cleanText + ':';
                        } else if (cleanText.length === 3 && cleanText.indexOf(':') === -1) {
                          cleanText = cleanText.slice(0, 2) + ':' + cleanText.slice(2);
                        }
                        
                        // Limit to 5 characters (HH:MM)
                        if (cleanText.length > 5) {
                          cleanText = cleanText.slice(0, 5);
                        }
                        
                        setEndTime(cleanText);
                      }}
                      keyboardType="numeric"
                      maxLength={5}
                    />
                  </View>
                  {startTime && endTime && validateTimeFormat(startTime) && validateTimeFormat(endTime) && (
                    <Text style={styles.durationPreview}>
                      Duration: {calculateDurationFromTimes(startTime, endTime)} minutes
                    </Text>
                  )}
                </View>
              ) : (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.inputLabel}>Duration (minutes):</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 60"
                    value={plannedDuration}
                    onChangeText={(text) => {
                      console.log('Duration changed:', text);
                      setPlannedDuration(text);
                    }}
                    keyboardType="numeric"
                  />
                </View>
              )}

              {/* Recurring Sessions Toggle */}
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Recurring:</Text>
                <TouchableOpacity
                  style={[styles.toggleBtn, isRecurring && styles.toggleBtnActive]}
                  onPress={() => setIsRecurring(!isRecurring)}
                >
                  <Text style={[styles.toggleBtnText, isRecurring && styles.toggleBtnTextActive]}>
                    {isRecurring ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Recurring Options */}
              {isRecurring && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.inputLabel}>Repeat:</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 12 }}
                  >
                    {[
                      { key: 'daily', label: 'Daily' },
                      { key: 'weekdays', label: 'Weekdays' },
                      { key: 'weekly', label: 'Weekly' }
                    ].map((option) => (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.recurringChip,
                          recurringType === option.key && styles.recurringChipSelected
                        ]}
                        onPress={() => setRecurringType(option.key)}
                      >
                        <Text style={[
                          styles.recurringChipText,
                          recurringType === option.key && styles.recurringChipTextSelected
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.inputLabel}>End Date:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={recurringEndDate}
                    onChangeText={(text) => {
                      // Only allow numbers and dashes
                      let cleanText = text.replace(/[^0-9-]/g, '');
                      
                      // Handle auto dash insertion
                      if (cleanText.length === 4 && cleanText.indexOf('-') === -1) {
                        // User typed exactly 4 digits, add first dash
                        cleanText = cleanText + '-';
                      } else if (cleanText.length === 5 && cleanText.indexOf('-') === -1) {
                        // User typed 5th character without dash, insert dash after 4th
                        cleanText = cleanText.slice(0, 4) + '-' + cleanText.slice(4);
                      } else if (cleanText.length === 7 && cleanText.lastIndexOf('-') === 4) {
                        // User typed 7th character, add second dash
                        cleanText = cleanText + '-';
                      } else if (cleanText.length === 8 && cleanText.lastIndexOf('-') === 4) {
                        // User typed 8th character without second dash, insert it
                        cleanText = cleanText.slice(0, 7) + '-' + cleanText.slice(7);
                      }
                      
                      // Limit to 10 characters (YYYY-MM-DD)
                      if (cleanText.length > 10) {
                        cleanText = cleanText.slice(0, 10);
                      }
                      
                      setRecurringEndDate(cleanText);
                    }}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  
                  {/* Date validation message */}
                  {recurringEndDate.length === 10 && (
                    <Text style={styles.dateValidation}>
                      {(() => {
                        const today = getLocalDateString(new Date());
                        
                        if (!isValidDate(recurringEndDate)) {
                          return '❌ Invalid date (e.g., Feb 30th)';
                        } else if (recurringEndDate <= selectedDate) {
                          return '❌ End date must be after start date';
                        } else if (recurringEndDate <= today) {
                          return '❌ End date cannot be in the past';
                        } else {
                          return '✅ Valid date';
                        }
                      })()}
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.inputLabel}>Topic (optional):</Text>
              <TextInput
                style={styles.input}
                placeholder="What will you study?"
                value={plannedTopic}
                onChangeText={setPlannedTopic}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.saveBtn} onPress={handlePlanSession}>
                <Text style={styles.saveBtnText}>{isEditMode ? 'Update Session' : 'Plan Session'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                setPlanModalVisible(false);
                resetEditForm();
              }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    backgroundColor: '#232323',
    borderRadius: 12,
    padding: 12
  },
  header: {
    color: '#FFD600',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center'
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  statBox: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginHorizontal: 4
  },
  statLabel: {
    color: '#FFD600',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 4
  },
  statValue: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18
  },
  statSubtext: {
    color: '#AAA',
    fontSize: 12
  },
  legendContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16
  },
  legendTitle: {
    color: '#FFD600',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 8
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4
  },
  legendText: {
    color: '#fff',
    fontSize: 12,
    marginRight: 8
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#232323',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '85%'
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
    color: '#FFD600',
    textAlign: 'center'
  },
  dateStatsContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16
  },
  dateStatsTitle: {
    color: '#FFD600',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8
  },
  dateStatsText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4
  },
  subjectBreakdownTitle: {
    color: '#FFD600',
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4
  },
  subjectBreakdownText: {
    color: '#AAA',
    fontSize: 14,
    marginBottom: 2,
    marginLeft: 8
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8
  },
  sessionInfo: {
    flex: 1
  },
  sessionSubject: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  sessionTopic: {
    color: '#FFD600',
    fontSize: 14,
    fontStyle: 'italic'
  },
  sessionNotes: {
    color: '#AAA',
    fontSize: 12
  },
  sessionDuration: {
    color: '#FFD600',
    fontSize: 16,
    fontWeight: 'bold'
  },
  emptyText: {
    color: '#AAA',
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: 20
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16
  },
  planBtn: {
    backgroundColor: '#FFD600',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 8
  },
  planBtnText: {
    color: '#181818',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center'
  },
  closeBtn: {
    backgroundColor: '#666',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center'
  },
  planDate: {
    color: '#FFD600',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12
  },
  inputLabel: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 6,
    marginTop: 8
  },
  input: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    fontSize: 16,
    marginBottom: 8
  },
  subjectChip: {
    backgroundColor: '#444',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4
  },
  subjectChipSelected: {
    backgroundColor: '#FFD600'
  },
  subjectChipText: {
    color: '#fff',
    fontSize: 14
  },
  subjectChipTextSelected: {
    color: '#181818',
    fontWeight: 'bold'
  },
  saveBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 8
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center'
  },
  cancelBtn: {
    backgroundColor: '#666',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20
  },
  cancelBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center'
  },
  sectionTitle: {
    color: '#FFD600',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8
  },
  plannedDuration: {
    color: '#FFD600',
    fontSize: 16,
    fontWeight: 'bold'
  },
  plannedSessionRow: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12
  },
  sessionTime: {
    color: '#FFD600',
    fontSize: 14,
    fontStyle: 'italic'
  },
  recurringBadge: {
    backgroundColor: '#FFD600',
    borderRadius: 8,
    padding: 4,
    marginLeft: 8
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  toggleBtn: {
    backgroundColor: '#444',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  toggleBtnActive: {
    backgroundColor: '#FFD600'
  },
  toggleBtnText: {
    color: '#fff',
    fontSize: 14
  },
  toggleBtnTextActive: {
    color: '#181818',
    fontWeight: 'bold'
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  timeInput: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    fontSize: 16,
    flex: 1,
    marginHorizontal: 4
  },
  timeToText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 8
  },
  durationPreview: {
    color: '#FFD600',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8
  },
  recurringChip: {
    backgroundColor: '#444',
    borderRadius: 16,
    padding: 8,
    marginHorizontal: 4
  },
  recurringChipSelected: {
    backgroundColor: '#FFD600'
  },
  recurringChipText: {
    color: '#fff',
    fontSize: 14
  },
  recurringChipTextSelected: {
    color: '#181818',
    fontWeight: 'bold'
  },
  toggleLabel: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 8
  },
  dateValidation: {
    color: '#FFD600',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8
  },
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  editButton: {
    backgroundColor: '#FFD600',
    borderRadius: 12,
    padding: 4,
    marginRight: 4
  },
  editButtonText: {
    color: '#181818',
    fontWeight: 'bold',
    fontSize: 16
  },
  deleteButton: {
    backgroundColor: '#FF5722',
    borderRadius: 12,
    padding: 4
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  todayDateContainer: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center'
  },
  todayDateText: {
    color: '#FFD600',
    fontSize: 16,
    fontWeight: 'bold'
  },
  monthNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8
  },
  navButton: {
    padding: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  monthDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  monthTitle: {
    color: '#FFD600',
    fontWeight: 'bold',
    fontSize: 18,
    marginHorizontal: 16,
    textAlign: 'center'
  },
  todayButton: {
    padding: 8,
    backgroundColor: '#444',
    borderRadius: 6,
    marginLeft: 12
  },
  todayButtonText: {
    color: '#FFD600',
    fontWeight: 'bold',
    fontSize: 14
  },
  calendarContainer: {
    backgroundColor: '#232323',
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
    overflow: 'hidden'
  }
}); 