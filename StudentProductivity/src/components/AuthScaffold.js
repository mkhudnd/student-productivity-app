import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from './ScreenLayout';
import { useTheme } from '../context/ThemeContext';
import { layout, radius, shadow, spacing, typography } from '../theme/designSystem';

export function AuthScaffold({
  navigation,
  icon = 'school-outline',
  eyebrow = 'Student Productivity',
  title,
  subtitle,
  showBack = false,
  children,
  footer,
}) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <ScreenLayout
      scrollable
      keyboardAvoidingView
      verticalPadding={false}
      horizontalPadding={false}
      contentContainerStyle={styles.screenContent}
      navigation={navigation}
    >
      <View style={styles.hero}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.brandIcon}>
          <Ionicons name={icon} size={28} color={theme.colors.primary} />
        </View>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <View style={styles.card}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </ScreenLayout>
  );
}

export function AuthField({
  label,
  icon,
  value,
  onChangeText,
  right,
  helper,
  ...inputProps
}) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.fieldGroup}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.fieldShell}>
        {icon ? <Ionicons name={icon} size={19} color={theme.colors.textMuted} /> : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={theme.colors.placeholder}
          selectionColor={theme.colors.primary}
          {...inputProps}
        />
        {right}
      </View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

export function AuthError({ message }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  if (!message) return null;

  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle-outline" size={18} color={theme.colors.error} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function PrimaryButton({ label, icon, onPress, loading = false, disabled = false }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.primaryButton, isDisabled && styles.disabledButton]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.primaryText} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={19} color={theme.colors.primaryText} /> : null}
          <Text style={styles.primaryButtonText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function PasswordRequirements({ password, requirements }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.requirementsBox}>
      {requirements.map((requirement) => {
        const met = requirement.test(password);
        return (
          <View key={requirement.label} style={styles.requirementRow}>
            <Ionicons
              name={met ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={met ? theme.colors.success : theme.colors.textMuted}
            />
            <Text style={[styles.requirementText, met && { color: theme.colors.success }]}>
              {requirement.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: spacing.md,
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  brandIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    marginBottom: spacing.md,
  },
  eyebrow: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.bold,
    fontSize: typography.sizes.display,
    lineHeight: typography.lineHeights.display,
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.regular,
    fontSize: typography.sizes.bodySmall,
    lineHeight: typography.lineHeights.bodySmall,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 340,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: spacing.xl,
    ...shadow.card,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.bodySmall,
    lineHeight: typography.lineHeights.bodySmall,
    color: theme.colors.text,
    marginBottom: spacing.xs,
  },
  fieldShell: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.input,
  },
  input: {
    flex: 1,
    minHeight: 52,
    fontFamily: typography.regular,
    fontSize: typography.sizes.body,
    color: theme.colors.inputText,
    paddingVertical: spacing.sm,
  },
  helper: {
    fontFamily: typography.regular,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: theme.colors.textMuted,
    marginTop: spacing.xs,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: `${theme.colors.error}12`,
    marginBottom: spacing.lg,
  },
  errorText: {
    flex: 1,
    fontFamily: typography.regular,
    fontSize: typography.sizes.bodySmall,
    lineHeight: typography.lineHeights.bodySmall,
    color: theme.colors.error,
  },
  primaryButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: spacing.lg,
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.body,
    color: theme.colors.primaryText,
  },
  requirementsBox: {
    borderRadius: radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.xs,
    marginTop: -spacing.xs,
    marginBottom: spacing.lg,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  requirementText: {
    flex: 1,
    fontFamily: typography.regular,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: theme.colors.textSecondary,
  },
});
