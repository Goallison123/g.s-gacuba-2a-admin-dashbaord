import { useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Student = { id: string; full_name: string; class_name: string; stream?: string };

export default function TeacherStudentRegister() {
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadRegister() {
      if (!supabase) { setError('Connect Supabase to view the assigned student register.'); return; }
      const { data, error: queryError } = await supabase.from('teacher_student_register')
        .select('id, full_name, class_name, stream')
        .order('class_name').order('full_name');
      if (queryError) setError(queryError.message);
      else setStudents((data ?? []) as Student[]);
    }
    void loadRegister();
  }, []);

  const visibleStudents = students.filter((student) => `${student.full_name} ${student.class_name} ${student.stream ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <div className="space-y-5">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-[#C59B27]">Assigned classes</p><h1 className="mt-1 text-2xl font-bold text-stone-900 sm:text-3xl">Student Register</h1><p className="mt-1 text-sm text-stone-500">Names and classes for students in your assigned classes.</p></div>
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 p-4"><label className="relative block max-w-sm"><Search size={16} className="absolute left-3 top-2.5 text-stone-400"/><input aria-label="Search register" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student or class" className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm"/></label></div>
      {error ? <p role="alert" className="p-6 text-sm text-rose-700">{error}</p> : visibleStudents.length ? <div className="divide-y divide-stone-100">{visibleStudents.map((student) => <div key={student.id} className="flex items-center gap-3 px-5 py-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#3A2818]/10 text-xs font-bold text-[#3A2818]">{student.full_name.charAt(0)}</span><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-stone-900">{student.full_name}</strong><span className="text-xs text-stone-500">{student.class_name}{student.stream ? ` · ${student.stream}` : ''}</span></div></div>)}</div> : <div className="p-10 text-center"><Users className="mx-auto text-stone-300" size={25}/><p className="mt-2 text-sm text-stone-500">No students found in your assigned classes.</p></div>}
      <footer className="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">{visibleStudents.length} students visible</footer>
    </section>
  </div>;
}
