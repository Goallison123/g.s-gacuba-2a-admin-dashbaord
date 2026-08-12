import React, { useState } from 'react';
import { Check, Clock3, Mail, Send, Smartphone, Users, X } from 'lucide-react';
import type { Campaign } from '@/types';
import { CATEGORIES } from '@/lib/constants';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';

export default function NotificationModal({ onClose, onSave, recipientCount }: { onClose: () => void; onSave: (campaign: Omit<Campaign, 'id' | 'created_at'>) => void; recipientCount: number }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [channels, setChannels] = useState<string[]>(['SMS']);
  const [category, setCategory] = useState('Parent notification');
  const [mode, setMode] = useState<'send' | 'schedule'>('send');
  const [scheduledDate, setScheduledDate] = useState('');
  const toggle = (channel: string) => setChannels((items) => items.includes(channel) ? items.filter((item) => item !== channel) : [...items, channel]);
  const canSave = title.trim() && message.trim() && channels.length > 0 && (mode === 'send' || scheduledDate);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal notification-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Parent communications</p>
            <h2>New notification</h2>
          </div>
          <IconButton onClick={onClose}><X size={19} /></IconButton>
        </div>
        <div className="modal-body">
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}</select>
          </label>
          <label>
            Notification title
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. PTA General Meeting" />
          </label>
          <label>
            Message
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write a clear, helpful message for parents..." rows={4} />
            <span className="character-count">{message.length}/500</span>
          </label>
          <label>Send through</label>
          <div className="channel-options">{['SMS', 'WhatsApp', 'Email'].map((channel) => <button key={channel} className={channels.includes(channel) ? 'selected' : ''} onClick={() => toggle(channel)}>{channel === 'SMS' ? <Smartphone size={17} /> : channel === 'WhatsApp' ? <Send size={17} /> : <Mail size={17} />}<span>{channel}</span>{channels.includes(channel) && <Check size={15} />}</button>)}</div>
          <div className="recipient-note"><Users size={16} /><span>This will reach <strong>{recipientCount} parents</strong> using their preferred contact details.</span></div>
          <div className="send-choice">
            <button className={mode === 'send' ? 'active' : ''} onClick={() => setMode('send')}><Send size={16} /><span><strong>Send now</strong><small>Deliver as soon as possible</small></span></button>
            <button className={mode === 'schedule' ? 'active' : ''} onClick={() => setMode('schedule')}><Clock3 size={16} /><span><strong>Schedule</strong><small>Choose a date and time</small></span></button>
          </div>
          {mode === 'schedule' && <input className="date-input" type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />}
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canSave} onClick={() => { onSave({ title, message, channels, recipient_count: recipientCount, status: mode === 'send' ? 'Sent' : 'Scheduled', category }); }}>{mode === 'send' ? 'Send notification' : 'Schedule notification'}</Button>
        </div>
      </div>
    </div>
  );
}
