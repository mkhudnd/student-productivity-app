import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationService {
  static async initialize() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return false;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('activity-reminders', {
          name: 'Activity Reminders',
          description: 'Notifications for scheduled activities',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  }

  static async scheduleActivityNotification(activity) {
    try {
      const now = new Date();
      const [hours, minutes] = activity.time.split(':').map(Number);
      const notificationTime = new Date();
      notificationTime.setHours(hours, minutes, 0, 0);

      if (notificationTime <= now) {
        notificationTime.setDate(notificationTime.getDate() + 1);
      }

      const content = {
        title: `📚 Time for: ${activity.title}`,
        body: this.getNotificationBody(activity),
        data: {
          activityId: activity.id,
          type: 'activity_reminder',
          category: activity.category,
        },
        categoryIdentifier: 'activity-reminder',
        sound: 'default',
      };

      let trigger;
      if (activity.repeat === 'daily') {
        trigger = { hour: hours, minute: minutes, repeats: true };
      } else if (activity.repeat === 'weekly') {
        trigger = {
          weekday: notificationTime.getDay() + 1,
          hour: hours,
          minute: minutes,
          repeats: true,
        };
      } else {
        trigger = { date: notificationTime };
      }

      return await Notifications.scheduleNotificationAsync({ content, trigger });
    } catch (error) {
      console.error('Failed to schedule activity notification:', error);
      return null;
    }
  }

  static getNotificationBody(activity) {
    const duration = this.calculateDuration(activity.time, activity.endTime);
    const priority = activity.priority ? `${activity.priority.toUpperCase()} priority` : '';
    const category = activity.category ? `📂 ${activity.category}` : '';

    let body = '';
    if (duration) body += `⏱️ Duration: ${duration}`;
    if (priority && body) body += ` • ${priority}`;
    else if (priority) body += priority;
    if (category && body) body += ` • ${category}`;
    else if (category) body += category;

    return body || 'Time to start your activity!';
  }

  static calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return null;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const durationMinutes = endMinutes - startMinutes;

    if (durationMinutes <= 0) return null;

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }

  static async cancelNotification(notificationId) {
    if (!notificationId) return false;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      return true;
    } catch (error) {
      console.error('Failed to cancel notification:', error);
      return false;
    }
  }

  static async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return true;
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
      return false;
    }
  }

  static async scheduleCustomReminder(title, message, dateTime, repeat = 'none') {
    try {
      const content = {
        title,
        body: message,
        data: { type: 'custom_reminder' },
        sound: 'default',
      };

      let trigger;
      if (repeat === 'daily') {
        trigger = { hour: dateTime.getHours(), minute: dateTime.getMinutes(), repeats: true };
      } else if (repeat === 'weekly') {
        trigger = {
          weekday: dateTime.getDay() + 1,
          hour: dateTime.getHours(),
          minute: dateTime.getMinutes(),
          repeats: true,
        };
      } else {
        trigger = { date: dateTime };
      }

      return await Notifications.scheduleNotificationAsync({ content, trigger });
    } catch (error) {
      console.error('Failed to schedule custom reminder:', error);
      return null;
    }
  }

  static async getScheduledNotifications() {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to read scheduled notifications:', error);
      return [];
    }
  }

  static async rescheduleAllActivityNotifications(activities) {
    const scheduled = await this.getScheduledNotifications();
    const activityNotifications = scheduled.filter(
      n => n.content.data?.type === 'activity_reminder'
    );

    for (const notification of activityNotifications) {
      await this.cancelNotification(notification.identifier);
    }

    const results = [];
    for (const activity of activities) {
      if (activity.autoNotify) {
        const notificationId = await this.scheduleActivityNotification(activity);
        results.push({ activityId: activity.id, notificationId });
      }
    }
    return results;
  }

  static addNotificationResponseListener(handler) {
    try {
      return Notifications.addNotificationResponseReceivedListener(handler);
    } catch (error) {
      console.error('Failed to add notification response listener:', error);
      return { remove: () => {} };
    }
  }

  static addNotificationReceivedListener(handler) {
    try {
      return Notifications.addNotificationReceivedListener(handler);
    } catch (error) {
      console.error('Failed to add notification received listener:', error);
      return { remove: () => {} };
    }
  }
}
