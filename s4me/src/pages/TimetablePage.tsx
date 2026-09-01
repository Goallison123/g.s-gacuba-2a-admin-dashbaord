import { useState, useMemo } from 'react';
import {
  Clock, RefreshCw, Check, AlertTriangle, Pencil, Plus, Trash2,
  TrendingUp, Users, GraduationCap, Layers, ChevronRight, Info, Download,
  Wand2, UserPlus, ArrowRightLeft, Gauge, CalendarPlus, Scale,
} from 'lucide-react';
import { exportTimetablePDF, exportAllTimetablesPDF } from '@/lib/pdf';
import { useSchoolData, setData, uid } from '@/store';
import {
  generateTimetable, buildDayStructure, DAY_NAMES,
  validateSlotPlacement, subjectsForClass,
} from '@/lib/timetable';
import type { TimetableRecommendation } from '@/lib/timetable';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { Alert } from '@/components/Alert';
import type { TimetableSlot, QualityScore, Teacher } from '@/types';

type ViewMode = 'class' | 'teacher';

const ACTION_ICONS: Record<string, typeof UserPlus> = {
  add_teacher: UserPlus,
  allow_teacher_subject: Wand2,
  move_subject_load: ArrowRightLeft,
  increase_capacity: Gauge,
  add_periods: CalendarPlus,
  balance_subject_periods: Scale,
};

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export function TimetablePage() {
  const data = useSchoolData();
  const [generating, setGenerating] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{ day: number; periodIndex: number; classId: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('class');
  const [viewClassId, setViewClassId] = useState(data.classes[0]?.id || '');
  const [viewTeacherId, setViewTeacherId] = useState(data.teachers[0]?.id || '');
  const [addTeacherFor, setAddTeacherFor] = useState<{ subjectId: string; subjectName?: string; amount?: number } | null>(null);
  const [addPeriodsFor, setAddPeriodsFor] = useState<{ affectedPeriods?: number } | null>(null);
  const [infoNote, setInfoNote] = useState<string | null>(null);

  // Keep view selections in sync when classes/teachers change
  if (viewMode === 'class' && viewClassId && !data.classes.find((c) => c.id === viewClassId) && data.classes.length > 0) {
    setViewClassId(data.classes[0].id);
  }
  if (viewMode === 'teacher' && viewTeacherId && !data.teachers.find((t) => t.id === viewTeacherId) && data.teachers.length > 0) {
    setViewTeacherId(data.teachers[0].id);
  }
  if (viewMode === 'class' && !viewClassId && data.classes.length > 0) setViewClassId(data.classes[0].id);
  if (viewMode === 'teacher' && !viewTeacherId && data.teachers.length > 0) setViewTeacherId(data.teachers[0].id);

  const dayStructure = useMemo(() => data.timing ? buildDayStructure(data.timing) : [], [data.timing]);
  const teachingDays = data.timing?.teachingDays || 5;
  const activeDayNames = DAY_NAMES.slice(0, teachingDays);

  const handleGenerate = () => {
    if (!data.timing || data.classes.length === 0 || data.teachers.length === 0) return;
    setGenerating(true);
    setTimeout(() => {
      const tt = generateTimetable(data.classes, data.subjects, data.teachers, data.timing!);
      setData((draft) => { draft.timetable = tt; });
      setGenerating(false);
    }, 600);
  };

  const handleApprove = () => {
    setData((draft) => {
      if (draft.timetable) draft.timetable.status = 'approved';
    });
  };

  const canGenerate = data.timing && data.classes.length > 0 && data.teachers.length > 0;

  const applyRecommendation = (rec: TimetableRecommendation) => {
    const action = rec.action;
    if (!action) return;

    switch (action.actionType) {
      case 'allow_teacher_subject': {
        if (!action.teacherId || !action.classId) {
          setInfoNote(`${rec.title}: open the Teachers page to assign this class manually.`);
          return;
        }
        setData((draft) => {
          const teacher = draft.teachers.find((t) => t.id === action.teacherId);
          if (teacher && !teacher.classIds.includes(action.classId!)) {
            teacher.classIds.push(action.classId!);
          }
        });
        handleGenerate();
        return;
      }

      case 'move_subject_load': {
        if (!action.fromTeacherId || !action.toTeacherId || !action.classId) {
          setInfoNote(`${rec.title}: open the Teachers page to reassign this class manually.`);
          return;
        }
        setData((draft) => {
          const from = draft.teachers.find((t) => t.id === action.fromTeacherId);
          const to = draft.teachers.find((t) => t.id === action.toTeacherId);
          if (from) {
            from.classIds = from.classIds.filter((cid) => cid !== action.classId);
          }
          if (to && !to.classIds.includes(action.classId!)) {
            to.classIds.push(action.classId!);
          }
        });
        handleGenerate();
        return;
      }

      case 'increase_capacity': {
        if (!action.teacherId) return;
        setData((draft) => {
          const teacher = draft.teachers.find((t) => t.id === action.teacherId);
          if (teacher) {
            teacher.maxPeriodsPerWeek = (teacher.maxPeriodsPerWeek || 30) + (action.amount || 1);
          }
        });
        handleGenerate();
        return;
      }

      case 'add_teacher': {
        setAddTeacherFor({
          subjectId: action.subjectId || '',
          subjectName: action.subjectName,
          amount: action.amount,
        });
        return;
      }

      case 'add_periods': {
        setAddPeriodsFor({ affectedPeriods: rec.affectedPeriods });
        return;
      }

      case 'balance_subject_periods': {
        setInfoNote(
          `${action.subjectName || 'This subject'} has inconsistent weekly periods across classes at ` +
          `the same level. Open Subjects and set the same "periods per week" value for each class.`,
        );
        return;
      }
    }
  };

  const submitNewTeacher = (firstName: string, lastName: string) => {
    if (!addTeacherFor || !firstName.trim() || !lastName.trim()) return;
    setData((draft) => {
      const newTeacher: Teacher = {
        id: uid('teacher'),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        subjectIds: [addTeacherFor.subjectId],
        classIds: [],
        maxPeriodsPerWeek: 30,
        unavailable: [],
      } as Teacher;
      draft.teachers.push(newTeacher);
    });
    setAddTeacherFor(null);
    handleGenerate();
  };

  const addTeachingDay = () => {
    setData((draft) => {
      if (!draft.timing) return;
      draft.timing.teachingDays = Math.min(6, (draft.timing.teachingDays || 5) + 1);
    });
    setAddPeriodsFor(null);
    handleGenerate();
  };

  const extendSchoolDay = () => {
    setData((draft) => {
      if (!draft.timing) return;
      draft.timing.endTime = addMinutesToTime(draft.timing.endTime, draft.timing.periodDuration);
    });
    setAddPeriodsFor(null);
    handleGenerate();
  };

  const viewSlots = useMemo(() => {
    if (!data.timetable) return new Map<string, TimetableSlot>();
    const map = new Map<string, TimetableSlot>();
    for (const s of data.timetable.slots) {
      const matches = viewMode === 'class' ? s.classId === viewClassId : s.teacherId === viewTeacherId;
      if (matches) {
        map.set(`${s.day}-${s.periodIndex}`, s);
      }
    }
    return map;
  }, [data.timetable, viewMode, viewClassId, viewTeacherId]);

  const subjectName = (id: string) => data.subjects.find((s) => s.id === id)?.name || '—';
  const teacherName = (id: string) => {
    const t = data.teachers.find((t) => t.id === id);
    return t ? `${t.lastName}, ${t.firstName?.[0] || '?'}.` : '—';
  };
  const className = (id: string) => data.classes.find((c) => c.id === id)?.name || '—';

  if (!data.timetable) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy-900">Timetable</h1>
          <p className="text-sm text-slate-500">Generate and manage your school timetable</p>
        </div>

        {canGenerate ? (
          <EmptyState
            icon={<Clock size={28} />}
            title="Your school timetable hasn't been created yet"
            description="S4Me will automatically generate a conflict-free timetable based on your teachers, subjects, classes, and school timing. The engine respects teacher availability, weekly subject requirements, and break constraints."
            action={
              <button onClick={handleGenerate} disabled={generating} className="btn-primary">
                {generating ? <><RefreshCw size={16} className="animate-spin" /> Generating...</> : <><Clock size={16} /> Generate timetable</>}
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            <Alert variant="warning" title="Before generating a timetable, you need:">
              <ul className="mt-2 space-y-1">
                {!data.timing && <li>School timing configuration</li>}
                {data.classes.length === 0 && <li>At least one class</li>}
                {data.teachers.length === 0 && <li>At least one teacher</li>}
              </ul>
            </Alert>
          </div>
        )}

      </div>
    );
  }

  const tt = data.timetable!;
  const q = tt.quality;
  const unplaced = tt.unplaced || [];
  const conflicts = tt.conflicts || [];
  const recommendations = tt.recommendations || [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Timetable</h1>
          <p className="text-sm text-slate-500">
            Generated {new Date(tt.generatedAt).toLocaleDateString()} · {tt.slots.length} slots
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (!data.timetable || !data.timing) return;
              if (viewMode === 'class') {
                exportTimetablePDF(data.timetable, data.classes, data.subjects, data.teachers, data.timing, data.profile, 'class', viewClassId);
              } else {
                exportTimetablePDF(data.timetable, data.classes, data.subjects, data.teachers, data.timing, data.profile, 'teacher', viewTeacherId);
              }
            }}
            className="btn-secondary"
          >
            <Download size={16} /> Export PDF
          </button>
          <button
            onClick={() => {
              if (!data.timetable || !data.timing) return;
              exportAllTimetablesPDF(data.timetable, data.classes, data.subjects, data.teachers, data.timing, data.profile);
            }}
            className="btn-secondary"
          >
            <Download size={16} /> Export all classes
          </button>
          <button onClick={handleGenerate} disabled={generating} className="btn-secondary">
            <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generating...' : 'Regenerate'}
          </button>
          {tt.status === 'draft' ? (
            <button onClick={handleApprove} className="btn-primary" disabled={unplaced.length > 0 || conflicts.length > 0}>
              <Check size={16} /> Approve timetable
            </button>
          ) : (
            <Badge variant="success"><Check size={12} /> Approved</Badge>
          )}
        </div>
      </div>

      <QualityPanel quality={q} />

      {infoNote && (
        <div className="mb-4">
          <Alert variant="warning" title="Manual step needed">
            <div className="flex items-start justify-between gap-3">
              <p>{infoNote}</p>
              <button onClick={() => setInfoNote(null)} className="shrink-0 text-xs font-medium text-navy-600 hover:text-navy-900">
                Dismiss
              </button>
            </div>
          </Alert>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="mb-4">
          <Alert variant="error" title={`${conflicts.length} scheduling conflict${conflicts.length > 1 ? 's' : ''} detected`}>
            <ul className="mt-2 space-y-1">
              {conflicts.slice(0, 5).map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <AlertTriangle size={14} />
                  {DAY_NAMES[c.day]} Period {c.periodIndex + 1}: {c.description}
                </li>
              ))}
            </ul>
          </Alert>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mb-4">
          <Alert variant="warning" title="Timetable could not be fully generated">
            <p className="mb-3">
              {unplaced.length > 0
                ? `${unplaced.reduce((sum, u) => sum + u.required, 0)} required period(s) could not be scheduled. Here's what would fix it:`
                : "Here are some improvements worth applying:"}
            </p>
            <div className="space-y-2">
              {recommendations.map((rec) => {
                const Icon = (rec.action && ACTION_ICONS[rec.action.actionType]) || AlertTriangle;
                return (
                  <div key={rec.id} className="flex items-start gap-3 rounded-lg bg-warning-50 px-3 py-2.5">
                    <Icon size={16} className="mt-0.5 shrink-0 text-warning-700" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy-900">{rec.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{rec.description}</p>
                    </div>
                    {rec.action && (
                      <button
                        onClick={() => applyRecommendation(rec)}
                        className="shrink-0 rounded-md bg-navy-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-navy-800"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={handleGenerate} className="mt-3 text-xs font-medium text-navy-600 hover:text-navy-900">
              Regenerate after applying changes
            </button>
          </Alert>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            onClick={() => setViewMode('class')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'class' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'}`}
          >
            <Layers size={14} /> Class view
          </button>
          <button
            onClick={() => setViewMode('teacher')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'teacher' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500'}`}
          >
            <Users size={14} /> Teacher view
          </button>
        </div>

        {viewMode === 'class' ? (
          <select className="input-field sm:w-56" value={viewClassId} onChange={(e) => setViewClassId(e.target.value)}>
            {data.classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <select className="input-field sm:w-56" value={viewTeacherId} onChange={(e) => setViewTeacherId(e.target.value)}>
            {data.teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.lastName}, {t.firstName}</option>
            ))}
          </select>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="w-28 border-r border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Time</th>
                {activeDayNames.map((day) => (
                  <th key={day} className="border-r border-slate-100 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 last:border-r-0">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayStructure.map((period) => {
                if (period.isBreak) {
                  return (
                    <tr key={`break-${period.startTime}`} className="bg-warning-50/40">
                      <td className="border-r border-slate-200 px-3 py-2 text-xs font-medium text-warning-700">
                        {period.startTime}
                        <div className="text-slate-400">{period.label}</div>
                      </td>
                      <td colSpan={activeDayNames.length} className="px-3 py-2 text-center text-xs text-warning-600">
                        {period.label} break
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={period.periodIndex} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                    <td className="border-r border-slate-200 px-3 py-2 text-xs">
                      <span className="font-medium text-navy-900">{period.startTime}</span>
                      <div className="text-slate-400">{period.label}</div>
                    </td>
                    {activeDayNames.map((_, dayIdx) => {
                      const slot = viewSlots.get(`${dayIdx}-${period.periodIndex}`);
                      return (
                        <td key={dayIdx} className="border-r border-slate-100 p-1 last:border-r-0">
                          {slot ? (
                            <button
                              onClick={() => viewMode === 'class' && setEditingSlot({ day: dayIdx, periodIndex: period.periodIndex, classId: viewClassId })}
                              className="group w-full rounded-md bg-navy-50 px-2 py-1.5 text-left transition-colors hover:bg-navy-100"
                            >
                              {viewMode === 'class' ? (
                                <>
                                  <p className="text-xs font-semibold text-navy-800">{subjectName(slot.subjectId)}</p>
                                  <p className="text-xs text-slate-500">{teacherName(slot.teacherId)}</p>
                                </>
                              ) : (
                                <>
                                  <p className="text-xs font-semibold text-navy-800">{subjectName(slot.subjectId)}</p>
                                  <p className="text-xs text-slate-500">{className(slot.classId)}</p>
                                </>
                              )}
                            </button>
                          ) : (
                            viewMode === 'class' && (
                              <button
                                onClick={() => setEditingSlot({ day: dayIdx, periodIndex: period.periodIndex, classId: viewClassId })}
                                className="flex h-full w-full items-center justify-center rounded-md px-2 py-1.5 text-slate-300 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-500 group-hover:opacity-100"
                              >
                                <Plus size={14} />
                              </button>
                            )
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingSlot && (
        <SlotEditor
          slot={tt.slots.find((s) => s.day === editingSlot.day && s.periodIndex === editingSlot.periodIndex && s.classId === editingSlot.classId) || null}
          day={editingSlot.day}
          periodIndex={editingSlot.periodIndex}
          classId={editingSlot.classId}
          onClose={() => setEditingSlot(null)}
        />
      )}

      {addTeacherFor && (
        <AddTeacherModal
          subjectName={addTeacherFor.subjectName || subjectName(addTeacherFor.subjectId)}
          amount={addTeacherFor.amount}
          onClose={() => setAddTeacherFor(null)}
          onSubmit={submitNewTeacher}
        />
      )}

      {addPeriodsFor && (
        <Modal
          open
          onClose={() => setAddPeriodsFor(null)}
          title="Add teaching periods"
          footer={<button className="btn-secondary" onClick={() => setAddPeriodsFor(null)}>Cancel</button>}
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              The school week doesn't have enough class-period slots to fit everything that's required
              {addPeriodsFor.affectedPeriods ? ` (short by about ${addPeriodsFor.affectedPeriods} periods).` : '.'}
              {' '}Choose one:
            </p>
            <button onClick={addTeachingDay} className="btn-secondary w-full justify-start" disabled={(data.timing?.teachingDays || 5) >= 6}>
              <CalendarPlus size={16} /> Add a teaching day
              {(data.timing?.teachingDays || 5) >= 6 && <span className="ml-auto text-xs text-slate-400">Already at 6 days</span>}
            </button>
            <button onClick={extendSchoolDay} className="btn-secondary w-full justify-start">
              <Clock size={16} /> Extend the school day by one period
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AddTeacherModal({
  subjectName,
  amount,
  onClose,
  onSubmit,
}: {
  subjectName: string;
  amount?: number;
  onClose: () => void;
  onSubmit: (firstName: string, lastName: string) => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add ${subjectName} teacher`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSubmit(firstName, lastName)} disabled={!firstName.trim() || !lastName.trim()}>
            <UserPlus size={16} /> Add teacher
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {amount && amount > 1 && (
          <p className="text-sm text-slate-600">
            The shortfall suggests about {amount} additional {subjectName} teachers are needed — this adds one; repeat as needed.
          </p>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">First name</label>
          <input className="input-field" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Last name</label>
          <input className="input-field" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <p className="text-xs text-slate-500">
          Added with a default weekly cap of 30 periods and qualified to teach {subjectName}. You can refine their class assignments afterwards on the Teachers page.
        </p>
      </div>
    </Modal>
  );
}

function QualityPanel({ quality }: { quality: QualityScore }) {
  const scoreColor = quality.overall >= 90 ? 'text-accent-600' : quality.overall >= 70 ? 'text-warning-600' : 'text-error-600';
  const scoreBg = quality.overall >= 90 ? 'bg-accent-50' : quality.overall >= 70 ? 'bg-warning-50' : 'bg-error-50';

  return (
    <div className="mb-6 card p-5">
      <div className="flex items-center gap-4">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl ${scoreBg}`}>
          <span className={`text-2xl font-bold ${scoreColor}`}>{quality.overall}%</span>
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-navy-900">Timetable Quality Score</h2>
          <p className="text-sm text-slate-500">
            {quality.overall >= 90
              ? 'This timetable meets all hard constraints and is ready for approval.'
              : quality.overall >= 70
              ? 'This timetable is mostly valid but has some issues to review.'
              : 'This timetable has significant issues that need attention.'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QualityMetric label="Required periods" value={`${quality.requiredPeriodsFulfilled}%`} good={quality.requiredPeriodsFulfilled === 100} />
        <QualityMetric label="Teacher conflicts" value={String(quality.teacherConflicts)} good={quality.teacherConflicts === 0} />
        <QualityMetric label="Class conflicts" value={String(quality.classConflicts)} good={quality.classConflicts === 0} />
        <QualityMetric label="Break conflicts" value={String(quality.breakConflicts)} good={quality.breakConflicts === 0} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QualityRating label="Student gaps" value={quality.studentGaps} />
        <QualityRating label="Teacher workload" value={quality.teacherWorkloadBalance} />
        <QualityRating label="Subject distribution" value={quality.subjectDistribution} />
      </div>
    </div>
  );
}

function QualityMetric({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="rounded-lg border border-slate-100 px-3 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-base font-semibold ${good ? 'text-accent-600' : 'text-error-600'}`}>{value}</p>
    </div>
  );
}

function QualityRating({ label, value }: { label: string; value: string }) {
  const color = value === 'Good' || value === 'Low' ? 'text-accent-600' : value === 'Fair' || value === 'Medium' ? 'text-warning-600' : 'text-error-600';
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${color}`}>{value}</span>
    </div>
  );
}

function SlotEditor({
  slot,
  day,
  periodIndex,
  classId,
  onClose,
}: {
  slot: TimetableSlot | null;
  day: number;
  periodIndex: number;
  classId: string;
  onClose: () => void;
}) {
  const data = useSchoolData();
  const [subjectId, setSubjectId] = useState(slot?.subjectId || '');
  const [teacherId, setTeacherId] = useState(slot?.teacherId || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const cls = data.classes.find((c) => c.id === classId);

  const save = () => {
    if (!subjectId || !teacherId) return;
    const newSlot: TimetableSlot = { day, periodIndex, classId, subjectId, teacherId };
    const otherSlots = data.timetable?.slots.filter(
      (s) => !(s.day === day && s.periodIndex === periodIndex && s.classId === classId),
    ) || [];
    const validation = validateSlotPlacement(newSlot, otherSlots, data.teachers, data.timing || undefined);
    if (!validation.valid) {
      setValidationError(validation.reason || 'This placement creates a conflict.');
      return;
    }
    setData((draft) => {
      if (!draft.timetable) return;
      const existing = draft.timetable.slots.findIndex(
        (s) => s.day === day && s.periodIndex === periodIndex && s.classId === classId,
      );
      if (existing >= 0) {
        draft.timetable.slots[existing] = newSlot;
      } else {
        draft.timetable.slots.push(newSlot);
      }
    });
    onClose();
  };

  const remove = () => {
    setData((draft) => {
      if (!draft.timetable) return;
      draft.timetable.slots = draft.timetable.slots.filter(
        (s) => !(s.day === day && s.periodIndex === periodIndex && s.classId === classId),
      );
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${DAY_NAMES[day]} — Period ${periodIndex + 1}`}
      footer={
        <>
          {slot && (
            <button onClick={remove} className="btn-ghost mr-auto !text-error-600 hover:!bg-error-50">
              <Trash2 size={16} /> Remove
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={!subjectId || !teacherId}>Save</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-500">Class: </span>
          <span className="font-medium text-navy-900">{cls?.name}</span>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Subject</label>
          <select className="input-field" value={subjectId} onChange={(e) => { setTeacherId(''); setSubjectId(e.target.value); setValidationError(null); }}>
            <option value="">Select subject...</option>
            {subjectsForClass(cls!, data.subjects).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Teacher</label>
          <select className="input-field" value={teacherId} onChange={(e) => { setTeacherId(e.target.value); setValidationError(null); }}>
            <option value="">Select teacher...</option>
            {data.teachers
              .filter((t) => !subjectId || t.subjectIds.includes(subjectId))
              .map((t) => (
                <option key={t.id} value={t.id}>{t.lastName}, {t.firstName}</option>
              ))}
          </select>
        </div>
        {validationError && (
          <Alert variant="error" title="Cannot move to this slot">
            {validationError}
          </Alert>
        )}
        <div className="flex items-start gap-2 rounded-lg bg-navy-50 px-3 py-2.5">
          <Info size={16} className="mt-0.5 shrink-0 text-navy-500" />
          <p className="text-xs text-slate-600">
            S4Me validates this placement against teacher conflicts, class conflicts, and teacher availability before saving.
          </p>
        </div>
      </div>
    </Modal>
  );
}