import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readJson, writeJson } from '../storage/fileStorage';
import { DataMigrationService } from '../utils/dataMigration';

const UserContext = createContext();

const sanitizeSessionUser = (user) => {
  if (!user || typeof user !== 'object') return null;
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

  const persistSessionUser = async (user) => {
    const safeUser = sanitizeSessionUser(user);
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
        const safeUser = sanitizeSessionUser(JSON.parse(userData));
        setCurrentUser(safeUser);
        await persistSessionUser(safeUser);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
      await AsyncStorage.removeItem('currentUser');
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loginUser = async (user) => {
    try {
      const safeUser = await persistSessionUser(user);
      setCurrentUser(safeUser);

      if (safeUser) {
        await DataMigrationService.migrateDataForUser(safeUser);
      }

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
        return { success: false, error: 'No active user' };
      }

      const users = (await readJson('users.json')) || [];
      const userIndex = users.findIndex(u => u.email === currentUser.email);

      if (userIndex === -1) {
        return { success: false, error: 'User not found' };
      }

      users[userIndex] = { ...users[userIndex], ...updatedUserData };
      await writeJson('users.json', users);

      const safeUser = await persistSessionUser(users[userIndex]);
      setCurrentUser(safeUser);
      return { success: true };
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, error: error.message };
    }
  };

  const checkEmailExists = async (email, excludeCurrentUser = false) => {
    try {
      const users = (await readJson('users.json')) || [];
      return users.some(u => u.email === email && (!excludeCurrentUser || u.email !== currentUser?.email));
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  };

  const checkUsernameExists = async (username, excludeCurrentUser = false) => {
    try {
      const users = (await readJson('users.json')) || [];
      return users.some(u => u.username === username && (!excludeCurrentUser || u.username !== currentUser?.username));
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

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};
