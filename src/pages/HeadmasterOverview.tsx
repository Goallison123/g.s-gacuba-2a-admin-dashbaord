import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Check, GraduationCap, Users } from 'lucide-react';
import type { Campaign, Contact, Content, Inquiry, View } from '@/types';
import { SCHOOL_NAME } from '@/lib/constants';

type Task = { id: number; text: string; completed: boolean };

const periods = ['Term 1, 2026', 'Term 2, 2026', 'Term 3, 2026'];
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function termRange(period: string) {
  const [term, yearText] = period.split(', ');
  const year = Number(yearText);
  const termNumber = Number(term.match(/\d+/)?.[0] ?? 3);
  const starts = [new Date(year, 0, 1), new Date(year, 4, 1), new Date(year, 8, 1)];
  const ends = [new Date(year, 4, 1), new Date(year, 8, 1), new Date(year + 1, 0, 1)];
  const index = Math.min(2, Math.max(0, termNumber - 1));
  return { start: starts[index], end: ends[index] };
}

export default function HeadmasterOverview({
  contacts,
  campaigns,
  content,
  inquiries,
  adminName,
  adminRole,
  onNavigate,
}: {
  contacts: Contact[];
  campaigns: Campaign[];
  content: Content[];
  inquiries: Inquiry[];
  adminName: string;
  adminRole: string;
  onNavigate: (view: View) => void;
}) {
  const [displayName, setDisplayName] = useState(adminName);
  const [displayRole, setDisplayRole] = useState(adminRole);
  const [reportPeriod, setReportPeriod] = useState('Term 3, 2026');
  const [studentCategory, setStudentCategory] = useState<'ALL' | 'NEW' | 'MIDTERM'>('ALL');
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: 'Review student registry and parent details', completed: false },
    { id: 2, text: 'Review pending parent notifications', completed: false },
    { id: 3, text: 'Check website content awaiting publication', completed: false },
    { id: 4, text: 'Review new visitor inquiries', completed: false },
  ]);

  const { start, end } = termRange(reportPeriod);
  const studentsInTerm = useMemo(() => contacts.filter((contact) => {
    const createdAt = new Date(contact.created_at);
    return !Number.isNaN(createdAt.getTime()) && createdAt >= start && createdAt < end;
  }), [contacts, start, end]);
  const studentCount = studentCategory === 'ALL'
    ? contacts.length
    : studentCategory === 'NEW'
      ? studentsInTerm.length
      : Math.max(0, contacts.length - studentsInTerm.length);

  const sentRecipients = campaigns
    .filter((campaign) => campaign.status === 'Sent')
    .reduce((total, campaign) => total + campaign.recipient_count, 0);
  const activeInquiries = inquiries.filter((inquiry) => inquiry.status === 'New').length;
  const pendingContent = content.filter((item) => item.status !== 'Published').length;

  const weeklyCampaignCounts = useMemo(() => {
    const today = new Date();
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
    const values = weekDays.map((_, index) => {
      const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
      const nextDay = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
      return campaigns.filter((campaign) => {
        const createdAt = new Date(campaign.created_at);
        return !Number.isNaN(createdAt.getTime()) && createdAt >= day && createdAt < nextDay;
      }).length;
    });
    return values;
  }, [campaigns]);
  const maxWeeklyCount = Math.max(1, ...weeklyCampaignCounts);

  function toggleTask(id: number) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task));
  }

  const quickTaskAction = (id: number) => {
    if (id === 1) onNavigate('students');
    if (id === 2) onNavigate('campaigns');
    if (id === 3) onNavigate('content');
    if (id === 4) onNavigate('inquiries');
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 text-stone-800">
      <header className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-[#EAE5DC] bg-white p-6 shadow-sm md:flex-row">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[#3A2818] text-[#C59B27] shadow-md"><GraduationCap size={31} /></div>
          <div>
            <h1 className="m-0 font-serif text-xl font-bold text-[#3A2818]">{SCHOOL_NAME} Admin Portal</h1>
            <p className="mb-0 mt-1 text-xs uppercase tracking-wider text-[#786C60]">GSMS • Sybella Systems</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="rounded-xl border border-[#EAE5DC] bg-[#FBF9F5] px-3.5 py-2">
            <span className="block text-[10px] font-semibold uppercase text-stone-400">Name</span>
            <input aria-label="Headmaster display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-40 bg-transparent font-medium text-stone-800 outline-none" />
          </label>
          <label className="rounded-xl border border-[#EAE5DC] bg-[#FBF9F5] px-3.5 py-2">
            <span className="block text-[10px] font-semibold uppercase text-stone-400">Role</span>
            <input aria-label="Headmaster role" value={displayRole} onChange={(event) => setDisplayRole(event.target.value)} className="w-36 bg-transparent font-medium text-stone-800 outline-none" />
          </label>
          <div className="rounded-xl border border-[#EAE5DC] bg-[#FBF9F5] px-3.5 py-2">
            <span className="block text-[10px] font-semibold uppercase text-stone-400">Date</span>
            <span className="font-medium text-stone-800">{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </header>

      <section className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-[#3A2818] p-5 text-white shadow-md lg:flex-row lg:items-center">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#D1C7BD]">Recipients in sent campaigns</p>
            <p className="m-0 font-mono text-2xl font-bold text-[#C59B27]">{sentRecipients.toLocaleString()}</p>
          </div>
          <div className="h-8 w-px bg-[#523A24]" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#D1C7BD]">SMS cost</p>
            <p className="m-0 font-mono text-xl font-bold text-white">Not tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[#523A24] bg-[#281B10] px-4 py-2.5 text-xs text-[#D1C7BD]">
          <AlertTriangle size={17} className="shrink-0 text-[#C59B27]" />
          <span><strong>Notice:</strong> SMS delivery and prepaid balance are not connected to a provider.</span>
        </div>
      </section>

      <section className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#EAE5DC] bg-white p-5 shadow-sm sm:flex-row">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"><Users size={14} />Total Students: <span className="font-mono font-bold">{contacts.length.toLocaleString()}</span></div>
          <div className="flex items-center gap-1 rounded-xl border border-[#EAE5DC] bg-[#FBF9F5] p-1 text-xs">
            {([['NEW', 'New'], ['MIDTERM', 'Mid-term'], ['ALL', 'All']] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={studentCategory === value} onClick={() => setStudentCategory(value)} className={`rounded-lg px-3 py-1 transition ${studentCategory === value ? 'bg-[#3A2818] text-white' : 'text-stone-600 hover:bg-stone-100'}`}>{label}</button>
            ))}
          </div>
          <span className="text-xs text-stone-500">{studentCount.toLocaleString()} in selected category</span>
        </div>
        <label className="flex w-full items-center gap-3 sm:w-auto">
          <span className="whitespace-nowrap text-xs font-medium text-stone-600">Report period:</span>
          <select value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value)} className="rounded-xl border border-[#EAE5DC] bg-[#FBF9F5] px-3.5 py-2 text-xs font-medium outline-none focus:border-[#3A2818]">
            {periods.map((period) => <option key={period}>{period}</option>)}
          </select>
        </label>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col justify-between rounded-2xl border border-[#EAE5DC] bg-white p-6 shadow-sm">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="m-0 font-serif text-lg font-bold text-[#3A2818]">Headmaster checklist</h2>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-600">Quick actions</span>
            </div>
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#EAE5DC] bg-[#FBF9F5] p-3 transition hover:bg-stone-50">
                  <button type="button" onClick={() => quickTaskAction(task.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-medium text-stone-800 hover:text-[#8C7355]">
                    <span className={task.completed ? 'text-stone-400 line-through' : ''}>{task.text}</span>
                    {task.id === 3 && pendingContent > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">{pendingContent}</span>}
                    {task.id === 4 && activeInquiries > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-800">{activeInquiries}</span>}
                    <ArrowUpRight size={13} className="shrink-0" />
                  </button>
                  <button type="button" role="checkbox" aria-checked={task.completed} aria-label={`${task.completed ? 'Mark incomplete' : 'Complete'}: ${task.text}`} onClick={() => toggleTask(task.id)} className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${task.completed ? 'border-[#3A2818] bg-[#3A2818] text-white' : 'border-stone-300 bg-white text-transparent'}`}><Check size={13} /></button>
                </div>
              ))}
            </div>
          </div>
          <p className="mb-0 mt-6 text-right font-serif text-xs italic text-[#786C60]">Thank you</p>
        </div>

        <div className="relative flex flex-col justify-between rounded-2xl border border-[#EAE5DC] bg-white p-6 shadow-sm">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="m-0 font-serif text-lg font-bold text-[#3A2818]">System activity</h2>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">This week</span>
            </div>
            <p className="mb-6 text-xs text-stone-500">Campaign records created each day. Login analytics are not currently collected.</p>
            <div className="flex h-40 items-end justify-between rounded-xl border border-[#EAE5DC] bg-[#FBF9F5] px-6 pt-5">
              {weeklyCampaignCounts.map((count, index) => (
                <div key={weekDays[index]} className="flex h-full flex-col items-center justify-end gap-2">
                  <span className="text-[10px] font-medium text-stone-500">{count}</span>
                  <div title={`${count} campaign records`} className="w-6 rounded-t-lg bg-[#3A2818] transition-all duration-500 hover:bg-[#C59B27] sm:w-8" style={{ height: `${count === 0 ? 4 : Math.max(10, count / maxWeeklyCount * 70)}%` }} />
                  <span className="text-[10px] font-medium text-stone-500">{weekDays[index]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <div className="flex items-center gap-2 rounded-2xl border border-[#EAE5DC] bg-[#F7F3EC] p-3 text-xs text-[#3A2818] shadow-sm"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#C59B27] text-[10px] font-bold text-white">?</span><span>Contact your admin or <strong>Sybella Systems</strong></span></div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#EAE5DC] pt-4 text-center">
        <p className="mb-0 text-xs font-medium text-[#786C60]">{SCHOOL_NAME} School Management System (GSMS) • Developed by Sybella Systems</p>
      </footer>
    </div>
  );
}
