import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Check, Clock3, Mail, Send, Smartphone, Users, X } from 'lucide-react';
import type { Campaign, Contact } from '@/types';

type Category = 'FEES' | 'GENERAL' | 'REPORT';
type RecipientMode = 'ALL' | 'SELECT';
type ScheduleMode = 'NOW' | 'LATER';

const templates: Record<Category, { title: string; message: string; tags: string[] }> = {
  FEES: {
    title: 'School Fees Remaining Balance Reminder',
    message: 'Dear Parent, remaining school fees balance for {FULLNAME} is {FEES}. Please settle promptly.',
    tags: ['{FULLNAME}', '{FEES}'],
  },
  GENERAL: {
    title: 'Important School Announcement',
    message: 'Dear Parents, please be informed that G.S Gacuba 2A will hold a general PTA meeting this Friday at 2 PM.',
    tags: ['{FULLNAME}'],
  },
  REPORT: {
    title: 'Academic Performance Report Download Link',
    message: 'Dear Parent, academic report for {FULLNAME} is now ready. Download directly here: {REPORTLINK}',
    tags: ['{FULLNAME}', '{REPORTLINK}'],
  },
};

export default function NotificationModal({
  onClose,
  onSave,
  contacts,
}: {
  onClose: () => void;
  onSave: (campaign: Omit<Campaign, 'id' | 'created_at'>) => void;
  contacts: Contact[];
}) {
  const [category, setCategory] = useState<Category>('FEES');
  const [title, setTitle] = useState(templates.FEES.title);
  const [message, setMessage] = useState(templates.FEES.message);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('ALL');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('NOW');
  const [scheduledDate, setScheduledDate] = useState('');
  const [error, setError] = useState('');
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const smsContacts = useMemo(() => contacts.filter((contact) => contact.phone.trim()), [contacts]);
  const recipientCount = recipientMode === 'ALL'
    ? smsContacts.length
    : selectedContactIds.filter((id) => smsContacts.some((contact) => contact.id === id)).length;
  const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const isScheduleValid = scheduleMode === 'NOW' || Boolean(scheduledDate && new Date(scheduledDate).getTime() > Date.now());
  const canSave = Boolean(title.trim() && message.trim() && message.length <= 160 && recipientCount > 0 && isScheduleValid);

  useEffect(() => {
    const template = templates[category];
    setTitle(template.title);
    setMessage(template.message);
    setError('');
  }, [category]);

  function updateCategory(event: ChangeEvent<HTMLSelectElement>) {
    setCategory(event.target.value as Category);
  }

  function toggleContact(id: string) {
    setSelectedContactIds((selected) => selected.includes(id)
      ? selected.filter((selectedId) => selectedId !== id)
      : [...selected, id]);
  }

  function insertTag(tag: string) {
    const textarea = messageRef.current;
    if (!textarea || message.length + tag.length > 160) {
      setError('Adding this tag would exceed the 160-character SMS limit.');
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const updated = `${message.slice(0, start)}${tag}${message.slice(end)}`;
    setMessage(updated);
    setError('');
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    });
  }

  function saveCampaign() {
    if (!title.trim() || !message.trim()) {
      setError('Enter a notification title and message.');
      return;
    }
    if (message.length > 160) {
      setError('SMS messages must be 160 characters or fewer.');
      return;
    }
    if (recipientCount === 0) {
      setError(recipientMode === 'SELECT' ? 'Select at least one parent contact.' : 'Add at least one valid phone number.');
      return;
    }
    if (scheduleMode === 'LATER' && (!scheduledDate || new Date(scheduledDate).getTime() <= Date.now())) {
      setError('Choose a future date and time.');
      return;
    }

    onSave({
      title: title.trim(),
      message: message.trim(),
      channels: ['SMS'],
      recipient_count: recipientCount,
      status: scheduleMode === 'LATER' ? 'Scheduled' : 'Draft',
      category,
      ...(scheduleMode === 'LATER' ? { scheduled_for: new Date(scheduledDate).toISOString() } : {}),
    });
  }

  const categoryOptions: { value: Category; label: string }[] = [
    { value: 'FEES', label: '1. Remaining Fees Alert ({FEES} calculation)' },
    { value: 'GENERAL', label: '2. School Notification (PTA, emergency, announcements)' },
    { value: 'REPORT', label: '3. Student Academic Report ({FULLNAME} & {REPORTLINK})' },
  ];

  return (
    <section role="dialog" aria-modal="true" aria-labelledby="notification-modal-title" className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-[#EAE5DC] bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-[#EAE5DC] bg-[#FBF9F5] p-6">
          <div>
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#786C60]">Parent communications</p>
            <h2 id="notification-modal-title" className="m-0 font-serif text-2xl font-bold text-[#3A2818]">New notification</h2>
          </div>
          <button type="button" aria-label="Close notification form" onClick={onClose} className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"><X size={19} /></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <label className="block text-xs font-semibold text-stone-700">
            <span className="mb-1 block">Notification Category</span>
            <select value={category} onChange={updateCategory} className="w-full rounded-xl border border-[#EAE5DC] bg-[#FBF9F5] px-3.5 py-2.5 text-xs font-medium outline-none transition focus:border-[#3A2818] focus:ring-2 focus:ring-[#3A2818]/20">
              {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="block text-xs font-semibold text-stone-700">
            <span className="mb-1 block">Notification Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. PTA General Meeting / Remaining Fees Notice" className="w-full rounded-xl border border-[#EAE5DC] bg-[#FBF9F5] px-3.5 py-2.5 text-xs font-medium outline-none transition focus:border-[#3A2818] focus:ring-2 focus:ring-[#3A2818]/20" />
          </label>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label htmlFor="notification-message" className="text-xs font-semibold text-stone-700">Message (SMS)</label>
              <div className="flex items-center gap-1.5">
                {templates[category].tags.map((tag) => <button key={tag} type="button" onClick={() => insertTag(tag)} className="rounded border border-[#EAE5DC] bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-[#3A2818] transition hover:bg-stone-200">{tag}</button>)}
              </div>
            </div>
            <textarea id="notification-message" ref={messageRef} rows={3} maxLength={160} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a clear, helpful message for parents..." className="w-full resize-none rounded-xl border border-[#EAE5DC] bg-[#FBF9F5] p-3.5 text-xs font-medium outline-none transition focus:border-[#3A2818] focus:ring-2 focus:ring-[#3A2818]/20" />
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className={message.length > 150 ? 'font-medium text-rose-600' : 'font-medium text-emerald-700'}><Smartphone size={13} className="mr-1 inline" />1 SMS segment (max 160 characters)</span>
              <span className={`font-mono ${message.length > 150 ? 'font-bold text-rose-600' : 'text-stone-400'}`}>{message.length} / 160</span>
            </div>
          </div>

          <section>
            <p className="mb-2 text-xs font-semibold text-stone-700">Target Parent Recipients</p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {([
                ['ALL', 'All Parents', Users],
                ['SELECT', 'Select Parents', Check],
              ] as const).map(([mode, label, Icon]) => (
                <button key={mode} type="button" aria-pressed={recipientMode === mode} onClick={() => setRecipientMode(mode)} className={`rounded-xl border p-2.5 text-center transition ${recipientMode === mode ? 'border-[#3A2818] bg-[#3A2818] text-white' : 'border-[#EAE5DC] bg-[#FBF9F5] text-stone-700 hover:bg-stone-100'}`}>
                  <Icon size={15} className="mx-auto mb-1" /><span className="block text-[11px] font-semibold">{label}</span>
                </button>
              ))}
            </div>

            {recipientMode === 'SELECT' && <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-[#EAE5DC] bg-[#FBF9F5] p-3">
              {!smsContacts.length ? <p className="m-0 text-xs text-stone-500">No student registry parent records with a phone number are available for SMS.</p> : smsContacts.map((contact) => (
                <label key={contact.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#EAE5DC] bg-white p-2 text-xs transition hover:bg-stone-50">
                  <span className="flex min-w-0 items-center gap-2"><input type="checkbox" checked={selectedContactIds.includes(contact.id)} onChange={() => toggleContact(contact.id)} className="accent-[#3A2818]" /><span className="min-w-0"><strong className="block truncate text-stone-800">{contact.parent_name || 'Parent contact'}</strong><span className="block truncate text-[10px] text-stone-400">{contact.student_name || 'Student'}{contact.class_name ? ` · ${contact.class_name}` : ''}</span></span></span>
                  <span className="shrink-0 text-[10px] text-stone-500">{contact.phone || contact.email || 'No contact details'}</span>
                </label>
              ))}
            </div>}

          </section>

          <section>
            <p className="mb-1.5 text-xs font-semibold text-stone-700">Send through</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 p-2.5 text-xs font-medium text-sky-800"><Smartphone size={15} />SMS<Check size={13} /></div>
              <div aria-disabled="true" className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[#EAE5DC] bg-stone-50 p-2.5 text-xs text-stone-400 opacity-60"><Send size={15} />WhatsApp</div>
              <div aria-disabled="true" className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[#EAE5DC] bg-stone-50 p-2.5 text-xs text-stone-400 opacity-60"><Mail size={15} />Email</div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#EAE5DC] bg-[#F7F3EC] p-3 text-xs text-[#3A2818]"><Users size={15} className="shrink-0 text-[#C59B27]" /><span>This campaign is addressed to <strong>{recipientCount} {recipientCount === 1 ? 'parent' : 'parents'}</strong> through SMS.</span></div>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold text-stone-700">Schedule</p>
            <div className="grid grid-cols-2 gap-3">
              {([['NOW', 'Save draft', 'Save without sending', Send], ['LATER', 'Schedule', 'Choose a future time', Clock3]] as const).map(([mode, label, detail, Icon]) => (
                <button key={mode} type="button" aria-pressed={scheduleMode === mode} onClick={() => setScheduleMode(mode)} className={`rounded-xl border p-3 text-left transition ${scheduleMode === mode ? 'border-[#3A2818] bg-stone-50' : 'border-[#EAE5DC] bg-[#FBF9F5] hover:bg-stone-100'}`}>
                  <span className="flex items-start gap-2.5"><Icon size={15} className="mt-0.5 shrink-0 text-[#3A2818]" /><span><strong className="block text-xs text-[#3A2818]">{label}</strong><small className="text-[10px] text-stone-500">{detail}</small></span></span>
                </button>
              ))}
            </div>
          </section>

          {scheduleMode === 'LATER' && <label className="block text-[10px] font-semibold uppercase text-stone-600">Schedule date and time<input type="datetime-local" min={minDateTime} value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className="mt-1 w-full rounded-xl border border-[#EAE5DC] bg-[#FBF9F5] px-3 py-2 text-xs normal-case" /></label>}
          {error && <p role="alert" className="m-0 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
          <p className="m-0 text-[10px] leading-relaxed text-stone-500">Saving or scheduling creates a campaign record only. A messaging provider is required to deliver SMS, WhatsApp, or email.</p>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-[#EAE5DC] bg-[#FBF9F5] p-4">
          <button type="button" onClick={onClose} className="rounded-xl bg-stone-200 px-4 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-300">Cancel</button>
          <button type="button" disabled={!canSave} onClick={saveCampaign} className="rounded-xl bg-[#8C7355] px-5 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-[#3A2818] disabled:cursor-not-allowed disabled:opacity-50">{scheduleMode === 'LATER' ? 'Schedule notification' : 'Save campaign draft'}</button>
        </footer>
    </section>
  );
}
