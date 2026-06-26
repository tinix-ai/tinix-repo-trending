"use client";

import { useState, useEffect } from "react";
import type { RankedProject } from "@/types";
import { X, ArrowUp, ArrowDown, FolderPlus, Loader2, Check } from "lucide-react";
import { actionCreateCollection } from "@/app/actions";
import { useRouter } from "@/i18n/routing";
import { useComparison } from "@/hooks/use-comparison";

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProjects: RankedProject[];
}

export function CollectionModal({ isOpen, onClose, selectedProjects }: CollectionModalProps) {
  const router = useRouter();
  const { clearProjects } = useComparison();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projects, setProjects] = useState<RankedProject[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  // Sync projects on open
  useEffect(() => {
    if (isOpen) {
      setProjects([...selectedProjects]);
      setTitle(`Top ${selectedProjects.length} nguồn mở hay nhất về ...`);
      setDescription("");
      setNotes({});
      setError(null);
      setSavedSlug(null);
    }
  }, [isOpen, selectedProjects]);

  if (!isOpen) return null;

  const moveProject = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= projects.length) return;

    const list = [...projects];
    const temp = list[index];
    list[index] = list[nextIndex];
    list[nextIndex] = temp;
    setProjects(list);
  };

  const handleNoteChange = (projectId: string, val: string) => {
    setNotes((prev) => ({ ...prev, [projectId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề cho bộ sưu tập!");
      return;
    }
    if (projects.length === 0) {
      setError("Bộ sưu tập phải chứa ít nhất 1 dự án!");
      return;
    }

    setLoading(true);
    setError(null);

    const projectIds = projects.map((p) => p.id);
    const projectNotes = projects.map((p) => notes[p.id] || "");

    try {
      const res = await actionCreateCollection(title.trim(), description.trim(), projectIds, projectNotes);
      if (res.success && res.slug) {
        setSavedSlug(res.slug);
        clearProjects(); // Clear selections
        setTimeout(() => {
          router.push(`/collection/${res.slug}`);
          onClose();
        }, 1500);
      } else {
        setError(res.error || "Có lỗi xảy ra khi tạo bộ sưu tập.");
      }
    } catch (err) {
      console.error(err);
      setError("Không thể kết nối đến server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={loading ? undefined : onClose}></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#1C1C1E] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-divider-soft)] shrink-0">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-[var(--color-action-blue)]" />
            <h3 className="text-[17px] font-semibold text-[var(--color-ink)]">
              Tạo bộ sưu tập (Collection)
            </h3>
          </div>
          {!loading && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[var(--color-surface-pearl)] transition-colors text-[var(--color-ink-muted-80)]"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Form Body */}
        {savedSlug ? (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 flex-1">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-[var(--color-ink)]">Đã lưu bộ sưu tập thành công!</h4>
            <p className="text-sm text-[var(--color-ink-muted-80)]">Đang chuyển hướng bạn đến trang bộ sưu tập của bạn...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-xl">
                {error}
              </div>
            )}

            {/* Inputs */}
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)]">
                  Tiêu đề bộ sưu tập *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Top 5 mô hình LLM tốt nhất tuần"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading}
                  className="w-full h-10 px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted-48)] focus:border-[var(--color-action-blue)] outline-none transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)]">
                  Mô tả bộ sưu tập
                </label>
                <textarea
                  placeholder="Thêm mô tả về chủ đề hoặc lý do bạn lập danh sách này..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                  rows={2}
                  className="w-full p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted-48)] focus:border-[var(--color-action-blue)] outline-none transition-colors resize-none"
                />
              </div>
            </div>

            {/* Project Curation */}
            <div className="flex-1 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)] block mb-1">
                Sắp xếp vị trí & Nhận xét dự án ({projects.length} dự án)
              </span>

              <div className="space-y-3">
                {projects.map((project, index) => (
                  <div
                    key={project.id}
                    className="flex flex-col gap-2.5 p-4 rounded-xl border border-[var(--color-divider-soft)] bg-slate-50/50 dark:bg-slate-900/20"
                  >
                    <div className="flex items-center justify-between">
                      {/* Name and Rank */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-sm font-bold text-[var(--color-action-blue)] select-none shrink-0 w-6 h-6 rounded-full bg-[var(--color-action-blue)]/10 flex items-center justify-center">
                          {index + 1}
                        </span>
                        <img
                          src={project.ownerAvatarUrl || ""}
                          alt={project.fullName}
                          className="w-6 h-6 rounded-md object-cover border border-[var(--color-border)] bg-white shrink-0"
                        />
                        <span className="text-sm font-bold text-[var(--color-ink)] truncate">
                          {project.fullName}
                        </span>
                      </div>

                      {/* Move controls */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={index === 0 || loading}
                          onClick={() => moveProject(index, "up")}
                          className="p-1 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-divider-soft)] text-[var(--color-ink-muted-80)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === projects.length - 1 || loading}
                          onClick={() => moveProject(index, "down")}
                          className="p-1 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-divider-soft)] text-[var(--color-ink-muted-80)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Personal comments */}
                    <input
                      type="text"
                      placeholder="Lý do dự án này xuất sắc? (Ví dụ: Thư viện nhẹ, hiệu năng tốt...)"
                      value={notes[project.id] || ""}
                      onChange={(e) => handleNoteChange(project.id, e.target.value)}
                      disabled={loading}
                      className="w-full h-8 px-2.5 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted-48)] focus:border-[var(--color-action-blue)] outline-none transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Buttons inside Form */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-divider-soft)] bg-white dark:bg-[#1C1C1E] shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[var(--color-ink)] transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-sm font-bold rounded-xl bg-[var(--color-action-blue)] hover:bg-[var(--color-accent-hover)] text-white transition-all shadow-md shadow-blue-500/10 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang tạo...
                  </>
                ) : (
                  <>Lưu & Xuất bản</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
