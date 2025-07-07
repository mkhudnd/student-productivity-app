import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Animated, Dimensions, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { FlashcardService } from '../../utils/flashcardService';
import ScreenLayout from '../../components/ScreenLayout';

const FLASHCARDS_FILE = 'flashcards.json';
const SCREEN_WIDTH = Dimensions.get('window').width;

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
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
  // SM-2 algorithm (simplified)
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
    // easeFactor unchanged
  }
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + interval);
  return {
    ...card,
    interval,
    repetitions,
    easeFactor,
    dueDate: nextDue.toISOString().slice(0, 10),
    lastStudied: getTodayISO(),
    known: correct,
  };
}

export default function StudyScreen({ route, navigation }) {
  // Safety check for navigation
  if (!navigation) {
    console.error('StudyScreen: Navigation prop is undefined');
    return null;
  }
  
  // Defensive check for navigation methods
  if (typeof navigation.goBack !== 'function') {
    console.error('StudyScreen: navigation.goBack is not a function', navigation);
  }

  // Safe navigation function to prevent undefined errors
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
  
  // Revision mode states
  const [revisionMode, setRevisionMode] = useState(false);
  const [timeLimit, setTimeLimit] = useState(30); // total session time in seconds
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [timerActive, setTimerActive] = useState(false);
  const [showTimerSetup, setShowTimerSetup] = useState(false);
  const timerRef = useRef(null);
  
  // Custom time input states
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('2');
  const [customSeconds, setCustomSeconds] = useState('0');
  
  // Floating timer states
  const [showFloatingTimer, setShowFloatingTimer] = useState(false);
  
  // Add session statistics tracking
  const [sessionStats, setSessionStats] = useState({
    totalAnswered: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    timeoutAnswers: 0,
    totalTime: 0,
    averageTime: 0
  });
  
  // Navigation lock to prevent rapid calls
  const [navigationLocked, setNavigationLocked] = useState(false);

  useEffect(() => {
    loadDeck();
  }, []);

  useEffect(() => {
    setAnswerInput('');
    setAnswerChecked(false);
    setIsCorrect(null);
    setShowBack(false);
    
    // Don't reset timer for revision mode when changing cards
    // Timer should continue running throughout the session
    
    if (studyAll) {
      setDueCards((deck && deck.cards) ? deck.cards : []);
    } else {
      setDueCards(getDueCards(deck || { cards: [] }));
    }
  }, [index, deck]);

  // Timer effect for revision mode - continuous countdown
  useEffect(() => {
    if (revisionMode && timerActive && timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (revisionMode && timeRemaining === 0) {
      // Time's up - end the entire session
      handleSessionTimeOut();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [revisionMode, timerActive, timeRemaining]);

  // Handle scroll to show/hide floating timer
  const handleScroll = (event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    
    // Show floating timer if scrolled past timer section (approximately 200px) and in revision mode
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
    // Reset stats for revision mode
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
    
    // End the entire session when time runs out
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
      
      // Safety check for dueCards array
      if (!dueCards || !Array.isArray(dueCards)) {
        console.error('dueCards is not a valid array:', dueCards);
        setNavigationLocked(false);
        return;
      }
      
      // Don't stop timer in revision mode - let it continue running
      if (index < dueCards.length - 1) {
        setIndex(prev => prev + 1);
      } else {
        // Completed all cards or session ended
        setTimerActive(false);
        setShowFloatingTimer(false);
        setSessionComplete(true);
      }
      
      // Safety check for pan animation
      if (pan && typeof pan.setValue === 'function') {
        pan.setValue({ x: 0, y: 0 });
      }
      
      setAnswerInput('');
      setAnswerChecked(false);
      setIsCorrect(null);
      
      // Unlock navigation after a brief delay
      setTimeout(() => setNavigationLocked(false), 300);
    } catch (error) {
      console.error('Error in nextCard:', error);
      setNavigationLocked(false);
    }
  }

  function prevCard() {
    if (navigationLocked) return;
    
    try {
      setNavigationLocked(true);
      setShowBack(false);
      // Don't stop timer in revision mode - let it continue running
      setIndex((prev) => (prev > 0 ? prev - 1 : prev));
      pan.setValue({ x: 0, y: 0 });
      setAnswerInput('');
      setAnswerChecked(false);
      setIsCorrect(null);
      
      // Unlock navigation after a brief delay
      setTimeout(() => setNavigationLocked(false), 300);
    } catch (error) {
      console.error('Error in prevCard:', error);
      setNavigationLocked(false);
    }
  }

  async function markKnown(known, autoAdvance = false) {
    if (!deck) return;
    const dueCard = dueCards[index];
    const updatedCard = updateSRS(dueCard, known);
    const updatedCards = deck.cards.map(card => card.id === dueCard.id ? updatedCard : card);
    const updatedDeck = { ...deck, cards: updatedCards };
    
    await FlashcardService.updateDeck(deckId, { cards: updatedCards }, currentUser);
    setDeck(updatedDeck);
    
    if (autoAdvance) {
      setTimeout(() => {
        setDueCards(getDueCards(updatedDeck));
        if (index < getDueCards(updatedDeck).length - 1) nextCard();
        else setIndex(0);
      }, 100);
    } else {
      // Just update the due cards without advancing
      setDueCards(getDueCards(updatedDeck));
    }
  }

  function checkAnswer() {
    const timeSpent = revisionMode ? (timeLimit - timeRemaining) : 0;
    // Don't stop timer in revision mode - let it continue running
    
    // Safety checks for deck and cards
    if (!deck || !deck.cards || !Array.isArray(deck.cards) || index >= deck.cards.length) {
      console.error('Invalid deck or card index:', { deck, index, cardsLength: deck?.cards?.length });
      return;
    }
    
    const currentCard = deck.cards[index];
    if (!currentCard || typeof currentCard.back !== 'string') {
      console.error('Invalid card or missing back property:', currentCard);
      return;
    }
    
    const correct = answerInput.trim().toLowerCase() === currentCard.back.trim().toLowerCase();
    setIsCorrect(correct);
    setAnswerChecked(true);
    setShowBack(true);
    
    // Update session statistics
    setSessionStats(prev => ({
      totalAnswered: prev.totalAnswered + 1,
      correctAnswers: prev.correctAnswers + (correct ? 1 : 0),
      incorrectAnswers: prev.incorrectAnswers + (correct ? 0 : 1),
      timeoutAnswers: prev.timeoutAnswers,
      totalTime: prev.totalTime + timeSpent,
      averageTime: revisionMode ? (prev.totalTime + timeSpent) / (prev.totalAnswered + 1) : prev.averageTime
    }));
    
    // Record the result in the SRS system without auto-advance
    markKnown(correct, false);
    
    // Track incorrect answers for review
    if (!correct) {
      setIncorrectCards(prev => [...prev, { 
        front: currentCard.front || 'Unknown', 
        correct: currentCard.back || 'Unknown', 
        yourAnswer: answerInput,
        timeSpent: timeSpent
      }]);
    }
    
    // Auto-advance to next card if answer is correct
    if (correct) {
      setTimeout(() => {
        nextCard();
      }, 1500); // 1.5 second delay to show success feedback
    }
  }

  // Function to scroll to answer input when it gets focus
  const scrollToAnswerInput = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // PanResponder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20,
      onPanResponderMove: Animated.event([
        null,
        { dx: pan.x, dy: pan.y },
      ], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        try {
          if (gesture.dx > 80) {
            prevCard();
          } else if (gesture.dx < -80) {
            nextCard();
          } else if (gesture.dy < -60) {
            flipCard();
          }
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        } catch (error) {
          console.error('Error in PanResponder release:', error);
          // Reset animation in case of error
          pan.setValue({ x: 0, y: 0 });
        }
      },
    })
  ).current;

  function handleCustomTimeChange() {
    const minutes = parseInt(customMinutes) || 0;
    const seconds = parseInt(customSeconds) || 0;
    const totalSeconds = (minutes * 60) + seconds;
    
    // Validation: minimum 30 seconds, maximum 60 minutes
    if (totalSeconds < 30) {
      setCustomMinutes('0');
      setCustomSeconds('30');
      setTimeLimit(30);
    } else if (totalSeconds > 3600) {
      setCustomMinutes('60');
      setCustomSeconds('0');
      setTimeLimit(3600);
    } else {
      setTimeLimit(totalSeconds);
    }
  }

  function handlePresetTimeSelect(seconds) {
    setTimeLimit(seconds);
    setUseCustomTime(false);
  }

  function handleCustomTimeToggle() {
    setUseCustomTime(!useCustomTime);
    if (!useCustomTime) {
      // Switching to custom time - convert current timeLimit to minutes/seconds
      const minutes = Math.floor(timeLimit / 60);
      const seconds = timeLimit % 60;
      setCustomMinutes(minutes.toString());
      setCustomSeconds(seconds.toString());
    }
  }

  const styles = getStyles(theme);

  if (loading || !deck) {
    return (
      <ScreenLayout
        showHeader={true}
        headerTitle="Study Session"
        headerIcon="school-outline"
        navigation={navigation}
      >
        <View style={styles.loadingContainer}>
          <Ionicons name="hourglass-outline" size={48} color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading study session...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (!deck.cards.length) {
    return (
      <ScreenLayout
        showHeader={true}
        headerTitle="Study Session"
        headerIcon="school-outline"
        navigation={navigation}
      >
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <Ionicons name="albums-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Cards Available</Text>
            <Text style={styles.emptySubtitle}>This deck doesn't contain any flashcards yet.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
              <Ionicons name="add-outline" size={20} color={theme.colors.background} />
              <Text style={styles.primaryButtonText}>Add Cards</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScreenLayout>
    );
  }

  if (!dueCards.length) {
    // No cards available to study - show different message
    return (
      <ScreenLayout
        showHeader={true}
        headerTitle="Study Session"
        headerIcon="school-outline"
        scrollable={true}
        navigation={navigation}
      >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Study Complete</Text>
            <View style={styles.completeCard}>
              <Ionicons name="checkmark-circle-outline" size={64} color={theme.colors.primary} />
              <Text style={styles.completeTitle}>{deck?.title || ''}</Text>
              <Text style={styles.completeSubtitle}>
                {studyAll ? 'No cards in this deck.' : 'All cards are up to date! No cards due for review today.'}
              </Text>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
                  <Ionicons name="library-outline" size={20} color={theme.colors.background} />
                  <Text style={styles.primaryButtonText}>Back to Decks</Text>
                </TouchableOpacity>
                {!studyAll && (
                  <TouchableOpacity 
                    style={styles.secondaryButton} 
                    onPress={() => {
                      // Reset and study all cards
                      setSessionStats({
                        totalAnswered: 0,
                        correctAnswers: 0,
                        incorrectAnswers: 0
                      });
                      setIndex(0);
                      setSessionComplete(false);
                      setDueCards(deck.cards || []);
                    }}
                  >
                    <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.secondaryButtonText}>Study All Cards</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={styles.accentButton} 
                  onPress={() => setShowTimerSetup(true)}
                >
                  <Ionicons name="timer-outline" size={20} color={theme.colors.background} />
                  <Text style={styles.accentButtonText}>Restart Revision</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
      </ScreenLayout>
    );
  }

  if (sessionComplete) {
    // Session completed after answering questions - show statistics
    const total = sessionStats.totalAnswered;
    const correct = sessionStats.correctAnswers;
    const incorrect = sessionStats.incorrectAnswers;
    const timeouts = sessionStats.timeoutAnswers;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const timeElapsed = timeLimit - timeRemaining;
    
    const handleStudyAgain = () => {
      setIndex(0);
      setIncorrectCards([]);
      setSessionComplete(false);
      setAnswerInput('');
      setAnswerChecked(false);
      setIsCorrect(null);
      setShowBack(false);
      setTimerActive(false);
      setShowFloatingTimer(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      
      // Reset session statistics
      setSessionStats({
        totalAnswered: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        timeoutAnswers: 0,
        totalTime: 0,
        averageTime: 0
      });
      if (studyAll) {
        setDueCards((deck && deck.cards) ? deck.cards : []);
      } else {
        setDueCards(getDueCards(deck || { cards: [] }));
      }
    };
    
    return (
      <ScreenLayout
        showHeader={true}
        headerTitle="Session Complete"
        headerIcon="trophy-outline"
        scrollable={true}
        navigation={navigation}
      >
          {/* Session Results */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {revisionMode ? 
                (timeRemaining === 0 ? 'Time\'s Up!' : 'Revision Complete!') : 
                'Session Complete!'
              }
            </Text>
            <View style={styles.resultsCard}>
              <View style={styles.resultsHeader}>
                <Ionicons 
                  name={revisionMode ? 
                    (timeRemaining === 0 ? "time-outline" : "timer-outline") : 
                    "trophy-outline"
                  } 
                  size={32} 
                  color={timeRemaining === 0 ? "#FF9800" : theme.colors.primary} 
                />
                <Text style={styles.resultsTitle}>{deck?.title || ''}</Text>
                {revisionMode && (
                  <Text style={styles.revisionModeLabel}>
                    ⏱️ {Math.floor(timeLimit / 60)}:{(timeLimit % 60).toString().padStart(2, '0')} session time
                  </Text>
                )}
                {revisionMode && timeRemaining === 0 && (
                  <Text style={styles.timeoutSessionLabel}>
                    Session ended - time ran out
                  </Text>
                )}
              </View>
              
              {total > 0 ? (
                <>
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>{correct} / {total}</Text>
                    <Text style={styles.accuracyText}>{accuracy}% Accuracy</Text>
                    {revisionMode && (
                      <Text style={styles.averageTimeText}>
                        Completed in {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                      <Ionicons name="checkmark-circle-outline" size={24} color="#4CAF50" />
                      <Text style={styles.statValue}>{correct}</Text>
                      <Text style={styles.statLabel}>Correct</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="close-circle-outline" size={24} color="#F44336" />
                      <Text style={styles.statValue}>{incorrect}</Text>
                      <Text style={styles.statLabel}>Incorrect</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="albums-outline" size={24} color={theme.colors.primary} />
                      <Text style={styles.statValue}>{total}</Text>
                      <Text style={styles.statLabel}>Answered</Text>
                    </View>
                    {revisionMode && (
                      <View style={styles.statItem}>
                        <Ionicons name="hourglass-outline" size={24} color={theme.colors.textSecondary} />
                        <Text style={styles.statValue}>{dueCards.length - total}</Text>
                        <Text style={styles.statLabel}>Remaining</Text>
                      </View>
                    )}
                  </View>

                  {revisionMode && (
                    <View style={styles.timeStatsContainer}>
                      <View style={styles.timeStatItem}>
                        <Text style={styles.timeStatLabel}>Time Used:</Text>
                        <Text style={styles.timeStatValue}>
                          {Math.floor(timeElapsed / 60)}m {timeElapsed % 60}s
                        </Text>
                      </View>
                      {timeRemaining > 0 && (
                        <View style={styles.timeStatItem}>
                          <Text style={styles.timeStatLabel}>Time Left:</Text>
                          <Text style={styles.timeStatValue}>
                            {Math.floor(timeRemaining / 60)}m {timeRemaining % 60}s
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.noStudyText}>No cards studied in this session.</Text>
              )}
            </View>
          </View>

          {/* Incorrect Answers Review */}
          {incorrectCards.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Review Incorrect Answers
              </Text>
              {incorrectCards.map((c, i) => (
                <View key={i} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Ionicons name="help-circle-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.reviewQuestion}>{c.front}</Text>
                  </View>
                  <View style={styles.reviewContent}>
                    <View style={styles.reviewAnswer}>
                      <Ionicons name="close-outline" size={16} color="#F44336" />
                      <Text style={styles.incorrectAnswer}>
                        Your answer: {c.yourAnswer}
                      </Text>
                    </View>
                    <View style={styles.reviewAnswer}>
                      <Ionicons name="checkmark-outline" size={16} color="#4CAF50" />
                      <Text style={styles.correctAnswer}>Correct answer: {c.correct}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.section}>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
                <Ionicons name="library-outline" size={20} color={theme.colors.background} />
                <Text style={styles.primaryButtonText}>Back to Decks</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleStudyAgain}>
                <Ionicons 
                  name={revisionMode ? "timer-outline" : "refresh-outline"} 
                  size={20} 
                  color={theme.colors.primary} 
                />
                <Text style={styles.secondaryButtonText}>
                  {revisionMode ? 'Revision Again' : 'Study Again'}
                </Text>
              </TouchableOpacity>
              {revisionMode && (
                <TouchableOpacity 
                  style={styles.secondaryButton} 
                  onPress={() => {
                    setRevisionMode(false);
                    handleStudyAgain();
                  }}
                >
                  <Ionicons name="book-outline" size={20} color={theme.colors.primary} />
                  <Text style={styles.secondaryButtonText}>Normal Study</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
      </ScreenLayout>
    );
  }

  // Safety check for card access
  const card = dueCards && Array.isArray(dueCards) && index < dueCards.length ? dueCards[index] : null;
  const progress = getProgress(deck);
  
  // If no valid card, show error state
  if (!card) {
    return (
      <ScreenLayout
        showHeader={true}
        headerTitle="Study Session"
        headerIcon="school-outline"
        navigation={navigation}
      >
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>Card Error</Text>
            <Text style={styles.emptySubtitle}>Unable to load the current flashcard. Please try again.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={safeGoBack}>
              <Ionicons name="arrow-back-outline" size={20} color={theme.colors.background} />
              <Text style={styles.primaryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScreenLayout>
    );
  }

  // Timer setup modal
  if (showTimerSetup) {
    return (
      <ScreenLayout
        showHeader={true}
        headerTitle="Timer Setup"
        headerIcon="timer-outline"
        scrollable={true}
        navigation={navigation}
      >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Revision Mode Setup</Text>
            <View style={styles.setupCard}>
              <View style={styles.setupHeader}>
                <Ionicons name="timer-outline" size={32} color={theme.colors.primary} />
                <Text style={styles.setupTitle}>Timed Study Session</Text>
              </View>
              
              <Text style={styles.setupDescription}>
                Race against the clock! You have a limited time to complete all flashcards. 
                The timer counts down continuously - if it reaches zero, the session ends immediately.
              </Text>
              
              <View style={styles.timeLimitSection}>
                <View style={styles.timeTypeToggle}>
                  <TouchableOpacity
                    style={[styles.toggleOption, !useCustomTime && styles.toggleOptionActive]}
                    onPress={() => setUseCustomTime(false)}
                  >
                    <Text style={[styles.toggleOptionText, !useCustomTime && styles.toggleOptionTextActive]}>
                      Preset Times
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleOption, useCustomTime && styles.toggleOptionActive]}
                    onPress={handleCustomTimeToggle}
                  >
                    <Text style={[styles.toggleOptionText, useCustomTime && styles.toggleOptionTextActive]}>
                      Custom Time
                    </Text>
                  </TouchableOpacity>
                </View>

                {!useCustomTime ? (
                  <>
                    <Text style={styles.timeLimitLabel}>Choose session time:</Text>
                    <View style={styles.timeLimitOptions}>
                      {[
                        { seconds: 60, label: '1m' },
                        { seconds: 120, label: '2m' },
                        { seconds: 300, label: '5m' },
                        { seconds: 600, label: '10m' }
                      ].map(time => (
                        <TouchableOpacity
                          key={time.seconds}
                          style={[styles.timeLimitOption, timeLimit === time.seconds && styles.timeLimitOptionSelected]}
                          onPress={() => handlePresetTimeSelect(time.seconds)}
                        >
                          <Text style={[styles.timeLimitOptionText, timeLimit === time.seconds && styles.timeLimitOptionTextSelected]}>
                            {time.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.timeLimitLabel}>Set custom time:</Text>
                    <View style={styles.customTimeContainer}>
                      <View style={styles.customTimeInput}>
                        <TextInput
                          style={styles.timeInput}
                          value={customMinutes}
                          onChangeText={setCustomMinutes}
                          onBlur={handleCustomTimeChange}
                          keyboardType="numeric"
                          maxLength={2}
                          placeholder="0"
                          placeholderTextColor={theme.colors.textSecondary}
                        />
                        <Text style={styles.timeLabel}>min</Text>
                      </View>
                      <Text style={styles.timeSeparator}>:</Text>
                      <View style={styles.customTimeInput}>
                        <TextInput
                          style={styles.timeInput}
                          value={customSeconds}
                          onChangeText={setCustomSeconds}
                          onBlur={handleCustomTimeChange}
                          keyboardType="numeric"
                          maxLength={2}
                          placeholder="0"
                          placeholderTextColor={theme.colors.textSecondary}
                        />
                        <Text style={styles.timeLabel}>sec</Text>
                      </View>
                    </View>
                    <Text style={styles.customTimeHint}>
                      Min: 30 seconds • Max: 60 minutes
                    </Text>
                  </>
                )}
              </View>
              
              <View style={styles.deckInfoPreview}>
                <Text style={styles.previewLabel}>You'll study:</Text>
                <Text style={styles.previewText}>
                  📚 {deck.title}
                </Text>
                <Text style={styles.previewText}>
                  📋 {dueCards.length} cards
                </Text>
                <Text style={styles.previewText}>
                  ⏱️ {Math.floor(timeLimit / 60)}m {timeLimit % 60}s total time
                </Text>
                <Text style={styles.previewText}>
                  🎯 ~{Math.round(timeLimit / dueCards.length)}s per card
                </Text>
              </View>
              
              <View style={styles.setupButtons}>
                <TouchableOpacity style={styles.primaryButton} onPress={startRevisionMode}>
                  <Ionicons name="play-outline" size={20} color={theme.colors.background} />
                  <Text style={styles.primaryButtonText}>Start Revision</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowTimerSetup(false)}>
                  <Ionicons name="book-outline" size={20} color={theme.colors.primary} />
                  <Text style={styles.secondaryButtonText}>Normal Study</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      showHeader={true}
      headerTitle="Study Session"
      headerIcon="school-outline"
      headerRight={
        !revisionMode ? (
          <TouchableOpacity 
            style={styles.revisionButton} 
            onPress={() => setShowTimerSetup(true)}
          >
            <Ionicons name="timer-outline" size={20} color={theme.colors.background} />
            <Text style={styles.revisionButtonText}>Revision Mode</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.normalModeButton} 
            onPress={() => {
              setRevisionMode(false);
              setTimerActive(false);
              setShowFloatingTimer(false);
              if (timerRef.current) clearTimeout(timerRef.current);
            }}
          >
            <Ionicons name="book-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.normalModeButtonText}>Normal Mode</Text>
          </TouchableOpacity>
        )
      }
      navigation={navigation}
    >
      
      {/* Floating Timer */}
      {showFloatingTimer && revisionMode && (
        <View style={styles.floatingTimer}>
          <View style={styles.floatingTimerContent}>
            <Ionicons name="timer-outline" size={16} color={theme.colors.primary} />
            <Text style={[
              styles.floatingTimerText, 
              timeRemaining <= 30 && styles.floatingTimerWarning,
              timeRemaining <= 10 && styles.floatingTimerDanger
            ]}>
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </Text>
            <View style={styles.floatingTimerBar}>
              <View 
                style={[
                  styles.floatingTimerProgress,
                  { 
                    width: `${(timeRemaining / timeLimit) * 100}%`,
                    backgroundColor: timeRemaining <= 10 ? '#F44336' : timeRemaining <= 30 ? '#FF9800' : theme.colors.primary
                  }
                ]} 
              />
            </View>
          </View>
        </View>
      )}
      
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Revision Mode Timer */}
          {revisionMode && (
            <View style={styles.section}>
              <View style={styles.timerCard}>
                <View style={styles.timerHeader}>
                  <Ionicons name="timer-outline" size={24} color={theme.colors.primary} />
                  <Text style={styles.timerTitle}>Revision Mode</Text>
                </View>
                
                <View style={styles.timerDisplay}>
                  <Text style={[
                    styles.timerText, 
                    timeRemaining <= 30 && styles.timerWarning,
                    timeRemaining <= 10 && styles.timerDanger
                  ]}>
                    {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                  </Text>
                  <View style={styles.timerBarContainer}>
                    <View style={styles.timerBarBg}>
                      <Animated.View 
                        style={[
                          styles.timerBar,
                          { 
                            width: `${(timeRemaining / timeLimit) * 100}%`,
                            backgroundColor: timeRemaining <= 10 ? '#F44336' : timeRemaining <= 30 ? '#FF9800' : theme.colors.primary
                          }
                        ]} 
                      />
                    </View>
                  </View>
                  {timeRemaining <= 30 && (
                    <Text style={styles.timerWarningText}>
                      {timeRemaining === 0 ? '⏰ Time\'s up! Session ending...' : 
                       timeRemaining <= 10 ? '⚠️ Hurry up!' : '⏳ Time running out!'}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Deck Info */}
          <View style={styles.section}>
            <View style={styles.deckInfoCard}>
              <View style={styles.deckInfoHeader}>
                <Ionicons name="library-outline" size={24} color={theme.colors.primary} />
                <View style={styles.deckInfoText}>
                  <Text style={styles.deckTitle}>{deck.title}</Text>
                  <Text style={styles.deckSubtitle}>
                    {revisionMode ? `⏱️ Revision Mode • ` : ''}
                    {studyAll ? `${dueCards.length} cards total` : `${dueCards.length} cards due today`}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Session Progress */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Session Progress</Text>
            <View style={styles.sessionCard}>
              <View style={styles.sessionProgress}>
                <View style={styles.progressStats}>
                  <View style={styles.progressStat}>
                    <Text style={styles.progressStatValue}>{sessionStats.totalAnswered}</Text>
                    <Text style={styles.progressStatLabel}>Answered</Text>
                  </View>
                  <View style={styles.progressStat}>
                    <Text style={[styles.progressStatValue, { color: '#4CAF50' }]}>{sessionStats.correctAnswers}</Text>
                    <Text style={styles.progressStatLabel}>Correct</Text>
                  </View>
                  <View style={styles.progressStat}>
                    <Text style={[styles.progressStatValue, { color: '#F44336' }]}>{sessionStats.incorrectAnswers}</Text>
                    <Text style={styles.progressStatLabel}>Incorrect</Text>
                  </View>
                  {sessionStats.totalAnswered > 0 && (
                    <View style={styles.progressStat}>
                      <Text style={styles.progressStatValue}>
                        {Math.round((sessionStats.correctAnswers / sessionStats.totalAnswered) * 100)}%
                      </Text>
                      <Text style={styles.progressStatLabel}>Accuracy</Text>
                    </View>
                  )}
                  {revisionMode && (
                    <View style={styles.progressStat}>
                      <Text style={styles.progressStatValue}>
                        {Math.floor((timeLimit - timeRemaining) / 60)}:{((timeLimit - timeRemaining) % 60).toString().padStart(2, '0')}
                      </Text>
                      <Text style={styles.progressStatLabel}>Elapsed</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.cardProgress}>
                  <Text style={styles.cardProgressText}>
                    Card {index + 1} of {dueCards.length}
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { width: `${((index + 1) / dueCards.length) * 100}%` }
                      ]} 
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Overall Deck Progress */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Deck Progress</Text>
            <View style={styles.deckProgressCard}>
              <View style={styles.deckProgressStats}>
                <View style={styles.deckProgressStat}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#4CAF50" />
                  <Text style={styles.deckProgressValue}>{progress.known}</Text>
                  <Text style={styles.deckProgressLabel}>Mastered</Text>
                </View>
                <View style={styles.deckProgressStat}>
                  <Ionicons name="school-outline" size={20} color={theme.colors.primary} />
                  <Text style={styles.deckProgressValue}>{progress.studied - progress.known}</Text>
                  <Text style={styles.deckProgressLabel}>Learning</Text>
                </View>
                <View style={styles.deckProgressStat}>
                  <Ionicons name="hourglass-outline" size={20} color={theme.colors.textSecondary} />
                  <Text style={styles.deckProgressValue}>{progress.total - progress.studied}</Text>
                  <Text style={styles.deckProgressLabel}>New</Text>
                </View>
              </View>
              <View style={styles.overallProgressContainer}>
                <View style={styles.progressBarBg}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { width: `${progress.percent}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.overallProgressText}>{progress.percent}% mastered</Text>
              </View>
            </View>
          </View>

          {/* Flashcard */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Flashcard</Text>
            <Animated.View
              style={[styles.flashcard, pan.getLayout()]}
              {...panResponder.panHandlers}
            >
              <TouchableOpacity onPress={flipCard} style={styles.cardTouchable}>
                <View style={styles.cardHeader}>
                  <Ionicons 
                    name={showBack ? "checkmark-circle-outline" : "help-circle-outline"} 
                    size={24} 
                    color={theme.colors.primary} 
                  />
                  <Text style={styles.cardLabel}>
                    {showBack ? 'Answer' : 'Question'}
                  </Text>
                </View>
                <Text style={styles.cardText}>{showBack ? (card?.back || 'No answer available') : (card?.front || 'No question available')}</Text>
                
                {!showBack && !answerChecked && (
                  <View style={styles.answerSection}>
                    <Text style={styles.answerLabel}>Your Answer:</Text>
                    <TextInput
                      style={styles.answerInput}
                      placeholder="Type your answer here..."
                      placeholderTextColor={theme.colors.textSecondary}
                      value={answerInput}
                      onChangeText={setAnswerInput}
                      editable={!answerChecked && (revisionMode ? timeRemaining > 0 : true)}
                      onSubmitEditing={checkAnswer}
                      onFocus={scrollToAnswerInput}
                      returnKeyType="done"
                      multiline
                      blurOnSubmit={true}
                    />
                    <TouchableOpacity 
                      style={[
                        styles.checkButton, 
                        (!answerInput.trim() || answerChecked || (revisionMode && timeRemaining === 0)) && styles.disabledButton
                      ]} 
                      onPress={checkAnswer} 
                      disabled={answerChecked || !answerInput.trim() || (revisionMode && timeRemaining === 0)}
                    >
                      <Ionicons name="checkmark-outline" size={20} color={theme.colors.background} />
                      <Text style={styles.checkButtonText}>Check Answer</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {answerChecked && (
                  <View style={styles.resultSection}>
                    <View style={[
                      styles.resultCard, 
                      isCorrect ? styles.correctResult : styles.incorrectResult,
                      timeRemaining === 0 && !isCorrect && styles.timeoutResult
                    ]}>
                      <Ionicons 
                        name={
                          timeRemaining === 0 && !isCorrect ? "time-outline" :
                          isCorrect ? "checkmark-circle" : "close-circle"
                        } 
                        size={32} 
                        color={
                          timeRemaining === 0 && !isCorrect ? "#FF9800" :
                          isCorrect ? "#4CAF50" : "#F44336"
                        } 
                      />
                      <Text style={[
                        styles.resultText, 
                        timeRemaining === 0 && !isCorrect ? styles.timeoutText :
                        isCorrect ? styles.correctText : styles.incorrectText
                      ]}>
                        {timeRemaining === 0 && !isCorrect ? 'Time Out!' : 
                         isCorrect ? 'Correct!' : 'Incorrect'}
                      </Text>
                      {!isCorrect && (
                        <Text style={styles.correctAnswerText}>
                          Correct answer: {card?.back || 'No answer available'}
                        </Text>
                      )}
                      {revisionMode && isCorrect && (
                        <Text style={styles.timeSpentText}>
                          ⏱️ Answered in {timeLimit - timeRemaining} seconds
                        </Text>
                      )}
                    </View>
                    
                    <TouchableOpacity style={styles.nextButton} onPress={nextCard}>
                      <Text style={styles.nextButtonText}>
                        {index === dueCards.length - 1 ? 'Finish Session' : 'Next Card'}
                      </Text>
                      <Ionicons 
                        name={index === dueCards.length - 1 ? "checkmark-outline" : "arrow-forward-outline"} 
                        size={20} 
                        color={theme.colors.background} 
                      />
                    </TouchableOpacity>
                  </View>
                )}
                
                <Text style={styles.swipeHint}>
                  <Ionicons name="hand-left-outline" size={16} color={theme.colors.textSecondary} />
                  {revisionMode ? 
                    ' Quick! Swipe or tap to flip • Time is running!' :
                    ' Swipe or tap to flip • Swipe left/right to navigate'
                  }
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Navigation */}
          <View style={styles.section}>
            <View style={styles.navRow}>
              <TouchableOpacity 
                onPress={prevCard} 
                disabled={index === 0} 
                style={[styles.navButton, index === 0 && styles.disabledButton]}
              >
                <Ionicons name="chevron-back-outline" size={24} color={index === 0 ? theme.colors.textSecondary : theme.colors.primary} />
                <Text style={[styles.navButtonText, index === 0 && styles.disabledButtonText]}>Previous</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={nextCard} 
                disabled={index === dueCards.length - 1} 
                style={[styles.navButton, index === dueCards.length - 1 && styles.disabledButton]}
              >
                <Text style={[styles.navButtonText, index === dueCards.length - 1 && styles.disabledButtonText]}>Next</Text>
                <Ionicons 
                  name="chevron-forward-outline" 
                  size={24} 
                  color={index === dueCards.length - 1 ? theme.colors.textSecondary : theme.colors.primary} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Extra padding to ensure navigation is above system bars */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 16, color: theme.colors.text, marginLeft: 8 },
  content: { flex: 1 },
  scrollContainer: { paddingBottom: 100 }, // Extra padding for safe scrolling
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 12 },
  
  // Loading State
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: theme.colors.text, marginTop: 16 },
  
  // Empty States
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 32, alignItems: 'center', margin: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  
  // Complete States
  completeCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 24, alignItems: 'center' },
  completeTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginTop: 16 },
  completeSubtitle: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  
  // Results
  resultsCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 24 },
  resultsHeader: { alignItems: 'center', marginBottom: 24 },
  resultsTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginTop: 12 },
  scoreContainer: { alignItems: 'center', marginBottom: 24 },
  scoreText: { fontSize: 36, fontWeight: 'bold', color: theme.colors.primary },
  accuracyText: { fontSize: 18, color: theme.colors.text, marginTop: 8 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginTop: 8 },
  statLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  noStudyText: { fontSize: 16, color: theme.colors.textSecondary, textAlign: 'center', fontStyle: 'italic' },
  
  // Review Cards
  reviewCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16, marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  reviewQuestion: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginLeft: 8, flex: 1 },
  reviewContent: { marginLeft: 28 },
  reviewAnswer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  incorrectAnswer: { fontSize: 14, color: '#F44336', marginLeft: 8, flex: 1 },
  correctAnswer: { fontSize: 14, color: '#4CAF50', marginLeft: 8, flex: 1 },
  timeoutAnswer: { fontSize: 14, color: '#FF9800', marginLeft: 8, flex: 1 },
  
  // Deck Info
  deckInfoCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
  deckInfoHeader: { flexDirection: 'row', alignItems: 'center' },
  deckInfoText: { marginLeft: 12, flex: 1 },
  deckTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text },
  deckSubtitle: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  
  // Session Progress
  sessionCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
  sessionProgress: { },
  progressStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  progressStat: { alignItems: 'center', flex: 1 },
  progressStatValue: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text },
  progressStatLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  cardProgress: { },
  cardProgressText: { fontSize: 14, color: theme.colors.text, marginBottom: 8, textAlign: 'center' },
  
  // Deck Progress
  deckProgressCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
  deckProgressStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  deckProgressStat: { alignItems: 'center', flex: 1 },
  deckProgressValue: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginTop: 4 },
  deckProgressLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  overallProgressContainer: { alignItems: 'center' },
  overallProgressText: { fontSize: 14, color: theme.colors.text, fontWeight: 'bold', marginTop: 8 },
  
  // Progress Bars
  progressBarBg: { height: 8, backgroundColor: theme.colors.background, borderRadius: 4, flex: 1 },
  progressBar: { height: 8, backgroundColor: theme.colors.primary, borderRadius: 4 },
  
  // Flashcard
  flashcard: { backgroundColor: theme.colors.card, borderRadius: 12, overflow: 'hidden' },
  cardTouchable: { padding: 24 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardLabel: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginLeft: 8 },
  cardText: { fontSize: 20, color: theme.colors.text, textAlign: 'center', marginBottom: 24, lineHeight: 28 },
  
  // Answer Section
  answerSection: { },
  answerLabel: { fontSize: 14, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 },
  answerInput: { backgroundColor: theme.colors.background, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, minHeight: 60, textAlignVertical: 'top', color: theme.colors.text },
  checkButton: { backgroundColor: theme.colors.primary, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  checkButtonText: { color: theme.colors.background, fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  
  // Result Section
  resultSection: { },
  resultCard: { borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 16 },
  correctResult: { backgroundColor: 'rgba(76, 175, 80, 0.1)' },
  incorrectResult: { backgroundColor: 'rgba(244, 67, 54, 0.1)' },
  resultText: { fontSize: 18, fontWeight: 'bold', marginTop: 8 },
  correctText: { color: '#4CAF50' },
  incorrectText: { color: '#F44336' },
  correctAnswerText: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center' },
  nextButton: { backgroundColor: theme.colors.primary, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  nextButtonText: { color: theme.colors.background, fontWeight: 'bold', fontSize: 16, marginRight: 8 },
  
  // Swipe Hint
  swipeHint: { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
  
  // Navigation
  navRow: { flexDirection: 'row', justifyContent: 'space-between' },
  navButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: 8, padding: 12, flex: 0.45 },
  navButtonText: { fontSize: 16, color: theme.colors.primary, fontWeight: 'bold' },
  
  // Buttons
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  primaryButtonText: { color: theme.colors.background, fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  secondaryButton: { backgroundColor: theme.colors.card, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  secondaryButtonText: { color: theme.colors.primary, fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  accentButton: { backgroundColor: '#FF9800', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  accentButtonText: { color: theme.colors.background, fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  actionButtons: { },
  
  // Disabled States
  disabledButton: { opacity: 0.5 },
  disabledButtonText: { color: theme.colors.textSecondary },

  // Bottom spacer to ensure content is above system navigation
  bottomSpacer: { height: 50 },

  // Revision Mode Timer
  timerCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
  timerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  timerTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginLeft: 8 },
  timerDisplay: { alignItems: 'center', marginBottom: 16 },
  timerText: { fontSize: 36, fontWeight: 'bold', color: theme.colors.primary },
  timerBarContainer: { height: 8, backgroundColor: theme.colors.background, borderRadius: 4, flex: 1 },
  timerBarBg: { height: 8, backgroundColor: theme.colors.background, borderRadius: 4, flex: 1 },
  timerBar: { height: 8, backgroundColor: theme.colors.primary, borderRadius: 4 },
  timerWarning: { color: '#FF9800' },
  timerDanger: { color: '#F44336' },

  // Timer Setup
  setupCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 24 },
  setupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  setupTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginLeft: 8 },
  setupDescription: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  timeLimitSection: { marginBottom: 16 },
  timeLimitLabel: { fontSize: 14, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 },
  timeLimitOptions: { flexDirection: 'row', justifyContent: 'space-around' },
  timeLimitOption: { padding: 8, borderWidth: 2, borderColor: theme.colors.primary, borderRadius: 8 },
  timeLimitOptionText: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
  timeLimitOptionSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  timeLimitOptionTextSelected: { color: theme.colors.background },
  deckInfoPreview: { marginBottom: 16 },
  previewLabel: { fontSize: 14, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8 },
  previewText: { fontSize: 16, color: theme.colors.textSecondary },
  setupButtons: { flexDirection: 'row', justifyContent: 'space-around' },

  // Revision Mode Buttons
  revisionButton: { backgroundColor: theme.colors.primary, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  revisionButtonText: { color: theme.colors.background, fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  normalModeButton: { backgroundColor: theme.colors.primary, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  normalModeButtonText: { color: theme.colors.background, fontWeight: 'bold', fontSize: 16, marginRight: 8 },

  // Timeout Result
  timeoutResult: { backgroundColor: 'rgba(255, 152, 0, 0.1)' },
  timeoutText: { color: '#FF9800' },
  timeSpentText: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center' },

  // Timeout Session Label
  timeoutSessionLabel: {
    fontSize: 14,
    color: theme.colors.text,
    marginLeft: 8,
  },

  // Timer Warning Text
  timerWarningText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: 'bold',
    marginTop: 8,
  },

  // Time Stats Container
  timeStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  timeStatItem: {
    alignItems: 'center',
  },
  timeStatLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  timeStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },

  // Average Time Text
  averageTimeText: {
    fontSize: 14,
    color: theme.colors.text,
    marginTop: 8,
  },

  // Revision Mode Label
  revisionModeLabel: {
    fontSize: 14,
    color: theme.colors.text,
    marginLeft: 8,
  },

  // Floating Timer
  floatingTimer: {
    position: 'absolute',
    top: 80, // Below the header
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 12,
    zIndex: 1000,
    minWidth: 120,
  },
  floatingTimerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTimerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.background,
    marginLeft: 8,
    marginRight: 8,
  },
  floatingTimerBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    width: 60,
    marginLeft: 8,
  },
  floatingTimerProgress: {
    height: 4,
    borderRadius: 2,
  },
  floatingTimerWarning: {
    color: '#FF9800',
  },
  floatingTimerDanger: {
    color: '#F44336',
  },

  // Time Type Toggle
  timeTypeToggle: { 
    flexDirection: 'row', 
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 4,
    marginBottom: 16 
  },
  toggleOption: { 
    flex: 1,
    padding: 12, 
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 2
  },
  toggleOptionActive: { 
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  toggleOptionText: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: theme.colors.textSecondary 
  },
  toggleOptionTextActive: { 
    color: theme.colors.background 
  },

  // Custom Time Input
  customTimeContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 16 
  },
  customTimeInput: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 8
  },
  timeInput: { 
    backgroundColor: 'transparent',
    fontSize: 18, 
    fontWeight: 'bold',
    color: theme.colors.text,
    width: 50,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
    paddingVertical: 4
  },
  timeLabel: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: theme.colors.textSecondary, 
    marginLeft: 8
  },
  timeSeparator: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: theme.colors.primary
  },
  customTimeHint: { 
    fontSize: 12, 
    color: theme.colors.textSecondary, 
    textAlign: 'center', 
    marginTop: 8,
    fontStyle: 'italic'
  },
}); 