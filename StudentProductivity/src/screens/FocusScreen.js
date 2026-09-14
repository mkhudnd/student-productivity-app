import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenLayout from '../components/ScreenLayout';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { AnalyticsService } from '../utils/analyticsService';
import {
  completeFocusRuntime,
  createSubject,
  discardFocusRuntime,
  elapsedFocusSeconds,
  loadFocusWorkspace,
  pauseFocusRuntime,
  resumeFocusRuntime,
  startFocusRuntime,
} from '../utils/focusRepository';
import { localDateKey } from '../utils/planRepository';
import { layout, radius, shadow, spacing, typography } from '../theme/designSystem';

function formatClock(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatMinutes(seconds) {
  return Math.round(Number(seconds || 0) / 60);
}

export default function FocusScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { currentUser } = useUser();
  const styles = getStyles(theme);
  const [workspace, setWorkspace] = useState({ subjects: [], plannedSessions: [], sessions: [], goals: { dailyMinutes: 120 }, runtime: null });
  const [loading, setLoading] = useState(true);
  const [runtime, setRuntime] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [selectedSubjectId, setSelectedSubjectId] = useState(route?.params?.subjectId || '');
  const [selectedTopic, setSelectedTopic] = useState(route?.params?.topic || '');
  const [selectedPlanId, setSelectedPlanId] = useState(route?.params?.plannedSessionId || null);
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await loadFocusWorkspace(currentUser);
      setWorkspace(data);
      setRuntime(data.runtime);

      const routeSubjectId = route?.params?.subjectId;
      const routeTopic = route?.params?.topic;
      const routePlanId = route?.params?.plannedSessionId;
      if (routeSubjectId) setSelectedSubjectId(routeSubjectId);
      if (routeTopic !== undefined && routeTopic !== null) setSelectedTopic(routeTopic);
      if (routePlanId) setSelectedPlanId(routePlanId);

      if (!routeSubjectId && !selectedSubjectId && data.subjects.length === 1) {
        setSelectedSubjectId(data.subjects[0].id);
      }
    } catch (error) {
      console.error('Unable to load Focus workspace:', error);
      Alert.alert('Focus unavailable', 'Your local study data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, route?.params?.subjectId, route?.params?.topic, route?.params?.plannedSessionId, selectedSubjectId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  useEffect(() => {
    if (!runtime?.startedAt || runtime.status !== 'running') return undefined;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runtime?.startedAt, runtime?.status]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);

  const selectedSubject = useMemo(
    () => workspace.subjects.find((subject) => subject.id === selectedSubjectId) || null,
    [workspace.subjects, selectedSubjectId]
  );

  const selectedPlan = useMemo(
    () => workspace.plannedSessions.find((plan) => plan.id === selectedPlanId) || null,
    [workspace.plannedSessions, selectedPlanId]
  );

  const todayPlans = useMemo(
    () => workspace.plannedSessions
      .filter((plan) => plan.date === localDateKey())
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [workspace.plannedSessions]
  );

  const todaySeconds = useMemo(
    () => workspace.sessions
      .filter((session) => session.date === localDateKey())
      .reduce((total, session) => total + Number(session.duration || 0), 0),
    [workspace.sessions]
  );

  const elapsed = runtime ? elapsedFocusSeconds(runtime, now) : 0;
  const targetSeconds = runtime?.targetMinutes ? runtime.targetMinutes * 60 : 0;
  const targetProgress = targetSeconds > 0 ? Math.min(1, elapsed / targetSeconds) : 0;
  const dailyGoal = Number(workspace.goals?.dailyMinutes || 120);
  const dayProgress = dailyGoal > 0 ? Math.min(1, formatMinutes(todaySeconds) / dailyGoal) : 0;

  const selectPlan = (plan) => {
    setSelectedPlanId(plan.id);
    setSelectedSubjectId(plan.subjectId);
    setSelectedTopic(plan.topic || '');
  };

  const start = async () => {
    if (!selectedSubject) {
      Alert.alert('Choose a subject', 'Select what you want to study before starting Focus.');
      return;
    }

    try {
      const nextRuntime = await startFocusRuntime(currentUser, {
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        topic: selectedTopic,
        plannedSessionId: selectedPlan?.id || null,
        targetMinutes: selectedPlan?.plannedDuration || null,
      });
      setRuntime(nextRuntime);
      setNow(Date.now());
    } catch (error) {
      Alert.alert('Could not start Focus', error.message || 'Please try again.');
    }
  };

  const togglePause = async () => {
    try {
      const nextRuntime = runtime.status === 'running'
        ? await pauseFocusRuntime(currentUser, runtime)
        : await resumeFocusRuntime(currentUser, runtime);
      setRuntime(nextRuntime);
      setNow(Date.now());
    } catch (error) {
      Alert.alert('Could not update timer', 'Please try again.');
    }
  };

  const finish = async () => {
    try {
      setFinishing(true);
      const session = await completeFocusRuntime(currentUser, runtime);
      try {
        await AnalyticsService.recordStudySession({
          date: session.date,
          subjectId: session.subjectId,
          subjectName: runtime.subjectName,
          topic: session.topic || 'General',
          duration: Math.round(session.duration / 60),
          sessionType: 'regular',
          completed: true,
          breaks: 0,
        }, currentUser);
      } catch (analyticsError) {
        console.error('Focus session saved but analytics recording failed:', analyticsError);
      }
      setRuntime(null);
      setSelectedPlanId(null);
      await load();
      Alert.alert('Focus complete', `${formatMinutes(session.duration)} minute${formatMinutes(session.duration) === 1 ? '' : 's'} saved to your study history.`);
    } catch (error) {
      Alert.alert('Could not finish session', error.message || 'Please try again.');
    } finally {
      setFinishing(false);
    }
  };

  const discard = () => {
    Alert.alert(
      'Discard this session?',
      'The running timer will be cleared and no study time will be recorded.',
      [
        { text: 'Keep studying', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await discardFocusRuntime(currentUser);
            setRuntime(null);
            setNow(Date.now());
          },
        },
      ]
    );
  };

  const addSubject = async () => {
    try {
      setCreatingSubject(true);
      const subject = await createSubject(currentUser, newSubjectName);
      setNewSubjectName('');
      setSubjectModalVisible(false);
      setSelectedSubjectId(subject.id);
      await load();
    } catch (error) {
      Alert.alert('Could not create subject', error.message || 'Please try again.');
    } finally {
      setCreatingSubject(false);
    }
  };

  const openLegacyTracker = () => {
    const parent = navigation.getParent();
    if (parent) parent.navigate('TrackerLegacy');
  };

  if (loading && !runtime) {
    return (
      <ScreenLayout showHeader={false} horizontalPadding={false} verticalPadding={false}>
        <View style={styles.fullLoading}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text style={styles.loadingText}>Preparing Focus…</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (runtime) {
    return (
      <ScreenLayout
        scrollable
        showHeader={false}
        horizontalPadding={false}
        verticalPadding={false}
        contentContainerStyle={styles.activeScreen}
      >
        <View style={styles.activeTopBar}>
          <View>
            <Text style={styles.activeEyebrow}>{runtime.status === 'paused' ? 'PAUSED' : 'FOCUSING'}</Text>
            <Text style={styles.activeSubject}>{runtime.subjectName}</Text>
            <Text style={styles.activeTopic}>{runtime.topic || 'General study'}</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={discard}>
            <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.timerArea}>
          <View style={[styles.timerRing, runtime.status === 'paused' && styles.timerRingPaused]}>
            <Text style={styles.timerText}>{formatClock(elapsed)}</Text>
            <Text style={styles.timerCaption}>
              {runtime.targetMinutes ? `${runtime.targetMinutes} min planned` : 'Open focus session'}
            </Text>
          </View>

          {targetSeconds > 0 ? (
            <View style={styles.targetWrap}>
              <View style={styles.targetTrack}>
                <View style={[styles.targetFill, { width: `${Math.round(targetProgress * 100)}%` }]} />
              </View>
              <Text style={styles.targetLabel}>{Math.round(targetProgress * 100)}% of planned time</Text>
            </View>
          ) : null}

          <View style={styles.runtimeInfo}>
            <Ionicons name="phone-portrait-outline" size={18} color={theme.colors.accent} />
            <Text style={styles.runtimeInfoText}>You can lock or background the app. Elapsed time is reconstructed from timestamps when you return.</Text>
          </View>
        </View>

        <View style={styles.timerActions}>
          <TouchableOpacity style={styles.secondaryTimerButton} onPress={togglePause}>
            <Ionicons name={runtime.status === 'running' ? 'pause' : 'play'} size={20} color={theme.colors.primary} />
            <Text style={styles.secondaryTimerText}>{runtime.status === 'running' ? 'Pause' : 'Resume'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.finishButton} onPress={finish} disabled={finishing}>
            {finishing ? <ActivityIndicator color={theme.colors.primaryText} /> : <Ionicons name="checkmark" size={20} color={theme.colors.primaryText} />}
            <Text style={styles.finishText}>{finishing ? 'Saving…' : 'Finish'}</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      scrollable
      showHeader={false}
      horizontalPadding={false}
      verticalPadding={false}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>FOCUS</Text>
          <Text style={styles.title}>Do one thing well</Text>
          <Text style={styles.subtitle}>Choose the subject and topic. Everything else can wait.</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={openLegacyTracker} accessibilityLabel="Manage subjects">
          <Ionicons name="options-outline" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.goalCard}>
        <View style={styles.goalTop}>
          <View>
            <Text style={styles.cardEyebrow}>TODAY</Text>
            <Text style={styles.goalValue}>{formatMinutes(todaySeconds)} / {dailyGoal} min</Text>
          </View>
          <Text style={styles.goalPercent}>{Math.round(dayProgress * 100)}%</Text>
        </View>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${Math.round(dayProgress * 100)}%` }]} />
        </View>
      </View>

      {todayPlans.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Planned for today</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Planner')}>
              <Text style={styles.sectionAction}>Plan</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planRow}>
            {todayPlans.map((plan) => {
              const subject = workspace.subjects.find((item) => item.id === plan.subjectId);
              const active = selectedPlanId === plan.id;
              return (
                <TouchableOpacity
                  key={plan.id}
                  style={[styles.planCard, active && styles.planCardActive]}
                  onPress={() => selectPlan(plan)}
                >
                  <Text style={[styles.planTime, active && styles.planActiveText]}>{plan.startTime || 'Flexible'}</Text>
                  <Text style={[styles.planSubject, active && styles.planActiveText]} numberOfLines={1}>{subject?.name || 'Study session'}</Text>
                  <Text style={[styles.planTopic, active && styles.planActiveSubtext]} numberOfLines={1}>{plan.topic || `${plan.plannedDuration || 0} min planned`}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>What are you studying?</Text>
        <TouchableOpacity onPress={() => setSubjectModalVisible(true)}>
          <Text style={styles.sectionAction}>+ Subject</Text>
        </TouchableOpacity>
      </View>

      {workspace.subjects.length === 0 ? (
        <TouchableOpacity style={styles.emptySubject} onPress={() => setSubjectModalVisible(true)}>
          <View style={styles.emptySubjectIcon}>
            <Ionicons name="book-outline" size={22} color={theme.colors.primary} />
          </View>
          <View style={styles.emptySubjectCopy}>
            <Text style={styles.emptySubjectTitle}>Create your first subject</Text>
            <Text style={styles.emptySubjectBody}>Subjects connect Plan, Focus and Progress.</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={theme.colors.textMuted} />
        </TouchableOpacity>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectRow}>
          {workspace.subjects.map((subject) => {
            const active = selectedSubjectId === subject.id;
            return (
              <TouchableOpacity
                key={subject.id}
                style={[styles.subjectChip, active && styles.subjectChipActive]}
                onPress={() => {
                  setSelectedSubjectId(subject.id);
                  setSelectedPlanId(null);
                  setSelectedTopic('');
                }}
              >
                <Text style={[styles.subjectChipText, active && styles.subjectChipTextActive]}>{subject.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {selectedSubject ? (
        <View style={styles.topicCard}>
          <Text style={styles.fieldLabel}>Topic</Text>
          {Array.isArray(selectedSubject.topics) && selectedSubject.topics.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicRow}>
              {selectedSubject.topics.map((topic) => {
                const active = selectedTopic === topic.name;
                return (
                  <TouchableOpacity
                    key={topic.name}
                    style={[styles.topicChip, active && styles.topicChipActive]}
                    onPress={() => setSelectedTopic(topic.name)}
                  >
                    <Text style={[styles.topicChipText, active && styles.topicChipTextActive]}>{topic.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}
          <TextInput
            style={styles.topicInput}
            value={selectedTopic}
            onChangeText={setSelectedTopic}
            placeholder="General study or type a topic"
            placeholderTextColor={theme.colors.placeholder}
          />
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.startButton, !selectedSubject && styles.startButtonDisabled]}
        onPress={start}
        disabled={!selectedSubject}
      >
        <Ionicons name="play" size={20} color={theme.colors.primaryText} />
        <Text style={styles.startButtonText}>
          {selectedPlan ? `Start ${selectedPlan.plannedDuration || ''} min session`.trim() : 'Start focus session'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.manageLink} onPress={openLegacyTracker}>
        <Text style={styles.manageLinkText}>Manage subjects, topics and old tracker tools</Text>
        <Ionicons name="chevron-forward" size={17} color={theme.colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={subjectModalVisible} transparent animationType="slide" onRequestClose={() => setSubjectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>NEW SUBJECT</Text>
                <Text style={styles.modalTitle}>What are you learning?</Text>
              </View>
              <TouchableOpacity style={styles.iconButton} onPress={() => setSubjectModalVisible(false)}>
                <Ionicons name="close" size={21} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.subjectInput}
              value={newSubjectName}
              onChangeText={setNewSubjectName}
              placeholder="e.g. Database Systems"
              placeholderTextColor={theme.colors.placeholder}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={addSubject}
            />
            <TouchableOpacity style={styles.createButton} onPress={addSubject} disabled={creatingSubject}>
              {creatingSubject ? <ActivityIndicator color={theme.colors.primaryText} /> : <Ionicons name="add" size={19} color={theme.colors.primaryText} />}
              <Text style={styles.createButtonText}>{creatingSubject ? 'Creating…' : 'Create subject'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const getStyles = (theme) => StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  fullLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontFamily: typography.regular, color: theme.colors.textSecondary },
  header: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontFamily: typography.semibold, fontSize: 12, letterSpacing: 1.3, color: theme.colors.primary, marginBottom: spacing.xxs },
  title: { fontFamily: typography.bold, fontSize: typography.sizes.display, lineHeight: typography.lineHeights.display, color: theme.colors.text },
  subtitle: { fontFamily: typography.regular, fontSize: typography.sizes.bodySmall, color: theme.colors.textSecondary, marginTop: spacing.xs, maxWidth: 300 },
  iconButton: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  goalCard: { marginHorizontal: layout.screenPadding, padding: spacing.md, borderRadius: radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, ...shadow.card },
  goalTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardEyebrow: { fontFamily: typography.semibold, fontSize: 11, letterSpacing: 1, color: theme.colors.textSecondary },
  goalValue: { fontFamily: typography.bold, fontSize: typography.sizes.title, color: theme.colors.text, marginTop: 2 },
  goalPercent: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.primary },
  goalTrack: { height: 7, borderRadius: radius.pill, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden', marginTop: spacing.md },
  goalFill: { height: '100%', borderRadius: radius.pill, backgroundColor: theme.colors.primary },
  sectionHeader: { paddingHorizontal: layout.screenPadding, marginTop: spacing.xl, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: typography.semibold, fontSize: typography.sizes.titleSmall, color: theme.colors.text },
  sectionAction: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.primary },
  planRow: { paddingHorizontal: layout.screenPadding, gap: spacing.sm },
  planCard: { width: 188, minHeight: 104, padding: spacing.md, borderRadius: radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  planCardActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  planTime: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.primary },
  planSubject: { fontFamily: typography.semibold, fontSize: 15, color: theme.colors.text, marginTop: spacing.xs },
  planTopic: { fontFamily: typography.regular, fontSize: 11, color: theme.colors.textSecondary, marginTop: 3 },
  planActiveText: { color: theme.colors.primaryText },
  planActiveSubtext: { color: theme.colors.primaryText, opacity: 0.82 },
  subjectRow: { paddingHorizontal: layout.screenPadding, gap: spacing.xs },
  subjectChip: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  subjectChipActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  subjectChipText: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.textSecondary },
  subjectChipTextActive: { color: theme.colors.primary },
  emptySubject: { marginHorizontal: layout.screenPadding, minHeight: 84, padding: spacing.md, borderRadius: radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center' },
  emptySubjectIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptySubjectCopy: { flex: 1, marginHorizontal: spacing.sm },
  emptySubjectTitle: { fontFamily: typography.semibold, fontSize: 14, color: theme.colors.text },
  emptySubjectBody: { fontFamily: typography.regular, fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  topicCard: { marginHorizontal: layout.screenPadding, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  fieldLabel: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.textSecondary, marginBottom: spacing.xs },
  topicRow: { gap: spacing.xs, paddingBottom: spacing.sm },
  topicChip: { minHeight: 36, borderRadius: radius.pill, backgroundColor: theme.colors.surfaceMuted, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  topicChipActive: { backgroundColor: theme.colors.primarySoft },
  topicChipText: { fontFamily: typography.semibold, fontSize: 11, color: theme.colors.textSecondary },
  topicChipTextActive: { color: theme.colors.primary },
  topicInput: { minHeight: 48, borderRadius: radius.md, backgroundColor: theme.colors.input, paddingHorizontal: spacing.md, fontFamily: typography.regular, fontSize: 14, color: theme.colors.inputText },
  startButton: { marginHorizontal: layout.screenPadding, marginTop: spacing.xl, minHeight: 56, borderRadius: radius.md, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, ...shadow.card },
  startButtonDisabled: { opacity: 0.45 },
  startButtonText: { fontFamily: typography.semibold, fontSize: 15, color: theme.colors.primaryText },
  manageLink: { marginHorizontal: layout.screenPadding, marginTop: spacing.sm, minHeight: 48, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  manageLinkText: { fontFamily: typography.regular, fontSize: 12, color: theme.colors.textSecondary },
  activeScreen: { minHeight: '100%', paddingHorizontal: layout.screenPadding, paddingBottom: spacing.xxxl },
  activeTopBar: { paddingTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  activeEyebrow: { fontFamily: typography.semibold, fontSize: 12, letterSpacing: 1.3, color: theme.colors.primary },
  activeSubject: { fontFamily: typography.bold, fontSize: typography.sizes.title, color: theme.colors.text, marginTop: 3 },
  activeTopic: { fontFamily: typography.regular, fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  timerArea: { flex: 1, minHeight: 480, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  timerRing: { width: 266, height: 266, borderRadius: 133, borderWidth: 8, borderColor: theme.colors.primary, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  timerRingPaused: { borderColor: theme.colors.warning },
  timerText: { fontFamily: typography.bold, fontSize: 48, color: theme.colors.text, letterSpacing: 1 },
  timerCaption: { fontFamily: typography.regular, fontSize: 12, color: theme.colors.textSecondary, marginTop: spacing.xs },
  targetWrap: { width: '82%', marginTop: spacing.xl },
  targetTrack: { height: 7, borderRadius: radius.pill, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' },
  targetFill: { height: '100%', borderRadius: radius.pill, backgroundColor: theme.colors.primary },
  targetLabel: { fontFamily: typography.regular, fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  runtimeInfo: { width: '90%', marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.md, backgroundColor: theme.colors.accentSoft, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  runtimeInfoText: { flex: 1, fontFamily: typography.regular, fontSize: 11, lineHeight: 17, color: theme.colors.textSecondary },
  timerActions: { flexDirection: 'row', gap: spacing.sm },
  secondaryTimerButton: { flex: 1, minHeight: 54, borderRadius: radius.md, backgroundColor: theme.colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  secondaryTimerText: { fontFamily: typography.semibold, fontSize: 14, color: theme.colors.primary },
  finishButton: { flex: 1, minHeight: 54, borderRadius: radius.md, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  finishText: { fontFamily: typography.semibold, fontSize: 14, color: theme.colors.primaryText },
  modalOverlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: layout.screenPadding, paddingBottom: spacing.xxxl },
  modalHandle: { width: 42, height: 5, borderRadius: radius.pill, backgroundColor: theme.colors.border, alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalEyebrow: { fontFamily: typography.semibold, fontSize: 11, letterSpacing: 1.2, color: theme.colors.primary },
  modalTitle: { fontFamily: typography.bold, fontSize: typography.sizes.title, color: theme.colors.text, marginTop: 2 },
  subjectInput: { minHeight: 52, borderRadius: radius.md, backgroundColor: theme.colors.input, paddingHorizontal: spacing.md, fontFamily: typography.regular, fontSize: 15, color: theme.colors.inputText },
  createButton: { minHeight: 52, marginTop: spacing.md, borderRadius: radius.md, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  createButtonText: { fontFamily: typography.semibold, fontSize: 14, color: theme.colors.primaryText },
});
