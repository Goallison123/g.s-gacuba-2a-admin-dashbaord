import type {
  ClassGroup,
  Subject,
  Teacher,
  Timetable,
  TimetableSlot,
  TimetableConflict,
  UnplacedSession,
  QualityScore,
  SchoolTiming,
  BreakConfig,
} from '@/types';
import { uid } from '@/store';

// ============================================================================
// DAY / PERIOD STRUCTURE
// ============================================================================

export interface DayPeriod {
  periodIndex: number;
  label: string;
  startTime: string;
  isBreak: boolean;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function toTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function resolveBreaks(timing: SchoolTiming): BreakConfig[] {
  if (timing.breaks && timing.breaks.length > 0) {
    return [...timing.breaks].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  }

  const legacy: BreakConfig[] = [];

  if (timing.hasBreaks) {
    if (timing.firstBreakTime) {
      legacy.push({
        id: 'b1',
        time: timing.firstBreakTime,
        duration: timing.firstBreakDuration || 15,
        label: 'Break',
      });
    }
    if (timing.lunchTime) {
      legacy.push({
        id: 'lunch',
        time: timing.lunchTime,
        duration: timing.lunchDuration || 45,
        label: 'Lunch',
      });
    }
    if (timing.secondBreakTime) {
      legacy.push({
        id: 'b2',
        time: timing.secondBreakTime,
        duration: timing.secondBreakDuration || 20,
        label: 'Break',
      });
    }
  }

  return legacy.sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

export function buildDayStructure(timing: SchoolTiming): DayPeriod[] {
  const periods: DayPeriod[] = [];
  const start = toMinutes(timing.startTime);
  const end = toMinutes(timing.endTime);
  const duration = timing.periodDuration;

  let cursor = start;
  let periodIndex = 0;
  const breaks = resolveBreaks(timing);

  while (cursor + duration <= end) {
    while (breaks.length > 0 && toMinutes(breaks[0].time) <= cursor) {
      const currentBreak = breaks.shift()!;
      periods.push({
        periodIndex: -1,
        label: currentBreak.label,
        startTime: currentBreak.time,
        isBreak: true,
      });
      cursor = toMinutes(currentBreak.time) + currentBreak.duration;
    }

    if (cursor + duration > end) break;

    periods.push({
      periodIndex,
      label: `Period ${periodIndex + 1}`,
      startTime: toTime(cursor),
      isBreak: false,
    });

    cursor += duration;
    periodIndex++;
  }

  return periods;
}

// ============================================================================
// TYPES
// ============================================================================

interface TeachingSession {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  required: number;
}

interface PlacedSession {
  session: TeachingSession;
  day: number;
  periodIndex: number;
}

/**
 * Structured, machine-actionable description of what a recommendation would
 * do if the user clicked it. A UI layer can switch on `actionType` and fire
 * the matching mutation (assign teacher, bump capacity, etc.) instead of
 * only ever showing text.
 */
export interface RecommendationAction {
  actionType:
    | 'add_teacher'
    | 'allow_teacher_subject'
    | 'move_subject_load'
    | 'increase_capacity'
    | 'add_periods'
    | 'balance_subject_periods';
  subjectId?: string;
  subjectName?: string;
  teacherId?: string;
  fromTeacherId?: string;
  toTeacherId?: string;
  classId?: string;
  /** Periods, extra teachers needed, or capacity increase — see actionType. */
  amount?: number;
}

export interface TimetableRecommendation {
  /** Stable id — usable as a React key and for de-duplication. */
  id: string;

  type:
    | 'add_teacher'
    | 'reassign_teacher'
    | 'allow_teacher_subject'
    | 'increase_teacher_capacity'
    | 'add_periods'
    | 'redistribute_subject'
    | 'subject_balance'
    | 'information';

  priority: 'high' | 'medium' | 'low';

  /** Compact, single-line, user-facing action label. E.g. "Add 1 Mathematics teacher". */
  title: string;

  /** Longer explanation — use as a tooltip / expandable detail, not the headline. */
  description: string;

  teacherId?: string;
  fromTeacherId?: string;
  toTeacherId?: string;
  subjectId?: string;
  classId?: string;
  affectedPeriods?: number;

  /** Structured payload a "clickable" recommendation card should dispatch on click. */
  action?: RecommendationAction;
}

export interface TimetableGenerationResult extends Timetable {
  recommendations: TimetableRecommendation[];
  id?: string;
}

// ============================================================================
// RANDOMNESS
// ============================================================================

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// LOOKUP MAPS
// ============================================================================

function createMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

// ============================================================================
// SUBJECT / CLASS RELATIONSHIPS
// ============================================================================

export function subjectsForClass(cls: ClassGroup, subjects: Subject[]): Subject[] {
  return subjects.filter((subject) => {
    if (subject.level !== cls.level) return false;
    if (!subject.classIds || subject.classIds.length === 0) return true;
    return subject.classIds.includes(cls.id);
  });
}

export function classesForSubject(subject: Subject, classes: ClassGroup[]): ClassGroup[] {
  return classes.filter((cls) => {
    if (cls.level !== subject.level) return false;
    if (!subject.classIds || subject.classIds.length === 0) return true;
    return subject.classIds.includes(cls.id);
  });
}

// ============================================================================
// SUBJECT PERIOD CONSISTENCY
// ============================================================================

interface SubjectRequirementIssue {
  level: string;
  subjectId: string;
  subjectName: string;
  expected: number;
  actualByClass: Record<string, number>;
}

/**
 * Classes at the same level must study a shared subject for the same number
 * of periods per week. A subject explicitly scoped to individual classes
 * (via subject.classIds) is exempt — it's allowed to differ by design.
 */
function validateLevelSubjectPeriods(
  classes: ClassGroup[],
  subjects: Subject[],
): SubjectRequirementIssue[] {
  const issues: SubjectRequirementIssue[] = [];
  const levels = Array.from(new Set(classes.map((c) => String(c.level))));

  for (const level of levels) {
    const levelClasses = classes.filter((c) => String(c.level) === level);
    const levelSubjects = subjects.filter((s) => String(s.level) === level);

    for (const subject of levelSubjects) {
      const isCommonSubject = !subject.classIds || subject.classIds.length === 0;
      if (!isCommonSubject) continue;

      const actualByClass: Record<string, number> = {};
      for (const cls of levelClasses) {
        const applies = subjectsForClass(cls, subjects).some((s) => s.id === subject.id);
        if (applies) actualByClass[cls.id] = subject.periodsPerWeek;
      }

      const values = Object.values(actualByClass);
      if (values.length <= 1) continue;

      const unique = Array.from(new Set(values));
      if (unique.length > 1) {
        issues.push({
          level,
          subjectId: subject.id,
          subjectName: subject.name,
          expected: subject.periodsPerWeek,
          actualByClass,
        });
      }
    }
  }

  return issues;
}

// ============================================================================
// TEACHER ELIGIBILITY
// ============================================================================

function teacherCanTeachClass(teacher: Teacher, classId: string): boolean {
  return teacher.classIds.includes(classId);
}

function teacherCanTeachSubject(teacher: Teacher, subjectId: string): boolean {
  return teacher.subjectIds.includes(subjectId);
}

function getEligibleTeachers(
  session: TeachingSession,
  subject: Subject,
  teachers: Teacher[],
): Teacher[] {
  const exact = teachers.filter(
    (teacher) =>
      teacherCanTeachSubject(teacher, subject.id) && teacherCanTeachClass(teacher, session.classId),
  );

  if (exact.length > 0) return exact;

  // No teacher is explicitly assigned to this class for this subject.
  // Fall back to anyone qualified for the subject at all.
  return teachers.filter((teacher) => teacherCanTeachSubject(teacher, subject.id));
}

// ============================================================================
// BUILD SESSIONS
// ============================================================================

function buildSessions(
  classes: ClassGroup[],
  subjects: Subject[],
  teachers: Teacher[],
): {
  sessions: TeachingSession[];
  recommendations: TimetableRecommendation[];
} {
  const sessions: TeachingSession[] = [];
  const recommendations: TimetableRecommendation[] = [];
  const teacherLoadCapacity = new Map<string, number>();

  for (const teacher of teachers) {
    teacherLoadCapacity.set(teacher.id, teacher.maxPeriodsPerWeek || 30);
  }

  for (const cls of classes) {
    const classSubjects = subjectsForClass(cls, subjects);

    for (const subject of classSubjects) {
      const eligible = teachers.filter(
        (teacher) => teacher.subjectIds.includes(subject.id) && teacher.classIds.includes(cls.id),
      );

      const subjectTeachers = teachers.filter((teacher) => teacher.subjectIds.includes(subject.id));

      if (eligible.length === 0 && subjectTeachers.length === 0) {
        // No recommendation pushed here — the post-run, subject-level
        // recommendation engine (buildActionableRecommendations) produces
        // a single deduplicated "Add N <Subject> teacher(s)" entry instead
        // of one per class. We still register the session so it shows up
        // in the unplaced report.
        sessions.push({
          id: `${cls.id}-${subject.id}`,
          classId: cls.id,
          subjectId: subject.id,
          teacherId: '',
          required: subject.periodsPerWeek,
        });
        continue;
      }

      const pool = eligible.length > 0 ? eligible : subjectTeachers;

      // Select the teacher with the most remaining tracked capacity —
      // this is a look-ahead-free greedy balancer. It only balances within
      // whatever `pool` already allows (i.e. it never overrides an explicit
      // class→teacher assignment). Real overcommitment across many classes
      // is caught later, post-run, by the recommendation engine.
      let selected = pool[0];
      for (const candidate of pool) {
        const selectedCapacity = teacherLoadCapacity.get(selected.id) || 0;
        const candidateCapacity = teacherLoadCapacity.get(candidate.id) || 0;
        if (candidateCapacity > selectedCapacity) selected = candidate;
      }

      const availableCapacity = teacherLoadCapacity.get(selected.id) || 0;

      sessions.push({
        id: `${cls.id}-${subject.id}`,
        classId: cls.id,
        subjectId: subject.id,
        teacherId: selected.id,
        required: subject.periodsPerWeek,
      });

      teacherLoadCapacity.set(selected.id, Math.max(0, availableCapacity - subject.periodsPerWeek));
    }
  }

  return { sessions, recommendations };
}

// ============================================================================
// GRID
// ============================================================================

function grid(days: number, periods: number): Set<string>[][] {
  return Array.from({ length: days }, () =>
    Array.from({ length: periods }, () => new Set<string>()),
  );
}

// ============================================================================
// SLOT SCORING
// ============================================================================

function scoreCandidate(
  session: TeachingSession,
  subject: Subject,
  teacher: Teacher,
  day: number,
  periodIndex: number,
  classBusy: Set<string>[][],
  teacherBusy: Set<string>[][],
  classDailyCount: Record<string, number[]>,
  classSubjectDays: Record<string, Record<string, Set<number>>>,
  classSubjectDaily: Record<string, Record<string, number[]>>,
  teacherDailyLoad: Record<string, number[]>,
): number {
  let score = 0;

  score += (classDailyCount[session.classId]?.[day] || 0) * 4;
  score += (teacherDailyLoad[teacher.id]?.[day] || 0) * 3;

  const subjectDays = classSubjectDays[session.classId]?.[session.subjectId];
  if (subjectDays?.has(day)) {
    score += 18;
  } else {
    score -= 6;
  }

  const daily = classSubjectDaily[session.classId]?.[session.subjectId]?.[day] || 0;
  if (daily > 0) score += daily * 12;

  score += periodIndex * 0.35;

  const before = periodIndex > 0 && classBusy[day][periodIndex - 1].has(session.classId);
  const after =
    periodIndex + 1 < classBusy[day].length && classBusy[day][periodIndex + 1].has(session.classId);
  if (before || after) score -= 5;

  if ((teacherDailyLoad[teacher.id]?.[day] || 0) >= 6) score += 8;
  if (teacher.id === session.teacherId) score -= 2;

  return score;
}

// ============================================================================
// PLACE SESSION
// ============================================================================

function placeSession(
  session: TeachingSession,
  teacher: Teacher,
  day: number,
  periodIndex: number,
  teacherBusy: Set<string>[][],
  classBusy: Set<string>[][],
  teacherDailyLoad: Record<string, number[]>,
  teacherWeeklyLoad: Record<string, number>,
  classDailyCount: Record<string, number[]>,
  classSubjectDays: Record<string, Record<string, Set<number>>>,
  classSubjectDaily: Record<string, Record<string, number[]>>,
  placed: PlacedSession[],
): void {
  teacherBusy[day][periodIndex].add(teacher.id);
  classBusy[day][periodIndex].add(session.classId);
  teacherDailyLoad[teacher.id][day]++;
  teacherWeeklyLoad[teacher.id]++;
  classDailyCount[session.classId][day]++;

  if (!classSubjectDays[session.classId]) classSubjectDays[session.classId] = {};
  if (!classSubjectDays[session.classId][session.subjectId]) {
    classSubjectDays[session.classId][session.subjectId] = new Set<number>();
  }
  classSubjectDays[session.classId][session.subjectId].add(day);

  if (!classSubjectDaily[session.classId]) classSubjectDaily[session.classId] = {};
  if (!classSubjectDaily[session.classId][session.subjectId]) {
    classSubjectDaily[session.classId][session.subjectId] = new Array(20).fill(0);
  }
  classSubjectDaily[session.classId][session.subjectId][day]++;

  placed.push({
    session: { ...session, teacherId: teacher.id },
    day,
    periodIndex,
  });
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateTimetable(
  classes: ClassGroup[],
  subjects: Subject[],
  teachers: Teacher[],
  timing: SchoolTiming,
  /**
   * Optional fixed seed for the tie-break RNG. Passing the same seed with
   * the same inputs reproduces the same timetable — useful for a
   * "regenerate" action in the UI and for debugging reported issues.
   * Omit it to keep the previous (time-based) behaviour.
   */
  seed?: number,
): TimetableGenerationResult {
  const dayStructure = buildDayStructure(timing);
  const periodsPerDay = dayStructure.filter((p) => !p.isBreak).length;
  const teachingDays = Math.min(Math.max(timing.teachingDays || 5, 1), 6);

  if (classes.length === 0 || subjects.length === 0 || periodsPerDay === 0 || teachingDays === 0) {
    return {
      id: uid('tt'),
      generatedAt: new Date().toISOString(),
      status: 'draft',
      slots: [],
      conflicts: [],
      unplaced: [],
      quality: {
        overall: 0,
        requiredPeriodsFulfilled: 0,
        teacherConflicts: 0,
        classConflicts: 0,
        breakConflicts: 0,
        studentGaps: 'High',
        teacherWorkloadBalance: 'Poor',
        subjectDistribution: 'Poor',
      },
      recommendations: [
        {
          id: 'setup-incomplete',
          type: 'information',
          priority: 'high',
          title: 'Complete timetable settings',
          description:
            'Add classes, subjects, teachers and valid school periods before generating the timetable.',
        },
      ],
    };
  }

  const subjectMap = createMap(subjects);

  const requirementIssues = validateLevelSubjectPeriods(classes, subjects);
  const recommendations: TimetableRecommendation[] = [];

  for (const issue of requirementIssues) {
    recommendations.push({
      id: `balance-${issue.subjectId}-${issue.level}`,
      type: 'subject_balance',
      priority: 'high',
      title: `Align ${issue.subjectName} periods across level ${issue.level}`,
      description:
        `Classes in level ${issue.level} study ${issue.subjectName} for different numbers of ` +
        `periods per week. Set the requirement consistently before finalizing the timetable.`,
      subjectId: issue.subjectId,
      action: {
        actionType: 'balance_subject_periods',
        subjectId: issue.subjectId,
        subjectName: issue.subjectName,
      },
    });
  }

  const built = buildSessions(classes, subjects, teachers);
  const allSessions = built.sessions;
  recommendations.push(...built.recommendations);

  const teacherBusy = grid(teachingDays, periodsPerDay);
  const classBusy = grid(teachingDays, periodsPerDay);
  const teacherDailyLoad: Record<string, number[]> = {};
  const teacherWeeklyLoad: Record<string, number> = {};
  const classDailyCount: Record<string, number[]> = {};
  const classSubjectDays: Record<string, Record<string, Set<number>>> = {};
  const classSubjectDaily: Record<string, Record<string, number[]>> = {};

  for (const teacher of teachers) {
    teacherDailyLoad[teacher.id] = new Array(teachingDays).fill(0);
    teacherWeeklyLoad[teacher.id] = 0;
  }
  for (const cls of classes) {
    classDailyCount[cls.id] = new Array(teachingDays).fill(0);
  }

  const remaining = new Map<string, number>();
  for (const session of allSessions) remaining.set(session.id, session.required);

  const placed: PlacedSession[] = [];

  const orderedSessions = [...allSessions].sort((a, b) => {
    const aSubject = subjectMap.get(a.subjectId);
    const bSubject = subjectMap.get(b.subjectId);
    const aTeachers = aSubject ? getEligibleTeachers(a, aSubject, teachers).length : 0;
    const bTeachers = bSubject ? getEligibleTeachers(b, bSubject, teachers).length : 0;
    if (aTeachers !== bTeachers) return aTeachers - bTeachers;
    return b.required - a.required;
  });

  const totalRequired = allSessions.reduce((sum, session) => sum + session.required, 0);
  const MAX_ATTEMPTS = Math.max(500, totalRequired * 20);
  let attempts = 0;

  const rng = makeRng(seed ?? Date.now());

  // -- PASS 1: respect explicit class→teacher assignment where one exists --
  for (const session of orderedSessions) {
    const subject = subjectMap.get(session.subjectId);
    if (!subject) continue;

    let left = remaining.get(session.id) || 0;

    while (left > 0 && attempts < MAX_ATTEMPTS) {
      attempts++;

      const candidates: { teacher: Teacher; day: number; periodIndex: number; score: number }[] = [];

      for (let day = 0; day < teachingDays; day++) {
        const classLoad = classDailyCount[session.classId][day];

        for (let periodIndex = 0; periodIndex < periodsPerDay; periodIndex++) {
          if (classBusy[day][periodIndex].has(session.classId)) continue;

          const eligibleTeachers = getEligibleTeachers(session, subject, teachers);

          for (const teacher of eligibleTeachers) {
            if (teacher.unavailable?.some((u) => u.day === day && u.periodIndex === periodIndex)) continue;
            if (teacherBusy[day][periodIndex].has(teacher.id)) continue;

            const maxDaily = timing.maxDailyTeacherPeriods || 8;
            const maxWeekly = teacher.maxPeriodsPerWeek || 30;
            if ((teacherDailyLoad[teacher.id]?.[day] || 0) >= maxDaily) continue;
            if ((teacherWeeklyLoad[teacher.id] || 0) >= maxWeekly) continue;

            const score =
              scoreCandidate(
                session,
                subject,
                teacher,
                day,
                periodIndex,
                classBusy,
                teacherBusy,
                classDailyCount,
                classSubjectDays,
                classSubjectDaily,
                teacherDailyLoad,
              ) +
              (teacherWeeklyLoad[teacher.id] || 0) * 2 +
              (teacher.id === session.teacherId ? -8 : 0) +
              classLoad * 0.5;

            candidates.push({ teacher, day, periodIndex, score });
          }
        }
      }

      if (candidates.length === 0) break;

      candidates.sort((a, b) => a.score - b.score);
      const topCount = Math.min(4, candidates.length);
      const selected = candidates[Math.floor(rng() * topCount)];

      placeSession(
        session,
        selected.teacher,
        selected.day,
        selected.periodIndex,
        teacherBusy,
        classBusy,
        teacherDailyLoad,
        teacherWeeklyLoad,
        classDailyCount,
        classSubjectDays,
        classSubjectDaily,
        placed,
      );

      left--;
      remaining.set(session.id, left);
    }
  }

  // -- PASS 2: relax the class→teacher assignment, try anyone qualified --
  for (const session of orderedSessions) {
    const left = remaining.get(session.id) || 0;
    if (left <= 0) continue;

    const subject = subjectMap.get(session.subjectId);
    if (!subject) continue;

    const subjectTeachers = teachers.filter((teacher) => teacher.subjectIds.includes(subject.id));
    if (subjectTeachers.length === 0) continue;

    let remainingToPlace = left;

    while (remainingToPlace > 0 && attempts < MAX_ATTEMPTS) {
      attempts++;

      let best: { teacher: Teacher; day: number; periodIndex: number; score: number } | null = null;

      for (let day = 0; day < teachingDays; day++) {
        for (let periodIndex = 0; periodIndex < periodsPerDay; periodIndex++) {
          if (classBusy[day][periodIndex].has(session.classId)) continue;

          for (const teacher of subjectTeachers) {
            if (teacher.unavailable?.some((u) => u.day === day && u.periodIndex === periodIndex)) continue;
            if (teacherBusy[day][periodIndex].has(teacher.id)) continue;

            const maxDaily = timing.maxDailyTeacherPeriods || 8;
            const maxWeekly = teacher.maxPeriodsPerWeek || 30;
            if ((teacherDailyLoad[teacher.id]?.[day] || 0) >= maxDaily) continue;
            if ((teacherWeeklyLoad[teacher.id] || 0) >= maxWeekly) continue;

            const score = scoreCandidate(
              session,
              subject,
              teacher,
              day,
              periodIndex,
              classBusy,
              teacherBusy,
              classDailyCount,
              classSubjectDays,
              classSubjectDaily,
              teacherDailyLoad,
            );

            if (!best || score < best.score) best = { teacher, day, periodIndex, score };
          }
        }
      }

      if (!best) break;

      placeSession(
        session,
        best.teacher,
        best.day,
        best.periodIndex,
        teacherBusy,
        classBusy,
        teacherDailyLoad,
        teacherWeeklyLoad,
        classDailyCount,
        classSubjectDays,
        classSubjectDaily,
        placed,
      );

      remainingToPlace--;
    }

    remaining.set(session.id, remainingToPlace);
  }

  const slots: TimetableSlot[] = placed.map((item) => ({
    day: item.day,
    periodIndex: item.periodIndex,
    classId: item.session.classId,
    subjectId: item.session.subjectId,
    teacherId: item.session.teacherId,
  }));

  const unplaced: TeachingSession[] = [];
  for (const session of allSessions) {
    const left = remaining.get(session.id) || 0;
    if (left > 0) unplaced.push({ ...session, required: left });
  }

  // Subject-level, deduplicated, clickable recommendations.
  recommendations.push(
    ...buildActionableRecommendations(unplaced, classes, subjects, teachers, slots, timing),
  );

  const uniqueRecommendations = deduplicateRecommendations(recommendations);
  const conflicts = detectConflicts(slots, teachers, classes, timing);
  const unplacedSessions = buildUnplacedReport(unplaced, subjects, classes, teachers, timing, slots);
  const quality = calculateQuality(slots, allSessions, conflicts, teachers, teachingDays, periodsPerDay);

  return {
    id: uid('tt'),
    generatedAt: new Date().toISOString(),
    status: 'draft',
    slots,
    conflicts,
    unplaced: unplacedSessions,
    quality,
    recommendations: uniqueRecommendations,
  };
}

// ============================================================================
// RECOMMENDATION ENGINE (subject-level, actionable, deduplicated)
// ============================================================================

/**
 * Turns raw unplaced sessions into a short list of compact, actionable
 * recommendations — one conclusion per subject, not one paragraph per class.
 *
 * For each subject that has a shortage, it tries mitigations in this order,
 * reducing the remaining shortage as it goes, and only reaches "add a
 * teacher" once the cheaper options are exhausted:
 *
 *   1. Idle capacity — a qualified teacher who isn't assigned any of the
 *      affected classes yet, but has spare weekly periods.
 *         -> "Allow Teacher X to teach Subject"
 *   2. Rebalancing — an overloaded teacher and an underloaded teacher who
 *      both know the subject.
 *         -> "Move Subject from Teacher A to Teacher B"
 *   3. A single bottleneck teacher with a small remaining gap.
 *         -> "Increase Teacher X's weekly capacity"
 *   4. Anything still short after 1–3.
 *         -> "Add N Subject teacher(s)"
 */
function buildActionableRecommendations(
  unplaced: TeachingSession[],
  classes: ClassGroup[],
  subjects: Subject[],
  teachers: Teacher[],
  slots: TimetableSlot[],
  timing: SchoolTiming,
): TimetableRecommendation[] {
  const recommendations: TimetableRecommendation[] = [];
  if (unplaced.length === 0) return recommendations;

  const subjectMap = createMap(subjects);

  const periodsPerDay = buildDayStructure(timing).filter((p) => !p.isBreak).length;
  const teachingDays = timing.teachingDays || 5;
  const totalWeeklyPeriods = teachingDays * periodsPerDay;

  const shortageBySubject = new Map<
    string,
    { total: number; classes: { classId: string; amount: number }[] }
  >();

  for (const item of unplaced) {
    const entry = shortageBySubject.get(item.subjectId) || { total: 0, classes: [] };
    entry.total += item.required;
    entry.classes.push({ classId: item.classId, amount: item.required });
    shortageBySubject.set(item.subjectId, entry);
  }

  for (const [subjectId, shortage] of shortageBySubject) {
    const subject = subjectMap.get(subjectId);
    if (!subject) continue;

    const qualified = teachers.filter((teacher) => teacher.subjectIds.includes(subjectId));

    if (qualified.length === 0) {
      recommendations.push({
        id: `add-teacher-${subjectId}`,
        type: 'add_teacher',
        priority: 'high',
        title: `Add 1 ${subject.name} teacher`,
        description:
          `${shortage.total} period${shortage.total === 1 ? '' : 's'} of ${subject.name} across ` +
          `${shortage.classes.length} class${shortage.classes.length === 1 ? '' : 'es'} cannot be ` +
          `scheduled — no teacher is currently qualified for this subject.`,
        subjectId,
        affectedPeriods: shortage.total,
        action: { actionType: 'add_teacher', subjectId, subjectName: subject.name, amount: 1 },
      });
      continue;
    }

    const load = new Map<string, number>();
    for (const t of qualified) load.set(t.id, slots.filter((s) => s.teacherId === t.id).length);
    const spare = (t: Teacher) => Math.max(0, (t.maxPeriodsPerWeek || 30) - (load.get(t.id) || 0));

    let remainingShortage = shortage.total;
    const shortageClassIds = new Set(shortage.classes.map((c) => c.classId));

    // 1. Idle qualified teachers — known to the subject, not assigned any
    //    of the affected classes, and with spare weekly capacity.
    const idle = qualified
      .filter((t) => spare(t) > 0 && !t.classIds.some((cid) => shortageClassIds.has(cid)))
      .sort((a, b) => spare(b) - spare(a));

    for (const t of idle) {
      if (remainingShortage <= 0) break;
      const take = Math.min(spare(t), remainingShortage);
      if (take <= 0) continue;

      const targetClass = shortage.classes.find((c) => c.amount > 0);
      recommendations.push({
        id: `allow-${t.id}-${subjectId}`,
        type: 'allow_teacher_subject',
        priority: 'medium',
        title: `Allow ${t.lastName} to teach ${subject.name}`,
        description:
          `${t.lastName} is qualified for ${subject.name} and has about ${spare(t)} spare weekly ` +
          `period(s), but isn't currently assigned to any class that needs it.`,
        teacherId: t.id,
        subjectId,
        classId: targetClass?.classId,
        affectedPeriods: take,
        action: {
          actionType: 'allow_teacher_subject',
          teacherId: t.id,
          subjectId,
          subjectName: subject.name,
          classId: targetClass?.classId,
          amount: take,
        },
      });

      load.set(t.id, (load.get(t.id) || 0) + take);
      remainingShortage -= take;
    }

    if (remainingShortage <= 0) continue;

    // 2. Move load from an overloaded teacher to an underloaded one.
    const overloaded = qualified.filter(
      (t) => t.classIds.some((cid) => shortageClassIds.has(cid)) && spare(t) === 0,
    );
    const underloaded = qualified
      .filter((t) => spare(t) > 0 && !overloaded.includes(t))
      .sort((a, b) => spare(b) - spare(a));

    for (const from of overloaded) {
      if (remainingShortage <= 0) break;
      const to = underloaded.find((t) => spare(t) > 0);
      if (!to) break;

      const take = Math.min(spare(to), remainingShortage);
      if (take <= 0) continue;

      // Pick one concrete class to actually move, so the UI can apply this
      // recommendation directly (reassign classId from `from` to `to`)
      // instead of only describing the swap in prose.
      const moveClass =
        shortage.classes.find((c) => c.amount > 0 && from.classIds.includes(c.classId)) ||
        shortage.classes.find((c) => c.amount > 0);

      recommendations.push({
        id: `move-${from.id}-${to.id}-${subjectId}`,
        type: 'reassign_teacher',
        priority: 'medium',
        title: `Move ${subject.name} from ${from.lastName} to ${to.lastName}`,
        description:
          `${from.lastName} is at full weekly capacity for ${subject.name}. ${to.lastName} is also ` +
          `qualified and has about ${spare(to)} spare weekly period(s).`,
        fromTeacherId: from.id,
        toTeacherId: to.id,
        subjectId,
        classId: moveClass?.classId,
        affectedPeriods: take,
        action: {
          actionType: 'move_subject_load',
          fromTeacherId: from.id,
          toTeacherId: to.id,
          subjectId,
          subjectName: subject.name,
          classId: moveClass?.classId,
          amount: take,
        },
      });

      load.set(to.id, (load.get(to.id) || 0) + take);
      remainingShortage -= take;
      if (spare(to) <= 0) {
        const idx = underloaded.indexOf(to);
        if (idx >= 0) underloaded.splice(idx, 1);
      }
    }

    if (remainingShortage <= 0) continue;

    // 3. A single realistic bottleneck teacher with a modest remaining gap
    //    (≤25% of their cap) — cheaper to raise their cap than hire.
    if (qualified.length === 1 && remainingShortage <= (qualified[0].maxPeriodsPerWeek || 30) * 0.25) {
      const t = qualified[0];
      recommendations.push({
        id: `capacity-${t.id}-${subjectId}`,
        type: 'increase_teacher_capacity',
        priority: 'medium',
        title: `Increase ${t.lastName}'s weekly capacity`,
        description:
          `${t.lastName} is the only teacher qualified for ${subject.name} and is short by about ` +
          `${remainingShortage} weekly period(s). Raising their weekly cap could close the gap.`,
        teacherId: t.id,
        subjectId,
        affectedPeriods: remainingShortage,
        action: {
          actionType: 'increase_capacity',
          teacherId: t.id,
          subjectId,
          subjectName: subject.name,
          amount: remainingShortage,
        },
      });
      continue;
    }

    // 4. Nothing left to redistribute — recommend hiring, sized to the gap.
    const avgCapacity =
      qualified.reduce((sum, t) => sum + (t.maxPeriodsPerWeek || 30), 0) / qualified.length || 30;
    const teachersNeeded = Math.max(1, Math.ceil(remainingShortage / avgCapacity));

    recommendations.push({
      id: `add-teacher-${subjectId}-shortfall`,
      type: 'add_teacher',
      priority: 'high',
      title: `Add ${teachersNeeded} ${subject.name} teacher${teachersNeeded > 1 ? 's' : ''}`,
      description:
        `Even after redistributing load across existing ${subject.name} teachers, ` +
        `${remainingShortage} weekly period(s) remain unscheduled.`,
      subjectId,
      affectedPeriods: remainingShortage,
      action: {
        actionType: 'add_teacher',
        subjectId,
        subjectName: subject.name,
        amount: teachersNeeded,
      },
    });
  }

  // Whole-school capacity check: even a perfectly staffed subject roster
  // can't fit more periods than the week actually has.
  const totalRequired = subjects.reduce((sum, subject) => {
    const subjectClasses = classesForSubject(subject, classes);
    return sum + subject.periodsPerWeek * subjectClasses.length;
  }, 0);

  const totalClassCapacity = classes.length * totalWeeklyPeriods;

  if (totalRequired > totalClassCapacity) {
    recommendations.push({
      id: 'add-periods-schoolwide',
      type: 'add_periods',
      priority: 'high',
      title: 'Add teaching periods',
      description:
        `The school requires approximately ${totalRequired} subject periods, but the current ` +
        `timetable has only ${totalClassCapacity} class-period slots. Extend the school day, add a ` +
        `teaching day, or reduce weekly subject requirements.`,
      affectedPeriods: totalRequired - totalClassCapacity,
      action: { actionType: 'add_periods', amount: totalRequired - totalClassCapacity },
    });
  }

  return recommendations;
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

function deduplicateRecommendations(
  recommendations: TimetableRecommendation[],
): TimetableRecommendation[] {
  const seen = new Set<string>();
  const result: TimetableRecommendation[] = [];

  for (const recommendation of recommendations) {
    if (seen.has(recommendation.id)) continue;
    seen.add(recommendation.id);
    result.push(recommendation);
  }

  const priority = { high: 0, medium: 1, low: 2 };
  result.sort((a, b) => priority[a.priority] - priority[b.priority]);

  return result.slice(0, 20);
}

// ============================================================================
// UNPLACED REPORT (kept as secondary/detail data — the recommendations
// above are the primary, compact surface for the UI)
// ============================================================================

function buildUnplacedReport(
  unplaced: TeachingSession[],
  subjects: Subject[],
  classes: ClassGroup[],
  teachers: Teacher[],
  timing: SchoolTiming,
  slots: TimetableSlot[],
): UnplacedSession[] {
  const subjectMap = createMap(subjects);
  const classMap = createMap(classes);
  const teacherMap = createMap(teachers);

  const dayStructure = buildDayStructure(timing);
  const periodsPerDay = dayStructure.filter((p) => !p.isBreak).length;
  const totalSlots = (timing.teachingDays || 5) * periodsPerDay;

  return unplaced.map((item) => {
    const subject = subjectMap.get(item.subjectId);
    const cls = classMap.get(item.classId);
    const teacher = item.teacherId ? teacherMap.get(item.teacherId) : undefined;

    const scheduled = slots.filter(
      (slot) => slot.classId === item.classId && slot.subjectId === item.subjectId,
    ).length;

    let reason = 'No available slot satisfies the current constraints.';

    if (!teacher && subject) {
      reason = `No teacher is currently assigned to ${subject.name}.`;
    } else if (teacher) {
      const teacherLoad = slots.filter((slot) => slot.teacherId === teacher.id).length;
      const max = teacher.maxPeriodsPerWeek || 30;

      if (teacherLoad >= max) {
        reason = `${teacher.lastName} has reached the configured weekly workload limit.`;
      } else if (teacher.unavailable && teacher.unavailable.length > 0) {
        reason = `${teacher.lastName} has unavailable periods that reduce scheduling capacity.`;
      }
    }

    if (totalSlots < item.required) {
      reason =
        `The school week has only ${totalSlots} periods per class, which is insufficient for ` +
        `the requested requirement.`;
    }

    return {
      classId: item.classId,
      subjectId: item.subjectId,
      teacherId: item.teacherId,
      required: item.required,
      scheduled,
      reason:
        `${subject?.name || 'Unknown subject'} — ${cls?.name || 'Unknown class'}: ` +
        `${item.required} period${item.required === 1 ? '' : 's'} remain unscheduled. ${reason}`,
    };
  });
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

export function detectConflicts(
  slots: TimetableSlot[],
  teachers: Teacher[],
  classes: ClassGroup[],
  timing: SchoolTiming,
): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];

  const teacherMap = new Map<string, TimetableSlot[]>();
  for (const slot of slots) {
    const key = `${slot.teacherId}-${slot.day}-${slot.periodIndex}`;
    if (!teacherMap.has(key)) teacherMap.set(key, []);
    teacherMap.get(key)!.push(slot);
  }

  for (const [, group] of teacherMap) {
    if (group.length <= 1) continue;
    const teacher = teachers.find((t) => t.id === group[0].teacherId);
    conflicts.push({
      type: 'teacher',
      day: group[0].day,
      periodIndex: group[0].periodIndex,
      teacherId: group[0].teacherId,
      description:
        `${teacher ? `${teacher.lastName}, ${teacher.firstName}` : 'Unknown teacher'} is assigned to ` +
        `multiple classes at the same time.`,
    });
  }

  const classMap = new Map<string, TimetableSlot[]>();
  for (const slot of slots) {
    const key = `${slot.classId}-${slot.day}-${slot.periodIndex}`;
    if (!classMap.has(key)) classMap.set(key, []);
    classMap.get(key)!.push(slot);
  }

  for (const [, group] of classMap) {
    if (group.length <= 1) continue;
    const cls = classes.find((c) => c.id === group[0].classId);
    conflicts.push({
      type: 'class',
      day: group[0].day,
      periodIndex: group[0].periodIndex,
      classId: group[0].classId,
      description: `${cls?.name || 'A class'} has multiple subjects assigned at the same time.`,
    });
  }

  void timing;
  return conflicts;
}

// ============================================================================
// QUALITY
// ============================================================================

function calculateQuality(
  slots: TimetableSlot[],
  sessions: TeachingSession[],
  conflicts: TimetableConflict[],
  teachers: Teacher[],
  teachingDays: number,
  periodsPerDay: number,
): QualityScore {
  const totalRequired = sessions.reduce((sum, session) => sum + session.required, 0);
  const totalScheduled = slots.length;
  const fulfilled = totalRequired > 0 ? (totalScheduled / totalRequired) * 100 : 100;

  const teacherConflicts = conflicts.filter((c) => c.type === 'teacher').length;
  const classConflicts = conflicts.filter((c) => c.type === 'class').length;
  const breakConflicts = conflicts.filter((c) => c.type === 'break').length;

  let totalGaps = 0;
  const classDayMap = new Map<string, Set<number>>();

  for (const slot of slots) {
    const key = `${slot.classId}-${slot.day}`;
    if (!classDayMap.has(key)) classDayMap.set(key, new Set());
    classDayMap.get(key)!.add(slot.periodIndex);
  }

  for (const periods of classDayMap.values()) {
    const sorted = Array.from(periods).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] > 1) totalGaps++;
    }
  }

  const studentGaps: QualityScore['studentGaps'] =
    totalGaps < sessions.length ? 'Low' : totalGaps < sessions.length * 2 ? 'Medium' : 'High';

  const teacherLoads = teachers.map(
    (teacher) => slots.filter((slot) => slot.teacherId === teacher.id).length,
  );

  const avgLoad =
    teacherLoads.length > 0 ? teacherLoads.reduce((a, b) => a + b, 0) / teacherLoads.length : 0;

  const variance =
    teacherLoads.length > 0
      ? teacherLoads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / teacherLoads.length
      : 0;

  const stdDev = Math.sqrt(variance);
  const ratio = avgLoad > 0 ? stdDev / avgLoad : 0;

  const teacherWorkloadBalance: QualityScore['teacherWorkloadBalance'] =
    ratio < 0.25 ? 'Good' : ratio < 0.5 ? 'Fair' : 'Poor';

  let poorDistribution = 0;
  const classSubjectDayMap = new Map<string, Set<number>>();

  for (const slot of slots) {
    const key = `${slot.classId}-${slot.subjectId}`;
    if (!classSubjectDayMap.has(key)) classSubjectDayMap.set(key, new Set());
    classSubjectDayMap.get(key)!.add(slot.day);
  }

  for (const [key, days] of classSubjectDayMap) {
    const parts = key.split('-');
    const subjectId = parts[parts.length - 1];
    const session = sessions.find((s) => s.subjectId === subjectId);

    if (session && session.required >= 3 && days.size === 1) poorDistribution++;
  }

  const subjectDistribution: QualityScore['subjectDistribution'] =
    poorDistribution === 0 ? 'Good' : poorDistribution < sessions.length * 0.2 ? 'Fair' : 'Poor';

  let overall = 0;
  overall += fulfilled * 0.4;
  overall += (teacherConflicts === 0 ? 100 : Math.max(0, 100 - teacherConflicts * 20)) * 0.2;
  overall += (classConflicts === 0 ? 100 : Math.max(0, 100 - classConflicts * 20)) * 0.2;
  overall += (studentGaps === 'Low' ? 100 : studentGaps === 'Medium' ? 60 : 30) * 0.1;
  overall += (teacherWorkloadBalance === 'Good' ? 100 : teacherWorkloadBalance === 'Fair' ? 60 : 30) * 0.1;

  void teachingDays;
  void periodsPerDay;

  return {
    overall: Math.round(Math.min(100, Math.max(0, overall))),
    requiredPeriodsFulfilled: Math.round(Math.min(100, fulfilled)),
    teacherConflicts,
    classConflicts,
    breakConflicts,
    studentGaps,
    teacherWorkloadBalance,
    subjectDistribution,
  };
}

// ============================================================================
// MANUAL SLOT VALIDATION
// ============================================================================

export function validateSlotPlacement(
  slot: TimetableSlot,
  allSlots: TimetableSlot[],
  teachers: Teacher[],
  timing?: SchoolTiming,
): { valid: boolean; reason?: string } {
  const teacher = teachers.find((t) => t.id === slot.teacherId);
  if (!teacher) return { valid: false, reason: 'Teacher not found.' };

  if (teacher.unavailable?.some((u) => u.day === slot.day && u.periodIndex === slot.periodIndex)) {
    return { valid: false, reason: `Teacher ${teacher.lastName} is unavailable at this time.` };
  }

  const teacherConflict = allSlots.find(
    (existing) =>
      existing.teacherId === slot.teacherId &&
      existing.day === slot.day &&
      existing.periodIndex === slot.periodIndex &&
      existing.classId !== slot.classId,
  );

  if (teacherConflict) {
    return {
      valid: false,
      reason: `Teacher ${teacher.lastName} is already teaching another class at this time.`,
    };
  }

  const classConflict = allSlots.find(
    (existing) =>
      existing.classId === slot.classId &&
      existing.day === slot.day &&
      existing.periodIndex === slot.periodIndex &&
      existing.teacherId !== slot.teacherId,
  );

  if (classConflict) {
    return { valid: false, reason: 'This class already has a subject scheduled at this time.' };
  }

  void timing;
  return { valid: true };
}

// ============================================================================
// TEACHER WORKLOAD
// ============================================================================

export interface TeacherWorkload {
  teacherId: string;
  requiredSessions: number;
  scheduledSessions: number;
  freePeriods: number;
  dailyLoad: number[];
  weeklyLoad: number;
  totalSlots: number;
}

export function calculateTeacherWorkload(
  teacher: Teacher,
  classes: ClassGroup[],
  subjects: Subject[],
  timing: SchoolTiming,
  slots: TimetableSlot[],
): TeacherWorkload {
  const dayStructure = buildDayStructure(timing);
  const periodsPerDay = dayStructure.filter((p) => !p.isBreak).length;
  const teachingDays = timing.teachingDays || 5;
  const totalSlots = teachingDays * periodsPerDay;

  let requiredSessions = 0;

  for (const subject of subjects) {
    if (!teacher.subjectIds.includes(subject.id)) continue;

    for (const cls of classes) {
      if (!teacher.classIds.includes(cls.id)) continue;

      const applies = subjectsForClass(cls, subjects).some((item) => item.id === subject.id);
      if (applies) requiredSessions += subject.periodsPerWeek;
    }
  }

  const teacherSlots = slots.filter((slot) => slot.teacherId === teacher.id);
  const scheduledSessions = teacherSlots.length;
  const dailyLoad = new Array(teachingDays).fill(0);

  for (const slot of teacherSlots) {
    if (slot.day < teachingDays) dailyLoad[slot.day]++;
  }

  return {
    teacherId: teacher.id,
    requiredSessions,
    scheduledSessions,
    freePeriods: Math.max(0, totalSlots - scheduledSessions),
    dailyLoad,
    weeklyLoad: scheduledSessions,
    totalSlots,
  };
}

// ============================================================================
// DAY NAMES
// ============================================================================

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];