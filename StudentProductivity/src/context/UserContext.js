import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readJson, writeJson } from '../storage/fileStorage';
import { DataMigrationService } from '../utils/dataMigration';

const UserContext = createContext();

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, securityAnswer, ...safeUser } = user;
  return safeUser;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const persistSafeCurrentUser = async (user) => {
    const safeUser = sanitizeUser(user);
    if (!safeUser) {
      await AsyncStorage.removeItem('currentUser');
      return null;
    }

    await AsyncStorage.setItem('currentUser', JSON.stringify(safeUser));
    return safeUser;
  };

  const loadCurrentUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        const storedUser = JSON.parse(userData);
        const safeUser = sanitizeUser(storedUser);
        setCurrentUser(safeUser);

        // Transparently remove secrets left in AsyncStorage by older builds.
        if (storedUser.password || storedUser.securityAnswer) {
          await persistSafeCurrentUser(safeUser);
        }
      }
    } catch (error) {
      console.error('Error loading current user:', error);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loginUser = async (user) => {
    try {
      const safeUser = await persistSafeCurrentUser(user);
      setCurrentUser(safeUser);

      // Data migration only requires non-sensitive account identity.
      await DataMigrationService.migrateDataForUser(safeUser);
      return { success: true };
    } catch (error) {
      console.error('Error saving current user:', error);
      return { success: false, error: error.message };
    }
  };

  const logoutUser = async () => {
    try {
      setCurrentUser(null);
      await AsyncStorage.removeItem('currentUser');
    } catch (error) {
      console.error('Error removing current user:', error);
      setCurrentUser(null);
    }
  };

  const updateUser = async (updatedUserData) => {
    try {
      if (!currentUser?.email) {
        return { success: false, error: 'No authenticated user' };
      }

      const users = (await readJson('users.json')) || [];
      const userIndex = users.findIndex((user) => user.email === currentUser.email);

      if (userIndex === -1) {
        return { success: false, error: 'User not found' };
      }

      // The legacy local account file still contains credential fields for now.
      // Keep them there until the dedicated production auth migration is complete,
      // but never duplicate those secrets into app session state.
      users[userIndex] = { ...users[userIndex], ...updatedUserData };
      await writeJson('users.json', users);

      const safeUpdatedUser = await persistSafeCurrentUser(users[userIndex]);
      setCurrentUser(safeUpdatedUser);

      return { success: true };
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, error: error.message };
    }
  };

  const checkEmailExists = async (email, excludeCurrentUser = false) => {
    try {
      const users = (await readJson('users.json')) || [];
      return users.some(
        (user) =>
          user.email === email &&
          (!excludeCurrentUser || user.email !== currentUser?.email)
      );
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  };

  const checkUsernameExists = async (username, excludeCurrentUser = false) => {
    try {
      const users = (await readJson('users.json')) || [];
      return users.some(
        (user) =>
          user.username === username &&
          (!excludeCurrentUser || user.username !== currentUser?.username)
      );
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    }
  };

  const value = {
    currentUser,
    isLoading,
    loginUser,
    logoutUser,
    updateUser,
    checkEmailExists,
    checkUsernameExists,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
