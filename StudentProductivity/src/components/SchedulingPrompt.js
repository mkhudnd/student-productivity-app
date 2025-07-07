import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function SchedulingPrompt({ neglected, onAddToPlan, onDismiss }) {
  if (!neglected || neglected.length === 0) return null;
  
  return (
    <View style={styles.overlay}>
      <View style={styles.promptBox}>
        <Text style={styles.title}>Smart Scheduling Suggestion</Text>
        <ScrollView style={{ maxHeight: 200 }}>
          {neglected.map((item, idx) => (
            <View key={idx} style={styles.itemContainer}>
              <Text style={styles.text}>
                You haven't studied <Text style={styles.bold}>{item.subject} - {item.topic}</Text> in a while.
              </Text>
              <TouchableOpacity 
                style={styles.addItemButton} 
                onPress={() => onAddToPlan(item)}
              >
                <Text style={styles.addItemButtonText}>Add to Plan</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissButtonText}>Dismiss All</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  promptBox: {
    backgroundColor: '#232323',
    borderRadius: 20,
    padding: 24,
    width: 320,
    alignItems: 'center',
    elevation: 4,
  },
  title: {
    color: '#FFD600',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  bold: {
    fontWeight: 'bold',
    color: '#FFD600',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'center',
  },
  dismissButton: {
    backgroundColor: '#444',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  dismissButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  itemContainer: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  addItemButton: {
    backgroundColor: '#FFD600',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
  },
  addItemButtonText: {
    color: '#181818',
    fontWeight: 'bold',
    fontSize: 14,
  },
}); 