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
import { radius, shadow, spacing, typography } from '../theme/designSystem';

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

function topicName(topic) {
  return typeof topic === 'string' ? topic : topic?.name;
}

export default function FocusScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { currentUser } = useUser();
  const styles = getStyles(theme);
  const [workspace, setWorkspace] = useState({
    subjects: [],
    plannedSessions: [],
    sessions: [],
    goals: { dailyMinutes: 120 },
    runtime: null,
  });
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

      setSelectedSubjectId((current) => {
        if (routeSubjectId) return routeSubjectId;
        if (current) return current;
        return data.subjects.length === 1 ? data.subjects[0].id : '';
      });
      if (route?.params && Object.prototype.hasOwnProperty.call(route.params, 'topic')) {
        setSelectedTopic(routeTopic || '');
      }
      if (routePlanId) setSelectedPlanId(routePlanId);
    } catch (error) {
      console.error('Unable to load Focus workspace:', error);
      Alert.alert('Focus unavailable', 'Your local study data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.email, routeSubjectId, routeTopic, routePlanId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
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
    [workspace.subjects, selectedSubjectId],
  );

  const selectedPlan = useMemo(
    () => workspace.plannedSessions.find((plan) => plan.id === selectedPlanId) || null,
    [workspace.plannedSessions, selectedPlanId],
  );

  const todayPlans = useMemo(
    () => workspace.plannedSessions
      .filter((plan) => plan.date === localDateKey())
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [workspace.plannedSessions],
  );

  const todaySeconds = useMemo(
    () => workspace.sessions
      .filter((session) => session.date === localDateKey())
      .reduce((total, session) => total + Number(session.duration || 0), 0),
    [workspace.sessions],
  );

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
    Alert.alert(
      'Discard this session?',
      'The timer will be cleared and no study time will be recorded.',
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
      ],
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
      <ScreenLayout>
        <View style={styles.loadingState}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text style={styles.loadingText}>Preparing Focus…</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (runtime) {
    const progressPercent = Math.round(targetProgress * 100);
    return (
      <>
        <ScreenLayout
          scrollable
          horizontalPadding={false}
          verticalPadding={false}
          contentContainerStyle={styles.activeContent}
        >
          <View style={styles.activeHeader}>
            <View style={styles.activeHeaderCopy}>
              <Text style={styles.activeEyebrow}>{runtime.status === 'paused' ? 'PAUSED' : 'FOCUSING'}</Text>
              <Text style={styles.activeSubject}>{runtime.subjectName}</Text>
              <Text style={styles.activeTopic}>{runtime.topic || 'General study'}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={discard} accessibilityLabel="Discard focus session">
              <Ionicons name="close" size={21} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.timerHero}>
            <View style={[styles.timerOrb, runtime.status === 'paused' && styles.timerOrbPaused]}>
              <Text style={styles.timerStatus}>{runtime.status === 'paused' ? 'PAUSED' : 'ELAPSED'}</Text>
              <Text style={styles.timerText}>{formatClock(elapsed)}</Text>
              <Text style={styles.timerTarget}>
                {runtime.targetMinutes ? `${runtime.targetMinutes} min planned` : 'Open focus session'}
              </Text>
            </View>

            {targetSeconds > 0 ? (
              <View style={styles.targetBlock}>
                <View style={styles.targetTopRow}>
                  <Text style={styles.targetLabel}>Planned session</Text>
                  <Text style={styles.targetPercent}>{progressPercent}%</Text>
                </View>
                <View style={styles.targetTrack}>
                  <View style={[styles.targetFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>
            ) : null}

            <View style={styles.backgroundSafeCard}>
              <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.accent} />
              <View style={styles.backgroundSafeCopy}>
                <Text style={styles.backgroundSafeTitle}>Safe to leave the app</Text>
                <Text style={styles.backgroundSafeText}>Lock your phone or switch apps. The timer reconstructs elapsed time from persisted timestamps.</Text>
              </View>
            </View>
          </View>

          <View style={styles.timerActions}>
            <TouchableOpacity style={styles.pauseButton} onPress={togglePause}>
              <Ionicons name={runtime.status === 'running' ? 'pause' : 'play'} size={20} color={theme.colors.primary} />
              <Text style={styles.pauseText}>{runtime.status === 'running' ? 'Pause' : 'Resume'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.finishButton} onPress={() => setFinishModalVisible(true)}>
              <Ionicons name="checkmark" size={20} color={theme.colors.primaryText} />
              <Text style={styles.finishText}>Finish</Text>
            </TouchableOpacity>
          </View>
        </ScreenLayout>

        <Modal visible={finishModalVisible} transparent animationType="fade" onRequestClose={() => !finishing && setFinishModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.finishSheet}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Finish focus session</Text>
                  <Text style={styles.modalSubtitle}>{formatMinutes(elapsed)} minutes · {runtime.subjectName}</Text>
                </View>
                <TouchableOpacity style={styles.modalClose} onPress={() => setFinishModalVisible(false)} disabled={finishing}>
                  <Ionicons name="close" size={20} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Quick note (optional)</Text>
              <TextInput
                style={styles.noteInput}
                value={sessionNotes}
                onChangeText={setSessionNotes}
                placeholder="What did you cover? What should you continue next?"
                placeholderTextColor={theme.colors.placeholder}
                multiline
                textAlignVertical="top"
                editable={!finishing}
              />

              <TouchableOpacity style={styles.saveSessionButton} onPress={saveFinishedSession} disabled={finishing}>
                {finishing ? <ActivityIndicator color={theme.colors.primaryText} /> : <Ionicons name="checkmark" size={19} color={theme.colors.primaryText} />}
                <Text style={styles.saveSessionText}>{finishing ? 'Saving…' : 'Save session'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <>
      <ScreenLayout
        scrollable
        horizontalPadding={false}
        verticalPadding={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>FOCUS</Text>
            <Text style={styles.title}>Do one thing well</Text>
            <Text style={styles.subtitle}>Choose the work, start the timer, and let the rest wait.</Text>
          </View>
          <TouchableOpacity style={styles.manageButton} onPress={openLegacyTracker} accessibilityLabel="Manage subjects">
            <Ionicons name="options-outline" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.goalHero}>
          <View style={styles.goalTopRow}>
            <View style={styles.goalIcon}>
              <Ionicons name="time-outline" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.goalCopy}>
              <Text style={styles.goalEyebrow}>TODAY’S STUDY GOAL</Text>
              <Text style={styles.goalValue}>{studiedMinutes} of {dailyGoal} minutes</Text>
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
              <View>
                <Text style={styles.sectionTitle}>Planned for today</Text>
                <Text style={styles.sectionSubtitle}>Pick one to carry its context into Focus.</Text>
              </View>
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
                    <View style={styles.planTopRow}>
                      <Text style={[styles.planTime, active && styles.planActiveText]}>{plan.startTime || 'Flexible'}</Text>
                      {active ? <Ionicons name="checkmark-circle" size={18} color={theme.colors.primaryText} /> : null}
                    </View>
                    <Text style={[styles.planSubject, active && styles.planActiveText]} numberOfLines={1}>{subject?.name || 'Study session'}</Text>
                    <Text style={[styles.planTopic, active && styles.planActiveSubtext]} numberOfLines={1}>{plan.topic || `${plan.plannedDuration || 0} min planned`}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Start a session</Text>
            <Text style={styles.sectionSubtitle}>What are you studying right now?</Text>
          </View>
          <TouchableOpacity onPress={() => setSubjectModalVisible(true)}>
            <Text style={styles.sectionAction}>+ Subject</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sessionCard}>
          {workspace.subjects.length === 0 ? (
            <TouchableOpacity style={styles.emptySubject} onPress={() => setSubjectModalVisible(true)}>
              <View style={styles.emptySubjectIcon}>
                <Ionicons name="book-outline" size={22} color={theme.colors.primary} />
              </View>
              <View style={styles.emptySubjectCopy}>
                <Text style={styles.emptySubjectTitle}>Create your first subject</Text>
                <Text style={styles.emptySubjectText}>Subjects connect Plan, Focus, Learn and Progress.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <>
              <Text style={styles.inputLabel}>Subject</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectRow}>
                {workspace.subjects.map((subject) => {
                  const active = selectedSubjectId === subject.id;
                  return (
                    <TouchableOpacity
                      key={subject.id}
                      style={[styles.subjectChip, active && styles.subjectChipActive]}
                      onPress={() => chooseSubject(subject)}
                    >
                      <Text style={[styles.subjectText, active && styles.subjectTextActive]}>{subject.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {selectedSubject ? (
            <>
              <Text style={styles.inputLabel}>Topic</Text>
              {Array.isArray(selectedSubject.topics) && selectedSubject.topics.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicRow}>
                  <TouchableOpacity
                    style={[styles.topicChip, !selectedTopic && styles.topicChipActive]}
                    onPress={() => setSelectedTopic('')}
                  >
                    <Text style={[styles.topicText, !selectedTopic && styles.topicTextActive]}>General</Text>
                  </TouchableOpacity>
                  {selectedSubject.topics.map((topic) => {
                    const name = topicName(topic);
                    if (!name) return null;
                    const active = selectedTopic === name;
                    return (
                      <TouchableOpacity
                        key={name}
                        style={[styles.topicChip, active && styles.topicChipActive]}
                        onPress={() => setSelectedTopic(name)}
                      >
                        <Text style={[styles.topicText, active && styles.topicTextActive]}>{name}</Text>
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
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.startButton, !selectedSubject && styles.startButtonDisabled]}
            onPress={start}
            disabled={!selectedSubject}
          >
            <View style={styles.startButtonCopy}>
              <Text style={styles.startButtonTitle}>
                {selectedPlan ? `Start ${selectedPlan.plannedDuration || ''} min focus`.trim() : 'Start focus session'}
              </Text>
              <Text style={styles.startButtonSubtitle}>
                {selectedSubject ? `${selectedSubject.name}${selectedTopic ? ` · ${selectedTopic}` : ''}` : 'Choose a subject first'}
              </Text>
            </View>
            <View style={styles.startPlayIcon}>
              <Ionicons name="play" size={18} color={theme.colors.primaryText} />
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.manageLink} onPress={openLegacyTracker}>
          <View style={styles.manageLinkIcon}>
            <Ionicons name="settings-outline" size={19} color={theme.colors.primary} />
          </View>
          <View style={styles.manageLinkCopy}>
            <Text style={styles.manageLinkTitle}>Manage subjects and topics</Text>
            <Text style={styles.manageLinkText}>Legacy management tools remain available while V2 is migrated.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </ScreenLayout>

      <Modal visible={subjectModalVisible} transparent animationType="fade" onRequestClose={() => setSubjectModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.subjectSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>New subject</Text>
                <Text style={styles.modalSubtitle}>Create the study area that Plan, Learn and Progress will share.</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setSubjectModalVisible(false)}>
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Subject name</Text>
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
            <TouchableOpacity style={[styles.createButton, creatingSubject && { opacity: 0.55 }]} onPress={addSubject} disabled={creatingSubject}>
              {creatingSubject ? <ActivityIndicator color={theme.colors.primaryText} /> : <Ionicons name="add" size={19} color={theme.colors.primaryText} />}
              <Text style={styles.createButtonText}>{creatingSubject ? 'Creating…' : 'Create subject'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const getStyles = (theme) => StyleSheet.create({
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
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
  manageButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  goalHero: {
    borderRadius: 26,
    padding: spacing.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 28,
    ...shadow.card,
  },
  goalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  goalIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  goalCopy: { flex: 1 },
  goalEyebrow: {
    fontFamily: typography.semibold,
    fontSize: 11,
    letterSpacing: 0.7,
    color: theme.colors.primary,
  },
  goalValue: {
    fontFamily: typography.bold,
    fontSize: 19,
    color: theme.colors.text,
    marginTop: 2,
  },
  goalPercent: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: theme.colors.primary,
  },
  goalTrack: {
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: theme.colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
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
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  sectionAction: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.primary,
    paddingVertical: 6,
  },
  planRow: {
    gap: spacing.sm,
    paddingBottom: 28,
  },
  planCard: {
    width: 190,
    minHeight: 112,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  planCardActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planTime: {
    fontFamily: typography.semibold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  planSubject: {
    fontFamily: typography.semibold,
    fontSize: 15,
    color: theme.colors.text,
    marginTop: spacing.sm,
  },
  planTopic: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  planActiveText: { color: theme.colors.primaryText },
  planActiveSubtext: { color: 'rgba(255,255,255,0.78)' },
  sessionCard: {
    borderRadius: 24,
    padding: spacing.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...shadow.card,
  },
  inputLabel: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: spacing.xs,
  },
  subjectRow: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  subjectChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  subjectChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  subjectText: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  subjectTextActive: { color: theme.colors.primaryText },
  topicRow: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  topicChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
  },
  topicChipActive: { backgroundColor: theme.colors.primarySoft },
  topicText: {
    fontFamily: typography.semibold,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  topicTextActive: { color: theme.colors.primary },
  topicInput: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: theme.colors.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: spacing.md,
    fontFamily: typography.regular,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: spacing.lg,
  },
  startButton: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    backgroundColor: theme.colors.primary,
  },
  startButtonDisabled: { opacity: 0.42 },
  startButtonCopy: { flex: 1 },
  startButtonTitle: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: theme.colors.primaryText,
  },
  startButtonSubtitle: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 2,
  },
  startPlayIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  emptySubject: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptySubjectIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  emptySubjectCopy: { flex: 1 },
  emptySubjectTitle: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: theme.colors.text,
  },
  emptySubjectText: {
    fontFamily: typography.regular,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  manageLink: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: spacing.sm,
  },
  manageLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  manageLinkCopy: { flex: 1 },
  manageLinkTitle: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
  },
  manageLinkText: {
    fontFamily: typography.regular,
    fontSize: 10,
    lineHeight: 15,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  activeContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
    minHeight: '100%',
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  activeHeaderCopy: { flex: 1 },
  activeEyebrow: {
    fontFamily: typography.semibold,
    fontSize: 12,
    letterSpacing: 1.1,
    color: theme.colors.primary,
  },
  activeSubject: {
    fontFamily: typography.bold,
    fontSize: 26,
    color: theme.colors.text,
    marginTop: 3,
  },
  activeTopic: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timerHero: {
    alignItems: 'center',
    paddingVertical: 44,
    marginTop: spacing.xl,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...shadow.card,
  },
  timerOrb: {
    width: 242,
    height: 242,
    borderRadius: 121,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 8,
    borderColor: theme.colors.primary,
  },
  timerOrbPaused: { borderColor: theme.colors.warning },
  timerStatus: {
    fontFamily: typography.semibold,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.colors.primary,
  },
  timerText: {
    fontFamily: typography.bold,
    fontSize: 46,
    color: theme.colors.text,
    marginTop: 4,
  },
  timerTarget: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  targetBlock: {
    width: '82%',
    marginTop: spacing.xl,
  },
  targetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  targetLabel: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  targetPercent: {
    fontFamily: typography.semibold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  targetTrack: {
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  targetFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: theme.colors.primary,
  },
  backgroundSafeCard: {
    width: '88%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 18,
    backgroundColor: theme.colors.accentSoft,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  backgroundSafeCopy: { flex: 1 },
  backgroundSafeTitle: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.text,
  },
  backgroundSafeText: {
    fontFamily: typography.regular,
    fontSize: 10,
    lineHeight: 15,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  timerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pauseButton: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 17,
    backgroundColor: theme.colors.primarySoft,
  },
  pauseText: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  finishButton: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 17,
    backgroundColor: theme.colors.primary,
  },
  finishText: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: theme.colors.primaryText,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  subjectSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.colors.surface,
    padding: spacing.xl,
  },
  finishSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.colors.surface,
    padding: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontFamily: typography.semibold,
    fontSize: 22,
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  subjectInput: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.input,
    paddingHorizontal: spacing.md,
    fontFamily: typography.regular,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: spacing.lg,
  },
  noteInput: {
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.input,
    padding: spacing.md,
    fontFamily: typography.regular,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: spacing.lg,
  },
  createButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
  },
  createButtonText: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: theme.colors.primaryText,
  },
  saveSessionButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
  },
  saveSessionText: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: theme.colors.primaryText,
  },
});
