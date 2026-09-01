export type EducationSystem = 'Rwanda' | 'International' | 'Other';

export type Level = 'Primary' | 'O Level' | 'A Level' | 'TVET';

export type AssessmentType =
  | 'Quiz'
  | 'Test'
  | 'CAT'
  | 'Midterm'
  | 'Examination'
  | 'Reassessment'
  | 'Other';

export interface SchoolProfile {
  name: string;
  country: string;
  district: string;
  sector: string;
  referralSource: string;
  studentCount: number;
  teachingStaffCount: number;
  nonTeachingStaffCount: number;
  educationSystem: EducationSystem;
  levels: Level[];
}

export interface BreakConfig {
  id: string;
  time: string;
  duration: number;
  label: string;
}

export interface SchoolTiming {
  startTime: string;
  endTime: string;
  periodDuration: number;
  hasBreaks: boolean;
  firstBreakTime: string;
  firstBreakDuration: number;
  lunchTime: string;
  lunchDuration: number;
  secondBreakTime?: string;
  secondBreakDuration?: number;
  breaks: BreakConfig[];
  teachingDays: number;
  maxDailyTeacherPeriods: number;
  maxConsecutivePeriods: number;
}

export interface ClassGroup {
  id: string;
  level: Level;
  name: string;
  capacity: number;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  level: Level;
  periodsPerWeek: number;
  maxConsecutive: number;
  classIds: string[];
}

export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  subjectIds: string[];
  classIds: string[];
  maxPeriodsPerWeek: number;
  unavailable: { day: number; periodIndex: number }[];
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  classId: string;
  studentNumber: string;
  gender?: 'M' | 'F';
}

export interface Assessment {
  id: string;
  name: string;
  type: AssessmentType;
  classId: string;
  subjectId: string;
  maxMarks: number;
  date: string;
  term: string;
}

export interface MarkRecord {
  studentId: string;
  assessmentId: string;
  marks: number | null;
}

export interface TimetableSlot {
  day: number;
  periodIndex: number;
  classId: string;
  subjectId: string;
  teacherId: string;
}

export interface TimetableConflict {
  day: number;
  periodIndex: number;
  description: string;
  type?: string;
  teacherId?: string;
  classId?: string;
}

export interface UnplacedSession {
  classId: string;
  subjectId: string;
  teacherId: string;
  required: number;
}

export interface QualityScore {
  overall: number;
  requiredPeriodsFulfilled: number;
  teacherConflicts: number;
  classConflicts: number;
  breakConflicts: number;
  studentGaps: string;
  teacherWorkloadBalance: string;
  subjectDistribution: string;
}

export interface Timetable {
  slots: TimetableSlot[];
  status: 'draft' | 'approved';
  quality: QualityScore;
  conflicts: TimetableConflict[];
  unplaced: UnplacedSession[];
  recommendations: import('@/lib/timetable').TimetableRecommendation[];
  generatedAt: string;
}

export interface Term {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  current: boolean;
}

export interface SchoolData {
  profile: SchoolProfile | null;
  timing: SchoolTiming | null;
  classes: ClassGroup[];
  subjects: Subject[];
  teachers: Teacher[];
  students: Student[];
  timetable: Timetable | null;
  assessments: Assessment[];
  marks: MarkRecord[];
  terms: Term[];
  onboardingComplete: boolean;
}
