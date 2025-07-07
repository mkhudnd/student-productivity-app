import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { readJson, writeJson } from '../../storage/fileStorage';
import ScreenLayout from '../../components/ScreenLayout';

const FLASHCARDS_FILE = 'flashcards.json';
const AUDIO_DIR = FileSystem.documentDirectory + 'media/audio/';

async function ensureAudioDir() {
  const dirInfo = await FileSystem.getInfoAsync(AUDIO_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
  }
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const sec = (totalSec % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

export default function DeckEditorScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { deckId } = route.params || { deckId: 'new' };
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [editingCardId, setEditingCardId] = useState(null);
  const [tags, setTags] = useState('');
  const [newDeckTitle, setNewDeckTitle] = useState('');

  useEffect(() => {
    loadDeck();
    ensureAudioDir();
  }, []);

  async function loadDeck() {
    setLoading(true);
    const decks = (await readJson(FLASHCARDS_FILE)) || [];
    let found = decks.find(d => d.id === deckId);
    // Migrate existing cards to have SRS fields and audio fields
    if (found && found.cards) {
      found = {
        ...found,
        cards: found.cards.map(card => ({
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
          dueDate: new Date().toISOString().slice(0, 10),
          lastStudied: null,
          audioFront: card.audioFront || null,
          audioBack: card.audioBack || null,
          ...card,
        }))
      };
      await saveDeck(found);
    }
    setDeck(found);
    setTags(found && found.tags ? found.tags.join(', ') : '');
    setLoading(false);
  }

  async function saveDeck(updatedDeck) {
    const decks = (await readJson(FLASHCARDS_FILE)) || [];
    const idx = decks.findIndex(d => d.id === deckId);
    if (idx !== -1) {
      decks[idx] = updatedDeck;
      await writeJson(FLASHCARDS_FILE, decks);
      setDeck(updatedDeck);
    }
  }

  function startEditCard(card) {
    setFront(card.front);
    setBack(card.back);
    setEditingCardId(card.id);
  }

  function cancelEdit() {
    setFront('');
    setBack('');
    setEditingCardId(null);
  }

  async function addOrEditCard() {
    if (!front.trim() || !back.trim()) {
      Alert.alert('Missing Content', 'Please fill in both front and back of the card');
      return;
    }
    let updatedCards;
    if (editingCardId) {
      updatedCards = deck.cards.map(card =>
        card.id === editingCardId ? { ...card, front: front.trim(), back: back.trim() } : card
      );
    } else {
      const today = new Date().toISOString().slice(0, 10);
      updatedCards = [
        ...deck.cards,
        {
          id: Date.now().toString(),
          front: front.trim(),
          back: back.trim(),
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
          dueDate: today,
          lastStudied: null,
        }
      ];
    }
    const updatedDeck = { ...deck, cards: updatedCards, updatedAt: new Date().toISOString() };
    await saveDeck(updatedDeck);
    setFront('');
    setBack('');
    setEditingCardId(null);
    
    const message = editingCardId ? 'Card updated successfully!' : 'Card added successfully!';
    Alert.alert('Success', message);
  }

  async function deleteCard(cardId) {
    const cardToDelete = deck.cards.find(c => c.id === cardId);
    if (!cardToDelete) return;

    Alert.alert(
      'Delete Card',
      `Are you sure you want to delete this card?\n\nFront: "${cardToDelete.front}"\nBack: "${cardToDelete.back}"\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            const updatedCards = deck.cards.filter(card => card.id !== cardId);
            const updatedDeck = { ...deck, cards: updatedCards, updatedAt: new Date().toISOString() };
            await saveDeck(updatedDeck);
            Alert.alert('Card Deleted', 'The card has been deleted successfully.');
          }
        }
      ]
    );
  }

  async function saveTags() {
    const tagArr = tags.split(',').map(t => t.trim()).filter(Boolean);
    const updatedDeck = { ...deck, tags: tagArr, updatedAt: new Date().toISOString() };
    await saveDeck(updatedDeck);
    Alert.alert('Tags Saved', 'Tags have been updated successfully!');
  }

  const getDeckProgress = () => {
    if (!deck.cards.length) return 0;
    const known = deck.cards.filter(card => card.known).length;
    return Math.round((known / deck.cards.length) * 100);
  };

  const styles = getStyles(theme);

  if (loading || !deck) {
    return (
      <ScreenLayout
        showHeader={true}
        headerTitle="Edit Deck"
        headerIcon="create-outline"
        navigation={navigation}
      >
        <View style={styles.loadingContainer}>
          <Ionicons name="hourglass-outline" size={48} color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading deck...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      showHeader={true}
      headerTitle="Edit Deck"
      headerIcon="create-outline"
      scrollable={true}
      headerRight={
        <TouchableOpacity 
          style={styles.studyButton} 
          onPress={() => navigation.navigate('Study', { deckId, studyAll: true })}
        >
          <Ionicons name="play-outline" size={20} color={theme.colors.background} />
          <Text style={styles.studyText}>Study</Text>
        </TouchableOpacity>
      }
      navigation={navigation}
    >
        {/* Deck Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deck Information</Text>
          <View style={styles.deckInfoCard}>
            <View style={styles.deckInfoHeader}>
              <Ionicons name="library-outline" size={24} color={theme.colors.primary} />
              <View style={styles.deckInfoText}>
                <Text style={styles.deckTitle}>{deck.title}</Text>
                <Text style={styles.deckStats}>
                  {deck.cards.length} cards • {getDeckProgress()}% mastered
                </Text>
              </View>
            </View>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View 
                  style={[
                    styles.progressBar, 
                    { width: `${getDeckProgress()}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>{getDeckProgress()}%</Text>
            </View>
          </View>
        </View>

        {/* Tags Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagsCard}>
            <View style={styles.tagsHeader}>
              <Ionicons name="pricetags-outline" size={24} color={theme.colors.primary} />
              <View style={styles.tagsInfo}>
                <Text style={styles.tagsTitle}>Organize with Tags</Text>
                <Text style={styles.tagsSubtitle}>Add comma-separated tags</Text>
              </View>
            </View>
            <TextInput
              style={styles.tagsInput}
              placeholder="e.g., math, algebra, equations"
              placeholderTextColor={theme.colors.textSecondary}
              value={tags}
              onChangeText={setTags}
              onBlur={saveTags}
            />
            <TouchableOpacity style={styles.saveTagsButton} onPress={saveTags}>
              <Ionicons name="save-outline" size={20} color={theme.colors.background} />
              <Text style={styles.saveTagsText}>Save Tags</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Add/Edit Card Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {editingCardId ? 'Edit Card' : 'Add New Card'}
          </Text>
          <View style={styles.inputCard}>
            <View style={styles.inputHeader}>
              <Ionicons 
                name={editingCardId ? "create-outline" : "add-circle-outline"} 
                size={24} 
                color={theme.colors.primary} 
              />
              <View style={styles.inputInfo}>
                <Text style={styles.inputTitle}>
                  {editingCardId ? 'Update Card Content' : 'Create New Flashcard'}
                </Text>
                <Text style={styles.inputSubtitle}>
                  {editingCardId ? 'Modify the content below' : 'Fill in both sides of the card'}
                </Text>
              </View>
            </View>
            
            <Text style={styles.inputLabel}>
              <Ionicons name="help-circle-outline" size={16} color={theme.colors.primary} /> 
              Front (Question/Term)
            </Text>
            <TextInput
              style={styles.inputField}
              placeholder="Enter question or term"
              placeholderTextColor={theme.colors.textSecondary}
              value={front}
              onChangeText={setFront}
              multiline
            />
            
            <Text style={styles.inputLabel}>
              <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.primary} /> 
              Back (Answer/Definition)
            </Text>
            <TextInput
              style={styles.inputField}
              placeholder="Enter answer or definition"
              placeholderTextColor={theme.colors.textSecondary}
              value={back}
              onChangeText={setBack}
              multiline
            />
            
            <View style={styles.inputBtnRow}>
              <TouchableOpacity style={styles.saveBtn} onPress={addOrEditCard}>
                <Ionicons 
                  name={editingCardId ? "save-outline" : "add-outline"} 
                  size={20} 
                  color={theme.colors.background} 
                />
                <Text style={styles.saveBtnText}>
                  {editingCardId ? 'Update Card' : 'Add Card'}
                </Text>
              </TouchableOpacity>
              {editingCardId && (
                <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                  <Ionicons name="close-outline" size={20} color={theme.colors.text} />
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Cards List Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Cards ({deck.cards.length})
          </Text>
          
          {deck.cards.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="albums-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={styles.emptyTitle}>No cards yet</Text>
              <Text style={styles.emptySubtitle}>
                Add your first flashcard using the form above
              </Text>
            </View>
          ) : (
            <FlatList
              data={deck.cards}
              keyExtractor={item => item.id}
              renderItem={({ item, index }) => (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardInfo}>
                      <Ionicons name="albums-outline" size={20} color={theme.colors.primary} />
                      <Text style={styles.cardNumber}>Card #{index + 1}</Text>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => startEditCard(item)}
                      >
                        <Ionicons name="create-outline" size={20} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => deleteCard(item.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#F44336" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.cardContent}>
                    <View style={styles.cardSide}>
                      <Text style={styles.cardSideLabel}>Front</Text>
                      <Text style={styles.cardFront}>{item.front}</Text>
                    </View>
                    <View style={styles.cardDivider} />
                    <View style={styles.cardSide}>
                      <Text style={styles.cardSideLabel}>Back</Text>
                      <Text style={styles.cardBack}>{item.back}</Text>
                    </View>
                  </View>
                </View>
              )}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 16, color: theme.colors.text, marginLeft: 8 },
  studyButton: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  studyText: { color: theme.colors.background, fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  content: { paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 12 },
  
  // Loading State
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: theme.colors.text, marginTop: 16 },
  
  // Deck Info
  deckInfoCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
  deckInfoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  deckInfoText: { marginLeft: 12, flex: 1 },
  deckTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text },
  deckStats: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  progressContainer: { flexDirection: 'row', alignItems: 'center' },
  progressBarBg: { flex: 1, height: 8, backgroundColor: theme.colors.background, borderRadius: 4, marginRight: 12 },
  progressBar: { height: 8, backgroundColor: theme.colors.primary, borderRadius: 4 },
  progressText: { fontSize: 14, fontWeight: 'bold', color: theme.colors.text, minWidth: 40, textAlign: 'right' },
  
  // Tags
  tagsCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
  tagsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  tagsInfo: { marginLeft: 12, flex: 1 },
  tagsTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
  tagsSubtitle: { fontSize: 14, color: theme.colors.textSecondary },
  tagsInput: { backgroundColor: theme.colors.background, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, color: theme.colors.text },
  saveTagsButton: { backgroundColor: theme.colors.primary, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveTagsText: { color: theme.colors.background, fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  
  // Input Card
  inputCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16 },
  inputHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  inputInfo: { marginLeft: 12, flex: 1 },
  inputTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
  inputSubtitle: { fontSize: 14, color: theme.colors.textSecondary },
  inputLabel: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8, marginTop: 8 },
  inputField: { backgroundColor: theme.colors.background, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, minHeight: 60, textAlignVertical: 'top', color: theme.colors.text },
  inputBtnRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  saveBtn: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  saveBtnText: { color: theme.colors.background, fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  cancelBtn: { backgroundColor: theme.colors.background, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  cancelText: { color: theme.colors.text, fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  
  // Cards
  card: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardInfo: { flexDirection: 'row', alignItems: 'center' },
  cardNumber: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginLeft: 8 },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { padding: 8, marginLeft: 4 },
  cardContent: { },
  cardSide: { marginBottom: 12 },
  cardSideLabel: { fontSize: 12, fontWeight: 'bold', color: theme.colors.primary, marginBottom: 4, textTransform: 'uppercase' },
  cardFront: { fontSize: 16, color: theme.colors.text, lineHeight: 22 },
  cardBack: { fontSize: 16, color: theme.colors.text, lineHeight: 22 },
  cardDivider: { height: 1, backgroundColor: theme.colors.background, marginVertical: 8 },
  
  // Empty State
  emptyCard: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 },
}); 