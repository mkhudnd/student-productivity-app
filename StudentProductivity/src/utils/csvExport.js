import { Share, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const exportCSVData = async (csvContent) => {
  try {
    const fileName = `study_data_${new Date().toISOString().slice(0, 10)}.csv`;
    
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // For mobile platforms, use the sharing API
      await Share.share({
        message: csvContent,
        title: 'Study Data Export',
      });
    } else {
      // For web or other platforms, create a downloadable file
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      
      if (Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        // Fallback: copy to clipboard or show in alert
        throw new Error('Sharing not available on this platform');
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error exporting CSV:', error);
    throw error;
  }
}; 