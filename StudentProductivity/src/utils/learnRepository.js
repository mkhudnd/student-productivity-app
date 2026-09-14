import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlashcardService } from './flashcardService';
import { localDateKey } from './planRepository';

function trackerKey(user) {
  return user?.email ? `study_tracker_data_${user.email}` : 'study_tracker_data';
}

function safeParse(raw, fallback = {}) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (error) {
    console.error('Unable to parse Learn workspace data:', error);
    return fallback;
  }
}

function dueCardsForDeck(deck, today = localDateKey()) {
  const cards = Array.isArray(deck?.cards) ? deck.cards : [];
  return cards.filter((card) => !card.dueDate || card.dueDate <= today);
}

function normalizeDeck(deck) {
  const cards = Array.isArray(deck?.cards) ? deck.cards : [];
  const mastered = cards.filter((card) => card.known).length;
  const due = dueCardsForDeck(deck).length;

  return {
    ...deck,
    cards,
    subjectId: deck?.subjectId || null,
    topic: deck?.topic || null,
    mastered,
    due,
    progress: cards.length ? Math.round((mastered / cards.length) * 100) : 0,
    isLegacyUnowned: !deck?.userId,
  };
}

export async function loadLearnWorkspace(user) {
  if (!user?.email) {
    return {
      subjects: [],
      decks: [],
      linkedDecks: [],
      unlinkedDecks: [],
      dueCount: 0,
      cardCount: 0,
      masteredCount: 0,
      recentSessions: [],
    };
  }

  const [trackerRaw, decksRaw] = await Promise.all([
    AsyncStorage.getItem(trackerKey(user)),
    FlashcardService.getUserFlashcardDecks(user),
  ]);
  const tracker = safeParse(trackerRaw, {});
  const subjects = Array.isArray(tracker.subjects) ? tracker.subjects : [];
  const subjectIds = new Set(subjects.map((subject) => subject.id));
  const decks = (Array.isArray(decksRaw) ? decksRaw : []).map(normalizeDeck);
  const linkedDecks = decks.filter((deck) => deck.subjectId && subjectIds.has(deck.subjectId));
  const unlinkedDecks = decks.filter((deck) => !deck.subjectId || !subjectIds.has(deck.subjectId));
  const recentSessions = (Array.isArray(tracker.sessions) ? tracker.sessions : [])
    .slice()
    .sort((a, b) => String(b.completedAt || b.date || '').localeCompare(String(a.completedAt || a.date || '')))
    .slice(0, 5);

  return {
    subjects,
    decks,
    linkedDecks,
    unlinkedDecks,
    dueCount: decks.reduce((sum, deck) => sum + deck.due, 0),
    cardCount: decks.reduce((sum, deck) => sum + deck.cards.length, 0),
    masteredCount: decks.reduce((sum, deck) => sum + deck.mastered, 0),
    recentSessions,
  };
}

export async function createLearnDeck(user, input) {
  if (!input?.title?.trim()) throw new Error('Enter a deck name.');
  return FlashcardService.createDeck(
    {
      title: input.title.trim(),
      subjectId: input.subjectId || null,
      topic: input.topic?.trim() || null,
      tags: Array.isArray(input.tags) ? input.tags : [],
    },
    user,
  );
}

export async function linkLearnDeck(user, deckId, input) {
  return FlashcardService.updateDeck(
    deckId,
    {
      subjectId: input?.subjectId || null,
      topic: input?.topic?.trim() || null,
    },
    user,
  );
}

export async function deleteLearnDeck(user, deckId) {
  return FlashcardService.deleteDeck(deckId, user);
}
