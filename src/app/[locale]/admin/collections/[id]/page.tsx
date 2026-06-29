'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Save, Search, Plus, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/routing';

interface Project {
  id: string;
  projectId: string;
  fullName: string;
  description: string | null;
  source: string;
  sortOrder: number;
  notes: string | null;
}

interface Collection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
}

export default function CollectionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Edit Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchCollection = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/collections/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCollection(data.collection);
        setTitle(data.collection.title);
        setSlug(data.collection.slug);
        setDescription(data.collection.description || '');
        setProjects(data.projects || []);
      } else {
        toast.error('Collection not found');
        router.push('/admin/collections');
      }
    } catch (error) {
      toast.error('Failed to load collection');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (id) fetchCollection();
  }, [id, fetchCollection]);

  // Handle Search Debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/admin/projects/search?q=${encodeURIComponent(searchQuery)}`);
          if (res.ok) {
            setSearchResults(await res.json());
          }
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleUpdateMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/collections/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug, description }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Collection updated');
    } catch (error) {
      toast.error('Update failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProject = async (projectId: string) => {
    // Check if already in collection
    if (projects.some(p => p.projectId === projectId)) {
      toast.error('Project already in collection');
      return;
    }
    
    try {
      const res = await fetch(`/api/admin/collections/${id}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          sortOrder: projects.length, // Add to end
        }),
      });
      
      if (!res.ok) throw new Error('Failed to add project');
      toast.success('Project added');
      setSearchQuery('');
      setSearchResults([]);
      fetchCollection();
    } catch (error) {
      toast.error('Failed to add project');
    }
  };

  const handleRemoveProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/admin/collections/${id}/projects?projectId=${projectId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove');
      toast.success('Project removed');
      fetchCollection();
    } catch (error) {
      toast.error('Failed to remove project');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === projects.length - 1)
    ) return;
    
    const newProjects = [...projects];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap elements
    [newProjects[index], newProjects[targetIndex]] = [newProjects[targetIndex], newProjects[index]];
    
    // Update sortOrder values
    const updatedItems = newProjects.map((p, i) => ({
      id: p.id,
      sortOrder: i,
    }));
    
    // Optimistic UI update
    const prevProjects = [...projects];
    setProjects(newProjects.map((p, i) => ({ ...p, sortOrder: i })));
    
    try {
      const res = await fetch(`/api/admin/collections/${id}/projects`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updatedItems }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to reorder');
      }
    } catch (error) {
      toast.error('Failed to save order');
      setProjects(prevProjects); // Revert on failure
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-[var(--color-ink-muted-48)]">Loading collection...</div>;
  }

  if (!collection) return null;

  return (
    <div className="w-full max-w-5xl mx-auto pb-20">
      <div className="mb-6">
        <Link href="/admin/collections" className="inline-flex items-center gap-1 text-[13px] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-action-blue)] rounded">
          <ChevronLeft size={16} />
          Back to Collections
        </Link>
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-[var(--color-ink)] tracking-tight flex items-center gap-2">
            Edit Collection
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Metadata Edit */}
        <div className="lg:col-span-1">
          <div className="apple-utility-card sticky top-24">
            <div className="px-5 py-4 border-b border-[var(--color-divider-soft)]">
              <h2 className="text-[14px] font-semibold text-[var(--color-ink)]">Details</h2>
            </div>
            <form onSubmit={handleUpdateMeta} className="p-5 flex flex-col gap-4">
              <div>
                <label htmlFor="title" className="block text-[13px] font-medium text-[var(--color-ink)] mb-1.5">Title</label>
                <input 
                  id="title"
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-surface-tile-1)] border border-[var(--color-divider-soft)] rounded-lg text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-ink-muted-48)] focus:ring-1 focus:ring-[var(--color-ink-muted-48)] transition-all"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="slug" className="block text-[13px] font-medium text-[var(--color-ink)] mb-1.5">Slug</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2 border border-r-0 border-[var(--color-divider-soft)] bg-[var(--color-surface-elevated)] rounded-l-lg text-[12px] text-[var(--color-ink-muted-48)]">
                    /
                  </span>
                  <input 
                    id="slug"
                    type="text" 
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-2 py-2 bg-[var(--color-surface-tile-1)] border border-[var(--color-divider-soft)] rounded-r-lg text-[13px] text-[var(--color-ink)] font-mono focus:outline-none focus:border-[var(--color-ink-muted-48)] focus:ring-1 focus:ring-[var(--color-ink-muted-48)] transition-all"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="description" className="block text-[13px] font-medium text-[var(--color-ink)] mb-1.5">Description</label>
                <textarea 
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-[var(--color-surface-tile-1)] border border-[var(--color-divider-soft)] rounded-lg text-[13px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-ink-muted-48)] focus:ring-1 focus:ring-[var(--color-ink-muted-48)] transition-all resize-none"
                />
              </div>
              
              <button 
                type="submit" 
                disabled={isSaving}
                className="mt-2 flex items-center justify-center gap-2 w-full py-2 bg-[var(--color-ink)] text-[var(--color-canvas)] rounded-lg text-[13px] font-medium hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[var(--color-action-blue)] focus:ring-offset-2 focus:ring-offset-[var(--color-canvas)] disabled:opacity-50"
              >
                <Save size={14} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Projects List */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Search & Add Project */}
          <div className="apple-utility-card p-5 relative overflow-visible">
            <h2 className="text-[14px] font-semibold text-[var(--color-ink)] mb-3">Add Projects</h2>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-[var(--color-ink-muted-48)]" />
              </div>
              <input
                type="text"
                placeholder="Search repositories to add..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-surface-tile-1)] border border-[var(--color-divider-soft)] rounded-lg text-[14px] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)] transition-all"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <div className="w-4 h-4 border-2 border-[var(--color-ink-muted-24)] border-t-[var(--color-action-blue)] rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute z-50 left-5 right-5 mt-2 bg-[var(--color-surface-elevated)] border border-[var(--color-divider-soft)] rounded-lg shadow-xl overflow-hidden max-h-[300px] overflow-y-auto">
                {searchResults.map((res) => {
                  const isAdded = projects.some(p => p.projectId === res.id);
                  return (
                    <div 
                      key={res.id} 
                      className={`px-4 py-3 border-b border-[var(--color-divider-soft)] last:border-b-0 flex justify-between items-center transition-colors ${isAdded ? 'opacity-50 bg-[var(--color-surface-tile-1)]' : 'hover:bg-[var(--color-surface-tile-1)] cursor-pointer'}`}
                      onClick={() => !isAdded && handleAddProject(res.id)}
                    >
                      <div className="overflow-hidden">
                        <div className="text-[13px] font-medium text-[var(--color-ink)] truncate">{res.fullName}</div>
                        {res.description && (
                          <div className="text-[12px] text-[var(--color-ink-muted-64)] truncate mt-0.5">{res.description}</div>
                        )}
                      </div>
                      {!isAdded && (
                        <button className="flex-shrink-0 ml-3 p-1.5 text-[var(--color-action-blue)] hover:bg-[var(--color-action-blue)]/10 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-action-blue)]">
                          <Plus size={16} />
                        </button>
                      )}
                      {isAdded && (
                        <span className="flex-shrink-0 ml-3 text-[11px] font-semibold text-[var(--color-ink-muted-48)]">ADDED</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
              <div className="absolute z-50 left-5 right-5 mt-2 bg-[var(--color-surface-elevated)] border border-[var(--color-divider-soft)] rounded-lg shadow-xl p-4 text-center text-[13px] text-[var(--color-ink-muted-48)]">
                No repositories found matching &quot;{searchQuery}&quot;
              </div>
            )}
          </div>

          {/* Project List */}
          <div className="apple-utility-card">
            <div className="px-5 py-4 border-b border-[var(--color-divider-soft)] flex justify-between items-center">
              <h2 className="text-[14px] font-semibold text-[var(--color-ink)]">Curated List ({projects.length})</h2>
            </div>
            
            {projects.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center">
                <FileText className="text-[var(--color-ink-muted-24)] mb-3" size={32} />
                <p className="text-[14px] text-[var(--color-ink-muted-64)]">No projects in this collection.</p>
                <p className="text-[13px] text-[var(--color-ink-muted-48)] mt-1">Search and add repositories above.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {projects.map((proj, index) => (
                  <div key={proj.id} className="group px-4 py-3 border-b border-[var(--color-divider-soft)] last:border-b-0 flex items-center gap-3 hover:bg-[var(--color-surface-tile-1)]/50 transition-colors">
                    {/* Drag Handle & Order */}
                    <div className="flex flex-col items-center justify-center gap-1 text-[var(--color-ink-muted-48)] w-6">
                      <button 
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        className="p-0.5 hover:text-[var(--color-ink)] disabled:opacity-30 disabled:hover:text-[var(--color-ink-muted-48)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)] rounded"
                        aria-label="Move up"
                      >
                        <ChevronLeft size={16} className="rotate-90" />
                      </button>
                      <span className="text-[10px] font-mono leading-none">{index + 1}</span>
                      <button 
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === projects.length - 1}
                        className="p-0.5 hover:text-[var(--color-ink)] disabled:opacity-30 disabled:hover:text-[var(--color-ink-muted-48)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)] rounded"
                        aria-label="Move down"
                      >
                        <ChevronLeft size={16} className="-rotate-90" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-[var(--color-ink)] truncate">
                        {proj.fullName}
                      </div>
                      <div className="text-[12px] text-[var(--color-ink-muted-64)] truncate mt-0.5">
                        {proj.source} {proj.description ? `· ${proj.description}` : ''}
                      </div>
                    </div>

                    <button 
                      onClick={() => handleRemoveProject(proj.projectId)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-[var(--color-ink-muted-48)] hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label="Remove project"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
