import { readJson, writeJson } from '../storage/fileStorage';

export class DataMigrationService {
  // Migrate existing data to include user IDs for proper data isolation
  static async migrateDataForUser(currentUser) {
    if (!currentUser || !currentUser.email) {
      console.warn('No current user provided for data migration');
      return;
    }

    try {
      console.log('Starting data migration for user:', currentUser.email);
      
      // Migrate analytics data
      await this.migrateAnalyticsData(currentUser);
      
      // Migrate session links data
      await this.migrateSessionLinksData(currentUser);
      
      // Migrate flashcards data
      await this.migrateFlashcardsData(currentUser);
      
      console.log('Data migration completed successfully');
    } catch (error) {
      console.error('Error during data migration:', error);
    }
  }

  // Migrate analytics data
  static async migrateAnalyticsData(currentUser) {
    try {
      const analytics = await readJson('analytics.json');
      if (!analytics) return;

      let migrationNeeded = false;

      // Add userId to planner events that don't have it
      if (analytics.plannerEvents) {
        analytics.plannerEvents = analytics.plannerEvents.map(event => {
          if (!event.userId) {
            migrationNeeded = true;
            return { ...event, userId: currentUser.email };
          }
          return event;
        });
      }

      // Add userId to study sessions that don't have it
      if (analytics.studySessions) {
        analytics.studySessions = analytics.studySessions.map(session => {
          if (!session.userId) {
            migrationNeeded = true;
            return { ...session, userId: currentUser.email };
          }
          return session;
        });
      }

      // Add userId to other session types
      ['appSessions', 'focusSessions', 'breakSessions', 'interruptions'].forEach(sessionType => {
        if (analytics[sessionType]) {
          analytics[sessionType] = analytics[sessionType].map(session => {
            if (!session.userId) {
              migrationNeeded = true;
              return { ...session, userId: currentUser.email };
            }
            return session;
          });
        }
      });

      if (migrationNeeded) {
        await writeJson('analytics.json', analytics);
        console.log('Migrated analytics data for user:', currentUser.email);
      }
    } catch (error) {
      console.error('Error migrating analytics data:', error);
    }
  }

  // Migrate session links data
  static async migrateSessionLinksData(currentUser) {
    try {
      const sessionLinks = await readJson('sessionLinks.json');
      if (!sessionLinks || !Array.isArray(sessionLinks)) return;

      let migrationNeeded = false;
      const migratedLinks = sessionLinks.map(link => {
        if (!link.userId) {
          migrationNeeded = true;
          return { ...link, userId: currentUser.email };
        }
        return link;
      });

      if (migrationNeeded) {
        await writeJson('sessionLinks.json', migratedLinks);
        console.log('Migrated session links data for user:', currentUser.email);
      }
    } catch (error) {
      console.error('Error migrating session links data:', error);
    }
  }

  // Migrate flashcards data
  static async migrateFlashcardsData(currentUser) {
    try {
      const flashcards = await readJson('flashcards.json');
      if (!flashcards || !Array.isArray(flashcards)) return;

      let migrationNeeded = false;
      const migratedFlashcards = flashcards.map(deck => {
        if (!deck.userId) {
          migrationNeeded = true;
          return { ...deck, userId: currentUser.email };
        }
        return deck;
      });

      if (migrationNeeded) {
        await writeJson('flashcards.json', migratedFlashcards);
        console.log('Migrated flashcards data for user:', currentUser.email);
      }
    } catch (error) {
      console.error('Error migrating flashcards data:', error);
    }
  }

  // Check if migration is needed (data exists without userId)
  static async isMigrationNeeded() {
    try {
      // Check analytics data
      const analytics = await readJson('analytics.json');
      if (analytics) {
        const hasDataWithoutUserId = 
          (analytics.plannerEvents && analytics.plannerEvents.some(e => !e.userId)) ||
          (analytics.studySessions && analytics.studySessions.some(s => !s.userId)) ||
          (analytics.appSessions && analytics.appSessions.some(s => !s.userId)) ||
          (analytics.focusSessions && analytics.focusSessions.some(s => !s.userId));
        
        if (hasDataWithoutUserId) return true;
      }

      // Check session links data
      const sessionLinks = await readJson('sessionLinks.json');
      if (sessionLinks && Array.isArray(sessionLinks)) {
        if (sessionLinks.some(link => !link.userId)) return true;
      }

      // Check flashcards data
      const flashcards = await readJson('flashcards.json');
      if (flashcards && Array.isArray(flashcards)) {
        if (flashcards.some(deck => !deck.userId)) return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  // Clean up data for a specific user (when deleting account)
  static async cleanupUserData(userEmail) {
    try {
      console.log('Cleaning up data for user:', userEmail);

      // Clean analytics data
      const analytics = await readJson('analytics.json');
      if (analytics) {
        analytics.plannerEvents = (analytics.plannerEvents || []).filter(e => e.userId !== userEmail);
        analytics.studySessions = (analytics.studySessions || []).filter(s => s.userId !== userEmail);
        analytics.appSessions = (analytics.appSessions || []).filter(s => s.userId !== userEmail);
        analytics.focusSessions = (analytics.focusSessions || []).filter(s => s.userId !== userEmail);
        analytics.breakSessions = (analytics.breakSessions || []).filter(s => s.userId !== userEmail);
        analytics.interruptions = (analytics.interruptions || []).filter(i => i.userId !== userEmail);
        await writeJson('analytics.json', analytics);
      }

      // Clean session links data
      const sessionLinks = await readJson('sessionLinks.json');
      if (sessionLinks && Array.isArray(sessionLinks)) {
        const cleanedLinks = sessionLinks.filter(link => link.userId !== userEmail);
        await writeJson('sessionLinks.json', cleanedLinks);
      }

      // Clean flashcards data
      const flashcards = await readJson('flashcards.json');
      if (flashcards && Array.isArray(flashcards)) {
        const cleanedFlashcards = flashcards.filter(deck => deck.userId !== userEmail);
        await writeJson('flashcards.json', cleanedFlashcards);
      }

      console.log('Data cleanup completed for user:', userEmail);
    } catch (error) {
      console.error('Error during data cleanup:', error);
    }
  }
} 