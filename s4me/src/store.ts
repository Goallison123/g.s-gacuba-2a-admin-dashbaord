import { useSyncExternalStore } from 'react';
import type { SchoolData, SchoolTiming } from '@/types';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 's4me-school-data-v1';

const emptyData: SchoolData = {
  profile: null,
  timing: null,
  classes: [],
  subjects: [],
  teachers: [],
  students: [],
  timetable: null,
  assessments: [],
  marks: [],
  terms: [],
  onboardingComplete: false,
};

export const defaultTiming: SchoolTiming = {
  startTime: '08:00',
  endTime: '17:00',
  periodDuration: 40,
  hasBreaks: true,
  firstBreakTime: '10:00',
  firstBreakDuration: 20,
  lunchTime: '12:30',
  lunchDuration: 60,
  breaks: [],
  teachingDays: 5,
  maxDailyTeacherPeriods: 8,
  maxConsecutivePeriods: 2,
};

function migrate(data: Partial<SchoolData>): SchoolData {
  const merged: SchoolData = { ...emptyData, ...data };

  if (merged.timetable) {
    if (!merged.timetable.unplaced) merged.timetable.unplaced = [];
    if (!merged.timetable.quality) {
      merged.timetable.quality = {
        overall: 0,
        requiredPeriodsFulfilled: 100,
        teacherConflicts: 0,
        classConflicts: 0,
        breakConflicts: 0,
        studentGaps: 'Low',
        teacherWorkloadBalance: 'Good',
        subjectDistribution: 'Good',
      };
    }
  }

  if (merged.timing) {
    if (!merged.timing.breaks) merged.timing.breaks = [];
    if (!merged.timing.teachingDays) merged.timing.teachingDays = 5;
    if (!merged.timing.maxDailyTeacherPeriods) merged.timing.maxDailyTeacherPeriods = 8;
    if (!merged.timing.maxConsecutivePeriods) merged.timing.maxConsecutivePeriods = 2;
  }

  merged.subjects = merged.subjects.map((s) => ({
    ...s,
    maxConsecutive: s.maxConsecutive ?? 2,
    classIds: s.classIds ?? [],
  }));

  merged.teachers = merged.teachers.map((t) => ({
    ...t,
    unavailable: t.unavailable ?? [],
  }));

  return merged;
}

function loadLocal(): SchoolData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData;
    return migrate(JSON.parse(raw));
  } catch {
    return emptyData;
  }
}

let state: SchoolData = emptyData;
let loaded = false;
let syncError: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persistLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

async function persistRemote() {
  try {
    const { data: existing, error: selErr } = await supabase
      .from('school_data')
      .select('id')
      .maybeSingle();

    if (selErr) {
      syncError = selErr.message;
      emit();
      return;
    }

    let writeErr: { message: string } | null = null;

    if (existing) {
      const { error } = await supabase
        .from('school_data')
        .update({ data: state as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      writeErr = error;
    } else {
      const { error } = await supabase
        .from('school_data')
        .insert({ data: state as unknown as Record<string, unknown> });
      writeErr = error;
    }

    if (writeErr) {
      syncError = writeErr.message;
    } else {
      syncError = null;
    }
    emit();
  } catch (err) {
    syncError = err instanceof Error ? err.message : 'Network error during sync';
    emit();
  }
}

export function setData(updater: (draft: SchoolData) => SchoolData | void) {
  const draft = structuredClone(state);
  const result = updater(draft) ?? draft;
  state = result as SchoolData;
  persistLocal();
  persistRemote();
  emit();
}

export function getData(): SchoolData {
  return state;
}

export function getSyncError(): string | null {
  return syncError;
}

export function resetData() {
  state = emptyData;
  syncError = null;
  persistLocal();
  persistRemote();
  emit();
}

async function loadFromRemote(): Promise<SchoolData | null> {
  try {
    const { data, error } = await supabase
      .from('school_data')
      .select('data')
      .maybeSingle();

    if (error) return null;
    if (!data) return null;
    return migrate(data.data as Partial<SchoolData>);
  } catch {
    return null;
  }
}

export async function initStore() {
  if (loaded) return;
  loaded = true;

  const remote = await loadFromRemote();
  if (remote) {
    state = remote;
    persistLocal();
  } else {
    state = loadLocal();
  }
  syncError = null;
  emit();
}

export function resetStore() {
  loaded = false;
  state = emptyData;
  syncError = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSchoolData(): SchoolData {
  return useSyncExternalStore(subscribe, getData, getData);
}

export function useSyncError(): string | null {
  return useSyncExternalStore(subscribe, getSyncError, getSyncError);
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
