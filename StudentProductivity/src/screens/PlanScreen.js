import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  deletePlanTask,
  deleteStudyPlan,
  loadPlanWorkspace,
  localDateKey,
  savePlanTask,
  saveStudyPlan,
  togglePlanTask,
} from '../utils/planRepository';
import { layout, radius, shadow, spacing, typography } from '../theme/designSystem';

const FILTERS = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'study', label: 'Study' },
];

const TYPES = [
  { id: 'task', label: 'Task', icon: 'checkmark-circle-outline' },
  { id: 'study', label: 'Study', icon: 'timer-outline' },
  { id: 'assignment', label: 'Assignment', icon: 'document-text-outline' },
];

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function fromDateKey(key) {
  return new Date(`${key}T00:00:00`);
}

function formatDateHeading(key) {
  const date = fromDateKey(key);
  const today = localDateKey();
  const tomorrow = localDateKey(addDays(new Date(), 1));
  if (key === today) return 'Today';
  if (key === tomorrow) return 'Tomorrow';
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function formatShortDay(date) {
  return {
    day: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date),
    number: date.getDate(),
    key: localDateKey(date),
  };
}

function nextDefaultTime(dateKey) {
  if (dateKey !== localDateKey()) return '09:00';
  const now = new Date();
  const nextHour = Math.min(22, now.getHours() + 1);
  return `${String(nextHour).padStart(2, '0')}:00`;
}

function addHour(time) {
  const [hour, minute] = time.split(':').map(Number);
  return `${String(Math.min(23, hour + 1)).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');
}

function minutesBetween(start, end) {
  if (!isValidTime(start) || !isValidTime(end)) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function isOverdue(item, selectedDate) {
  if (item.completed || selectedDate !== localDateKey() || !item.time) return false;
  const now = new Date();
  const [hour, minute] = item.time.split(':').map(Number);
  return hour * 60 + minute < now.getHours() * 60 + now.getMinutes();
}

function initialForm(date) {
  const time = nextDefaultTime(date);
  return {
    type: 'task',
    title: '',
    subjectId: '',
    topic: '',
    time,
    endTime: addHour(time),
    priority: 'medium',
  };
}

export default function PlanScreen({ navigation }) {
  const { theme } = useTheme();
  const { currentUser } = useUser();
  const styles = getStyles(theme);
  const [workspace, setWorkspace] = useState({ tasks: [], studyPlans: [], subjects: [] });
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [filter, setFilter] = useState('agenda');
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => initialForm(localDateKey()));

  const load = useCallback(async () => {
    try {
      const data = await loadPlanWorkspace(currentUser);
      setWorkspace(data);
    } catch (error) {
      console.error('Unable to load Plan workspace:', error);
      Alert.alert('Plan unavailable', 'Your local planning data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const days = useMemo(() => {
    const start = new Date();
    return Array.from({ length: 7 }, (_, index) => formatShortDay(addDays(start, index)));
  }, []);

  const items = useMemo(() => {
    const tasks = workspace.tasks
      .filter((task) => task.date === selectedDate)
      .map((task) => ({ ...task, sourceType: 'task' }));
    const study = workspace.studyPlans
      .filter((session) => session.date === selectedDate)
      .map((session) => ({ ...session, sourceType: 'study' }));

    const combined = filter === 'tasks' ? tasks : filter === 'study' ? study : [...tasks, ...study];
    return combined.sort((a, b) => {
      if (!a.time && !a.startTime) return 1;
      if (!b.time && !b.startTime) return -1;
      return (a.time || a.startTime || '').localeCompare(b.time || b.startTime || '');
    });
  }, [workspace, selectedDate, filter]);

  const summary = useMemo(() => {
    const dayTasks = workspace.tasks.filter((task) => task.date === selectedDate);
    const dayStudy = workspace.studyPlans.filter((session) => session.date === selectedDate);
    return {
      count: dayTasks.length + dayStudy.length,
      studyMinutes: dayStudy.reduce((total, item) => total + Number(item.plannedDuration || 0), 0),
      overdue: dayTasks.filter((item) => isOverdue(item, selectedDate)).length,
    };
  }, [workspace, selectedDate]);

  const openCreate = (type = 'task') => {
    setForm({ ...initialForm(selectedDate), type });
    setModalVisible(true);
  };

  const closeModal = () => {
    if (!saving) setModalVisible(false);
  };

  const save = async () => {
    if (!isValidTime(form.time) || !isValidTime(form.endTime)) {
      Alert.alert('Check the time', 'Use 24-hour time in HH:MM format, for example 18:30.');
      return;
    }
    if (minutesBetween(form.time, form.endTime) <= 0) {
      Alert.alert('Check the time', 'End time must be later than start time.');
      return;
    }
    if (form.type === 'study' && !form.subjectId) {
      Alert.alert('Choose a subject', 'Create or select a subject before scheduling study time.');
      return;
    }
    if (form.type !== 'study' && !form.title.trim()) {
      Alert.alert('Add a title', 'Give this item a short, useful title.');
      return;
    }

    try {
      setSaving(true);
      if (form.type === 'study') {
        await saveStudyPlan(currentUser, {
          date: selectedDate,
          subjectId: form.subjectId,
          topic: form.topic,
          startTime: form.time,
          endTime: form.endTime,
          plannedDuration: minutesBetween(form.time, form.endTime),
        });
      } else {
        await savePlanTask(currentUser, {
          title: form.title,
          date: selectedDate,
          time: form.time,
          endTime: form.endTime,
          itemType: form.type,
          category: form.type === 'assignment' ? 'Assignments' : 'Study',
          priority: form.priority,
        });
      }
      setModalVisible(false);
      await load();
    } catch (error) {
      console.error('Unable to save Plan item:', error);
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (item) => {
    try {
      await togglePlanTask(currentUser, item.id);
      await load();
    } catch (error) {
      Alert.alert('Could not update task', 'Please try again.');
    }
  };

  const removeItem = (item) => {
    Alert.alert(
      'Remove from plan?',
      item.sourceType === 'study'
        ? 'This removes the planned study session. Completed study history is not affected.'
        : 'This removes the task from your plan.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.sourceType === 'study') await deleteStudyPlan(currentUser, item.id);
              else await deletePlanTask(currentUser, item.id);
              await load();
            } catch (error) {
              Alert.alert('Could not remove item', 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const startStudy = (item) => {
    navigation.navigate('Tracker', {
      plannedSessionId: item.id,
      subjectId: item.subjectId,
      topic: item.topic || null,
    });
  };

  return (
    <ScreenLayout
      scrollable
      showHeader={false}
      horizontalPadding={false}
      verticalPadding={false}
      contentContainerStyle={styles.screenContent}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PLAN</Text>
          <Text style={styles.title}>Shape your study week</Text>
          <Text style={styles.subtitle}>Tasks and study blocks now live in one agenda.</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => openCreate()} accessibilityLabel="Add plan item">
          <Ionicons name="add" size={24} color={theme.colors.primaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
        {days.map((day) => {
          const active = day.key === selectedDate;
          return (
            <TouchableOpacity
              key={day.key}
              style={[styles.dayButton, active && styles.dayButtonActive]}
              onPress={() => setSelectedDate(day.key)}
            >
              <Text style={[styles.dayName, active && styles.dayNameActive]}>{day.day}</Text>
              <Text style={[styles.dayNumber, active && styles.dayNumberActive]}>{day.number}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.summaryCard}>
        <View style={styles.summaryLead}>
          <Text style={styles.summaryDate}>{formatDateHeading(selectedDate)}</Text>
          <Text style={styles.summaryText}>
            {summary.count === 0 ? 'Nothing scheduled yet' : `${summary.count} planned item${summary.count === 1 ? '' : 's'}`}
          </Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryValue}>{summary.studyMinutes}</Text>
          <Text style={styles.summaryLabel}>study min</Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={[styles.summaryValue, summary.overdue > 0 && styles.overdueValue]}>{summary.overdue}</Text>
          <Text style={styles.summaryLabel}>overdue</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(item.id)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>Building your agenda…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-clear-outline" size={25} color={theme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>This day has room</Text>
          <Text style={styles.emptyBody}>Add a task, assignment or focused study block. Keep the plan realistic.</Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity style={styles.emptyAction} onPress={() => openCreate('study')}>
              <Ionicons name="timer-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.emptyActionText}>Study block</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emptyAction} onPress={() => openCreate('task')}>
              <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.emptyActionText}>Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.agendaList}>
          {items.map((item) => {
            const study = item.sourceType === 'study';
            const assignment = item.itemType === 'assignment';
            const overdue = isOverdue(item, selectedDate);
            const start = item.time || item.startTime || 'Anytime';
            const end = item.endTime || null;
            return (
              <View key={`${item.sourceType}-${item.id}`} style={styles.agendaCard}>
                <View style={styles.timeColumn}>
                  <Text style={styles.time}>{start}</Text>
                  {end ? <Text style={styles.endTime}>{end}</Text> : null}
                </View>

                <View style={[
                  styles.typeRail,
                  study && { backgroundColor: theme.colors.primary },
                  assignment && { backgroundColor: theme.colors.warning },
                  overdue && { backgroundColor: theme.colors.error },
                ]} />

                <View style={styles.itemBody}>
                  <View style={styles.itemTopRow}>
                    <Text style={[styles.itemTitle, !study && item.completed && styles.completedText]} numberOfLines={2}>
                      {study ? item.subjectName : item.title}
                    </Text>
                    <TouchableOpacity onPress={() => removeItem(item)} style={styles.moreButton} accessibilityLabel="Remove plan item">
                      <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.typeBadge}>
                      <Ionicons
                        name={study ? 'timer-outline' : assignment ? 'document-text-outline' : 'checkmark-circle-outline'}
                        size={14}
                        color={study ? theme.colors.primary : assignment ? theme.colors.warning : theme.colors.textSecondary}
                      />
                      <Text style={styles.typeBadgeText}>{study ? 'Study' : assignment ? 'Assignment' : 'Task'}</Text>
                    </View>
                    {overdue ? <Text style={styles.overdueText}>Overdue</Text> : null}
                  </View>

                  {study ? (
                    <>
                      <Text style={styles.itemMeta}>
                        {item.topic || 'General study'} · {item.plannedDuration || minutesBetween(item.startTime, item.endTime)} min
                      </Text>
                      <TouchableOpacity style={styles.startButton} onPress={() => startStudy(item)}>
                        <Ionicons name="play" size={15} color={theme.colors.primaryText} />
                        <Text style={styles.startButtonText}>Start in Focus</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity style={styles.completeRow} onPress={() => toggleTask(item)}>
                      <Ionicons
                        name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={item.completed ? theme.colors.success : theme.colors.textMuted}
                      />
                      <Text style={styles.completeText}>{item.completed ? 'Completed' : 'Mark complete'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>ADD TO PLAN</Text>
                <Text style={styles.modalTitle}>{formatDateHeading(selectedDate)}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                <Ionicons name="close" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.typePicker}>
                {TYPES.map((type) => {
                  const active = form.type === type.id;
                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.typeOption, active && styles.typeOptionActive]}
                      onPress={() => setForm((current) => ({ ...current, type: type.id }))}
                    >
                      <Ionicons name={type.icon} size={18} color={active ? theme.colors.primary : theme.colors.textSecondary} />
                      <Text style={[styles.typeOptionText, active && styles.typeOptionTextActive]}>{type.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {form.type === 'study' ? (
                <>
                  <Text style={styles.fieldLabel}>Subject</Text>
                  {workspace.subjects.length === 0 ? (
                    <TouchableOpacity
                      style={styles.noSubjectCard}
                      onPress={() => {
                        setModalVisible(false);
                        navigation.navigate('Tracker');
                      }}
                    >
                      <Ionicons name="book-outline" size={20} color={theme.colors.primary} />
                      <View style={styles.noSubjectCopy}>
                        <Text style={styles.noSubjectTitle}>Create a subject first</Text>
                        <Text style={styles.noSubjectBody}>Subjects still live in Focus while we migrate that workflow.</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectRow}>
                      {workspace.subjects.map((subject) => {
                        const active = form.subjectId === subject.id;
                        return (
                          <TouchableOpacity
                            key={subject.id}
                            style={[styles.subjectChip, active && styles.subjectChipActive]}
                            onPress={() => setForm((current) => ({ ...current, subjectId: subject.id }))}
                          >
                            <Text style={[styles.subjectText, active && styles.subjectTextActive]}>{subject.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}

                  <Text style={styles.fieldLabel}>Topic</Text>
                  <TextInput
                    style={styles.input}
                    value={form.topic}
                    onChangeText={(topic) => setForm((current) => ({ ...current, topic }))}
                    placeholder="e.g. Database normalization"
                    placeholderTextColor={theme.colors.placeholder}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>{form.type === 'assignment' ? 'Assignment' : 'Task'}</Text>
                  <TextInput
                    style={styles.input}
                    value={form.title}
                    onChangeText={(title) => setForm((current) => ({ ...current, title }))}
                    placeholder={form.type === 'assignment' ? 'e.g. Submit database project' : 'e.g. Review lecture notes'}
                    placeholderTextColor={theme.colors.placeholder}
                  />
                </>
              )}

              <Text style={styles.fieldLabel}>Time block</Text>
              <View style={styles.timeInputs}>
                <View style={styles.timeField}>
                  <Text style={styles.timeFieldLabel}>Start</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={form.time}
                    onChangeText={(time) => setForm((current) => ({ ...current, time }))}
                    placeholder="09:00"
                    placeholderTextColor={theme.colors.placeholder}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <Ionicons name="arrow-forward" size={18} color={theme.colors.textMuted} />
                <View style={styles.timeField}>
                  <Text style={styles.timeFieldLabel}>End</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={form.endTime}
                    onChangeText={(endTime) => setForm((current) => ({ ...current, endTime }))}
                    placeholder="10:00"
                    placeholderTextColor={theme.colors.placeholder}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              {form.type !== 'study' ? (
                <>
                  <Text style={styles.fieldLabel}>Priority</Text>
                  <View style={styles.priorityRow}>
                    {['low', 'medium', 'high'].map((priority) => {
                      const active = form.priority === priority;
                      return (
                        <TouchableOpacity
                          key={priority}
                          style={[styles.priorityChip, active && styles.priorityChipActive]}
                          onPress={() => setForm((current) => ({ ...current, priority }))}
                        >
                          <Text style={[styles.priorityText, active && styles.priorityTextActive]}>
                            {priority[0].toUpperCase() + priority.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={theme.colors.primaryText} /> : <Ionicons name="add" size={19} color={theme.colors.primaryText} />}
                <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Add to plan'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const getStyles = (theme) => StyleSheet.create({
  screenContent: { paddingBottom: spacing.xxxl },
  header: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: { fontFamily: typography.semibold, fontSize: 12, letterSpacing: 1.3, color: theme.colors.primary, marginBottom: spacing.xxs },
  title: { fontFamily: typography.bold, fontSize: typography.sizes.display, lineHeight: typography.lineHeights.display, color: theme.colors.text },
  subtitle: { fontFamily: typography.regular, fontSize: typography.sizes.bodySmall, color: theme.colors.textSecondary, marginTop: spacing.xs, maxWidth: 290 },
  addButton: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  dayStrip: { paddingHorizontal: layout.screenPadding, gap: spacing.xs, paddingBottom: spacing.lg },
  dayButton: { width: 56, minHeight: 68, borderRadius: radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  dayButtonActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dayName: { fontFamily: typography.semibold, fontSize: 11, color: theme.colors.textSecondary, textTransform: 'uppercase' },
  dayNameActive: { color: theme.colors.primaryText },
  dayNumber: { fontFamily: typography.bold, fontSize: 20, color: theme.colors.text, marginTop: 2 },
  dayNumberActive: { color: theme.colors.primaryText },
  summaryCard: { marginHorizontal: layout.screenPadding, backgroundColor: theme.colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', ...shadow.card },
  summaryLead: { flex: 1 },
  summaryDate: { fontFamily: typography.semibold, fontSize: typography.sizes.body, color: theme.colors.text },
  summaryText: { fontFamily: typography.regular, fontSize: typography.sizes.caption, color: theme.colors.textSecondary, marginTop: 2 },
  summaryMetric: { alignItems: 'flex-end', marginLeft: spacing.lg },
  summaryValue: { fontFamily: typography.bold, fontSize: 18, color: theme.colors.text },
  overdueValue: { color: theme.colors.error },
  summaryLabel: { fontFamily: typography.regular, fontSize: 10, color: theme.colors.textMuted },
  filterRow: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: layout.screenPadding, paddingVertical: spacing.lg },
  filterChip: { paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceMuted },
  filterChipActive: { backgroundColor: theme.colors.primarySoft },
  filterText: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.textSecondary },
  filterTextActive: { color: theme.colors.primary },
  loadingCard: { marginHorizontal: layout.screenPadding, padding: spacing.xxl, alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: radius.lg, gap: spacing.sm },
  loadingText: { fontFamily: typography.regular, color: theme.colors.textSecondary },
  emptyCard: { marginHorizontal: layout.screenPadding, padding: spacing.xl, backgroundColor: theme.colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  emptyIcon: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { fontFamily: typography.semibold, fontSize: typography.sizes.titleSmall, color: theme.colors.text },
  emptyBody: { fontFamily: typography.regular, fontSize: typography.sizes.bodySmall, color: theme.colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, maxWidth: 300 },
  emptyActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  emptyAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: theme.colors.primarySoft, paddingHorizontal: spacing.md, minHeight: 42 },
  emptyActionText: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.primary },
  agendaList: { paddingHorizontal: layout.screenPadding, gap: spacing.sm },
  agendaCard: { minHeight: 126, backgroundColor: theme.colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: spacing.md, flexDirection: 'row', ...shadow.card },
  timeColumn: { width: 58, paddingTop: 2 },
  time: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.text },
  endTime: { fontFamily: typography.regular, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  typeRail: { width: 3, borderRadius: radius.pill, backgroundColor: theme.colors.textMuted, marginRight: spacing.md },
  itemBody: { flex: 1 },
  itemTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemTitle: { flex: 1, fontFamily: typography.semibold, fontSize: 16, lineHeight: 22, color: theme.colors.text },
  completedText: { color: theme.colors.textMuted, textDecorationLine: 'line-through' },
  moreButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginTop: -6, marginRight: -6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeBadgeText: { fontFamily: typography.regular, fontSize: 12, color: theme.colors.textSecondary },
  overdueText: { fontFamily: typography.semibold, fontSize: 11, color: theme.colors.error },
  itemMeta: { fontFamily: typography.regular, fontSize: 12, color: theme.colors.textSecondary, marginTop: spacing.xs },
  startButton: { alignSelf: 'flex-start', marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 36 },
  startButtonText: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.primaryText },
  completeRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, minHeight: 34 },
  completeText: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '88%', backgroundColor: theme.colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: layout.screenPadding, paddingBottom: spacing.xxxl },
  modalHandle: { width: 42, height: 5, borderRadius: radius.pill, backgroundColor: theme.colors.border, alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalEyebrow: { fontFamily: typography.semibold, fontSize: 11, letterSpacing: 1.2, color: theme.colors.primary },
  modalTitle: { fontFamily: typography.bold, fontSize: typography.sizes.title, color: theme.colors.text, marginTop: 2 },
  closeButton: { width: 42, height: 42, borderRadius: radius.pill, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  typePicker: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  typeOption: { flex: 1, minHeight: 62, borderRadius: radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', gap: 4 },
  typeOptionActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  typeOptionText: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.textSecondary },
  typeOptionTextActive: { color: theme.colors.primary },
  fieldLabel: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.text, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { minHeight: 50, borderRadius: radius.md, backgroundColor: theme.colors.input, paddingHorizontal: spacing.md, fontFamily: typography.regular, fontSize: 15, color: theme.colors.inputText },
  subjectRow: { gap: spacing.xs, paddingBottom: spacing.xs },
  subjectChip: { minHeight: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  subjectChipActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  subjectText: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.textSecondary },
  subjectTextActive: { color: theme.colors.primary },
  noSubjectCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: theme.colors.primarySoft, padding: spacing.md },
  noSubjectCopy: { flex: 1 },
  noSubjectTitle: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.text },
  noSubjectBody: { fontFamily: typography.regular, fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  timeInputs: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timeField: { flex: 1 },
  timeFieldLabel: { fontFamily: typography.regular, fontSize: 11, color: theme.colors.textMuted, marginBottom: 5 },
  timeInput: { minHeight: 50, borderRadius: radius.md, backgroundColor: theme.colors.input, paddingHorizontal: spacing.md, fontFamily: typography.semibold, fontSize: 15, color: theme.colors.inputText },
  priorityRow: { flexDirection: 'row', gap: spacing.xs },
  priorityChip: { flex: 1, minHeight: 40, borderRadius: radius.pill, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  priorityChipActive: { backgroundColor: theme.colors.primarySoft },
  priorityText: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.textSecondary },
  priorityTextActive: { color: theme.colors.primary },
  saveButton: { marginTop: spacing.xl, minHeight: 52, borderRadius: radius.md, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: { fontFamily: typography.semibold, fontSize: 15, color: theme.colors.primaryText },
});
