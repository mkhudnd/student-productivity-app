import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Animated, Dimensions, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { FlashcardService } from '../../utils/flashcardService';
import { localDateKey } from '../../utils/planRepository';
import ScreenLayout from '../../components/ScreenLayout';

const FLASHCARDS_FILE = 'flashcards.json';
const SCREEN_WIDTH = Dimensions.get('window').width;

function getTodayISO() {
  return localDateKey();
}

function getDueCards(deck) {
  const today = getTodayISO();
  return deck.cards.filter(card => !card.dueDate || card.dueDate <= today);
}

function getProgress(deck) {
  if (!deck || !deck.cards.length) return { known: 0, studied: 0, total: 0, percent: 0 };
  const known = deck.cards.filter(card => card.known).length;
  const studied = deck.cards.filter(card => card.known !== undefined).length;
  const total = deck.cards.length;
  const percent = Math.round((known / total) * 100);
  return { known, studied, total, percent };
}

function updateSRS(card, correct) {
  let { interval = 1, repetitions = 0, easeFactor = 2.5 } = card;
  let quality = correct ? 5 : 2;
  if (correct) {
    repetitions = (repetitions || 0) + 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(interval * easeFactor);
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
    lastStudied: getTodayISO(),
    known: correct,
  };
}

export default function StudyScreen({ route, navigation }) {
  if (!navigation) {
    console.error('StudyScreen: Navigation prop is undefined');
    return null;
  }
  if (typeof navigation.goBack !== 'function') {
    console.error('StudyScreen: navigation.goBack is not a function', navigation);
  }

  const safeGoBack = () => {
    try {
      if (navigation && typeof navigation.goBack === 'function') {
        navigation.goBack();
      } else if (navigation && typeof navigation.navigate === 'function') {
        navigation.navigate('Flashcards');
      } else {
        console.error('No valid navigation method available');
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const { theme } = useTheme();
  const { currentUser } = useUser();
  const { deckId, studyAll = false } = route?.params || {};
  const [deck, setDeck] = useState(null);
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [answerInput, setAnswerInput] = useState('');
  const [answerChecked, setAnswerChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const [dueCards, setDueCards] = useState([]);
  const [incorrectCards, setIncorrectCards] = useState([]);
  const [sessionComplete, setSessionComplete] = useState(false);
  const scrollViewRef = useRef(null);
  const [revisionMode, setRevisionMode] = useState(false);
  const [timeLimit, setTimeLimit] = useState(30);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [timerActive, setTimerActive] = useState(false);
  const [showTimerSetup, setShowTimerSetup] = useState(false);
  const timerRef = useRef(null);
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('2');
  const [customSeconds, setCustomSeconds] = useState('0');
  const [showFloatingTimer, setShowFloatingTimer] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    totalAnswered: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    timeoutAnswers: 0,
    totalTime: 0,
    averageTime: 0
  });
  const [navigationLocked, setNavigationLocked] = useState(false);

  useEffect(() => {
    loadDeck();
  }, []);

  useEffect(() => {
    setAnswerInput('');
    setAnswerChecked(false);
    setIsCorrect(null);
    setShowBack(false);
    if (studyAll) {
      setDueCards((deck && deck.cards) ? deck.cards : []);
    } else {
      setDueCards(getDueCards(deck || { cards: [] }));
    }
  }, [index, deck]);

  useEffect(() => {
    if (revisionMode && timerActive && timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (revisionMode && timeRemaining === 0) {
      handleSessionTimeOut();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [revisionMode, timerActive, timeRemaining]);

  const handleScroll = (event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    if (revisionMode && currentScrollY > 200) {
      setShowFloatingTimer(true);
    } else {
      setShowFloatingTimer(false);
    }
  };

  async function loadDeck() {
    setLoading(true);
    const found = await FlashcardService.getDeck(deckId, currentUser);
    setDeck(found);
    setIndex(0);
    setLoading(false);
    if (studyAll) {
      setDueCards((found && found.cards) ? found.cards : []);
    } else {
      setDueCards(getDueCards(found || { cards: [] }));
    }
  }

  function startRevisionMode() {
    setShowTimerSetup(false);
    setRevisionMode(true);
    setTimeRemaining(timeLimit);
    setTimerActive(true);
    setShowFloatingTimer(false);
    setSessionStats({
      totalAnswered: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      timeoutAnswers: 0,
      totalTime: 0,
      averageTime: 0
    });
  }

  function handleSessionTimeOut() {
    setTimerActive(false);
    setShowFloatingTimer(false);
    setSessionComplete(true);
  }

  function flipCard() {
    setShowBack(!showBack);
  }

  function nextCard() {
    if (navigationLocked) return;

    try {
      setNavigationLocked(true);
      setShowBack(false);
      if (!dueCards || !Array.isArray(dueCards)) {
        console.error('dueCards is not a valid array:', dueCards);
        setNavigationLocked(false);
        return;
      }
      if (index < dueCards.length - 1) {
        setIndex(prev => prev + 1);
      } else {
        setTimerActive(false);
        setShowFloatingTimer(false);
        setSessionComplete(true);
      }
      if (pan && typeof pan.setValue === 'function') {
        pan.setValue({ x: 0, y: 0 });
      }
      setAnswerInput('');
      setAnswerChecked(false);
      setIsCorrect(null);
      setTimeout(() => setNavigationLocked(false), 300);
    } catch (error) {
      console.error('Error in nextCard:', error);
      setNavigationLocked(false);
    }
  }

  function prevCard() {
    if (index > 0) {
      setIndex(prev => prev - 1);
      setShowBack(false);
      pan.setValue({ x: 0, y: 0 });
      setAnswerInput('');
      setAnswerChecked(false);
      setIsCorrect(null);
    }
  }

  async function markCard(correct) {
    if (!dueCards.length || !dueCards[index]) return;
    const currentCard = dueCards[index];
    const updatedCard = updateSRS(currentCard, correct);
    await FlashcardService.updateCard(deckId, currentCard.id, updatedCard, currentUser);
    if (!correct) {
      setIncorrectCards(prev => [...prev, currentCard]);
    }
    setSessionStats(prev => ({
      ...prev,
      totalAnswered: prev.totalAnswered + 1,
      correctAnswers: prev.correctAnswers + (correct ? 1 : 0),
      incorrectAnswers: prev.incorrectAnswers + (correct ? 0 : 1),
    }));
    await loadDeck();
    nextCard();
  }

  function checkTypedAnswer() {
    if (!dueCards.length || !dueCards[index]) return;
    const normalizedExpected = String(dueCards[index].back || '').trim().toLowerCase();
    const normalizedAnswer = answerInput.trim().toLowerCase();
    const correct = Boolean(normalizedAnswer) && normalizedExpected === normalizedAnswer;
    setAnswerChecked(true);
    setIsCorrect(correct);
  }

  const currentCard = dueCards[index];
  const progress = getProgress(deck);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 14,
    onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > 90) {
        markCard(true);
      } else if (gesture.dx < -90) {
        markCard(false);
      } else {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      }
    },
  });

  const styles = getStyles(theme);

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
          <Text style={styles.emptyTitle}>Deck not found</Text>
          <TouchableOpacity style={styles.doneButton} onPress={safeGoBack}>
            <Text style={styles.doneButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  if (sessionComplete || dueCards.length === 0) {
    return (
      <ScreenLayout showHeader headerTitle="Study" showBackButton navigation={navigation} scrollable>
        <View style={styles.completeCard}>
          <View style={styles.completeIcon}>
            <Ionicons name="checkmark-circle" size={34} color={theme.colors.accent} />
          </View>
          <Text style={styles.completeTitle}>{dueCards.length === 0 && !sessionComplete ? 'Nothing due right now' : 'Review complete'}</Text>
          <Text style={styles.completeText}>
            {sessionStats.totalAnswered > 0
              ? `${sessionStats.correctAnswers} correct · ${sessionStats.incorrectAnswers} to revisit`
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
          <TouchableOpacity style={styles.doneButton} onPress={safeGoBack}>
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
        <Text style={styles.progressLabel}>Card {index + 1} of {dueCards.length}</Text>
        <Text style={styles.progressPercent}>{progress.percent}% mastered</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${dueCards.length ? ((index + 1) / dueCards.length) * 100 : 0}%` }]} />
      </View>

      {revisionMode ? (
        <View style={styles.timerCard}>
          <Ionicons name="timer-outline" size={20} color={theme.colors.primary} />
          <View style={styles.timerCopy}>
            <Text style={styles.timerLabel}>Revision timer</Text>
            <Text style={styles.timerValue}>{Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}</Text>
          </View>
          <TouchableOpacity onPress={() => setTimerActive(value => !value)}>
            <Ionicons name={timerActive ? 'pause-circle-outline' : 'play-circle-outline'} size={28} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.revisionLink} onPress={() => setShowTimerSetup(true)}>
          <Ionicons name="timer-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.revisionLinkText}>Timed revision mode</Text>
        </TouchableOpacity>
      )}

      <Animated.View
        style={[styles.flashcard, { transform: [{ translateX: pan.x }] }]}
        {...panResponder.panHandlers}
      >
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
            {[30, 60, 120].map(seconds => (
              <TouchableOpacity
                key={seconds}
                style={[styles.timerPreset, timeLimit === seconds && styles.timerPresetActive]}
                onPress={() => {
                  setUseCustomTime(false);
                  setTimeLimit(seconds);
                }}
              >
                <Text style={[styles.timerPresetText, timeLimit === seconds && styles.timerPresetTextActive]}>{seconds}s</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.customTimeToggle} onPress={() => setUseCustomTime(value => !value)}>
            <Text style={styles.customTimeToggleText}>Custom time</Text>
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
            <TouchableOpacity
              style={styles.timerStartButton}
              onPress={() => {
                if (useCustomTime) {
                  const seconds = Math.max(1, Number(customMinutes || 0) * 60 + Number(customSeconds || 0));
                  setTimeLimit(seconds);
                  setTimeRemaining(seconds);
                }
                startRevisionMode();
              }}
            >
              <Text style={styles.timerStartText}>Start timer</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {showFloatingTimer && revisionMode ? (
        <View style={styles.floatingTimer}>
          <Ionicons name="timer" size={16} color={theme.colors.primary} />
          <Text style={styles.floatingTimerText}>{Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}</Text>
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
  floatingTimer: { position: 'absolute', right: 14, top: 14, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  floatingTimerText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: theme.colors.primary },
});
