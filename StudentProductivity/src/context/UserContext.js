import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readJson, writeJson } from '../storage/fileStorage';
import { DataMigrationService } from '../utils/dataMigration';

const UserContext = createContext();

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

  // Load current user from AsyncStorage on app start
  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loginUser = async (user) => {
    try {
      setCurrentUser(user);
      await AsyncStorage.setItem('currentUser', JSON.stringify(user));
      
      // Trigger data migration to ensure proper user isolation
      await DataMigrationService.migrateDataForUser(user);
    } catch (error) {
      console.error('Error saving current user:', error);
    }
  };

  const logoutUser = async () => {
    try {
      setCurrentUser(null);
      await AsyncStorage.removeItem('currentUser');
      
      // Note: We don't clear user-specific data here as users may want to keep their data
      // Data is automatically isolated by user email in the updated components
    } catch (error) {
      console.error('Error removing current user:', error);
      // Even if there's an error, ensure the user state is cleared
      setCurrentUser(null);
    }
  };

  const updateUser = async (updatedUserData) => {
    try {
      // Update user in users.json file
      const users = (await readJson('users.json')) || [];
      const userIndex = users.findIndex(u => u.email === currentUser.email);
      
      if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...updatedUserData };
        await writeJson('users.json', users);
        
        // Update current user in context and AsyncStorage
        const updatedUser = users[userIndex];
        setCurrentUser(updatedUser);
        await AsyncStorage.setItem('currentUser', JSON.stringify(updatedUser));
        
        return { success: true };
      } else {
        return { success: false, error: 'User not found' };
      }
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