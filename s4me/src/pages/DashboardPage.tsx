import { Users, GraduationCap, Layers, BookOpen, Clock, ClipboardCheck, AlertTriangle, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useSchoolData } from '@/store';
import { topPerformingClasses, studentsNeedingAttention, studentOverallAverage } from '@/lib/assessment';
import { Badge } from '@/components/Badge';
import type { PageId } from '@/components/DashboardLayout';

export function DashboardPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const data = useSchoolData();
  const profile = data.profile;
  const currentTerm = data.terms.find((t) => t.current);

  if (!profile) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
        </div>
        <EmptyInline message="School profile not found. Please complete onboarding." />
      </div>
    );
  }

  const topClasses = topPerformingClasses(data.classes, data.subjects, data.students, data.assessments, data.marks).slice(0, 5);
  const needsAttention = studentsNeedingAttention(data.subjects, data.students, data.classes, data.assessments, data.marks, 50).slice(0, 5);

  const totalAssessments = data.assessments.length;
  const completedMarks = data.marks.filter((m) => m.marks !== null).length;
  const totalMarkSlots = data.students.length * data.assessments.length;
  const missingMarks = Math.max(0, totalMarkSlots - completedMarks);

  const overallAvg = data.students.length > 0
    ? data.students.reduce((sum, s) => {
        const cls = data.classes.find((c) => c.id === s.classId);
        const studentSubjects = cls
          ? data.subjects.filter((subj) => subj.level === cls.level)
          : data.subjects;
        return sum + studentOverallAverage(s.id, studentSubjects, data.assessments, data.marks);
      }, 0) / data.students.length
    : 0;

  const ttStatus = data.timetable?.status === 'approved' ? 'Approved' : data.timetable ? 'Draft' : 'Not generated';
  const ttConflicts = data.timetable?.conflicts?.length || 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">{profile.name}</h1>
        <p className="text-sm text-slate-500">
          {profile.district}, {profile.country} · {currentTerm?.name || 'No active term'}
        </p>
      </div>

      {/* Overview cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={GraduationCap} label="Students" value={data.students.length || profile.studentCount} />
        <StatCard icon={Users} label="Teachers" value={data.teachers.length || profile.teachingStaffCount} />
        <StatCard icon={Layers} label="Classes" value={data.classes.length} />
        <StatCard icon={BookOpen} label="Subjects" value={data.subjects.length} />
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Timetable status */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy-900">Timetable status</h2>
            <button onClick={() => onNavigate('timetable')} className="text-sm font-medium text-navy-600 hover:text-navy-900">
              View
            </button>
          </div>
          <div className="space-y-3">
            <StatusRow label="Status" value={<Badge variant={ttStatus === 'Approved' ? 'success' : ttStatus === 'Draft' ? 'warning' : 'default'}>{ttStatus}</Badge>} />
            <StatusRow label="Conflicts" value={<span className={ttConflicts > 0 ? 'text-error-600 font-medium' : 'text-navy-900'}>{ttConflicts}</span>} />
            <StatusRow label="Slots generated" value={data.timetable?.slots.length || 0} />
          </div>
          {!data.timetable && (
            <div className="mt-4">
              <button onClick={() => onNavigate('timetable')} className="btn-secondary w-full">
                <Clock size={16} />
                Set up timetable
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Assessment status */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy-900">Assessment status</h2>
            <button onClick={() => onNavigate('assessments')} className="text-sm font-medium text-navy-600 hover:text-navy-900">
              View
            </button>
          </div>
          <div className="space-y-3">
            <StatusRow label="Assessments" value={totalAssessments} />
            <StatusRow label="Marks recorded" value={completedMarks} />
            <StatusRow label="Missing marks" value={<span className={missingMarks > 0 ? 'text-warning-600 font-medium' : 'text-navy-900'}>{missingMarks}</span>} />
          </div>
        </div>
      </div>

      {/* Academic overview */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top performing classes */}
        <div className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-navy-900">Top-performing classes</h2>
          {topClasses.length === 0 ? (
            <EmptyInline message="No assessment data yet" />
          ) : (
            <div className="space-y-2">
              {topClasses.map((c, i) => (
                <div key={c.classId} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-50 text-xs font-bold text-navy-700">{i + 1}</span>
                    <span className="text-sm font-medium text-navy-900">{c.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-navy-700">{c.average.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Students needing attention */}
        <div className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-navy-900">Students needing attention</h2>
          {needsAttention.length === 0 ? (
            <EmptyInline message="No students below threshold" />
          ) : (
            <div className="space-y-2">
              {needsAttention.map((r) => (
                <div key={r.student.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-navy-900">{r.student.firstName} {r.student.lastName}</p>
                    <p className="text-xs text-slate-400">{r.className}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingDown size={14} className="text-error-500" />
                    <span className="text-sm font-semibold text-error-600">{r.average.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overall average banner */}
      {overallAvg > 0 && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-navy-100 bg-navy-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-100 text-navy-700">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-navy-900">Overall school average</p>
              <p className="text-xs text-slate-500">Across all subjects and assessments</p>
            </div>
          </div>
          <span className="text-2xl font-bold text-navy-800">{overallAvg.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
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

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-navy-900">{value}</span>
    </div>
  );
}

function EmptyInline({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-400">
      <AlertTriangle size={16} />
      {message}
    </div>
  );
}
