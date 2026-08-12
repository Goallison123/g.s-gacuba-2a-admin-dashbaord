import React, { useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { galleryImages } from '@/lib/constants';
import type { Content } from '@/types';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';

export default function ContentModal({ onClose, onSave }: { onClose: () => void; onSave: (content: Omit<Content, 'id' | 'created_at'>) => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'News' | 'Announcement' | 'Gallery'>('News');
  const [excerpt, setExcerpt] = useState('');
  const [date, setDate] = useState('');
  const [author, setAuthor] = useState('');
  const [readTime, setReadTime] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const isGallery = type === 'Gallery';

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
          <label>Content type<select value={type} onChange={(e) => setType(e.target.value as 'News' | 'Announcement' | 'Gallery')}><option>News</option><option>Announcement</option><option>Gallery</option></select></label>
          {isGallery ? (
            <label>Image URL<input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Enter gallery image URL" /></label>
          ) : (
            <>
              <label>Date<input value={date} onChange={(e) => setDate(e.target.value)} placeholder="YYYY-MM-DD" /></label>
              <label>Author<input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Admin name or author" /></label>
              <label>Read time<input value={readTime} onChange={(e) => setReadTime(e.target.value)} placeholder="e.g. 3 min read" /></label>
            </>
          )}
          <label>{isGallery ? 'Caption / description' : 'Summary'}<textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder={isGallery ? 'Describe the image' : 'Write a short summary for the article...'} rows={4} /></label>
          <div className="attachment-button"><Paperclip size={16} /> Add cover image <span>Optional</span></div>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!title || !excerpt}
            onClick={() => onSave({
              title,
              content_type: type,
              excerpt,
              image_url: imageUrl || galleryImages[Math.floor(Math.random() * galleryImages.length)],
              src: isGallery ? (imageUrl || galleryImages[Math.floor(Math.random() * galleryImages.length)]) : undefined,
              date: isGallery ? undefined : date || new Date().toISOString().split('T')[0],
              author: isGallery ? undefined : author || 'Administrator',
              read_time: isGallery ? undefined : readTime,
              category: type,
              description: excerpt,
              summary: excerpt,
              content: isGallery ? [] : [excerpt],
              status: 'Draft',
            })}
          >
            Save as draft
          </Button>
        </div>
      </div>
    </div>
  );
}
