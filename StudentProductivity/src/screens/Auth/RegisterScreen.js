import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { readJson, writeJson } from '../../storage/fileStorage';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import {
  AuthError,
  AuthField,
  AuthScaffold,
  PasswordRequirements,
  PrimaryButton,
} from '../../components/AuthScaffold';
import { AppIcon, IconButton } from '../../components/ui';
import { layout, radius, spacing, typography } from '../../theme/designSystem';

const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What city were you born in?',
  "What is your mother's maiden name?",
  'What was the name of your elementary school?',
  'What is your favorite book?',
  'What was your childhood nickname?',
  'What is the name of your favorite teacher?',
  'What street did you live on in third grade?',
];

const PASSWORD_REQUIREMENTS = [
  { label: '8+ characters', test: (value) => value.length >= 8 },
  { label: 'Uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'Lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'Number', test: (value) => /[0-9]/.test(value) },
  { label: 'Special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export default function RegisterScreen({ navigation }) {
  const { theme } = useTheme();
  const { loginUser } = useUser();
  const styles = getStyles(theme);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedAnswer = securityAnswer.trim();
    setError('');

    if (!normalizedUsername || !normalizedEmail || !password || !confirmPassword || !normalizedAnswer) {
      setError('Complete every field before creating the account.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (normalizedUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    if (PASSWORD_REQUIREMENTS.some((requirement) => !requirement.test(password))) {
      setError('Your password still misses one or more requirements.');
      return;
    }
    if (normalizedAnswer.length < 3) {
      setError('Security answer must be at least 3 characters.');
      return;
    }
    if (!agreeTerms) {
      setError('Accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setIsLoading(true);
    try {
      const users = (await readJson('users.json')) || [];
      const duplicateEmail = users.some((user) => String(user.email || '').trim().toLowerCase() === normalizedEmail);
      const duplicateUsername = users.some((user) => String(user.username || user.name || '').trim().toLowerCase() === normalizedUsername.toLowerCase());

      if (duplicateEmail) {
        setError('An account already uses this email address.');
        return;
      }
      if (duplicateUsername) {
        setError('That username is already in use.');
        return;
      }

      const newUser = {
        username: normalizedUsername,
        email: normalizedEmail,
        password,
        securityQuestion,
        securityAnswer: normalizedAnswer,
        createdAt: new Date().toISOString(),
      };

      users.push(newUser);
      await writeJson('users.json', users);
      await loginUser(newUser);
      navigation.replace('MainTabs');
    } catch (registerError) {
      console.error('Registration error:', registerError);
      setError('Account creation failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthScaffold
        navigation={navigation}
        showBack
        icon="person-add-outline"
        title="Create your account"
        subtitle="Set up a local study workspace that keeps your plans, sessions and learning tools together."
        footer={(
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} accessibilityRole="button">
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        )}
      >
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Account details</Text>
          <Text style={styles.sectionSubtitle}>You can change your profile details later.</Text>
        </View>

        <AuthField label="Username" icon="person-outline" value={username} onChangeText={setUsername} placeholder="Choose a username" autoCapitalize="none" autoCorrect={false} editable={!isLoading} />
        <AuthField label="Email" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!isLoading} />

        <View style={styles.divider} />
        <Text style={styles.groupLabel}>Secure the account</Text>

        <AuthField
          label="Password"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          placeholder="Create a strong password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          right={(
            <IconButton
              icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              onPress={() => setShowPassword((value) => !value)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            />
          )}
        />

        {password.length > 0 ? <PasswordRequirements password={password} requirements={PASSWORD_REQUIREMENTS} /> : null}

        <AuthField label="Confirm password" icon="checkmark-circle-outline" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat your password" secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} editable={!isLoading} />

        <TouchableOpacity style={styles.selector} onPress={() => setShowQuestionModal(true)} disabled={isLoading} accessibilityRole="button">
          <AppIcon name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
          <View style={styles.selectorCopy}>
            <Text style={styles.selectorLabel}>Recovery question</Text>
            <Text style={styles.selectorValue}>{securityQuestion}</Text>
          </View>
          <AppIcon name="chevron-forward" size={19} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <AuthField
          label="Recovery answer"
          icon="chatbubble-ellipses-outline"
          value={securityAnswer}
          onChangeText={setSecurityAnswer}
          placeholder="Enter an answer you will remember"
          autoCapitalize="sentences"
          editable={!isLoading}
          helper="This prototype stores recovery information locally on the device."
        />

        <TouchableOpacity style={styles.termsRow} onPress={() => setAgreeTerms((value) => !value)} disabled={isLoading} accessibilityRole="checkbox" accessibilityState={{ checked: agreeTerms }}>
          <AppIcon name={agreeTerms ? 'checkbox' : 'square-outline'} size={23} color={agreeTerms ? theme.colors.primary : theme.colors.textMuted} />
          <Text style={styles.termsText}>I agree to the Terms of Service and Privacy Policy.</Text>
        </TouchableOpacity>

        <AuthError message={error} />
        <PrimaryButton label="Create account" icon="arrow-forward-outline" onPress={handleRegister} loading={isLoading} />
      </AuthScaffold>

      <Modal visible={showQuestionModal} transparent animationType="fade" onRequestClose={() => setShowQuestionModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>Recovery question</Text>
                <Text style={styles.modalSubtitle}>Choose one you can answer later.</Text>
              </View>
              <IconButton icon="close" onPress={() => setShowQuestionModal(false)} accessibilityLabel="Close" />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {SECURITY_QUESTIONS.map((question) => {
                const selected = question === securityQuestion;
                return (
                  <TouchableOpacity
                    key={question}
                    style={[styles.questionRow, selected && styles.questionRowSelected]}
                    onPress={() => {
                      setSecurityQuestion(question);
                      setShowQuestionModal(false);
                    }}
                  >
                    <Text style={[styles.questionText, selected && styles.questionTextSelected]}>{question}</Text>
                    {selected ? <AppIcon name="checkmark" size={18} color={theme.colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const getStyles = (theme) => StyleSheet.create({
  sectionHeading: { marginBottom: spacing.xl },
  sectionTitle: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.title,
    lineHeight: typography.lineHeights.title,
    color: theme.colors.text,
  },
  sectionSubtitle: {
    fontFamily: typography.regular,
    fontSize: typography.sizes.bodySmall,
    lineHeight: typography.lineHeights.bodySmall,
    color: theme.colors.textSecondary,
    marginTop: spacing.xxs,
  },
  groupLabel: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.titleSmall,
    color: theme.colors.text,
    marginBottom: spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator,
    marginVertical: spacing.xs,
    marginBottom: spacing.xl,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.input,
    marginBottom: spacing.lg,
  },
  selectorCopy: { flex: 1 },
  selectorLabel: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.caption,
    color: theme.colors.textSecondary,
  },
  selectorValue: {
    fontFamily: typography.regular,
    fontSize: typography.sizes.bodySmall,
    lineHeight: typography.lineHeights.bodySmall,
    color: theme.colors.text,
    marginTop: 2,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  termsText: {
    flex: 1,
    fontFamily: typography.regular,
    fontSize: typography.sizes.bodySmall,
    lineHeight: typography.lineHeights.bodySmall,
    color: theme.colors.textSecondary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  footerText: {
    fontFamily: typography.regular,
    fontSize: typography.sizes.bodySmall,
    color: theme.colors.textSecondary,
  },
  footerLink: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.bodySmall,
    color: theme.colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  modalCard: {
    maxHeight: '76%',
    backgroundColor: theme.colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  modalHeaderCopy: { flex: 1 },
  modalTitle: {
    fontFamily: typography.bold,
    fontSize: 20,
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  questionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.separator,
  },
  questionRowSelected: {
    borderColor: theme.colors.primary,
  },
  questionText: {
    flex: 1,
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.text,
  },
  questionTextSelected: {
    fontFamily: typography.semibold,
    color: theme.colors.primary,
  },
});
