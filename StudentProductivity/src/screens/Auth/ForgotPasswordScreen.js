import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { readJson, writeJson } from '../../storage/fileStorage';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

// Security questions for password reset
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

// ForgotPasswordScreen allows users to reset their password stored in users.json
export default function ForgotPasswordScreen({ navigation }) {
  const { theme } = useTheme();
  const [step, setStep] = useState(1); // 1: Email, 2: Security Question, 3: New Password
  const [email, setEmail] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const styles = getStyles(theme);

  // Password requirements checkers
  const passwordRequirements = [
    {
      label: 'At least 8 characters',
      test: (pw) => pw.length >= 8,
    },
    {
      label: 'One uppercase letter',
      test: (pw) => /[A-Z]/.test(pw),
    },
    {
      label: 'One lowercase letter',
      test: (pw) => /[a-z]/.test(pw),
    },
    {
      label: 'One number',
      test: (pw) => /[0-9]/.test(pw),
    },
    {
      label: 'One special character',
      test: (pw) => /[^A-Za-z0-9]/.test(pw),
    },
  ];

  // Step 1: Verify email exists
  const handleEmailVerification = async () => {
    setError('');
    setLoading(true);

    if (!email.trim()) {
      setError('Please enter your email address.');
      setLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    try {
      const users = (await readJson('users.json')) || [];
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        setError('No account found with this email address.');
        setLoading(false);
        return;
      }

      // Check if user has security question set up
      if (!user.securityQuestion || !user.securityAnswer) {
        Alert.alert(
          'Security Setup Required',
          'This account needs to set up a security question for password recovery. Please contact support or try logging in with your current password.',
          [
            { text: 'Back to Login', onPress: () => navigation.navigate('Login') }
          ]
        );
        setLoading(false);
        return;
      }

      setFoundUser(user);
      setStep(2);
    } catch (error) {
      setError('An error occurred. Please try again.');
    }
    
    setLoading(false);
  };

  // Step 2: Verify security question
  const handleSecurityVerification = async () => {
    setError('');
    setLoading(true);

    if (!securityAnswer.trim()) {
      setError('Please answer the security question.');
      setLoading(false);
      return;
    }

    // Simple case-insensitive comparison
    const userAnswer = foundUser.securityAnswer.toLowerCase().trim();
    const providedAnswer = securityAnswer.toLowerCase().trim();

    if (userAnswer !== providedAnswer) {
      setError('Security answer is incorrect. Please try again.');
      setLoading(false);
      return;
    }

    setStep(3);
    setLoading(false);
  };

  // Step 3: Set new password
  const handlePasswordReset = async () => {
    setError('');
    setLoading(true);

    if (!newPassword || !confirmPassword) {
      setError('Please enter and confirm your new password.');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    // Check password requirements
    const unmetRequirements = passwordRequirements.filter(req => !req.test(newPassword));
    if (unmetRequirements.length > 0) {
      setError('Password does not meet all requirements.');
      setLoading(false);
      return;
    }

    try {
      const users = (await readJson('users.json')) || [];
      const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (userIndex === -1) {
        setError('User not found. Please start over.');
        setLoading(false);
        return;
      }

      // Update password and add reset timestamp
      users[userIndex].password = newPassword;
      users[userIndex].lastPasswordReset = new Date().toISOString();
      
      await writeJson('users.json', users);
      
      Alert.alert(
        'Password Reset Successful!', 
        'Your password has been updated. You can now log in with your new password.',
        [
          { text: 'Go to Login', onPress: () => navigation.navigate('Login') }
        ]
      );
    } catch (error) {
      setError('An error occurred while resetting your password. Please try again.');
    }
    
    setLoading(false);
  };

  const resetProcess = () => {
    setStep(1);
    setEmail('');
    setSecurityAnswer('');
    setNewPassword('');
    setConfirmPassword('');
    setFoundUser(null);
    setError('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={40}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back-outline" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            
            <View style={styles.logoContainer}>
              <Ionicons name="lock-closed" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Follow the steps to securely reset your password</Text>
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>Step {step} of 3</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formContainer}>
            {/* Step 1: Email Verification */}
            {step === 1 && (
              <>
                <View style={styles.stepHeader}>
                  <Ionicons name="mail-outline" size={32} color={theme.colors.primary} />
                  <Text style={styles.stepTitle}>Find Your Account</Text>
                  <Text style={styles.stepSubtitle}>
                    Enter your email address to begin the password reset process.
                  </Text>
                </View>
                
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email address"
                      value={email}
                      onChangeText={setEmail}
                      placeholderTextColor={theme.colors.textSecondary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                    />
                  </View>
                </View>

                {error ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={16} color="#F44336" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity 
                  style={[styles.primaryButton, loading && styles.buttonDisabled]} 
                  onPress={handleEmailVerification}
                  disabled={loading}
                >
                  {loading ? (
                    <View style={styles.buttonRow}>
                      <Ionicons name="hourglass-outline" size={20} color={theme.colors.background} />
                      <Text style={styles.buttonText}>Verifying...</Text>
                    </View>
                  ) : (
                    <View style={styles.buttonRow}>
                      <Ionicons name="search-outline" size={20} color={theme.colors.background} />
                      <Text style={styles.buttonText}>Find Account</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Step 2: Security Question */}
            {step === 2 && foundUser && (
              <>
                <View style={styles.stepHeader}>
                  <Ionicons name="shield-checkmark-outline" size={32} color={theme.colors.primary} />
                  <Text style={styles.stepTitle}>Security Verification</Text>
                  <Text style={styles.stepSubtitle}>
                    Answer your security question to verify your identity.
                  </Text>
                </View>
                
                <View style={styles.questionContainer}>
                  <Text style={styles.questionLabel}>Security Question:</Text>
                  <Text style={styles.questionText}>{foundUser.securityQuestion}</Text>
                </View>
                
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Your Answer</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="chatbubble-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your answer"
                      value={securityAnswer}
                      onChangeText={setSecurityAnswer}
                      placeholderTextColor={theme.colors.textSecondary}
                      autoCapitalize="words"
                      editable={!loading}
                    />
                  </View>
                </View>

                {error ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={16} color="#F44336" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <View style={styles.buttonContainer}>
                  <TouchableOpacity 
                    style={styles.secondaryButton} 
                    onPress={() => setStep(1)}
                  >
                    <View style={styles.buttonRow}>
                      <Ionicons name="arrow-back-outline" size={20} color={theme.colors.primary} />
                      <Text style={styles.secondaryButtonText}>Back</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.primaryButton, styles.flexButton, loading && styles.buttonDisabled]} 
                    onPress={handleSecurityVerification}
                    disabled={loading}
                  >
                    {loading ? (
                      <View style={styles.buttonRow}>
                        <Ionicons name="hourglass-outline" size={20} color={theme.colors.background} />
                        <Text style={styles.buttonText}>Verifying...</Text>
                      </View>
                    ) : (
                      <View style={styles.buttonRow}>
                        <Ionicons name="checkmark-outline" size={20} color={theme.colors.background} />
                        <Text style={styles.buttonText}>Verify</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 3: New Password */}
            {step === 3 && (
              <>
                <View style={styles.stepHeader}>
                  <Ionicons name="key-outline" size={32} color={theme.colors.primary} />
                  <Text style={styles.stepTitle}>Set New Password</Text>
                  <Text style={styles.stepSubtitle}>
                    Create a strong new password for your account.
                  </Text>
                </View>
                
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      placeholderTextColor={theme.colors.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                    />
                    <TouchableOpacity 
                      style={styles.eyeIcon}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons 
                        name={showPassword ? "eye-outline" : "eye-off-outline"} 
                        size={20} 
                        color={theme.colors.textSecondary} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      placeholderTextColor={theme.colors.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                    />
                  </View>
                </View>

                {/* Password Requirements */}
                {newPassword.length > 0 && (
                  <View style={styles.requirementsContainer}>
                    <Text style={styles.requirementsTitle}>Password Requirements</Text>
                    {passwordRequirements.map((req, idx) => {
                      const met = req.test(newPassword);
                      return (
                        <View key={idx} style={styles.requirementRow}>
                          <Ionicons 
                            name={met ? "checkmark-circle" : "ellipse-outline"} 
                            size={16} 
                            color={met ? '#4CAF50' : theme.colors.textSecondary} 
                          />
                          <Text style={[styles.requirementText, { color: met ? '#4CAF50' : theme.colors.textSecondary }]}>
                            {req.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {error ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={16} color="#F44336" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <View style={styles.buttonContainer}>
                  <TouchableOpacity 
                    style={styles.secondaryButton} 
                    onPress={() => setStep(2)}
                  >
                    <View style={styles.buttonRow}>
                      <Ionicons name="arrow-back-outline" size={20} color={theme.colors.primary} />
                      <Text style={styles.secondaryButtonText}>Back</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.primaryButton, styles.flexButton, loading && styles.buttonDisabled]} 
                    onPress={handlePasswordReset}
                    disabled={loading}
                  >
                    {loading ? (
                      <View style={styles.buttonRow}>
                        <Ionicons name="hourglass-outline" size={20} color={theme.colors.background} />
                        <Text style={styles.buttonText}>Updating...</Text>
                      </View>
                    ) : (
                      <View style={styles.buttonRow}>
                        <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.background} />
                        <Text style={styles.buttonText}>Reset Password</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Ionicons name="arrow-back-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.loginButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.colors.background 
  },
  keyboardView: { 
    flex: 1 
  },
  scrollContent: { 
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.background,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.card,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: theme.colors.primary,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  formContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.background,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    paddingVertical: 16,
  },
  eyeIcon: {
    padding: 4,
  },
  questionContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  questionLabel: {
    fontSize: 14,
    color: theme.colors.primary,
    marginBottom: 8,
    fontWeight: '600',
  },
  questionText: {
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: 22,
  },
  requirementsContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  requirementText: {
    fontSize: 14,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  flexButton: {
    flex: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.background,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    alignItems: 'center',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
}); 