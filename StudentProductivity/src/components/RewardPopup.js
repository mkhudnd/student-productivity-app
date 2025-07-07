// RewardPopup.js - Gamification notification component for immediate reward feedback
// This component provides:
// - Quick, non-intrusive reward notifications after study sessions
// - Animated progress bars and visual feedback for points earned
// - Auto-hiding functionality to maintain user flow
// - Special handling for goal achievements and milestones
// - Smooth animations using React Native's Animated API
// - Integration with the comprehensive reward system

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// RewardPopup Component - displays brief reward notifications to users
// Parameters:
// - visible: Boolean controlling popup visibility
// - rewards: Array of reward objects containing points, bonuses, and achievements
// - onClose: Callback function when popup is dismissed
// - onViewDetails: Optional callback to view detailed reward information
export default function RewardPopup({ visible, rewards, onClose, onViewDetails }) {
  // Theme context for consistent styling
  const { theme } = useTheme();
  
  // Animation references for smooth transitions and effects
  const fadeAnim = useRef(new Animated.Value(0)).current;      // Controls popup opacity
  const slideAnim = useRef(new Animated.Value(50)).current;    // Controls popup position (slide up effect)
  const progressAnim = useRef(new Animated.Value(0)).current;  // Controls progress bar animation
  
  // Component state for managing popup lifecycle
  const [isVisible, setIsVisible] = useState(false);          // Internal visibility state
  const [currentReward, setCurrentReward] = useState(null);   // Currently displayed reward

  // Auto-Hide Timer Effect - automatically dismisses popup after 4 seconds
  useEffect(() => {
    let autoHideTimer;
    
    if (visible && rewards && rewards.length > 0) {
      // Set the current reward to display
      setCurrentReward(rewards[0]); // Display the first reward if multiple exist
      setIsVisible(true);
      
      // Start entrance animations
      showPopup();
      
      // Set auto-hide timer for 4 seconds
      autoHideTimer = setTimeout(() => {
        hidePopup();
      }, 4000);
    }
    
    // Cleanup timer on component unmount or dependency change
    return () => {
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
    };
  }, [visible, rewards]);

  // Animation Functions - handle popup entrance and exit transitions
  
  // Show popup with smooth fade-in and slide-up animation
  const showPopup = () => {
    // Reset animation values
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    progressAnim.setValue(0);
    
    // Start parallel animations for smooth entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,             // Fade to fully visible
        duration: 300,          // 300ms fade duration
        useNativeDriver: true,  // Use native driver for better performance
      }),
      Animated.timing(slideAnim, {
        toValue: 0,             // Slide to final position
        duration: 300,          // 300ms slide duration
        useNativeDriver: true,
      })
    ]).start(() => {
      // After entrance animation completes, animate progress bar
      Animated.timing(progressAnim, {
        toValue: 1,             // Animate progress from 0 to 1
        duration: 1000,         // 1 second progress animation
        useNativeDriver: false, // Cannot use native driver for scaleX transform
      }).start();
    });
  };

  // Hide popup with smooth fade-out animation
  const hidePopup = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,             // Fade to transparent
        duration: 200,          // 200ms fade duration (faster exit)
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,           // Slide upward and off-screen
        duration: 200,          // 200ms slide duration
        useNativeDriver: true,
      })
    ]).start(() => {
      // After animation completes, hide popup and notify parent
      setIsVisible(false);
      setCurrentReward(null);
      if (onClose) {
        onClose();
      }
    });
  };

  // Manual Close Handler - allows user to dismiss popup early
  const handleClose = () => {
    hidePopup();
  };

  // View Details Handler - opens detailed reward view if callback provided
  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails();
    }
    hidePopup();
  };

  // Reward Type Detection - determines special handling for different reward types
  const isGoalAchievement = currentReward?.goalAchieved;
  const hasMultipleRewards = rewards?.length > 1;
  const hasNewAchievements = currentReward?.newAchievements?.length > 0;

  // Conditional Rendering - only render when visible and has reward data
  if (!isVisible || !currentReward) {
    return null;
  }

  // Apply theme-based styles
  const styles = getStyles(theme);

  // Main Render - displays the complete reward popup with animations
  return (
    <Modal
      transparent={true}
      visible={isVisible}
      animationType="none"     // We handle animations manually
      onRequestClose={handleClose}
    >
      {/* Backdrop Overlay - semi-transparent background */}
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.popup,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Header Section - displays main reward information */}
          <View style={styles.header}>
            {/* Reward Icon - changes based on achievement type */}
            <View style={[
              styles.iconContainer,
              isGoalAchievement ? styles.goalIconContainer : styles.defaultIconContainer
            ]}>
              <Ionicons
                name={isGoalAchievement ? "trophy" : "star"}
                size={24}
                color={isGoalAchievement ? "#FFD700" : theme.colors.primary}
              />
            </View>
            
            {/* Reward Text */}
            <View style={styles.textContainer}>
              <Text style={styles.title}>
                {isGoalAchievement ? "Goal Achieved!" : "Points Earned!"}
              </Text>
              <Text style={styles.pointsText}>
                +{currentReward.totalPoints} points
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close reward notification"
            >
              <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Goal Achievement Banner - special display for daily goal completion */}
          {isGoalAchievement && (
            <View style={styles.goalBanner}>
              <Text style={styles.goalBannerText}>
                🎯 Daily study goal completed!
              </Text>
            </View>
          )}

          {/* Bonus Information - displays earned bonuses */}
          {currentReward.bonuses && currentReward.bonuses.length > 0 && (
            <View style={styles.bonusContainer}>
              <Text style={styles.bonusTitle}>Bonuses earned:</Text>
              {currentReward.bonuses.slice(0, 2).map((bonus, index) => (
                <Text key={index} style={styles.bonusText}>
                  • {bonus}
                </Text>
              ))}
              {currentReward.bonuses.length > 2 && (
                <Text style={styles.bonusText}>
                  • And {currentReward.bonuses.length - 2} more...
                </Text>
              )}
            </View>
          )}

          {/* Progress Bar Animation - visual feedback for points earned */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    transform: [
                      {
                        scaleX: progressAnim // Animate from 0 to 1 (0% to 100% width)
                      }
                    ]
                  }
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {currentReward.totalPoints} points added
            </Text>
          </View>

          {/* Action Buttons - additional actions user can take */}
          <View style={styles.actionContainer}>
            {/* View Details Button - shown if callback provided or multiple rewards */}
            {(onViewDetails || hasMultipleRewards || hasNewAchievements) && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleViewDetails}
                accessibilityRole="button"
                accessibilityLabel="View detailed reward information"
              >
                <Text style={styles.actionButtonText}>
                  {hasNewAchievements ? "View Achievements" : "View Details"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Multiple Rewards Indicator - shows if more rewards are available */}
          {hasMultipleRewards && (
            <View style={styles.multipleRewardsIndicator}>
              <Text style={styles.multipleRewardsText}>
                +{rewards.length - 1} more reward{rewards.length > 2 ? 's' : ''}
              </Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// Theme-aware styles function - creates styles based on current theme
const getStyles = (theme) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
  },
  popup: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    width: '90%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  defaultIconContainer: {
    backgroundColor: theme.colors.primary + '20',
  },
  goalIconContainer: {
    backgroundColor: '#FFD70020',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  pointsText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  closeButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
  },
  goalBanner: {
    backgroundColor: theme.colors.primary + '15',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  goalBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  bonusContainer: {
    marginBottom: 16,
  },
  bonusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  bonusText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: theme.colors.background,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
    transformOrigin: 'left',
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  actionContainer: {
    marginBottom: 8,
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.background,
  },
  multipleRewardsIndicator: {
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  multipleRewardsText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
}); 