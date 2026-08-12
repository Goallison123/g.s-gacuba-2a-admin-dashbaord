import React, { useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import type { Inquiry } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';

export default function Inquiries({ inquiries, setInquiries, notify }: { inquiries: Inquiry[]; setInquiries: (items: Inquiry[]) => void; notify: (m: string) => void }) {
  const [selected, setSelected] = useState<Inquiry | null>(inquiries[0] ?? null);

  function updateStatus(status: string) {
    if (!selected) return;
    const updated = { ...selected, status };
    setSelected(updated);
    setInquiries(inquiries.map((item) => item.id === selected.id ? updated : item));
    notify(`Inquiry marked as ${status.toLowerCase()}.`);
  }

  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">Website contact form</p><h1>Visitor inquiries</h1></div><div className="inquiry-stat"><strong>{inquiries.filter((i) => i.status === 'New').length}</strong> new</div></div>
      <div className="inquiries-layout">
        <section className="panel inquiry-list">
          {inquiries.map((inquiry) => (
            <button className={`inquiry-item ${selected?.id === inquiry.id ? 'selected' : ''}`} key={inquiry.id} onClick={() => setSelected(inquiry)}>
              <Avatar initials={inquiry.visitor_name.split(' ').map((p) => p[0]).slice(0,2).join('').toUpperCase()} variant="contact" />
              <div><strong>{inquiry.visitor_name}</strong><span>{inquiry.topic}</span><small>{inquiry.message}</small></div>
            </button>
          ))}
        </section>
        {selected && (
          <section className="panel inquiry-detail">
            <div className="detail-person"><Avatar initials={selected.visitor_name.split(' ').map((p) => p[0]).slice(0,2).join('').toUpperCase()} variant="large" /><div><h2>{selected.visitor_name}</h2><div className="person-contact"><span><Mail size={14} />{selected.email}</span>{selected.phone && <span><Phone size={14} />{selected.phone}</span>}</div></div></div>
            <div className="message-box"><p>{selected.message}</p></div>
            <div className="detail-actions"><Button variant="secondary" onClick={() => updateStatus('In progress')}>Mark in progress</Button><Button variant="primary" onClick={() => updateStatus('Resolved')}>Mark resolved</Button></div>
          </section>
        )}
      </div>
    </>
  );
}
