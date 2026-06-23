"use client";

import { useState } from "react";
import { Plus, Trash2, Edit, Save, RefreshCw, Tag, Folder, Sparkles } from "lucide-react";
import { saveCategory, deleteCategory, reCategorizeAllProjects } from "@/app/actions";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface Category {
  id: string;
  icon: string;
  color: string;
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface CategoriesManagerProps {
  initialCategories: Category[];
}

const PRESET_COLORS = [
  "#3b82f6", // Electric Blue
  "#10b981", // Acid Green
  "#f97316", // Signal Orange
  "#06b6d4", // Cyan
  "#14b8a6", // Teal
  "#ef4444", // Red
  "#f59e0b", // Yellow/Amber
  "#64748b", // Slate Grey
];

const PRESET_EMOJIS = [
  "🧠", "🤖", "🔍", "👁️", "🎙️", "🏋️", "📊", "🛠️", "🎨", "⚙️", "🚀", "📦", "📂", "💻", "🌐", "📱", "🔐", "💾"
];

export function CategoriesManager({ initialCategories }: CategoriesManagerProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  
  // Form State
  const [id, setId] = useState("");
  const [icon, setIcon] = useState("🧠");
  const [color, setColor] = useState("#3b82f6");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isReCategorizing, setIsReCategorizing] = useState(false);
  
  const t = useTranslations("Admin");

  // Load category details into editor form
  const handleEditSelect = (cat: Category) => {
    setSelectedCategory(cat);
    setId(cat.id);
    setIcon(cat.icon);
    setColor(cat.color);
    setKeywords(cat.keywords || []);
    setTagInput("");
  };

  // Clear form for creating new category
  const handleCreateNew = () => {
    setSelectedCategory(null);
    setId("");
    setIcon("🧠");
    setColor("#3b82f6");
    setKeywords([]);
    setTagInput("");
  };

  // Add keyword tag from input
  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setTagInput("");
    }
  };

  // Keypress handler for tag input (Enter or Comma)
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setKeywords(keywords.filter(k => k !== tagToRemove));
  };

  // Save changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim()) {
      toast.error(t("categoryName") + " is required");
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveCategory(id, { icon, color, keywords });
      if (res.success) {
        toast.success(t("saveSuccess"));
        
        // Refresh local categories state
        const updatedCats = [...categories];
        const existingIdx = updatedCats.findIndex(c => c.id === id);
        
        const newCatObj: Category = {
          id: id.trim(),
          icon,
          color,
          keywords,
          createdAt: existingIdx !== -1 ? updatedCats[existingIdx].createdAt : new Date(),
          updatedAt: new Date()
        };

        if (existingIdx !== -1) {
          updatedCats[existingIdx] = newCatObj;
        } else {
          updatedCats.push(newCatObj);
        }
        
        setCategories(updatedCats.sort((a, b) => a.id.localeCompare(b.id)));
        handleEditSelect(newCatObj);
      } else {
        toast.error(res.error || "Failed to save category");
      }
    } catch (err) {
      toast.error("Error occurred while saving");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Category
  const handleDelete = async (catId: string) => {
    if (!confirm(t("deleteConfirm"))) return;

    try {
      const res = await deleteCategory(catId);
      if (res.success) {
        toast.success(t("deleteSuccess"));
        setCategories(categories.filter(c => c.id !== catId));
        if (selectedCategory?.id === catId) {
          handleCreateNew();
        }
      } else {
        toast.error(res.error || "Failed to delete category");
      }
    } catch (err) {
      toast.error("Error occurred while deleting");
      console.error(err);
    }
  };

  // Run Batch Re-categorization
  const handleReCategorize = async () => {
    if (!confirm(t("reCategorizeConfirm"))) return;

    setIsReCategorizing(true);
    toast.info(t("reCategorizeRunning"));

    try {
      const res = await reCategorizeAllProjects();
      if (res.success) {
        toast.success(t("reCategorizeSuccess", { count: res.count ?? 0 }));
      } else {
        toast.error(res.error || "Failed to re-categorize projects");
      }
    } catch (err) {
      toast.error("Error occurred while re-categorizing");
      console.error(err);
    } finally {
      setIsReCategorizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Control Panel */}
      <div className="apple-utility-card flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--color-surface-tile-1)] border border-[var(--color-divider-soft)]">
        <div>
          <h3 className="text-apple-body-strong text-[var(--color-ink)] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
            {t("reCategorizeBtn")}
          </h3>
          <p className="text-xs text-[var(--color-ink-muted-48)] mt-1">
            Chạy lại bộ phân loại tự động cho toàn bộ cơ sở dữ liệu dựa trên danh mục/từ khóa hiện tại.
          </p>
        </div>
        <button
          onClick={handleReCategorize}
          disabled={isReCategorizing}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium text-sm rounded-lg transition-all shadow-md shadow-emerald-500/10 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isReCategorizing ? 'animate-spin' : ''}`} />
          {isReCategorizing ? t("reCategorizeRunning") : t("reCategorizeBtn")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Categories List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-apple-body-strong text-[var(--color-ink)] flex items-center gap-2">
              <Folder className="w-4 h-4 text-[var(--color-ink-muted-48)]" />
              {t("categoryList")} ({categories.length})
            </h3>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("addCategory")}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
            {categories.map((cat) => {
              const isSelected = selectedCategory?.id === cat.id;
              return (
                <div
                  key={cat.id}
                  onClick={() => handleEditSelect(cat)}
                  className={`apple-utility-card relative flex flex-col justify-between p-5 border cursor-pointer transition-all hover:translate-y-[-2px] hover:shadow-md ${
                    isSelected 
                      ? "bg-[var(--color-canvas)]" 
                      : "bg-[var(--color-surface-tile-1)]"
                  }`}
                  style={{ 
                    borderColor: isSelected ? cat.color : "var(--color-divider-soft)",
                    borderWidth: isSelected ? "1.5px" : "1px"
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-lg select-none"
                          style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                        >
                          {cat.icon}
                        </div>
                        <span className="font-semibold text-sm text-[var(--color-ink)]">{cat.id}</span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditSelect(cat);
                          }}
                          className="p-1 hover:text-blue-500 transition-colors"
                          title={t("editCategory")}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(cat.id);
                          }}
                          className="p-1 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2 max-h-[80px] overflow-y-auto pr-1">
                      {cat.keywords && cat.keywords.length > 0 ? (
                        cat.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-surface-tile-2)] text-[var(--color-ink-muted-80)] border border-[var(--color-divider-soft)]"
                          >
                            {kw}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-[var(--color-ink-muted-48)] italic">
                          {t("noKeywords")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-[9px] text-[var(--color-ink-muted-48)] mt-4 text-right">
                    {cat.keywords ? cat.keywords.length : 0} keywords
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Editor Form */}
        <div className="lg:col-span-5">
          <div className="apple-utility-card bg-[var(--color-surface-tile-1)] border border-[var(--color-divider-soft)] p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--color-divider-soft)]">
              <h3 className="text-apple-body-strong text-[var(--color-ink)] flex items-center gap-2">
                <Edit className="w-4 h-4 text-blue-500" />
                {selectedCategory ? t("editCategory") : t("addCategory")}
              </h3>
              {selectedCategory && (
                <button
                  onClick={handleCreateNew}
                  className="text-xs text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)] cursor-pointer"
                >
                  Reset Form
                </button>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              {/* Category ID / Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--color-ink-muted-80)] block">
                  {t("categoryName")}
                </label>
                <input
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  disabled={!!selectedCategory}
                  className="w-full px-3 py-2 bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-divider-soft)] rounded-lg text-sm focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                  placeholder="e.g. Vibe Coding"
                  required
                />
                {selectedCategory && (
                  <p className="text-[10px] text-[var(--color-ink-muted-48)]">
                    Tên danh mục đóng vai trò làm định danh (ID) không thể thay đổi sau khi tạo.
                  </p>
                )}
              </div>

              {/* Emoji Icon Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--color-ink-muted-80)] block">
                  {t("categoryIcon")}
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] rounded-lg flex items-center justify-center text-2xl select-none">
                    {icon}
                  </div>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-20 px-3 py-2 bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-divider-soft)] rounded-lg text-center text-sm focus:outline-none focus:border-blue-500"
                    maxLength={2}
                  />
                  <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto p-1 bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] rounded-lg flex-1">
                    {PRESET_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setIcon(emoji)}
                        className="w-6 h-6 flex items-center justify-center text-sm rounded hover:bg-[var(--color-surface-tile-2)] cursor-pointer select-none"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Color Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--color-ink-muted-80)] block">
                  {t("categoryColor")}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-10 border-0 bg-transparent cursor-pointer rounded-lg overflow-hidden"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-28 px-3 py-2 bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-divider-soft)] rounded-lg text-sm focus:outline-none focus:border-blue-500 font-mono"
                    maxLength={7}
                    placeholder="#3b82f6"
                  />
                  <div className="flex flex-wrap gap-1 flex-1">
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setColor(preset)}
                        className="w-6 h-6 rounded-full border border-zinc-800 transition-transform hover:scale-110 cursor-pointer"
                        style={{ backgroundColor: preset }}
                        title={preset}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Tag Input for Keywords */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--color-ink-muted-80)] block flex justify-between items-center">
                  <span>{t("categoryKeywords")}</span>
                  <span className="text-[10px] text-[var(--color-ink-muted-48)] font-normal">
                    {keywords.length} tags
                  </span>
                </label>
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      className="w-full pl-8 pr-3 py-2 bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-divider-soft)] rounded-lg text-sm focus:outline-none focus:border-blue-500"
                      placeholder={t("keywordsHelp")}
                    />
                    <Tag className="w-4 h-4 absolute left-2.5 top-3 text-[var(--color-ink-muted-48)]" />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-[var(--color-surface-tile-2)] hover:bg-[var(--color-surface-tile-3)] border border-[var(--color-divider-soft)] text-sm font-medium rounded-lg text-[var(--color-ink)] transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 p-3 min-h-[100px] max-h-[180px] overflow-y-auto bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] rounded-lg">
                  {keywords.length > 0 ? (
                    keywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-tile-1)] text-[var(--color-ink)] border border-[var(--color-divider-soft)]"
                      >
                        <span className="font-mono">{kw}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(kw)}
                          className="w-3.5 h-3.5 rounded-full hover:bg-[var(--color-surface-tile-3)] flex items-center justify-center text-[var(--color-ink-muted-48)] hover:text-red-500 font-semibold select-none cursor-pointer"
                        >
                          &times;
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[var(--color-ink-muted-48)] italic p-1">
                      {t("keywordsHelp")} (e.g. vibe-coding, mcp)
                    </span>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : t("saveSuccess").replace(" thành công!", "")}
                </button>
                {selectedCategory && (
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="px-4 py-2.5 bg-[var(--color-surface-tile-2)] hover:bg-[var(--color-surface-tile-3)] border border-[var(--color-divider-soft)] text-sm font-medium rounded-lg text-[var(--color-ink)] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
