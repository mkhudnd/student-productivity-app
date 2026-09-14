import AsyncStorage from '@react-native-async-storage/async-storage';

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function plannerKey(user) {
  return user?.email ? `planner_data_${user.email}` : 'planner_data';
}

function trackerKey(user) {
  return user?.email ? `study_tracker_data_${user.email}` : 'study_tracker_data';
}

function safeParse(raw, fallback = {}) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (error) {
    console.error('Unable to parse local planning data:', error);
    return fallback;
  }
}

function normalizeTask(task, fallbackDate) {
  return {
    ...task,
    id: task?.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: task?.title || 'Untitled task',
    date: task?.date || fallbackDate,
    time: task?.time || null,
    endTime: task?.endTime || null,
    category: task?.category?.label || task?.category || 'Study',
    priority: task?.priority || 'medium',
    completed: Boolean(task?.completed),
    itemType: task?.itemType || 'task',
    source: 'planner',
  };
}

function normalizeStudyPlan(session, subjectsById) {
  const subject = subjectsById.get(session?.subjectId);
  return {
    ...session,
    id: session?.id || `study-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: session?.date || localDateKey(),
    title: subject?.name || 'Study session',
    subjectName: subject?.name || 'Unknown subject',
    plannedDuration: Number(session?.plannedDuration || 0),
    source: 'tracker',
    itemType: 'study',
    completed: false,
  };
}

export async function loadPlanWorkspace(user) {
  if (!user?.email) {
    return {
      tasks: [],
      studyPlans: [],
      subjects: [],
      completedSessions: [],
      goals: { dailyMinutes: 120 },
    };
  }

  const [plannerRaw, trackerRaw] = await Promise.all([
    AsyncStorage.getItem(plannerKey(user)),
    AsyncStorage.getItem(trackerKey(user)),
  ]);

  const planner = safeParse(plannerRaw, {});
  const tracker = safeParse(trackerRaw, {});
  const fallbackDate = localDateKey();
  const subjects = Array.isArray(tracker.subjects) ? tracker.subjects : [];
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
  const tasks = (Array.isArray(planner.tasks) ? planner.tasks : []).map((task) =>
    normalizeTask(task, fallbackDate)
  );
  const studyPlans = (Array.isArray(tracker.plannedSessions) ? tracker.plannedSessions : []).map(
    (session) => normalizeStudyPlan(session, subjectsById)
  );

  return {
    tasks,
    studyPlans,
    subjects,
    completedSessions: Array.isArray(tracker.sessions) ? tracker.sessions : [],
    goals: tracker.goals || { dailyMinutes: 120 },
  };
}

async function readPlanner(user) {
  const raw = await AsyncStorage.getItem(plannerKey(user));
  return safeParse(raw, {});
}

async function readTracker(user) {
  const raw = await AsyncStorage.getItem(trackerKey(user));
  return safeParse(raw, {});
}

export async function savePlanTask(user, input) {
  if (!user?.email) throw new Error('A signed-in local profile is required.');

  const planner = await readPlanner(user);
  const existingTasks = Array.isArray(planner.tasks) ? planner.tasks : [];
  const id = input.id || `task-${Date.now()}`;
  const existing = existingTasks.find((task) => task.id === id);
  const nextTask = {
    ...existing,
    id,
    title: input.title?.trim() || existing?.title || 'Untitled task',
    date: input.date || existing?.date || localDateKey(),
    time: input.time || null,
    endTime: input.endTime || null,
    category: input.category || existing?.category || 'Study',
    color: input.color || existing?.color || '#4F6BFF',
    priority: input.priority || existing?.priority || 'medium',
    itemType: input.itemType || existing?.itemType || 'task',
    completed: input.completed ?? existing?.completed ?? false,
    subtasks: existing?.subtasks || [],
    reminder: existing?.reminder || null,
    notificationId: existing?.notificationId || null,
    activityNotificationId: existing?.activityNotificationId || null,
    repeat: existing?.repeat || 'none',
    autoNotify: existing?.autoNotify ?? false,
    updatedAt: new Date().toISOString(),
  };

  const nextTasks = existingTasks.some((task) => task.id === id)
    ? existingTasks.map((task) => (task.id === id ? nextTask : task))
    : [...existingTasks, nextTask];

  await AsyncStorage.setItem(
    plannerKey(user),
    JSON.stringify({
      ...planner,
      tasks: nextTasks,
      lastUpdated: new Date().toISOString(),
    })
  );

  return nextTask;
}

export async function togglePlanTask(user, taskId) {
  const planner = await readPlanner(user);
  const existingTasks = Array.isArray(planner.tasks) ? planner.tasks : [];
  const nextTasks = existingTasks.map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed } : task
  );

  await AsyncStorage.setItem(
    plannerKey(user),
    JSON.stringify({ ...planner, tasks: nextTasks, lastUpdated: new Date().toISOString() })
  );
}

export async function deletePlanTask(user, taskId) {
  const planner = await readPlanner(user);
  const existingTasks = Array.isArray(planner.tasks) ? planner.tasks : [];
  await AsyncStorage.setItem(
    plannerKey(user),
    JSON.stringify({
      ...planner,
      tasks: existingTasks.filter((task) => task.id !== taskId),
      lastUpdated: new Date().toISOString(),
    })
  );
}

export async function saveStudyPlan(user, input) {
  if (!user?.email) throw new Error('A signed-in local profile is required.');
  if (!input.subjectId) throw new Error('Choose a subject before scheduling study time.');

  const tracker = await readTracker(user);
  const existingPlans = Array.isArray(tracker.plannedSessions) ? tracker.plannedSessions : [];
  const id = input.id || `study-${Date.now()}`;
  const startTime = input.startTime || null;
  const endTime = input.endTime || null;
  let plannedDuration = Number(input.plannedDuration || 0);

  if (!plannedDuration && startTime && endTime) {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    plannedDuration = Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute));
  }

  const existing = existingPlans.find((session) => session.id === id);
  const nextPlan = {
    ...existing,
    id,
    date: input.date || existing?.date || localDateKey(),
    subjectId: input.subjectId,
    topic: input.topic?.trim() || null,
    plannedDuration: plannedDuration || existing?.plannedDuration || 60,
    startTime,
    endTime,
    isRecurring: existing?.isRecurring || false,
    recurringType: existing?.recurringType || null,
    updatedAt: new Date().toISOString(),
  };

  const nextPlans = existingPlans.some((session) => session.id === id)
    ? existingPlans.map((session) => (session.id === id ? nextPlan : session))
    : [...existingPlans, nextPlan];

  await AsyncStorage.setItem(
    trackerKey(user),
    JSON.stringify({ ...tracker, plannedSessions: nextPlans })
  );

  return nextPlan;
}

export async function deleteStudyPlan(user, sessionId) {
  const tracker = await readTracker(user);
  const existingPlans = Array.isArray(tracker.plannedSessions) ? tracker.plannedSessions : [];
  await AsyncStorage.setItem(
    trackerKey(user),
    JSON.stringify({
      ...tracker,
      plannedSessions: existingPlans.filter((session) => session.id !== sessionId),
    })
  );
}
