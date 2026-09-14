import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import ScreenLayout from '../components/ScreenLayout';
import {
  AppIcon,
  Card,
  IconButton,
  PrimaryButton,
  ScreenIntro,
  SectionHeader,
  SecondaryButton,
} from '../components/ui';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import {
  addSubjectTopic,
  createSubject,
  loadFocusWorkspace,
  removeSubjectTopic,
  renameSubject,
  updateStudyGoal,
} from '../utils/focusRepository';
import { layout, radius, spacing, typography } from '../theme/designSystem';

function topicName(topic) {
  return typeof topic === 'string' ? topic : topic?.name;
}

function formatLastStudied(value) {
  if (!value) return 'Not studied yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not studied yet';
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(date);
}

export default function StudyManagementScreen({ navigation }) {
  const { theme } = useTheme();
  const { currentUser } = useUser();
  const styles = getStyles(theme);
  const [workspace, setWorkspace] = useState({ subjects: [], sessions: [], plannedSessions: [], goals: { dailyMinutes: 120 } });
  const [loading, setLoading] = useState(true);
  const [subjectModal, setSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [subjectName, setSubjectName] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [goalModal, setGoalModal] = useState(false);
  const [goalMinutes, setGoalMinutes] = useState('120');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadFocusWorkspace(currentUser);
      setWorkspace(data);
      setGoalMinutes(String(data.goals?.dailyMinutes || 120));
    } catch (error) {
      Alert.alert('Study settings unavailable', 'Your study structure could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.email]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNewSubject = () => {
    setEditingSubject(null);
    setSubjectName('');
    setNewTopic('');
    setSubjectModal(true);
  };

  const openSubject = (subject) => {
    setEditingSubject(subject);
    setSubjectName(subject.name || '');
    setNewTopic('');
    setSubjectModal(true);
  };

  const saveSubject = async () => {
    const name = subjectName.trim();
    if (!name) return Alert.alert('Subject name required', 'Enter a subject name.');
    setSaving(true);
    try {
      if (editingSubject) await renameSubject(currentUser, editingSubject.id, name);
      else await createSubject(currentUser, name);
      setSubjectModal(false);
      await load();
    } catch (error) {
      Alert.alert('Could not save subject', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addTopic = async () => {
    if (!editingSubject) return;
    const name = newTopic.trim();
    if (!name) return;
    setSaving(true);
    try {
      await addSubjectTopic(currentUser, editingSubject.id, name);
      setNewTopic('');
      const data = await loadFocusWorkspace(currentUser);
      setWorkspace(data);
      setEditingSubject(data.subjects.find((subject) => subject.id === editingSubject.id) || null);
    } catch (error) {
      Alert.alert('Could not add topic', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeTopic = (name) => {
    if (!editingSubject) return;
    Alert.alert('Remove topic?', `Remove “${name}” from ${editingSubject.name}? Study history will stay intact.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = await removeSubjectTopic(currentUser, editingSubject.id, name);
          setEditingSubject(updated);
          await load();
        },
      },
    ]);
  };

  const saveGoal = async () => {
    setSaving(true);
    try {
      await updateStudyGoal(currentUser, goalMinutes);
      setGoalModal(false);
      await load();
    } catch (error) {
      Alert.alert('Could not update goal', error.message || 'Enter a valid number of minutes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ScreenLayout><View style={styles.loadingState}><ActivityIndicator size="large" color={theme.colors.primary} /><Text style={styles.loadingText}>Loading study structure…</Text></View></ScreenLayout>;
  }

  return (
    <>
      <ScreenLayout scrollable horizontalPadding={false} verticalPadding={false} contentContainerStyle={styles.content} navigation={navigation}>
        <ScreenIntro
          eyebrow="Study setup"
          title="Manage your learning structure"
          subtitle="Subjects, topics and your daily goal feed Plan, Focus, Learn and Progress."
          right={<IconButton icon="close" onPress={() => navigation.goBack()} accessibilityLabel="Close" />}
        />

        <Card style={styles.goalCard} onPress={() => setGoalModal(true)}>
          <AppIcon name="flag-outline" size={22} color={theme.colors.primary} />
          <View style={styles.goalCopy}>
            <Text style={styles.goalLabel}>DAILY GOAL</Text>
            <Text style={styles.goalValue}>{workspace.goals?.dailyMinutes || 120} minutes</Text>
            <Text style={styles.goalHint}>Used by Today, Focus and Progress.</Text>
          </View>
          <AppIcon name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </Card>

        <SectionHeader
          title="Subjects"
          subtitle={`${workspace.subjects.length} subject${workspace.subjects.length === 1 ? '' : 's'} shared across the app.`}
          actionLabel="+ Subject"
          onAction={openNewSubject}
          style={styles.sectionSpace}
        />

        {workspace.subjects.length === 0 ? (
          <Card style={styles.emptyCard}>
            <AppIcon name="book-outline" size={28} color={theme.colors.primary} />
            <Text style={styles.emptyTitle}>Create your first subject</Text>
            <Text style={styles.emptyText}>Subjects become the common structure for planning, focus sessions and learning sets.</Text>
            <SecondaryButton label="Create subject" icon="add" onPress={openNewSubject} style={styles.emptyButton} />
          </Card>
        ) : (
          workspace.subjects.map((subject) => {
            const topics = Array.isArray(subject.topics) ? subject.topics : [];
            return (
              <Card key={subject.id} style={styles.subjectCard} onPress={() => openSubject(subject)}>
                <View style={styles.subjectTop}>
                  <AppIcon name="book-outline" size={22} color={theme.colors.primary} />
                  <View style={styles.subjectCopy}>
                    <Text style={styles.subjectName}>{subject.name}</Text>
                    <Text style={styles.subjectMeta}>{topics.length} topic{topics.length === 1 ? '' : 's'} · {formatLastStudied(subject.lastStudied)}</Text>
                  </View>
                  <AppIcon name="chevron-forward" size={18} color={theme.colors.textMuted} />
                </View>
                {topics.length > 0 ? (
                  <View style={styles.topicPreview}>
                    {topics.slice(0, 4).map((topic) => {
                      const name = topicName(topic);
                      return <Text key={name} style={styles.topicPreviewText}>{name}</Text>;
                    })}
                    {topics.length > 4 ? <Text style={styles.topicPreviewText}>+{topics.length - 4}</Text> : null}
                  </View>
                ) : null}
              </Card>
            );
          })
        )}

        <SectionHeader title="Recent activity" subtitle="Your latest completed focus sessions." style={styles.sectionSpace} />
        <Card style={styles.historyCard}>
          {workspace.sessions.length === 0 ? (
            <Text style={styles.historyEmpty}>No completed focus sessions yet.</Text>
          ) : (
            workspace.sessions.slice(-5).reverse().map((session, index) => {
              const subject = workspace.subjects.find((item) => item.id === session.subjectId);
              return (
                <View key={session.id} style={[styles.historyRow, index < Math.min(5, workspace.sessions.length) - 1 && styles.divider]}>
                  <AppIcon name="checkmark-circle-outline" size={19} color={theme.colors.accent} />
                  <View style={styles.historyCopy}>
                    <Text style={styles.historyTitle}>{subject?.name || 'Study session'}</Text>
                    <Text style={styles.historyMeta}>{session.topic || 'General'} · {Math.round(Number(session.duration || 0) / 60)}m</Text>
                  </View>
                  <Text style={styles.historyDate}>{session.date || ''}</Text>
                </View>
              );
            })
          )}
        </Card>
      </ScreenLayout>

      <Modal visible={subjectModal} transparent animationType="fade" onRequestClose={() => !saving && setSubjectModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>{editingSubject ? 'Edit subject' : 'New subject'}</Text>
                <Text style={styles.modalSubtitle}>{editingSubject ? 'Rename it or manage its topics.' : 'Create a shared subject for your study system.'}</Text>
              </View>
              <IconButton icon="close" onPress={() => setSubjectModal(false)} disabled={saving} accessibilityLabel="Close" />
            </View>

            <Text style={styles.fieldLabel}>Subject name</Text>
            <TextInput style={styles.input} value={subjectName} onChangeText={setSubjectName} placeholder="e.g. Database Systems" placeholderTextColor={theme.colors.placeholder} editable={!saving} />
            <PrimaryButton label={editingSubject ? 'Save subject name' : 'Create subject'} icon="checkmark" onPress={saveSubject} loading={saving} />

            {editingSubject ? (
              <>
                <Text style={styles.topicSectionTitle}>Topics</Text>
                <View style={styles.topicList}>
                  {(editingSubject.topics || []).map((topic) => {
                    const name = topicName(topic);
                    return (
                      <View key={name} style={styles.topicRow}>
                        <AppIcon name="bookmark-outline" size={18} color={theme.colors.primary} />
                        <Text style={styles.topicName}>{name}</Text>
                        <IconButton icon="close" size={17} color={theme.colors.error} onPress={() => removeTopic(name)} accessibilityLabel={`Remove ${name}`} />
                      </View>
                    );
                  })}
                </View>
                <View style={styles.addTopicRow}>
                  <TextInput style={styles.topicInput} value={newTopic} onChangeText={setNewTopic} placeholder="Add a topic" placeholderTextColor={theme.colors.placeholder} editable={!saving} onSubmitEditing={addTopic} />
                  <IconButton icon="add" color={theme.colors.primary} onPress={addTopic} disabled={saving || !newTopic.trim()} accessibilityLabel="Add topic" />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={goalModal} transparent animationType="fade" onRequestClose={() => !saving && setGoalModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}><Text style={styles.modalTitle}>Daily study goal</Text><Text style={styles.modalSubtitle}>Set the number of focused minutes you want to aim for each day.</Text></View>
              <IconButton icon="close" onPress={() => setGoalModal(false)} disabled={saving} accessibilityLabel="Close" />
            </View>
            <TextInput style={styles.goalInput} value={goalMinutes} onChangeText={setGoalMinutes} keyboardType="number-pad" placeholder="120" placeholderTextColor={theme.colors.placeholder} editable={!saving} />
            <View style={styles.goalPresets}>
              {[30, 60, 90, 120].map((minutes) => <TouchableOpacity key={minutes} style={styles.goalPreset} onPress={() => setGoalMinutes(String(minutes))}><Text style={styles.goalPresetText}>{minutes}m</Text></TouchableOpacity>)}
            </View>
            <PrimaryButton label="Save daily goal" icon="flag-outline" onPress={saveGoal} loading={saving} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const getStyles = (theme) => StyleSheet.create({
  content: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontFamily: typography.regular, fontSize: 12, color: theme.colors.textSecondary },
  goalCard: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalCopy: { flex: 1 },
  goalLabel: { fontFamily: typography.semibold, fontSize: 10, letterSpacing: 0.8, color: theme.colors.primary },
  goalValue: { fontFamily: typography.bold, fontSize: 20, color: theme.colors.text, marginTop: 2 },
  goalHint: { fontFamily: typography.regular, fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 },
  sectionSpace: { marginTop: spacing.xxl },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { fontFamily: typography.semibold, fontSize: 16, color: theme.colors.text, marginTop: spacing.md },
  emptyText: { fontFamily: typography.regular, fontSize: 11, lineHeight: 17, color: theme.colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  emptyButton: { marginTop: spacing.lg },
  subjectCard: { marginBottom: spacing.sm },
  subjectTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subjectCopy: { flex: 1 },
  subjectName: { fontFamily: typography.semibold, fontSize: 14, color: theme.colors.text },
  subjectMeta: { fontFamily: typography.regular, fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 },
  topicPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  topicPreviewText: { fontFamily: typography.regular, fontSize: 10, color: theme.colors.textSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  historyCard: { padding: 0, overflow: 'hidden' },
  historyEmpty: { fontFamily: typography.regular, fontSize: 12, color: theme.colors.textSecondary, padding: spacing.lg, textAlign: 'center' },
  historyRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.separator },
  historyCopy: { flex: 1 },
  historyTitle: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.text },
  historyMeta: { fontFamily: typography.regular, fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 },
  historyDate: { fontFamily: typography.regular, fontSize: 9, color: theme.colors.textMuted },
  modalBackdrop: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'center', padding: layout.screenPadding },
  modalCard: { backgroundColor: theme.colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: theme.colors.border, padding: spacing.lg, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  modalHeaderCopy: { flex: 1 },
  modalTitle: { fontFamily: typography.bold, fontSize: 20, color: theme.colors.text },
  modalSubtitle: { fontFamily: typography.regular, fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary, marginTop: 2 },
  fieldLabel: { fontFamily: typography.semibold, fontSize: 11, color: theme.colors.textSecondary, marginBottom: spacing.xs },
  input: { minHeight: 50, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radius.md, backgroundColor: theme.colors.input, paddingHorizontal: spacing.md, fontFamily: typography.regular, fontSize: 14, color: theme.colors.text, marginBottom: spacing.md },
  topicSectionTitle: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.text, marginTop: spacing.xl, marginBottom: spacing.xs },
  topicList: { maxHeight: 220 },
  topicRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.separator },
  topicName: { flex: 1, fontFamily: typography.regular, fontSize: 12, color: theme.colors.text },
  addTopicRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  topicInput: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radius.md, backgroundColor: theme.colors.input, paddingHorizontal: spacing.md, fontFamily: typography.regular, fontSize: 13, color: theme.colors.text },
  goalInput: { minHeight: 64, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radius.md, backgroundColor: theme.colors.input, paddingHorizontal: spacing.md, fontFamily: typography.bold, fontSize: 24, color: theme.colors.text, textAlign: 'center' },
  goalPresets: { flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.md },
  goalPreset: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  goalPresetText: { fontFamily: typography.semibold, fontSize: 11, color: theme.colors.text },
});
