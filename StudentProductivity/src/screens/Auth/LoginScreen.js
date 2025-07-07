import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { readJson } from '../../storage/fileStorage';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import ScreenLayout from '../../components/ScreenLayout';

const { width } = Dimensions.get('window');

// LoginScreen allows users to log in with email and password stored in users.json
export default function LoginScreen({ navigation }) {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { loginUser } = useUser();
  const styles = getStyles(theme);

  // Handle login button press
  const handleLogin = async () => {
    setError('');
    setIsLoading(true); 
    
    // Trim whitespace from input
    const trimmedName = name.trim();
    const trimmedPassword = password.trim();
    
    if (!trimmedName || !trimmedPassword) {
      setError('Please enter both email/username and password.');
      setIsLoading(false);
      return;
    }
    
    try {
      // Read users from users.json with retry logic for file system consistency
      let users = [];
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount < maxRetries) {
        try {
          users = (await readJson('users.json')) || [];
          break; // Success, exit retry loop
        } catch (error) {
          retryCount++;
          if (retryCount < maxRetries) {
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            throw error; // Re-throw if all retries failed
          }
        }
      }
      
      // First, check if a user with this email/username exists
      const existingUser = users.find(u => u.name === trimmedName || u.email === trimmedName || u.username === trimmedName);
      
      if (!existingUser) {
        // User doesn't exist (could be deleted or never existed)
        setError('User does not exist. Please check your email/username or create an account.');
      } else if (existingUser.password !== trimmedPassword) {
        // User exists but password is wrong
        setError('Incorrect password. Please try again.');
      } else {
        // Double-check that user still exists in the latest data (protection against race conditions)
        const latestUsers = (await readJson('users.json')) || [];
        const latestExistingUser = latestUsers.find(u => u.email === existingUser.email);
        
        if (!latestExistingUser) {
          setError('This account has been deleted and can no longer be used to log in.');
          return;
        }
        
        // User exists and password is correct
        await loginUser(existingUser);
        Alert.alert('Welcome!', 'Login successful!');
        navigation.replace('MainTabs', { screen: 'Home' });
      }
    } catch (error) {
      setError('An error occurred during login. Please try again.');
      console.error('Login error:', error);
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
            <View style={styles.logoContainer}>
              <Ionicons name="school" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>Sign in to continue your learning journey</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Email or Username</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email or username"
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
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

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={16} color="#F44336" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity 
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} 
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <Ionicons name="hourglass-outline" size={20} color={theme.colors.background} />
                  <Text style={styles.loginButtonText}>Signing in...</Text>
                </View>
              ) : (
                <View style={styles.buttonRow}>
                  <Ionicons name="log-in-outline" size={20} color={theme.colors.background} />
                  <Text style={styles.loginButtonText}>Sign In</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.linkText}>Forgot your password?</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity 
              style={styles.registerButton}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.registerButtonText}>Create Account</Text>
              <Ionicons name="arrow-forward-outline" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
    </ScreenLayout>
  );
}

const getStyles = (theme) => StyleSheet.create({
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: 'center',
    padding: 24,
    minHeight: Dimensions.get('window').height - 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
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
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
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
  inputSection: {
    marginBottom: 20,
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
  loginButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
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
  loginButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.background,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
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
  registerButton: {
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
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
}); 