import { useState, useRef } from 'react';
import { GraduationCap, Plus, Upload, Trash2, Search, FileSpreadsheet, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useSchoolData, setData, uid } from '@/store';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { Alert } from '@/components/Alert';
import { parseCSV, validateStudents, type ImportResult } from '@/lib/import';
import type { Student } from '@/types';

export function StudentsPage() {
  const data = useSchoolData();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');

  const className = (id: string) => data.classes.find((c) => c.id === id)?.name || '—';

  const filtered = data.students.filter((s) => {
    const matchSearch = !search ||
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      s.studentNumber.toLowerCase().includes(search.toLowerCase());
    const matchClass = !filterClass || s.classId === filterClass;
    return matchSearch && matchClass;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Students</h1>
          <p className="text-sm text-slate-500">{data.students.length} students enrolled</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary">
            <Upload size={16} />
            Import
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={16} />
            Add student
          </button>
        </div>
      </div>

      {data.students.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={28} />}
          title="No students yet"
          description="Import students from a CSV file, or add them one at a time. The import will validate your data automatically."
          action={
            <div className="flex gap-3">
              <button onClick={() => setShowImport(true)} className="btn-secondary">
                <Upload size={16} /> Import from CSV
              </button>
              <button onClick={() => setShowAdd(true)} className="btn-primary">
                <Plus size={16} /> Add student
              </button>
            </div>
          }
        />
      ) : (
        <>
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-10"
                placeholder="Search by name or student ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="input-field sm:w-48" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
              <option value="">All classes</option>
              {data.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Student ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">Class</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Gender</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s) => (
                    <tr key={s.id} className="group hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-navy-700">{s.studentNumber}</td>
                      <td className="px-4 py-3 text-sm font-medium text-navy-900">{s.firstName} {s.lastName}</td>
                      <td className="hidden px-4 py-3 sm:table-cell"><Badge>{className(s.classId)}</Badge></td>
                      <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell">{s.gender || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-error-50 hover:text-error-600 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-400">No students match your search.</div>
            )}
          </div>
        </>
      )}

      {showAdd && <StudentModal onClose={() => setShowAdd(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            setData((draft) => {
              draft.students = draft.students.filter((s) => s.id !== deleteTarget.id);
              draft.marks = draft.marks.filter((m) => m.studentId !== deleteTarget.id);
            });
          }
        }}
        title="Remove student?"
        message={`Remove ${deleteTarget?.firstName} ${deleteTarget?.lastName} from your school? Their assessment marks will also be deleted.`}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}

function StudentModal({ onClose }: { onClose: () => void }) {
  const data = useSchoolData();
  const [studentNumber, setStudentNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [classId, setClassId] = useState(data.classes[0]?.id || '');
  const [gender, setGender] = useState<'M' | 'F' | ''>('');

  const save = () => {
    if (!studentNumber.trim() || !firstName.trim() || !lastName.trim() || !classId) return;
    setData((draft) => {
      draft.students.push({
        id: uid('stu'),
        studentNumber,
        firstName,
        lastName,
        classId,
        gender: gender || undefined,
      });
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add student"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={!studentNumber || !firstName || !lastName}>Save</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Student ID</label>
          <input className="input-field" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} placeholder="e.g. STU001" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">First name</label>
            <input className="input-field" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Last name</label>
            <input className="input-field" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Class</label>
          <select className="input-field" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {data.classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Gender (optional)</label>
          <select className="input-field" value={gender} onChange={(e) => setGender(e.target.value as 'M' | 'F' | '')}>
            <option value="">Not specified</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const data = useSchoolData();
  const [step, setStep] = useState<'instructions' | 'preview' | 'results'>('instructions');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const classIdMap: Record<string, string> = {};
  data.classes.forEach((c) => { classIdMap[c.name] = c.id; });

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const rows = parseCSV(text);
      const res = validateStudents(rows, data.students, classIdMap);
      setResult(res);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (result) {
      setData((draft) => {
        draft.students.push(...result.students);
      });
      setStep('results');
    }
  };

  const downloadTemplate = () => {
    const csv = 'first_name,last_name,class,gender\nJohn,Doe,S1 A,M\nJane,Smith,S1 A,F\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 's4me-student-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Import students"
      maxWidth="max-w-xl"
      footer={
        step === 'instructions' ? (
          <>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Select CSV file
            </button>
          </>
        ) : step === 'preview' ? (
          <>
            <button className="btn-ghost" onClick={() => setStep('instructions')}>
              <X size={16} /> Cancel
            </button>
            <button className="btn-primary" onClick={confirmImport} disabled={result?.valid === 0}>
              <CheckCircle size={16} /> Import {result?.valid || 0} students
            </button>
          </>
        ) : (
          <button className="btn-primary" onClick={onClose}>Done</button>
        )
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {step === 'instructions' && (
        <div className="space-y-4">
          <Alert variant="info" title="Required fields">
            Your CSV file must include <strong>first_name</strong>, <strong>last_name</strong> (or a single <strong>name</strong> column), and <strong>class</strong>. The <strong>student_id</strong> and <strong>gender</strong> columns are optional — IDs are auto-generated if missing.
          </Alert>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-sm font-medium text-navy-900">Example format:</p>
            <pre className="text-xs text-slate-600">first_name,last_name,class,gender{'\n'}John,Doe,S1 A,M{'\n'}Jane,Smith,S1 A,F</pre>
          </div>
          <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm font-medium text-navy-600 hover:text-navy-900">
            <FileSpreadsheet size={16} />
            Download template
          </button>
          <p className="text-xs text-slate-400">Supported formats: CSV. Class names must match your existing classes.</p>
        </div>
      )}

      {step === 'preview' && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Total found" value={result.total} />
            <StatTile label="Valid" value={result.valid} variant="success" />
            <StatTile label="Duplicates" value={result.duplicates} variant={result.duplicates > 0 ? 'warning' : 'default'} />
            <StatTile label="Missing IDs" value={result.missingIds} variant={result.missingIds > 0 ? 'error' : 'default'} />
          </div>

          {result.errors.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-navy-900">Issues found ({result.errors.length}):</p>
              <div className="max-h-40 space-y-1.5 overflow-y-auto scrollbar-thin">
                {result.errors.slice(0, 20).map((err, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md bg-warning-50 px-3 py-1.5 text-xs">
                    <AlertTriangle size={14} className="shrink-0 text-warning-600" />
                    <span className="text-slate-600">Row {err.row}: {err.reason}</span>
                    {err.data && <span className="text-slate-400">— {err.data}</span>}
                  </div>
                ))}
                {result.errors.length > 20 && (
                  <p className="px-3 text-xs text-slate-400">...and {result.errors.length - 20} more</p>
                )}
              </div>
            </div>
          )}

          {result.valid > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-navy-900">Preview of students to import:</p>
              <div className="max-h-40 overflow-y-auto scrollbar-thin rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">ID</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Class</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.students.slice(0, 10).map((s) => (
                      <tr key={s.id}>
                        <td className="px-3 py-2 text-xs text-navy-700">{s.studentNumber}</td>
                        <td className="px-3 py-2 text-xs text-navy-900">{s.firstName} {s.lastName}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{data.classes.find((c) => c.id === s.classId)?.name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.students.length > 10 && (
                  <p className="px-3 py-2 text-xs text-slate-400">...and {result.students.length - 10} more</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'results' && (
        <div className="flex flex-col items-center py-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-50 text-accent-600">
            <CheckCircle size={28} />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-navy-900">Import complete</h3>
          <p className="text-sm text-slate-500">{result?.valid} students have been added to your school.</p>
        </div>
      )}
    </Modal>
  );
}

function StatTile({ label, value, variant = 'default' }: { label: string; value: number; variant?: 'default' | 'success' | 'warning' | 'error' }) {
  const colors = {
    default: 'bg-slate-50 text-navy-900',
    success: 'bg-accent-50 text-accent-700',
    warning: 'bg-warning-50 text-warning-700',
    error: 'bg-error-50 text-error-700',
  };
  return (
    <div className={`rounded-lg p-3 text-center ${colors[variant]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}
