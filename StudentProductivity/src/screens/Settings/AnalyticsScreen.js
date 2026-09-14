import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenLayout from '../../components/ScreenLayout';
import {
  AppIcon,
  Card,
  IconButton,
  MetricCard,
  ProgressBar,
  ScreenIntro,
  SectionHeader,
} from '../../components/ui';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { loadProgressWorkspace } from '../../utils/progressRepository';
import { layout, radius, spacing, typography } from '../../theme/designSystem';

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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const maxDailyMinutes = useMemo(() => {
    if (!progress?.recentDays?.length) return 1;
    return Math.max(1, ...progress.recentDays.map((day) => day.minutes));
  }, [progress]);

  if (loading) {
    return <ScreenLayout><View style={styles.loadingState}><ActivityIndicator size="large" color={theme.colors.primary} /><Text style={styles.loadingText}>Preparing Progress…</Text></View></ScreenLayout>;
  }

  return (
    <ScreenLayout scrollable horizontalPadding={false} verticalPadding={false} contentContainerStyle={styles.content} navigation={navigation}>
      <ScreenIntro
        eyebrow="Progress"
        title="See the work add up"
        subtitle="Study time, consistency, plan completion and learning progress in one place."
        right={<IconButton icon="refresh" onPress={load} accessibilityLabel="Refresh progress" />}
      />

      <View style={styles.rangeRow}>
        {RANGES.map((days) => {
          const active = range === days;
          return <TouchableOpacity key={days} style={[styles.rangeChip, active && styles.rangeChipActive]} onPress={() => setRange(days)}><Text style={[styles.rangeText, active && styles.rangeTextActive]}>{days} days</Text></TouchableOpacity>;
        })}
      </View>

      {!progress ? (
        <Card style={styles.emptyCard}>
          <AppIcon name="stats-chart-outline" size={28} color={theme.colors.primary} />
          <Text style={styles.emptyTitle}>No progress data yet</Text>
          <Text style={styles.emptyText}>Complete a focus session or mark planned work done and your progress will appear here.</Text>
        </Card>
      ) : (
        <>
          <Card style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <AppIcon name="timer-outline" size={24} color={theme.colors.primary} />
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
          </Card>

          <SectionHeader title="Recent study rhythm" subtitle="Your last seven calendar days." style={styles.sectionSpace} />
          <Card style={styles.chartCard}>
            <View style={styles.chartArea}>
              {progress.recentDays.map((day) => {
                const ratio = day.minutes / maxDailyMinutes;
                const height = day.minutes > 0 ? Math.max(14, Math.round(112 * ratio)) : 8;
                return (
                  <View key={day.key} style={styles.barColumn}>
                    <Text style={styles.barValue}>{day.minutes || ''}</Text>
                    <View style={styles.barTrack}><View style={[styles.barFill, { height }]} /></View>
                    <Text style={styles.barLabel}>{day.label}</Text>
                  </View>
                );
              })}
            </View>
          </Card>

          <View style={styles.metricGrid}>
            <MetricCard icon="checkmark-circle-outline" label="Plan completion" value={`${progress.tasks.completionRate}%`} color={theme.colors.accent} style={styles.metricCard} />
            <MetricCard icon="layers-outline" label="Flashcard mastery" value={`${progress.learn.masteryRate}%`} color={theme.colors.primary} style={styles.metricCard} />
          </View>
          <View style={styles.metricHints}>
            <Text style={styles.metricHint}>{progress.tasks.completed} of {progress.tasks.total} tasks completed</Text>
            <Text style={styles.metricHint}>{progress.learn.mastered} of {progress.learn.cards} cards mastered</Text>
          </View>

          <SectionHeader title="By subject" subtitle="Where your study time has gone." style={styles.sectionSpace} />
          {progress.subjectBreakdown.length === 0 ? (
            <Card><Text style={styles.subjectEmptyTitle}>No subject history in this period</Text><Text style={styles.subjectEmptyText}>Study a subject in Focus to build a useful breakdown here.</Text></Card>
          ) : (
            <Card style={styles.subjectCard}>
              {progress.subjectBreakdown.map((subject, index) => {
                const ratio = progress.totalStudyMinutes > 0 ? Math.min(1, subject.minutes / progress.totalStudyMinutes) : 0;
                return (
                  <View key={subject.name} style={[styles.subjectRow, index < progress.subjectBreakdown.length - 1 && styles.divider]}>
                    <View style={styles.subjectTopRow}>
                      <AppIcon name="book-outline" size={19} color={theme.colors.primary} />
                      <View style={styles.subjectCopy}><Text style={styles.subjectName}>{subject.name}</Text><Text style={styles.subjectMinutes}>{formatMinutes(subject.minutes)}</Text></View>
                      <Text style={styles.subjectPercent}>{Math.round(ratio * 100)}%</Text>
                    </View>
                    <ProgressBar progress={ratio} style={styles.subjectProgress} />
                  </View>
                );
              })}
            </Card>
          )}

          <SectionHeader title="Learning system" subtitle="A quick view beyond timer minutes." style={styles.sectionSpace} />
          <Card style={styles.systemCard}>
            <SystemRow icon="calendar-outline" title="Plan" value={`${progress.tasks.completed}/${progress.tasks.total}`} hint="completed tasks" theme={theme} styles={styles} onPress={() => navigation.navigate('Planner')} />
            <SystemRow icon="timer-outline" title="Focus" value={formatMinutes(progress.totalStudyMinutes)} hint={`${progress.sessionCount} sessions`} theme={theme} styles={styles} onPress={() => navigation.navigate('Tracker')} />
            <SystemRow icon="layers-outline" title="Learn" value={`${progress.learn.decks}`} hint={`${progress.learn.cards} cards across decks`} theme={theme} styles={styles} onPress={() => navigation.navigate('Flashcards')} last />
          </Card>
        </>
      )}
    </ScreenLayout>
  );
}

function HeroMetric({ value, label, styles }) {
  return <View style={styles.heroMetric}><Text style={styles.heroMetricValue}>{value}</Text><Text style={styles.heroMetricLabel}>{label}</Text></View>;
}

function SystemRow({ icon, title, value, hint, theme, styles, onPress, last }) {
  return (
    <TouchableOpacity style={[styles.systemRow, !last && styles.divider]} onPress={onPress}>
      <AppIcon name={icon} size={20} color={theme.colors.primary} />
      <View style={styles.systemCopy}><Text style={styles.systemTitle}>{title}</Text><Text style={styles.systemHint}>{hint}</Text></View>
      <Text style={styles.systemValue}>{value}</Text>
      <AppIcon name="chevron-forward" size={17} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
}

const getStyles = (theme) => StyleSheet.create({
  content: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontFamily: typography.regular, fontSize: 13, color: theme.colors.textSecondary },
  rangeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xl, marginBottom: spacing.lg },
  rangeChip: { minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  rangeChipActive: { backgroundColor: theme.colors.text, borderColor: theme.colors.text },
  rangeText: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.textSecondary },
  rangeTextActive: { color: theme.colors.textInverse },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { fontFamily: typography.semibold, fontSize: 17, color: theme.colors.text, marginTop: spacing.md },
  emptyText: { fontFamily: typography.regular, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  heroCard: { borderRadius: radius.xl },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroCopy: { flex: 1 },
  heroEyebrow: { fontFamily: typography.semibold, fontSize: 11, letterSpacing: 0.8, color: theme.colors.primary },
  heroValue: { fontFamily: typography.bold, fontSize: 30, lineHeight: 36, color: theme.colors.text, marginTop: 2 },
  heroHint: { fontFamily: typography.regular, fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary, marginTop: 2 },
  heroMetrics: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  heroMetric: { flex: 1, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.separator },
  heroMetricValue: { fontFamily: typography.bold, fontSize: 18, color: theme.colors.text },
  heroMetricLabel: { fontFamily: typography.regular, fontSize: 10, color: theme.colors.textSecondary, marginTop: 1 },
  sectionSpace: { marginTop: spacing.xxl },
  chartCard: { height: 196 },
  chartArea: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.xs },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { height: 18, fontFamily: typography.regular, fontSize: 9, color: theme.colors.textMuted },
  barTrack: { height: 116, width: '58%', borderRadius: radius.pill, backgroundColor: theme.colors.surfaceMuted, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', minHeight: 8, borderRadius: radius.pill, backgroundColor: theme.colors.primary },
  barLabel: { fontFamily: typography.semibold, fontSize: 10, color: theme.colors.textSecondary, marginTop: spacing.xs },
  metricGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  metricCard: { minHeight: 118 },
  metricHints: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  metricHint: { flex: 1, fontFamily: typography.regular, fontSize: 10, lineHeight: 15, color: theme.colors.textMuted },
  subjectEmptyTitle: { fontFamily: typography.semibold, fontSize: 14, color: theme.colors.text },
  subjectEmptyText: { fontFamily: typography.regular, fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary, marginTop: 2 },
  subjectCard: { padding: 0, overflow: 'hidden' },
  subjectRow: { padding: spacing.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.separator },
  subjectTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subjectCopy: { flex: 1 },
  subjectName: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.text },
  subjectMinutes: { fontFamily: typography.regular, fontSize: 10, color: theme.colors.textSecondary, marginTop: 1 },
  subjectPercent: { fontFamily: typography.semibold, fontSize: 11, color: theme.colors.primary },
  subjectProgress: { marginTop: spacing.sm },
  systemCard: { padding: 0, overflow: 'hidden' },
  systemRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  systemCopy: { flex: 1 },
  systemTitle: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.text },
  systemHint: { fontFamily: typography.regular, fontSize: 10, color: theme.colors.textSecondary, marginTop: 1 },
  systemValue: { fontFamily: typography.bold, fontSize: 14, color: theme.colors.text },
});
