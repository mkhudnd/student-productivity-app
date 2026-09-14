import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { readJson, writeJson } from '../../storage/fileStorage';
import { useTheme } from '../../context/ThemeContext';
import {
  AuthError,
  AuthField,
  AuthScaffold,
  PasswordRequirements,
  PrimaryButton,
} from '../../components/AuthScaffold';
import { radius, spacing, typography } from '../../theme/designSystem';

const PASSWORD_REQUIREMENTS = [
  { label: '8+ characters', test: (value) => value.length >= 8 },
  { label: 'Uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'Lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'Number', test: (value) => /[0-9]/.test(value) },
  { label: 'Special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

const STEP_META = {
  1: {
    icon: 'mail-outline',
    title: 'Find your account',
    subtitle: 'Enter the email address attached to this local account.',
  },
  2: {
    icon: 'shield-checkmark-outline',
    title: 'Verify recovery answer',
    subtitle: 'Answer the recovery question you chose when the account was created.',
  },
  3: {
    icon: 'key-outline',
    title: 'Choose a new password',
    subtitle: 'Create a fresh password that meets all requirements.',
  },
};

export default function ForgotPasswordScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const stepMeta = STEP_META[step];
  const progress = useMemo(() => `${Math.round((step / 3) * 100)}%`, [step]);

  const verifyEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const users = (await readJson('users.json')) || [];
      const user = users.find(
        (candidate) => String(candidate.email || '').trim().toLowerCase() === normalizedEmail,
      );

      if (!user) {
        setError('No local account uses this email address.');
        return;
      }

      if (!user.securityQuestion || !user.securityAnswer) {
        setError('This account does not have recovery information set up.');
        return;
      }

      setFoundUser(user);
      setEmail(normalizedEmail);
      setStep(2);
    } catch (verificationError) {
      console.error('Recovery account lookup failed:', verificationError);
      setError('Could not read the account data. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyAnswer = () => {
    setError('');
    if (!securityAnswer.trim()) {
      setError('Enter your recovery answer.');
      return;
    }

    const expected = String(foundUser?.securityAnswer || '').trim().toLowerCase();
    const provided = securityAnswer.trim().toLowerCase();

    if (expected !== provided) {
      setError('That answer does not match this account.');
      return;
    }

    setStep(3);
  };

  const resetPassword = async () => {
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Enter and confirm your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    if (PASSWORD_REQUIREMENTS.some((requirement) => !requirement.test(newPassword))) {
      setError('Your password still misses one or more requirements.');
      return;
    }

    setLoading(true);
    try {
      const users = (await readJson('users.json')) || [];
      const userIndex = users.findIndex(
        (candidate) => String(candidate.email || '').trim().toLowerCase() === email,
      );

      if (userIndex === -1) {
        setError('The account could not be found anymore. Start again.');
        return;
      }

      users[userIndex] = {
        ...users[userIndex],
        password: newPassword,
        lastPasswordReset: new Date().toISOString(),
      };
      await writeJson('users.json', users);
      navigation.replace('Login');
    } catch (resetError) {
      console.error('Password reset failed:', resetError);
      setError('Could not update the password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const goBackStep = () => {
    setError('');
    if (step === 1) {
      navigation.goBack();
      return;
    }
    setStep((value) => Math.max(1, value - 1));
  };

  return (
    <AuthScaffold
      navigation={navigation}
      showBack
      icon="lock-open-outline"
      title="Recover access"
      subtitle="Reset a password using the recovery details stored with this local account."
      footer={(
        <TouchableOpacity onPress={() => navigation.navigate('Login')} accessibilityRole="button">
          <Text style={styles.footerLink}>Return to sign in</Text>
        </TouchableOpacity>
      )}
    >
      <View style={styles.progressHeader}>
        <View>
          <Text style={styles.stepCount}>Step {step} of 3</Text>
          <Text style={styles.stepTitle}>{stepMeta.title}</Text>
        </View>
        <View style={styles.stepIcon}>
          <Ionicons name={stepMeta.icon} size={20} color={theme.colors.primary} />
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progress }]} />
      </View>
      <Text style={styles.stepSubtitle}>{stepMeta.subtitle}</Text>

      {step === 1 ? (
        <AuthField
          label="Email address"
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={verifyEmail}
          editable={!loading}
        />
      ) : null}

      {step === 2 ? (
        <>
          <View style={styles.questionCard}>
            <Text style={styles.questionLabel}>Recovery question</Text>
            <Text style={styles.questionText}>{foundUser?.securityQuestion}</Text>
          </View>
          <AuthField
            label="Your answer"
            icon="chatbubble-ellipses-outline"
            value={securityAnswer}
            onChangeText={setSecurityAnswer}
            placeholder="Enter your answer"
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={verifyAnswer}
          />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <AuthField
            label="New password"
            icon="lock-closed-outline"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Create a strong password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            right={(
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowPassword((value) => !value)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          />
          {newPassword.length > 0 ? (
            <PasswordRequirements password={newPassword} requirements={PASSWORD_REQUIREMENTS} />
          ) : null}
          <AuthField
            label="Confirm password"
            icon="checkmark-circle-outline"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat your new password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
        </>
      ) : null}

      <AuthError message={error} />

      <PrimaryButton
        label={step === 1 ? 'Find account' : step === 2 ? 'Verify answer' : 'Update password'}
        icon={step === 3 ? 'checkmark-outline' : 'arrow-forward-outline'}
        onPress={step === 1 ? verifyEmail : step === 2 ? verifyAnswer : resetPassword}
        loading={loading}
      />

      {step > 1 ? (
        <TouchableOpacity style={styles.backStepButton} onPress={goBackStep} disabled={loading}>
          <Ionicons name="arrow-back-outline" size={17} color={theme.colors.textSecondary} />
          <Text style={styles.backStepText}>Previous step</Text>
        </TouchableOpacity>
      ) : null}
    </AuthScaffold>
  );
}

const getStyles = (theme) => StyleSheet.create({
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stepCount: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.caption,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stepTitle: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.titleSmall,
    color: theme.colors.text,
    marginTop: spacing.xxs,
  },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: theme.colors.primary,
  },
  stepSubtitle: {
    fontFamily: typography.regular,
    fontSize: typography.sizes.bodySmall,
    lineHeight: typography.lineHeights.bodySmall,
    color: theme.colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  questionCard: {
    borderRadius: radius.md,
    backgroundColor: theme.colors.primarySoft,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  questionLabel: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.caption,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  questionText: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: theme.colors.text,
    marginTop: spacing.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backStepButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  backStepText: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.bodySmall,
    color: theme.colors.textSecondary,
  },
  footerLink: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.bodySmall,
    color: theme.colors.primary,
  },
});
