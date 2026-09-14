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
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import ScreenLayout from '../../components/ScreenLayout';
import {
  AppIcon,
  Card,
  IconButton,
  MetricCard,
  PrimaryButton,
  ProgressBar,
  ScreenIntro,
  SectionHeader,
  SecondaryButton,
} from '../../components/ui';
import { createLearnDeck, deleteLearnDeck, loadLearnWorkspace } from '../../utils/learnRepository';
import { layout, radius, spacing, typography } from '../../theme/designSystem';

const EMPTY_WORKSPACE = {
  subjects: [], decks: [], linkedDecks: [], unlinkedDecks: [],
  dueCount: 0, cardCount: 0, masteredCount: 0, recentSessions: [],
};

function topicName(topic) {
  return typeof topic === 'string' ? topic : topic?.name;
}

export default function DeckListScreen({ navigation }) {
  const { theme } = useTheme();
  const { currentUser } = useUser();
  const styles = getStyles(theme);
  const [workspace, setWorkspace] = useState(EMPTY_WORKSPACE);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [deckTitle, setDeckTitle] = useState('');
  const [deckSubjectId, setDeckSubjectId] = useState(null);
  const [deckTopic, setDeckTopic] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWorkspace(await loadLearnWorkspace(currentUser));
    } catch (error) {
      console.error('Unable to load Learn workspace:', error);
      setWorkspace(EMPTY_WORKSPACE);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.email]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const subjectsById = useMemo(() => new Map(workspace.subjects.map((subject) => [subject.id, subject])), [workspace.subjects]);

  const filteredDecks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return workspace.decks
      .filter((deck) => selectedSubjectId === 'unlinked' ? !deck.subjectId : selectedSubjectId === 'all' ? true : deck.subjectId === selectedSubjectId)
      .filter((deck) => {
        if (!query) return true;
        const subject = subjectsById.get(deck.subjectId);
        return [deck.title, deck.topic, subject?.name, ...(deck.tags || [])].filter(Boolean).join(' ').toLowerCase().includes(query);
      })
      .sort((a, b) => (b.due - a.due) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }, [search, selectedSubjectId, subjectsById, workspace.decks]);

  const dueDeck = workspace.decks.find((deck) => deck.due > 0);
  const selectedCreateSubject = workspace.subjects.find((subject) => subject.id === deckSubjectId);

  const openCreate = () => {
    setDeckTitle('');
    setDeckSubjectId(workspace.subjects[0]?.id || null);
    setDeckTopic('');
    setShowCreate(true);
  };

  const createDeck = async () => {
    if (!deckTitle.trim()) return Alert.alert('Deck name required', 'Give this learning set a useful name.');
    setSaving(true);
    try {
      const created = await createLearnDeck(currentUser, { title: deckTitle, subjectId: deckSubjectId, topic: deckTopic });
      if (!created) throw new Error('Deck creation failed.');
      setShowCreate(false);
      await load();
      navigation.navigate('DeckEditor', { deckId: created.id });
    } catch (error) {
      Alert.alert('Could not create deck', 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeDeck = (deck) => {
    Alert.alert('Delete learning set?', `Delete “${deck.title}” and its ${deck.cards.length} card${deck.cards.length === 1 ? '' : 's'}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { const deleted = await deleteLearnDeck(currentUser, deck.id); if (!deleted) Alert.alert('Delete failed', 'The deck could not be removed.'); else await load(); } },
    ]);
  };

  if (loading) {
    return <ScreenLayout><View style={styles.loadingState}><ActivityIndicator size="large" color={theme.colors.primary} /><Text style={styles.loadingText}>Preparing Learn…</Text></View></ScreenLayout>;
  }

  return (
    <>
      <ScreenLayout scrollable horizontalPadding={false} verticalPadding={false} contentContainerStyle={styles.content} navigation={navigation}>
        <ScreenIntro
          eyebrow="Learn"
          title="Build what you know"
          subtitle="Study by subject and topic, with flashcards connected to the rest of your plan."
          right={<IconButton icon="add" onPress={openCreate} accessibilityLabel="Create deck" />}
        />

        <Card style={styles.reviewHero}>
          <AppIcon name="flash-outline" size={25} color={theme.colors.primary} />
          <View style={styles.reviewCopy}>
            <Text style={styles.reviewEyebrow}>READY TO REVIEW</Text>
            <Text style={styles.reviewValue}>{workspace.dueCount} due now</Text>
            <Text style={styles.reviewHint}>{workspace.dueCount > 0 ? 'Start with cards that need attention today.' : 'You are caught up. Add cards or review a full deck.'}</Text>
          </View>
          <PrimaryButton label="Review" icon="play" disabled={!dueDeck} onPress={() => dueDeck && navigation.navigate('Study', { deckId: dueDeck.id, studyAll: false })} style={styles.reviewButton} />
        </Card>

        <View style={styles.statRow}>
          <MetricCard icon="layers-outline" value={workspace.decks.length} label="Decks" />
          <MetricCard icon="albums-outline" value={workspace.cardCount} label="Cards" />
          <MetricCard icon="checkmark-circle-outline" value={workspace.masteredCount} label="Mastered" color={theme.colors.success} />
        </View>

        <SectionHeader title="Subjects" subtitle="Keep every deck attached to what you are actually studying." actionLabel="Focus" onAction={() => navigation.navigate('Tracker')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <SubjectChip label="All" selected={selectedSubjectId === 'all'} onPress={() => setSelectedSubjectId('all')} styles={styles} />
          {workspace.subjects.map((subject) => <SubjectChip key={subject.id} label={subject.name} selected={selectedSubjectId === subject.id} onPress={() => setSelectedSubjectId(subject.id)} styles={styles} />)}
          {workspace.unlinkedDecks.length > 0 ? <SubjectChip label={`Unlinked ${workspace.unlinkedDecks.length}`} selected={selectedSubjectId === 'unlinked'} onPress={() => setSelectedSubjectId('unlinked')} styles={styles} /> : null}
        </ScrollView>

        <View style={styles.searchShell}>
          <AppIcon name="search-outline" size={19} color={theme.colors.textMuted} />
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Search decks, subjects or topics" placeholderTextColor={theme.colors.placeholder} autoCorrect={false} />
          {search ? <IconButton icon="close" size={18} onPress={() => setSearch('')} accessibilityLabel="Clear search" style={styles.inlineIconButton} /> : null}
        </View>

        <SectionHeader title="Learning sets" subtitle={`${filteredDecks.length} deck${filteredDecks.length === 1 ? '' : 's'} in this view.`} actionLabel="New" onAction={openCreate} />

        {filteredDecks.length === 0 ? (
          <Card style={styles.emptyCard}>
            <AppIcon name="layers-outline" size={28} color={theme.colors.primary} />
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyText}>Create a deck and connect it to a subject or topic so Learn can organize it for you.</Text>
            <SecondaryButton label="Create a deck" icon="add" onPress={openCreate} style={styles.emptyButton} />
          </Card>
        ) : filteredDecks.map((deck) => {
          const subject = subjectsById.get(deck.subjectId);
          return (
            <Card key={deck.id} style={styles.deckCard}>
              <TouchableOpacity style={styles.deckMain} onPress={() => navigation.navigate('DeckEditor', { deckId: deck.id })} accessibilityRole="button">
                <View style={styles.deckTopRow}>
                  <AppIcon name="albums-outline" size={22} color={theme.colors.primary} />
                  <View style={styles.deckCopy}>
                    <Text style={styles.deckTitle} numberOfLines={1}>{deck.title}</Text>
                    <Text style={styles.deckMeta} numberOfLines={1}>{subject?.name || 'Unlinked'}{deck.topic ? ` · ${deck.topic}` : ''}</Text>
                  </View>
                  {deck.due > 0 ? <Text style={styles.dueText}>{deck.due} due</Text> : null}
                </View>
                <View style={styles.progressRow}><ProgressBar progress={(deck.progress || 0) / 100} style={styles.deckProgress} /><Text style={styles.progressText}>{deck.progress}%</Text></View>
                <Text style={styles.deckStats}>{deck.cards.length} cards · {deck.mastered} mastered</Text>
              </TouchableOpacity>
              <View style={styles.deckActions}>
                <SecondaryButton label={deck.due > 0 ? 'Review due' : 'Study'} icon="play-outline" onPress={() => navigation.navigate('Study', { deckId: deck.id, studyAll: deck.due === 0 })} style={styles.studyButton} />
                <IconButton icon="create-outline" onPress={() => navigation.navigate('DeckEditor', { deckId: deck.id })} accessibilityLabel="Edit deck" />
                <IconButton icon="trash-outline" color={theme.colors.error} onPress={() => removeDeck(deck)} accessibilityLabel="Delete deck" />
              </View>
            </Card>
          );
        })}

        {workspace.unlinkedDecks.length > 0 ? (
          <Card style={styles.migrationNote}>
            <AppIcon name="link-outline" size={20} color={theme.colors.warning} />
            <View style={styles.migrationCopy}><Text style={styles.migrationTitle}>Some older decks are not linked yet</Text><Text style={styles.migrationText}>They remain available. Open a deck to attach it to a subject and topic.</Text></View>
          </Card>
        ) : null}
      </ScreenLayout>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => !saving && setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}><Text style={styles.modalTitle}>New learning set</Text><Text style={styles.modalSubtitle}>Connect the deck to what you are studying.</Text></View>
              <IconButton icon="close" onPress={() => setShowCreate(false)} disabled={saving} accessibilityLabel="Close" />
            </View>

            <Text style={styles.inputLabel}>Deck name</Text>
            <TextInput style={styles.input} value={deckTitle} onChangeText={setDeckTitle} placeholder="e.g. Data structures" placeholderTextColor={theme.colors.placeholder} editable={!saving} />

            {workspace.subjects.length > 0 ? (
              <>
                <Text style={styles.inputLabel}>Subject</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>
                  <SubjectChip label="None" selected={!deckSubjectId} onPress={() => { setDeckSubjectId(null); setDeckTopic(''); }} styles={styles} />
                  {workspace.subjects.map((subject) => <SubjectChip key={subject.id} label={subject.name} selected={deckSubjectId === subject.id} onPress={() => { setDeckSubjectId(subject.id); setDeckTopic(''); }} styles={styles} />)}
                </ScrollView>
              </>
            ) : (
              <Card style={styles.noSubjectNote}><AppIcon name="information-circle-outline" size={19} color={theme.colors.primary} /><Text style={styles.noSubjectText}>Create a subject in Focus first if you want this deck connected to one.</Text></Card>
            )}

            {selectedCreateSubject ? (
              <>
                <Text style={styles.inputLabel}>Topic</Text>
                {Array.isArray(selectedCreateSubject.topics) && selectedCreateSubject.topics.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>
                    {selectedCreateSubject.topics.map((topic) => {
                      const name = topicName(topic);
                      return <SubjectChip key={name} label={name} selected={deckTopic === name} onPress={() => setDeckTopic(name)} styles={styles} compact />;
                    })}
                  </ScrollView>
                ) : null}
                <TextInput style={styles.input} value={deckTopic} onChangeText={setDeckTopic} placeholder="Optional topic" placeholderTextColor={theme.colors.placeholder} editable={!saving} />
              </>
            ) : null}

            <PrimaryButton label="Create deck" icon="add" onPress={createDeck} loading={saving} style={styles.createButton} />
          </View>
        </View>
      </Modal>
    </>
  );
}

function SubjectChip({ label, selected, onPress, styles, compact = false }) {
  return <TouchableOpacity style={[styles.subjectChip, compact && styles.subjectChipCompact, selected && styles.subjectChipSelected]} onPress={onPress}><Text style={[styles.subjectChipText, selected && styles.subjectChipTextSelected]}>{label}</Text></TouchableOpacity>;
}

const getStyles = (theme) => StyleSheet.create({
  content: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontFamily: typography.regular, color: theme.colors.textSecondary },
  reviewHero: { marginTop: spacing.xl, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewCopy: { flex: 1 },
  reviewEyebrow: { fontFamily: typography.semibold, fontSize: 11, letterSpacing: 0.8, color: theme.colors.primary },
  reviewValue: { fontFamily: typography.bold, fontSize: 22, color: theme.colors.text, marginTop: 2 },
  reviewHint: { fontFamily: typography.regular, fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary, marginTop: 2 },
  reviewButton: { width: 104, minHeight: 48 },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxl },
  chipRow: { gap: spacing.xs, paddingBottom: spacing.lg },
  subjectChip: { minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  subjectChipCompact: { minHeight: 36, paddingHorizontal: spacing.sm },
  subjectChipSelected: { borderColor: theme.colors.primary },
  subjectChipText: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.textSecondary },
  subjectChipTextSelected: { color: theme.colors.primary },
  searchShell: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.input, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.xl },
  searchInput: { flex: 1, minHeight: 50, fontFamily: typography.regular, fontSize: 14, color: theme.colors.text },
  inlineIconButton: { width: 32, height: 32 },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl, marginBottom: spacing.xl },
  emptyTitle: { fontFamily: typography.semibold, fontSize: 16, color: theme.colors.text, marginTop: spacing.md },
  emptyText: { fontFamily: typography.regular, fontSize: 12, lineHeight: 18, textAlign: 'center', color: theme.colors.textSecondary, marginTop: spacing.xs, maxWidth: 290 },
  emptyButton: { marginTop: spacing.lg },
  deckCard: { padding: 0, overflow: 'hidden', marginBottom: spacing.sm },
  deckMain: { padding: spacing.md },
  deckTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deckCopy: { flex: 1 },
  deckTitle: { fontFamily: typography.semibold, fontSize: 15, color: theme.colors.text },
  deckMeta: { fontFamily: typography.regular, fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  dueText: { fontFamily: typography.semibold, fontSize: 11, color: theme.colors.primary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  deckProgress: { flex: 1 },
  progressText: { fontFamily: typography.semibold, fontSize: 11, color: theme.colors.textSecondary, minWidth: 34, textAlign: 'right' },
  deckStats: { fontFamily: typography.regular, fontSize: 10, color: theme.colors.textMuted, marginTop: spacing.xs },
  deckActions: { minHeight: 58, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.separator, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  studyButton: { flex: 1, minHeight: 42 },
  migrationNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.lg },
  migrationCopy: { flex: 1 },
  migrationTitle: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.text },
  migrationText: { fontFamily: typography.regular, fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'center', padding: layout.screenPadding },
  modalCard: { backgroundColor: theme.colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: theme.colors.border },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.lg },
  modalHeaderCopy: { flex: 1 },
  modalTitle: { fontFamily: typography.bold, fontSize: 20, color: theme.colors.text },
  modalSubtitle: { fontFamily: typography.regular, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary, marginTop: 2 },
  inputLabel: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { minHeight: 52, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: typography.regular, fontSize: 14, color: theme.colors.text, backgroundColor: theme.colors.input },
  modalChipRow: { gap: spacing.xs, paddingBottom: spacing.xs },
  noSubjectNote: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.sm },
  noSubjectText: { flex: 1, fontFamily: typography.regular, fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary },
  createButton: { marginTop: spacing.xl },
});
