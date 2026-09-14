import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { FlashcardService } from '../../utils/flashcardService';
import { localDateKey } from '../../utils/planRepository';
import ScreenLayout from '../../components/ScreenLayout';

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
  const [timeLimit, setTimeLimit] = useState(60);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const [showTimerSetup, setShowTimerSetup] = useState(false);
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('2');
  const [customSeconds, setCustomSeconds] = useState('0');
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, reviewed: 0 });
  const [navigationLocked, setNavigationLocked] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;
  const timerRef = useRef(null);

  useEffect(() => {
    loadDeck();
  }, [deckId, currentUser?.email]);

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
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [revisionMode, timerActive, timeRemaining]);

  async function loadDeck() {
    setLoading(true);
    try {
      const found = await FlashcardService.getDeck(deckId, currentUser);
      setDeck(found);
      const initialQueue = found ? (studyAll ? [...(found.cards || [])] : getDueCards(found)) : [];
      setQueue(initialQueue);
      setIndex(0);
      setSessionComplete(false);
    } finally {
      setLoading(false);
    }
  }

  function beginRevisionMode() {
    const customDuration = Math.max(1, Number(customMinutes || 0) * 60 + Number(customSeconds || 0));
    const duration = useCustomTime ? customDuration : timeLimit;
    setTimeLimit(duration);
    setTimeRemaining(duration);
    setTimerActive(true);
    setRevisionMode(true);
    setShowTimerSetup(false);
    setSessionStats({ correct: 0, incorrect: 0, reviewed: 0 });
  }

  function flipCard() {
    setShowBack((value) => !value);
  }

  function nextCard() {
    if (navigationLocked || queue.length === 0) return;
    setNavigationLocked(true);
    if (index < queue.length - 1) {
      setIndex((value) => value + 1);
    } else {
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
      const updatedCard = updateSRS(currentCard, correct);
      const saved = await FlashcardService.updateCard(deckId, currentCard.id, updatedCard, currentUser);
      if (!saved) throw new Error('Card update failed.');

      setDeck((current) => ({
        ...current,
        cards: (current?.cards || []).map((card) => (card.id === currentCard.id ? saved : card)),
      }));
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
    return (
      <ScreenLayout showHeader headerTitle="Study" showBackButton navigation={navigation}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.centerStateText}>Preparing cards…</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (!deck) {
    return (
      <ScreenLayout showHeader headerTitle="Study" showBackButton navigation={navigation}>
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>Learning set not found</Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  if (sessionComplete || queue.length === 0) {
    return (
      <ScreenLayout showHeader headerTitle="Study" showBackButton navigation={navigation} scrollable>
        <View style={styles.completeCard}>
          <View style={styles.completeIcon}>
            <Ionicons name="checkmark-circle" size={34} color={theme.colors.accent} />
          </View>
          <Text style={styles.completeTitle}>{queue.length === 0 && sessionStats.reviewed === 0 ? 'Nothing due right now' : 'Review complete'}</Text>
          <Text style={styles.completeText}>
            {sessionStats.reviewed > 0
              ? `${sessionStats.correct} correct · ${sessionStats.incorrect} to revisit`
              : 'You are caught up with this learning set.'}
          </Text>
          <View style={styles.completeStats}>
            <View style={styles.completeStat}>
              <Text style={styles.completeStatValue}>{progress.percent}%</Text>
              <Text style={styles.completeStatLabel}>Mastered</Text>
            </View>
            <View style={styles.completeStat}>
              <Text style={styles.completeStatValue}>{deck.cards.length}</Text>
              <Text style={styles.completeStatLabel}>Cards</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      showHeader
      headerTitle={deck.title}
      showBackButton
      navigation={navigation}
      scrollable
      contentContainerStyle={styles.content}
    >
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>Card {index + 1} of {queue.length}</Text>
        <Text style={styles.progressPercent}>{progress.percent}% mastered</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${queue.length ? ((index + 1) / queue.length) * 100 : 0}%` }]} />
      </View>

      {revisionMode ? (
        <View style={styles.timerCard}>
          <Ionicons name="timer-outline" size={20} color={theme.colors.primary} />
          <View style={styles.timerCopy}>
            <Text style={styles.timerLabel}>Revision timer</Text>
            <Text style={styles.timerValue}>{Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}</Text>
          </View>
          <TouchableOpacity onPress={() => setTimerActive((value) => !value)}>
            <Ionicons name={timerActive ? 'pause-circle-outline' : 'play-circle-outline'} size={28} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.revisionLink} onPress={() => setShowTimerSetup(true)}>
          <Ionicons name="timer-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.revisionLinkText}>Timed revision mode</Text>
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.flashcard, { transform: [{ translateX: pan.x }] }]} {...panResponder.panHandlers}>
        <TouchableOpacity style={styles.flashcardTouch} onPress={flipCard} activeOpacity={0.9}>
          <Text style={styles.faceLabel}>{showBack ? 'ANSWER' : 'QUESTION'}</Text>
          <Text style={styles.faceText}>{showBack ? currentCard.back : currentCard.front}</Text>
          <View style={styles.flipHint}>
            <Ionicons name="sync-outline" size={16} color={theme.colors.textMuted} />
            <Text style={styles.flipHintText}>Tap to flip</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {showBack ? (
        <View style={styles.answerActions}>
          <TouchableOpacity style={styles.againButton} onPress={() => markCard(false)}>
            <Ionicons name="refresh-outline" size={19} color={theme.colors.error} />
            <Text style={styles.againText}>Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.knowButton} onPress={() => markCard(true)}>
            <Ionicons name="checkmark" size={19} color={theme.colors.primaryText} />
            <Text style={styles.knowText}>I knew this</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.typeAnswerCard}>
          <Text style={styles.answerLabel}>Or type your answer</Text>
          <TextInput
            style={styles.answerInput}
            value={answerInput}
            onChangeText={(value) => {
              setAnswerInput(value);
              setAnswerChecked(false);
              setIsCorrect(null);
            }}
            placeholder="Type the answer from memory"
            placeholderTextColor={theme.colors.placeholder}
            onSubmitEditing={checkTypedAnswer}
          />
          <TouchableOpacity style={styles.checkButton} onPress={checkTypedAnswer}>
            <Text style={styles.checkButtonText}>Check answer</Text>
          </TouchableOpacity>
          {answerChecked ? (
            <Text style={[styles.answerFeedback, { color: isCorrect ? theme.colors.accent : theme.colors.error }]}>
              {isCorrect ? 'Correct' : 'Not quite — flip the card to review it.'}
            </Text>
          ) : null}
        </View>
      )}

      <View style={styles.navigationRow}>
        <TouchableOpacity style={[styles.navButton, index === 0 && styles.navButtonDisabled]} onPress={prevCard} disabled={index === 0}>
          <Ionicons name="chevron-back" size={19} color={index === 0 ? theme.colors.textMuted : theme.colors.text} />
          <Text style={[styles.navButtonText, index === 0 && { color: theme.colors.textMuted }]}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={nextCard}>
          <Text style={styles.navButtonText}>Skip</Text>
          <Ionicons name="chevron-forward" size={19} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {showTimerSetup ? (
        <View style={styles.timerSetupCard}>
          <Text style={styles.timerSetupTitle}>Timed revision</Text>
          <Text style={styles.timerSetupText}>Set a total session time, then work through as many cards as you can.</Text>
          <View style={styles.timerPresetRow}>
            {[30, 60, 120].map((seconds) => (
              <TouchableOpacity
                key={seconds}
                style={[styles.timerPreset, !useCustomTime && timeLimit === seconds && styles.timerPresetActive]}
                onPress={() => {
                  setUseCustomTime(false);
                  setTimeLimit(seconds);
                }}
              >
                <Text style={[styles.timerPresetText, !useCustomTime && timeLimit === seconds && styles.timerPresetTextActive]}>{seconds}s</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.customTimeToggle} onPress={() => setUseCustomTime((value) => !value)}>
            <Text style={styles.customTimeToggleText}>{useCustomTime ? 'Use preset time' : 'Custom time'}</Text>
          </TouchableOpacity>
          {useCustomTime ? (
            <View style={styles.customTimeRow}>
              <TextInput
                style={styles.customTimeInput}
                value={customMinutes}
                onChangeText={setCustomMinutes}
                keyboardType="number-pad"
                placeholder="Min"
                placeholderTextColor={theme.colors.placeholder}
              />
              <TextInput
                style={styles.customTimeInput}
                value={customSeconds}
                onChangeText={setCustomSeconds}
                keyboardType="number-pad"
                placeholder="Sec"
                placeholderTextColor={theme.colors.placeholder}
              />
            </View>
          ) : null}
          <View style={styles.timerSetupActions}>
            <TouchableOpacity style={styles.timerCancelButton} onPress={() => setShowTimerSetup(false)}>
              <Text style={styles.timerCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.timerStartButton} onPress={beginRevisionMode}>
              <Text style={styles.timerStartText}>Start timer</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </ScreenLayout>
  );
}

const getStyles = (theme) => StyleSheet.create({
  content: { paddingBottom: 36 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  centerStateText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: theme.colors.textSecondary },
  emptyTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: theme.colors.text },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: theme.colors.textSecondary },
  progressPercent: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: theme.colors.primary },
  progressTrack: { height: 7, borderRadius: 99, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden', marginTop: 8, marginBottom: 18 },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: theme.colors.primary },
  revisionLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, backgroundColor: theme.colors.primarySoft, marginBottom: 14 },
  revisionLinkText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: theme.colors.primary },
  timerCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: theme.colors.primarySoft, paddingHorizontal: 14, marginBottom: 14 },
  timerCopy: { flex: 1 },
  timerLabel: { fontFamily: 'Poppins_400Regular', fontSize: 10, color: theme.colors.textSecondary },
  timerValue: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: theme.colors.text },
  flashcard: { minHeight: 310, borderRadius: 26, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#111827', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 2 },
  flashcardTouch: { minHeight: 310, alignItems: 'center', justifyContent: 'center', padding: 28 },
  faceLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, letterSpacing: 1, color: theme.colors.primary, marginBottom: 14 },
  faceText: { fontFamily: 'Poppins_600SemiBold', fontSize: 24, lineHeight: 34, color: theme.colors.text, textAlign: 'center' },
  flipHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 26 },
  flipHintText: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: theme.colors.textMuted },
  answerActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  againButton: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16, backgroundColor: `${theme.colors.error}10` },
  againText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: theme.colors.error },
  knowButton: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16, backgroundColor: theme.colors.primary },
  knowText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: theme.colors.primaryText },
  typeAnswerCard: { marginTop: 14, borderRadius: 20, padding: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  answerLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: theme.colors.textSecondary, marginBottom: 7 },
  answerInput: { minHeight: 48, borderRadius: 14, backgroundColor: theme.colors.input, paddingHorizontal: 14, fontFamily: 'Poppins_400Regular', fontSize: 13, color: theme.colors.text },
  checkButton: { alignSelf: 'flex-end', marginTop: 10, minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: theme.colors.primarySoft },
  checkButtonText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: theme.colors.primary },
  answerFeedback: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, marginTop: 8 },
  navigationRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 14 },
  navButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12 },
  navButtonDisabled: { opacity: 0.5 },
  navButtonText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: theme.colors.text },
  completeCard: { alignItems: 'center', borderRadius: 26, padding: 30, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  completeIcon: { width: 62, height: 62, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSoft },
  completeTitle: { fontFamily: 'Poppins_700Bold', fontSize: 22, color: theme.colors.text, marginTop: 16 },
  completeText: { fontFamily: 'Poppins_400Regular', fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6 },
  completeStats: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 22 },
  completeStat: { flex: 1, borderRadius: 16, backgroundColor: theme.colors.surfaceMuted, padding: 14, alignItems: 'center' },
  completeStatValue: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: theme.colors.text },
  completeStatLabel: { fontFamily: 'Poppins_400Regular', fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 },
  doneButton: { marginTop: 20, minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, borderRadius: 15, backgroundColor: theme.colors.primary },
  doneButtonText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: theme.colors.primaryText },
  timerSetupCard: { marginTop: 14, borderRadius: 20, padding: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  timerSetupTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: theme.colors.text },
  timerSetupText: { fontFamily: 'Poppins_400Regular', fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary, marginTop: 3 },
  timerPresetRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  timerPreset: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: theme.colors.surfaceMuted },
  timerPresetActive: { backgroundColor: theme.colors.primary },
  timerPresetText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: theme.colors.textSecondary },
  timerPresetTextActive: { color: theme.colors.primaryText },
  customTimeToggle: { alignSelf: 'flex-start', marginTop: 12 },
  customTimeToggleText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: theme.colors.primary },
  customTimeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  customTimeInput: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: theme.colors.input, paddingHorizontal: 12, fontFamily: 'Poppins_400Regular', fontSize: 12, color: theme.colors.text },
  timerSetupActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  timerCancelButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: theme.colors.surfaceMuted },
  timerCancelText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: theme.colors.textSecondary },
  timerStartButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: theme.colors.primary },
  timerStartText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: theme.colors.primaryText },
});
