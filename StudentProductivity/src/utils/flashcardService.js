import { readJson, writeJson } from '../storage/fileStorage';

const FLASHCARDS_FILE = 'flashcards.json';

export class FlashcardService {
  // Get all flashcard decks for the current user
  static async getUserFlashcardDecks(currentUser) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for fetching flashcard decks');
        return [];
      }

      const allDecks = await readJson(FLASHCARDS_FILE) || [];
      
      // Filter decks by current user
      return allDecks.filter(deck => 
        deck.userId === currentUser.email || !deck.userId // Include old data without userId for backward compatibility
      );
    } catch (error) {
      console.error('Error fetching flashcard decks:', error);
      return [];
    }
  }

  // Create a new flashcard deck
  static async createDeck(deckData, currentUser) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for creating flashcard deck');
        return null;
      }

      const allDecks = await readJson(FLASHCARDS_FILE) || [];
      
      const newDeck = {
        id: Date.now().toString(),
        title: deckData.title.trim(),
        tags: deckData.tags || [],
        cards: [],
        userId: currentUser.email, // Add user ID for data isolation
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      allDecks.push(newDeck);
      await writeJson(FLASHCARDS_FILE, allDecks);
      
      return newDeck;
    } catch (error) {
      console.error('Error creating flashcard deck:', error);
      return null;
    }
  }

  // Update a flashcard deck
  static async updateDeck(deckId, deckData, currentUser) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for updating flashcard deck');
        return null;
      }

      const allDecks = await readJson(FLASHCARDS_FILE) || [];
      const deckIndex = allDecks.findIndex(deck => 
        deck.id === deckId && 
        (deck.userId === currentUser.email || !deck.userId) // Allow updating old data without userId
      );

      if (deckIndex === -1) {
        console.error('Deck not found or access denied');
        return null;
      }

      const updatedDeck = {
        ...allDecks[deckIndex],
        ...deckData,
        userId: currentUser.email, // Ensure userId is set
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

  // Delete a flashcard deck
  static async deleteDeck(deckId, currentUser) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for deleting flashcard deck');
        return false;
      }

      const allDecks = await readJson(FLASHCARDS_FILE) || [];
      const deckToDelete = allDecks.find(deck => 
        deck.id === deckId && 
        (deck.userId === currentUser.email || !deck.userId) // Allow deleting old data without userId
      );

      if (!deckToDelete) {
        console.error('Deck not found or access denied');
        return false;
      }

      const updatedDecks = allDecks.filter(deck => deck.id !== deckId);
      await writeJson(FLASHCARDS_FILE, updatedDecks);
      
      return true;
    } catch (error) {
      console.error('Error deleting flashcard deck:', error);
      return false;
    }
  }

  // Get a specific deck for the current user
  static async getDeck(deckId, currentUser) {
    try {
      if (!currentUser || !currentUser.email) {
        console.error('No current user provided for fetching flashcard deck');
        return null;
      }

      const allDecks = await readJson(FLASHCARDS_FILE) || [];
      const deck = allDecks.find(deck => 
        deck.id === deckId && 
        (deck.userId === currentUser.email || !deck.userId) // Allow accessing old data without userId
      );

      return deck || null;
    } catch (error) {
      console.error('Error fetching flashcard deck:', error);
      return null;
    }
  }

  // Add a card to a deck
  static async addCardToDeck(deckId, cardData, currentUser) {
    try {
      const allDecks = await readJson(FLASHCARDS_FILE) || [];
      const deckIndex = allDecks.findIndex(deck => 
        deck.id === deckId && 
        (deck.userId === currentUser.email || !deck.userId)
      );

      if (deckIndex === -1) {
        console.error('Deck not found or access denied');
        return null;
      }

      const newCard = {
        id: Date.now().toString(),
        front: cardData.front,
        back: cardData.back,
        known: false,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
      };

      allDecks[deckIndex].cards.push(newCard);
      allDecks[deckIndex].updatedAt = new Date().toISOString();
      allDecks[deckIndex].userId = currentUser.email; // Ensure userId is set

      await writeJson(FLASHCARDS_FILE, allDecks);
      
      return newCard;
    } catch (error) {
      console.error('Error adding card to deck:', error);
      return null;
    }
  }

  // Update a card in a deck
  static async updateCard(deckId, cardId, cardData, currentUser) {
    try {
      const allDecks = await readJson(FLASHCARDS_FILE) || [];
      const deckIndex = allDecks.findIndex(deck => 
        deck.id === deckId && 
        (deck.userId === currentUser.email || !deck.userId)
      );

      if (deckIndex === -1) {
        console.error('Deck not found or access denied');
        return null;
      }

      const cardIndex = allDecks[deckIndex].cards.findIndex(card => card.id === cardId);
      if (cardIndex === -1) {
        console.error('Card not found');
        return null;
      }

      allDecks[deckIndex].cards[cardIndex] = {
        ...allDecks[deckIndex].cards[cardIndex],
        ...cardData,
      };
      allDecks[deckIndex].updatedAt = new Date().toISOString();
      allDecks[deckIndex].userId = currentUser.email; // Ensure userId is set

      await writeJson(FLASHCARDS_FILE, allDecks);
      
      return allDecks[deckIndex].cards[cardIndex];
    } catch (error) {
      console.error('Error updating card:', error);
      return null;
    }
  }

  // Delete a card from a deck
  static async deleteCard(deckId, cardId, currentUser) {
    try {
      const allDecks = await readJson(FLASHCARDS_FILE) || [];
      const deckIndex = allDecks.findIndex(deck => 
        deck.id === deckId && 
        (deck.userId === currentUser.email || !deck.userId)
      );

      if (deckIndex === -1) {
        console.error('Deck not found or access denied');
        return false;
      }

      allDecks[deckIndex].cards = allDecks[deckIndex].cards.filter(card => card.id !== cardId);
      allDecks[deckIndex].updatedAt = new Date().toISOString();
      allDecks[deckIndex].userId = currentUser.email; // Ensure userId is set

      await writeJson(FLASHCARDS_FILE, allDecks);
      
      return true;
    } catch (error) {
      console.error('Error deleting card:', error);
      return false;
    }
  }
} 