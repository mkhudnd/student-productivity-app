import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenLayout from './ScreenLayout';
import { useTheme } from '../context/ThemeContext';
import { layout, radius, spacing, typography } from '../theme/designSystem';
import { AppIcon, Card, IconButton, PrimaryButton as DSPrimaryButton } from './ui';

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
          <IconButton
            icon="chevron-back"
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
            accessibilityLabel="Go back"
          />
        ) : null}

        <AppIcon name={icon} size={30} color={theme.colors.primary} />
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <Card style={styles.card}>{children}</Card>
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
        {icon ? <AppIcon name={icon} size={19} color={theme.colors.textMuted} /> : null}
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
      <AppIcon name="alert-circle-outline" size={18} color={theme.colors.error} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function PrimaryButton(props) {
  return <DSPrimaryButton {...props} />;
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
            <AppIcon
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
    gap: spacing.xs,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: spacing.md,
  },
  eyebrow: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: spacing.xs,
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
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
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
    borderWidth: 1,
    borderColor: `${theme.colors.error}28`,
    marginBottom: spacing.lg,
  },
  errorText: {
    flex: 1,
    fontFamily: typography.regular,
    fontSize: typography.sizes.bodySmall,
    lineHeight: typography.lineHeights.bodySmall,
    color: theme.colors.error,
  },
  requirementsBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
