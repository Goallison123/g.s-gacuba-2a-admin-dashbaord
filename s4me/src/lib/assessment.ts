import type { Assessment, MarkRecord, Student, Subject, ClassGroup } from '@/types';

export function calculateAverage(marks: (number | null)[]): number {
  const valid = marks.filter((m): m is number => m !== null && !isNaN(m));
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function gradeFromAverage(avg: number, maxMarks: number = 100): string {
  const pct = (avg / maxMarks) * 100;
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  if (pct >= 50) return 'E';
  return 'F';
}

export function studentSubjectAverage(
  studentId: string,
  subjectId: string,
  assessments: Assessment[],
  marks: MarkRecord[],
): { average: number; total: number; maxTotal: number; grade: string } {
  const subjectAssessments = assessments.filter((a) => a.subjectId === subjectId);
  let total = 0;
  let maxTotal = 0;
  for (const a of subjectAssessments) {
    const mark = marks.find((m) => m.studentId === studentId && m.assessmentId === a.id);
    if (mark && mark.marks !== null) {
      total += mark.marks;
      maxTotal += a.maxMarks;
    }
  }
  const average = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  return {
    average,
    total,
    maxTotal,
    grade: gradeFromAverage(average, 100),
  };
}

export function classSubjectAverage(
  classId: string,
  subjectId: string,
  students: Student[],
  assessments: Assessment[],
  marks: MarkRecord[],
): number {
  const classStudents = students.filter((s) => s.classId === classId);
  if (classStudents.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const s of classStudents) {
    const { average } = studentSubjectAverage(s.id, subjectId, assessments, marks);
    if (average > 0) {
      sum += average;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

export function studentOverallAverage(
  studentId: string,
  subjects: Subject[],
  assessments: Assessment[],
  marks: MarkRecord[],
): number {
  let sum = 0;
  let count = 0;
  for (const subj of subjects) {
    const { average } = studentSubjectAverage(studentId, subj.id, assessments, marks);
    if (average > 0) {
      sum += average;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

export function classRank(
  studentId: string,
  classId: string,
  subjects: Subject[],
  students: Student[],
  assessments: Assessment[],
  marks: MarkRecord[],
): { rank: number; total: number } {
  const classStudents = students.filter((s) => s.classId === classId);
  const ranked = classStudents
    .map((s) => ({
      id: s.id,
      avg: studentOverallAverage(s.id, subjects, assessments, marks),
    }))
    .sort((a, b) => b.avg - a.avg);
  const idx = ranked.findIndex((r) => r.id === studentId);
  return { rank: idx + 1, total: ranked.length };
}

export function topPerformingClasses(
  classes: ClassGroup[],
  subjects: Subject[],
  students: Student[],
  assessments: Assessment[],
  marks: MarkRecord[],
): { classId: string; name: string; average: number }[] {
  return classes
    .map((c) => {
      const classStudents = students.filter((s) => s.classId === c.id);
      const classSubjects = subjects.filter((s) => s.level === c.level);
      let sum = 0;
      let count = 0;
      for (const s of classStudents) {
        const avg = studentOverallAverage(s.id, classSubjects, assessments, marks);
        if (avg > 0) {
          sum += avg;
          count++;
        }
      }
      return { classId: c.id, name: c.name, average: count > 0 ? sum / count : 0 };
    })
    .filter((c) => c.average > 0)
    .sort((a, b) => b.average - a.average);
}

export function studentsNeedingAttention(
  subjects: Subject[],
  students: Student[],
  classes: ClassGroup[],
  assessments: Assessment[],
  marks: MarkRecord[],
  threshold: number = 50,
): { student: Student; average: number; className: string }[] {
  return students
    .map((s) => {
      const cls = classes.find((c) => c.id === s.classId);
      const studentSubjects = cls
        ? subjects.filter((subj) => subj.level === cls.level)
        : subjects;
      const avg = studentOverallAverage(s.id, studentSubjects, assessments, marks);
      return { student: s, average: avg, className: cls?.name || '—' };
    })
    .filter((r) => r.average > 0 && r.average < threshold)
    .sort((a, b) => a.average - b.average);
}

export function subjectTrend(
  subjectId: string,
  assessments: Assessment[],
  marks: MarkRecord[],
  students: Student[],
): { direction: 'up' | 'down' | 'stable'; change: number } {
  const subjectAssessments = assessments
    .filter((a) => a.subjectId === subjectId)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (subjectAssessments.length < 2) return { direction: 'stable', change: 0 };

  const averages = subjectAssessments.map((a) => {
    const aMarks = marks
      .filter((m) => m.assessmentId === a.id && m.marks !== null)
      .map((m) => (m.marks! / a.maxMarks) * 100);
    return calculateAverage(aMarks);
  });

  const recent = averages.slice(-3);
  if (recent.length < 2) return { direction: 'stable', change: 0 };

  const first = recent[0];
  const last = recent[recent.length - 1];
  const change = last - first;
  if (Math.abs(change) < 2) return { direction: 'stable', change };
  return { direction: change > 0 ? 'up' : 'down', change };
}
