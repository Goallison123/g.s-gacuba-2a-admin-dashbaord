import React, { useState } from 'react';
import { Search, Inbox } from 'lucide-react';
import type { Campaign } from '@/types';
import { CATEGORIES } from '@/lib/constants';
import Button from '@/components/ui/Button';

export default function Campaigns({ campaigns, onCompose, onDelete, notify }: { campaigns: Campaign[]; onCompose: () => void; onDelete: (id: string) => void; notify: (m: string) => void }) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  const filtered = campaigns.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) || c.message.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'All' || c.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Parent communications</p>
          <h1>Notifications</h1>
        </div>
        <div>
          <Button variant="primary" onClick={onCompose}>New notification</Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box"><Search size={17} /><input placeholder="Search notifications" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="filter-wrap"><select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}><option>All</option>{CATEGORIES.map((cat) => <option key={cat.id}>{cat.label}</option>)}</select></div>
      </div>

      <section className="panel table-panel">
        <div className="panel-header"><h2>All notifications <span className="count-badge">{filtered.length}</span></h2></div>
        <div className="data-table">
          {filtered.length === 0 && <div className="empty-state"><Inbox size={28} /><strong>No notifications found</strong><span>Try adjusting your search or filter.</span></div>}
          {filtered.map((c) => (
            <div className="table-row" key={c.id}>
              <div><strong>{c.title}</strong><small>{c.message.slice(0, 60)}</small></div>
              <div className="muted-cell">{c.recipient_count}</div>
              <div className="muted-cell">{c.status}</div>
              <div><button onClick={() => { navigator.clipboard?.writeText(c.message); notify('Message copied.'); }}>Copy</button><button onClick={() => onDelete(c.id)}>Delete</button></div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
