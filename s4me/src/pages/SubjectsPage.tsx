import { useState, useMemo } from 'react';
import { BookOpen, Plus, Trash2, Pencil, Copy } from 'lucide-react';
import { useSchoolData, setData, uid } from '@/store';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { subjectsForClass, classesForSubject } from '@/lib/timetable';
import type { Subject, Level } from '@/types';

export function SubjectsPage() {
  const data = useSchoolData();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [filterLevel, setFilterLevel] = useState<Level | 'all'>('all');

  const filteredSubjects = useMemo(
    () => filterLevel === 'all' ? data.subjects : data.subjects.filter((s) => s.level === filterLevel),
    [data.subjects, filterLevel],
  );

  const className = (id: string) => data.classes.find((c) => c.id === id)?.name || '—';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Subjects</h1>
          <p className="text-sm text-slate-500">{data.subjects.length} subjects configured</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} /> Add subject
        </button>
      </div>

      {/* Level filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilterLevel('all')}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${filterLevel === 'all' ? 'border-navy-600 bg-navy-50 text-navy-900' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
        >
          All levels
        </button>
        {data.profile?.levels.map((l) => (
          <button
            key={l}
            onClick={() => setFilterLevel(l)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${filterLevel === l ? 'border-navy-600 bg-navy-50 text-navy-900' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {filteredSubjects.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} />}
          title="No subjects yet"
          description="Add subjects with weekly period requirements for your classes."
          action={<button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={16} /> Add subject</button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">Code</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Level</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Periods/wk</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">Applies to</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubjects.map((s) => {
                const appliesTo = s.classIds.length === 0
                  ? `All ${s.level} classes`
                  : s.classIds.map(className).join(', ');
                return (
                  <tr key={s.id} className="group hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-navy-900">{s.name}</p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell"><Badge variant="info">{s.code}</Badge></td>
                    <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell">{s.level}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-navy-800">{s.periodsPerWeek}</td>
                    <td className="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">{appliesTo}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => setEditing(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-700">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => setDeleteTarget(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-error-50 hover:text-error-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(showAdd || editing) && (
        <SubjectModal subject={editing} onClose={() => { setShowAdd(false); setEditing(null); }} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            setData((draft) => {
              draft.subjects = draft.subjects.filter((s) => s.id !== deleteTarget.id);
              draft.teachers.forEach((t) => {
                t.subjectIds = t.subjectIds.filter((id) => id !== deleteTarget.id);
              });
            });
          }
        }}
        title="Delete subject?"
        message={`Delete "${deleteTarget?.name}"? This will also remove it from all teacher assignments.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function SubjectModal({ subject, onClose }: { subject: Subject | null; onClose: () => void }) {
  const data = useSchoolData();
  const [name, setName] = useState(subject?.name || '');
  const [code, setCode] = useState(subject?.code || '');
  const [level, setLevel] = useState<Level>(subject?.level || data.profile?.levels[0] || 'O Level');
  const [periodsPerWeek, setPeriodsPerWeek] = useState(subject?.periodsPerWeek || 4);
  const [scope, setScope] = useState<'all' | 'specific'>(subject?.classIds?.length ? 'specific' : 'all');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(subject?.classIds || []);

  const levelClasses = data.classes.filter((c) => c.level === level);

  const save = () => {
    if (!name.trim() || !code.trim()) return;
    const classIds = scope === 'all' ? [] : selectedClassIds;
    if (subject) {
      setData((draft) => {
        const idx = draft.subjects.findIndex((s) => s.id === subject.id);
        if (idx >= 0) draft.subjects[idx] = { ...subject, name, code, level, periodsPerWeek, classIds };
      });
    } else {
      const id = uid('subj');
      setData((draft) => {
        draft.subjects.push({ id, name, code, level, periodsPerWeek, maxConsecutive: 2, classIds });
      });
    }
    onClose();
  };

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId],
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={subject ? 'Edit subject' : 'Add subject'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={!name.trim() || !code.trim()}>Save</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Subject name</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mathematics" autoFocus />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Code</label>
            <input className="input-field" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. MATH" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Level</label>
            <select className="input-field" value={level} onChange={(e) => { setLevel(e.target.value as Level); setSelectedClassIds([]); }}>
              {data.profile?.levels.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Periods per week</label>
            <input type="number" className="input-field" value={periodsPerWeek} onChange={(e) => setPeriodsPerWeek(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Applies to</label>
          <div className="mb-2 flex gap-2">
            <button
              onClick={() => setScope('all')}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${scope === 'all' ? 'border-navy-600 bg-navy-50 text-navy-900' : 'border-slate-200 text-slate-600'}`}
            >
              All {level} classes
            </button>
            <button
              onClick={() => setScope('specific')}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${scope === 'specific' ? 'border-navy-600 bg-navy-50 text-navy-900' : 'border-slate-200 text-slate-600'}`}
            >
              Specific classes
            </button>
          </div>
          {scope === 'specific' && (
            <div className="max-h-40 space-y-1.5 overflow-y-auto scrollbar-thin rounded-lg border border-slate-200 p-2">
              {levelClasses.length === 0 ? (
                <p className="px-2 py-1 text-xs text-slate-400">No classes at this level.</p>
              ) : (
                levelClasses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleClass(c.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${selectedClassIds.includes(c.id) ? 'bg-navy-50 text-navy-900' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span className={`flex h-4 w-4 items-center justify-center rounded border-2 ${selectedClassIds.includes(c.id) ? 'border-navy-600 bg-navy-600' : 'border-slate-300'}`}>
                      {selectedClassIds.includes(c.id) && <span className="text-[10px] text-white">✓</span>}
                    </span>
                    {c.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
