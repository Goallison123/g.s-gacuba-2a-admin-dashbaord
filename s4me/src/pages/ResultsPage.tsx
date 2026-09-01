import { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, Search, Download } from 'lucide-react';
import { exportClassResultsPDF, exportStudentResultsPDF } from '@/lib/pdf';
import { useSchoolData } from '@/store';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import {
  studentSubjectAverage,
  studentOverallAverage,
  classRank,
  classSubjectAverage,
  subjectTrend,
  gradeFromAverage,
} from '@/lib/assessment';
import { subjectsForClass } from '@/lib/timetable';
import type { Student, Subject, Assessment, MarkRecord, ClassGroup } from '@/types';

export function ResultsPage() {
  const data = useSchoolData();
  const [viewClass, setViewClass] = useState(data.classes[0]?.id || '');

  // Keep viewClass in sync when classes change
  if (viewClass && !data.classes.find((c) => c.id === viewClass) && data.classes.length > 0) {
    setViewClass(data.classes[0].id);
  }
  if (!viewClass && data.classes.length > 0) setViewClass(data.classes[0].id);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  const classStudents = useMemo(
    () => data.students.filter((s) => s.classId === viewClass),
    [data.students, viewClass],
  );

  const classSubjects = useMemo(
    () => {
      const cls = data.classes.find((c) => c.id === viewClass);
      return cls ? subjectsForClass(cls, data.subjects) : [];
    },
    [data.subjects, data.classes, viewClass],
  );

  if (data.students.length === 0 || data.assessments.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy-900">Results</h1>
          <p className="text-sm text-slate-500">Student performance and grades</p>
        </div>
        <EmptyState
          icon={<BarChart3 size={28} />}
          title="No results to display yet"
          description="You need students and assessments with recorded marks to view results."
        />
      </div>
    );
  }

  const selectedStu = data.students.find((s) => s.id === selectedStudent);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Results</h1>
        <p className="text-sm text-slate-500">Student performance and grades</p>
      </div>

      {/* Class selector */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600">Class:</label>
        <select className="input-field sm:w-56" value={viewClass} onChange={(e) => { setViewClass(e.target.value); setSelectedStudent(null); }}>
          {data.classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          onClick={() => exportClassResultsPDF(viewClass, data.classes, classSubjects, data.students, data.assessments, data.marks, data.profile)}
          className="btn-secondary ml-auto"
        >
          <Download size={16} /> Export class PDF
        </button>
      </div>

      {/* Class subject performance */}
      <div className="mb-6 card p-5">
        <h2 className="mb-4 text-base font-semibold text-navy-900">Subject performance — {data.classes.find((c) => c.id === viewClass)?.name}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classSubjects.map((subj) => {
            const avg = classSubjectAverage(viewClass, subj.id, data.students, data.assessments, data.marks);
            const trend = subjectTrend(subj.id, data.assessments, data.marks, data.students);
            const TrendIcon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
            const trendColor = trend.direction === 'up' ? 'text-accent-600' : trend.direction === 'down' ? 'text-error-600' : 'text-slate-400';
            return (
              <div key={subj.id} className="rounded-lg border border-slate-100 p-3">
                <p className="mb-1 text-sm font-medium text-navy-900">{subj.name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-navy-800">{avg.toFixed(1)}%</span>
                  {trend.direction !== 'stable' && (
                    <span className={`flex items-center gap-1 text-xs ${trendColor}`}>
                      <TrendIcon size={14} />
                      {Math.abs(trend.change).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Student results table */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-navy-900">Student results</h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ID</th>
                {classSubjects.slice(0, 6).map((s) => (
                  <th key={s.id} className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">{s.code}</th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Avg</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Grade</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classStudents.map((s) => {
                const rank = classRank(s.id, viewClass, classSubjects, data.students, data.assessments, data.marks);
                const overall = studentOverallAverage(s.id, classSubjects, data.assessments, data.marks);
                const grade = gradeFromAverage(overall, 100);
                return (
                  <tr key={s.id} className="group hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-500">{rank.rank > 0 ? rank.rank : '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-navy-900">{s.firstName} {s.lastName}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{s.studentNumber}</td>
                    {classSubjects.slice(0, 6).map((subj) => {
                      const r = studentSubjectAverage(s.id, subj.id, data.assessments, data.marks);
                      return (
                        <td key={subj.id} className="hidden px-4 py-3 text-center text-sm text-slate-600 md:table-cell">
                          {r.maxTotal > 0 ? `${((r.total / r.maxTotal) * 100).toFixed(0)}` : '—'}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center text-sm font-semibold text-navy-800">{overall.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={grade === 'A' || grade === 'B' ? 'success' : grade === 'F' ? 'error' : grade === 'E' ? 'warning' : 'info'}>
                        {grade}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedStudent(s.id)}
                        className="text-sm font-medium text-navy-600 opacity-0 transition-opacity hover:text-navy-900 group-hover:opacity-100"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pattern insights */}
      <PatternInsights />

      {/* Student detail drawer */}
      {selectedStu && (
        <StudentDetail
          student={selectedStu}
          subjects={classSubjects}
          assessments={data.assessments}
          marks={data.marks}
          classes={data.classes}
          students={data.students}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}

function PatternInsights() {
  const data = useSchoolData();
  const insights: { text: string; type: 'up' | 'down' | 'info' }[] = [];

  for (const subj of data.subjects) {
    const trend = subjectTrend(subj.id, data.assessments, data.marks, data.students);
    if (trend.direction === 'down' && Math.abs(trend.change) > 5) {
      insights.push({ text: `${subj.name} performance decreased by ${Math.abs(trend.change).toFixed(1)}% compared with the previous assessment.`, type: 'down' });
    } else if (trend.direction === 'up' && trend.change > 5) {
      insights.push({ text: `${subj.name} performance has improved across the last assessments (+${trend.change.toFixed(1)}%).`, type: 'up' });
    }
  }

  if (insights.length === 0) return null;

  return (
    <div className="mt-6 card p-5">
      <h2 className="mb-3 text-base font-semibold text-navy-900">Performance patterns</h2>
      <div className="space-y-2">
        {insights.map((ins, i) => {
          const Icon = ins.type === 'up' ? TrendingUp : ins.type === 'down' ? TrendingDown : Minus;
          const color = ins.type === 'up' ? 'text-accent-600' : ins.type === 'down' ? 'text-error-600' : 'text-slate-400';
          return (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
              <Icon size={16} className={`mt-0.5 shrink-0 ${color}`} />
              <p className="text-sm text-slate-600">{ins.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StudentDetail({
  student,
  subjects,
  assessments,
  marks,
  classes,
  students,
  onClose,
}: {
  student: Student;
  subjects: Subject[];
  assessments: Assessment[];
  marks: MarkRecord[];
  classes: ClassGroup[];
  students: Student[];
  onClose: () => void;
}) {
  const data = useSchoolData();
  const cls = classes.find((c) => c.id === student.classId);
  const studentSubjects = useMemo(() => {
    const studentCls = classes.find((c) => c.id === student.classId);
    return studentCls ? subjectsForClass(studentCls, data.subjects) : [];
  }, [classes, data.subjects, student.classId]);
  const rank = classRank(student.id, student.classId, studentSubjects, students, assessments, marks);
  const overall = studentOverallAverage(student.id, studentSubjects, assessments, marks);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy-950/30" onClick={onClose} />
      <div className="relative z-10 h-full w-full max-w-md overflow-y-auto scrollbar-thin bg-white shadow-elevated">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">{student.firstName} {student.lastName}</h2>
            <p className="text-sm text-slate-500">{student.studentNumber} · {cls?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportStudentResultsPDF(student, classes, data.subjects, students, assessments, marks, data.profile)}
              className="btn-secondary"
            >
              <Download size={16} /> Export PDF
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">✕</button>
          </div>
        </div>
        <div className="p-5">
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-navy-50 p-3 text-center">
              <p className="text-2xl font-bold text-navy-800">{overall.toFixed(1)}%</p>
              <p className="text-xs text-slate-500">Overall</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-2xl font-bold text-navy-800">{gradeFromAverage(overall)}</p>
              <p className="text-xs text-slate-500">Grade</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-2xl font-bold text-navy-800">{rank.rank}/{rank.total}</p>
              <p className="text-xs text-slate-500">Rank</p>
            </div>
          </div>

          <h3 className="mb-3 text-sm font-semibold text-navy-900">Subject breakdown</h3>
          <div className="space-y-2">
            {studentSubjects.map((subj) => {
              const r = studentSubjectAverage(student.id, subj.id, assessments, marks);
              const pct = r.maxTotal > 0 ? (r.total / r.maxTotal) * 100 : 0;
              const classAvg = classSubjectAverage(student.classId, subj.id, students, assessments, marks);
              const above = pct > classAvg;
              return (
                <div key={subj.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-navy-900">{subj.name}</span>
                    <span className="text-sm font-semibold text-navy-700">{r.maxTotal > 0 ? `${pct.toFixed(1)}%` : 'No marks'}</span>
                  </div>
                  {r.maxTotal > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">Class avg: {classAvg.toFixed(1)}%</span>
                      {above ? (
                        <span className="flex items-center gap-0.5 text-accent-600"><TrendingUp size={12} /> Above average</span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-error-600"><TrendingDown size={12} /> Below average</span>
                      )}
                    </div>
                  )}
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${above ? 'bg-accent-500' : 'bg-warning-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
