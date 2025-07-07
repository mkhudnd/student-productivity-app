import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Platform, FlatList, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FlatList as RNFlatList, TextInput as RNTextInput } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { NotificationService } from '../../utils/NotificationService';
import ScreenLayout from '../../components/ScreenLayout';

const CATEGORIES = [
  { label: 'Study', icon: 'book-outline', color: '#4CAF50' },
  { label: 'Exercise', icon: 'fitness-outline', color: '#2196F3' },
  { label: 'Devotion', icon: 'heart-outline', color: '#FFC107' },
  { label: 'Assignments', icon: 'clipboard-outline', color: '#FF9800' },
];

const PRIORITIES = [
  { label: 'High', value: 'high', color: '#F44336', icon: 'arrow-up-outline' },
  { label: 'Medium', value: 'medium', color: '#FF9800', icon: 'remove-outline' },
  { label: 'Low', value: 'low', color: '#4CAF50', icon: 'arrow-down-outline' },
];

const REPEAT_OPTIONS = [
  { label: 'None', value: 'none', icon: 'close-outline' },
  { label: 'Daily', value: 'daily', icon: 'refresh-outline' },
  { label: 'Weekly', value: 'weekly', icon: 'calendar-outline' },
];

// Generate all 24 times in HH:00 format for the grid and modal
const ALL_TIMES = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 00:00 to 23:00

// Helper to get today's date string (YYYY-MM-DD)
function getToday() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// Helper to get week start (Monday)
function getWeekStart() {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

// Helper to get date string for a Date object
function getDateString(date) {
  return date.toISOString().slice(0, 10);
}

// Helper to get all days in current streak
function getStreakDays(completedDays) {
  let streak = 0;
  let d = new Date();
  while (completedDays.has(getDateString(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export default function PlannerScreen({ navigation }) {
  const { theme } = useTheme();
  const { currentUser } = useUser();
  
  // Create user-specific storage key
  const getPlannerStorageKey = () => {
    if (!currentUser || !currentUser.email) return 'planner_data';
    return `planner_data_${currentUser.email}`;
  };
  
  const [tasks, setTasks] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [newTask, setNewTask] = useState({
    title: '',
    time: '08:00',
    endTime: '09:00',
    category: CATEGORIES[0],
    priority: PRIORITIES[1].value,
    subtasks: [],
    reminder: null,
    notificationId: null,
    repeat: 'none',
    autoNotify: true,
  });
  const [subtaskInput, setSubtaskInput] = useState('');
  const [reminderTime, setReminderTime] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [search, setSearch] = useState('');
  const [resizingTaskId, setResizingTaskId] = useState(null);
  // Track completed days for streaks (in-memory for now)
  const [completedDays, setCompletedDays] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Custom time picker states
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [timePickerType, setTimePickerType] = useState('start'); // 'start' or 'end'
  const [availableTimes, setAvailableTimes] = useState([]);

  // Notification listeners
  const notificationListener = useRef();
  const responseListener = useRef();

  // Initialize notifications and load tasks on component mount
  useEffect(() => {
    initializeNotifications();
    loadTasks();

    // Set up notification listeners
    notificationListener.current = NotificationService.addNotificationReceivedListener(handleNotificationReceived);
    responseListener.current = NotificationService.addNotificationResponseListener(handleNotificationResponse);

    return () => {
      // Clean up listeners
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const initializeNotifications = async () => {
    try {
      const success = await NotificationService.initialize();
      setNotificationsEnabled(success);
      
      if (!success) {
        Alert.alert(
          'Notifications Disabled',
          'Enable notifications in your device settings to receive activity reminders.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
      setNotificationsEnabled(false);
    }
  };

  const handleNotificationReceived = (notification) => {
    console.log('Notification received:', notification);
    // Handle foreground notification display
    const { title, body } = notification.request.content;
    
    // You could show a custom in-app notification here
    Alert.alert(
      title,
      body,
      [
        { text: 'Dismiss', style: 'cancel' },
        { text: 'View Activity', onPress: () => {
          // Navigate to the specific activity or highlight it
          const activityId = notification.request.content.data?.activityId;
          if (activityId) {
            // Find and highlight the activity
            highlightActivity(activityId);
          }
        }},
      ]
    );
  };

  const handleNotificationResponse = (response) => {
    console.log('Notification tapped:', response);
    const activityId = response.notification.request.content.data?.activityId;
    
    if (activityId) {
      // Find the activity and show details or mark as started
      const activity = tasks.find(t => t.id === activityId);
      if (activity && !activity.completed) {
        Alert.alert(
          `Time for: ${activity.title}`,
          'Would you like to mark this activity as started?',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Mark Started', onPress: () => {
              // You could add a "started" status or just highlight it
              highlightActivity(activityId);
            }},
            { text: 'Mark Complete', onPress: () => handleToggleTaskComplete(activityId) },
          ]
        );
      }
    }
  };

  const highlightActivity = (activityId) => {
    // You could implement visual highlighting here
    console.log('Highlighting activity:', activityId);
    // For now, just scroll to or focus on the activity
  };

  // Load tasks from AsyncStorage on component mount
  useEffect(() => {
    if (currentUser) {
      loadTasks();
    } else {
      setIsLoading(false);
    }
  }, [currentUser]);

  // Save tasks to AsyncStorage whenever tasks change
  useEffect(() => {
    if (!isLoading && currentUser) {
      saveTasks();
    }
  }, [tasks, isLoading, currentUser]);

  const loadTasks = async () => {
    try {
      if (!currentUser) {
        setTasks([]);
        setIsLoading(false);
        return;
      }
      
      const storedData = await AsyncStorage.getItem(getPlannerStorageKey());
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setTasks(parsedData.tasks || []);
        setCompletedDays(new Set(parsedData.completedDays || []));
      } else {
        // Start with empty planner
        setTasks([]);
      }
    } catch (error) {
      console.error('Error loading planner tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTasks = async () => {
    try {
      if (!currentUser) return;
      
      const dataToSave = {
        tasks: tasks,
        completedDays: Array.from(completedDays),
        lastUpdated: new Date().toISOString(),
      };
      await AsyncStorage.setItem(getPlannerStorageKey(), JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Error saving planner tasks:', error);
    }
  };

  const clearAllTasks = async () => {
    Alert.alert(
      'Clear All Tasks',
      'Are you sure you want to delete all tasks and start fresh? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            setTasks([]);
            setCompletedDays(new Set());
            await AsyncStorage.removeItem(getPlannerStorageKey());
            Alert.alert('Success', 'All tasks have been cleared!');
          }
        }
      ]
    );
  };

  // Helper function to check if a time has passed
  const isTimePassed = (timeString) => {
    const now = new Date();
    const [hour, minute] = timeString.split(':').map(Number);
    const taskTime = new Date();
    taskTime.setHours(hour, minute, 0, 0);
    return now > taskTime;
  };

  // Helper function to get the next available time slot (one hour from now)
  const getNextAvailableTime = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Find the next available hour
    for (let hour = currentHour + 1; hour < 24; hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      if (!isTimePassed(timeString)) {
        return timeString;
      }
    }
    
    // If no time available today, return tomorrow's 8 AM
    return '08:00';
  };

  // Helper function to get available times (only future times)
  const getAvailableTimes = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    return ALL_TIMES.filter(time => {
      const [hour, minute] = time.split(':').map(Number);
      // Allow times that are at least 1 hour from now
      return hour > currentHour || (hour === currentHour && minute > currentMinute + 60);
    });
  };

  const openAddModal = (selectedTime = null) => {
    let startTime = selectedTime;
    
    // If no specific time is selected, get the next available time
    if (!startTime) {
      // Check if there are any available time slots
      const availableTimes = getAvailableTimes();
      
      if (availableTimes.length === 0) {
        Alert.alert(
          'Cannot Add Task',
          'No available time slots for today. Tasks can only be scheduled for future times.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      startTime = getNextAvailableTime();
    }
    
    // Ensure we have a valid start time before proceeding
    if (!startTime || typeof startTime !== 'string') {
      console.error('Invalid start time:', startTime);
      Alert.alert(
        'Error',
        'Unable to determine a valid start time. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    
    setEditingTaskId(null);
    setNewTask({
      title: '',
      time: startTime,
      endTime: getDefaultEndTime(startTime),
      category: CATEGORIES[0],
      priority: PRIORITIES[1].value,
      subtasks: [],
      reminder: null,
      notificationId: null,
      repeat: 'none',
      autoNotify: true,
    });
    setSubtaskInput('');
    setReminderTime(null);
    setModalVisible(true);
  };

  const openEditModal = (task) => {
    setEditingTaskId(task.id);
    setNewTask({
      title: task.title,
      time: task.time || '09:00',
      endTime: task.endTime || getDefaultEndTime(task.time || '09:00'),
      category: CATEGORIES.find(c => c.label === task.category) || CATEGORIES[0],
      priority: task.priority,
      subtasks: task.subtasks || [],
      reminder: task.reminder,
      notificationId: task.notificationId,
      repeat: task.repeat || 'none',
      autoNotify: task.autoNotify !== undefined ? task.autoNotify : true,
    });
    setSubtaskInput('');
    setReminderTime(task.reminder ? new Date(task.reminder) : null);
    setModalVisible(true);
  };

  function getDefaultEndTime(startTime) {
    if (!startTime || typeof startTime !== 'string') {
      return '09:00'; // Default fallback
    }
    
    const [hour, minute] = startTime.split(':').map(Number);
    const endHour = Math.min(23, hour + 1);
    return `${endHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  // Helper function to get valid end times based on start time
  const getValidEndTimes = (startTime) => {
    const startHour = parseInt(startTime.split(':')[0]);
    return ALL_TIMES.filter(time => {
      const timeHour = parseInt(time.split(':')[0]);
      return timeHour > startHour;
    });
  };

  // Handle start time change with validation
  const handleStartTimeChange = (newStartTime) => {
    // Prevent selecting past times for new tasks
    if (!editingTaskId && isTimePassed(newStartTime)) {
      Alert.alert(
        'Invalid Time',
        'You cannot schedule a task for a time that has already passed.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    const validEndTimes = getValidEndTimes(newStartTime);
    let newEndTime = newTask.endTime;
    
    // If current end time is invalid, set to the next available hour
    if (!validEndTimes.includes(newEndTime)) {
      newEndTime = validEndTimes.length > 0 ? validEndTimes[0] : getDefaultEndTime(newStartTime || '09:00');
    }
    
    // Check if current reminder time is still valid with the new start time
    if (reminderTime) {
      const [taskHour, taskMinute] = newStartTime.split(':').map(Number);
      const reminderHour = reminderTime.getHours();
      const reminderMinute = reminderTime.getMinutes();
      
      const taskTimeInMinutes = taskHour * 60 + taskMinute;
      const reminderTimeInMinutes = reminderHour * 60 + reminderMinute;
      
      if (reminderTimeInMinutes >= taskTimeInMinutes) {
        // Clear reminder time and show notification
        setReminderTime(null);
        Alert.alert(
          'Reminder Cleared',
          `The reminder time was cleared because it would be after the new task start time (${newStartTime}). Please set a new reminder if needed.`,
          [{ text: 'OK' }]
        );
      }
    }
    
    setNewTask({ 
      ...newTask, 
      time: newStartTime, 
      endTime: newEndTime 
    });
  };

  // Handle end time change with validation
  const handleEndTimeChange = (newEndTime) => {
    setNewTask({ ...newTask, endTime: newEndTime });
  };

  // Handle opening time picker modal
  const openTimePicker = (type) => {
    setTimePickerType(type);
    if (type === 'start') {
      // Only show available future times when adding a new task
      if (!editingTaskId) {
        setAvailableTimes(getAvailableTimes());
      } else {
        // When editing, allow all times
        setAvailableTimes(ALL_TIMES);
      }
    } else {
      setAvailableTimes(getValidEndTimes(newTask.time));
    }
    setShowTimePickerModal(true);
  };

  // Handle time selection from modal
  const handleTimeSelection = (selectedTime) => {
    if (timePickerType === 'start') {
      handleStartTimeChange(selectedTime);
    } else {
      handleEndTimeChange(selectedTime);
    }
    setShowTimePickerModal(false);
  };

  const scheduleNotification = async (taskTitle, date, repeat) => {
    let trigger;
    if (repeat === 'daily') {
      trigger = { hour: date.getHours(), minute: date.getMinutes(), repeats: true };
    } else if (repeat === 'weekly') {
      trigger = { weekday: date.getDay() + 1, hour: date.getHours(), minute: date.getMinutes(), repeats: true };
    } else {
      trigger = { date };
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'Task Reminder', body: taskTitle },
      trigger,
    });
    return id;
  };

  const cancelNotification = async (id) => {
    if (id) await Notifications.cancelScheduledNotificationAsync(id);
  };

  const handleSaveTask = async () => {
    if (!newTask.title.trim()) return;

    // Prevent adding new tasks for times that have already passed
    if (!editingTaskId && isTimePassed(newTask.time)) {
      Alert.alert(
        'Cannot Schedule Task',
        'You cannot schedule a task for a time that has already passed. Please select a future time.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    // Validate reminder time is before task start time
    if (reminderTime && newTask.time) {
      const [taskHour, taskMinute] = newTask.time.split(':').map(Number);
      const reminderHour = reminderTime.getHours();
      const reminderMinute = reminderTime.getMinutes();
      
      const taskTimeInMinutes = taskHour * 60 + taskMinute;
      const reminderTimeInMinutes = reminderHour * 60 + reminderMinute;
      
      if (reminderTimeInMinutes >= taskTimeInMinutes) {
        Alert.alert(
          'Invalid Reminder Time',
          `Reminder time (${reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) must be before the task start time (${newTask.time}). Please adjust the reminder time.`,
          [{ text: 'OK' }]
        );
        return;
      }
    }

    const taskId = editingTaskId || Date.now().toString();
    const categoryObj = CATEGORIES.find(c => c.label === newTask.category.label) || CATEGORIES[0];
    
    // Cancel existing notification if editing
    if (editingTaskId) {
      const existingTask = tasks.find(t => t.id === taskId);
      if (existingTask?.notificationId) {
        await NotificationService.cancelNotification(existingTask.notificationId);
      }
    }

    // Schedule automatic activity notification if enabled
    let activityNotificationId = null;
    if (newTask.autoNotify && notificationsEnabled) {
      const activityData = {
        id: taskId,
        title: newTask.title,
        time: newTask.time,
        endTime: newTask.endTime,
        category: categoryObj.label,
        priority: newTask.priority,
        repeat: newTask.repeat,
      };
      activityNotificationId = await NotificationService.scheduleActivityNotification(activityData);
    }

    // Handle custom reminder notification (separate from activity notification)
    let reminderNotificationId = newTask.notificationId;
    if (reminderTime) {
      if (newTask.notificationId) {
        await NotificationService.cancelNotification(newTask.notificationId);
      }
      reminderNotificationId = await NotificationService.scheduleCustomReminder(
        `Reminder: ${newTask.title}`,
        'Don\'t forget about this activity!',
        reminderTime,
        newTask.repeat
      );
    } else if (newTask.notificationId) {
      await NotificationService.cancelNotification(newTask.notificationId);
      reminderNotificationId = null;
    }

    const updatedTask = {
      id: taskId,
      title: newTask.title,
      time: newTask.time,
      endTime: newTask.endTime,
      category: categoryObj.label,
      color: categoryObj.color,
      priority: newTask.priority,
      subtasks: newTask.subtasks,
      reminder: reminderTime ? reminderTime.toISOString() : null,
      notificationId: reminderNotificationId, // Custom reminder notification
      activityNotificationId: activityNotificationId, // Automatic activity notification
      repeat: newTask.repeat,
      autoNotify: newTask.autoNotify,
      completed: tasks.find(t => t.id === taskId)?.completed || false,
    };

    if (editingTaskId) {
      setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
    } else {
      setTasks([...tasks, updatedTask]);
    }

    setModalVisible(false);
    setEditingTaskId(null);
  };

  const handleDeleteTask = async () => {
    if (editingTaskId) {
      const taskToDelete = tasks.find(t => t.id === editingTaskId);
      
      // Cancel all associated notifications
      if (taskToDelete?.notificationId) {
        await NotificationService.cancelNotification(taskToDelete.notificationId);
      }
      if (taskToDelete?.activityNotificationId) {
        await NotificationService.cancelNotification(taskToDelete.activityNotificationId);
      }
    }
    
    setTasks(tasks.filter(t => t.id !== editingTaskId));
    setModalVisible(false);
    setEditingTaskId(null);
  };

  const handleAddSubtask = () => {
    if (!subtaskInput.trim()) return;
    const newSubtask = {
      id: Date.now().toString(),
      text: subtaskInput,
      completed: false,
    };
    setNewTask({ ...newTask, subtasks: [...newTask.subtasks, newSubtask] });
    setSubtaskInput('');
  };

  const handleToggleSubtask = (id) => {
    setNewTask({
      ...newTask,
      subtasks: newTask.subtasks.map(st => st.id === id ? { ...st, completed: !st.completed } : st),
    });
  };

  const handleDeleteSubtask = (id) => {
    setNewTask({ ...newTask, subtasks: newTask.subtasks.filter(st => st.id !== id) });
  };

  const ensureCompleted = (task) => ({
    ...task,
    completed: task.completed !== undefined ? task.completed : false,
  });

  const handleToggleTaskComplete = (id) => {
    setTasks(tasks.map(task => {
      if (task.id === id) {
        const wasCompleted = task.completed;
        const newCompleted = !wasCompleted;
        
        // Update streak tracking
        if (newCompleted && !wasCompleted) {
          setCompletedDays(prev => {
            const newSet = new Set(prev);
            newSet.add(getToday());
            return newSet;
          });
        }
        
        return { ...task, completed: newCompleted };
      }
      return task;
    }));
  };

  const handleToggleSubtaskInPlanner = (taskId, subtaskId) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        const updatedSubtasks = task.subtasks.map(st => 
          st.id === subtaskId ? { ...st, completed: !st.completed } : st
        );
        return { ...task, subtasks: updatedSubtasks };
      }
      return task;
    }));
  };

  const isTaskOverdue = (task) => {
    const now = new Date();
    const [hour, minute] = task.time.split(':').map(Number);
    const taskTime = new Date();
    taskTime.setHours(hour, minute, 0, 0);
    return now > taskTime && !task.completed;
  };

  const getSortedTasks = (tasks) =>
    [...tasks].sort((a, b) => {
      const timeA = parseInt(a.time.replace(':', ''), 10);
      const timeB = parseInt(b.time.replace(':', ''), 10);
      return timeA - timeB;
    });

  const getFilteredTasks = () => {
    return tasks.filter(task =>
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.category.toLowerCase().includes(search.toLowerCase()) ||
      task.priority.toLowerCase().includes(search.toLowerCase())
    );
  };

  function getNextHour(time) {
    const [h, m] = time.split(':').map(Number);
    const nextH = h === 23 ? 0 : h + 1;
    return `${nextH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  // Handler for drag-to-resize
  const handleResizeTask = (task, gestureY, onEnd) => {
    // Each row is 48px tall
    const start = parseInt(task.time.split(':')[0], 10);
    let newSpan = Math.max(1, Math.round(gestureY / 48));
    let newEndHour = Math.min(23, start + newSpan);
    const newEndTime = `${newEndHour.toString().padStart(2, '0')}:00`;
    setTasks(tasks => tasks.map(t => t.id === task.id ? { ...t, endTime: newEndTime } : t));
    if (onEnd) onEnd(newEndTime);
  };

  useEffect(() => {
    // If all tasks for today are completed, add today to streak
    const today = getToday();
    const todayTasks = tasks.filter(t => getDateString(new Date()) === today);
    const anyCompleted = tasks.some(t => t.completed);
    if (anyCompleted) {
      setCompletedDays(prev => {
        const newSet = new Set(prev);
        newSet.add(today);
        return newSet;
      });
    }
  }, [tasks]);

  // Save to AsyncStorage when completedDays changes
  useEffect(() => {
    if (!isLoading) {
      saveTasks();
    }
  }, [completedDays, isLoading]);

  // Stats calculations
  const today = getToday();
  const weekStart = getWeekStart();
  const todayTasks = getFilteredTasks(); // Use the same filtered tasks as the schedule display
  const completedToday = todayTasks.filter(t => t.completed).length;
  const percentCompleted = todayTasks.length ? Math.round((completedToday / todayTasks.length) * 100) : 0;
  // Time spent by category (in hours)
  const categoryTotals = {};
  todayTasks.forEach(t => {
    if (t.completed) {
      const start = parseInt(t.time.split(':')[0], 10);
                const end = parseInt((t.endTime || getDefaultEndTime(t.time || '09:00')).split(':')[0], 10);
      const hours = Math.max(1, end - start);
      const cat = t.category;
      if (!categoryTotals[cat]) categoryTotals[cat] = 0;
      categoryTotals[cat] += hours;
    }
  });
  const maxCatHours = Math.max(1, ...Object.values(categoryTotals).length > 0 ? Object.values(categoryTotals) : [1]);
  // Streak calculation
  const streak = getStreakDays(completedDays);

  // Bar chart width
  const barMaxWidth = Dimensions.get('window').width - 120;

  const styles = getStyles(theme);

  // Bulk notification management
  const refreshAllNotifications = async () => {
    if (!notificationsEnabled) return;
    
    try {
      const notificationResults = await NotificationService.rescheduleAllActivityNotifications(tasks);
      
      // Update tasks with new notification IDs
      const updatedTasks = tasks.map(task => {
        const result = notificationResults.find(r => r.activityId === task.id);
        if (result && task.autoNotify) {
          return { ...task, activityNotificationId: result.notificationId };
        }
        return task;
      });
      
      setTasks(updatedTasks);
      console.log('All notifications refreshed');
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    }
  };

  // Add notification toggle function
  const toggleNotifications = async () => {
    if (notificationsEnabled) {
      // Disable all notifications
      await NotificationService.cancelAllNotifications();
      setNotificationsEnabled(false);
      Alert.alert('Notifications Disabled', 'All activity notifications have been cancelled.');
    } else {
      // Try to re-enable notifications
      const success = await NotificationService.initialize();
      if (success) {
        setNotificationsEnabled(true);
        await refreshAllNotifications();
        Alert.alert('Notifications Enabled', 'Activity notifications will be scheduled for your tasks.');
      } else {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in your device settings.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  return (
    <ScreenLayout
      showHeader={true}
      headerTitle="Daily Planner"
      headerIcon="calendar-outline"
      scrollable={true}
      headerRight={
        isLoading ? null : (
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[
                styles.notificationButton, 
                { backgroundColor: notificationsEnabled ? theme.colors.primary : theme.colors.textSecondary }
              ]} 
              onPress={toggleNotifications}
            >
              <Ionicons 
                name={notificationsEnabled ? "notifications" : "notifications-off"} 
                size={18} 
                color={theme.colors.background} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.notificationButton, { backgroundColor: '#F44336' }]} 
              onPress={clearAllTasks}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.background} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addHeaderButton} onPress={openAddModal}>
              <Ionicons name="add-outline" size={20} color={theme.colors.background} />
            </TouchableOpacity>
          </View>
        )
      }
      navigation={navigation}
    >
      {/* Show loading indicator */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="hourglass-outline" size={48} color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading planner...</Text>
        </View>
      ) : (
        <>
            {/* Stats Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Progress</Text>
              <View style={styles.statsCard}>
                <View style={styles.completionHeader}>
                  <View style={styles.completionInfo}>
                    <Text style={styles.completionTitle}>Completion Rate</Text>
                    <Text style={styles.completionPercent}>{percentCompleted}%</Text>
                  </View>
                  <View style={styles.completionIcon}>
                    <Ionicons 
                      name={percentCompleted === 100 ? "checkmark-circle" : "time-outline"} 
                      size={32} 
                      color={percentCompleted === 100 ? "#4CAF50" : theme.colors.primary} 
                    />
                  </View>
                </View>
                
                <View style={styles.tasksOverview}>
                  <View style={styles.tasksStat}>
                    <Text style={styles.tasksStatValue}>{completedToday}</Text>
                    <Text style={styles.tasksStatLabel}>Completed</Text>
                  </View>
                  <View style={styles.tasksStat}>
                    <Text style={styles.tasksStatValue}>{todayTasks.length - completedToday}</Text>
                    <Text style={styles.tasksStatLabel}>Remaining</Text>
                  </View>
                  <View style={styles.tasksStat}>
                    <Text style={styles.tasksStatValue}>{streak}</Text>
                    <Text style={styles.tasksStatLabel}>Day Streak 🔥</Text>
                  </View>
                </View>

                {Object.keys(categoryTotals).length > 0 && (
                  <View style={styles.categoryProgress}>
                    <Text style={styles.categoryProgressTitle}>Time by Category</Text>
                    {Object.entries(categoryTotals).map(([cat, hours]) => {
                      const categoryInfo = CATEGORIES.find(c => c.label === cat);
                      return (
                        <View key={cat} style={styles.categoryRow}>
                          <View style={styles.categoryInfo}>
                            <Ionicons 
                              name={categoryInfo?.icon || 'ellipse-outline'} 
                              size={16} 
                              color={categoryInfo?.color || theme.colors.primary} 
                            />
                            <Text style={styles.categoryLabel}>{cat}</Text>
                          </View>
                          <View style={styles.categoryBarContainer}>
                            <View style={styles.categoryBarBg}>
                              <View 
                                style={[
                                  styles.categoryBarFill, 
                                  { 
                                    width: `${(hours / maxCatHours) * 100}%`,
                                    backgroundColor: categoryInfo?.color || theme.colors.primary
                                  }
                                ]} 
                              />
                            </View>
                            <Text style={styles.categoryHours}>{hours}h</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {/* Search Section */}
            <View style={styles.section}>
              <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search tasks by title, category, or priority"
                  value={search}
                  onChangeText={setSearch}
                  placeholderTextColor={theme.colors.textSecondary}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-outline" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Schedule Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Schedule</Text>
              <View style={styles.scheduleCard}>
                {HOURS.map(hour => {
                  // Only render tasks that start at this hour
                  const slotTasks = getSortedTasks(getFilteredTasks()).filter(task => {
                    const start = parseInt(task.time.replace(':', ''), 10);
                    return start === hour * 100;
                  });
                  
                  return (
                    <View key={hour} style={styles.timeSlot}>
                      <View style={styles.timeColumn}>
                        <Text style={styles.timeText}>
                          {hour.toString().padStart(2, '0')}:00
                        </Text>
                      </View>
                      <View style={styles.tasksColumn}>
                        {slotTasks.length === 0 ? (
                          <TouchableOpacity 
                            style={styles.emptySlot}
                            onPress={() => {
                              const timeString = `${hour.toString().padStart(2, '0')}:00`;
                              if (!isTimePassed(timeString)) {
                                openAddModal(timeString);
                              } else {
                                Alert.alert(
                                  'Past Time',
                                  'Cannot schedule tasks for past time slots.',
                                  [{ text: 'OK' }]
                                );
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.emptySlotContent}>
                              <Ionicons name="add-outline" size={16} color={theme.colors.textSecondary} />
                              <Text style={styles.emptySlotText}>Tap to add task</Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          slotTasks.map(task => {
                            const categoryInfo = CATEGORIES.find(c => c.label === task.category);
                            const priorityInfo = PRIORITIES.find(p => p.value === task.priority);
                            const start = parseInt(task.time.replace(':', ''), 10);
                            const end = parseInt((task.endTime || getDefaultEndTime(task.time || '09:00')).replace(':', ''), 10);
                            const span = Math.max(1, Math.ceil((end - start) / 100));
                            
                            return (
                              <TouchableOpacity
                                key={task.id}
                                style={[
                                  styles.taskCard,
                                  { 
                                    minHeight: span * 60,
                                    opacity: task.completed ? 0.7 : 1
                                  },
                                  isTaskOverdue(task) && styles.overdueTask
                                ]}
                                onPress={() => openEditModal(task)}
                                activeOpacity={0.8}
                              >
                                <View style={styles.taskHeader}>
                                  <View style={styles.taskTitleSection}>
                                    <View style={styles.taskCategoryIcon}>
                                      <Ionicons 
                                        name={categoryInfo?.icon || 'ellipse-outline'} 
                                        size={16} 
                                        color={categoryInfo?.color || theme.colors.primary} 
                                      />
                                    </View>
                                    <Text 
                                      style={[
                                        styles.taskTitle, 
                                        task.completed && styles.taskCompleted,
                                        isTaskOverdue(task) && styles.overdueText
                                      ]} 
                                      numberOfLines={2}
                                    >
                                      {task.title}
                                    </Text>
                                  </View>
                                  <TouchableOpacity 
                                    style={styles.completeButton}
                                    onPress={() => handleToggleTaskComplete(task.id)}
                                  >
                                    <Ionicons 
                                      name={task.completed ? "checkmark-circle" : "ellipse-outline"} 
                                      size={24} 
                                      color={task.completed ? "#4CAF50" : theme.colors.textSecondary} 
                                    />
                                  </TouchableOpacity>
                                </View>
                                
                                <View style={styles.taskDetails}>
                                  <View style={styles.taskInfo}>
                                    <Ionicons name="time-outline" size={12} color={theme.colors.textSecondary} />
                                    <Text style={styles.taskTime}>
                                      {task.time} - {task.endTime || getDefaultEndTime(task.time || '09:00')}
                                    </Text>
                                  </View>
                                  <View style={styles.taskInfo}>
                                    <Ionicons 
                                      name={priorityInfo?.icon || 'flag-outline'} 
                                      size={12} 
                                      color={priorityInfo?.color || theme.colors.textSecondary} 
                                    />
                                    <Text style={[styles.taskPriority, { color: priorityInfo?.color || theme.colors.textSecondary }]}>
                                      {task.priority.toUpperCase()}
                                    </Text>
                                  </View>
                                  {task.repeat && task.repeat !== 'none' && (
                                    <View style={styles.taskInfo}>
                                      <Ionicons name="refresh-outline" size={12} color={theme.colors.textSecondary} />
                                      <Text style={styles.taskRepeat}>
                                        {task.repeat.charAt(0).toUpperCase() + task.repeat.slice(1)}
                                      </Text>
                                    </View>
                                  )}
                                </View>

                                {task.subtasks && task.subtasks.length > 0 && (
                                  <View style={styles.subtasksContainer}>
                                    {task.subtasks.slice(0, 2).map(subtask => (
                                      <TouchableOpacity
                                        key={subtask.id}
                                        style={styles.subtaskItem}
                                        onPress={() => handleToggleSubtaskInPlanner(task.id, subtask.id)}
                                      >
                                        <Ionicons 
                                          name={subtask.completed ? "checkmark-circle-outline" : "ellipse-outline"} 
                                          size={14} 
                                          color={subtask.completed ? "#4CAF50" : theme.colors.textSecondary} 
                                        />
                                        <Text 
                                          style={[
                                            styles.subtaskText, 
                                            subtask.completed && styles.subtaskCompleted
                                          ]}
                                          numberOfLines={1}
                                        >
                                          {subtask.text}
                                        </Text>
                                      </TouchableOpacity>
                                    ))}
                                    {task.subtasks.length > 2 && (
                                      <Text style={styles.moreSubtasks}>
                                        +{task.subtasks.length - 2} more
                                      </Text>
                                    )}
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Bottom spacing */}
            <View style={styles.bottomSpacer} />

          {/* Floating Add Button */}
          <TouchableOpacity style={styles.floatingAddButton} onPress={() => openAddModal()}>
            <Ionicons name="add-outline" size={28} color={theme.colors.background} />
          </TouchableOpacity>

          {/* Modern Task Modal */}
          <Modal
            visible={modalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <ScrollView 
                  style={styles.modalScrollView}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      {editingTaskId ? 'Edit Task' : 'Add New Task'}
                    </Text>
                    <TouchableOpacity 
                      style={styles.modalCloseButton}
                      onPress={() => setModalVisible(false)}
                    >
                      <Ionicons name="close-outline" size={24} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Task Title */}
                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Task Title</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter task title"
                      value={newTask.title}
                      onChangeText={text => setNewTask({ ...newTask, title: text })}
                      placeholderTextColor={theme.colors.textSecondary}
                    />
                  </View>

                  {/* Time Section */}
                  <View style={styles.timeSection}>
                    <View style={styles.timeRow}>
                      <View style={styles.timeInput}>
                        <Text style={styles.inputLabel}>Start Time</Text>
                        <TouchableOpacity 
                          style={styles.timePickerButton}
                          onPress={() => openTimePicker('start')}
                        >
                          <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
                          <Text style={styles.timePickerText}>{newTask.time}</Text>
                          <Ionicons name="chevron-down-outline" size={16} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.timeInput}>
                        <Text style={styles.inputLabel}>End Time</Text>
                        <TouchableOpacity 
                          style={styles.timePickerButton}
                          onPress={() => openTimePicker('end')}
                        >
                          <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
                          <Text style={styles.timePickerText}>{newTask.endTime}</Text>
                          <Ionicons name="chevron-down-outline" size={16} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                        {getValidEndTimes(newTask.time).length === 0 && (
                          <Text style={styles.timeValidationText}>
                            No valid end times available for this start time
                          </Text>
                        )}
                        {getValidEndTimes(newTask.time).length > 0 && newTask.time >= '22:00' && (
                          <Text style={styles.timeHintText}>
                            End time options are limited due to late start time
                          </Text>
                        )}
                        {!editingTaskId && isTimePassed(newTask.time) && (
                          <Text style={styles.timeValidationText}>
                            ⚠️ This time has already passed today
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Category Section */}
                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Category</Text>
                    <View style={styles.categoryOptions}>
                      {CATEGORIES.map(cat => (
                        <TouchableOpacity
                          key={cat.label}
                          style={[
                            styles.categoryOption,
                            newTask.category.label === cat.label && styles.categoryOptionSelected
                          ]}
                          onPress={() => setNewTask({ ...newTask, category: cat })}
                        >
                          <View style={[styles.categoryIcon, { backgroundColor: cat.color }]}>
                            <Ionicons name={cat.icon} size={16} color={theme.colors.background} />
                          </View>
                          <Text style={[
                            styles.categoryOptionText,
                            newTask.category.label === cat.label && styles.categoryOptionTextSelected
                          ]}>
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Priority Section */}
                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Priority</Text>
                    <View style={styles.priorityOptions}>
                      {PRIORITIES.map(priority => (
                        <TouchableOpacity
                          key={priority.value}
                          style={[
                            styles.priorityOption,
                            newTask.priority === priority.value && styles.priorityOptionSelected
                          ]}
                          onPress={() => setNewTask({ ...newTask, priority: priority.value })}
                        >
                          <Ionicons 
                            name={priority.icon} 
                            size={16} 
                            color={newTask.priority === priority.value ? theme.colors.background : priority.color} 
                          />
                          <Text style={[
                            styles.priorityOptionText,
                            newTask.priority === priority.value && styles.priorityOptionTextSelected,
                            { color: priority.color }
                          ]}>
                            {priority.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Repeat Section */}
                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Repeat</Text>
                    <View style={styles.repeatOptions}>
                      {REPEAT_OPTIONS.map(repeat => (
                        <TouchableOpacity
                          key={repeat.value}
                          style={[
                            styles.repeatOption,
                            newTask.repeat === repeat.value && styles.repeatOptionSelected
                          ]}
                          onPress={() => setNewTask({ ...newTask, repeat: repeat.value })}
                        >
                          <Ionicons 
                            name={repeat.icon} 
                            size={16} 
                            color={newTask.repeat === repeat.value ? theme.colors.background : theme.colors.textSecondary} 
                          />
                          <Text style={[
                            styles.repeatOptionText,
                            newTask.repeat === repeat.value && styles.repeatOptionTextSelected
                          ]}>
                            {repeat.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Reminder Section */}
                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Reminder</Text>
                    <TouchableOpacity 
                      style={styles.reminderButton} 
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Ionicons name="notifications-outline" size={20} color={theme.colors.primary} />
                      <Text style={styles.reminderButtonText}>
                        {reminderTime ? 
                          reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                          'Set Reminder Time'
                        }
                      </Text>
                      {reminderTime && (
                        <TouchableOpacity onPress={() => setReminderTime(null)}>
                          <Ionicons name="close-outline" size={20} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                    
                    {showTimePicker && (
                      <DateTimePicker
                        value={reminderTime || new Date()}
                        mode="time"
                        is24Hour={true}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowTimePicker(false);
                          if (selectedDate) {
                            const now = new Date();
                            selectedDate.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
                            
                            // Validate that reminder time is before the task start time
                            const taskStartTime = newTask.time;
                            if (taskStartTime) {
                              const [taskHour, taskMinute] = taskStartTime.split(':').map(Number);
                              const reminderHour = selectedDate.getHours();
                              const reminderMinute = selectedDate.getMinutes();
                              
                              // Convert both times to minutes for easy comparison
                              const taskTimeInMinutes = taskHour * 60 + taskMinute;
                              const reminderTimeInMinutes = reminderHour * 60 + reminderMinute;
                              
                              if (reminderTimeInMinutes >= taskTimeInMinutes) {
                                Alert.alert(
                                  'Invalid Reminder Time',
                                  `Reminder time must be before the task start time (${taskStartTime}). Please select an earlier time.`,
                                  [{ text: 'OK' }]
                                );
                                return;
                              }
                            }
                            
                            setReminderTime(selectedDate);
                          }
                        }}
                      />
                    )}
                    
                    {/* Reminder validation hint */}
                    {newTask.time && (
                      <Text style={styles.reminderHintText}>
                        Reminder must be set before {newTask.time}
                      </Text>
                    )}
                    
                    {/* Show current reminder validation status */}
                    {reminderTime && newTask.time && (
                      <View style={styles.reminderValidationContainer}>
                        {(() => {
                          const [taskHour, taskMinute] = newTask.time.split(':').map(Number);
                          const reminderHour = reminderTime.getHours();
                          const reminderMinute = reminderTime.getMinutes();
                          const taskTimeInMinutes = taskHour * 60 + taskMinute;
                          const reminderTimeInMinutes = reminderHour * 60 + reminderMinute;
                          const isValid = reminderTimeInMinutes < taskTimeInMinutes;
                          
                          return (
                            <View style={styles.reminderValidationRow}>
                              <Ionicons 
                                name={isValid ? "checkmark-circle" : "close-circle"} 
                                size={16} 
                                color={isValid ? "#4CAF50" : "#F44336"} 
                              />
                              <Text style={[
                                styles.reminderValidationText,
                                { color: isValid ? "#4CAF50" : "#F44336" }
                              ]}>
                                {isValid 
                                  ? `Reminder set ${Math.abs(taskTimeInMinutes - reminderTimeInMinutes)} minutes before task`
                                  : "Reminder time must be before task start time"
                                }
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                    )}
                  </View>

                  {/* Auto-Notify Section */}
                  <View style={styles.inputSection}>
                    <View style={styles.autoNotifyHeader}>
                      <View style={styles.autoNotifyInfoSection}>
                        <Text style={styles.inputLabel}>Auto Notifications</Text>
                        <Text style={styles.autoNotifyDescription}>
                          Get notified when it's time for this activity
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={[
                          styles.autoNotifyToggle,
                          newTask.autoNotify && styles.autoNotifyToggleActive,
                          !notificationsEnabled && styles.autoNotifyToggleDisabled
                        ]}
                        onPress={() => {
                          if (notificationsEnabled) {
                            setNewTask({ ...newTask, autoNotify: !newTask.autoNotify });
                          }
                        }}
                        disabled={!notificationsEnabled}
                      >
                        <View style={[
                          styles.autoNotifyThumb,
                          newTask.autoNotify && styles.autoNotifyThumbActive
                        ]}>
                          <Ionicons 
                            name={newTask.autoNotify ? "checkmark" : "close"} 
                            size={16} 
                            color={newTask.autoNotify ? "#4CAF50" : theme.colors.textSecondary} 
                          />
                        </View>
                      </TouchableOpacity>
                    </View>
                    
                    {!notificationsEnabled && (
                      <View style={styles.notificationWarning}>
                        <Ionicons name="alert-circle-outline" size={16} color="#FF9800" />
                        <Text style={styles.notificationWarningText}>
                          Enable notifications in settings to use this feature
                        </Text>
                      </View>
                    )}
                    
                    {newTask.autoNotify && notificationsEnabled && (
                      <View style={styles.autoNotifyInfoContainer}>
                        <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
                        <Text style={styles.autoNotifyInfoText}>
                          You'll receive a notification at {newTask.time} 
                          {newTask.repeat !== 'none' && ` (${newTask.repeat})`}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Subtasks Section */}
                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Subtasks</Text>
                    
                    {/* Add Subtask Row */}
                    <View style={styles.addSubtaskRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder="Add subtask"
                        value={subtaskInput}
                        onChangeText={setSubtaskInput}
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                      <TouchableOpacity 
                        style={styles.addSubtaskButton} 
                        onPress={handleAddSubtask}
                        disabled={!subtaskInput.trim()}
                      >
                        <Ionicons name="add-outline" size={20} color={theme.colors.background} />
                      </TouchableOpacity>
                    </View>

                    {/* Subtasks List */}
                    {newTask.subtasks && newTask.subtasks.length > 0 && (
                      <View style={styles.subtasksList}>
                        {newTask.subtasks.map(subtask => (
                          <View key={subtask.id} style={styles.subtaskRow}>
                            <TouchableOpacity 
                              style={styles.subtaskCheckbox}
                              onPress={() => handleToggleSubtask(subtask.id)}
                            >
                              <Ionicons 
                                name={subtask.completed ? "checkmark-circle" : "ellipse-outline"} 
                                size={20} 
                                color={subtask.completed ? "#4CAF50" : theme.colors.textSecondary} 
                              />
                            </TouchableOpacity>
                            <Text style={[
                              styles.subtaskRowText, 
                              subtask.completed && styles.subtaskRowTextCompleted
                            ]}>
                              {subtask.text}
                            </Text>
                            <TouchableOpacity 
                              style={styles.deleteSubtaskButton}
                              onPress={() => handleDeleteSubtask(subtask.id)}
                            >
                              <Ionicons name="trash-outline" size={16} color="#F44336" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Modal Actions */}
                  <View style={styles.modalActions}>
                    {editingTaskId && (
                      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTask}>
                        <Ionicons name="trash-outline" size={20} color={theme.colors.background} />
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                    )}
                    <View style={styles.modalButtonsRow}>
                      <TouchableOpacity 
                        style={styles.cancelButton} 
                        onPress={() => setModalVisible(false)}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.saveButton, !newTask.title.trim() && styles.disabledButton]} 
                        onPress={handleSaveTask}
                        disabled={!newTask.title.trim()}
                      >
                        <Ionicons name="checkmark-outline" size={20} color={theme.colors.background} />
                        <Text style={styles.saveButtonText}>
                          {editingTaskId ? 'Save Changes' : 'Add Task'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* Custom Time Picker Modal */}
          <Modal
            visible={showTimePickerModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowTimePickerModal(false)}
          >
            <View style={styles.timeModalOverlay}>
              <View style={styles.timeModalContent}>
                <View style={styles.timeModalHeader}>
                  <View style={styles.timeModalTitleSection}>
                    <Text style={styles.timeModalTitle}>
                      Select {timePickerType === 'start' ? 'Start' : 'End'} Time
                    </Text>
                    {!editingTaskId && timePickerType === 'start' && (
                      <Text style={styles.timeModalSubtitle}>
                        Only future times are available for new tasks
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity 
                    style={styles.timeModalCloseButton}
                    onPress={() => setShowTimePickerModal(false)}
                  >
                    <Ionicons name="close-outline" size={24} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.timeList} showsVerticalScrollIndicator={false}>
                  {availableTimes.map(time => (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.timeOption,
                        (timePickerType === 'start' ? newTask.time : newTask.endTime) === time && styles.timeOptionSelected
                      ]}
                      onPress={() => handleTimeSelection(time)}
                    >
                      <Ionicons 
                        name="time-outline" 
                        size={20} 
                        color={
                          (timePickerType === 'start' ? newTask.time : newTask.endTime) === time 
                            ? theme.colors.background 
                            : theme.colors.primary
                        } 
                      />
                      <Text style={[
                        styles.timeOptionText,
                        (timePickerType === 'start' ? newTask.time : newTask.endTime) === time && styles.timeOptionTextSelected
                      ]}>
                        {time}
                      </Text>
                      {(timePickerType === 'start' ? newTask.time : newTask.endTime) === time && (
                        <Ionicons name="checkmark-outline" size={20} color={theme.colors.background} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                
                {availableTimes.length === 0 && (
                  <View style={styles.noTimesContainer}>
                    <Ionicons name="time-outline" size={48} color={theme.colors.textSecondary} />
                    <Text style={styles.noTimesText}>
                      No valid {timePickerType} times available
                    </Text>
                    <Text style={styles.noTimesSubtext}>
                      {timePickerType === 'end' ? 'Try selecting an earlier start time' : 'All times are available for start time'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        </>
      )}
    </ScreenLayout>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: theme.colors.text, marginBottom: 4 },
  headerDate: { fontSize: 14, color: theme.colors.textSecondary },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationButton: { 
    backgroundColor: theme.colors.primary, 
    borderRadius: 18, 
    width: 36, 
    height: 36, 
    alignItems: 'center', 
    justifyContent: 'center', 
    elevation: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2
  },
  addHeaderButton: { 
    backgroundColor: theme.colors.primary, 
    borderRadius: 18, 
    width: 36, 
    height: 36, 
    alignItems: 'center', 
    justifyContent: 'center', 
    elevation: 2,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2
  },
  
  // Scroll
  scrollView: { flex: 1 },
  scrollContainer: { paddingBottom: 120 },
  section: { marginBottom: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 12 },
  
  // Stats Card
  statsCard: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 20 },
  completionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  completionInfo: { flex: 1 },
  completionTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginBottom: 4 },
  completionPercent: { fontSize: 28, fontWeight: 'bold', color: theme.colors.primary },
  completionIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: theme.colors.background, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  
  // Tasks Overview
  tasksOverview: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  tasksStat: { alignItems: 'center', flex: 1 },
  tasksStatValue: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginBottom: 4 },
  tasksStatLabel: { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center' },
  
  // Category Progress
  categoryProgress: { marginTop: 8 },
  categoryProgressTitle: { fontSize: 14, fontWeight: 'bold', color: theme.colors.text, marginBottom: 12 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  categoryInfo: { flexDirection: 'row', alignItems: 'center', marginRight: 12, minWidth: 80 },
  categoryLabel: { fontSize: 14, color: theme.colors.text, marginLeft: 8 },
  categoryBarContainer: { flex: 1, marginRight: 12 },
  categoryBarBg: { height: 8, backgroundColor: theme.colors.background, borderRadius: 4, overflow: 'hidden' },
  categoryBarFill: { height: 8, borderRadius: 4 },
  categoryHours: { fontSize: 14, color: theme.colors.text, fontWeight: 'bold', minWidth: 30, textAlign: 'right' },
  
  // Search
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.colors.card, 
    borderRadius: 12, 
    padding: 16,
    gap: 12
  },
  searchInput: { 
    flex: 1, 
    fontSize: 16, 
    color: theme.colors.text,
    padding: 0
  },
  
  // Schedule
  scheduleCard: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 16 },
  timeSlot: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    minHeight: 60, 
    borderBottomWidth: 1, 
    borderBottomColor: theme.colors.background, 
    paddingVertical: 12
  },
  timeColumn: { width: 72, paddingTop: 4 },
  timeText: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '500' },
  tasksColumn: { flex: 1, paddingLeft: 16 },
  
  // Empty Slot
  emptySlot: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingVertical: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: theme.colors.textSecondary,
    borderRadius: 8,
    backgroundColor: theme.colors.background,
    minHeight: 60,
  },
  emptySlotContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptySlotText: { 
    fontSize: 14, 
    color: theme.colors.textSecondary, 
    fontStyle: 'italic' 
  },
  
  // Task Card
  taskCard: { 
    backgroundColor: theme.colors.background,
    borderRadius: 12, 
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  taskHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  taskTitleSection: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  taskCategoryIcon: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: theme.colors.card, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  taskTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, flex: 1 },
  taskCompleted: { textDecorationLine: 'line-through', color: theme.colors.textSecondary, opacity: 0.7 },
  completeButton: { 
    backgroundColor: theme.colors.card, 
    borderRadius: 20, 
    padding: 8,
    marginLeft: 8
  },
  
  // Task Details
  taskDetails: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  taskInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskTime: { fontSize: 12, color: theme.colors.textSecondary },
  taskPriority: { fontSize: 12, fontWeight: 'bold' },
  taskRepeat: { fontSize: 12, color: theme.colors.textSecondary },
  
  // Subtasks
  subtasksContainer: { paddingLeft: 44 },
  subtaskItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 },
  subtaskText: { fontSize: 14, color: theme.colors.text, flex: 1 },
  subtaskCompleted: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
  moreSubtasks: { fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' },
  
  // Overdue
  overdueTask: { borderLeftColor: '#F44336', backgroundColor: 'rgba(244, 67, 54, 0.05)' },
  overdueText: { color: '#F44336' },
  
  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: theme.colors.text, fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  
  // Floating Button
  floatingAddButton: { 
    position: 'absolute', 
    right: 24, 
    bottom: 32, 
    backgroundColor: theme.colors.primary, 
    borderRadius: 32, 
    width: 64, 
    height: 64, 
    alignItems: 'center', 
    justifyContent: 'center', 
    elevation: 6,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8
  },
  bottomSpacer: { height: 100 },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10
  },
  modalScrollView: {
    maxHeight: '100%',
  },
  modalScrollContent: {
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Input Section
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.background,
  },
  
  // Time Section
  timeSection: {
    marginBottom: 20,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInput: {
    flex: 1,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.background,
  },
  timePickerText: {
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: 8,
    flex: 1,
  },
  
  // Category Options
  categoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryOptionSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryOptionText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  categoryOptionTextSelected: {
    color: theme.colors.background,
    fontWeight: 'bold',
  },
  
  // Priority Options
  priorityOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  priorityOptionSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  priorityOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  priorityOptionTextSelected: {
    color: theme.colors.background,
    fontWeight: 'bold',
  },
  
  // Repeat Options
  repeatOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  repeatOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  repeatOptionSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  repeatOptionText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  repeatOptionTextSelected: {
    color: theme.colors.background,
    fontWeight: 'bold',
  },
  
  // Reminder
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.background,
  },
  reminderButtonText: {
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: 8,
    flex: 1,
  },
  
  // Subtasks
  addSubtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  addSubtaskButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtasksList: {
    gap: 8,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    gap: 12,
  },
  subtaskCheckbox: {
    padding: 4,
  },
  subtaskRowText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
  },
  subtaskRowTextCompleted: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },
  deleteSubtaskButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  
  // Modal Actions
  modalActions: {
    marginTop: 24,
    gap: 16,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#F44336',
    borderRadius: 12,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.background,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.textSecondary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
  },
  disabledButton: {
    backgroundColor: theme.colors.textSecondary,
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.background,
  },
  timeValidationText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 8,
  },
  timeHintText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
  timeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  timeModalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    padding: 24,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10
  },
  timeModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  timeModalTitleSection: {
    flex: 1,
    paddingRight: 16,
  },
  timeModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  timeModalSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  timeModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeList: {
    maxHeight: 400,
    gap: 8,
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  timeOptionSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  timeOptionText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  timeOptionTextSelected: {
    color: theme.colors.background,
    fontWeight: 'bold',
  },
  noTimesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  noTimesText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  noTimesSubtext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  autoNotifyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 16,
  },
  autoNotifyInfoSection: {
    flex: 1,
    paddingRight: 8,
  },
  autoNotifyDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
    flexWrap: 'wrap',
  },
  autoNotifyToggle: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 8,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  autoNotifyToggleActive: {
    backgroundColor: theme.colors.primary,
  },
  autoNotifyToggleDisabled: {
    backgroundColor: theme.colors.textSecondary,
    opacity: 0.5,
  },
  autoNotifyThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoNotifyThumbActive: {
    backgroundColor: theme.colors.background,
  },
  notificationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
  },
  notificationWarningText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    flex: 1,
    flexWrap: 'wrap',
  },
  autoNotifyInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.background,
  },
  autoNotifyInfoText: {
    fontSize: 12,
    color: theme.colors.text,
    flex: 1,
    flexWrap: 'wrap',
  },
  
  // Reminder validation styles
  reminderHintText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  reminderValidationContainer: {
    marginTop: 8,
  },
  reminderValidationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderValidationText: {
    fontSize: 12,
    flex: 1,
  },
}); 