import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { AnalyticsService } from '../utils/analyticsService';
import ScreenLayout from '../components/ScreenLayout';

// Security questions for account recovery
const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "What is your favorite book?",
  "What was your childhood nickname?",
  "What is the name of your favorite teacher?",
  "What street did you live on in third grade?",
];

export default function ProfileScreen({ navigation }) {
  const { theme } = useTheme();
  const { currentUser, logoutUser, updateUser, checkEmailExists, checkUsernameExists } = useUser();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editType, setEditType] = useState(''); // 'username', 'email', 'password'
  const [editValue, setEditValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [userStats, setUserStats] = useState(null);
  
  // Security question management
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [isSettingUpSecurity, setIsSettingUpSecurity] = useState(false);
  
  // Password change with security verification
  const [passwordChangeModalVisible, setPasswordChangeModalVisible] = useState(false);
  const [securityVerificationStep, setSecurityVerificationStep] = useState(1); // 1: security question, 2: new password
  const [securityAnswerInput, setSecurityAnswerInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isAccountDeletion, setIsAccountDeletion] = useState(false); // Track if we're deleting account

  const styles = getStyles(theme);

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      const analytics = await AnalyticsService.getAnalyticsData(currentUser);
      const summary = await AnalyticsService.getAnalyticsSummary(30, currentUser); // Last 30 days
      
      if (summary) {
        // Map the analytics summary to the expected format
        const mappedStats = {
          totalStudyHours: Math.round((summary.study.totalStudyTime || 0) / 60 * 10) / 10, // Convert minutes to hours
          currentStreak: summary.study.streakDays || 0,
          completedPlannerEvents: summary.planner.completedEvents || 0,
          totalStudySessions: summary.study.totalSessions || 0,
          // Additional stats we can show
          totalEvents: summary.planner.totalEvents || 0,
          completionRate: summary.planner.completionRate || 0,
          totalActivities: summary.combined.totalActivities || 0,
          averageSessionTime: summary.study.averageSessionTime || 0,
        };
        setUserStats(mappedStats);
      } else {
        // Set default values if no analytics data
        setUserStats({
          totalStudyHours: 0,
          currentStreak: 0,
          completedPlannerEvents: 0,
          totalStudySessions: 0,
          totalEvents: 0,
          completionRate: 0,
          totalActivities: 0,
          averageSessionTime: 0,
        });
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
      // Set default values on error
      setUserStats({
        totalStudyHours: 0,
        currentStreak: 0,
        completedPlannerEvents: 0,
        totalStudySessions: 0,
        totalEvents: 0,
        completionRate: 0,
        totalActivities: 0,
        averageSessionTime: 0,
      });
    }
  };

  // Password validation function
  const validatePassword = (password) => {
    const requirements = [
      { test: password.length >= 8, message: "At least 8 characters" },
      { test: /[A-Z]/.test(password), message: "One uppercase letter" },
      { test: /[a-z]/.test(password), message: "One lowercase letter" },
      { test: /[0-9]/.test(password), message: "One number" },
      { test: /[^A-Za-z0-9]/.test(password), message: "One special character" },
    ];
    
    const unmet = requirements.filter(req => !req.test);
    return {
      isValid: unmet.length === 0,
      requirements: requirements,
      unmetRequirements: unmet
    };
  };

  // Handle security question setup/change
  const handleSecurityQuestionSetup = () => {
    if (currentUser.securityQuestion) {
      setSelectedQuestion(currentUser.securityQuestion);
      setSecurityAnswer('');
      setIsSettingUpSecurity(false);
    } else {
      setSelectedQuestion(SECURITY_QUESTIONS[0]);
      setSecurityAnswer('');
      setIsSettingUpSecurity(true);
    }
    setSecurityModalVisible(true);
  };

  // Save security question
  const handleSaveSecurityQuestion = async () => {
    if (!securityAnswer.trim() || securityAnswer.trim().length < 3) {
      Alert.alert('Error', 'Security answer must be at least 3 characters long.');
      return;
    }

    setLoading(true);
    try {
      const result = await updateUser({
        securityQuestion: selectedQuestion,
        securityAnswer: securityAnswer.trim()
      });

      if (result.success) {
        Alert.alert(
          'Success',
          isSettingUpSecurity ? 'Security question set up successfully!' : 'Security question updated successfully!'
        );
        setSecurityModalVisible(false);
        setSecurityAnswer('');
      } else {
        Alert.alert('Error', result.error || 'Failed to update security question');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle password change with security verification
  const handlePasswordChangeRequest = () => {
    if (!currentUser.securityQuestion || !currentUser.securityAnswer) {
      Alert.alert(
        'Security Question Required',
        'You need to set up a security question before you can change your password.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Set Up Now', onPress: handleSecurityQuestionSetup }
        ]
      );
      return;
    }
    
    setIsAccountDeletion(false);
    setSecurityVerificationStep(1);
    setSecurityAnswerInput('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordChangeModalVisible(true);
  };

  // Verify security answer for password change
  const handleSecurityVerification = () => {
    if (!securityAnswerInput.trim()) {
      Alert.alert('Error', 'Please answer the security question.');
      return;
    }

    const userAnswer = currentUser.securityAnswer.toLowerCase().trim();
    const providedAnswer = securityAnswerInput.toLowerCase().trim();

    if (userAnswer !== providedAnswer) {
      Alert.alert('Error', 'Security answer is incorrect. Please try again.');
      return;
    }

    if (isAccountDeletion) {
      setPasswordChangeModalVisible(false);
      handleCompleteAccountDeletion();
    } else {
      setSecurityVerificationStep(2);
    }
  };

  // Complete password change
  const handleCompletePasswordChange = async () => {
    if (!newPassword || !confirmNewPassword) {
      Alert.alert('Error', 'Please enter and confirm your new password.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      Alert.alert(
        'Invalid Password', 
        `Password must meet all requirements:\n${passwordValidation.unmetRequirements.map(req => `• ${req.message}`).join('\n')}`
      );
      return;
    }

    setLoading(true);
    try {
      const result = await updateUser({
        password: newPassword,
        lastPasswordReset: new Date().toISOString()
      });

      if (result.success) {
        Alert.alert(
          'Success',
          'Password changed successfully!'
        );
        setPasswordChangeModalVisible(false);
        setSecurityAnswerInput('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        Alert.alert('Error', result.error || 'Failed to change password');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle account deletion request
  const handleDeleteAccountRequest = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently delete:\n\n• Your profile and login credentials\n• All study tracker data\n• All flashcard decks and progress\n• All daily planner events\n• All analytics and statistics\n\nDo you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue', 
          style: 'destructive',
          onPress: () => {
            if (!currentUser.securityQuestion || !currentUser.securityAnswer) {
              Alert.alert(
                'Security Question Required',
                'You need to set up a security question before you can delete your account.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Set Up Now', onPress: handleSecurityQuestionSetup }
                ]
              );
              return;
            }
            // Show security verification for account deletion
            setIsAccountDeletion(true);
            setSecurityVerificationStep(1);
            setSecurityAnswerInput('');
            setPasswordChangeModalVisible(true); // Reuse the modal for verification
          }
        }
      ]
    );
  };

  // Complete account deletion after security verification
  const handleCompleteAccountDeletion = async () => {
    Alert.alert(
      'Final Confirmation',
      'This is your last chance to cancel. Deleting your account will permanently remove all your data and cannot be undone.\n\nType "DELETE" to confirm:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enter DELETE',
          style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'Confirm Deletion',
              'Type "DELETE" to permanently delete your account:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Account',
                  style: 'destructive',
                  onPress: async (input) => {
                    if (input !== 'DELETE') {
                      Alert.alert('Error', 'You must type "DELETE" exactly to confirm.');
                      return;
                    }
                    await performAccountDeletion();
                  }
                }
              ],
              'plain-text'
            );
          }
        }
      ]
    );
  };

  // Perform the actual account deletion
  const performAccountDeletion = async () => {
    setLoading(true);
    
    try {
      // Import necessary modules for data deletion
      const { readJson, writeJson, deleteJson } = require('../storage/fileStorage');
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const { DataMigrationService } = require('../utils/dataMigration');
      
      // Store user email for deletion (since currentUser will be cleared)
      const userEmailToDelete = currentUser.email;
      
      // 1. Log out the user FIRST to clear current state
      await logoutUser();
      
      // 2. Clear all AsyncStorage data to ensure user is completely logged out
      await AsyncStorage.clear();
      
      // 3. Clean up user-specific data from shared files
      await DataMigrationService.cleanupUserData(userEmailToDelete);
      
      // 4. Remove user from users.json (with retry logic for file system consistency)
      let deletionSuccess = false;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!deletionSuccess && retryCount < maxRetries) {
        try {
          const users = (await readJson('users.json')) || [];
          const userExists = users.some(u => u.email === userEmailToDelete);
          
          if (userExists) {
            const updatedUsers = users.filter(u => u.email !== userEmailToDelete);
            await writeJson('users.json', updatedUsers);
            
            // Verify deletion was successful
            const verifyUsers = (await readJson('users.json')) || [];
            const stillExists = verifyUsers.some(u => u.email === userEmailToDelete);
            
            if (!stillExists) {
              deletionSuccess = true;
              console.log('User account successfully deleted from users.json');
            } else {
              throw new Error('User still exists after deletion attempt');
            }
          } else {
            console.log('User already removed from users.json');
            deletionSuccess = true;
          }
        } catch (error) {
          retryCount++;
          console.error(`Account deletion attempt ${retryCount} failed:`, error);
          if (retryCount < maxRetries) {
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
      
      if (!deletionSuccess) {
        throw new Error('Failed to delete user account after multiple attempts');
      }
      
      // 5. Navigate to login screen immediately
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
      
      // 6. Show success alert after navigation
      setTimeout(() => {
        Alert.alert(
          'Account Deleted',
          'Your account and all data have been permanently deleted. The deleted account cannot be used to log in again.',
          [{ text: 'OK' }]
        );
      }, 500); // Brief delay to ensure navigation completes
      
    } catch (error) {
      console.error('Error deleting account:', error);
      setLoading(false);
      
      // Even if there was an error, still try to log out the user
      try {
        await logoutUser();
        await AsyncStorage.clear();
      } catch (logoutError) {
        console.error('Error during emergency logout:', logoutError);
      }
      
      Alert.alert(
        'Deletion Error',
        'An error occurred while deleting your account. Some data may not have been removed completely. Please try logging out manually and contact support if the issue persists.',
        [
          { 
            text: 'Force Logout', 
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            }
          },
          { text: 'Try Again', onPress: () => setLoading(false) }
        ]
      );
    }
    // Note: No finally block with setLoading(false) here since we're navigating away
  };

  const handleEdit = (type) => {
    setEditType(type);
    setEditValue(type === 'password' ? '' : currentUser[type] || '');
    setConfirmPassword('');
    setCurrentPassword('');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editValue.trim()) {
      Alert.alert('Error', 'Field cannot be empty');
      return;
    }

    setLoading(true);

    try {
      // Validate based on edit type
      if (editType === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(editValue)) {
          Alert.alert('Error', 'Please enter a valid email address');
          return;
        }
        
        const emailExists = await checkEmailExists(editValue, true);
        if (emailExists) {
          Alert.alert('Error', 'This email is already registered');
          return;
        }
      }

      if (editType === 'username') {
        if (editValue.length < 3) {
          Alert.alert('Error', 'Username must be at least 3 characters long');
          return;
        }
        
        const usernameExists = await checkUsernameExists(editValue, true);
        if (usernameExists) {
          Alert.alert('Error', 'This username is already taken');
          return;
        }
      }

      if (editType === 'password') {
        if (!currentPassword) {
          Alert.alert('Error', 'Please enter your current password');
          return;
        }
        
        if (currentPassword !== currentUser.password) {
          Alert.alert('Error', 'Current password is incorrect');
          return;
        }
        
        if (editValue.length < 6) {
          Alert.alert('Error', 'New password must be at least 6 characters long');
          return;
        }
        
        if (editValue !== confirmPassword) {
          Alert.alert('Error', 'New passwords do not match');
          return;
        }
      }

      // Update user
      const updateData = {
        [editType]: editValue
      };

      const result = await updateUser(updateData);
      
      if (result.success) {
        Alert.alert(
          'Success',
          `${editType.charAt(0).toUpperCase() + editType.slice(1)} updated successfully!`
        );
        setEditModalVisible(false);
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logoutUser();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          },
        },
      ]
    );
  };

  const ProfileItem = ({ icon, title, subtitle, onPress, showArrow = true }) => (
    <TouchableOpacity style={styles.profileItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.profileItemLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={24} color={theme.colors.primary} />
        </View>
        <View style={styles.profileItemText}>
          <Text style={styles.profileItemTitle}>{title}</Text>
          {subtitle && <Text style={styles.profileItemSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {showArrow && (
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  const StatCard = ({ icon, title, value, subtitle }) => (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={32} color={theme.colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  if (!currentUser) {
    return (
      <ScreenLayout
        showHeader={true}
        headerTitle="Profile"
        headerIcon="person-outline"
        navigation={navigation}
      >
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.errorText}>No user logged in</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      showHeader={true}
      headerTitle="Profile"
      headerIcon="person-outline"
      scrollable={true}
      headerRight={
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color={theme.colors.error} />
        </TouchableOpacity>
      }
      navigation={navigation}
    >
        {/* User Info Section */}
        <View style={styles.section}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {currentUser.username ? currentUser.username.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
            <Text style={styles.userName}>{currentUser.username || 'Unknown User'}</Text>
            <Text style={styles.userEmail}>{currentUser.email || 'No email'}</Text>
          </View>
        </View>

        {/* User Statistics */}
        {userStats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Statistics (Last 30 Days)</Text>
            <View style={styles.statsContainer}>
              <StatCard
                icon="time-outline"
                title="Study Hours"
                value={userStats.totalStudyHours}
                subtitle="Hours studied"
              />
              <StatCard
                icon="flame-outline"
                title="Current Streak"
                value={userStats.currentStreak}
                subtitle="Study days"
              />
              <StatCard
                icon="calendar-outline"
                title="Events Completed"
                value={userStats.completedPlannerEvents}
                subtitle={`of ${userStats.totalEvents} planned`}
              />
              <StatCard
                icon="trophy-outline"
                title="Study Sessions"
                value={userStats.totalStudySessions}
                subtitle="Completed"
              />
              {userStats.completionRate > 0 && (
                <StatCard
                  icon="checkmark-circle-outline"
                  title="Completion Rate"
                  value={`${userStats.completionRate}%`}
                  subtitle="Task completion"
                />
              )}
              {userStats.averageSessionTime > 0 && (
                <StatCard
                  icon="timer-outline"
                  title="Avg Session"
                  value={`${userStats.averageSessionTime}min`}
                  subtitle="Study duration"
                />
              )}
            </View>
          </View>
        )}

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          
          <ProfileItem
            icon="person-outline"
            title="Username"
            subtitle={currentUser.username}
            onPress={() => handleEdit('username')}
          />
          
          <ProfileItem
            icon="mail-outline"
            title="Email Address"
            subtitle={currentUser.email}
            onPress={() => handleEdit('email')}
          />
          
          <ProfileItem
            icon="lock-closed-outline"
            title="Password"
            subtitle="Change your password"
            onPress={() => handleEdit('password')}
          />
          
          <ProfileItem
            icon="shield-checkmark-outline"
            title="Security Question"
            subtitle={currentUser.securityQuestion ? "Update security question" : "Set up security question"}
            onPress={handleSecurityQuestionSetup}
          />
          
          <ProfileItem
            icon="key-outline"
            title="Change Password (Secure)"
            subtitle="Change password with security verification"
            onPress={handlePasswordChangeRequest}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <ProfileItem
            icon="stats-chart-outline"
            title="View Analytics"
            subtitle="Detailed study insights"
            onPress={() => navigation.navigate('Analytics')}
          />
          
          <ProfileItem
            icon="settings-outline"
            title="App Settings"
            subtitle="Customize your experience"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButtonLarge} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={theme.colors.error} />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.dangerSectionTitle}>Danger Zone</Text>
          <Text style={styles.dangerSectionSubtitle}>
            These actions are permanent and cannot be undone. Please be careful.
          </Text>
          
          <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccountRequest}>
            <Ionicons name="trash-outline" size={24} color="#FF4444" />
            <View style={styles.deleteAccountTextContainer}>
              <Text style={styles.deleteAccountTitle}>Delete Account</Text>
              <Text style={styles.deleteAccountSubtitle}>Permanently delete your account and all data</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FF4444" />
          </TouchableOpacity>
        </View>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Edit {editType.charAt(0).toUpperCase() + editType.slice(1)}
            </Text>

            {editType === 'password' && (
              <>
                <Text style={styles.inputLabel}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showPasswords}
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </>
            )}

            <Text style={styles.inputLabel}>
              {editType === 'password' ? 'New Password' : editType.charAt(0).toUpperCase() + editType.slice(1)}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={`Enter new ${editType}`}
              value={editValue}
              onChangeText={setEditValue}
              secureTextEntry={editType === 'password' && !showPasswords}
              keyboardType={editType === 'email' ? 'email-address' : 'default'}
              autoCapitalize="none"
              placeholderTextColor={theme.colors.textSecondary}
            />

            {editType === 'password' && (
              <>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPasswords}
                  placeholderTextColor={theme.colors.textSecondary}
                />

                <View style={styles.passwordToggle}>
                  <Switch
                    value={showPasswords}
                    onValueChange={setShowPasswords}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.surface}
                  />
                  <Text style={styles.passwordToggleText}>Show Passwords</Text>
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, loading && styles.disabledButton]}
                onPress={handleSaveEdit}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Security Question Modal */}
      <Modal
        visible={securityModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSecurityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isSettingUpSecurity ? 'Set Up Security Question' : 'Update Security Question'}
            </Text>

            <Text style={styles.inputLabel}>Security Question</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedQuestion}
                onValueChange={setSelectedQuestion}
                style={styles.picker}
              >
                {SECURITY_QUESTIONS.map((question, index) => (
                  <Picker.Item key={index} label={question} value={question} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Your Answer</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your answer"
              value={securityAnswer}
              onChangeText={setSecurityAnswer}
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="words"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setSecurityModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, loading && styles.disabledButton]}
                onPress={handleSaveSecurityQuestion}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Password Change Modal */}
      <Modal
        visible={passwordChangeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPasswordChangeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {securityVerificationStep === 1 ? (
              <>
                <Text style={styles.modalTitle}>Security Verification</Text>
                <Text style={styles.modalSubtitle}>
                  Answer your security question to verify your identity before changing your password.
                </Text>

                <View style={styles.questionContainer}>
                  <Text style={styles.questionLabel}>Security Question:</Text>
                  <Text style={styles.questionText}>{currentUser.securityQuestion}</Text>
                </View>

                <Text style={styles.inputLabel}>Your Answer</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your answer"
                  value={securityAnswerInput}
                  onChangeText={setSecurityAnswerInput}
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setPasswordChangeModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleSecurityVerification}
                  >
                    <Text style={styles.saveButtonText}>Continue</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Set New Password</Text>
                <Text style={styles.modalSubtitle}>
                  Create a strong new password for your account.
                </Text>

                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPasswords}
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm new password"
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry={!showPasswords}
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />

                <View style={styles.passwordToggle}>
                  <Switch
                    value={showPasswords}
                    onValueChange={setShowPasswords}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.surface}
                  />
                  <Text style={styles.passwordToggleText}>Show Passwords</Text>
                </View>

                {/* Password Requirements */}
                {newPassword.length > 0 && (
                  <View style={styles.requirementsContainer}>
                    <Text style={styles.requirementsTitle}>Password Requirements:</Text>
                    {validatePassword(newPassword).requirements.map((req, idx) => (
                      <View key={idx} style={styles.requirementRow}>
                        <Text style={[styles.requirementIcon, { color: req.test ? '#4CAF50' : theme.colors.textSecondary }]}>
                          {req.test ? '✔' : '✖'}
                        </Text>
                        <Text style={[styles.requirementText, { color: req.test ? '#4CAF50' : theme.colors.textSecondary }]}>
                          {req.message}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setSecurityVerificationStep(1)}
                  >
                    <Text style={styles.cancelButtonText}>Back</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton, loading && styles.disabledButton]}
                    onPress={handleCompletePasswordChange}
                    disabled={loading}
                  >
                    <Text style={styles.saveButtonText}>
                      {loading ? 'Updating...' : 'Change Password'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  userInfo: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '48%',
    marginBottom: 12,
    minHeight: 100,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 8,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginTop: 4,
  },
  statSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  profileItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileItemText: {
    flex: 1,
  },
  profileItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  profileItemSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  logoutButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.error,
    marginLeft: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    marginVertical: 16,
  },
  loginButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  passwordToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  passwordToggleText: {
    fontSize: 14,
    color: theme.colors.text,
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 8,
  },
  picker: {
    width: '100%',
  },
  questionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginRight: 8,
  },
  questionText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  requirementsContainer: {
    marginTop: 12,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 4,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementIcon: {
    marginRight: 8,
  },
  requirementText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  dangerSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  dangerSectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  deleteAccountTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  deleteAccountTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 4,
  },
  deleteAccountSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
}); 