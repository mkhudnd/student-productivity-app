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
import { layout, radius, shadow, spacing, typography } from '../theme/designSystem';

const EMPTY_SUMMARY = {
  items: [],
  subjects: 0,
  todayMinutes: 0,
  dailyGoalMinutes: 120,
  decks: 0,
  cards: 0,
  streak: 0,
  overdue: 0,
};

function calculateStreak(sessions = []) {
  const studiedDates = new Set(
    sessions
      .filter((session) => session?.date)
      .map((session) => session.date)
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
    .slice(0, 4);
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
          0
        ),
        streak: calculateStreak(sessions),
        overdue: items.filter(isOverdue).length,
      });
    } catch (error) {
      console.error('Error loading Today workspace:', error);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadToday();
    }, [loadToday])
  );

  const navigateRoot = (screen) => {
    const parent = navigation.getParent();
    if (parent) parent.navigate(screen);
    else navigation.navigate(screen);
  };

  const progress = Math.min(
    1,
    summary.dailyGoalMinutes > 0
      ? summary.todayMinutes / summary.dailyGoalMinutes
      : 0
  );

  const nextStudy = useMemo(
    () => summary.items.find((item) => item.sourceType === 'study'),
    [summary.items]
  );

  const startFocus = () => {
    if (nextStudy) {
      navigation.navigate('Tracker', {
        plannedSessionId: nextStudy.id,
        subjectId: nextStudy.subjectId,
        topic: nextStudy.topic || null,
      });
      return;
    }
    navigation.navigate('Tracker');
  };

  return (
    <ScreenLayout
      scrollable
      showHeader={false}
      contentContainerStyle={styles.content}
      horizontalPadding={false}
      verticalPadding={false}
    >
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>Student Productivity</Text>
          <Text style={styles.date}>{formatToday()}</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigateRoot('Profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Ionicons name="person-outline" size={21} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>TODAY</Text>
        <Text style={styles.heroTitle}>Hi {getDisplayName(currentUser)}, what matters today?</Text>
        <Text style={styles.heroBody}>Plan the work, focus on one thing, then review what you learned.</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>Preparing your day…</Text>
        </View>
      ) : (
        <>
          <View style={styles.focusCard}>
            <View style={styles.focusHeader}>
              <View style={styles.focusIcon}>
                <Ionicons name="timer-outline" size={22} color={theme.colors.primary} />
              </View>
              <View style={styles.focusHeaderText}>
                <Text style={styles.cardEyebrow}>{nextStudy ? 'NEXT STUDY BLOCK' : 'FOCUS GOAL'}</Text>
                <Text style={styles.focusTitle} numberOfLines={1}>
                  {nextStudy ? nextStudy.subjectName : `${summary.todayMinutes} of ${summary.dailyGoalMinutes} min`}
                </Text>
                {nextStudy ? (
                  <Text style={styles.focusMeta} numberOfLines={1}>
                    {(nextStudy.startTime || 'Flexible')} · {nextStudy.topic || 'General study'}
                  </Text>
                ) : null}
              </View>
              {!nextStudy ? <Text style={styles.percent}>{Math.round(progress * 100)}%</Text> : null}
            </View>

            {!nextStudy ? (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
            ) : null}

            <TouchableOpacity style={styles.primaryButton} onPress={startFocus}>
              <Ionicons name="play" size={18} color={theme.colors.primaryText} />
              <Text style={styles.primaryButtonText}>{nextStudy ? 'Start planned session' : 'Start focus session'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Next up</Text>
              <Text style={styles.sectionSubtitle}>
                {summary.overdue > 0 ? `${summary.overdue} item${summary.overdue === 1 ? '' : 's'} need attention` : 'Tasks and study blocks from Plan'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Planner')}>
              <Text style={styles.sectionAction}>Plan</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {summary.items.length === 0 ? (
              <TouchableOpacity style={styles.emptyState} onPress={() => navigation.navigate('Planner')}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.emptyTextWrap}>
                  <Text style={styles.emptyTitle}>Your day is open</Text>
                  <Text style={styles.emptyBody}>Add a study block, assignment or task to give today some structure.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ) : (
              summary.items.map((item, index) => {
                const study = item.sourceType === 'study';
                const overdue = isOverdue(item);
                return (
                  <TouchableOpacity
                    key={`${item.sourceType}-${item.id}`}
                    style={[styles.taskRow, index < summary.items.length - 1 && styles.rowDivider]}
                    onPress={() => study ? startFocus() : navigation.navigate('Planner')}
                  >
                    <View style={styles.timeColumn}>
                      <Text style={[styles.taskTime, overdue && styles.overdueText]}>{itemTime(item) || '—'}</Text>
                      {(item.endTime || item.plannedDuration) ? (
                        <Text style={styles.taskEnd}>{item.endTime || `${item.plannedDuration}m`}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.itemIcon, { backgroundColor: study ? theme.colors.primarySoft : theme.colors.surfaceMuted }]}>
                      <Ionicons
                        name={study ? 'timer-outline' : item.itemType === 'assignment' ? 'document-text-outline' : 'checkmark-circle-outline'}
                        size={17}
                        color={study ? theme.colors.primary : theme.colors.textSecondary}
                      />
                    </View>
                    <View style={styles.taskCopy}>
                      <Text style={styles.taskTitle} numberOfLines={1}>{study ? item.subjectName : item.title}</Text>
                      <Text style={styles.taskMeta} numberOfLines={1}>
                        {study ? (item.topic || 'Study session') : (item.itemType === 'assignment' ? 'Assignment' : item.category || 'Task')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Your study system</Text>
              <Text style={styles.sectionSubtitle}>One connected view of the work</Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <TouchableOpacity style={styles.metricCard} onPress={() => navigation.navigate('Tracker')}>
              <View style={[styles.metricIcon, { backgroundColor: theme.colors.accentSoft }]}>
                <Ionicons name="book-outline" size={20} color={theme.colors.accent} />
              </View>
              <Text style={styles.metricValue}>{summary.subjects}</Text>
              <Text style={styles.metricLabel}>Subjects</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.metricCard} onPress={() => navigation.navigate('Flashcards')}>
              <View style={[styles.metricIcon, { backgroundColor: theme.colors.primarySoft }]}>
                <Ionicons name="albums-outline" size={20} color={theme.colors.primary} />
              </View>
              <Text style={styles.metricValue}>{summary.decks}</Text>
              <Text style={styles.metricLabel}>Decks · {summary.cards} cards</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.metricCard} onPress={() => navigation.navigate('Progress')}>
              <View style={[styles.metricIcon, { backgroundColor: theme.colors.surfaceMuted }]}>
                <Ionicons name="flame-outline" size={20} color={theme.colors.warning} />
              </View>
              <Text style={styles.metricValue}>{summary.streak}</Text>
              <Text style={styles.metricLabel}>Day streak</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Planner')}>
              <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.quickActionText}>Add to plan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Flashcards')}>
              <Ionicons name="layers-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.quickActionText}>Review cards</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => navigateRoot('Settings')}>
              <Ionicons name="settings-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.quickActionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScreenLayout>
  );
}

const getStyles = (theme) => StyleSheet.create({
  content: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.xxxl },
  topBar: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  brand: { fontFamily: typography.semibold, fontSize: typography.sizes.body, color: theme.colors.text },
  date: { marginTop: 2, fontFamily: typography.regular, fontSize: typography.sizes.caption, color: theme.colors.textSecondary },
  profileButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  hero: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  eyebrow: { fontFamily: typography.semibold, fontSize: typography.sizes.caption, letterSpacing: 1.2, color: theme.colors.primary, marginBottom: spacing.xs },
  heroTitle: { maxWidth: 520, fontFamily: typography.bold, fontSize: typography.sizes.display, lineHeight: typography.lineHeights.display, color: theme.colors.text },
  heroBody: { maxWidth: 560, marginTop: spacing.sm, fontFamily: typography.regular, fontSize: typography.sizes.body, lineHeight: typography.lineHeights.body, color: theme.colors.textSecondary },
  loadingCard: { minHeight: 160, borderRadius: radius.xl, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontFamily: typography.regular, fontSize: typography.sizes.bodySmall, color: theme.colors.textSecondary },
  focusCard: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, ...shadow.card },
  focusHeader: { flexDirection: 'row', alignItems: 'center' },
  focusIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primarySoft },
  focusHeaderText: { flex: 1, marginLeft: spacing.sm },
  cardEyebrow: { fontFamily: typography.semibold, fontSize: 11, letterSpacing: 1, color: theme.colors.textSecondary },
  focusTitle: { marginTop: 2, fontFamily: typography.semibold, fontSize: typography.sizes.titleSmall, color: theme.colors.text },
  focusMeta: { marginTop: 2, fontFamily: typography.regular, fontSize: 12, color: theme.colors.textSecondary },
  percent: { fontFamily: typography.semibold, fontSize: typography.sizes.bodySmall, color: theme.colors.primary },
  progressTrack: { height: 8, marginTop: spacing.lg, marginBottom: spacing.lg, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: theme.colors.surfaceMuted },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: theme.colors.primary },
  primaryButton: { minHeight: 48, marginTop: spacing.lg, borderRadius: radius.md, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  primaryButtonText: { fontFamily: typography.semibold, fontSize: typography.sizes.bodySmall, color: theme.colors.primaryText },
  sectionHeader: { marginTop: layout.sectionGap, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: typography.semibold, fontSize: typography.sizes.titleSmall, color: theme.colors.text },
  sectionSubtitle: { marginTop: 2, fontFamily: typography.regular, fontSize: typography.sizes.caption, color: theme.colors.textSecondary },
  sectionAction: { paddingVertical: spacing.xs, fontFamily: typography.semibold, fontSize: typography.sizes.bodySmall, color: theme.colors.primary },
  card: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  emptyState: { minHeight: 100, padding: spacing.md, flexDirection: 'row', alignItems: 'center' },
  emptyIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primarySoft },
  emptyTextWrap: { flex: 1, marginHorizontal: spacing.sm },
  emptyTitle: { fontFamily: typography.semibold, fontSize: typography.sizes.body, color: theme.colors.text },
  emptyBody: { marginTop: 2, fontFamily: typography.regular, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption, color: theme.colors.textSecondary },
  taskRow: { minHeight: 80, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.separator },
  timeColumn: { width: 54 },
  taskTime: { fontFamily: typography.semibold, fontSize: typography.sizes.bodySmall, color: theme.colors.text },
  taskEnd: { marginTop: 1, fontFamily: typography.regular, fontSize: 11, color: theme.colors.textMuted },
  overdueText: { color: theme.colors.error },
  itemIcon: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing.xs },
  taskCopy: { flex: 1, paddingHorizontal: spacing.xs },
  taskTitle: { fontFamily: typography.semibold, fontSize: typography.sizes.bodySmall, color: theme.colors.text },
  taskMeta: { marginTop: 2, fontFamily: typography.regular, fontSize: typography.sizes.caption, color: theme.colors.textSecondary },
  metricsGrid: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1, minHeight: 132, padding: spacing.md, borderRadius: radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  metricIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  metricValue: { fontFamily: typography.bold, fontSize: typography.sizes.title, color: theme.colors.text },
  metricLabel: { marginTop: 2, fontFamily: typography.regular, fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary },
  quickActions: { marginTop: spacing.xl, gap: spacing.sm },
  quickAction: { minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  quickActionText: { fontFamily: typography.semibold, fontSize: typography.sizes.bodySmall, color: theme.colors.text },
});
