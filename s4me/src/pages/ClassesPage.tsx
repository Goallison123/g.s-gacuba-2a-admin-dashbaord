import { useState } from 'react';
import { Layers, Plus, Pencil, Trash2, Users } from 'lucide-react';
import { useSchoolData, setData, uid } from '@/store';
import { Modal } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import type { ClassGroup, Level } from '@/types';

export function ClassesPage() {
  const data = useSchoolData();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ClassGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassGroup | null>(null);

  const classesByLevel = data.classes.reduce<Record<string, ClassGroup[]>>((acc, c) => {
    (acc[c.level] ||= []).push(c);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Classes</h1>
          <p className="text-sm text-slate-500">{data.classes.length} classes across {Object.keys(classesByLevel).length} levels</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} />
          Add class
        </button>
      </div>

      {data.classes.length === 0 ? (
        <EmptyState
          icon={<Layers size={28} />}
          title="No classes yet"
          description="Add classes to start organizing your students and generating timetables."
          action={<button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={16} /> Add your first class</button>}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(classesByLevel).map(([level, classes]) => (
            <div key={level}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{level}</h2>
                <Badge>{classes.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map((cls) => {
                  const studentCount = data.students.filter((s) => s.classId === cls.id).length;
                  return (
                    <div key={cls.id} className="card group p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-navy-900">{cls.name}</h3>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                            <Users size={14} />
                            {studentCount} / {cls.capacity} students
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => setEditing(cls)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-700"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(cls)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-error-50 hover:text-error-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAdd || editing) && (
        <ClassModal
          classGroup={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
        />
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete class?"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button
              className="btn-primary !bg-error-600 hover:!bg-error-700"
              onClick={() => {
                if (deleteTarget) {
                  setData((draft) => {
                    draft.classes = draft.classes.filter((c) => c.id !== deleteTarget.id);
                    draft.students = draft.students.filter((s) => s.classId !== deleteTarget.id);
                    draft.assessments = draft.assessments.filter((a) => a.classId !== deleteTarget.id);
                    draft.marks = draft.marks.filter((m) => {
                      const stu = draft.students.find((s) => s.id === m.studentId);
      return stu !== undefined;
                    });
                    if (draft.timetable) {
                      draft.timetable.slots = draft.timetable.slots.filter((s) => s.classId !== deleteTarget.id);
                    }
                    draft.teachers.forEach((t) => {
                      t.classIds = t.classIds.filter((id) => id !== deleteTarget.id);
                    });
                  });
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? Students in this class will also be removed.
        </p>
      </Modal>
    </div>
  );
}

function ClassModal({ classGroup, onClose }: { classGroup: ClassGroup | null; onClose: () => void }) {
  const data = useSchoolData();
  const [name, setName] = useState(classGroup?.name || '');
  const [level, setLevel] = useState<Level>(classGroup?.level || data.profile?.levels[0] || 'O Level');
  const [capacity, setCapacity] = useState(classGroup?.capacity || 40);

  const save = () => {
    if (!name.trim()) return;
    if (classGroup) {
      setData((draft) => {
        const idx = draft.classes.findIndex((c) => c.id === classGroup.id);
        if (idx >= 0) draft.classes[idx] = { ...classGroup, name, level, capacity };
      });
    } else {
      setData((draft) => {
        draft.classes.push({ id: uid('cls'), name, level, capacity });
      });
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={classGroup ? 'Edit class' : 'Add class'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={!name.trim()}>Save</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Class name</label>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. S1 A" autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Level</label>
          <select className="input-field" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            {data.profile?.levels.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Capacity</label>
          <input type="number" className="input-field" value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value) || 0)} />
        </div>
      </div>
    </Modal>
  );
}
