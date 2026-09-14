import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { readJson } from '../../storage/fileStorage';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import {
  AuthError,
  AuthField,
  AuthScaffold,
  PrimaryButton,
} from '../../components/AuthScaffold';
import { radius, spacing, typography } from '../../theme/designSystem';

export default function LoginScreen({ navigation }) {
  const { theme } = useTheme();
  const { loginUser } = useUser();
  const styles = getStyles(theme);
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    const trimmedIdentity = identity.trim();
    setError('');

    if (!trimmedIdentity || !password) {
      setError('Enter your email or username and your password.');
      return;
    }

    setIsLoading(true);
    try {
      const users = (await readJson('users.json')) || [];
      const normalizedIdentity = trimmedIdentity.toLowerCase();
      const existingUser = users.find((user) => {
        const candidates = [user.email, user.username, user.name]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        return candidates.includes(normalizedIdentity);
      });

      if (!existingUser) {
        setError('We could not find an account with that email or username.');
        return;
      }

      if (existingUser.password !== password) {
        setError('That password does not match this account.');
        return;
      }

      await loginUser(existingUser);
      navigation.replace('MainTabs');
    } catch (loginError) {
      console.error('Login error:', loginError);
      setError('Sign in failed. Check the account and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthScaffold
      navigation={navigation}
      icon="sparkles-outline"
      title="Welcome back"
      subtitle="Pick up where you left off and keep today’s study work moving."
      footer={(
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New here?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')} accessibilityRole="button">
            <Text style={styles.footerLink}>Create an account</Text>
          </TouchableOpacity>
        </View>
      )}
    >
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Sign in</Text>
        <Text style={styles.sectionSubtitle}>Use the account stored on this device.</Text>
      </View>

      <AuthField
        label="Email or username"
        icon="person-outline"
        value={identity}
        onChangeText={setIdentity}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
        returnKeyType="next"
        editable={!isLoading}
      />

      <AuthField
        label="Password"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        placeholder="Enter your password"
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={handleLogin}
        editable={!isLoading}
        right={(
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowPassword((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      />

      <View style={styles.metaRow}>
        <View style={styles.localBadge}>
          <Ionicons name="phone-portrait-outline" size={15} color={theme.colors.accent} />
          <Text style={styles.localBadgeText}>Local account</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} accessibilityRole="button">
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>
      </View>

      <AuthError message={error} />

      <PrimaryButton
        label="Continue"
        icon="arrow-forward-outline"
        onPress={handleLogin}
        loading={isLoading}
      />
    </AuthScaffold>
  );
}

const getStyles = (theme) => StyleSheet.create({
  sectionHeading: {
    marginBottom: spacing.xl,
  },
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
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -spacing.xs,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  localBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: theme.colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  localBadgeText: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.caption,
    color: theme.colors.accent,
  },
  forgotText: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.bodySmall,
    color: theme.colors.primary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
});
