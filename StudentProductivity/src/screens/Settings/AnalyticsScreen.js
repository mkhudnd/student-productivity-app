import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenLayout from '../../components/ScreenLayout';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { loadProgressWorkspace } from '../../utils/progressRepository';
import { radius, shadow, spacing, typography } from '../../theme/designSystem';

const RANGES = [7, 30, 90];

function formatMinutes(minutes) {
  const value = Math.max(0, Number(minutes || 0));
  if (value < 60) return `${value}m`;
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export default function AnalyticsScreen({ navigation }) {
  const { theme } = useTheme();
  const { currentUser } = useUser();
  const styles = getStyles(theme);
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProgress(await loadProgressWorkspace(currentUser, range));
    } catch (error) {
      console.error('Unable to load Progress workspace:', error);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.email, range]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const maxDailyMinutes = useMemo(() => {
    if (!progress?.recentDays?.length) return 1;
    return Math.max(1, ...progress.recentDays.map((day) => day.minutes));
  }, [progress]);

  if (loading) {
    return (
      <ScreenLayout>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Preparing Progress…</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      scrollable
      horizontalPadding={false}
      verticalPadding={false}
      contentContainerStyle={styles.content}
      navigation={navigation}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>PROGRESS</Text>
          <Text style={styles.title}>See the work add up</Text>
          <Text style={styles.subtitle}>Study time, consistency, plan completion and learning progress in one place.</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={load} accessibilityLabel="Refresh progress">
          <Ionicons name="refresh" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.rangeRow}>
        {RANGES.map((days) => {
          const active = range === days;
          return (
            <TouchableOpacity
              key={days}
              style={[styles.rangeChip, active && styles.rangeChipActive]}
              onPress={() => setRange(days)}
            >
              <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{days} days</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!progress ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="stats-chart-outline" size={26} color={theme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No progress data yet</Text>
          <Text style={styles.emptyText}>Complete a focus session or mark planned work done and your progress will appear here.</Text>
        </View>
      ) : (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroIcon}>
                <Ionicons name="timer-outline" size={23} color={theme.colors.primary} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>STUDY TIME</Text>
                <Text style={styles.heroValue}>{formatMinutes(progress.totalStudyMinutes)}</Text>
                <Text style={styles.heroHint}>Across {progress.sessionCount} completed focus session{progress.sessionCount === 1 ? '' : 's'} in the selected period.</Text>
              </View>
            </View>

            <View style={styles.heroMetrics}>
              <HeroMetric value={progress.activeDays} label="Active days" styles={styles} />
              <HeroMetric value={`${progress.streak}d`} label="Current streak" styles={styles} />
              <HeroMetric value={`${progress.averageSessionMinutes}m`} label="Avg session" styles={styles} />
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Recent study rhythm</Text>
              <Text style={styles.sectionSubtitle}>Your last seven calendar days.</Text>
            </View>
          </View>

          <View style={styles.chartCard}>
            <View style={styles.chartArea}>
              {progress.recentDays.map((day) => {
                const ratio = day.minutes / maxDailyMinutes;
                const height = day.minutes > 0 ? Math.max(14, Math.round(112 * ratio)) : 8;
                return (
                  <View key={day.key} style={styles.barColumn}>
                    <Text style={styles.barValue}>{day.minutes || ''}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height }]} />
                    </View>
                    <Text style={styles.barLabel}>{day.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.metricGrid}>
            <MetricCard
              icon="checkmark-circle-outline"
              label="Plan completion"
              value={`${progress.tasks.completionRate}%`}
              hint={`${progress.tasks.completed} of ${progress.tasks.total} tasks completed`}
              tint={theme.colors.accentSoft}
              iconColor={theme.colors.accent}
              styles={styles}
            />
            <MetricCard
              icon="layers-outline"
              label="Flashcard mastery"
              value={`${progress.learn.masteryRate}%`}
              hint={`${progress.learn.mastered} of ${progress.learn.cards} cards mastered`}
              tint={theme.colors.primarySoft}
              iconColor={theme.colors.primary}
              styles={styles}
            />
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>By subject</Text>
              <Text style={styles.sectionSubtitle}>Where your study time has gone.</Text>
            </View>
          </View>

          {progress.subjectBreakdown.length === 0 ? (
            <View style={styles.subjectEmptyCard}>
              <Text style={styles.subjectEmptyTitle}>No subject history in this period</Text>
              <Text style={styles.subjectEmptyText}>Study a subject in Focus to build a useful breakdown here.</Text>
            </View>
          ) : (
            <View style={styles.subjectCard}>
              {progress.subjectBreakdown.map((subject, index) => {
                const ratio = progress.totalStudyMinutes > 0
                  ? Math.min(1, subject.minutes / progress.totalStudyMinutes)
                  : 0;
                return (
                  <View
                    key={subject.name}
                    style={[styles.subjectRow, index < progress.subjectBreakdown.length - 1 && styles.subjectDivider]}
                  >
                    <View style={styles.subjectTopRow}>
                      <View style={styles.subjectIcon}>
                        <Ionicons name="book-outline" size={17} color={theme.colors.primary} />
                      </View>
                      <View style={styles.subjectCopy}>
                        <Text style={styles.subjectName}>{subject.name}</Text>
                        <Text style={styles.subjectMinutes}>{formatMinutes(subject.minutes)}</Text>
                      </View>
                      <Text style={styles.subjectPercent}>{Math.round(ratio * 100)}%</Text>
                    </View>
                    <View style={styles.subjectTrack}>
                      <View style={[styles.subjectFill, { width: `${Math.round(ratio * 100)}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Learning system</Text>
              <Text style={styles.sectionSubtitle}>A quick view beyond timer minutes.</Text>
            </View>
          </View>

          <View style={styles.systemCard}>
            <SystemRow
              icon="calendar-outline"
              title="Plan"
              value={`${progress.tasks.completed}/${progress.tasks.total}`}
              hint="completed tasks"
              theme={theme}
              styles={styles}
              onPress={() => navigation.navigate('Planner')}
            />
            <SystemRow
              icon="timer-outline"
              title="Focus"
              value={formatMinutes(progress.totalStudyMinutes)}
              hint={`${progress.sessionCount} sessions`}
              theme={theme}
              styles={styles}
              onPress={() => navigation.navigate('Tracker')}
            />
            <SystemRow
              icon="layers-outline"
              title="Learn"
              value={`${progress.learn.decks}`}
              hint={`${progress.learn.cards} cards across decks`}
              theme={theme}
              styles={styles}
              onPress={() => navigation.navigate('Flashcards')}
              last
            />
          </View>
        </>
      )}
    </ScreenLayout>
  );
}

function HeroMetric({ value, label, styles }) {
  return (
    <View style={styles.heroMetric}>
      <Text style={styles.heroMetricValue}>{value}</Text>
      <Text style={styles.heroMetricLabel}>{label}</Text>
    </View>
  );
}

function MetricCard({ icon, label, value, hint, tint, iconColor, styles }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </View>
  );
}

function SystemRow({ icon, title, value, hint, theme, styles, onPress, last }) {
  return (
    <TouchableOpacity style={[styles.systemRow, !last && styles.systemDivider]} onPress={onPress}>
      <View style={styles.systemIcon}>
        <Ionicons name={icon} size={19} color={theme.colors.primary} />
      </View>
      <View style={styles.systemCopy}>
        <Text style={styles.systemTitle}>{title}</Text>
        <Text style={styles.systemHint}>{hint}</Text>
      </View>
      <Text style={styles.systemValue}>{value}</Text>
      <Ionicons name="chevron-forward" size={17} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

const getStyles = (theme) => StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.primary,
    letterSpacing: 1.1,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.bold,
    fontSize: 30,
    lineHeight: 38,
    color: theme.colors.text,
  },
  subtitle: {
    fontFamily: typography.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  refreshButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  rangeChip: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  rangeChipActive: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  rangeText: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  rangeTextActive: { color: theme.colors.textInverse },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 30,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  emptyTitle: {
    fontFamily: typography.semibold,
    fontSize: 17,
    color: theme.colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  heroCard: {
    borderRadius: 26,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  heroCopy: { flex: 1 },
  heroEyebrow: {
    fontFamily: typography.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: theme.colors.primary,
  },
  heroValue: {
    fontFamily: typography.bold,
    fontSize: 30,
    lineHeight: 36,
    color: theme.colors.text,
    marginTop: 2,
  },
  heroHint: {
    fontFamily: typography.regular,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroMetric: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceMuted,
    padding: spacing.sm,
  },
  heroMetricValue: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: theme.colors.text,
  },
  heroMetricLabel: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  sectionHeader: {
    marginTop: 28,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.semibold,
    fontSize: 18,
    color: theme.colors.text,
  },
  sectionSubtitle: {
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  chartCard: {
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: spacing.md,
  },
  chartArea: {
    height: 166,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barValue: {
    minHeight: 16,
    fontFamily: typography.semibold,
    fontSize: 9,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  barTrack: {
    width: '72%',
    height: 112,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  barLabel: {
    fontFamily: typography.semibold,
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 28,
  },
  metricCard: {
    flex: 1,
    minHeight: 174,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: spacing.md,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: spacing.md,
  },
  metricValue: {
    fontFamily: typography.bold,
    fontSize: 26,
    color: theme.colors.text,
    marginTop: 2,
  },
  metricHint: {
    fontFamily: typography.regular,
    fontSize: 10,
    lineHeight: 15,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  subjectEmptyCard: {
    borderRadius: 20,
    padding: spacing.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subjectEmptyTitle: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
  },
  subjectEmptyText: {
    fontFamily: typography.regular,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  subjectCard: {
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  subjectRow: {
    padding: spacing.md,
  },
  subjectDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
  },
  subjectTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subjectIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  subjectCopy: { flex: 1 },
  subjectName: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
  },
  subjectMinutes: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  subjectPercent: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  subjectTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  subjectFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: theme.colors.primary,
  },
  systemCard: {
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  systemRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  systemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
  },
  systemIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  systemCopy: { flex: 1 },
  systemTitle: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
  },
  systemHint: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  systemValue: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
  },
});
