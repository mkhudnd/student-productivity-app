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
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import ScreenLayout from '../../components/ScreenLayout';
import {
  createLearnDeck,
  deleteLearnDeck,
  loadLearnWorkspace,
} from '../../utils/learnRepository';
import { radius, shadow, spacing, typography } from '../../theme/designSystem';

const EMPTY_WORKSPACE = {
  subjects: [],
  decks: [],
  linkedDecks: [],
  unlinkedDecks: [],
  dueCount: 0,
  cardCount: 0,
  masteredCount: 0,
  recentSessions: [],
};

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const subjectsById = useMemo(
    () => new Map(workspace.subjects.map((subject) => [subject.id, subject])),
    [workspace.subjects],
  );

  const filteredDecks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return workspace.decks
      .filter((deck) => {
        if (selectedSubjectId === 'unlinked') return !deck.subjectId;
        if (selectedSubjectId !== 'all') return deck.subjectId === selectedSubjectId;
        return true;
      })
      .filter((deck) => {
        if (!query) return true;
        const subject = subjectsById.get(deck.subjectId);
        return [deck.title, deck.topic, subject?.name, ...(deck.tags || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
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
    if (!deckTitle.trim()) {
      Alert.alert('Deck name required', 'Give this learning set a useful name.');
      return;
    }

    setSaving(true);
    try {
      const created = await createLearnDeck(currentUser, {
        title: deckTitle,
        subjectId: deckSubjectId,
        topic: deckTopic,
      });
      if (!created) throw new Error('Deck creation failed.');
      setShowCreate(false);
      await load();
      navigation.navigate('DeckEditor', { deckId: created.id });
    } catch (error) {
      console.error('Create deck failed:', error);
      Alert.alert('Could not create deck', 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeDeck = (deck) => {
    Alert.alert(
      'Delete learning set?',
      `Delete “${deck.title}” and its ${deck.cards.length} card${deck.cards.length === 1 ? '' : 's'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const deleted = await deleteLearnDeck(currentUser, deck.id);
            if (!deleted) {
              Alert.alert('Delete failed', 'The deck could not be removed.');
              return;
            }
            await load();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <ScreenLayout>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Preparing Learn…</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <>
      <ScreenLayout
        scrollable
        horizontalPadding={false}
        verticalPadding={false}
        contentContainerStyle={styles.content}
        navigation={navigation}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>LEARN</Text>
            <Text style={styles.title}>Build what you know</Text>
            <Text style={styles.subtitle}>Study by subject and topic, with flashcards connected to the rest of your plan.</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={openCreate} accessibilityRole="button">
            <Ionicons name="add" size={22} color={theme.colors.primaryText} />
          </TouchableOpacity>
        </View>

        <View style={styles.reviewHero}>
          <View style={styles.reviewIcon}>
            <Ionicons name="flash-outline" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.reviewCopy}>
            <Text style={styles.reviewEyebrow}>READY TO REVIEW</Text>
            <Text style={styles.reviewValue}>{workspace.dueCount} due now</Text>
            <Text style={styles.reviewHint}>
              {workspace.dueCount > 0
                ? 'Start with cards that need attention today.'
                : 'You are caught up. Add cards or review a full deck.'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.reviewButton, !dueDeck && styles.reviewButtonDisabled]}
            disabled={!dueDeck}
            onPress={() => navigation.navigate('Study', { deckId: dueDeck.id, studyAll: false })}
          >
            <Ionicons name="play" size={17} color={theme.colors.primaryText} />
            <Text style={styles.reviewButtonText}>Review</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statRow}>
          <StatCard icon="layers-outline" value={workspace.decks.length} label="Decks" theme={theme} styles={styles} />
          <StatCard icon="albums-outline" value={workspace.cardCount} label="Cards" theme={theme} styles={styles} />
          <StatCard icon="checkmark-circle-outline" value={workspace.masteredCount} label="Mastered" theme={theme} styles={styles} />
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>Subjects</Text>
            <Text style={styles.sectionSubtitle}>Keep every deck attached to what you are actually studying.</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Tracker')} accessibilityRole="button">
            <Text style={styles.sectionAction}>Focus</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <SubjectChip
            label="All"
            selected={selectedSubjectId === 'all'}
            onPress={() => setSelectedSubjectId('all')}
            theme={theme}
            styles={styles}
          />
          {workspace.subjects.map((subject) => (
            <SubjectChip
              key={subject.id}
              label={subject.name}
              selected={selectedSubjectId === subject.id}
              onPress={() => setSelectedSubjectId(subject.id)}
              theme={theme}
              styles={styles}
            />
          ))}
          {workspace.unlinkedDecks.length > 0 ? (
            <SubjectChip
              label={`Unlinked ${workspace.unlinkedDecks.length}`}
              selected={selectedSubjectId === 'unlinked'}
              onPress={() => setSelectedSubjectId('unlinked')}
              theme={theme}
              styles={styles}
            />
          ) : null}
        </ScrollView>

        <View style={styles.searchShell}>
          <Ionicons name="search-outline" size={19} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search decks, subjects or topics"
            placeholderTextColor={theme.colors.placeholder}
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button">
              <Ionicons name="close-circle" size={19} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>Learning sets</Text>
            <Text style={styles.sectionSubtitle}>{filteredDecks.length} deck{filteredDecks.length === 1 ? '' : 's'} in this view.</Text>
          </View>
          <TouchableOpacity onPress={openCreate} accessibilityRole="button">
            <Text style={styles.sectionAction}>New</Text>
          </TouchableOpacity>
        </View>

        {filteredDecks.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="layers-outline" size={26} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyText}>
              Create a deck and connect it to a subject or topic so Learn can organize it for you.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={openCreate}>
              <Text style={styles.emptyButtonText}>Create a deck</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredDecks.map((deck) => {
            const subject = subjectsById.get(deck.subjectId);
            return (
              <View key={deck.id} style={styles.deckCard}>
                <TouchableOpacity
                  style={styles.deckMain}
                  onPress={() => navigation.navigate('DeckEditor', { deckId: deck.id })}
                  accessibilityRole="button"
                >
                  <View style={styles.deckTopRow}>
                    <View style={styles.deckIcon}>
                      <Ionicons name="albums-outline" size={21} color={theme.colors.primary} />
                    </View>
                    <View style={styles.deckCopy}>
                      <Text style={styles.deckTitle} numberOfLines={1}>{deck.title}</Text>
                      <Text style={styles.deckMeta} numberOfLines={1}>
                        {subject?.name || 'Unlinked'}{deck.topic ? ` · ${deck.topic}` : ''}
                      </Text>
                    </View>
                    {deck.due > 0 ? (
                      <View style={styles.dueBadge}>
                        <Text style={styles.dueBadgeText}>{deck.due} due</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${deck.progress}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{deck.progress}%</Text>
                  </View>

                  <View style={styles.deckStats}>
                    <Text style={styles.deckStat}>{deck.cards.length} cards</Text>
                    <View style={styles.dot} />
                    <Text style={styles.deckStat}>{deck.mastered} mastered</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.deckActions}>
                  <TouchableOpacity
                    style={styles.studyButton}
                    onPress={() => navigation.navigate('Study', { deckId: deck.id, studyAll: deck.due === 0 })}
                  >
                    <Ionicons name="play-outline" size={17} color={theme.colors.primary} />
                    <Text style={styles.studyButtonText}>{deck.due > 0 ? 'Review due' : 'Study'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconAction}
                    onPress={() => navigation.navigate('DeckEditor', { deckId: deck.id })}
                    accessibilityLabel="Edit deck"
                  >
                    <Ionicons name="create-outline" size={19} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconAction}
                    onPress={() => removeDeck(deck)}
                    accessibilityLabel="Delete deck"
                  >
                    <Ionicons name="trash-outline" size={19} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {workspace.unlinkedDecks.length > 0 ? (
          <View style={styles.migrationNote}>
            <Ionicons name="link-outline" size={20} color={theme.colors.warning} />
            <View style={styles.migrationCopy}>
              <Text style={styles.migrationTitle}>Some older decks are not linked yet</Text>
              <Text style={styles.migrationText}>They are still available. Open a deck to keep using it while we migrate subject/topic linking into the editor.</Text>
            </View>
          </View>
        ) : null}
      </ScreenLayout>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => !saving && setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>New learning set</Text>
                <Text style={styles.modalSubtitle}>Connect the deck to what you are studying.</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowCreate(false)} disabled={saving}>
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Deck name</Text>
            <TextInput
              style={styles.input}
              value={deckTitle}
              onChangeText={setDeckTitle}
              placeholder="e.g. Data structures"
              placeholderTextColor={theme.colors.placeholder}
              editable={!saving}
            />

            {workspace.subjects.length > 0 ? (
              <>
                <Text style={styles.inputLabel}>Subject</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>
                  <SubjectChip
                    label="None"
                    selected={!deckSubjectId}
                    onPress={() => setDeckSubjectId(null)}
                    theme={theme}
                    styles={styles}
                  />
                  {workspace.subjects.map((subject) => (
                    <SubjectChip
                      key={subject.id}
                      label={subject.name}
                      selected={deckSubjectId === subject.id}
                      onPress={() => {
                        setDeckSubjectId(subject.id);
                        setDeckTopic('');
                      }}
                      theme={theme}
                      styles={styles}
                    />
                  ))}
                </ScrollView>
              </>
            ) : (
              <View style={styles.noSubjectNote}>
                <Ionicons name="information-circle-outline" size={19} color={theme.colors.primary} />
                <Text style={styles.noSubjectText}>Create a subject in Focus first if you want this deck connected to one.</Text>
              </View>
            )}

            {selectedCreateSubject?.topics?.length > 0 ? (
              <>
                <Text style={styles.inputLabel}>Topic</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>
                  <SubjectChip
                    label="General"
                    selected={!deckTopic}
                    onPress={() => setDeckTopic('')}
                    theme={theme}
                    styles={styles}
                  />
                  {selectedCreateSubject.topics.map((topic) => {
                    const topicName = typeof topic === 'string' ? topic : topic.name;
                    return (
                      <SubjectChip
                        key={topicName}
                        label={topicName}
                        selected={deckTopic === topicName}
                        onPress={() => setDeckTopic(topicName)}
                        theme={theme}
                        styles={styles}
                      />
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            <TouchableOpacity style={[styles.createButton, saving && styles.disabledButton]} onPress={createDeck} disabled={saving}>
              {saving ? <ActivityIndicator color={theme.colors.primaryText} /> : <Ionicons name="add" size={19} color={theme.colors.primaryText} />}
              <Text style={styles.createButtonText}>{saving ? 'Creating…' : 'Create and add cards'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function StatCard({ icon, value, label, theme, styles }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SubjectChip({ label, selected, onPress, theme, styles }) {
  return (
    <TouchableOpacity style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={14} color={theme.colors.primaryText} /> : null}
    </TouchableOpacity>
  );
}

const getStyles = (theme) => StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.regular,
    fontSize: typography.sizes.bodySmall,
    color: theme.colors.textSecondary,
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
    fontSize: typography.sizes.caption,
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
    fontSize: typography.sizes.bodySmall,
    lineHeight: typography.lineHeights.bodySmall,
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
  reviewHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 24,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  reviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  reviewCopy: { flex: 1 },
  reviewEyebrow: {
    fontFamily: typography.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: theme.colors.primary,
  },
  reviewValue: {
    fontFamily: typography.bold,
    fontSize: 22,
    color: theme.colors.text,
    marginTop: 2,
  },
  reviewHint: {
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  reviewButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
  },
  reviewButtonDisabled: { opacity: 0.35 },
  reviewButtonText: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.primaryText,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statValue: {
    fontFamily: typography.bold,
    fontSize: 22,
    color: theme.colors.text,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionHeaderCopy: { flex: 1 },
  sectionTitle: {
    fontFamily: typography.semibold,
    fontSize: typography.sizes.titleSmall,
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
    paddingVertical: spacing.xs,
  },
  chipRow: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  chip: {
    minHeight: 38,
    maxWidth: 170,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  chipText: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  chipTextSelected: { color: theme.colors.primaryText },
  searchShell: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: spacing.xl,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.regular,
    fontSize: 14,
    color: theme.colors.text,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
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
    fontSize: 17,
    color: theme.colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    fontFamily: typography.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyButton: {
    marginTop: spacing.lg,
    borderRadius: 14,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  emptyButtonText: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  deckCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadow.card,
  },
  deckMain: { padding: spacing.lg },
  deckTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deckIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  deckCopy: { flex: 1 },
  deckTitle: {
    fontFamily: typography.semibold,
    fontSize: 16,
    color: theme.colors.text,
  },
  deckMeta: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  dueBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: theme.colors.accentSoft,
  },
  dueBadgeText: {
    fontFamily: typography.semibold,
    fontSize: 11,
    color: theme.colors.accent,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  progressTrack: {
    flex: 1,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: theme.colors.primary,
  },
  progressText: {
    width: 38,
    textAlign: 'right',
    fontFamily: typography.semibold,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  deckStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: spacing.sm,
  },
  deckStat: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.textMuted,
  },
  deckActions: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: theme.colors.separator,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  studyButton: {
    marginRight: 'auto',
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
  },
  studyButtonText: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  iconAction: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  migrationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: `${theme.colors.warning}10`,
  },
  migrationCopy: { flex: 1 },
  migrationTitle: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
  },
  migrationText: {
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  modalCard: {
    maxHeight: '85%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
  modalChipRow: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  noSubjectNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 15,
    marginBottom: spacing.lg,
  },
  noSubjectText: {
    flex: 1,
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  },
  createButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    marginTop: spacing.sm,
  },
  disabledButton: { opacity: 0.5 },
  createButtonText: {
    fontFamily: typography.semibold,
    fontSize: 14,
    color: theme.colors.primaryText,
  },
});
