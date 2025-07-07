// FloatingTimer.js - Compact floating timer component for continuous session monitoring
// This component provides:
// - Minimized timer display that appears when scrolling past main timer
// - Quick access controls for pause/resume and stop actions
// - Pomodoro progress indication with visual feedback
// - Smooth animations and transitions for better user experience
// - Space-efficient design that doesn't obstruct main content

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// FloatingTimer Component - displays a compact timer overlay during scrolling
// Parameters:
// - timerSubject: The subject currently being studied
// - timerTopic: The specific topic within the subject
// - timerSeconds: Current timer value in seconds
// - timerActive: Boolean indicating if timer is running
// - isPomodoroMode: Boolean indicating if using Pomodoro technique
// - pomodoroPhase: Current Pomodoro phase ('focus' or 'break')
// - onPause: Callback function to pause the timer
// - onResume: Callback function to resume the timer
// - onStop: Callback function to stop and save the session
// - onEndSession: Callback function to completely end the session
// - onScrollToTimer: Callback function to scroll back to main timer
export default function FloatingTimer({
  timerSubject,
  timerTopic,
  timerSeconds,
  timerActive,
  isPomodoroMode = false,
  pomodoroPhase = 'focus',
  onPause,
  onResume,
  onStop,
  onEndSession,
  onScrollToTimer
}) {
  // Theme context for consistent styling
  const { theme } = useTheme();
  
  // Animation reference for smooth show/hide transitions
  const slideAnim = useRef(new Animated.Value(-100)).current; // Start position off-screen

  // Animation Effect - handles floating timer entrance and exit animations
  useEffect(() => {
    // Animate timer into view when component mounts or becomes visible
    Animated.timing(slideAnim, {
      toValue: 0,           // Final position (visible)
      duration: 300,        // Animation duration in milliseconds
      useNativeDriver: true, // Use native driver for better performance
    }).start();

    // Cleanup function to animate out when component unmounts
    return () => {
      Animated.timing(slideAnim, {
        toValue: -100,        // Move back off-screen
        duration: 200,        // Faster exit animation
        useNativeDriver: true,
      }).start();
    };
  }, []); // Run effect only once on mount

  // Time Formatting Helper - converts seconds to MM:SS format for display
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Pomodoro Progress Calculation - determines completion percentage for visual indicator
  const getPomodoroProgress = () => {
    if (!isPomodoroMode) return 0; // No progress indication for regular timer
    
    // Define total duration based on current phase
    const totalDuration = pomodoroPhase === 'focus' ? 25 * 60 : 5 * 60; // 25 min focus, 5 min break
    const elapsed = totalDuration - timerSeconds;
    return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100)); // Clamp between 0-100%
  };

  // Apply theme-based styles
  const styles = getStyles(theme);

  // Main Render - displays the floating timer with all controls and indicators
  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }] // Apply slide animation
        }
      ]}
    >
      {/* Timer Information Section - displays subject, topic, and time */}
      <TouchableOpacity 
        style={styles.timerInfo}
        onPress={onScrollToTimer} // Tap to scroll back to main timer
        activeOpacity={0.7}
      >
        {/* Subject and Topic Display */}
        <View style={styles.textContainer}>
          <Text style={styles.subjectText} numberOfLines={1}>
            {timerSubject?.name || 'Study Session'}
          </Text>
          {timerTopic && (
            <Text style={styles.topicText} numberOfLines={1}>
              {timerTopic}
            </Text>
          )}
        </View>
        
        {/* Timer Display */}
        <Text style={styles.timeText}>{formatTime(timerSeconds)}</Text>
      </TouchableOpacity>

      {/* Pomodoro Progress Indicator - shows progress for Pomodoro sessions */}
      {isPomodoroMode && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View 
              style={[
                styles.progressFill,
                {
                  // Use scaleX transform for smooth animation without width issues
                  transform: [{ scaleX: getPomodoroProgress() / 100 }]
                }
              ]}
            />
          </View>
          {/* Phase Indicator Text */}
          <Text style={styles.phaseText}>
            {pomodoroPhase === 'focus' ? 'FOCUS' : 'BREAK'}
          </Text>
        </View>
      )}

      {/* Control Buttons Section - pause/resume, stop, and end session actions */}
      <View style={styles.controls}>
        {/* Pause/Resume Button */}
        <TouchableOpacity
          style={[styles.controlButton, styles.playPauseButton]}
          onPress={timerActive ? onPause : onResume}
          accessibilityRole="button"
          accessibilityLabel={timerActive ? 'Pause timer' : 'Resume timer'}
        >
          <Ionicons 
            name={timerActive ? 'pause' : 'play'} 
            size={16} 
            color={theme.colors.background} 
          />
        </TouchableOpacity>

        {/* Stop Button - stops timer and saves session */}
        <TouchableOpacity
          style={[styles.controlButton, styles.stopButton]}
          onPress={onStop}
          accessibilityRole="button"
          accessibilityLabel="Stop timer and save session"
        >
          <Ionicons name="stop" size={16} color="#FFFFFF" />
        </TouchableOpacity>

        {/* End Session Button - completely ends the session */}
        {onEndSession && (
          <TouchableOpacity
            style={[styles.controlButton, styles.endButton]}
            onPress={onEndSession}
            accessibilityRole="button"
            accessibilityLabel="End session completely"
          >
            <Ionicons name="exit" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 10,
    left: 10,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
    overflow: 'hidden',
  },
  timerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  subjectText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  topicText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: theme.colors.textSecondary,
  },
  timeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginRight: 8,
  },
  progressContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  progressBar: {
    height: 3,
    backgroundColor: theme.colors.background,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    transformOrigin: 'left',
  },
  phaseText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.colors.primary,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  playPauseButton: {
    backgroundColor: theme.colors.primary,
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  endButton: {
    backgroundColor: '#FF6B35',
  },
}); 