import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { FlashcardService } from '../../utils/flashcardService';
import { localDateKey } from '../../utils/planRepository';
import ScreenLayout from '../../components/ScreenLayout';
import {
  AppIcon,
  Card,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
} from '../../components/ui';
import { radius, spacing, typography } from '../../theme/designSystem';

function getDueCards(deck) {
  const today = localDateKey();
  return (deck?.cards || []).filter((card) => !card.dueDate || card.dueDate <= today);
}

function getProgress(deck) {
  if (!deck?.cards?.length) return { known: 0, total: 0, percent: 0 };
  const known = deck.cards.filter((card) => card.known).length;
  const total = deck.cards.length;
  return { known, total, percent: Math.round((known / total) * 100) };
}

function updateSRS(card, correct) {
  let { interval = 1, repetitions = 0, easeFactor = 2.5 } = card;
  const quality = correct ? 5 : 2;
  if (correct) {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.max(1, Math.round(interval * easeFactor));
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  } else {
    repetitions = 0;
    interval = 1;
  }
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + interval);
  return {
    ...card,
    interval,
    repetitions,
    easeFactor,
    dueDate: localDateKey(nextDue),
    lastStudied: localDateKey(),
    known: correct,
    reviewCount: Number(card.reviewCount || 0) + 1,
  };
}

export default function StudyScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { currentUser } = useUser();
  const styles = getStyles(theme);
  const { deckId, studyAll = false } = route?.params || {};
  const [deck, setDeck] = useState(null);
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [answerInput, setAnswerInput] = useState('');
  const [answerChecked, setAnswerChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [revisionMode, setRevisionMode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const [showTimerSetup, setShowTimerSetup] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('2');
  const [customSeconds, setCustomSeconds] = useState('0');
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, reviewed: 0 });
  const [navigationLocked, setNavigationLocked] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;
  const timerRef = useRef(null);

  useEffect(() => { loadDeck(); }, [deckId, currentUser?.email]);

  useEffect(() => {
    setAnswerInput('');
    setAnswerChecked(false);
    setIsCorrect(null);
    setShowBack(false);
    pan.setValue({ x: 0, y: 0 });
  }, [index]);

  useEffect(() => {
    if (revisionMode && timerActive && timeRemaining > 0) {
      timerRef.current = setTimeout(() => setTimeRemaining((value) => value - 1), 1000);
    } else if (revisionMode && timeRemaining === 0) {
      setTimerActive(false);
      setSessionComplete(true);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [revisionMode, timerActive, timeRemaining]);

  async function loadDeck() {
    setLoading(true);
    try {
      const found = await FlashcardService.getDeck(deckId, currentUser);
      setDeck(found);
      setQueue(found ? (studyAll ? [...(found.cards || [])] : getDueCards(found)) : []);
      setIndex(0);
      setSessionComplete(false);
    } finally {
      setLoading(false);
    }
  }

  function beginRevisionMode(seconds = null) {
    const customDuration = Math.max(1, Number(customMinutes || 0) * 60 + Number(customSeconds || 0));
    const duration = seconds || customDuration;
    setTimeRemaining(duration);
    setTimerActive(true);
    setRevisionMode(true);
    setShowTimerSetup(false);
    setSessionStats({ correct: 0, incorrect: 0, reviewed: 0 });
  }

  function flipCard() { setShowBack((value) => !value); }

  function nextCard() {
    if (navigationLocked || queue.length === 0) return;
    setNavigationLocked(true);
    if (index < queue.length - 1) setIndex((value) => value + 1);
    else {
      setSessionComplete(true);
      setTimerActive(false);
    }
    setTimeout(() => setNavigationLocked(false), 250);
  }

  function prevCard() {
    if (index > 0) setIndex((value) => value - 1);
  }

  async function markCard(correct) {
    const currentCard = queue[index];
    if (!currentCard || navigationLocked) return;
    setNavigationLocked(true);
    try {
      const saved = await FlashcardService.updateCard(deckId, currentCard.id, updateSRS(currentCard, correct), currentUser);
      if (!saved) throw new Error('Card update failed.');
      setDeck((current) => ({ ...current, cards: (current?.cards || []).map((card) => card.id === currentCard.id ? saved : card) }));
      setSessionStats((current) => ({
        reviewed: current.reviewed + 1,
        correct: current.correct + (correct ? 1 : 0),
        incorrect: current.incorrect + (correct ? 0 : 1),
      }));
      const nextQueue = queue.filter((card) => card.id !== currentCard.id);
      setQueue(nextQueue);
      if (nextQueue.length === 0) {
        setSessionComplete(true);
        setTimerActive(false);
        setIndex(0);
      } else {
        setIndex((currentIndex) => Math.min(currentIndex, nextQueue.length - 1));
      }
      setShowBack(false);
      setAnswerInput('');
      setAnswerChecked(false);
      setIsCorrect(null);
      pan.setValue({ x: 0, y: 0 });
    } catch (error) {
      console.error('Could not update flashcard review:', error);
    } finally {
      setNavigationLocked(false);
    }
  }

  function checkTypedAnswer() {
    const currentCard = queue[index];
    if (!currentCard) return;
    const expected = String(currentCard.back || '').trim().toLowerCase();
    const provided = answerInput.trim().toLowerCase();
    setAnswerChecked(true);
    setIsCorrect(Boolean(provided) && provided === expected);
  }

  const currentCard = queue[index];
  const progress = getProgress(deck);
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 14,
    onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > 90) markCard(true);
      else if (gesture.dx < -90) markCard(false);
      else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  });

  if (loading) {
    return <ScreenLayout showHeader headerTitle="Study" showBackButton navigation={navigation}><View style={styles.centerState}><ActivityIndicator size="large" color={theme.colors.primary} /><Text style={styles.centerText}>Preparing cards…</Text></View></ScreenLayout>;
  }

  if (!deck) {
    return <ScreenLayout showHeader headerTitle="Study" showBackButton navigation={navigation}><View style={styles.centerState}><Text style={styles.emptyTitle}>Learning set not found</Text><SecondaryButton label="Go back" onPress={() => navigation.goBack()} /></View></ScreenLayout>;
  }

  if (sessionComplete || queue.length === 0) {
    return (
      <ScreenLayout showHeader headerTitle="Study" showBackButton navigation={navigation} scrollable>
        <Card style={styles.completeCard}>
          <AppIcon name="checkmark-circle-outline" size={34} color={theme.colors.accent} />
          <Text style={styles.completeTitle}>{queue.length === 0 && sessionStats.reviewed === 0 ? 'Nothing due right now' : 'Review complete'}</Text>
          <Text style={styles.completeText}>{sessionStats.reviewed > 0 ? `${sessionStats.correct} correct · ${sessionStats.incorrect} to revisit` : 'You are caught up with this learning set.'}</Text>
          <View style={styles.completeStats}>
            <View style={styles.completeStat}><Text style={styles.completeStatValue}>{progress.percent}%</Text><Text style={styles.completeStatLabel}>Mastered</Text></View>
            <View style={styles.completeStat}><Text style={styles.completeStatValue}>{deck.cards.length}</Text><Text style={styles.completeStatLabel}>Cards</Text></View>
          </View>
          <PrimaryButton label="Done" onPress={() => navigation.goBack()} />
        </Card>
      </ScreenLayout>
    );
  }

  const queueProgress = queue.length ? (index + 1) / queue.length : 0;

  return (
    <ScreenLayout showHeader headerTitle={deck.title} showBackButton navigation={navigation} scrollable contentContainerStyle={styles.content}>
      <View style={styles.progressHeader}><Text style={styles.progressLabel}>Card {index + 1} of {queue.length}</Text><Text style={styles.progressPercent}>{progress.percent}% mastered</Text></View>
      <ProgressBar progress={queueProgress} />

      {revisionMode ? (
        <Card style={styles.timerCard}>
          <AppIcon name="timer-outline" size={20} color={theme.colors.primary} />
          <View style={styles.timerCopy}><Text style={styles.timerLabel}>Revision timer</Text><Text style={styles.timerValue}>{Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}</Text></View>
          <TouchableOpacity onPress={() => setTimerActive((value) => !value)}><AppIcon name={timerActive ? 'pause-circle-outline' : 'play-circle-outline'} size={28} color={theme.colors.primary} /></TouchableOpacity>
        </Card>
      ) : (
        <TouchableOpacity style={styles.revisionLink} onPress={() => setShowTimerSetup((value) => !value)}><AppIcon name="timer-outline" size={18} color={theme.colors.primary} /><Text style={styles.revisionLinkText}>Timed revision mode</Text></TouchableOpacity>
      )}

      {showTimerSetup ? (
        <Card style={styles.timerSetupCard}>
          <Text style={styles.timerSetupTitle}>Timed revision</Text>
          <Text style={styles.timerSetupText}>Choose a preset or enter a custom total session time.</Text>
          <View style={styles.presetRow}>
            {[30, 60, 120].map((seconds) => <TouchableOpacity key={seconds} style={styles.presetButton} onPress={() => beginRevisionMode(seconds)}><Text style={styles.presetText}>{seconds}s</Text></TouchableOpacity>)}
          </View>
          <View style={styles.customRow}>
            <TextInput style={styles.customInput} value={customMinutes} onChangeText={setCustomMinutes} keyboardType="number-pad" placeholder="Min" placeholderTextColor={theme.colors.placeholder} />
            <Text style={styles.customSeparator}>:</Text>
            <TextInput style={styles.customInput} value={customSeconds} onChangeText={setCustomSeconds} keyboardType="number-pad" placeholder="Sec" placeholderTextColor={theme.colors.placeholder} />
          </View>
          <SecondaryButton label="Start custom timer" icon="play-outline" onPress={() => beginRevisionMode()} />
        </Card>
      ) : null}

      <Animated.View style={[styles.flashcardWrap, { transform: [{ translateX: pan.x }] }]} {...panResponder.panHandlers}>
        <Card style={styles.flashcard}>
          <TouchableOpacity style={styles.flashcardTouch} onPress={flipCard} activeOpacity={0.9}>
            <Text style={styles.faceLabel}>{showBack ? 'ANSWER' : 'QUESTION'}</Text>
            <Text style={styles.faceText}>{showBack ? currentCard.back : currentCard.front}</Text>
            <View style={styles.flipHint}><AppIcon name="sync-outline" size={16} color={theme.colors.textMuted} /><Text style={styles.flipHintText}>Tap to flip</Text></View>
          </TouchableOpacity>
        </Card>
      </Animated.View>

      {showBack ? (
        <View style={styles.answerActions}>
          <SecondaryButton label="Again" icon="refresh-outline" onPress={() => markCard(false)} style={styles.answerButton} />
          <PrimaryButton label="I knew this" icon="checkmark" onPress={() => markCard(true)} style={styles.answerButton} />
        </View>
      ) : (
        <Card style={styles.typeAnswerCard}>
          <Text style={styles.answerLabel}>Or type your answer</Text>
          <TextInput
            style={styles.answerInput}
            value={answerInput}
            onChangeText={(value) => { setAnswerInput(value); setAnswerChecked(false); setIsCorrect(null); }}
            placeholder="Type the answer from memory"
            placeholderTextColor={theme.colors.placeholder}
            onSubmitEditing={checkTypedAnswer}
          />
          <SecondaryButton label="Check answer" onPress={checkTypedAnswer} />
          {answerChecked ? <Text style={[styles.answerFeedback, { color: isCorrect ? theme.colors.accent : theme.colors.error }]}>{isCorrect ? 'Correct' : 'Not quite — flip the card to review it.'}</Text> : null}
        </Card>
      )}

      <View style={styles.navigationRow}>
        <TouchableOpacity style={styles.navButton} onPress={prevCard} disabled={index === 0}><AppIcon name="chevron-back" size={19} color={index === 0 ? theme.colors.textMuted : theme.colors.text} /><Text style={[styles.navButtonText, index === 0 && styles.navDisabled]}>Previous</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={nextCard}><Text style={styles.navButtonText}>Skip</Text><AppIcon name="chevron-forward" size={19} color={theme.colors.text} /></TouchableOpacity>
      </View>

      <Text style={styles.swipeHint}>Swipe right for known · left for again</Text>
    </ScreenLayout>
  );
}

const getStyles = (theme) => StyleSheet.create({
  content: { paddingBottom: spacing.xxxl },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  centerText: { fontFamily: typography.regular, color: theme.colors.textSecondary },
  emptyTitle: { fontFamily: typography.semibold, fontSize: 16, color: theme.colors.text },
  completeCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  completeTitle: { fontFamily: typography.bold, fontSize: 22, color: theme.colors.text, marginTop: spacing.md },
  completeText: { fontFamily: typography.regular, fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  completeStats: { width: '100%', flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.xl },
  completeStat: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.separator },
  completeStatValue: { fontFamily: typography.bold, fontSize: 22, color: theme.colors.text },
  completeStatLabel: { fontFamily: typography.regular, fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  progressLabel: { fontFamily: typography.semibold, fontSize: 11, color: theme.colors.textSecondary },
  progressPercent: { fontFamily: typography.semibold, fontSize: 11, color: theme.colors.primary },
  timerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  timerCopy: { flex: 1 },
  timerLabel: { fontFamily: typography.regular, fontSize: 10, color: theme.colors.textSecondary },
  timerValue: { fontFamily: typography.bold, fontSize: 18, color: theme.colors.text, marginTop: 1 },
  revisionLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
  revisionLinkText: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.primary },
  timerSetupCard: { marginTop: spacing.sm },
  timerSetupTitle: { fontFamily: typography.semibold, fontSize: 15, color: theme.colors.text },
  timerSetupText: { fontFamily: typography.regular, fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary, marginTop: 2 },
  presetRow: { flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.md },
  presetButton: { flex: 1, minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  presetText: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.text },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  customInput: { flex: 1, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.input, paddingHorizontal: spacing.md, textAlign: 'center', fontFamily: typography.semibold, color: theme.colors.text },
  customSeparator: { fontFamily: typography.bold, color: theme.colors.textSecondary },
  flashcardWrap: { marginTop: spacing.xl },
  flashcard: { minHeight: 330, padding: 0 },
  flashcardTouch: { flex: 1, minHeight: 330, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  faceLabel: { fontFamily: typography.semibold, fontSize: 11, letterSpacing: 1, color: theme.colors.primary },
  faceText: { fontFamily: typography.semibold, fontSize: 24, lineHeight: 34, color: theme.colors.text, textAlign: 'center', marginTop: spacing.lg },
  flipHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxl },
  flipHintText: { fontFamily: typography.regular, fontSize: 11, color: theme.colors.textMuted },
  answerActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  answerButton: { flex: 1 },
  typeAnswerCard: { marginTop: spacing.md },
  answerLabel: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.textSecondary, marginBottom: spacing.xs },
  answerInput: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.input, paddingHorizontal: spacing.md, fontFamily: typography.regular, fontSize: 14, color: theme.colors.text, marginBottom: spacing.sm },
  answerFeedback: { fontFamily: typography.semibold, fontSize: 12, marginTop: spacing.sm },
  navigationRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  navButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  navButtonText: { fontFamily: typography.semibold, fontSize: 12, color: theme.colors.text },
  navDisabled: { color: theme.colors.textMuted },
  swipeHint: { fontFamily: typography.regular, fontSize: 10, color: theme.colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});
