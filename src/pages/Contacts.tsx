import { useMemo, useState } from 'react';
import { Download, Search, Users } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { Contact } from '@/types';

export default function Contacts({ contacts, onExport }: { contacts: Contact[]; onExport: (format: 'xls' | 'ods') => void }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return contacts.filter((contact) => [contact.parent_name, contact.student_name, contact.class_name, contact.phone, contact.email]
      .some((value) => value.toLocaleLowerCase().includes(query)));
  }, [contacts, search]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Student registry records</p>
          <h1>Parent contacts</h1>
          <p className="subheading">Contact details are managed only from each student’s registry record.</p>
        </div>
        <div className="heading-actions">
          <Button variant="secondary" onClick={() => onExport('xls')}><Download size={16} />Export XLS</Button>
          <Button variant="secondary" onClick={() => onExport('ods')}><Download size={16} />Export ODS</Button>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="panel-header">
          <h2>Student parent records <span className="count-badge">{filtered.length}</span></h2>
          <div className="table-tools"><div className="search-box compact"><Search size={16} /><input aria-label="Search parent records" placeholder="Search parents or students" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
        </div>
        <div className="data-table">
          <div className="table-row contact-row table-head"><span>Parent</span><span>Student</span><span>Contact</span><span>Class</span><span>Source</span><span /></div>
          {filtered.map((contact) => (
            <div className="table-row contact-row" key={contact.id}>
              <span>{contact.parent_name || 'Not provided'}</span>
              <span>{contact.student_name || '—'}</span>
              <span>{[contact.phone, contact.email].filter(Boolean).join(' · ') || 'No contact details'}</span>
              <span>{contact.class_name || '—'}</span>
              <span className="inline-flex items-center gap-1.5"><Users size={13} />Student registry</span>
              <span />
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-state"><Users size={24} /><strong>{contacts.length ? 'No matching parent records' : 'No student parent records yet'}</strong><span>{contacts.length ? 'Try a different search.' : 'Add parent contact details to students in the Students Registry.'}</span></div>}
        </div>
      </section>
    </>
  );
}
