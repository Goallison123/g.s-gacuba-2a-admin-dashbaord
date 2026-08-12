import React, { useMemo, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { Content } from '@/types';
import Button from '@/components/ui/Button';

const PER_PAGE_OPTIONS = [6, 12, 18];

export default function ContentManager({ content, onAdd, onEdit, onDelete, onPublish }: { content: Content[]; onAdd: () => void; onEdit: (item: Content) => void; onDelete: (id: string) => void; onPublish: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'News' | 'Announcement' | 'Gallery'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Published'>('All');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(6);

  const filteredContent = useMemo(() => {
    const term = search.trim().toLowerCase();
    return content.filter((item) => {
      const matchesType = typeFilter === 'All' || item.content_type === typeFilter;
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      const matchesSearch = !term || [item.title, item.excerpt, item.summary, item.description, item.category, item.author, item.src, item.image_url]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term));
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [content, search, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredContent.length / perPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visibleContent = filteredContent.slice((page - 1) * perPage, page * perPage);

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

      <div className="toolbar">
        <div className="search-box">
          <Search size={14} />
          <input placeholder="Search content" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="filter-wrap">
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as any); setPage(1); }}>
            <option value="All">All types</option>
            <option value="News">News</option>
            <option value="Announcement">Announcement</option>
            <option value="Gallery">Gallery</option>
          </select>
        </div>
        <div className="filter-wrap">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}>
            <option value="All">All statuses</option>
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
          </select>
        </div>
        <div className="filter-wrap">
          <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
            {PER_PAGE_OPTIONS.map((option) => <option key={option} value={option}>{option} per page</option>)}
          </select>
        </div>
      </div>

      <div className="content-grid">
        {visibleContent.map((item) => (
          <article className="content-card" key={item.id}>
            <div className="content-body">
              <div className="content-status">
                <span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>
                <span>{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
              <div className="content-card-header">
                <div>
                  <div className="category-chip brown active"><strong>{item.content_type}</strong><span>{item.category || 'Uncategorized'}</span></div>
                  <h3>{item.title}</h3>
                </div>
                {item.content_type === 'Gallery' && item.src && <img className="content-thumb" src={item.src} alt={item.title ?? 'Gallery item'} />}
              </div>
              <p>{item.excerpt || item.summary || item.description || 'No description available.'}</p>
              <div className="content-meta">
                {item.content_type !== 'Gallery' && <span>{item.author ? `By ${item.author}` : 'By Administrator'}</span>}
                {item.date && <span>Published {item.date}</span>}
                {item.read_time && <span>{item.read_time}</span>}
              </div>
              <div className="content-actions">
                <Button variant="text" onClick={() => onEdit(item)}>Edit</Button>
                {item.status !== 'Published' && <Button variant="text" onClick={() => onPublish(item.id)}>Publish</Button>}
                <Button variant="text" onClick={() => onDelete(item.id)}>Delete</Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filteredContent.length === 0 && (
        <div className="empty-content-card">
          <div>⚠️</div>
          <strong>No content found</strong>
          <span>Update your search or filters to find the content you want.</span>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <div className="pager-summary">Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, filteredContent.length)} of {filteredContent.length}</div>
          <div className="pager-buttons">
            <button className="pager-button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            {Array.from({ length: totalPages }, (_, index) => (
              <button key={index} className={`pager-button ${page === index + 1 ? 'active' : ''}`} onClick={() => setPage(index + 1)}>{index + 1}</button>
            ))}
            <button className="pager-button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
          </div>
        </div>
      )}
    </>
  );
}
