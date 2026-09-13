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
        console.warn('Notification permission was not granted.');
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

  static getNotificationBody(activity) {
    const duration = this.calculateDuration(activity.time, activity.endTime);
    const priority = activity.priority
      ? `${activity.priority.toUpperCase()} priority`
      : '';
    const categoryLabel =
      typeof activity.category === 'string'
        ? activity.category
        : activity.category?.label || '';
    const category = categoryLabel ? `📂 ${categoryLabel}` : '';

    const parts = [];
    if (duration) parts.push(`⏱️ Duration: ${duration}`);
    if (priority) parts.push(priority);
    if (category) parts.push(category);
    return parts.join(' • ') || 'Time to start your activity!';
  }

  static calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return null;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    if ([startHour, startMin, endHour, endMin].some(Number.isNaN)) return null;

    const startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;
    if (endMinutes <= startMinutes) endMinutes += 24 * 60;

    const durationMinutes = endMinutes - startMinutes;
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }

  static async scheduleActivityNotification(activity) {
    try {
      if (!activity?.time) {
        throw new Error('Activity reminder requires a start time.');
      }

      const [hours, minutes] = activity.time.split(':').map(Number);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        throw new Error(`Invalid activity reminder time: ${activity.time}`);
      }

      const repeat = activity.repeat || 'none';
      const now = new Date();
      const notificationTime = new Date();
      notificationTime.setHours(hours, minutes, 0, 0);

      if (notificationTime <= now && repeat === 'none') {
        notificationTime.setDate(notificationTime.getDate() + 1);
      }

      const categoryLabel =
        typeof activity.category === 'string'
          ? activity.category
          : activity.category?.label || null;

      const content = {
        title: `📚 Time for: ${activity.title}`,
        body: this.getNotificationBody(activity),
        data: {
          activityId: activity.id,
          type: 'activity_reminder',
          category: categoryLabel,
        },
        categoryIdentifier: 'activity-reminder',
        sound: 'default',
      };

      let trigger;
      if (repeat === 'daily') {
        trigger = { hour: hours, minute: minutes, repeats: true };
      } else if (repeat === 'weekly') {
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
      console.error('Failed to cancel scheduled notifications:', error);
      return false;
    }
  }

  static async scheduleCustomReminder(
    title,
    message,
    dateTime,
    repeat = 'none'
  ) {
    try {
      if (!(dateTime instanceof Date) || Number.isNaN(dateTime.getTime())) {
        throw new Error('A valid reminder date/time is required.');
      }

      const content = {
        title,
        body: message,
        data: { type: 'custom_reminder' },
        sound: 'default',
      };

      let trigger;
      if (repeat === 'daily') {
        trigger = {
          hour: dateTime.getHours(),
          minute: dateTime.getMinutes(),
          repeats: true,
        };
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
      console.error('Failed to load scheduled notifications:', error);
      return [];
    }
  }

  static async rescheduleAllActivityNotifications(activities) {
    try {
      const scheduled = await this.getScheduledNotifications();
      const activityNotifications = scheduled.filter(
        (notification) => notification.content.data?.type === 'activity_reminder'
      );

      for (const notification of activityNotifications) {
        await this.cancelNotification(notification.identifier);
      }

      const results = [];
      for (const activity of activities || []) {
        if (!activity.autoNotify) continue;
        const notificationId = await this.scheduleActivityNotification(activity);
        results.push({
          activityId: activity.id,
          notificationId,
          success: Boolean(notificationId),
        });
      }

      return results;
    } catch (error) {
      console.error('Failed to reschedule activity notifications:', error);
      return [];
    }
  }

  static addNotificationResponseListener(handler) {
    try {
      return Notifications.addNotificationResponseReceivedListener(handler);
    } catch (error) {
      console.error('Failed to attach notification response listener:', error);
      return null;
    }
  }

  static addNotificationReceivedListener(handler) {
    try {
      return Notifications.addNotificationReceivedListener(handler);
    } catch (error) {
      console.error('Failed to attach notification listener:', error);
      return null;
    }
  }
}
