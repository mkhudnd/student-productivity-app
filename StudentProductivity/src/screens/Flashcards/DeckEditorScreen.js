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
import { useFocusEffect } from '@react-navigation/native';
import ScreenLayout from '../../components/ScreenLayout';
import {
  AppIcon,
  Card,
  IconButton,
  PrimaryButton,
  ProgressBar,
  SectionHeader,
  SecondaryButton,
} from '../../components/ui';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { FlashcardService } from '../../utils/flashcardService';
import { loadPlanWorkspace, localDateKey } from '../../utils/planRepository';
import { layout, radius, spacing, typography } from '../../theme/designSystem';

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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const selectedSubject = useMemo(() => subjects.find((subject) => subject.id === deck?.subjectId) || null, [subjects, deck?.subjectId]);
  const progress = useMemo(() => {
    if (!deck?.cards?.length) return 0;
    return Math.round((deck.cards.filter((card) => card.known).length / deck.cards.length) * 100);
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
    try { await updateDeck({ subjectId: subjectId || null, topic: null }); }
    catch { Alert.alert('Could not link subject', 'Try again.'); }
  };

  const setTopic = async (topic) => {
    try { await updateDeck({ topic: topic || null }); }
    catch { Alert.alert('Could not link topic', 'Try again.'); }
  };

  const saveTags = async () => {
    try {
      await updateDeck({ tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
    } catch {
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
    if (!front.trim() || !back.trim()) return Alert.alert('Complete the card', 'Add both a front and a back.');
    setSaving(true);
    try {
      if (editingCardId) {
        const updated = await FlashcardService.updateCard(deck.id, editingCardId, { front: front.trim(), back: back.trim() }, currentUser);
        if (!updated) throw new Error('Card update failed.');
      } else {
        const created = await FlashcardService.addCardToDeck(deck.id, { front: front.trim(), back: back.trim() }, currentUser);
        if (!created) throw new Error('Card creation failed.');
      }
      cancelEdit();
      await load();
    } catch (error) {
      Alert.alert('Could not save card', 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeCard = (card) => {
    Alert.alert('Delete card?', 'This card will be removed from the deck.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const deleted = await FlashcardService.deleteCard(deck.id, card.id, currentUser);
        if (!deleted) Alert.alert('Delete failed', 'Try again.');
        else {
          if (editingCardId === card.id) cancelEdit();
          await load();
        }
      } },
    ]);
  };

  if (loading) {
    return <ScreenLayout><View style={styles.loadingState}><ActivityIndicator size="large" color={theme.colors.primary} /><Text style={styles.loadingText}>Opening learning set…</Text></View></ScreenLayout>;
  }

  if (!deck) {
    return (
      <ScreenLayout>
        <View style={styles.loadingState}>
          <AppIcon name="alert-circle-outline" size={34} color={theme.colors.error} />
          <Text style={styles.missingTitle}>Learning set not found</Text>
          <SecondaryButton label="Return to Learn" onPress={() => navigation.goBack()} />
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout scrollable horizontalPadding={false} verticalPadding={false} contentContainerStyle={styles.content} navigation={navigation}>
      <View style={styles.headerRow}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Back to Learn" />
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>LEARNING SET</Text><Text style={styles.title} numberOfLines={1}>{deck.title}</Text></View>
        <IconButton icon="play" color={theme.colors.primary} disabled={deck.cards.length === 0} onPress={() => navigation.navigate('Study', { deckId: deck.id, studyAll: true })} accessibilityLabel="Study deck" />
      </View>

      <Card style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <AppIcon name="albums-outline" size={23} color={theme.colors.primary} />
          <View style={styles.heroCopy}><Text style={styles.heroValue}>{deck.cards.length} cards</Text><Text style={styles.heroMeta}>{dueCount} due · {progress}% mastered</Text></View>
          <Text style={styles.heroPercent}>{progress}%</Text>
        </View>
        <ProgressBar progress={progress / 100} style={styles.heroProgress} />
      </Card>

      <SectionHeader title="Connected study context" subtitle="Attach this set to the same subject/topic used in Plan and Focus." style={styles.sectionSpace} />
      <Card>
        <Text style={styles.inputLabel}>Subject</Text>
        {subjects.length === 0 ? (
          <TouchableOpacity style={styles.noSubject} onPress={() => navigation.navigate('Tracker')}><AppIcon name="add-circle-outline" size={19} color={theme.colors.primary} /><Text style={styles.noSubjectText}>Create a subject in Focus first</Text></TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <ChoiceChip label="Unlinked" selected={!deck.subjectId} onPress={() => setSubject(null)} styles={styles} />
            {subjects.map((subject) => <ChoiceChip key={subject.id} label={subject.name} selected={deck.subjectId === subject.id} onPress={() => setSubject(subject.id)} styles={styles} />)}
          </ScrollView>
        )}

        {selectedSubject?.topics?.length > 0 ? (
          <>
            <Text style={styles.inputLabel}>Topic</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <ChoiceChip label="General" selected={!deck.topic} onPress={() => setTopic(null)} styles={styles} />
              {selectedSubject.topics.map((topic) => {
                const name = topicName(topic);
                if (!name) return null;
                return <ChoiceChip key={name} label={name} selected={deck.topic === name} onPress={() => setTopic(name)} styles={styles} />;
              })}
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.inputLabel}>Tags</Text>
        <View style={styles.tagsRow}>
          <TextInput style={styles.tagsInput} value={tags} onChangeText={setTags} placeholder="exam, formulas, chapter 3" placeholderTextColor={theme.colors.placeholder} autoCapitalize="none" />
          <IconButton icon="checkmark" color={theme.colors.primary} onPress={saveTags} disabled={saving} accessibilityLabel="Save tags" />
        </View>
      </Card>

      <SectionHeader title={editingCardId ? 'Edit card' : 'Add a card'} subtitle={editingCardId ? 'Update the question and answer.' : 'Keep each card focused on one recall prompt.'} actionLabel={editingCardId ? 'Cancel' : undefined} onAction={editingCardId ? cancelEdit : undefined} style={styles.sectionSpace} />
      <Card>
        <Text style={styles.inputLabel}>Front</Text>
        <TextInput style={styles.cardInput} value={front} onChangeText={setFront} placeholder="Question or term" placeholderTextColor={theme.colors.placeholder} multiline textAlignVertical="top" />
        <Text style={styles.inputLabel}>Back</Text>
        <TextInput style={styles.cardInput} value={back} onChangeText={setBack} placeholder="Answer or explanation" placeholderTextColor={theme.colors.placeholder} multiline textAlignVertical="top" />
        <PrimaryButton label={editingCardId ? 'Save card' : 'Add card'} icon={editingCardId ? 'save-outline' : 'add'} onPress={saveCard} loading={saving} />
      </Card>

      <SectionHeader title="Cards" subtitle={`${deck.cards.length} total in this set.`} style={styles.sectionSpace} />
      {deck.cards.length === 0 ? (
        <Card style={styles.emptyCard}><AppIcon name="albums-outline" size={25} color={theme.colors.primary} /><Text style={styles.emptyTitle}>No cards yet</Text><Text style={styles.emptyText}>Add your first recall prompt above.</Text></Card>
      ) : (
        <Card style={styles.cardsCard}>
          {deck.cards.map((card, index) => (
            <View key={card.id} style={[styles.cardRow, index < deck.cards.length - 1 && styles.divider]}>
              <Text style={styles.cardNumber}>{index + 1}</Text>
              <TouchableOpacity style={styles.cardCopy} onPress={() => startEdit(card)}>
                <Text style={styles.cardFront} numberOfLines={2}>{card.front}</Text>
                <Text style={styles.cardBack} numberOfLines={2}>{card.back}</Text>
              </TouchableOpacity>
              <IconButton icon="create-outline" size={18} onPress={() => startEdit(card)} accessibilityLabel="Edit card" />
              <IconButton icon="trash-outline" size={18} color={theme.colors.error} onPress={() => removeCard(card)} accessibilityLabel="Delete card" />
            </View>
          ))}
        </Card>
      )}
    </ScreenLayout>
  );
}

function ChoiceChip({ label, selected, onPress, styles }) {
  return <TouchableOpacity style={[styles.choiceChip, selected && styles.choiceChipSelected]} onPress={onPress}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]} numberOfLines={1}>{label}</Text>{selected ? <AppIcon name="checkmark" size={13} /> : null}</TouchableOpacity>;
}

const getStyles = (theme) => StyleSheet.create({
  content: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontFamily: typography.regular, color: theme.colors.textSecondary },
  missingTitle: { fontFamily: typography.semibold, fontSize: 16, color: theme.colors.text },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: typography.semibold, fontSize: 11, letterSpacing: 0.8, color: theme.colors.primary },
  title: { fontFamily: typography.bold, fontSize: 24, color: theme.colors.text, marginTop: 2 },
  heroCard: { marginTop: spacing.xl },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroCopy: { flex: 1 },
  heroValue: { fontFamily: typography.bold, fontSize: 20, color: theme.colors.text },
  heroMeta: { fontFamily: typography.regular, fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  heroPercent: { fontFamily: typography.bold, fontSize: 16, color: theme.colors.primary },
  heroProgress: { marginTop: spacing.md },
  sectionSpace: { marginTop: spacing.xxl },
  inputLabel: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  noSubject: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noSubjectText: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.primary },
  chipRow: { gap: spacing.xs, paddingBottom: spacing.xs },
  choiceChip: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxs },
  choiceChipSelected: { borderColor: theme.colors.primary },
  choiceText: { fontFamily: typography.semibold, fontSize: 11, color: theme.colors.textSecondary },
  choiceTextSelected: { color: theme.colors.primary },
  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tagsInput: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radius.md, backgroundColor: theme.colors.input, paddingHorizontal: spacing.md, fontFamily: typography.regular, fontSize: 13, color: theme.colors.text },
  cardInput: { minHeight: 92, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radius.md, backgroundColor: theme.colors.input, padding: spacing.md, fontFamily: typography.regular, fontSize: 14, color: theme.colors.text, marginBottom: spacing.md },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { fontFamily: typography.semibold, fontSize: 15, color: theme.colors.text, marginTop: spacing.sm },
  emptyText: { fontFamily: typography.regular, fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  cardsCard: { padding: 0, overflow: 'hidden' },
  cardRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.separator },
  cardNumber: { width: 22, fontFamily: typography.semibold, fontSize: 11, color: theme.colors.textMuted },
  cardCopy: { flex: 1 },
  cardFront: { fontFamily: typography.semibold, fontSize: 13, color: theme.colors.text },
  cardBack: { fontFamily: typography.regular, fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary, marginTop: 3 },
});
