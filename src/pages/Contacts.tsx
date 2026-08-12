import React, { useState } from 'react';
import { FileSpreadsheet, ArrowDownToLine, ArrowUpRight, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { Contact } from '@/types';

export default function Contacts({ contacts, onImport, onExport, onAdd, onDelete }: { contacts: Contact[]; onImport: () => void; onExport: (format: 'xls' | 'ods') => void; onAdd: () => void; onDelete: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const filtered = contacts.filter((c) => c.parent_name.toLowerCase().includes(search.toLowerCase()) || c.student_name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Family directory</p>
          <h1>Parent contacts</h1>
        </div>
        <div className="heading-actions">
          <Button variant="secondary" onClick={onImport}><ArrowDownToLine size={16} /> Import CSV</Button>
          <Button variant="primary" onClick={onAdd}><FileSpreadsheet size={16} /> Add contact</Button>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="panel-header"><h2>All parent contacts <span className="count-badge">{filtered.length}</span></h2><div className="table-tools"><div className="search-box compact"><Search size={16} /><input placeholder="Search parents" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div></div>
        <div className="data-table">
          <div className="table-row contact-row table-head"><span>Parent</span><span>Student</span><span>Contact</span><span>Preferred</span><span>Status</span><span /></div>
          {filtered.map((c) => (
            <div className="table-row contact-row" key={c.id}>
              <span>{c.parent_name}</span>
              <span>{c.student_name}</span>
              <span>{c.phone} · {c.email}</span>
              <span>{c.preferred_channel}</span>
              <span>{c.status}</span>
              <div><button onClick={() => onDelete(c.id)}>Delete</button></div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
