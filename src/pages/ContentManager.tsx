import React from 'react';
import type { Content } from '@/types';
import Button from '@/components/ui/Button';

export default function ContentManager({ content, onAdd, onDelete, onPublish }: { content: Content[]; onAdd: () => void; onDelete: (id: string) => void; onPublish: (id: string) => void }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Connected website</p>
          <h1>Website content</h1>
        </div>
        <div>
          <Button variant="primary" onClick={onAdd}>Create content</Button>
        </div>
      </div>

      <div className="content-grid">
        {content.map((item) => (
          <article className="content-card" key={item.id}>
            <div className="content-body">
              <div className="content-status"><span className={`status ${item.status.toLowerCase()}`}>{item.status}</span><span>{new Date(item.created_at).toLocaleDateString()}</span></div>
              <h3>{item.title}</h3>
              <p>{item.excerpt}</p>
              <div className="content-actions"><Button variant="text" onClick={onAdd}>Edit</Button>{item.status !== 'Published' && <Button variant="text" onClick={() => onPublish(item.id)}>Publish</Button>}</div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
