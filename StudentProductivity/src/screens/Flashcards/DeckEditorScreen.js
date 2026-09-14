import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenLayout from '../../components/ScreenLayout';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { FlashcardService } from '../../utils/flashcardService';
import { loadPlanWorkspace, localDateKey } from '../../utils/planRepository';
import { radius, shadow, spacing, typography } from '../../theme/designSystem';

function topicName(topic) {
  return typeof topic === 'string' ? topic : topic?.name;
}

export default function DeckEditorScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { currentUser } = useUser();
  const styles = getStyles(theme);
  const { deckId } = route.params || {};
  const [deck, setDeck] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [editingCardId, setEditingCardId] = useState(null);
  const [tags, setTags] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [found, workspace] = await Promise.all([
        FlashcardService.getDeck(deckId, currentUser),
        loadPlanWorkspace(currentUser),
      ]);
      if (!found) {
        setDeck(null);
        return;
      }

      const migratedCards = (Array.isArray(found.cards) ? found.cards : []).map((card) => ({
        interval: 1,
        repetitions: 0,
        easeFactor: 2.5,
        dueDate: localDateKey(),
        lastStudied: null,
        ...card,
      }));
      const needsMigration = migratedCards.some((card, index) => {
        const original = found.cards?.[index] || {};
        return original.interval === undefined || original.repetitions === undefined || !original.dueDate;
      });
      const normalized = needsMigration
        ? await FlashcardService.updateDeck(found.id, { cards: migratedCards }, currentUser)
        : found;

      setDeck(normalized || { ...found, cards: migratedCards });
      setSubjects(workspace.subjects || []);
      setTags((normalized?.tags || found.tags || []).join(', '));
    } catch (error) {
      console.error('Unable to load deck editor:', error);
      Alert.alert('Deck unavailable', 'This learning set could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [deckId, currentUser?.email]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === deck?.subjectId) || null,
    [subjects, deck?.subjectId],
  );

  const progress = useMemo(() => {
    if (!deck?.cards?.length) return 0;
    const mastered = deck.cards.filter((card) => card.known).length;
    return Math.round((mastered / deck.cards.length) * 100);
  }, [deck?.cards]);

  const dueCount = useMemo(() => {
    if (!deck?.cards?.length) return 0;
    const today = localDateKey();
    return deck.cards.filter((card) => !card.dueDate || card.dueDate <= today).length;
  }, [deck?.cards]);

  const updateDeck = async (changes) => {
    setSaving(true);
    try {
      const updated = await FlashcardService.updateDeck(deck.id, changes, currentUser);
      if (!updated) throw new Error('Deck update failed.');
      setDeck(updated);
      return updated;
    } finally {
      setSaving(false);
    }
  };

  const setSubject = async (subjectId) => {
    try {
      await updateDeck({ subjectId: subjectId || null, topic: null });
    } catch (error) {
      Alert.alert('Could not link subject', 'Try again.');
    }
  };

  const setTopic = async (topic) => {
    try {
      await updateDeck({ topic: topic || null });
    } catch (error) {
      Alert.alert('Could not link topic', 'Try again.');
    }
  };

  const saveTags = async () => {
    try {
      const tagList = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
      await updateDeck({ tags: tagList });
    } catch (error) {
      Alert.alert('Could not save tags', 'Try again.');
    }
  };

  const startEdit = (card) => {
    setFront(card.front || '');
    setBack(card.back || '');
    setEditingCardId(card.id);
  };

  const cancelEdit = () => {
    setFront('');
    setBack('');
    setEditingCardId(null);
  };

  const saveCard = async () => {
    if (!front.trim() || !back.trim()) {
      Alert.alert('Complete the card', 'Add both a front and a back.');
      return;
    }

    setSaving(true);
    try {
      if (editingCardId) {
        const updated = await FlashcardService.updateCard(
          deck.id,
          editingCardId,
          { front: front.trim(), back: back.trim() },
          currentUser,
        );
        if (!updated) throw new Error('Card update failed.');
      } else {
        const created = await FlashcardService.addCardToDeck(
          deck.id,
          { front: front.trim(), back: back.trim() },
          currentUser,
        );
        if (!created) throw new Error('Card creation failed.');
      }
      cancelEdit();
      await load();
    } catch (error) {
      console.error('Save card failed:', error);
      Alert.alert('Could not save card', 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeCard = (card) => {
    Alert.alert(
      'Delete card?',
      'This card will be removed from the deck.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const deleted = await FlashcardService.deleteCard(deck.id, card.id, currentUser);
            if (!deleted) {
              Alert.alert('Delete failed', 'Try again.');
              return;
            }
            if (editingCardId === card.id) cancelEdit();
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
          <Text style={styles.loadingText}>Opening learning set…</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (!deck) {
    return (
      <ScreenLayout>
        <View style={styles.loadingState}>
          <Ionicons name="alert-circle-outline" size={34} color={theme.colors.error} />
          <Text style={styles.missingTitle}>Learning set not found</Text>
          <TouchableOpacity style={styles.returnButton} onPress={() => navigation.goBack()}>
            <Text style={styles.returnButtonText}>Return to Learn</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      scrollable
      horizontalPadding={false}
      verticalPadding={false}
      contentContainerStyle={styles.content}
      navigation={navigation}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Back to Learn">
          <Ionicons name="chevron-back" size={21} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>LEARNING SET</Text>
          <Text style={styles.title} numberOfLines={1}>{deck.title}</Text>
        </View>
        <TouchableOpacity
          style={[styles.studyButton, deck.cards.length === 0 && styles.disabledButton]}
          disabled={deck.cards.length === 0}
          onPress={() => navigation.navigate('Study', { deckId: deck.id, studyAll: true })}
        >
          <Ionicons name="play" size={17} color={theme.colors.primaryText} />
        </TouchableOpacity>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIcon}>
            <Ionicons name="albums-outline" size={23} color={theme.colors.primary} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroValue}>{deck.cards.length} cards</Text>
            <Text style={styles.heroMeta}>{dueCount} due · {progress}% mastered</Text>
          </View>
          <Text style={styles.heroPercent}>{progress}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Connected study context</Text>
          <Text style={styles.sectionSubtitle}>Attach this set to the same subject/topic used in Plan and Focus.</Text>
        </View>
      </View>

      <View style={styles.linkCard}>
        <Text style={styles.inputLabel}>Subject</Text>
        {subjects.length === 0 ? (
          <TouchableOpacity style={styles.noSubject} onPress={() => navigation.navigate('Tracker')}>
            <Ionicons name="add-circle-outline" size={19} color={theme.colors.primary} />
            <Text style={styles.noSubjectText}>Create a subject in Focus first</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <ChoiceChip label="Unlinked" selected={!deck.subjectId} onPress={() => setSubject(null)} theme={theme} styles={styles} />
            {subjects.map((subject) => (
              <ChoiceChip
                key={subject.id}
                label={subject.name}
                selected={deck.subjectId === subject.id}
                onPress={() => setSubject(subject.id)}
                theme={theme}
                styles={styles}
              />
            ))}
          </ScrollView>
        )}

        {selectedSubject?.topics?.length > 0 ? (
          <>
            <Text style={styles.inputLabel}>Topic</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <ChoiceChip label="General" selected={!deck.topic} onPress={() => setTopic(null)} theme={theme} styles={styles} />
              {selectedSubject.topics.map((topic) => {
                const name = topicName(topic);
                if (!name) return null;
                return (
                  <ChoiceChip
                    key={name}
                    label={name}
                    selected={deck.topic === name}
                    onPress={() => setTopic(name)}
                    theme={theme}
                    styles={styles}
                  />
                );
              })}
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.inputLabel}>Tags</Text>
        <View style={styles.tagsRow}>
          <TextInput
            style={styles.tagsInput}
            value={tags}
            onChangeText={setTags}
            placeholder="exam, formulas, chapter 3"
            placeholderTextColor={theme.colors.placeholder}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.saveTagsButton} onPress={saveTags} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={theme.colors.primaryText} /> : <Ionicons name="checkmark" size={18} color={theme.colors.primaryText} />}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{editingCardId ? 'Edit card' : 'Add a card'}</Text>
          <Text style={styles.sectionSubtitle}>{editingCardId ? 'Update the question and answer.' : 'Keep each card focused on one recall prompt.'}</Text>
        </View>
        {editingCardId ? (
          <TouchableOpacity onPress={cancelEdit}>
            <Text style={styles.sectionAction}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.editorCard}>
        <Text style={styles.inputLabel}>Front</Text>
        <TextInput
          style={styles.cardInput}
          value={front}
          onChangeText={setFront}
          placeholder="Question or term"
          placeholderTextColor={theme.colors.placeholder}
          multiline
          textAlignVertical="top"
        />
        <Text style={styles.inputLabel}>Back</Text>
        <TextInput
          style={styles.cardInput}
          value={back}
          onChangeText={setBack}
          placeholder="Answer or explanation"
          placeholderTextColor={theme.colors.placeholder}
          multiline
          textAlignVertical="top"
        />
        <TouchableOpacity style={[styles.saveCardButton, saving && styles.disabledButton]} onPress={saveCard} disabled={saving}>
          {saving ? <ActivityIndicator color={theme.colors.primaryText} /> : <Ionicons name={editingCardId ? 'save-outline' : 'add'} size={18} color={theme.colors.primaryText} />}
          <Text style={styles.saveCardText}>{saving ? 'Saving…' : editingCardId ? 'Save card' : 'Add card'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Cards</Text>
          <Text style={styles.sectionSubtitle}>{deck.cards.length} total in this set.</Text>
        </View>
      </View>

      {deck.cards.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="albums-outline" size={24} color={theme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No cards yet</Text>
          <Text style={styles.emptyText}>Add your first recall prompt above.</Text>
        </View>
      ) : (
        deck.cards.map((card, index) => (
          <View key={card.id} style={styles.cardRow}>
            <View style={styles.cardNumber}>
              <Text style={styles.cardNumberText}>{index + 1}</Text>
            </View>
            <TouchableOpacity style={styles.cardCopy} onPress={() => startEdit(card)}>
              <Text style={styles.cardFront} numberOfLines={2}>{card.front}</Text>
              <Text style={styles.cardBack} numberOfLines={2}>{card.back}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cardAction} onPress={() => startEdit(card)} accessibilityLabel="Edit card">
              <Ionicons name="create-outline" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cardAction} onPress={() => removeCard(card)} accessibilityLabel="Delete card">
              <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScreenLayout>
  );
}

function ChoiceChip({ label, selected, onPress, theme, styles }) {
  return (
    <TouchableOpacity style={[styles.choiceChip, selected && styles.choiceChipSelected]} onPress={onPress}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]} numberOfLines={1}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={13} color={theme.colors.primaryText} /> : null}
    </TouchableOpacity>
  );
}

const getStyles = (theme) => StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
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
  missingTitle: {
    fontFamily: typography.semibold,
    fontSize: 17,
    color: theme.colors.text,
    marginTop: spacing.sm,
  },
  returnButton: {
    marginTop: spacing.lg,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: theme.colors.primarySoft,
  },
  returnButtonText: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    fontFamily: typography.semibold,
    fontSize: 11,
    letterSpacing: 0.9,
    color: theme.colors.primary,
  },
  title: {
    fontFamily: typography.bold,
    fontSize: 23,
    color: theme.colors.text,
    marginTop: 2,
  },
  studyButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  disabledButton: { opacity: 0.45 },
  heroCard: {
    borderRadius: 24,
    padding: spacing.lg,
    backgroundColor: theme.colors.surface,
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
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  heroCopy: { flex: 1 },
  heroValue: {
    fontFamily: typography.bold,
    fontSize: 20,
    color: theme.colors.text,
  },
  heroMeta: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  heroPercent: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: theme.colors.primary,
  },
  progressTrack: {
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: theme.colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: 28,
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
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  sectionAction: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  linkCard: {
    borderRadius: 22,
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputLabel: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: spacing.xs,
  },
  chipRow: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  choiceChip: {
    minHeight: 38,
    maxWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  choiceChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  choiceText: {
    fontFamily: typography.semibold,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  choiceTextSelected: { color: theme.colors.primaryText },
  noSubject: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: theme.colors.primarySoft,
  },
  noSubjectText: {
    fontFamily: typography.semibold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tagsInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.input,
    paddingHorizontal: spacing.md,
    fontFamily: typography.regular,
    fontSize: 13,
    color: theme.colors.text,
  },
  saveTagsButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  editorCard: {
    borderRadius: 22,
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardInput: {
    minHeight: 82,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.input,
    padding: spacing.md,
    fontFamily: typography.regular,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: spacing.md,
  },
  saveCardButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 15,
    backgroundColor: theme.colors.primary,
  },
  saveCardText: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.primaryText,
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 22,
    padding: 26,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  emptyTitle: {
    fontFamily: typography.semibold,
    fontSize: 15,
    color: theme.colors.text,
    marginTop: spacing.sm,
  },
  emptyText: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  cardRow: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: spacing.sm,
  },
  cardNumber: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  cardNumberText: {
    fontFamily: typography.semibold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  cardCopy: { flex: 1 },
  cardFront: {
    fontFamily: typography.semibold,
    fontSize: 13,
    color: theme.colors.text,
  },
  cardBack: {
    fontFamily: typography.regular,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  cardAction: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
