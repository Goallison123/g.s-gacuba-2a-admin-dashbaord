import { useMemo, useState } from 'react';
import { Bell, Copy, Megaphone, Plus, Search, Trash2, Users } from 'lucide-react';
import type { Campaign } from '@/types';
import Button from '@/components/ui/Button';

type CategoryFilter = 'ALL' | 'FEES' | 'GENERAL' | 'REPORT';
const categoryLabels: Record<string, string> = {
  FEES: 'Remaining Fees Alert',
  GENERAL: 'School Announcement',
  REPORT: 'Student Report Link',
  'Fee reminder': 'Remaining Fees Alert',
  'Parent notification': 'School Announcement',
  'Examination result': 'Student Report Link',
};

function campaignDate(campaign: Campaign) {
  const timestamp = campaign.scheduled_for ?? campaign.created_at;
  if (!timestamp) return 'Date unavailable';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return campaign.scheduled_for
    ? `Scheduled for ${date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function categoryColor(category: string) {
  if (category === 'FEES' || category === 'Fee reminder') return 'border-amber-200 bg-amber-100 text-amber-800';
  if (category === 'REPORT' || category === 'Examination result') return 'border-purple-200 bg-purple-100 text-purple-800';
  return 'border-sky-200 bg-sky-100 text-sky-800';
}

export default function Campaigns({
  campaigns,
  onCompose,
  onDelete,
  notify,
}: {
  campaigns: Campaign[];
  onCompose: () => void;
  onDelete: (id: string) => void | Promise<void>;
  notify: (message: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return campaigns.filter((campaign) => {
      const category = campaign.category.toLocaleUpperCase();
      const normalizedCategory = category === 'FEE REMINDER' ? 'FEES'
        : category === 'EXAMINATION RESULT' ? 'REPORT'
          : category === 'PARENT NOTIFICATION' ? 'GENERAL' : category;
      const matchesCategory = activeFilter === 'ALL' || normalizedCategory === activeFilter;
      const matchesQuery = !query || [campaign.title, campaign.message, campaign.category]
        .some((value) => value?.toLocaleLowerCase().includes(query));
      return matchesCategory && matchesQuery;
    });
  }, [campaigns, activeFilter, search]);

  async function deleteCampaign(campaign: Campaign) {
    if (!window.confirm(`Delete “${campaign.title}” from notifications?`)) return;
    setBusyId(campaign.id);
    try {
      await onDelete(campaign.id);
    } catch {
      notify('Could not delete this notification. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function copyMessage(message: string) {
    try {
      await navigator.clipboard.writeText(message);
      notify('Message copied to clipboard.');
    } catch {
      notify('Clipboard access is unavailable in this browser.');
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 text-stone-800">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#786C60]">Parent communications</p>
          <h1 className="font-serif text-4xl font-bold text-[#3A2818]">Notifications</h1>
        </div>
        <Button variant="primary" onClick={onCompose}><Plus size={15} className="text-[#C59B27]" />New notification</Button>
      </div>

      <section className="flex flex-col items-center justify-between gap-4 rounded-xl border border-[#EAE5DC] bg-white p-4 shadow-sm md:flex-row">
        <label className="relative block w-full md:max-w-xs">
          <Search size={14} className="pointer-events-none absolute inset-y-0 left-3.5 my-auto text-stone-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notifications..."
            aria-label="Search notifications"
            className="w-full rounded-xl border border-[#EAE5DC] bg-[#FBF9F5] py-2 pl-9 pr-4 text-xs outline-none transition focus:border-[#3A2818] focus:ring-2 focus:ring-[#3A2818]/20"
          />
        </label>
        <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 text-xs md:w-auto md:pb-0">
          {([
            ['ALL', 'All Notifications'],
            ['FEES', 'Remaining Fees'],
            ['GENERAL', 'School Alerts'],
            ['REPORT', 'Student Reports'],
          ] as const).map(([filter, label]) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              aria-pressed={activeFilter === filter}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 font-medium transition ${activeFilter === filter ? 'bg-[#3A2818] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Notification list" className="overflow-hidden rounded-2xl border border-[#EAE5DC] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE5DC] bg-[#FBF9F5] p-4">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-xs font-semibold text-[#3A2818]">All notifications</h2>
            <span className="rounded-full bg-[#EAE5DC] px-2 py-0.5 text-[10px] font-bold text-[#3A2818]">{filteredCampaigns.length}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-stone-400"><Bell size={13} />SMS messages are limited to 160 characters per segment</span>
        </div>

        {filteredCampaigns.length ? (
          <div className="divide-y divide-[#EAE5DC]">
            {filteredCampaigns.map((campaign) => (
              <article key={campaign.id} className="flex flex-col justify-between gap-4 p-4 transition hover:bg-[#FBF9F5] sm:flex-row sm:items-center sm:p-5">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${categoryColor(campaign.category)}`}>{categoryLabels[campaign.category] ?? campaign.category}</span>
                    <span className="text-xs text-stone-400">• {campaignDate(campaign)}</span>
                  </div>
                  <h3 className="m-0 text-sm font-bold text-[#3A2818]">{campaign.title}</h3>
                  <p className="inline-block max-w-3xl whitespace-pre-wrap break-words rounded-lg border border-[#EAE5DC] bg-stone-50 p-2 font-mono text-xs text-stone-600">{campaign.message}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-400">
                    <span className="inline-flex items-center gap-1"><Users size={13} />{campaign.recipient_count} recipients</span>
                    <span>{campaign.channels.join(' · ') || 'No channel specified'}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${campaign.status === 'Sent' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : campaign.status === 'Scheduled' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-stone-200 bg-stone-100 text-stone-600'}`}>{campaign.status}</span>
                  <button type="button" onClick={() => void copyMessage(campaign.message)} title="Copy message" aria-label={`Copy ${campaign.title} message`} className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-[#3A2818]"><Copy size={16} /></button>
                  <button type="button" disabled={busyId === campaign.id} onClick={() => void deleteCampaign(campaign)} title="Delete notification" aria-label={`Delete ${campaign.title}`} className="rounded-lg p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"><Trash2 size={16} /></button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-stone-100 text-stone-400"><Megaphone size={20} /></div>
            <p className="m-0 text-sm font-semibold text-stone-700">No notifications found</p>
            <p className="mt-1 text-xs text-stone-400">Try changing search keywords or create a new notification.</p>
          </div>
        )}
      </section>
      <p className="text-xs leading-relaxed text-stone-500">Campaigns are saved in the workspace; messages are not delivered until a messaging provider is connected.</p>
    </div>
  );
}
