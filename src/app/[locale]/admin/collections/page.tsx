'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FolderHeart, Plus, X, Calendar, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/routing';

interface Collection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  createdAt: string;
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/collections');
      if (res.ok) {
        const data = await res.json();
        setCollections(data);
      }
    } catch (error) {
      toast.error('Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCollections();
  }, []);

  // Handle Dialog native methods
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isModalOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
    
    const handleCancel = (e: Event) => {
      e.preventDefault();
      setIsModalOpen(false);
    };
    
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [isModalOpen]);

  const autoGenerateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    if (!slug || slug === autoGenerateSlug(title)) {
      setSlug(autoGenerateSlug(e.target.value));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !slug) {
      toast.error('Title and slug are required');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug, description }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create collection');
      }
      
      toast.success('Collection created successfully');
      setIsModalOpen(false);
      setTitle('');
      setSlug('');
      setDescription('');
      fetchCollections();
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('An error occurred');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete collection "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/collections/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Collection deleted');
        fetchCollections();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (e) {
      if (e instanceof Error) {
        toast.error(e.message);
      } else {
        toast.error('An error occurred');
      }
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink)] tracking-tight flex items-center gap-2">
            <FolderHeart className="text-[var(--color-ink-muted-64)]" size={20} />
            Collections
          </h1>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-ink)] text-[var(--color-canvas)] rounded-full text-[13px] font-medium hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[var(--color-action-blue)] focus:ring-offset-2 focus:ring-offset-[var(--color-canvas)]"
        >
          <Plus size={16} />
          Create Collection
        </button>
      </div>

      <div className="apple-utility-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--color-ink-muted-48)] text-[13px]">Loading collections...</div>
        ) : collections.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-tile-1)] border border-[var(--color-divider-soft)] flex items-center justify-center mb-4">
              <FolderHeart className="text-[var(--color-ink-muted-48)]" size={20} />
            </div>
            <h3 className="text-[15px] font-medium text-[var(--color-ink)] mb-1">No collections yet</h3>
            <p className="text-[13px] text-[var(--color-ink-muted-48)] mb-6 max-w-sm">
              Create your first collection to start curating amazing repositories for your users.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-[var(--color-surface-tile-1)] border border-[var(--color-divider-soft)] rounded-md text-[13px] font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-elevated)] transition-colors"
            >
              Create Collection
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-divider-soft)] bg-[var(--color-surface-chip-translucent)]">
                  <th className="px-5 py-3 text-[11px] font-semibold text-[var(--color-ink-muted-48)] uppercase tracking-wider">Title</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[var(--color-ink-muted-48)] uppercase tracking-wider">Slug</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[var(--color-ink-muted-48)] uppercase tracking-wider">Created</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-[var(--color-ink-muted-48)] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((col) => (
                  <tr key={col.id} className="border-b border-[var(--color-divider-soft)] hover:bg-[var(--color-surface-tile-1)]/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="text-[14px] font-medium text-[var(--color-ink)]">{col.title}</div>
                      {col.description && (
                        <div className="text-[12px] text-[var(--color-ink-muted-48)] mt-0.5 max-w-md truncate">
                          {col.description}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <code className="text-[12px] px-2 py-1 bg-[var(--color-surface-tile-1)] border border-[var(--color-divider-soft)] rounded text-[var(--color-ink-muted-80)] font-mono">
                        /{col.slug}
                      </code>
                    </td>
                    <td className="px-5 py-4 text-[13px] text-[var(--color-ink-muted-64)] flex items-center gap-1.5">
                      <Calendar size={12} className="text-[var(--color-ink-muted-48)]" />
                      {new Date(col.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link 
                          href={`/admin/collections/${col.id}`}
                          className="p-1.5 text-[var(--color-ink-muted-48)] hover:text-[var(--color-action-blue)] hover:bg-[var(--color-action-blue)]/10 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-action-blue)]"
                          aria-label={`Edit ${col.title}`}
                        >
                          <Edit2 size={15} />
                        </Link>
                        <button 
                          onClick={() => handleDelete(col.id, col.title)}
                          className="p-1.5 text-[var(--color-ink-muted-48)] hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                          aria-label={`Delete ${col.title}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Accessible Modal */}
      <dialog 
        ref={dialogRef}
        aria-labelledby="modal-title"
        aria-describedby="modal-desc"
        className="fixed inset-0 m-auto p-0 rounded-2xl bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm open:animate-in open:fade-in open:zoom-in-95 w-full max-w-lg outline-none"
      >
        <form onSubmit={handleCreate} className="flex flex-col">
          <div className="px-6 py-4 border-b border-[var(--color-divider-soft)] flex justify-between items-center">
            <div>
              <h2 id="modal-title" className="text-[17px] font-semibold text-[var(--color-ink)]">Create New Collection</h2>
              <p id="modal-desc" className="text-[13px] text-[var(--color-ink-muted-48)] mt-0.5">Define a group of repositories for users to discover.</p>
            </div>
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="p-1.5 text-[var(--color-ink-muted-48)] hover:bg-[var(--color-surface-tile-1)] rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)]"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="p-6 flex flex-col gap-5">
            <div>
              <label htmlFor="title" className="block text-[13px] font-medium text-[var(--color-ink)] mb-1.5">Collection Title <span className="text-red-500">*</span></label>
              <input 
                id="title"
                type="text" 
                value={title}
                onChange={handleTitleChange}
                placeholder="e.g. Top AI Agents in 2026"
                className="w-full px-3 py-2 bg-[var(--color-surface-tile-1)] border border-[var(--color-divider-soft)] rounded-lg text-[14px] text-[var(--color-ink)] placeholder-[var(--color-ink-muted-24)] focus:outline-none focus:border-[var(--color-ink-muted-48)] focus:ring-1 focus:ring-[var(--color-ink-muted-48)] transition-all"
                required
                autoFocus
              />
            </div>
            
            <div>
              <label htmlFor="slug" className="block text-[13px] font-medium text-[var(--color-ink)] mb-1.5">URL Slug <span className="text-red-500">*</span></label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-[var(--color-divider-soft)] bg-[var(--color-surface-elevated)] rounded-l-lg text-[13px] text-[var(--color-ink-muted-48)]">
                  /collections/
                </span>
                <input 
                  id="slug"
                  type="text" 
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="top-ai-agents"
                  className="w-full px-3 py-2 bg-[var(--color-surface-tile-1)] border border-[var(--color-divider-soft)] rounded-r-lg text-[14px] text-[var(--color-ink)] font-mono focus:outline-none focus:border-[var(--color-ink-muted-48)] focus:ring-1 focus:ring-[var(--color-ink-muted-48)] transition-all"
                  required
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="description" className="block text-[13px] font-medium text-[var(--color-ink)] mb-1.5">Description (Optional)</label>
              <textarea 
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what this collection is about..."
                rows={3}
                className="w-full px-3 py-2 bg-[var(--color-surface-tile-1)] border border-[var(--color-divider-soft)] rounded-lg text-[14px] text-[var(--color-ink)] placeholder-[var(--color-ink-muted-24)] focus:outline-none focus:border-[var(--color-ink-muted-48)] focus:ring-1 focus:ring-[var(--color-ink-muted-48)] transition-all resize-none"
              />
            </div>
          </div>
          
          <div className="px-6 py-4 border-t border-[var(--color-divider-soft)] bg-[var(--color-surface-chip-translucent)] flex justify-end gap-3 rounded-b-2xl">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-[13px] font-medium text-[var(--color-ink-muted-80)] hover:bg-[var(--color-surface-tile-1)] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)]"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-4 py-2 bg-[var(--color-ink)] text-[var(--color-canvas)] rounded-lg text-[13px] font-medium hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[var(--color-action-blue)] focus:ring-offset-2 focus:ring-offset-[var(--color-canvas)] disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Collection'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
