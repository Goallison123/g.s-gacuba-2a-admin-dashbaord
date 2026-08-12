import React, { useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { galleryImages } from '@/lib/constants';
import type { Content } from '@/types';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';

export default function ContentModal({ onClose, onSave }: { onClose: () => void; onSave: (content: Omit<Content, 'id' | 'created_at'>) => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('News');
  const [excerpt, setExcerpt] = useState('');
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal small-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Connected website</p>
            <h2>Create content</h2>
          </div>
          <IconButton onClick={onClose}><X size={19} /></IconButton>
        </div>
        <div className="modal-body">
          <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give your update a clear title" /></label>
          <label>Content type<select value={type} onChange={(e) => setType(e.target.value)}><option>News</option><option>Announcement</option><option>Gallery</option></select></label>
          <label>Short description<textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="A short introduction for the website..." rows={4} /></label>
          <div className="attachment-button"><Paperclip size={16} /> Add cover image <span>Optional</span></div>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!title || !excerpt} onClick={() => onSave({ title, content_type: type, excerpt, image_url: galleryImages[Math.floor(Math.random() * galleryImages.length)], status: 'Draft' })}>Save as draft</Button>
        </div>
      </div>
    </div>
  );
}
