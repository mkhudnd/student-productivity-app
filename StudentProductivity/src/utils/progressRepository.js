import { FlashcardService } from './flashcardService';
import { loadPlanWorkspace, localDateKey } from './planRepository';

function parseDateKey(key) {
  if (!key) return null;
  const date = new Date(`${key}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cutoffKey(days) {
  const date = new Date();
  date.setDate(date.getDate() - Math.max(0, Number(days || 0) - 1));
  return localDateKey(date);
}

function inRange(key, days) {
  return Boolean(key && key >= cutoffKey(days) && key <= localDateKey());
}

function calculateStreak(sessions) {
  const studiedDates = new Set(sessions.map((session) => session.date).filter(Boolean));
  const cursor = new Date();
  if (!studiedDates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (studiedDates.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function buildRecentDays(sessions, count = 7) {
  const totals = new Map();
  sessions.forEach((session) => {
    if (!session?.date) return;
    totals.set(session.date, (totals.get(session.date) || 0) + Number(session.duration || 0) / 60);
  });

  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (count - 1 - index));
    const key = localDateKey(date);
    return {
      key,
      label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date).slice(0, 2),
      minutes: Math.round(totals.get(key) || 0),
    };
  });
}

export async function loadProgressWorkspace(user, days = 30) {
  const [workspace, decks] = await Promise.all([
    loadPlanWorkspace(user),
    FlashcardService.getUserFlashcardDecks(user),
  ]);

  const sessions = (workspace.completedSessions || []).filter((session) => inRange(session.date, days));
  const tasks = (workspace.tasks || []).filter((task) => inRange(task.date, days));
  const subjectMap = new Map((workspace.subjects || []).map((subject) => [subject.id, subject.name]));

  const totalStudyMinutes = Math.round(
    sessions.reduce((sum, session) => sum + Number(session.duration || 0), 0) / 60,
  );
  const activeDays = new Set(sessions.map((session) => session.date).filter(Boolean)).size;
  const averageSessionMinutes = sessions.length ? Math.round(totalStudyMinutes / sessions.length) : 0;

  const subjectTotals = new Map();
  sessions.forEach((session) => {
    const name = subjectMap.get(session.subjectId) || 'Other study';
    subjectTotals.set(name, (subjectTotals.get(name) || 0) + Number(session.duration || 0) / 60);
  });
  const subjectBreakdown = [...subjectTotals.entries()]
    .map(([name, minutes]) => ({ name, minutes: Math.round(minutes) }))
    .sort((a, b) => b.minutes - a.minutes);

  const safeDecks = Array.isArray(decks) ? decks : [];
  const cards = safeDecks.flatMap((deck) => (Array.isArray(deck.cards) ? deck.cards : []));
  const masteredCards = cards.filter((card) => card.known).length;
  const masteryRate = cards.length ? Math.round((masteredCards / cards.length) * 100) : 0;

  const completedTasks = tasks.filter((task) => task.completed).length;
  const planCompletionRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return {
    days,
    totalStudyMinutes,
    sessionCount: sessions.length,
    activeDays,
    averageSessionMinutes,
    streak: calculateStreak(workspace.completedSessions || []),
    dailyGoalMinutes: Number(workspace.goals?.dailyMinutes || 120),
    recentDays: buildRecentDays(workspace.completedSessions || [], 7),
    subjectBreakdown,
    tasks: {
      total: tasks.length,
      completed: completedTasks,
      completionRate: planCompletionRate,
    },
    learn: {
      decks: safeDecks.length,
      cards: cards.length,
      mastered: masteredCards,
      masteryRate,
    },
  };
}
