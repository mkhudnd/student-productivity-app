import { readJson, writeJson } from '../storage/fileStorage';

const FLASHCARDS_FILE = 'flashcards.json';

function canAccessDeck(deck, currentUser) {
  return Boolean(
    currentUser?.email &&
      (deck?.userId === currentUser.email || !deck?.userId),
  );
}

async function readDecks() {
  const decks = await readJson(FLASHCARDS_FILE);
  return Array.isArray(decks) ? decks : [];
}

export class FlashcardService {
  static async getUserFlashcardDecks(currentUser) {
    try {
      if (!currentUser?.email) return [];
      const allDecks = await readDecks();
      return allDecks.filter((deck) => canAccessDeck(deck, currentUser));
    } catch (error) {
      console.error('Error fetching flashcard decks:', error);
      return [];
    }
  }

  static async createDeck(deckData, currentUser) {
    try {
      if (!currentUser?.email) return null;
      const allDecks = await readDecks();
      const now = new Date().toISOString();
      const newDeck = {
        id: `deck-${Date.now()}`,
        title: deckData.title.trim(),
        tags: Array.isArray(deckData.tags) ? deckData.tags : [],
        cards: [],
        subjectId: deckData.subjectId || null,
        topic: deckData.topic?.trim() || null,
        userId: currentUser.email,
        createdAt: now,
        updatedAt: now,
      };

      allDecks.push(newDeck);
      await writeJson(FLASHCARDS_FILE, allDecks);
      return newDeck;
    } catch (error) {
      console.error('Error creating flashcard deck:', error);
      return null;
    }
  }

  static async updateDeck(deckId, deckData, currentUser) {
    try {
      if (!currentUser?.email) return null;
      const allDecks = await readDecks();
      const deckIndex = allDecks.findIndex(
        (deck) => deck.id === deckId && canAccessDeck(deck, currentUser),
      );
      if (deckIndex === -1) return null;

      const updatedDeck = {
        ...allDecks[deckIndex],
        ...deckData,
        userId: currentUser.email,
        updatedAt: new Date().toISOString(),
      };
      allDecks[deckIndex] = updatedDeck;
      await writeJson(FLASHCARDS_FILE, allDecks);
      return updatedDeck;
    } catch (error) {
      console.error('Error updating flashcard deck:', error);
      return null;
    }
  }

  static async deleteDeck(deckId, currentUser) {
    try {
      if (!currentUser?.email) return false;
      const allDecks = await readDecks();
      const deckToDelete = allDecks.find(
        (deck) => deck.id === deckId && canAccessDeck(deck, currentUser),
      );
      if (!deckToDelete) return false;

      await writeJson(
        FLASHCARDS_FILE,
        allDecks.filter((deck) => deck.id !== deckId),
      );
      return true;
    } catch (error) {
      console.error('Error deleting flashcard deck:', error);
      return false;
    }
  }

  static async getDeck(deckId, currentUser) {
    try {
      if (!currentUser?.email) return null;
      const allDecks = await readDecks();
      return allDecks.find(
        (deck) => deck.id === deckId && canAccessDeck(deck, currentUser),
      ) || null;
    } catch (error) {
      console.error('Error fetching flashcard deck:', error);
      return null;
    }
  }

  static async addCardToDeck(deckId, cardData, currentUser) {
    try {
      if (!currentUser?.email) return null;
      const allDecks = await readDecks();
      const deckIndex = allDecks.findIndex(
        (deck) => deck.id === deckId && canAccessDeck(deck, currentUser),
      );
      if (deckIndex === -1) return null;

      const newCard = {
        id: `card-${Date.now()}`,
        front: cardData.front,
        back: cardData.back,
        known: false,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
      };
      const existingCards = Array.isArray(allDecks[deckIndex].cards)
        ? allDecks[deckIndex].cards
        : [];
      allDecks[deckIndex] = {
        ...allDecks[deckIndex],
        cards: [...existingCards, newCard],
        userId: currentUser.email,
        updatedAt: new Date().toISOString(),
      };
      await writeJson(FLASHCARDS_FILE, allDecks);
      return newCard;
    } catch (error) {
      console.error('Error adding card to deck:', error);
      return null;
    }
  }

  static async updateCard(deckId, cardId, cardData, currentUser) {
    try {
      if (!currentUser?.email) return null;
      const allDecks = await readDecks();
      const deckIndex = allDecks.findIndex(
        (deck) => deck.id === deckId && canAccessDeck(deck, currentUser),
      );
      if (deckIndex === -1) return null;

      const cards = Array.isArray(allDecks[deckIndex].cards)
        ? allDecks[deckIndex].cards
        : [];
      const cardIndex = cards.findIndex((card) => card.id === cardId);
      if (cardIndex === -1) return null;

      const updatedCard = { ...cards[cardIndex], ...cardData };
      const nextCards = cards.map((card, index) => (index === cardIndex ? updatedCard : card));
      allDecks[deckIndex] = {
        ...allDecks[deckIndex],
        cards: nextCards,
        userId: currentUser.email,
        updatedAt: new Date().toISOString(),
      };
      await writeJson(FLASHCARDS_FILE, allDecks);
      return updatedCard;
    } catch (error) {
      console.error('Error updating card:', error);
      return null;
    }
  }

  static async deleteCard(deckId, cardId, currentUser) {
    try {
      if (!currentUser?.email) return false;
      const allDecks = await readDecks();
      const deckIndex = allDecks.findIndex(
        (deck) => deck.id === deckId && canAccessDeck(deck, currentUser),
      );
      if (deckIndex === -1) return false;

      const cards = Array.isArray(allDecks[deckIndex].cards)
        ? allDecks[deckIndex].cards
        : [];
      allDecks[deckIndex] = {
        ...allDecks[deckIndex],
        cards: cards.filter((card) => card.id !== cardId),
        userId: currentUser.email,
        updatedAt: new Date().toISOString(),
      };
      await writeJson(FLASHCARDS_FILE, allDecks);
      return true;
    } catch (error) {
      console.error('Error deleting card:', error);
      return false;
    }
  }
}
