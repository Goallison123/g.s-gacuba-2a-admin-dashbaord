import { useMemo, useState } from "react";
import {
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

type FeeStatus = "Paid" | "Partial" | "Unpaid";

type Student = {
  id: string;
  fullName: string;
  parentName: string;
  email: string;
  phone: string;
  studentClass: string;
  feeStatus: FeeStatus;
  feeAmount: string;
  lastUpdated: string;
};

const classes = ["P1 A", "P1 B", "P2 A", "P2 B", "P3 A", "P4 A", "P5 A", "P6 A"];

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

function feeBadge(status: FeeStatus) {
  if (status === "Paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Partial") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

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

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
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

  function saveStudent() {
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
    setStudents((current) =>
      current.map((student) => (student.id === updated.id ? updated : student)),
    );
    setActiveStudent(null);
    setError("");
    notify("Student details updated.");
  }

  function addStudent() {
    if (
      !form.fullName.trim() ||
      !form.parentName.trim() ||
      !form.email.trim() ||
      !form.phone.trim()
    ) {
      setError("Full name, parent's name, email and phone are required.");
      return;
    }

    const nextNumber =
      students.reduce((max, student) => {
        const number = Number(student.id.replace("STU-", ""));
        return Number.isFinite(number) ? Math.max(max, number) : max;
      }, 100) + 1;

    const newStudent: Student = {
      ...form,
      id: `STU-${nextNumber}`,
      lastUpdated: "Just now",
    };

    setStudents((current) => [newStudent, ...current]);
    setShowAddModal(false);
    setError("");
    setSearch("");
    setClassFilter("");
    setStatusFilter("");
    notify(`${newStudent.fullName} was added to the registry.`);
  }

  function deleteStudent(student: Student) {
    if (!window.confirm(`Delete ${student.fullName} from the registry?`)) return;
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
              {classes.map((schoolClass) => <option key={schoolClass}>{schoolClass}</option>)}
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
        </div>
        <button onClick={openAddModal} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3A2818] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#281B10]">
          <UserPlus size={17} className="text-[#C59B27]" />
          Add New Student
        </button>
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
              {classes.map((schoolClass) => <option key={schoolClass}>{schoolClass}</option>)}
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
                        <p className="mt-0.5 font-mono text-[11px] text-stone-400">{student.id}</p>
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

      {activeStudent && (
        <div className="fixed inset-0 z-40 flex justify-end bg-stone-900/40" onMouseDown={(e) => { if (e.target === e.currentTarget) setActiveStudent(null); }}>
          <aside className="flex h-full w-full max-w-[480px] flex-col border-l border-stone-200 bg-white shadow-2xl">
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
                <div className="flex justify-between gap-3"><span>Registry ID</span><span className="font-mono font-medium text-stone-700">{activeStudent.id}</span></div>
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
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#3A2818] p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C59B27]"><GraduationCap size={20} /></div>
                <div><h2 className="text-lg font-bold">Add new student</h2><p className="text-xs text-[#D1C7BD]">Register a pupil at G.S Gacuba 2A</p></div>
              </div>
              <button aria-label="Close add student form" onClick={() => setShowAddModal(false)} className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"><X size={17} /></button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
              {renderFormFields(false)}
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 border-t border-stone-200 bg-stone-50 p-5">
              <button onClick={() => setShowAddModal(false)} className="rounded-xl bg-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-300">Cancel</button>
              <button onClick={addStudent} className="rounded-xl bg-[#3A2818] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#281B10]">Register student</button>
            </div>
          </div>
        </div>
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