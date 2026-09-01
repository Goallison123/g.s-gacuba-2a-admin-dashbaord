import { useState } from 'react';
import { ClipboardCheck, Plus, Trash2, Pencil, Upload, FileSpreadsheet, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useSchoolData, setData, uid } from '@/store';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { Alert } from '@/components/Alert';
import { parseCSV, matchStudent } from '@/lib/import';
import { subjectsForClass } from '@/lib/timetable';
import type { Assessment, AssessmentType, Student } from '@/types';

const ASSESSMENT_TYPES: AssessmentType[] = ['Quiz', 'Test', 'CAT', 'Midterm', 'Examination', 'Reassessment', 'Other'];

export function AssessmentsPage() {
  const data = useSchoolData();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Assessment | null>(null);
  const [showImport, setShowImport] = useState(false);

  const className = (id: string) => data.classes.find((c) => c.id === id)?.name || '—';
  const subjectName = (id: string) => data.subjects.find((s) => s.id === id)?.name || '—';

  const marksFor = (assessmentId: string) => data.marks.filter((m) => m.assessmentId === assessmentId);
  const completedCount = (a: Assessment) => {
    const classStudents = data.students.filter((s) => s.classId === a.classId);
    const marks = marksFor(a.id).filter((m) => m.marks !== null);
    return `${marks.length}/${classStudents.length}`;
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Assessments</h1>
          <p className="text-sm text-slate-500">{data.assessments.length} assessments configured</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary">
            <Upload size={16} /> Import marks
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={16} /> Add assessment
          </button>
        </div>
      </div>

      {data.assessments.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={28} />}
          title="No assessments yet"
          description="Create assessments like quizzes, tests, CATs, or examinations. You can also import marks from a CSV file."
          action={
            <div className="flex gap-3">
              <button onClick={() => setShowImport(true)} className="btn-secondary">
                <Upload size={16} /> Import marks
              </button>
              <button onClick={() => setShowAdd(true)} className="btn-primary">
                <Plus size={16} /> Add assessment
              </button>
            </div>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Assessment</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">Type</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Class</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Marks</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Completed</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.assessments.map((a) => (
                <tr key={a.id} className="group hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-navy-900">{a.name}</p>
                    <p className="text-xs text-slate-400">Max: {a.maxMarks} marks</p>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell"><Badge variant="info">{a.type}</Badge></td>
                  <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell">{className(a.classId)}</td>
                  <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell">{subjectName(a.subjectId)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{a.maxMarks}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">{completedCount(a)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => setEditing(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-700">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => setDeleteTarget(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-error-50 hover:text-error-600">
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

      {(showAdd || editing) && (
        <AssessmentModal assessment={editing} onClose={() => { setShowAdd(false); setEditing(null); }} />
      )}

      {showImport && <ImportMarksModal onClose={() => setShowImport(false)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            setData((draft) => {
              draft.assessments = draft.assessments.filter((a) => a.id !== deleteTarget.id);
              draft.marks = draft.marks.filter((m) => m.assessmentId !== deleteTarget.id);
            });
          }
        }}
        title="Delete assessment?"
        message={`Delete "${deleteTarget?.name}" and all associated marks? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function AssessmentModal({ assessment, onClose }: { assessment: Assessment | null; onClose: () => void }) {
  const data = useSchoolData();
  const [name, setName] = useState(assessment?.name || '');
  const [type, setType] = useState<AssessmentType>(assessment?.type || 'Quiz');
  const [classId, setClassId] = useState(assessment?.classId || data.classes[0]?.id || '');
  const [subjectId, setSubjectId] = useState(assessment?.subjectId || '');
  const [maxMarks, setMaxMarks] = useState(assessment?.maxMarks || 20);
  const [date, setDate] = useState(assessment?.date || new Date().toISOString().slice(0, 10));
  const [term, setTerm] = useState(assessment?.term || data.terms.find((t) => t.current)?.name || 'Term 1');

  const availableSubjects = data.classes.find((c) => c.id === classId)
    ? subjectsForClass(data.classes.find((c) => c.id === classId)!, data.subjects)
    : [];

  const save = () => {
    if (!name.trim() || !classId || !subjectId) return;
    if (assessment) {
      setData((draft) => {
        const idx = draft.assessments.findIndex((a) => a.id === assessment.id);
        if (idx >= 0) draft.assessments[idx] = { ...assessment, name, type, classId, subjectId, maxMarks, date, term };
      });
    } else {
      const id = uid('asmt');
      setData((draft) => {
        draft.assessments.push({ id, name, type, classId, subjectId, maxMarks, date, term });
        // Initialize empty marks for all students in the class
        const classStudents = draft.students.filter((s) => s.classId === classId);
        for (const s of classStudents) {
          draft.marks.push({ studentId: s.id, assessmentId: id, marks: null });
        }
      });
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={assessment ? 'Edit assessment' : 'Add assessment'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={!name.trim() || !classId || !subjectId}>Save</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Assessment name</label>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quiz 1" autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600">Type</label>
          <div className="flex flex-wrap gap-2">
            {ASSESSMENT_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  type === t ? 'border-navy-600 bg-navy-50 text-navy-900' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Class</label>
            <select className="input-field" value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }}>
              {data.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Subject</label>
            <select className="input-field" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Select subject...</option>
              {availableSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Maximum marks</label>
            <input type="number" className="input-field" value={maxMarks} onChange={(e) => setMaxMarks(parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Date</label>
            <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** A row from the CSV that we've tried to match to a student. */
interface MatchRow {
  rawIdentifier: string;
  rawMarks: string;
  matchedStudent: Student | null;
  marks: number | null;
  /** User can edit the identifier to fix a mismatch. */
  editedIdentifier: string;
  /** User can edit the marks value. */
  editedMarks: string;
}

function ImportMarksModal({ onClose }: { onClose: () => void }) {
  const data = useSchoolData();
  const [step, setStep] = useState<'instructions' | 'mapping' | 'review' | 'results'>('instructions');
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [matchRows, setMatchRows] = useState<MatchRow[]>([]);
  const [imported, setImported] = useState(0);
  const [unmatched, setUnmatched] = useState(0);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(reader.result as string);
      setParsedRows(rows);
      setStep('mapping');
    };
    reader.readAsText(file);
  };

  const buildMatchRows = (): MatchRow[] => {
    if (parsedRows.length < 2 || !assessmentId) return [];
    const header = parsedRows[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'));
    // Find the student identifier column — could be student_id, id, name, student_name, full_name
    const idIdx = header.findIndex((h) =>
      h.includes('student_id') || h === 'id' || h.includes('name') || h === 'student',
    );
    const marksIdx = header.findIndex((h) => h.includes('marks') || h.includes('score'));

    if (idIdx < 0 || marksIdx < 0) return [];

    return parsedRows.slice(1).map((row) => {
      const rawIdentifier = row[idIdx] || '';
      const rawMarks = row[marksIdx] || '';
      const matchedStudent = matchStudent(rawIdentifier, data.students);
      const parsedMarks = parseFloat(rawMarks);
      return {
        rawIdentifier,
        rawMarks,
        matchedStudent,
        marks: isNaN(parsedMarks) ? null : parsedMarks,
        editedIdentifier: rawIdentifier,
        editedMarks: rawMarks,
      };
    });
  };

  const doMatch = () => {
    const rows = buildMatchRows();
    setMatchRows(rows);
    setUnmatched(rows.filter((r) => !r.matchedStudent).length);
    setStep('review');
  };

  const reMatchRow = (index: number) => {
    setMatchRows((prev) => {
      const next = [...prev];
      const row = next[index];
      const student = matchStudent(row.editedIdentifier, data.students);
      next[index] = { ...row, matchedStudent: student };
      return next;
    });
  };

  const reMatchAll = () => {
    setMatchRows((prev) =>
      prev.map((row) => ({
        ...row,
        matchedStudent: matchStudent(row.editedIdentifier, data.students),
      })),
    );
    setUnmatched(matchRows.filter((r) => !matchStudent(r.editedIdentifier, data.students)).length);
  };

  const doImport = () => {
    if (!assessmentId) return;
    let count = 0;
    const newMarks: { studentId: string; assessmentId: string; marks: number }[] = [];

    for (const row of matchRows) {
      if (!row.matchedStudent) continue;
      const parsed = parseFloat(row.editedMarks);
      if (isNaN(parsed)) continue;
      newMarks.push({ studentId: row.matchedStudent.id, assessmentId, marks: parsed });
      count++;
    }

    setData((draft) => {
      draft.marks = draft.marks.filter((m) => m.assessmentId !== assessmentId);
      draft.marks.push(...newMarks.map((m) => ({ ...m, marks: m.marks })));
    });
    setImported(count);
    setUnmatched(matchRows.filter((r) => !r.matchedStudent).length);
    setStep('results');
  };

  const downloadTemplate = () => {
    const assessment = data.assessments[0];
    if (!assessment) return;
    const classStudents = data.students.filter((s) => s.classId === assessment.classId);
    const csv = `student_name,marks\n${classStudents.map((s) => `${s.firstName} ${s.lastName},`).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 's4me-marks-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const matchedCount = matchRows.filter((r) => r.matchedStudent).length;

  return (
    <Modal
      open
      onClose={onClose}
      title="Import marks"
      maxWidth="max-w-2xl"
      footer={
        step === 'instructions' ? (
          <>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={() => document.getElementById('marks-file')?.click()} disabled={data.assessments.length === 0}>
              <Upload size={16} /> Select CSV
            </button>
          </>
        ) : step === 'mapping' ? (
          <>
            <button className="btn-ghost" onClick={() => setStep('instructions')}>Back</button>
            <button className="btn-primary" onClick={doMatch} disabled={!assessmentId}>
              Match students
            </button>
          </>
        ) : step === 'review' ? (
          <>
            <button className="btn-ghost" onClick={() => setStep('mapping')}>Back</button>
            <button className="btn-primary" onClick={doImport} disabled={matchedCount === 0}>
              <CheckCircle size={16} /> Import {matchedCount} marks
            </button>
          </>
        ) : (
          <button className="btn-primary" onClick={onClose}>Done</button>
        )
      }
    >
      <input
        id="marks-file"
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {step === 'instructions' && (
        <div className="space-y-4">
          {data.assessments.length === 0 ? (
            <Alert variant="warning" title="No assessments yet">
              You need to create at least one assessment before importing marks.
            </Alert>
          ) : (
            <>
              <Alert variant="info" title="Name-based matching">
                Your CSV must have a <strong>student_name</strong> (or <strong>student_id</strong>) column and a <strong>marks</strong> column.
                Students are matched by name — any order of first and last name works (e.g. "John Doe" or "Doe John" both match).
                Unmatched rows can be edited directly before importing.
              </Alert>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-sm font-medium text-navy-900">Example format:</p>
                <pre className="text-xs text-slate-600">student_name,marks{'\n'}John Doe,18.5{'\n'}Smith Jane,15.0{'\n'}Mukamana Alice,12.0</pre>
              </div>
              <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm font-medium text-navy-600 hover:text-navy-900">
                <FileSpreadsheet size={16} /> Download template
              </button>
            </>
          )}
        </div>
      )}

      {step === 'mapping' && (
        <div className="space-y-4">
          <Alert variant="info">
            Found {parsedRows.length - 1} records in {fileName}. Select the assessment to import marks into.
          </Alert>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Assessment</label>
            <select className="input-field" value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>
              <option value="">Select assessment...</option>
              {data.assessments.map((a) => {
                const cls = data.classes.find((c) => c.id === a.classId);
                const subj = data.subjects.find((s) => s.id === a.subjectId);
                return (
                  <option key={a.id} value={a.id}>
                    {a.name} — {cls?.name} — {subj?.name}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-1 text-xs font-medium text-slate-500">Detected columns:</p>
            <p className="text-xs text-slate-600">{parsedRows[0]?.join(', ')}</p>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-accent-50 p-3 text-center">
              <p className="text-2xl font-bold text-accent-700">{matchedCount}</p>
              <p className="text-xs text-accent-600">Matched</p>
            </div>
            <div className="rounded-lg bg-warning-50 p-3 text-center">
              <p className="text-2xl font-bold text-warning-700">{unmatched}</p>
              <p className="text-xs text-warning-600">Unmatched</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-2xl font-bold text-navy-900">{matchRows.length}</p>
              <p className="text-xs text-slate-500">Total rows</p>
            </div>
          </div>

          {unmatched > 0 && (
            <Alert variant="warning" title={`${unmatched} row${unmatched > 1 ? 's' : ''} could not be matched`}>
              Edit the name in each unmatched row to fix the spelling, then click "Re-match" to try again. You can also import just the matched rows and skip the rest.
            </Alert>
          )}

          <div className="max-h-72 overflow-y-auto scrollbar-thin rounded-lg border border-slate-200">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Student name (editable)</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Matched to</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">Marks</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matchRows.map((row, idx) => (
                  <tr key={idx} className={row.matchedStudent ? '' : 'bg-warning-50/30'}>
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-navy-900 focus:border-navy-400 focus:outline-none"
                        value={row.editedIdentifier}
                        onChange={(e) => {
                          setMatchRows((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], editedIdentifier: e.target.value, matchedStudent: null };
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.matchedStudent ? (
                        <span className="flex items-center gap-1 text-accent-700">
                          <CheckCircle size={12} />
                          {row.matchedStudent.firstName} {row.matchedStudent.lastName}
                          <span className="text-slate-400">({row.matchedStudent.studentNumber})</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-warning-600">
                          <AlertTriangle size={12} /> No match
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        className="w-16 rounded border border-slate-200 px-2 py-1 text-center text-xs text-navy-900 focus:border-navy-400 focus:outline-none"
                        value={row.editedMarks}
                        onChange={(e) => {
                          setMatchRows((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], editedMarks: e.target.value };
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {!row.matchedStudent && (
                        <button
                          onClick={() => reMatchRow(idx)}
                          className="rounded p-1 text-navy-500 hover:bg-navy-50 hover:text-navy-700"
                          title="Re-match this row"
                        >
                          <RefreshCw size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {unmatched > 0 && (
            <button onClick={reMatchAll} className="flex items-center gap-2 text-sm font-medium text-navy-600 hover:text-navy-900">
              <RefreshCw size={14} /> Re-match all unmatched rows
            </button>
          )}
        </div>
      )}

      {step === 'results' && (
        <div className="flex flex-col items-center py-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-50 text-accent-600">
            <ClipboardCheck size={28} />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-navy-900">Import complete</h3>
          <p className="text-sm text-slate-500">{imported} marks have been recorded.</p>
          {unmatched > 0 && (
            <p className="mt-2 text-xs text-warning-600">{unmatched} row{unmatched > 1 ? 's were' : ' was'} skipped (no match found).</p>
          )}
        </div>
      )}
    </Modal>
  );
}
