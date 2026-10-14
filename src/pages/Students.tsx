import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  FileSpreadsheet,
  Search,
  UserPlus,
  Pencil,
  Trash2,
  X,
  GraduationCap,
  Mail,
  Phone,
  Users,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  autoMapStudentCsvHeaders,
  parseStudentCsv,
  previewStudentCsvRows,
  studentCsvFields,
  type ParsedCsvRow,
  type StudentCsvField,
  type StudentCsvMapping,
} from "@/utils/studentCsv";
import { supabase } from "@/lib/supabase";

type FeeStatus = "Paid" | "Partial" | "Unpaid";

type Student = {
  id: string;
  registryCode?: string;
  fullName: string;
  parentName: string;
  email: string;
  phone: string;
  studentClass: string;
  feeStatus: FeeStatus;
  feeAmount: string;
  lastUpdated: string;
};

const classes = ["S1 A", "S1 B", "S1 C","S2 A", "S2 B", "S2 C","S3 A", "S3 B", "S3 C", "S4 ARH", "S4 STREAM 2","S5 ARH", "S5 STREAM 2", "S6 MPC", "S6 HGL"];

const initialStudents: Student[] = [
  {
    id: "STU-101",
    fullName: "Ineza Divine",
    parentName: "Jean Claude Uwase",
    email: "divine.ineza@gmail.com",
    phone: "+250 788 123 456",
    studentClass: "P2 A",
    feeStatus: "Paid",
    feeAmount: "145,000 RWF",
    lastUpdated: "Oct 12, 2026",
  },
  {
    id: "STU-102",
    fullName: "Nshimiyimana Patrick",
    parentName: "Marie Claire Mukamana",
    email: "patrick.nshi@yahoo.com",
    phone: "+250 790 987 654",
    studentClass: "P4 A",
    feeStatus: "Partial",
    feeAmount: "75,000 RWF",
    lastUpdated: "Oct 10, 2026",
  },
  {
    id: "STU-103",
    fullName: "Uwera Giramata Keza",
    parentName: "Emmanuel Giramata",
    email: "e.giramata@outlook.com",
    phone: "+250 783 456 789",
    studentClass: "P1 A",
    feeStatus: "Paid",
    feeAmount: "145,000 RWF",
    lastUpdated: "Oct 14, 2026",
  },
  {
    id: "STU-104",
    fullName: "Habimana Eric",
    parentName: "Claudine Nyiramahoro",
    email: "habimana.eric@gmail.com",
    phone: "+250 781 223 344",
    studentClass: "P5 A",
    feeStatus: "Unpaid",
    feeAmount: "0 RWF",
    lastUpdated: "Sep 28, 2026",
  },
  {
    id: "STU-105",
    fullName: "Mutoni Sandra",
    parentName: "Fiston Mutoni",
    email: "fiston.m@gmail.com",
    phone: "+250 782 555 666",
    studentClass: "P3 A",
    feeStatus: "Paid",
    feeAmount: "130,000 RWF",
    lastUpdated: "Oct 05, 2026",
  },
  {
    id: "STU-106",
    fullName: "Kwizera Yves",
    parentName: "Aline Uwimbabazi",
    email: "kwizera.yves@gmail.com",
    phone: "+250 791 444 333",
    studentClass: "P6 A",
    feeStatus: "Partial",
    feeAmount: "90,000 RWF",
    lastUpdated: "Oct 11, 2026",
  },
];

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-800 outline-none transition focus:border-[#3A2818] focus:ring-2 focus:ring-[#3A2818]/15";

const emptyForm = {
  fullName: "",
  parentName: "",
  email: "",
  phone: "",
  studentClass: "P1 A",
  feeStatus: "Unpaid" as FeeStatus,
  feeAmount: "0 RWF",
};

function toStudentRecord(row: Record<string, unknown>): Student {
  return {
    id: String(row.id),
    registryCode: String(row.registry_code ?? `STU-${String(row.id).slice(0, 8).toUpperCase()}`),
    fullName: String(row.full_name ?? ""),
    parentName: String(row.parent_name ?? "Not provided"),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    studentClass: String(row.class_name ?? ""),
    feeStatus: row.fee_status === "Paid" || row.fee_status === "Partial" ? row.fee_status : "Unpaid",
    feeAmount: String(row.fee_amount ?? "0 RWF"),
    lastUpdated: row.updated_at ? new Date(String(row.updated_at)).toLocaleDateString() : "Just now",
  };
}

function toStudentPayload(student: Omit<Student, "id" | "registryCode" | "lastUpdated">) {
  return {
    full_name: student.fullName,
    parent_name: student.parentName,
    email: student.email,
    phone: student.phone,
    class_name: student.studentClass,
    fee_status: student.feeStatus,
    fee_amount: student.feeAmount,
    updated_at: new Date().toISOString(),
  };
}

function newRegistryCode() {
  return `STU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function feeBadge(status: FeeStatus) {
  if (status === "Paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Partial") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>(supabase ? [] : initialStudents);
  const [studentsLoading, setStudentsLoading] = useState(Boolean(supabase));
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<ParsedCsvRow[]>([]);
  const [csvMapping, setCsvMapping] = useState<StudentCsvMapping | null>(null);
  const [csvError, setCsvError] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);

  const importPreview = useMemo(
    () => csvMapping ? previewStudentCsvRows(csvRows, csvMapping, students) : [],
    [csvRows, csvMapping, students],
  );
  const importableRows = importPreview.filter((row) => row.student && !row.errors.length && !row.duplicateLabel);
  const duplicateRows = importPreview.filter((row) => row.duplicateLabel);
  const invalidRows = importPreview.filter((row) => row.errors.length > 0);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    async function loadStudents() {
      const { data, error: loadError } = await supabase!
        .from("school_students")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (loadError) {
        console.error("Failed to load student registry", loadError);
        notify("Could not load saved students. Check the student registry database setup.");
      } else {
        setStudents((data ?? []).map((row) => toStudentRecord(row as unknown as Record<string, unknown>)));
      }
      setStudentsLoading(false);
    }
    void loadStudents();
    return () => { cancelled = true; };
  }, []);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSearch = [
        student.fullName,
        student.parentName,
        student.email,
        student.phone,
        student.id,
      ].some((value) => value.toLowerCase().includes(query));
      return (
        matchesSearch &&
        (!classFilter || student.studentClass === classFilter) &&
        (!statusFilter || student.feeStatus === statusFilter)
      );
    });
  }, [students, search, classFilter, statusFilter]);
  const availableClasses = [...new Set([...classes, ...students.map((student) => student.studentClass).filter(Boolean)])].sort();

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  async function handleCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setCsvError("This CSV is larger than 10 MB. Split it into smaller files and try again.");
      setShowImportModal(true);
      return;
    }

    try {
      const parsedRows = parseStudentCsv(await file.text());
      if (parsedRows.length < 2) {
        throw new Error("The CSV needs a header row and at least one student record.");
      }
      if (parsedRows.length - 1 > 5000) {
        throw new Error("This file contains more than 5,000 records. Split it into smaller files to review safely.");
      }

      const headers = parsedRows[0].values.map((header, index) => header || `Column ${index + 1}`);
      setCsvFileName(file.name);
      setCsvHeaders(headers);
      setCsvRows(parsedRows.slice(1));
      setCsvMapping(autoMapStudentCsvHeaders(headers));
      setCsvError("");
      setReviewConfirmed(false);
      setShowImportModal(true);
    } catch (parseError) {
      setCsvError(parseError instanceof Error ? parseError.message : "Could not read this CSV file.");
      setShowImportModal(true);
    }
  }

  function updateCsvMapping(field: StudentCsvField, value: string) {
    setCsvMapping((current) => {
      if (!current) return current;
      const updated = { ...current };
      if (value) {
        for (const otherField of studentCsvFields) {
          if (otherField.key !== field && updated[otherField.key] === value) {
            updated[otherField.key] = "";
          }
        }
      }
      updated[field] = value;
      return updated;
    });
    setReviewConfirmed(false);
  }

  function closeImportModal() {
    setShowImportModal(false);
    setCsvError("");
    setReviewConfirmed(false);
  }

  async function importCsvStudents() {
    if (!reviewConfirmed || importableRows.length === 0) return;
    const importRecords = importableRows.flatMap((row) => row.student ? [{
      registry_code: newRegistryCode(),
      full_name: row.student.fullName,
      parent_name: row.student.parentName,
      email: row.student.email,
      phone: row.student.phone,
      class_name: row.student.studentClass,
      fee_status: row.student.feeStatus,
      fee_amount: row.student.feeAmount,
    }] : []);
    let importedStudents: Student[];

    if (supabase) {
      const { data, error: importError } = await supabase.rpc("import_school_students", { p_students: importRecords });
      if (importError || !data) {
        console.error("Failed to import student records", importError);
        setCsvError(importError?.message ?? "The database did not return the imported records. Nothing was added.");
        setReviewConfirmed(false);
        return;
      }
      importedStudents = (data as unknown as Record<string, unknown>[]).map(toStudentRecord);
    } else {
      let nextNumber = students.reduce((max, student) => {
        const number = Number(student.id.replace("STU-", ""));
        return Number.isFinite(number) ? Math.max(max, number) : max;
      }, 100);
      importedStudents = importableRows.flatMap((row) => {
        if (!row.student) return [];
        nextNumber += 1;
        return [{ ...row.student, id: `STU-${nextNumber}`, lastUpdated: "Just now" }];
      });
      notify("Supabase is not configured; these imported records will only remain for this browser session.");
    }

    setStudents((current) => [...importedStudents, ...current]);
    setSearch("");
    setClassFilter("");
    setStatusFilter("");
    closeImportModal();
    if (supabase) notify(`Imported ${importedStudents.length} students; skipped ${duplicateRows.length} duplicates and ${invalidRows.length} invalid rows.`);
  }

  function openAddModal() {
    setForm({ ...emptyForm });
    setError("");
    setShowAddModal(true);
  }

  function openEdit(student: Student) {
    setActiveStudent({ ...student });
    setError("");
  }

  function updateActiveStudent(field: keyof Student, value: string) {
    setActiveStudent((current) =>
      current ? { ...current, [field]: value } as Student : current,
    );
  }

  async function saveStudent() {
    if (!activeStudent) return;
    if (
      !activeStudent.fullName.trim() ||
      !activeStudent.parentName.trim() ||
      !activeStudent.email.trim() ||
      !activeStudent.phone.trim()
    ) {
      setError("Complete the student and parent contact fields first.");
      return;
    }

    const updated = { ...activeStudent, lastUpdated: "Just now" };
    if (supabase) {
      const { data, error: saveError } = await supabase
        .from("school_students")
        .update(toStudentPayload(updated))
        .eq("id", updated.id)
        .select("*")
        .maybeSingle();
      if (saveError || !data) {
        console.error("Failed to update student", saveError);
        setError("Could not save changes to the student database. Please try again.");
        return;
      }
      Object.assign(updated, toStudentRecord(data as unknown as Record<string, unknown>));
    }
    setStudents((current) =>
      current.map((student) => (student.id === updated.id ? updated : student)),
    );
    setActiveStudent(null);
    setError("");
    notify("Student details updated.");
  }

  async function addStudent() {
    if (
      !form.fullName.trim() ||
      !form.parentName.trim() ||
      !form.email.trim() ||
      !form.phone.trim()
    ) {
      setError("Full name, parent's name, email and phone are required.");
      return;
    }

    let newStudent: Student;
    if (supabase) {
      const { data, error: insertError } = await supabase
        .from("school_students")
        .insert({ registry_code: newRegistryCode(), ...toStudentPayload(form) })
        .select("*")
        .maybeSingle();
      if (insertError || !data) {
        console.error("Failed to add student", insertError);
        setError("Could not save this student to the database. Please try again.");
        return;
      }
      newStudent = toStudentRecord(data as unknown as Record<string, unknown>);
    } else {
      const nextNumber = students.reduce((max, student) => {
        const number = Number(student.id.replace("STU-", ""));
        return Number.isFinite(number) ? Math.max(max, number) : max;
      }, 100) + 1;
      newStudent = { ...form, id: `STU-${nextNumber}`, lastUpdated: "Just now" };
    }

    setStudents((current) => [newStudent, ...current]);
    setShowAddModal(false);
    setError("");
    setSearch("");
    setClassFilter("");
    setStatusFilter("");
    notify(`${newStudent.fullName} was added to the registry.`);
  }

  async function deleteStudent(student: Student) {
    if (!window.confirm(`Delete ${student.fullName} from the registry?`)) return;
    if (supabase) {
      const { error: deleteError } = await supabase.from("school_students").delete().eq("id", student.id);
      if (deleteError) {
        console.error("Failed to delete student", deleteError);
        setError("Could not delete this student from the database. Please try again.");
        return;
      }
    }
    setStudents((current) => current.filter((item) => item.id !== student.id));
    setActiveStudent((current) => (current?.id === student.id ? null : current));
    notify(`${student.fullName} was removed from this demo registry.`);
  }

  function renderFormFields(isEditing: boolean) {
    const values = isEditing && activeStudent ? activeStudent : form;
    const setValue = (field: keyof typeof emptyForm, value: string) => {
      if (isEditing) updateActiveStudent(field as keyof Student, value);
      else setForm((current) => ({ ...current, [field]: value }));
    };

    return (
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-600">Full name *</span>
          <input className={inputClass} value={values.fullName} onChange={(e) => setValue("fullName", e.target.value)} placeholder="e.g. Mugisha Jean Claude" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-600">Parent's name *</span>
          <input className={inputClass} value={values.parentName} onChange={(e) => setValue("parentName", e.target.value)} placeholder="e.g. Jean Bosco Mugisha" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-600">Email *</span>
            <input type="email" className={inputClass} value={values.email} onChange={(e) => setValue("email", e.target.value)} placeholder="parent@example.com" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-600">Phone *</span>
            <input className={inputClass} value={values.phone} onChange={(e) => setValue("phone", e.target.value)} placeholder="+250 780 000 000" />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-600">Class *</span>
            <select className={inputClass} value={values.studentClass} onChange={(e) => setValue("studentClass", e.target.value)}>
              {availableClasses.map((schoolClass) => <option key={schoolClass}>{schoolClass}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-600">Fee status *</span>
            <select className={inputClass} value={values.feeStatus} onChange={(e) => setValue("feeStatus", e.target.value)}>
              <option>Paid</option>
              <option>Partial</option>
              <option>Unpaid</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-600">School fees paid amount</span>
          <input className={inputClass} value={values.feeAmount} onChange={(e) => setValue("feeAmount", e.target.value)} placeholder="e.g. 120,000 RWF" />
        </label>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 text-stone-800">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#C59B27]">Directory</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Students Registry</h1>
          <p className="mt-1 text-sm text-stone-500">Manage student profiles, parent details, fees, and academic standing.</p>
          {studentsLoading && <p role="status" className="mt-2 text-xs text-stone-500">Loading saved student records…</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => csvInputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-400 hover:bg-stone-50">
            <FileSpreadsheet size={17} className="text-[#3A2818]" />
            Import CSV
          </button>
          <button onClick={openAddModal} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3A2818] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#281B10]">
            <UserPlus size={17} className="text-[#C59B27]" />
            Add New Student
          </button>
        </div>
      </div>

      <section className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:flex-row">
        <div className="relative w-full md:max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className={`${inputClass} pl-10`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student, parent, email, phone..." />
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
          <label className="flex items-center gap-3 text-xs font-medium text-stone-500">
            <span className="whitespace-nowrap">Class:</span>
            <select className={`${inputClass} min-w-36`} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">All classes</option>
              {availableClasses.map((schoolClass) => <option key={schoolClass}>{schoolClass}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-3 text-xs font-medium text-stone-500">
            <span className="whitespace-nowrap">Fee status:</span>
            <select className={`${inputClass} min-w-36`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option>Paid</option>
              <option>Partial</option>
              <option>Unpaid</option>
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-xs font-semibold uppercase tracking-wider text-stone-500">
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Parent's name</th>
                <th className="px-6 py-4">Email & phone</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">School fees paid</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {filteredStudents.map((student) => (
                <tr key={student.id} onClick={() => openEdit(student)} className="group cursor-pointer transition hover:bg-stone-50/80">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3A2818]/10 text-xs font-bold text-[#3A2818]">{student.fullName.charAt(0)}</div>
                      <div>
                        <p className="font-semibold text-stone-900">{student.fullName}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-stone-400">{student.registryCode ?? student.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-stone-600">{student.parentName}</td>
                  <td className="px-6 py-4">
                    <p className="flex items-center gap-1.5 text-xs text-stone-700"><Mail size={12} />{student.email}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-400"><Phone size={12} />{student.phone}</p>
                  </td>
                  <td className="px-6 py-4"><span className="inline-flex rounded-md border border-stone-200 bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">{student.studentClass}</span></td>
                  <td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${feeBadge(student.feeStatus)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{student.feeStatus} ({student.feeAmount})</span></td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <button aria-label={`Edit ${student.fullName}`} onClick={(e) => { e.stopPropagation(); openEdit(student); }} className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-[#3A2818]"><Pencil size={16} /></button>
                      <button aria-label={`Delete ${student.fullName}`} onClick={(e) => { e.stopPropagation(); deleteStudent(student); }} className="rounded-lg p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredStudents.length === 0 && (
          <div className="px-6 py-14 text-center">
            <Users size={28} className="mx-auto text-stone-300" />
            <h2 className="mt-3 font-semibold text-stone-700">No students found</h2>
            <p className="mt-1 text-sm text-stone-400">Try another search or add a student to the registry.</p>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-6 py-3 text-xs text-stone-500">
          <span>Showing {filteredStudents.length} of {students.length} students</span>
          <span className="hidden italic sm:inline">Select a row to view or edit details</span>
        </div>
      </section>

      <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFileChange} />

      {showImportModal && (
        <section role="dialog" aria-modal="true" aria-labelledby="student-import-title" className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-5xl flex-col border-l border-stone-200 bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-stone-200 bg-[#3A2818] px-5 py-4 text-white sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#E7C66A]">Bulk student import</p>
                <h2 id="student-import-title" className="mt-1 text-xl font-bold">Review CSV records</h2>
                {csvFileName && <p className="mt-1 text-xs text-stone-300">{csvFileName}</p>}
              </div>
              <button aria-label="Close CSV import" onClick={closeImportModal} className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"><X size={19} /></button>
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              {csvError ? (
                <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <AlertTriangle size={19} className="mt-0.5 shrink-0" />
                  <div><strong>CSV could not be prepared.</strong><p className="mb-0 mt-1">{csvError}</p></div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-700" />
                    <div><strong>Review every row before importing.</strong><p className="mb-0 mt-1 text-xs leading-relaxed">First names are converted to UPPERCASE and last names to lowercase, then joined as the student name. Extra CSV columns are ignored. Red rows are duplicates or invalid and will be skipped. No records are added until you confirm below.</p></div>
                  </div>

                  <section aria-label="Map CSV columns" className="rounded-xl border border-stone-200 p-4">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <div><h3 className="font-semibold text-stone-900">Match your file columns</h3><p className="mt-1 text-xs text-stone-500">We guessed from the headers. Check each match; unselected columns will not be imported.</p></div>
                      <span className="text-xs text-stone-500">{csvHeaders.length} columns detected</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {studentCsvFields.map(({ key, label }) => {
                        const selectedColumn = csvMapping?.[key] ?? "";
                        const options = csvHeaders.map((header, index) => ({ header, value: String(index) })).filter(({ value }) =>
                          !csvMapping || value === selectedColumn || !studentCsvFields.some((other) => other.key !== key && csvMapping[other.key] === value),
                        );
                        return (
                          <label key={key} className="block text-xs font-medium text-stone-700">
                            <span className="mb-1.5 block">{label}</span>
                            <select className={inputClass} value={selectedColumn} onChange={(event) => updateCsvMapping(key, event.target.value)}>
                              <option value="">Not mapped</option>
                              {options.map(({ header, value }) => <option key={value} value={value}>{header} (column {Number(value) + 1})</option>)}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                    <p className="mb-0 mt-3 text-xs text-stone-500">Required: first + last name, or one full-name column, and class. Parent contact and fee columns are optional.</p>
                  </section>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg bg-stone-100 px-3 py-2"><strong className="block text-lg text-stone-900">{importPreview.length}</strong><span className="text-xs text-stone-600">Rows reviewed</span></div>
                    <div className="rounded-lg bg-emerald-50 px-3 py-2"><strong className="block text-lg text-emerald-800">{importableRows.length}</strong><span className="text-xs text-emerald-700">Ready to import</span></div>
                    <div className="rounded-lg bg-rose-50 px-3 py-2"><strong className="block text-lg text-rose-800">{duplicateRows.length}</strong><span className="text-xs text-rose-700">Duplicates · skipped</span></div>
                    <div className="rounded-lg bg-rose-50 px-3 py-2"><strong className="block text-lg text-rose-800">{invalidRows.length}</strong><span className="text-xs text-rose-700">Invalid · skipped</span></div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-stone-200">
                    <div className="max-h-80 overflow-auto">
                      <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                        <thead className="sticky top-0 z-10 bg-stone-100 text-[10px] uppercase tracking-wide text-stone-600">
                          <tr><th className="px-3 py-3">CSV row</th><th className="px-3 py-3">Student name</th><th className="px-3 py-3">Parent / guardian</th><th className="px-3 py-3">Class</th><th className="px-3 py-3">Email</th><th className="px-3 py-3">Validation</th></tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {importPreview.map((row) => (
                            <tr key={row.lineNumber} className={row.errors.length || row.duplicateLabel ? "bg-rose-50/80" : "bg-white"}>
                              <td className="px-3 py-2.5 font-mono text-stone-500">{row.lineNumber}</td>
                              <td className="px-3 py-2.5 font-semibold text-stone-900">{row.student?.fullName || row.values.filter(Boolean).slice(0, 2).join(" ") || "—"}</td>
                              <td className="px-3 py-2.5 text-stone-700">{row.student?.parentName ?? "—"}</td>
                              <td className="px-3 py-2.5 text-stone-700">{row.student?.studentClass ?? "—"}</td>
                              <td className="px-3 py-2.5 text-stone-700">{row.student?.email || "—"}</td>
                              <td className="max-w-sm px-3 py-2.5">
                                {row.duplicateLabel ? <span className="font-semibold text-rose-700">Duplicate — {row.duplicateLabel}</span> : row.errors.length ? <span className="text-rose-700">{row.errors.join(" ")}</span> : <span className="inline-flex items-center gap-1 font-medium text-emerald-700"><CheckCircle2 size={14} />Ready</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <footer className="flex flex-col gap-3 border-t border-stone-200 bg-stone-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              {!csvError && <label className="flex items-start gap-2 text-xs leading-relaxed text-stone-700"><input type="checkbox" className="mt-0.5 accent-[#3A2818]" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} /><span>I reviewed the preview and confirm importing {importableRows.length} valid, unique records. Invalid rows and duplicates will be skipped.</span></label>}
              <div className="flex shrink-0 justify-end gap-2">
                <button onClick={closeImportModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100">{csvError ? "Close" : "Cancel"}</button>
                {!csvError && <button onClick={importCsvStudents} disabled={!reviewConfirmed || importableRows.length === 0} className="rounded-xl bg-[#3A2818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#281B10]">Import {importableRows.length} students</button>}
              </div>
            </footer>
        </section>
      )}

      {activeStudent && (
          <aside role="dialog" aria-modal="true" aria-label={`Edit ${activeStudent.fullName}`} className="fixed inset-y-0 right-0 z-40 flex h-full w-full max-w-[480px] flex-col border-l border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#3A2818] p-6 text-white">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#C59B27] text-lg font-bold">{activeStudent.fullName.charAt(0)}</div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold">{activeStudent.fullName || "Student details"}</h2>
                  <p className="text-xs text-[#D1C7BD]">{activeStudent.studentClass} · Registered pupil</p>
                </div>
              </div>
              <button aria-label="Close student details" onClick={() => setActiveStudent(null)} className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"><X size={18} /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {renderFormFields(true)}
              <div className="space-y-2 rounded-xl border border-stone-200 bg-[#FBF9F5] p-4 text-xs text-stone-500">
                <div className="flex justify-between gap-3"><span>Registry ID</span><span className="font-mono font-medium text-stone-700">{activeStudent.registryCode ?? activeStudent.id}</span></div>
                <div className="flex justify-between gap-3"><span>Last updated</span><span className="font-medium text-stone-700">{activeStudent.lastUpdated}</span></div>
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 p-5">
              <button onClick={() => deleteStudent(activeStudent)} className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-100"><Trash2 size={15} />Delete</button>
              <div className="ml-auto flex gap-2">
                <button onClick={() => setActiveStudent(null)} className="rounded-xl bg-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-300">Cancel</button>
                <button onClick={saveStudent} className="rounded-xl bg-[#3A2818] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#281B10]">Save changes</button>
              </div>
            </div>
          </aside>
      )}

      {showAddModal && (
          <section role="dialog" aria-modal="true" aria-labelledby="add-student-title" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#3A2818] p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C59B27]"><GraduationCap size={20} /></div>
                <div><h2 id="add-student-title" className="text-lg font-bold">Add new student</h2><p className="text-xs text-[#D1C7BD]">Register a pupil at G.S Gacuba 2A</p></div>
              </div>
              <button aria-label="Close add student form" onClick={() => setShowAddModal(false)} className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"><X size={17} /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {renderFormFields(false)}
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 border-t border-stone-200 bg-stone-50 p-5">
              <button onClick={() => setShowAddModal(false)} className="rounded-xl bg-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-300">Cancel</button>
              <button onClick={addStudent} className="rounded-xl bg-[#3A2818] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#281B10]">Register student</button>
            </div>
          </section>
      )}

      {toast && (
        <div role="status" className="fixed bottom-5 right-5 z-[60] flex items-center gap-3 rounded-xl bg-[#3A2818] px-5 py-3 text-white shadow-xl">
          {toast.toLowerCase().includes("removed") ? <AlertCircle className="text-rose-300" size={20} /> : <CheckCircle2 className="text-[#C59B27]" size={20} />}
          <span className="text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}