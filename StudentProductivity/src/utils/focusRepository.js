import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from './planRepository';

function trackerKey(user) {
  return user?.email ? `study_tracker_data_${user.email}` : 'study_tracker_data';
}

function runtimeKey(user) {
  return user?.email ? `focus_runtime_${user.email}` : 'focus_runtime';
}

function safeParse(raw, fallback = {}) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (error) {
    console.error('Unable to parse focus data:', error);
    return fallback;
  }
}

async function readTracker(user) {
  const raw = await AsyncStorage.getItem(trackerKey(user));
  return safeParse(raw, {});
}

async function writeTracker(user, tracker) {
  await AsyncStorage.setItem(trackerKey(user), JSON.stringify(tracker));
}

function requireUser(user) {
  if (!user?.email) throw new Error('A signed-in local profile is required.');
}

export function elapsedFocusSeconds(runtime, now = Date.now()) {
  if (!runtime?.startedAt) return 0;
  const startedAt = Number(runtime.startedAt);
  const pausedAt = runtime.status === 'paused' && runtime.pausedAt
    ? Number(runtime.pausedAt)
    : now;
  const pausedMs = Number(runtime.accumulatedPausedMs || 0);
  return Math.max(0, Math.floor((pausedAt - startedAt - pausedMs) / 1000));
}

export async function loadFocusWorkspace(user) {
  if (!user?.email) {
    return { subjects: [], plannedSessions: [], sessions: [], goals: { dailyMinutes: 120 }, runtime: null };
  }

  const [trackerRaw, runtimeRaw] = await Promise.all([
    AsyncStorage.getItem(trackerKey(user)),
    AsyncStorage.getItem(runtimeKey(user)),
  ]);
  const tracker = safeParse(trackerRaw, {});
  const runtime = safeParse(runtimeRaw, null);

  return {
    subjects: Array.isArray(tracker.subjects) ? tracker.subjects : [],
    plannedSessions: Array.isArray(tracker.plannedSessions) ? tracker.plannedSessions : [],
    sessions: Array.isArray(tracker.sessions) ? tracker.sessions : [],
    goals: tracker.goals || { dailyMinutes: 120 },
    runtime: runtime?.startedAt ? runtime : null,
  };
}

export async function createSubject(user, name) {
  requireUser(user);
  const trimmedName = name?.trim();
  if (!trimmedName) throw new Error('Subject name is required.');

  const tracker = await readTracker(user);
  const subjects = Array.isArray(tracker.subjects) ? tracker.subjects : [];
  const duplicate = subjects.some((subject) => subject.name?.toLowerCase() === trimmedName.toLowerCase());
  if (duplicate) throw new Error('That subject already exists.');

  const subject = {
    id: `subject-${Date.now()}`,
    name: trimmedName,
    topics: [],
    lastStudied: null,
    createdAt: new Date().toISOString(),
  };

  await writeTracker(user, { ...tracker, subjects: [...subjects, subject] });
  return subject;
}

export async function renameSubject(user, subjectId, name) {
  requireUser(user);
  const trimmedName = name?.trim();
  if (!trimmedName) throw new Error('Subject name is required.');
  const tracker = await readTracker(user);
  const subjects = Array.isArray(tracker.subjects) ? tracker.subjects : [];
  if (subjects.some((subject) => subject.id !== subjectId && subject.name?.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error('That subject name already exists.');
  }
  const found = subjects.some((subject) => subject.id === subjectId);
  if (!found) throw new Error('Subject not found.');
  const nextSubjects = subjects.map((subject) => subject.id === subjectId
    ? { ...subject, name: trimmedName, updatedAt: new Date().toISOString() }
    : subject);
  await writeTracker(user, { ...tracker, subjects: nextSubjects });
  return nextSubjects.find((subject) => subject.id === subjectId);
}

export async function addSubjectTopic(user, subjectId, name) {
  requireUser(user);
  const trimmedName = name?.trim();
  if (!trimmedName) throw new Error('Topic name is required.');
  const tracker = await readTracker(user);
  const subjects = Array.isArray(tracker.subjects) ? tracker.subjects : [];
  const target = subjects.find((subject) => subject.id === subjectId);
  if (!target) throw new Error('Subject not found.');
  const topics = Array.isArray(target.topics) ? target.topics : [];
  const exists = topics.some((topic) => {
    const topicLabel = typeof topic === 'string' ? topic : topic?.name;
    return topicLabel?.toLowerCase() === trimmedName.toLowerCase();
  });
  if (exists) throw new Error('That topic already exists.');
  const nextSubjects = subjects.map((subject) => subject.id === subjectId
    ? { ...subject, topics: [...topics, { name: trimmedName, lastStudied: null, progress: 'Not Started' }] }
    : subject);
  await writeTracker(user, { ...tracker, subjects: nextSubjects });
  return nextSubjects.find((subject) => subject.id === subjectId);
}

export async function removeSubjectTopic(user, subjectId, topicName) {
  requireUser(user);
  const tracker = await readTracker(user);
  const subjects = Array.isArray(tracker.subjects) ? tracker.subjects : [];
  const nextSubjects = subjects.map((subject) => {
    if (subject.id !== subjectId) return subject;
    const topics = Array.isArray(subject.topics) ? subject.topics : [];
    return {
      ...subject,
      topics: topics.filter((topic) => (typeof topic === 'string' ? topic : topic?.name) !== topicName),
    };
  });
  await writeTracker(user, { ...tracker, subjects: nextSubjects });
  return nextSubjects.find((subject) => subject.id === subjectId) || null;
}

export async function updateStudyGoal(user, dailyMinutes) {
  requireUser(user);
  const minutes = Math.max(10, Math.min(1440, Math.round(Number(dailyMinutes || 0))));
  if (!Number.isFinite(minutes)) throw new Error('Enter a valid daily goal.');
  const tracker = await readTracker(user);
  const goals = { ...(tracker.goals || {}), dailyMinutes: minutes };
  await writeTracker(user, { ...tracker, goals });
  return goals;
}

export async function startFocusRuntime(user, input) {
  requireUser(user);
  if (!input?.subjectId) throw new Error('Choose a subject first.');

  const existingRaw = await AsyncStorage.getItem(runtimeKey(user));
  const existing = safeParse(existingRaw, null);
  if (existing?.startedAt) throw new Error('A focus session is already active.');

  const runtime = {
    id: `focus-${Date.now()}`,
    subjectId: input.subjectId,
    subjectName: input.subjectName || 'Study session',
    topic: input.topic?.trim() || '',
    plannedSessionId: input.plannedSessionId || null,
    targetMinutes: Number(input.targetMinutes || 0) || null,
    startedAt: Date.now(),
    pausedAt: null,
    accumulatedPausedMs: 0,
    status: 'running',
  };

  await AsyncStorage.setItem(runtimeKey(user), JSON.stringify(runtime));
  return runtime;
}

export async function pauseFocusRuntime(user, runtime) {
  if (!runtime?.startedAt || runtime.status !== 'running') return runtime;
  const next = { ...runtime, status: 'paused', pausedAt: Date.now() };
  await AsyncStorage.setItem(runtimeKey(user), JSON.stringify(next));
  return next;
}

export async function resumeFocusRuntime(user, runtime) {
  if (!runtime?.startedAt || runtime.status !== 'paused') return runtime;
  const now = Date.now();
  const additionalPause = runtime.pausedAt ? now - Number(runtime.pausedAt) : 0;
  const next = {
    ...runtime,
    status: 'running',
    pausedAt: null,
    accumulatedPausedMs: Number(runtime.accumulatedPausedMs || 0) + Math.max(0, additionalPause),
  };
  await AsyncStorage.setItem(runtimeKey(user), JSON.stringify(next));
  return next;
}

export async function discardFocusRuntime(user) {
  await AsyncStorage.removeItem(runtimeKey(user));
}

export async function completeFocusRuntime(user, runtime, notes = '') {
  if (!runtime?.startedAt) throw new Error('There is no active focus session.');

  const tracker = await readTracker(user);
  const subjects = Array.isArray(tracker.subjects) ? tracker.subjects : [];
  const sessions = Array.isArray(tracker.sessions) ? tracker.sessions : [];
  const plannedSessions = Array.isArray(tracker.plannedSessions) ? tracker.plannedSessions : [];
  const duration = elapsedFocusSeconds(runtime);
  if (duration < 1) throw new Error('Study for at least one second before finishing the session.');

  const completedAt = new Date().toISOString();
  const session = {
    id: `session-${Date.now()}`,
    subjectId: runtime.subjectId,
    topic: runtime.topic || '',
    duration,
    date: localDateKey(),
    notes: notes?.trim() || '',
    plannedSessionId: runtime.plannedSessionId || null,
    startedAt: new Date(Number(runtime.startedAt)).toISOString(),
    completedAt,
    sessionType: 'regular',
  };

  const nextSubjects = subjects.map((subject) => {
    if (subject.id !== runtime.subjectId) return subject;
    const updated = { ...subject, lastStudied: completedAt };
    if (runtime.topic) {
      const topics = Array.isArray(subject.topics) ? subject.topics : [];
      const exists = topics.some((topic) => (typeof topic === 'string' ? topic : topic?.name) === runtime.topic);
      updated.topics = exists
        ? topics.map((topic) => {
            const name = typeof topic === 'string' ? topic : topic?.name;
            return name === runtime.topic
              ? { ...(typeof topic === 'string' ? { name: topic } : topic), lastStudied: completedAt, progress: 'In Progress' }
              : topic;
          })
        : [...topics, { name: runtime.topic, lastStudied: completedAt, progress: 'In Progress' }];
    }
    return updated;
  });

  const nextPlannedSessions = runtime.plannedSessionId
    ? plannedSessions.filter((plan) => plan.id !== runtime.plannedSessionId)
    : plannedSessions;

  await writeTracker(user, {
    ...tracker,
    subjects: nextSubjects,
    sessions: [...sessions, session],
    plannedSessions: nextPlannedSessions,
  });
  await AsyncStorage.removeItem(runtimeKey(user));
  return session;
}
