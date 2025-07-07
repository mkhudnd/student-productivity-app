import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { FlashcardService } from '../../utils/flashcardService';
import ScreenLayout from '../../components/ScreenLayout';

function getDeckProgress(deck) {
  if (!deck.cards.length) return 0;
  const known = deck.cards.filter(card => card.known).length;
  return Math.round((known / deck.cards.length) * 100);
}

export default function DeckListScreen({ navigation }) {
  const { theme } = useTheme();
  const { currentUser } = useUser();
  const [decks, setDecks] = useState([]);
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDecks();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadDecks();
    }, [])
  );

  async function loadDecks() {
    setLoading(true);
    const data = await FlashcardService.getUserFlashcardDecks(currentUser);
    setDecks(data);
    setLoading(false);
  }

  async function addDeck() {
    if (!newDeckTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a deck title');
      return;
    }
    
    const newDeck = await FlashcardService.createDeck(
      { title: newDeckTitle.trim() }, 
      currentUser
    );
    
    if (newDeck) {
      const updatedDecks = [...decks, newDeck];
      setDecks(updatedDecks);
      setNewDeckTitle('');
      Alert.alert('Deck Created', `"${newDeck.title}" has been created successfully!`);
    } else {
      Alert.alert('Error', 'Failed to create deck. Please try again.');
    }
  }

  async function deleteDeck(id) {
    const deckToDelete = decks.find(d => d.id === id);
    if (!deckToDelete) return;

    Alert.alert(
      'Delete Deck',
      `Are you sure you want to delete "${deckToDelete.title}"?\n\nThis will permanently delete ${deckToDelete.cards.length} card(s). This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            const success = await FlashcardService.deleteDeck(id, currentUser);
            if (success) {
              const updatedDecks = decks.filter(deck => deck.id !== id);
              setDecks(updatedDecks);
              Alert.alert('Deck Deleted', `"${deckToDelete.title}" has been deleted.`);
            } else {
              Alert.alert('Error', 'Failed to delete deck. Please try again.');
            }
          }
        }
      ]
    );
  }

  function filterDecks() {
    if (!search.trim()) return decks;
    const s = search.trim().toLowerCase();
    return decks.filter(deck =>
      deck.title.toLowerCase().includes(s) ||
      (deck.tags && deck.tags.some(tag => tag.toLowerCase().includes(s)))
    );
  }

  const getTotalStats = () => {
    const totalDecks = decks.length;
    const totalCards = decks.reduce((sum, deck) => sum + deck.cards.length, 0);
    const masteredCards = decks.reduce((sum, deck) => 
      sum + deck.cards.filter(card => card.known).length, 0);
    
    return { totalDecks, totalCards, masteredCards };
  };

  const renderDeck = ({ item }) => (
    <TouchableOpacity 
      style={styles.deckCard} 
      onPress={() => navigation.navigate('DeckEditor', { deckId: item.id })}
    >
      <View style={styles.deckHeader}>
        <View style={styles.deckInfo}>
          <Ionicons name="library-outline" size={24} color={theme.colors.primary} />
          <View style={styles.deckText}>
            <Text style={styles.deckTitle}>{item.title}</Text>
            <Text style={styles.deckSubtitle}>
              {item.cards.length} cards • {getDeckProgress(item)}% mastered
            </Text>
          </View>
        </View>
        <View style={styles.deckActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Study', { deckId: item.id, studyAll: true })}
          >
            <Ionicons name="play-outline" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('DeckEditor', { deckId: item.id })}
          >
            <Ionicons name="create-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => deleteDeck(item.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>
      
      {item.tags && item.tags.length > 0 && (
        <View style={styles.tagRow}>
          {item.tags.map(tag => (
            <View key={tag} style={styles.tag}>
              <Ionicons name="pricetag-outline" size={12} color={theme.colors.textSecondary} />
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${getDeckProgress(item)}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>{getDeckProgress(item)}%</Text>
      </View>
    </TouchableOpacity>
  );

  const stats = getTotalStats();
  const styles = getStyles(theme);

  if (loading) {
    return (
      <ScreenLayout
        showHeader={true}
        headerTitle="Flashcards"
        headerIcon="library-outline"
        navigation={navigation}
      >
        <View style={styles.loadingContainer}>
          <Ionicons name="hourglass-outline" size={48} color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading flashcards...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      showHeader={true}
      headerTitle="Flashcards"
      headerIcon="library-outline"
      scrollable={true}
      navigation={navigation}
    >
        {/* Statistics Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Ionicons name="library-outline" size={24} color={theme.colors.primary} />
              <Text style={styles.statValue}>{stats.totalDecks}</Text>
              <Text style={styles.statLabel}>Decks</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="albums-outline" size={24} color={theme.colors.primary} />
              <Text style={styles.statValue}>{stats.totalCards}</Text>
              <Text style={styles.statLabel}>Cards</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle-outline" size={24} color={theme.colors.primary} />
              <Text style={styles.statValue}>{stats.masteredCards}</Text>
              <Text style={styles.statLabel}>Mastered</Text>
            </View>
          </View>
        </View>

        {/* Add New Deck Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Create New Deck</Text>
          <View style={styles.addDeckCard}>
            <View style={styles.addDeckHeader}>
              <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
              <View style={styles.addDeckInfo}>
                <Text style={styles.addDeckTitle}>Add Flashcard Deck</Text>
                <Text style={styles.addDeckSubtitle}>Create a new set of flashcards</Text>
              </View>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Enter deck title"
              placeholderTextColor={theme.colors.textSecondary}
              value={newDeckTitle}
              onChangeText={setNewDeckTitle}
            />
            <TouchableOpacity style={styles.addButton} onPress={addDeck}>
              <Ionicons name="add-outline" size={24} color={theme.colors.background} />
              <Text style={styles.addButtonText}>Create Deck</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Section */}
        {decks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Decks</Text>
            <View style={styles.searchCard}>
              <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by title or tag"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-outline" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Decks Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Decks ({filterDecks().length})</Text>
          
          {filterDecks().length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="library-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={styles.emptyTitle}>
                {decks.length === 0 ? 'No decks yet' : 'No matching decks'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {decks.length === 0 
                  ? 'Create your first flashcard deck to get started'
                  : 'Try adjusting your search terms'
                }
              </Text>
            </View>
          ) : (
            <FlatList
              data={filterDecks()}
              keyExtractor={item => item.id}
              renderItem={renderDeck}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
    </ScreenLayout>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: theme.colors.text },
  content: { paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 12 },
  
  // Loading State
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: theme.colors.text, marginTop: 16 },
  
  // Statistics
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  statCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16, alignItems: 'center', flex: 1, marginHorizontal: 4 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: theme.colors.text, marginTop: 8 },
  statLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  
  // Add Deck
  addDeckCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
  addDeckHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  addDeckInfo: { marginLeft: 12, flex: 1 },
  addDeckTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
  addDeckSubtitle: { fontSize: 14, color: theme.colors.textSecondary },
  input: { backgroundColor: theme.colors.background, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, color: theme.colors.text },
  addButton: { backgroundColor: theme.colors.primary, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: theme.colors.background, fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  
  // Search
  searchCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
  searchContainer: { flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: theme.colors.text },
  
  // Deck Cards
  deckCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16, marginBottom: 12 },
  deckHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  deckInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  deckText: { marginLeft: 12, flex: 1 },
  deckTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text },
  deckSubtitle: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  deckActions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { padding: 8, marginLeft: 4 },
  
  // Tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderRadius: 12, padding: 6, marginRight: 8, marginBottom: 4 },
  tagText: { fontSize: 12, color: theme.colors.textSecondary, marginLeft: 4 },
  
  // Progress
  progressContainer: { flexDirection: 'row', alignItems: 'center' },
  progressBarBg: { flex: 1, height: 8, backgroundColor: theme.colors.background, borderRadius: 4, marginRight: 12 },
  progressBar: { height: 8, backgroundColor: theme.colors.primary, borderRadius: 4 },
  progressText: { fontSize: 14, fontWeight: 'bold', color: theme.colors.text, minWidth: 40, textAlign: 'right' },
  
  // Empty State
  emptyCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 },
}); 