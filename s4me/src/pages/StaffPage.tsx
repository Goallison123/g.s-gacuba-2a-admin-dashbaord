import { useState, useMemo } from 'react';
import { Users, Plus, Pencil, Trash2, BookOpen, ArrowRight, ArrowLeft, Check, Clock } from 'lucide-react';
import { useSchoolData, setData, uid } from '@/store';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { calculateTeacherWorkload, subjectsForClass, DAY_NAMES } from '@/lib/timetable';
import type { Teacher } from '@/types';

export function StaffPage() {
  const data = useSchoolData();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);

  const teacherName = (t: Teacher) => `${t.firstName} ${t.lastName}`;
  const subjectName = (id: string) => data.subjects.find((s) => s.id === id)?.name || '—';
  const className = (id: string) => data.classes.find((c) => c.id === id)?.name || '—';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Staff</h1>
          <p className="text-sm text-slate-500">{data.teachers.length} teaching staff</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} />
          Add teacher
        </button>
      </div>

      {data.teachers.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title="No teaching staff yet"
          description="Add your teachers one at a time. You'll specify their subjects and classes as you go."
          action={<button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={16} /> Add your first teacher</button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Subjects</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">Classes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Load</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.teachers.map((t) => (
                <tr key={t.id} className="group hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-700">
                        {t.firstName?.[0] || '?'}{t.lastName?.[0] || ''}
                      </div>
                      <span className="text-sm font-medium text-navy-900">{teacherName(t)}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {t.subjectIds.slice(0, 3).map((id) => (
                        <Badge key={id} variant="info">{subjectName(id)}</Badge>
                      ))}
                      {t.subjectIds.length > 3 && <Badge>+{t.subjectIds.length - 3}</Badge>}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="text-sm text-slate-600">{t.classIds.length} classes</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">{t.maxPeriodsPerWeek}/week</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => setEditing(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-700">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => setDeleteTarget(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-error-50 hover:text-error-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.timetable && data.teachers.length > 0 && (
        <TeacherWorkloadPanel />
      )}

      {(showAdd || editing) && (
        <TeacherModal teacher={editing} onClose={() => { setShowAdd(false); setEditing(null); }} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            setData((draft) => {
              draft.teachers = draft.teachers.filter((t) => t.id !== deleteTarget.id);
              if (draft.timetable) {
                draft.timetable.slots = draft.timetable.slots.filter((s) => s.teacherId !== deleteTarget.id);
              }
            });
          }
        }}
        title="Delete teacher?"
        message={`Are you sure you want to remove ${deleteTarget ? teacherName(deleteTarget) : ''} from your staff?`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function TeacherModal({ teacher, onClose }: { teacher: Teacher | null; onClose: () => void }) {
  const data = useSchoolData();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(teacher?.firstName || '');
  const [lastName, setLastName] = useState(teacher?.lastName || '');
  const [subjectIds, setSubjectIds] = useState<string[]>(teacher?.subjectIds || []);
  const [classIds, setClassIds] = useState<string[]>(teacher?.classIds || []);
  const [maxPeriods, setMaxPeriods] = useState(teacher?.maxPeriodsPerWeek || 30);

  const steps = ['Name', 'Subjects', 'Classes', 'Workload'];

  const canNext = () => {
    if (step === 0) return firstName.trim() && lastName.trim();
    if (step === 1) return subjectIds.length > 0;
    if (step === 2) return classIds.length > 0;
    return true;
  };

  const save = () => {
    const payload = { firstName, lastName, subjectIds, classIds, maxPeriodsPerWeek: maxPeriods, unavailable: teacher?.unavailable || [] };
    if (teacher) {
      setData((draft) => {
        const idx = draft.teachers.findIndex((t) => t.id === teacher.id);
        if (idx >= 0) draft.teachers[idx] = { ...teacher, ...payload };
      });
    } else {
      setData((draft) => {
        draft.teachers.push({ id: uid('tch'), ...payload });
      });
    }
    onClose();
  };

  const toggle = (id: string, list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={teacher ? 'Edit teacher' : 'Add teacher'}
      maxWidth="max-w-lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          {step > 0 && (
            <button className="btn-ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button className="btn-primary" onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button className="btn-primary" onClick={save}>
              <Check size={16} /> Save teacher
            </button>
          )}
        </>
      }
    >
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
              i <= step ? 'bg-navy-700 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 ${i < step ? 'bg-navy-700' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">First name</label>
            <input className="input-field" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Jean" autoFocus />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Last name</label>
            <input className="input-field" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Habimana" />
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="mb-3 text-sm font-medium text-slate-600">What subjects does this teacher teach?</p>
          <div className="max-h-64 space-y-2 overflow-y-auto scrollbar-thin">
            {data.subjects.map((s) => {
              const selected = subjectIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id, subjectIds, setSubjectIds)}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left transition-colors ${
                    selected ? 'border-navy-600 bg-navy-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                      selected ? 'border-navy-600 bg-navy-600' : 'border-slate-300'
                    }`}>
                      {selected && <Check size={12} className="text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-navy-900">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.level} · {s.code}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="mb-3 text-sm font-medium text-slate-600">Which classes does this teacher teach?</p>
          <div className="max-h-64 space-y-2 overflow-y-auto scrollbar-thin">
            {data.classes.map((c) => {
              const selected = classIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id, classIds, setClassIds)}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left transition-colors ${
                    selected ? 'border-navy-600 bg-navy-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                      selected ? 'border-navy-600 bg-navy-600' : 'border-slate-300'
                    }`}>
                      {selected && <Check size={12} className="text-white" />}
                    </div>
                    <span className="text-sm font-medium text-navy-900">{c.name}</span>
                  </div>
                  <span className="text-xs text-slate-400">{c.level}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="mb-3 text-sm font-medium text-slate-600">Maximum periods per week for this teacher?</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              className="input-field"
              value={maxPeriods}
              onChange={(e) => setMaxPeriods(parseInt(e.target.value) || 0)}
            />
            <span className="text-sm text-slate-500">periods/week</span>
          </div>
          <div className="mt-4 flex gap-2">
            {[20, 25, 30, 35, 40].map((p) => (
              <button
                key={p}
                onClick={() => setMaxPeriods(p)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  maxPeriods === p ? 'border-navy-600 bg-navy-50 text-navy-900' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function TeacherWorkloadPanel() {
  const data = useSchoolData();
  const [expanded, setExpanded] = useState<string | null>(null);

  const workloads = useMemo(() => {
    if (!data.timetable || !data.timing) return [];
    return data.teachers.map((t) => ({
      teacher: t,
      ...calculateTeacherWorkload(t, data.classes, data.subjects, data.timing!, data.timetable!.slots),
    }));
  }, [data.teachers, data.classes, data.subjects, data.timing, data.timetable]);

  if (workloads.length === 0) return null;

  return (
    <div className="mt-6 card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Clock size={18} className="text-navy-700" />
        <h2 className="text-base font-semibold text-navy-900">Teacher Workload</h2>
        <span className="text-xs text-slate-400">Calculated from timetable assignments</span>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Teacher</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Required</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Scheduled</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Free</th>
              <th className="hidden px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">Weekly</th>
              <th className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Daily load</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workloads.map((w) => {
              const overCapacity = w.scheduledSessions > w.requiredSessions;
              const underCapacity = w.scheduledSessions < w.requiredSessions;
              return (
                <>
                  <tr
                    key={w.teacher.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpanded(expanded === w.teacher.id ? null : w.teacher.id)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-700">
                          {w.teacher.firstName?.[0] || '?'}{w.teacher.lastName?.[0] || ''}
                        </div>
                        <span className="text-sm font-medium text-navy-900">{w.teacher.firstName} {w.teacher.lastName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm font-medium text-navy-800">{w.requiredSessions}</td>
                    <td className={`px-3 py-2.5 text-center text-sm font-semibold ${overCapacity ? 'text-error-600' : underCapacity ? 'text-warning-600' : 'text-accent-600'}`}>
                      {w.scheduledSessions}
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm text-slate-600">{w.freePeriods}</td>
                    <td className="hidden px-3 py-2.5 text-center text-sm text-slate-600 sm:table-cell">{w.weeklyLoad}/{w.totalSlots}</td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      <div className="flex gap-0.5">
                        {w.dailyLoad.map((load, day) => (
                          <div
                            key={day}
                            className={`flex h-6 w-7 items-center justify-center rounded text-[10px] font-medium ${
                              load === 0 ? 'bg-slate-100 text-slate-300' : load >= 6 ? 'bg-warning-100 text-warning-700' : 'bg-navy-50 text-navy-700'
                            }`}
                            title={`${DAY_NAMES[day]}: ${load} periods`}
                          >
                            {load}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {expanded === w.teacher.id && (
                    <tr key={`${w.teacher.id}-detail`} className="bg-slate-50/50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between"><span className="text-slate-500">Required teaching sessions:</span><span className="font-medium text-navy-800">{w.requiredSessions}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Scheduled teaching sessions:</span><span className="font-medium text-navy-800">{w.scheduledSessions}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Free periods:</span><span className="font-medium text-navy-800">{w.freePeriods}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Weekly workload:</span><span className="font-medium text-navy-800">{w.weeklyLoad} of {w.totalSlots} periods</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Max periods/week setting:</span><span className="font-medium text-navy-800">{w.teacher.maxPeriodsPerWeek}</span></div>
                          <div className="mt-2 flex gap-3">
                            {w.dailyLoad.map((load, day) => (
                              <div key={day} className="text-slate-500">
                                {DAY_NAMES[day]}: <span className="font-medium text-navy-700">{load}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
