import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { layout, radius, shadow, spacing, typography } from '../theme/designSystem';

export function AppIcon({ name, size = 20, color, style, accessibilityLabel }) {
  const { theme } = useTheme();
  return (
    <Ionicons
      name={name}
      size={size}
      color={color || theme.colors.textSecondary}
      style={style}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export function IconButton({ icon, onPress, color, size = 22, disabled = false, accessibilityLabel, style }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <TouchableOpacity
      style={[styles.iconButton, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <AppIcon name={icon} size={size} color={color || theme.colors.text} />
    </TouchableOpacity>
  );
}

export function Card({ children, style, pressable = false, onPress, accessibilityLabel }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const Component = pressable || onPress ? TouchableOpacity : View;
  return (
    <Component
      style={[styles.card, style]}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Component>
  );
}

export function PrimaryButton({ label, icon, onPress, loading = false, disabled = false, style, subtitle }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.primaryButton, isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
    >
      {loading ? <ActivityIndicator color={theme.colors.primaryText} /> : icon ? (
        <AppIcon name={icon} size={19} color={theme.colors.primaryText} />
      ) : null}
      <View style={subtitle ? styles.buttonCopy : null}>
        <Text style={styles.primaryButtonText}>{label}</Text>
        {subtitle ? <Text style={styles.primaryButtonSubtitle}>{subtitle}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, icon, onPress, disabled = false, style }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <TouchableOpacity
      style={[styles.secondaryButton, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      {icon ? <AppIcon name={icon} size={19} color={theme.colors.primary} /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SectionHeader({ title, subtitle, actionLabel, onAction, style }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} accessibilityRole="button">
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function ScreenIntro({ eyebrow, title, subtitle, right, style }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={[styles.screenIntro, style]}>
      <View style={styles.introCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.screenTitle}>{title}</Text>
        {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
      </View>
      {right || null}
    </View>
  );
}

export function MetricCard({ icon, value, label, color, onPress, style }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <Card style={[styles.metricCard, style]} onPress={onPress}>
      {icon ? <AppIcon name={icon} size={19} color={color || theme.colors.primary} /> : null}
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Card>
  );
}

export function ProgressBar({ progress = 0, color, style }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
  return (
    <View style={[styles.progressTrack, style]}>
      <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: color || theme.colors.primary }]} />
    </View>
  );
}

export const ui = {
  screen: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
};

const getStyles = (theme) => StyleSheet.create({
  iconButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  buttonCopy: { flex: 1 },
  primaryButtonText: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.bodySmall,
    color: theme.colors.primaryText,
    textAlign: 'center',
  },
  primaryButtonSubtitle: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.76)',
    marginTop: 2,
    textAlign: 'center',
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: theme.colors.surface,
  },
  secondaryButtonText: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.bodySmall,
    color: theme.colors.primary,
  },
  disabled: { opacity: 0.5 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionCopy: { flex: 1 },
  sectionTitle: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.titleSmall,
    lineHeight: typography.lineHeights.titleSmall,
    color: theme.colors.text,
  },
  sectionSubtitle: {
    fontFamily: typography.regular,
    fontSize: typography.sizes.caption,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  sectionAction: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.primary,
    paddingVertical: spacing.xs,
  },
  screenIntro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  introCopy: { flex: 1 },
  eyebrow: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.caption,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xxs,
  },
  screenTitle: {
    fontFamily: typography.bold,
    fontSize: typography.sizes.display,
    lineHeight: typography.lineHeights.display,
    color: theme.colors.text,
  },
  screenSubtitle: {
    fontFamily: typography.regular,
    fontSize: typography.sizes.bodySmall,
    lineHeight: typography.lineHeights.bodySmall,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  metricCard: {
    flex: 1,
    minHeight: 108,
  },
  metricValue: {
    fontFamily: typography.bold,
    fontSize: typography.sizes.title,
    color: theme.colors.text,
    marginTop: spacing.sm,
  },
  metricLabel: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  progressTrack: {
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
