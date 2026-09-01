import { FileText, Download, TrendingUp, TrendingDown, Users, GraduationCap, BookOpen, Layers } from 'lucide-react';
import { useSchoolData } from '@/store';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { exportAcademicReportPDF } from '@/lib/pdf';
import {
  studentOverallAverage,
  topPerformingClasses,
  studentsNeedingAttention,
  classSubjectAverage,
  subjectTrend,
} from '@/lib/assessment';

export function ReportsPage() {
  const data = useSchoolData();

  if (data.students.length === 0 || data.assessments.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy-900">Reports</h1>
          <p className="text-sm text-slate-500">Academic performance summaries</p>
        </div>
        <EmptyState
          icon={<FileText size={28} />}
          title="No report data yet"
          description="Reports become available once you have students and assessments with recorded marks."
        />
      </div>
    );
  }

  const topClasses = topPerformingClasses(data.classes, data.subjects, data.students, data.assessments, data.marks);
  const needsAttention = studentsNeedingAttention(data.subjects, data.students, data.classes, data.assessments, data.marks, 50);
  const overallAvg = data.students.length > 0
    ? data.students.reduce((sum, s) => {
        const cls = data.classes.find((c) => c.id === s.classId);
        const studentSubjects = cls
          ? data.subjects.filter((subj) => subj.level === cls.level)
          : data.subjects;
        return sum + studentOverallAverage(s.id, studentSubjects, data.assessments, data.marks);
      }, 0) / data.students.length
    : 0;

  const aboveThreshold = data.students.filter((s) => {
    const cls = data.classes.find((c) => c.id === s.classId);
    const studentSubjects = cls
      ? data.subjects.filter((subj) => subj.level === cls.level)
      : data.subjects;
    return studentOverallAverage(s.id, studentSubjects, data.assessments, data.marks) >= 50;
  }).length;
  const passRate = data.students.length > 0 ? (aboveThreshold / data.students.length) * 100 : 0;

  const exportReport = () => {
    exportAcademicReportPDF(
      data.profile, data.classes, data.subjects, data.teachers,
      data.students, data.assessments, data.marks,
    );
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Reports</h1>
          <p className="text-sm text-slate-500">Academic performance summaries</p>
        </div>
        <button onClick={exportReport} className="btn-secondary">
          <Download size={16} />
          Export report
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard icon={Users} label="Students" value={String(data.students.length)} />
        <SummaryCard icon={GraduationCap} label="Pass rate" value={`${passRate.toFixed(0)}%`} />
        <SummaryCard icon={Layers} label="Classes" value={String(data.classes.length)} />
        <SummaryCard icon={BookOpen} label="Overall avg" value={`${overallAvg.toFixed(1)}%`} />
      </div>

      {/* Top classes */}
      <div className="mb-6 card p-5">
        <h2 className="mb-4 text-base font-semibold text-navy-900">Top-performing classes</h2>
        {topClasses.length === 0 ? (
          <p className="text-sm text-slate-400">No data available.</p>
        ) : (
          <div className="space-y-2">
            {topClasses.map((c, i) => (
              <div key={c.classId} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-50 text-xs font-bold text-navy-700">{i + 1}</span>
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-navy-900">{c.name}</span>
                    <span className="text-sm font-semibold text-navy-700">{c.average.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-navy-600" style={{ width: `${c.average}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subject trends */}
      <div className="mb-6 card p-5">
        <h2 className="mb-4 text-base font-semibold text-navy-900">Subject trends</h2>
        <div className="space-y-2">
          {data.subjects.map((s) => {
            const trend = subjectTrend(s.id, data.assessments, data.marks, data.students);
            const Icon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : null;
            const color = trend.direction === 'up' ? 'text-accent-600' : trend.direction === 'down' ? 'text-error-600' : 'text-slate-400';
            return (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                <span className="text-sm font-medium text-navy-900">{s.name}</span>
                {Icon ? (
                  <span className={`flex items-center gap-1.5 text-sm ${color}`}>
                    <Icon size={16} />
                    {trend.change > 0 ? '+' : ''}{trend.change.toFixed(1)}%
                  </span>
                ) : (
                  <Badge>Stable</Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Students needing attention */}
      <div className="card p-5">
        <h2 className="mb-4 text-base font-semibold text-navy-900">Students needing attention</h2>
        {needsAttention.length === 0 ? (
          <p className="text-sm text-slate-400">All students are performing above the threshold.</p>
        ) : (
          <div className="space-y-2">
            {needsAttention.map((r) => (
              <div key={r.student.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-navy-900">{r.student.firstName} {r.student.lastName}</p>
                  <p className="text-xs text-slate-400">{r.className}</p>
                </div>
                <span className="text-sm font-semibold text-error-600">{r.average.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-navy-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
