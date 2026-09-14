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
import { useFocusEffect } from '@react-navigation/native';
import ScreenLayout from '../components/ScreenLayout';
import {
  AppIcon,
  Card,
  IconButton,
  PrimaryButton,
  ProgressBar,
  ScreenIntro,
  SectionHeader,
  SecondaryButton,
} from '../components/ui';
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
import { layout, radius, spacing, typography } from '../theme/designSystem';

function formatClock(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatMinutes(seconds) {
  return Math.round(Number(seconds || 0) / 60);
}

function topicName(topic) {
  return typeof topic === 'string' ? topic : topic?.name;
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
  const [finishModalVisible, setFinishModalVisible] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [finishing, setFinishing] = useState(false);

  const routeSubjectId = route?.params?.subjectId || '';
  const routeTopic = route?.params?.topic ?? '';
  const routePlanId = route?.params?.plannedSessionId || null;

  const load = useCallback(async () => {
    try {
      const data = await loadFocusWorkspace(currentUser);
      setWorkspace(data);
      setRuntime(data.runtime);
      setSelectedSubjectId((current) => routeSubjectId || current || (data.subjects.length === 1 ? data.subjects[0].id : ''));
      if (route?.params && Object.prototype.hasOwnProperty.call(route.params, 'topic')) setSelectedTopic(routeTopic || '');
      if (routePlanId) setSelectedPlanId(routePlanId);
    } catch (error) {
      console.error('Unable to load Focus workspace:', error);
      Alert.alert('Focus unavailable', 'Your local study data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.email, routeSubjectId, routeTopic, routePlanId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

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

  const selectedSubject = useMemo(() => workspace.subjects.find((subject) => subject.id === selectedSubjectId) || null, [workspace.subjects, selectedSubjectId]);
  const selectedPlan = useMemo(() => workspace.plannedSessions.find((plan) => plan.id === selectedPlanId) || null, [workspace.plannedSessions, selectedPlanId]);
  const todayPlans = useMemo(() => workspace.plannedSessions.filter((plan) => plan.date === localDateKey()).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')), [workspace.plannedSessions]);
  const todaySeconds = useMemo(() => workspace.sessions.filter((session) => session.date === localDateKey()).reduce((total, session) => total + Number(session.duration || 0), 0), [workspace.sessions]);

  const elapsed = runtime ? elapsedFocusSeconds(runtime, now) : 0;
  const targetSeconds = runtime?.targetMinutes ? runtime.targetMinutes * 60 : 0;
  const targetProgress = targetSeconds > 0 ? Math.min(1, elapsed / targetSeconds) : 0;
  const dailyGoal = Number(workspace.goals?.dailyMinutes || 120);
  const studiedMinutes = formatMinutes(todaySeconds);
  const dayProgress = dailyGoal > 0 ? Math.min(1, studiedMinutes / dailyGoal) : 0;

  const selectPlan = (plan) => {
    setSelectedPlanId(plan.id);
    setSelectedSubjectId(plan.subjectId);
    setSelectedTopic(plan.topic || '');
  };

  const chooseSubject = (subject) => {
    setSelectedSubjectId(subject.id);
    setSelectedPlanId(null);
    setSelectedTopic('');
  };

  const start = async () => {
    if (!selectedSubject) return Alert.alert('Choose a subject', 'Select what you want to study before starting Focus.');
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
      setSessionNotes('');
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

  const saveFinishedSession = async () => {
    try {
      setFinishing(true);
      const session = await completeFocusRuntime(currentUser, runtime, sessionNotes);
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
      setFinishModalVisible(false);
      setRuntime(null);
      setSelectedPlanId(null);
      setSessionNotes('');
      await load();
    } catch (error) {
      Alert.alert('Could not finish session', error.message || 'Please try again.');
    } finally {
      setFinishing(false);
    }
  };

  const discard = () => {
    Alert.alert('Discard this session?', 'The timer will be cleared and no study time will be recorded.', [
      { text: 'Keep studying', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: async () => { await discardFocusRuntime(currentUser); setRuntime(null); setNow(Date.now()); } },
    ]);
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
    return <ScreenLayout><View style={styles.loadingState}><ActivityIndicator color={theme.colors.primary} size="large" /><Text style={styles.loadingText}>Preparing Focus…</Text></View></ScreenLayout>;
  }

  if (runtime) {
    return (
      <>
        <ScreenLayout scrollable horizontalPadding={false} verticalPadding={false} contentContainerStyle={styles.activeContent}>
          <ScreenIntro
            eyebrow={runtime.status === 'paused' ? 'Paused' : 'Focusing'}
            title={runtime.subjectName}
            subtitle={runtime.topic || 'General study'}
            right={<IconButton icon="close" onPress={discard} accessibilityLabel="Discard focus session" />}
          />

          <View style={styles.timerArea}>
            <Text style={styles.timerLabel}>{runtime.status === 'paused' ? 'PAUSED' : 'ELAPSED'}</Text>
            <Text style={styles.timerText}>{formatClock(elapsed)}</Text>
            <Text style={styles.timerTarget}>{runtime.targetMinutes ? `${runtime.targetMinutes} min planned` : 'Open focus session'}</Text>

            {targetSeconds > 0 ? (
              <View style={styles.targetBlock}>
                <View style={styles.progressHeader}><Text style={styles.progressLabel}>Planned session</Text><Text style={styles.progressValue}>{Math.round(targetProgress * 100)}%</Text></View>
                <ProgressBar progress={targetProgress} />
              </View>
            ) : null}

            <Card style={styles.backgroundSafeCard}>
              <AppIcon name="phone-portrait-outline" size={21} color={theme.colors.accent} />
              <View style={styles.backgroundSafeCopy}>
                <Text style={styles.backgroundSafeTitle}>Safe to leave the app</Text>
                <Text style={styles.backgroundSafeText}>Lock your phone or switch apps. Focus reconstructs elapsed time from persisted timestamps.</Text>
              </View>
            </Card>
          </View>

          <View style={styles.timerActions}>
            <SecondaryButton label={runtime.status === 'running' ? 'Pause' : 'Resume'} icon={runtime.status === 'running' ? 'pause' : 'play'} onPress={togglePause} style={styles.timerAction} />
            <PrimaryButton label="Finish" icon="checkmark" onPress={() => setFinishModalVisible(true)} style={styles.timerAction} />
          </View>
        </ScreenLayout>

        <Modal visible={finishModalVisible} transparent animationType="fade" onRequestClose={() => !finishing && setFinishModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderCopy}><Text style={styles.modalTitle}>Finish focus session</Text><Text style={styles.modalSubtitle}>{formatMinutes(elapsed)} minutes · {runtime.subjectName}</Text></View>
                <IconButton icon="close" onPress={() => setFinishModalVisible(false)} disabled={finishing} accessibilityLabel="Close" />
              </View>
              <Text style={styles.fieldLabel}>Quick note (optional)</Text>
              <TextInput style={styles.noteInput} value={sessionNotes} onChangeText={setSessionNotes} placeholder="What did you cover? What should you continue next?" placeholderTextColor={theme.colors.placeholder} multiline textAlignVertical="top" editable={!finishing} />
              <PrimaryButton label={finishing ? 'Saving…' : 'Save session'} icon="checkmark" onPress={saveFinishedSession} loading={finishing} />
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <>
      <ScreenLayout scrollable horizontalPadding={false} verticalPadding={false} contentContainerStyle={styles.content}>
        <ScreenIntro
          eyebrow="Focus"
          title="Do one thing well"
          subtitle="Choose the work, start the timer, and let the rest wait."
          right={<IconButton icon="options-outline" onPress={openLegacyTracker} accessibilityLabel="Manage subjects" />}
        />

        <Card style={styles.goalCard}>
          <View style={styles.goalTop}>
            <AppIcon name="time-outline" size={22} color={theme.colors.primary} />
            <View style={styles.goalCopy}><Text style={styles.goalEyebrow}>TODAY’S STUDY GOAL</Text><Text style={styles.goalValue}>{studiedMinutes} of {dailyGoal} minutes</Text></View>
            <Text style={styles.goalPercent}>{Math.round(dayProgress * 100)}%</Text>
          </View>
          <ProgressBar progress={dayProgress} style={styles.goalProgress} />
        </Card>

        {todayPlans.length > 0 ? (
          <>
            <SectionHeader title="Planned for today" subtitle="Choose a block to carry its subject and topic into Focus." actionLabel="Plan" onAction={() => navigation.navigate('Planner')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.planRow}>
              {todayPlans.map((plan) => {
                const subject = workspace.subjects.find((item) => item.id === plan.subjectId);
                const active = selectedPlanId === plan.id;
                return (
                  <Card key={plan.id} style={[styles.planCard, active && styles.planCardActive]} onPress={() => selectPlan(plan)}>
                    <Text style={[styles.planTime, active && styles.planActiveText]}>{plan.startTime || 'Flexible'}</Text>
                    <Text style={[styles.planSubject, active && styles.planActiveText]} numberOfLines={1}>{subject?.name || 'Study session'}</Text>
                    <Text style={[styles.planTopic, active && styles.planActiveSubtext]} numberOfLines={1}>{plan.topic || `${plan.plannedDuration || 0} min planned`}</Text>
                  </Card>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        <SectionHeader title="What are you studying?" subtitle="Subjects connect Plan, Focus, Learn and Progress." actionLabel="+ Subject" onAction={() => setSubjectModalVisible(true)} />
        {workspace.subjects.length === 0 ? (
          <Card style={styles.emptySubject} onPress={() => setSubjectModalVisible(true)}>
            <AppIcon name="book-outline" size={23} color={theme.colors.primary} />
            <View style={styles.emptySubjectCopy}><Text style={styles.emptySubjectTitle}>Create your first subject</Text><Text style={styles.emptySubjectBody}>Give your study sessions a shared home.</Text></View>
            <AppIcon name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Card>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectRow}>
            {workspace.subjects.map((subject) => {
              const active = selectedSubjectId === subject.id;
              return <TouchableOpacity key={subject.id} style={[styles.subjectChip, active && styles.subjectChipActive]} onPress={() => chooseSubject(subject)}><Text style={[styles.subjectChipText, active && styles.subjectChipTextActive]}>{subject.name}</Text></TouchableOpacity>;
            })}
          </ScrollView>
        )}

        {selectedSubject ? (
          <Card style={styles.topicCard}>
            <Text style={styles.fieldLabel}>Topic</Text>
            {Array.isArray(selectedSubject.topics) && selectedSubject.topics.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicRow}>
                {selectedSubject.topics.map((topic) => {
                  const name = topicName(topic);
                  const active = selectedTopic === name;
                  return <TouchableOpacity key={name} style={[styles.topicChip, active && styles.topicChipActive]} onPress={() => setSelectedTopic(name)}><Text style={[styles.topicChipText, active && styles.topicChipTextActive]}>{name}</Text></TouchableOpacity>;
                })}
              </ScrollView>
            ) : null}
            <TextInput style={styles.topicInput} value={selectedTopic} onChangeText={setSelectedTopic} placeholder="General study or type a topic" placeholderTextColor={theme.colors.placeholder} />
          </Card>
        ) : null}

        <PrimaryButton label={selectedPlan ? `Start ${selectedPlan.plannedDuration || ''} min session`.trim() : 'Start focus session'} icon="play" onPress={start} disabled={!selectedSubject} style={styles.startButton} />
        <TouchableOpacity style={styles.manageLink} onPress={openLegacyTracker}><Text style={styles.manageLinkText}>Manage subjects, topics and legacy tracker tools</Text><AppIcon name="chevron-forward" size={17} color={theme.colors.textMuted} /></TouchableOpacity>
      </ScreenLayout>

      <Modal visible={subjectModalVisible} transparent animationType="slide" onRequestClose={() => setSubjectModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.subjectSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}><Text style={styles.modalEyebrow}>NEW SUBJECT</Text><Text style={styles.modalTitle}>What are you learning?</Text></View>
              <IconButton icon="close" onPress={() => setSubjectModalVisible(false)} accessibilityLabel="Close" />
            </View>
            <TextInput style={styles.subjectInput} value={newSubjectName} onChangeText={setNewSubjectName} placeholder="e.g. Database Systems" placeholderTextColor={theme.colors.placeholder} autoFocus returnKeyType="done" onSubmitEditing={addSubject} />
            <PrimaryButton label={creatingSubject ? 'Creating…' : 'Create subject'} icon="add" onPress={addSubject} loading={creatingSubject} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const getStyles = (theme) => StyleSheet.create({
  content: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  activeContent: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, minHeight: '100%' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontFamily: typography.regular, color: theme.colors.textSecondary },
  goalCard: { marginTop: spacing.xl, marginBottom: spacing.xxl },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalCopy: { flex: 1 },
  goalEyebrow: { fontFamily: typography.semibold, fontSize: 11, letterSpacing: 0.8, color: theme.colors.primary },
  goalValue: { fontFamily: typography.bold, fontSize: 20, color: theme.colors.text, marginTop: 2 },
  goalPercent: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.primary },
  goalProgress: { marginTop: spacing.md },
  planRow: { gap: spacing.sm, paddingBottom: spacing.xxl },
  planCard: { width: 188, minHeight: 104 },
  planCardActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  planTime: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.primary },
  planSubject: { fontFamily: typography.semibold, fontSize: 15, color: theme.colors.text, marginTop: spacing.xs },
  planTopic: { fontFamily: typography.regular, fontSize: 11, color: theme.colors.textSecondary, marginTop: 3 },
  planActiveText: { color: theme.colors.primaryText },
  planActiveSubtext: { color: theme.colors.primaryText, opacity: 0.82 },
  subjectRow: { gap: spacing.xs, paddingBottom: spacing.xl },
  subjectChip: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  subjectChipActive: { borderColor: theme.colors.primary },
  subjectChipText: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.textSecondary },
  subjectChipTextActive: { color: theme.colors.primary },
  emptySubject: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  emptySubjectCopy: { flex: 1 },
  emptySubjectTitle: { fontFamily: typography.semibold, fontSize: 14, color: theme.colors.text },
  emptySubjectBody: { fontFamily: typography.regular, fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  topicCard: { marginBottom: spacing.xl },
  fieldLabel: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.textSecondary, marginBottom: spacing.xs },
  topicRow: { gap: spacing.xs, paddingBottom: spacing.sm },
  topicChip: { minHeight: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  topicChipActive: { borderColor: theme.colors.primary },
  topicChipText: { fontFamily: typography.semibold, fontSize: 11, color: theme.colors.textSecondary },
  topicChipTextActive: { color: theme.colors.primary },
  topicInput: { minHeight: 48, borderRadius: radius.md, backgroundColor: theme.colors.input, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: spacing.md, fontFamily: typography.regular, fontSize: 14, color: theme.colors.inputText },
  startButton: { marginTop: spacing.xs },
  manageLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs, marginTop: spacing.sm },
  manageLinkText: { fontFamily: typography.regular, fontSize: 12, color: theme.colors.textSecondary },
  timerArea: { flex: 1, minHeight: 500, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  timerLabel: { fontFamily: typography.semibold, fontSize: 11, letterSpacing: 1.1, color: theme.colors.primary },
  timerText: { fontFamily: typography.bold, fontSize: 56, color: theme.colors.text, marginTop: spacing.xs },
  timerTarget: { fontFamily: typography.regular, fontSize: 12, color: theme.colors.textSecondary, marginTop: spacing.xs },
  targetBlock: { width: '84%', marginTop: spacing.xxl },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  progressLabel: { fontFamily: typography.regular, fontSize: 11, color: theme.colors.textSecondary },
  progressValue: { fontFamily: typography.semibold, fontSize: 11, color: theme.colors.primary },
  backgroundSafeCard: { width: '92%', marginTop: spacing.xxl, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  backgroundSafeCopy: { flex: 1 },
  backgroundSafeTitle: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.text },
  backgroundSafeText: { fontFamily: typography.regular, fontSize: 11, lineHeight: 17, color: theme.colors.textSecondary, marginTop: 2 },
  timerActions: { flexDirection: 'row', gap: spacing.sm },
  timerAction: { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalCard: { margin: layout.screenPadding, backgroundColor: theme.colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: theme.colors.border },
  subjectSheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: layout.screenPadding, paddingBottom: spacing.xxl },
  modalHandle: { width: 42, height: 4, borderRadius: radius.pill, backgroundColor: theme.colors.border, alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.lg },
  modalHeaderCopy: { flex: 1 },
  modalEyebrow: { fontFamily: typography.semibold, fontSize: 11, letterSpacing: 0.8, color: theme.colors.primary },
  modalTitle: { fontFamily: typography.bold, fontSize: 20, color: theme.colors.text },
  modalSubtitle: { fontFamily: typography.regular, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  noteInput: { minHeight: 110, borderRadius: radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.input, padding: spacing.md, fontFamily: typography.regular, fontSize: 14, color: theme.colors.text, marginBottom: spacing.lg },
  subjectInput: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.input, paddingHorizontal: spacing.md, fontFamily: typography.regular, fontSize: 14, color: theme.colors.text, marginBottom: spacing.lg },
});
