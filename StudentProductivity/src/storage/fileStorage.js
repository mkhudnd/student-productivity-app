import * as FileSystem from 'expo-file-system';

// Base directory for app data
const DATA_DIR = FileSystem.documentDirectory + 'data/';

/**
 * Ensure the data directory exists
 */
export async function ensureDataDir() {
  const dirInfo = await FileSystem.getInfoAsync(DATA_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true });
  }
}

/**
 * Get the full path for a data file
 * @param {string} filename - The name of the file (e.g., 'users.json')
 */
export function getDataFilePath(filename) {
  return DATA_DIR + filename;
}

/**
 * Read a JSON file from storage
 * @param {string} filename - The name of the file
 * @returns {Promise<any>} - The parsed JSON data, or null if not found
 */
export async function readJson(filename) {
  await ensureDataDir();
  const path = getDataFilePath(filename);
  try {
    const content = await FileSystem.readAsStringAsync(path);
    return JSON.parse(content);
  } catch (e) {
    // File does not exist or is empty
    return null;
  }
}

/**
 * Write data to a JSON file in storage
 * @param {string} filename - The name of the file
 * @param {any} data - The data to write (will be stringified)
 */
export async function writeJson(filename, data) {
  await ensureDataDir();
  const path = getDataFilePath(filename);
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2));
}

/**
 * Delete a JSON file from storage
 * @param {string} filename - The name of the file
 */
export async function deleteJson(filename) {
  const path = getDataFilePath(filename);
  const fileInfo = await FileSystem.getInfoAsync(path);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(path);
  }
} 