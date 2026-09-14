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
import ScreenLayout from '../components/ScreenLayout';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { FlashcardService } from '../utils/flashcardService';
import { loadPlanWorkspace, localDateKey } from '../utils/planRepository';
import { radius, shadow, spacing, typography } from '../theme/designSystem';

const EMPTY_SUMMARY = {
  items: [],
  subjects: 0,
  todayMinutes: 0,
  dailyGoalMinutes: 120,
  decks: 0,
  cards: 0,
  dueCards: 0,
  streak: 0,
  overdue: 0,
};

function calculateStreak(sessions = []) {
  const studiedDates = new Set(
    sessions.filter((session) => session?.date).map((session) => session.date),
  );
  let streak = 0;
  const cursor = new Date();
  if (!studiedDates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (studiedDates.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getDisplayName(currentUser) {
  const candidate = currentUser?.displayName || currentUser?.username;
  if (candidate) return candidate.split(' ')[0];
  if (currentUser?.email) return currentUser.email.split('@')[0];
  return 'Student';
}

function formatToday() {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
}

function itemTime(item) {
  return item.time || item.startTime || '';
}

function isOverdue(item) {
  if (item.sourceType !== 'task' || item.completed || !item.time) return false;
  const [hour, minute] = item.time.split(':').map(Number);
  const now = new Date();
  return hour * 60 + minute < now.getHours() * 60 + now.getMinutes();
}

function buildTodayItems(workspace) {
  const today = localDateKey();
  const tasks = workspace.tasks
    .filter((task) => task.date === today && !task.completed)
    .map((task) => ({ ...task, sourceType: 'task' }));
  const studyPlans = workspace.studyPlans
    .filter((session) => session.date === today)
    .map((session) => ({ ...session, sourceType: 'study' }));

  return [...tasks, ...studyPlans]
    .sort((a, b) => {
      const aTime = itemTime(a);
      const bTime = itemTime(b);
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      return aTime.localeCompare(bTime);
    })
    .slice(0, 5);
}

function getDueCount(deck) {
  const today = localDateKey();
  return (Array.isArray(deck?.cards) ? deck.cards : []).filter(
    (card) => !card.dueDate || card.dueDate <= today,
  ).length;
}

export default function TodayScreen({ navigation }) {
  const { theme } = useTheme();
  const { currentUser } = useUser();
  const styles = getStyles(theme);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);

  const loadToday = useCallback(async () => {
    if (!currentUser?.email) {
      setSummary(EMPTY_SUMMARY);
      setLoading(false);
      return;
    }

    try {
      const [workspace, decks] = await Promise.all([
        loadPlanWorkspace(currentUser),
        FlashcardService.getUserFlashcardDecks(currentUser),
      ]);
      const today = localDateKey();
      const sessions = Array.isArray(workspace.completedSessions) ? workspace.completedSessions : [];
      const todaySeconds = sessions
        .filter((session) => session?.date === today)
        .reduce((total, session) => total + Number(session?.duration || 0), 0);
      const safeDecks = Array.isArray(decks) ? decks : [];
      const items = buildTodayItems(workspace);

      setSummary({
        items,
        subjects: workspace.subjects.length,
        todayMinutes: Math.round(todaySeconds / 60),
        dailyGoalMinutes: Number(workspace?.goals?.dailyMinutes || 120),
        decks: safeDecks.length,
        cards: safeDecks.reduce(
          (total, deck) => total + (Array.isArray(deck.cards) ? deck.cards.length : 0),
          0,
        ),
        dueCards: safeDecks.reduce((total, deck) => total + getDueCount(deck), 0),
        streak: calculateStreak(sessions),
        overdue: items.filter(isOverdue).length,
      });
    } catch (error) {
      console.error('Error loading Today workspace:', error);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.email]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadToday();
    }, [loadToday]),
  );

  const navigateRoot = (screen) => {
    const parent = navigation.getParent();
    if (parent) parent.navigate(screen);
    else navigation.navigate(screen);
  };

  const progress = Math.min(
    1,
    summary.dailyGoalMinutes > 0 ? summary.todayMinutes / summary.dailyGoalMinutes : 0,
  );

  const nextStudy = useMemo(
    () => summary.items.find((item) => item.sourceType === 'study'),
    [summary.items],
  );

  const startFocus = (studyItem = nextStudy) => {
    if (studyItem?.sourceType === 'study') {
      navigation.navigate('Tracker', {
        plannedSessionId: studyItem.id,
        subjectId: studyItem.subjectId,
        topic: studyItem.topic || null,
      });
      return;
    }
    navigation.navigate('Tracker');
  };

  const goalPercent = Math.round(progress * 100);

  return (
    <ScreenLayout
      scrollable
      horizontalPadding={false}
      verticalPadding={false}
      contentContainerStyle={styles.content}
    >
      <View style={styles.topRow}>
        <View style={styles.topCopy}>
          <Text style={styles.date}>{formatToday()}</Text>
          <Text style={styles.title}>Good day, {getDisplayName(currentUser)}</Text>
          <Text style={styles.subtitle}>Here’s the clearest path through your study day.</Text>
        </View>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => navigateRoot('Profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Text style={styles.avatarText}>{getDisplayName(currentUser).slice(0, 1).toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>Preparing today…</Text>
        </View>
      ) : (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroIcon}>
                <Ionicons name="sparkles-outline" size={22} color={theme.colors.primary} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>{nextStudy ? 'NEXT FOCUS' : 'TODAY’S FOCUS'}</Text>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {nextStudy ? nextStudy.subjectName : `${summary.todayMinutes} of ${summary.dailyGoalMinutes} minutes`}
                </Text>
                <Text style={styles.heroMeta} numberOfLines={2}>
                  {nextStudy
                    ? `${nextStudy.startTime || 'Flexible time'}${nextStudy.topic ? ` · ${nextStudy.topic}` : ''}`
                    : 'Start a focused session and build momentum toward your daily goal.'}
                </Text>
              </View>
              {!nextStudy ? <Text style={styles.heroPercent}>{goalPercent}%</Text> : null}
            </View>

            {!nextStudy ? (
              <View style={styles.heroProgressTrack}>
                <View style={[styles.heroProgressFill, { width: `${goalPercent}%` }]} />
              </View>
            ) : null}

            <TouchableOpacity style={styles.primaryAction} onPress={() => startFocus(nextStudy)}>
              <View style={styles.primaryActionCopy}>
                <Text style={styles.primaryActionTitle}>{nextStudy ? 'Start planned session' : 'Start focus session'}</Text>
                <Text style={styles.primaryActionSubtitle}>Timer stays accurate if the app is backgrounded.</Text>
              </View>
              <View style={styles.primaryActionIcon}>
                <Ionicons name="play" size={18} color={theme.colors.primaryText} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.metricRow}>
            <MetricTile
              icon="time-outline"
              value={`${summary.todayMinutes}m`}
              label="Studied"
              tint={theme.colors.primarySoft}
              iconColor={theme.colors.primary}
              styles={styles}
            />
            <MetricTile
              icon="flame-outline"
              value={summary.streak}
              label="Day streak"
              tint={`${theme.colors.warning}12`}
              iconColor={theme.colors.warning}
              styles={styles}
            />
            <MetricTile
              icon="albums-outline"
              value={summary.dueCards}
              label="Cards due"
              tint={theme.colors.accentSoft}
              iconColor={theme.colors.accent}
              styles={styles}
            />
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Today’s plan</Text>
              <Text style={styles.sectionSubtitle}>
                {summary.overdue > 0
                  ? `${summary.overdue} item${summary.overdue === 1 ? '' : 's'} need attention`
                  : 'Your next tasks and study blocks'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Planner')} accessibilityRole="button">
              <Text style={styles.sectionAction}>View plan</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.agendaCard}>
            {summary.items.length === 0 ? (
              <TouchableOpacity style={styles.emptyAgenda} onPress={() => navigation.navigate('Planner')}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.emptyCopy}>
                  <Text style={styles.emptyTitle}>Your day is open</Text>
                  <Text style={styles.emptyText}>Add a study block, assignment or task to shape today.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ) : (
              summary.items.map((item, index) => {
                const study = item.sourceType === 'study';
                const overdue = isOverdue(item);
                return (
                  <TouchableOpacity
                    key={`${item.sourceType}-${item.id}`}
                    style={[styles.agendaRow, index < summary.items.length - 1 && styles.agendaDivider]}
                    onPress={() => (study ? startFocus(item) : navigation.navigate('Planner'))}
                    accessibilityRole="button"
                  >
                    <View style={styles.timeBox}>
                      <Text style={[styles.timeText, overdue && styles.overdue]}>{itemTime(item) || 'Any'}</Text>
                      <Text style={styles.timeSub}>{item.endTime || (item.plannedDuration ? `${item.plannedDuration}m` : '')}</Text>
                    </View>
                    <View style={[styles.agendaIcon, { backgroundColor: study ? theme.colors.primarySoft : theme.colors.surfaceMuted }]}>
                      <Ionicons
                        name={study ? 'timer-outline' : item.itemType === 'assignment' ? 'document-text-outline' : 'checkmark-circle-outline'}
                        size={18}
                        color={study ? theme.colors.primary : theme.colors.textSecondary}
                      />
                    </View>
                    <View style={styles.agendaCopy}>
                      <Text style={styles.agendaTitle} numberOfLines={1}>{study ? item.subjectName : item.title}</Text>
                      <Text style={styles.agendaMeta} numberOfLines={1}>
                        {study ? (item.topic || 'Study session') : (item.itemType === 'assignment' ? 'Assignment' : item.category || 'Task')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Study system</Text>
              <Text style={styles.sectionSubtitle}>Everything connected around your subjects.</Text>
            </View>
          </View>

          <View style={styles.systemGrid}>
            <TouchableOpacity style={styles.systemCard} onPress={() => navigation.navigate('Tracker')}>
              <View style={[styles.systemIcon, { backgroundColor: theme.colors.primarySoft }]}>
                <Ionicons name="book-outline" size={21} color={theme.colors.primary} />
              </View>
              <Text style={styles.systemValue}>{summary.subjects}</Text>
              <Text style={styles.systemLabel}>Subjects</Text>
              <Text style={styles.systemHint}>Choose what to focus on</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.systemCard} onPress={() => navigation.navigate('Flashcards')}>
              <View style={[styles.systemIcon, { backgroundColor: theme.colors.accentSoft }]}>
                <Ionicons name="layers-outline" size={21} color={theme.colors.accent} />
              </View>
              <Text style={styles.systemValue}>{summary.decks}</Text>
              <Text style={styles.systemLabel}>Learning sets</Text>
              <Text style={styles.systemHint}>{summary.cards} flashcards</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.progressCard} onPress={() => navigation.navigate('Progress')}>
            <View style={styles.progressCardIcon}>
              <Ionicons name="stats-chart-outline" size={21} color={theme.colors.primary} />
            </View>
            <View style={styles.progressCardCopy}>
              <Text style={styles.progressCardTitle}>See your progress</Text>
              <Text style={styles.progressCardText}>Review study time, streaks and how your work is trending.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </>
      )}
    </ScreenLayout>
  );
}

function MetricTile({ icon, value, label, tint, iconColor, styles }) {
  return (
    <View style={styles.metricTile}>
      <View style={[styles.metricIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  topCopy: { flex: 1 },
  date: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  title: {
    fontFamily: typography.bold,
    fontSize: 30,
    lineHeight: 38,
    color: theme.colors.text,
    marginTop: spacing.xs,
  },
  subtitle: {
    fontFamily: typography.regular,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  avatarButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  avatarText: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: theme.colors.primary,
  },
  loadingCard: {
    minHeight: 160,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  loadingText: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  heroCard: {
    borderRadius: 26,
    backgroundColor: theme.colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    color: theme.colors.primary,
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: typography.bold,
    fontSize: 20,
    color: theme.colors.text,
    marginTop: 2,
  },
  heroMeta: {
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  heroPercent: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: theme.colors.primary,
  },
  heroProgressTrack: {
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: theme.colors.primary,
  },
  primaryAction: {
    marginTop: spacing.lg,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
  },
  primaryActionCopy: { flex: 1 },
  primaryActionTitle: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: theme.colors.primaryText,
  },
  primaryActionSubtitle: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 2,
  },
  primaryActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: 30,
  },
  metricTile: {
    flex: 1,
    minHeight: 112,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontFamily: typography.bold,
    fontSize: 20,
    color: theme.colors.text,
    marginTop: spacing.sm,
  },
  metricLabel: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
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
  sectionAction: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.primary,
    paddingVertical: 6,
  },
  agendaCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: 30,
  },
  agendaRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  agendaDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
  },
  timeBox: { width: 48 },
  timeText: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.text,
  },
  timeSub: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  overdue: { color: theme.colors.error },
  agendaIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaCopy: { flex: 1 },
  agendaTitle: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: theme.colors.text,
  },
  agendaMeta: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  emptyAgenda: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  emptyCopy: { flex: 1 },
  emptyTitle: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: theme.colors.text,
  },
  emptyText: {
    fontFamily: typography.regular,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  systemGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  systemCard: {
    flex: 1,
    minHeight: 164,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: spacing.md,
  },
  systemIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemValue: {
    fontFamily: typography.bold,
    fontSize: 26,
    color: theme.colors.text,
    marginTop: spacing.lg,
  },
  systemLabel: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
    marginTop: 1,
  },
  systemHint: {
    fontFamily: typography.regular,
    fontSize: 10,
    lineHeight: 15,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  progressCard: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  progressCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  progressCardCopy: { flex: 1 },
  progressCardTitle: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: theme.colors.text,
  },
  progressCardText: {
    fontFamily: typography.regular,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
