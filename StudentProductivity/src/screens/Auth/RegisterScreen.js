import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Dimensions, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { readJson, writeJson } from '../../storage/fileStorage';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import ScreenLayout from '../../components/ScreenLayout';

const { width } = Dimensions.get('window');

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

// RegisterScreen allows users to create a new account stored in users.json
export default function RegisterScreen({ navigation }) {
  const { theme } = useTheme();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const { loginUser } = useUser();
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

  // Handle register button press
  const handleRegister = async () => {
    setError('');
    setIsLoading(true);
    
    if (!username || !email || !password || !confirmPassword || !securityAnswer) {
      setError('Please fill in all fields.');
      setIsLoading(false);
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }
    
    if (!agreeTerms) {
      setError('You must agree to the terms and conditions.');
      setIsLoading(false);
      return;
    }
    
    if (securityAnswer.trim().length < 3) {
      setError('Security answer must be at least 3 characters long.');
      setIsLoading(false);
      return;
    }

    // Check password requirements
    const unmetRequirements = passwordRequirements.filter(req => !req.test(password));
    if (unmetRequirements.length > 0) {
      setError('Password does not meet all requirements.');
      setIsLoading(false);
      return;
    }
    
    try {
      // Check for duplicate username/email
      const users = (await readJson('users.json')) || [];
      
      if (users.some(u => u.email === email)) {
        setError('Email already registered.');
        setIsLoading(false);
        return;
      }
      
      if (users.some(u => u.username === username)) {
        setError('Username already taken.');
        setIsLoading(false);
        return;
      }
      
      // Add new user
      const newUser = { 
        username, 
        email, 
        password,
        securityQuestion,
        securityAnswer: securityAnswer.trim(),
        createdAt: new Date().toISOString(),
      };
      
      users.push(newUser);
      await writeJson('users.json', users);
      
      // Automatically login the new user
      await loginUser(newUser);
      Alert.alert('Welcome!', 'Registration successful!');
      navigation.replace('MainTabs', { screen: 'Home' });
    } catch (error) {
      setError('An error occurred during registration. Please try again.');
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenLayout
      scrollable={true}
      keyboardAvoidingView={true}
      contentContainerStyle={styles.scrollContent}
      verticalPadding={false}
      horizontalPadding={false}
      navigation={navigation}
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
          <Ionicons name="school" size={48} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join us and start your learning journey</Text>
      </View>

          {/* Registration Form */}
          <View style={styles.formContainer}>
            {/* Basic Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Username</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Choose a username"
                    value={username}
                    onChangeText={setUsername}
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    value={email}
                    onChangeText={setEmail}
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>
              </View>
            </View>

            {/* Password Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Security</Text>
              
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Create a strong password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
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

              {/* Password requirements */}
              <View style={styles.requirementsContainer}>
                <Text style={styles.requirementsTitle}>Password Requirements</Text>
                {passwordRequirements.map((req, idx) => {
                  const met = req.test(password);
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

              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    placeholderTextColor={theme.colors.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            </View>

            {/* Security Question Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account Recovery</Text>
              <Text style={styles.sectionSubtitle}>Choose a security question to help recover your account</Text>
              
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Security Question</Text>
                <TouchableOpacity 
                  style={styles.questionSelector}
                  onPress={() => setShowQuestionModal(true)}
                >
                  <Ionicons name="help-circle-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                  <Text style={styles.questionText} numberOfLines={2}>
                    {securityQuestion}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
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
                  />
                </View>
              </View>
            </View>

            {/* Terms Agreement */}
            <TouchableOpacity 
              style={styles.termsContainer}
              onPress={() => setAgreeTerms(!agreeTerms)}
            >
              <Ionicons 
                name={agreeTerms ? "checkbox" : "square-outline"} 
                size={24} 
                color={agreeTerms ? theme.colors.primary : theme.colors.textSecondary} 
              />
              <Text style={styles.termsText}>
                I agree to the Terms of Service and Privacy Policy
              </Text>
            </TouchableOpacity>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={16} color="#F44336" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity 
              style={[styles.registerButton, isLoading && styles.registerButtonDisabled]} 
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <Ionicons name="hourglass-outline" size={20} color={theme.colors.background} />
                  <Text style={styles.registerButtonText}>Creating Account...</Text>
                </View>
              ) : (
                <View style={styles.buttonRow}>
                  <Ionicons name="person-add-outline" size={20} color={theme.colors.background} />
                  <Text style={styles.registerButtonText}>Create Account</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginButtonText}>Sign In</Text>
              <Ionicons name="arrow-forward-outline" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

      {/* Security Question Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showQuestionModal}
        onRequestClose={() => setShowQuestionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Security Question</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowQuestionModal(false)}
              >
                <Ionicons name="close-outline" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.questionsList} showsVerticalScrollIndicator={false}>
              {SECURITY_QUESTIONS.map((question, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.questionOption,
                    securityQuestion === question && styles.questionOptionSelected
                  ]}
                  onPress={() => {
                    setSecurityQuestion(question);
                    setShowQuestionModal(false);
                  }}
                >
                  <Text style={[
                    styles.questionOptionText,
                    securityQuestion === question && styles.questionOptionTextSelected
                  ]}>
                    {question}
                  </Text>
                  {securityQuestion === question && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
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
    marginBottom: 32,
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
  formContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
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
  pickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.background,
    paddingHorizontal: 8,
    minHeight: 56,
  },
  picker: {
    flex: 1,
    height: 56,
    color: theme.colors.text,
    marginLeft: 4,
  },
  requirementsContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  termsText: {
    fontSize: 14,
    color: theme.colors.text,
    flex: 1,
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  registerButton: {
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
  registerButtonDisabled: {
    opacity: 0.7,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.background,
  },
  footer: {
    alignItems: 'center',
    gap: 16,
  },
  footerText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
  questionSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.background,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  questionText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    padding: 20,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  questionsList: {
    width: '100%',
  },
  questionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.background,
    borderRadius: 8,
    marginBottom: 8,
  },
  questionOptionSelected: {
    backgroundColor: theme.colors.background,
  },
  questionOptionText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
  },
  questionOptionTextSelected: {
    fontWeight: 'bold',
  },
}); 