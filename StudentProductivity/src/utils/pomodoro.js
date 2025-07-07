import * as Notifications from 'expo-notifications';

export const POMODORO_PHASES = {
  FOCUS: 'focus',
  BREAK: 'break',
  IDLE: 'idle',
};

export const FOCUS_DURATION_SECONDS = 25 * 60; // 25 minutes
export const BREAK_DURATION_SECONDS = 5 * 60;  // 5 minutes
// const LONG_BREAK_DURATION_SECONDS = 15 * 60; // Optional for later
// const CYCLES_BEFORE_LONG_BREAK = 4; // Optional for later

/**
 * Schedules a local notification for Pomodoro phase changes.
 * @param {string} phase - The current phase ('focus' or 'break').
 * @param {number} durationSeconds - Duration of the current phase.
 */
export async function schedulePomodoroNotification(phase, durationSeconds) {
  let title = '';
  let body = '';

  if (phase === POMODORO_PHASES.FOCUS) {
    title = 'Break Time Over!';
    body = 'Time to start your next focus session!';
  } else if (phase === POMODORO_PHASES.BREAK) {
    title = 'Focus Session Complete!';
    body = 'Time for a short break. Relax and recharge!';
  }

  if (title && body) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { seconds: durationSeconds }, // Notify when the current phase ends
    });
  }
}

/**
 * Cancels all scheduled Pomodoro notifications.
 */
export async function cancelAllPomodoroNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Placeholder for more complex Pomodoro cycle management if needed later
// For example, handling long breaks after a certain number of cycles.
// For now, the StudyTrackerScreen will manage the simple focus/break alternation. 