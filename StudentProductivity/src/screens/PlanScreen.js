import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
import { radius, shadow, spacing, typography } from '../theme/designSystem';

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

function shortDay(date) {
  return {
    key: localDateKey(date),
    day: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date),
    number: date.getDate(),
  };
}

function timeToDate(value, fallbackHour = 9) {
  const date = new Date();
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || '');
  if (match) {
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  } else {
    date.setHours(fallbackHour, 0, 0, 0);
  }
  return date;
}

function dateToTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function defaultTimes(dateKey) {
  const now = new Date();
  const start = new Date();
  if (dateKey === localDateKey()) {
    start.setHours(Math.min(22, now.getHours() + 1), 0, 0, 0);
  } else {
    start.setHours(9, 0, 0, 0);
  }
  const end = new Date(start);
  end.setHours(Math.min(23, start.getHours() + 1));
  return { startTime: dateToTime(start), endTime: dateToTime(end) };
}

function minutesBetween(start, end) {
  const startDate = timeToDate(start);
  const endDate = timeToDate(end);
  return Math.round((endDate.getTime() - startDate.getTime()) / 60000);
}

function itemStart(item) {
  return item.time || item.startTime || '';
}

function isOverdue(item, selectedDate) {
  if (item.completed || selectedDate !== localDateKey() || !itemStart(item)) return false;
  const [hour, minute] = itemStart(item).split(':').map(Number);
  const now = new Date();
  return hour * 60 + minute < now.getHours() * 60 + now.getMinutes();
}

function newForm(dateKey, type = 'task') {
  const times = defaultTimes(dateKey);
  return {
    id: null,
    sourceType: type === 'study' ? 'study' : 'task',
    type,
    title: '',
    subjectId: '',
    topic: '',
    startTime: times.startTime,
    endTime: times.endTime,
    priority: 'medium',
  };
}

function formFromItem(item) {
  const study = item.sourceType === 'study';
  return {
    id: item.id,
    sourceType: item.sourceType,
    type: study ? 'study' : item.itemType || 'task',
    title: study ? '' : item.title || '',
    subjectId: study ? item.subjectId || '' : '',
    topic: study ? item.topic || '' : '',
    startTime: itemStart(item) || '09:00',
    endTime: item.endTime || '10:00',
    priority: item.priority || 'medium',
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
  const [form, setForm] = useState(() => newForm(localDateKey()));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      setWorkspace(await loadPlanWorkspace(currentUser));
    } catch (error) {
      console.error('Unable to load Plan workspace:', error);
      Alert.alert('Plan unavailable', 'Your planning data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.email]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const days = useMemo(() => {
    const start = new Date();
    return Array.from({ length: 14 }, (_, index) => shortDay(addDays(start, index)));
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
      const aTime = itemStart(a);
      const bTime = itemStart(b);
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      return aTime.localeCompare(bTime);
    });
  }, [workspace, selectedDate, filter]);

  const summary = useMemo(() => {
    const dayTasks = workspace.tasks.filter((task) => task.date === selectedDate);
    const dayStudy = workspace.studyPlans.filter((session) => session.date === selectedDate);
    return {
      total: dayTasks.length + dayStudy.length,
      studyMinutes: dayStudy.reduce((total, item) => total + Number(item.plannedDuration || 0), 0),
      completed: dayTasks.filter((task) => task.completed).length,
      overdue: dayTasks.filter((task) => isOverdue(task, selectedDate)).length,
    };
  }, [workspace, selectedDate]);

  const openCreate = (type = 'task') => {
    setForm(newForm(selectedDate, type));
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setForm(formFromItem(item));
    setModalVisible(true);
  };

  const save = async () => {
    const duration = minutesBetween(form.startTime, form.endTime);
    if (duration <= 0) {
      Alert.alert('Check the time', 'End time must be later than start time.');
      return;
    }
    if (form.type === 'study' && !form.subjectId) {
      Alert.alert('Choose a subject', 'Select what this study block is for.');
      return;
    }
    if (form.type !== 'study' && !form.title.trim()) {
      Alert.alert('Add a title', 'Give this item a clear title.');
      return;
    }

    setSaving(true);
    try {
      if (form.type === 'study') {
        await saveStudyPlan(currentUser, {
          id: form.id,
          date: selectedDate,
          subjectId: form.subjectId,
          topic: form.topic,
          startTime: form.startTime,
          endTime: form.endTime,
          plannedDuration: duration,
        });
      } else {
        await savePlanTask(currentUser, {
          id: form.id,
          title: form.title,
          date: selectedDate,
          time: form.startTime,
          endTime: form.endTime,
          itemType: form.type,
          category: form.type === 'assignment' ? 'Assignments' : 'Study',
          priority: form.priority,
        });
      }
      setModalVisible(false);
      await load();
    } catch (error) {
      console.error('Unable to save plan item:', error);
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
        ? 'This removes the planned study block. Completed study history stays intact.'
        : 'This removes the task from your plan.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (item.sourceType === 'study') await deleteStudyPlan(currentUser, item.id);
            else await deletePlanTask(currentUser, item.id);
            setModalVisible(false);
            await load();
          },
        },
      ],
    );
  };

  const startStudy = (item) => {
    navigation.navigate('Tracker', {
      plannedSessionId: item.id,
      subjectId: item.subjectId,
      topic: item.topic || null,
    });
  };

  const selectedSubject = workspace.subjects.find((subject) => subject.id === form.subjectId);

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
            <Text style={styles.eyebrow}>PLAN</Text>
            <Text style={styles.title}>Shape your study week</Text>
            <Text style={styles.subtitle}>Put study, assignments and tasks into one realistic agenda.</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => openCreate('task')}>
            <Ionicons name="add" size={22} color={theme.colors.primaryText} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
          {days.map((day) => {
            const selected = day.key === selectedDate;
            return (
              <TouchableOpacity
                key={day.key}
                style={[styles.dateChip, selected && styles.dateChipSelected]}
                onPress={() => setSelectedDate(day.key)}
              >
                <Text style={[styles.dateDay, selected && styles.dateDaySelected]}>{day.day}</Text>
                <Text style={[styles.dateNumber, selected && styles.dateNumberSelected]}>{day.number}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.dayCard}>
          <View style={styles.dayCardTop}>
            <View>
              <Text style={styles.dayEyebrow}>{formatDateHeading(selectedDate).toUpperCase()}</Text>
              <Text style={styles.dayTitle}>{summary.total} planned item{summary.total === 1 ? '' : 's'}</Text>
            </View>
            <View style={styles.dayBadge}>
              <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.dayBadgeText}>{summary.studyMinutes}m study</Text>
            </View>
          </View>

          <View style={styles.dayStats}>
            <MiniStat label="Completed" value={summary.completed} styles={styles} />
            <MiniStat label="Study" value={`${summary.studyMinutes}m`} styles={styles} />
            <MiniStat label="Overdue" value={summary.overdue} danger={summary.overdue > 0} styles={styles} />
          </View>

          <View style={styles.quickAddRow}>
            {TYPES.map((type) => (
              <TouchableOpacity key={type.id} style={styles.quickAdd} onPress={() => openCreate(type.id)}>
                <Ionicons name={type.icon} size={17} color={theme.colors.primary} />
                <Text style={styles.quickAddText}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((item) => {
            const selected = filter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
                onPress={() => setFilter(item.id)}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Agenda</Text>
            <Text style={styles.sectionSubtitle}>Tap an item to edit it.</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading your plan…</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="calendar-clear-outline" size={24} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Nothing planned here</Text>
            <Text style={styles.emptyText}>Add a study block, task or assignment and give this day some structure.</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => openCreate('study')}>
              <Text style={styles.emptyButtonText}>Plan study time</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.agendaCard}>
            {items.map((item, index) => {
              const study = item.sourceType === 'study';
              const overdue = isOverdue(item, selectedDate);
              const completed = Boolean(item.completed);
              return (
                <TouchableOpacity
                  key={`${item.sourceType}-${item.id}`}
                  style={[styles.agendaRow, index < items.length - 1 && styles.agendaDivider]}
                  onPress={() => openEdit(item)}
                >
                  <View style={styles.timeColumn}>
                    <Text style={[styles.timeText, overdue && styles.overdueText, completed && styles.completedText]}>{itemStart(item) || 'Any'}</Text>
                    <Text style={styles.timeEnd}>{item.endTime || (item.plannedDuration ? `${item.plannedDuration}m` : '')}</Text>
                  </View>

                  {study ? (
                    <View style={[styles.itemIcon, { backgroundColor: theme.colors.primarySoft }]}>
                      <Ionicons name="timer-outline" size={18} color={theme.colors.primary} />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.itemIcon, { backgroundColor: completed ? theme.colors.accentSoft : theme.colors.surfaceMuted }]}
                      onPress={(event) => {
                        event.stopPropagation?.();
                        toggleTask(item);
                      }}
                    >
                      <Ionicons
                        name={completed ? 'checkmark-circle' : item.itemType === 'assignment' ? 'document-text-outline' : 'ellipse-outline'}
                        size={19}
                        color={completed ? theme.colors.accent : theme.colors.textSecondary}
                      />
                    </TouchableOpacity>
                  )}

                  <View style={styles.itemCopy}>
                    <Text style={[styles.itemTitle, completed && styles.completedTitle]} numberOfLines={1}>
                      {study ? item.subjectName : item.title}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.itemMeta} numberOfLines={1}>
                        {study ? (item.topic || 'Study session') : (item.itemType === 'assignment' ? 'Assignment' : item.category || 'Task')}
                      </Text>
                      {overdue ? <Text style={styles.overdueBadge}>Missed</Text> : null}
                    </View>
                  </View>

                  {study ? (
                    <TouchableOpacity
                      style={styles.playButton}
                      onPress={(event) => {
                        event.stopPropagation?.();
                        startStudy(item);
                      }}
                    >
                      <Ionicons name="play" size={16} color={theme.colors.primaryText} />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="chevron-forward" size={17} color={theme.colors.textMuted} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScreenLayout>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => !saving && setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{form.id ? 'Edit plan item' : 'Add to plan'}</Text>
                <Text style={styles.modalSubtitle}>{formatDateHeading(selectedDate)}</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setModalVisible(false)} disabled={saving}>
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeRow}>
                {TYPES.map((type) => {
                  const selected = form.type === type.id;
                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.typeChip, selected && styles.typeChipSelected]}
                      onPress={() => {
                        if (form.id && form.sourceType === 'study' && type.id !== 'study') return;
                        if (form.id && form.sourceType === 'task' && type.id === 'study') return;
                        setForm((current) => ({ ...current, type: type.id }));
                      }}
                    >
                      <Ionicons name={type.icon} size={16} color={selected ? theme.colors.primaryText : theme.colors.textSecondary} />
                      <Text style={[styles.typeText, selected && styles.typeTextSelected]}>{type.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {form.type === 'study' ? (
                <>
                  <Text style={styles.inputLabel}>Subject</Text>
                  {workspace.subjects.length === 0 ? (
                    <TouchableOpacity style={styles.noSubjectCard} onPress={() => {
                      setModalVisible(false);
                      navigation.navigate('Tracker');
                    }}>
                      <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.noSubjectTitle}>Create a subject in Focus</Text>
                        <Text style={styles.noSubjectText}>Study blocks need a subject so sessions stay connected.</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectRow}>
                      {workspace.subjects.map((subject) => {
                        const selected = form.subjectId === subject.id;
                        return (
                          <TouchableOpacity
                            key={subject.id}
                            style={[styles.subjectChip, selected && styles.subjectChipSelected]}
                            onPress={() => setForm((current) => ({ ...current, subjectId: subject.id, topic: '' }))}
                          >
                            <Text style={[styles.subjectText, selected && styles.subjectTextSelected]}>{subject.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}

                  {selectedSubject?.topics?.length > 0 ? (
                    <>
                      <Text style={styles.inputLabel}>Topic</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectRow}>
                        <TouchableOpacity
                          style={[styles.subjectChip, !form.topic && styles.subjectChipSelected]}
                          onPress={() => setForm((current) => ({ ...current, topic: '' }))}
                        >
                          <Text style={[styles.subjectText, !form.topic && styles.subjectTextSelected]}>General</Text>
                        </TouchableOpacity>
                        {selectedSubject.topics.map((topic) => {
                          const topicName = typeof topic === 'string' ? topic : topic.name;
                          const selected = form.topic === topicName;
                          return (
                            <TouchableOpacity
                              key={topicName}
                              style={[styles.subjectChip, selected && styles.subjectChipSelected]}
                              onPress={() => setForm((current) => ({ ...current, topic: topicName }))}
                            >
                              <Text style={[styles.subjectText, selected && styles.subjectTextSelected]}>{topicName}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </>
                  ) : (
                    <>
                      <Text style={styles.inputLabel}>Topic (optional)</Text>
                      <TextInput
                        style={styles.input}
                        value={form.topic}
                        onChangeText={(topic) => setForm((current) => ({ ...current, topic }))}
                        placeholder="What will you study?"
                        placeholderTextColor={theme.colors.placeholder}
                      />
                    </>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>{form.type === 'assignment' ? 'Assignment' : 'Task'} title</Text>
                  <TextInput
                    style={styles.input}
                    value={form.title}
                    onChangeText={(title) => setForm((current) => ({ ...current, title }))}
                    placeholder={form.type === 'assignment' ? 'e.g. Submit database assignment' : 'e.g. Revise chapter 4'}
                    placeholderTextColor={theme.colors.placeholder}
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Time</Text>
              <View style={styles.timePickerRow}>
                <TouchableOpacity style={styles.timePickerButton} onPress={() => setShowStartPicker(true)}>
                  <Text style={styles.timePickerLabel}>Starts</Text>
                  <Text style={styles.timePickerValue}>{form.startTime}</Text>
                </TouchableOpacity>
                <Ionicons name="arrow-forward" size={17} color={theme.colors.textMuted} />
                <TouchableOpacity style={styles.timePickerButton} onPress={() => setShowEndPicker(true)}>
                  <Text style={styles.timePickerLabel}>Ends</Text>
                  <Text style={styles.timePickerValue}>{form.endTime}</Text>
                </TouchableOpacity>
              </View>

              {form.type !== 'study' ? (
                <>
                  <Text style={styles.inputLabel}>Priority</Text>
                  <View style={styles.priorityRow}>
                    {['low', 'medium', 'high'].map((priority) => {
                      const selected = form.priority === priority;
                      return (
                        <TouchableOpacity
                          key={priority}
                          style={[styles.priorityChip, selected && styles.priorityChipSelected]}
                          onPress={() => setForm((current) => ({ ...current, priority }))}
                        >
                          <Text style={[styles.priorityText, selected && styles.priorityTextSelected]}>{priority}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <TouchableOpacity style={[styles.saveButton, saving && styles.disabledButton]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={theme.colors.primaryText} /> : <Ionicons name="checkmark" size={19} color={theme.colors.primaryText} />}
                <Text style={styles.saveButtonText}>{saving ? 'Saving…' : form.id ? 'Save changes' : 'Add to plan'}</Text>
              </TouchableOpacity>

              {form.id ? (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    const existing = items.find((item) => item.id === form.id && item.sourceType === form.sourceType);
                    if (existing) removeItem(existing);
                  }}
                  disabled={saving}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                  <Text style={styles.deleteText}>Remove from plan</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showStartPicker ? (
        <DateTimePicker
          value={timeToDate(form.startTime)}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, value) => {
            if (Platform.OS !== 'ios') setShowStartPicker(false);
            if (value) setForm((current) => ({ ...current, startTime: dateToTime(value) }));
          }}
        />
      ) : null}

      {showEndPicker ? (
        <DateTimePicker
          value={timeToDate(form.endTime, 10)}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, value) => {
            if (Platform.OS !== 'ios') setShowEndPicker(false);
            if (value) setForm((current) => ({ ...current, endTime: dateToTime(value) }));
          }}
        />
      ) : null}
    </>
  );
}

function MiniStat({ label, value, danger, styles }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatValue, danger && styles.miniStatDanger]}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
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
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    ...shadow.card,
  },
  dateStrip: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  dateChip: {
    width: 58,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dateDay: {
    fontFamily: typography.semibold,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  dateDaySelected: { color: 'rgba(255,255,255,0.78)' },
  dateNumber: {
    fontFamily: typography.bold,
    fontSize: 19,
    color: theme.colors.text,
    marginTop: 3,
  },
  dateNumberSelected: { color: theme.colors.primaryText },
  dayCard: {
    borderRadius: 26,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  dayCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dayEyebrow: {
    fontFamily: typography.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: theme.colors.primary,
  },
  dayTitle: {
    fontFamily: typography.bold,
    fontSize: 20,
    color: theme.colors.text,
    marginTop: 3,
  },
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  dayBadgeText: {
    fontFamily: typography.semibold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  dayStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  miniStat: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceMuted,
    padding: spacing.sm,
  },
  miniStatValue: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: theme.colors.text,
  },
  miniStatDanger: { color: theme.colors.error },
  miniStatLabel: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  quickAdd: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 14,
    backgroundColor: theme.colors.primarySoft,
  },
  quickAddText: {
    fontFamily: typography.semibold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  filterChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipSelected: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  filterText: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  filterTextSelected: { color: theme.colors.textInverse },
  sectionHeader: { marginBottom: spacing.sm },
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
  loadingCard: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
  },
  loadingText: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 28,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  emptyTitle: {
    fontFamily: typography.semibold,
    fontSize: 16,
    color: theme.colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    maxWidth: 290,
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyButton: {
    marginTop: spacing.lg,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: theme.colors.primarySoft,
  },
  emptyButtonText: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  agendaCard: {
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  agendaRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  agendaDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
  },
  timeColumn: { width: 48 },
  timeText: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.text,
  },
  timeEnd: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  overdueText: { color: theme.colors.error },
  completedText: { color: theme.colors.textMuted },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCopy: { flex: 1 },
  itemTitle: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: theme.colors.text,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: theme.colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  itemMeta: {
    flexShrink: 1,
    fontFamily: typography.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  overdueBadge: {
    fontFamily: typography.semibold,
    fontSize: 10,
    color: theme.colors.error,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  modalCard: {
    maxHeight: '88%',
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
  inputLabel: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: spacing.xs,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  typeChip: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  typeChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  typeText: {
    fontFamily: typography.semibold,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  typeTextSelected: { color: theme.colors.primaryText },
  input: {
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
  noSubjectCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: theme.colors.primarySoft,
    marginBottom: spacing.lg,
  },
  noSubjectTitle: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
  },
  noSubjectText: {
    fontFamily: typography.regular,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  subjectRow: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  subjectChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subjectChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  subjectText: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  subjectTextSelected: { color: theme.colors.primaryText },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  timePickerButton: {
    flex: 1,
    minHeight: 64,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: theme.colors.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timePickerLabel: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  timePickerValue: {
    fontFamily: typography.semibold,
    fontSize: 18,
    color: theme.colors.text,
    marginTop: 2,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  priorityChip: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  priorityChipSelected: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.text,
  },
  priorityText: {
    fontFamily: typography.semibold,
    fontSize: 11,
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
  priorityTextSelected: { color: theme.colors.text },
  saveButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: theme.colors.primaryText,
  },
  disabledButton: { opacity: 0.55 },
  deleteButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  deleteText: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.error,
  },
});
