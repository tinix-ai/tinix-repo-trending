"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Link2,
  ImagePlus,
  Undo,
  Redo,
} from "lucide-react";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

interface EditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function BlogEditor({ content, onChange, placeholder }: EditorProps) {
  const t = useTranslations("Blog");
  const resolvedPlaceholder = placeholder || t("editorPlaceholder");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-[var(--color-primary)] hover:underline cursor-pointer",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-xl max-w-full my-6 mx-auto hover:shadow-md transition-shadow",
        },
      }),
      Placeholder.configure({
        placeholder: resolvedPlaceholder,
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[400px] text-[var(--color-ink)] font-serif py-4 leading-relaxed",
      },
    },
  });

  // Keep content in sync if changed from props (e.g. loading async data)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return (
      <div className="h-64 border border-[var(--color-divider-soft)] rounded-xl flex items-center justify-center text-[var(--color-ink-muted)] animate-pulse">
        {t("editorLoading")}
      </div>
    );
  }

  const addLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt(t("promptUrl"), previousUrl);

    if (url === null) {
      return;
    }

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt(t("promptImageUrl"));
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="border border-[var(--color-divider-soft)] rounded-xl overflow-hidden bg-[var(--color-canvas)] focus-within:border-[var(--color-primary)]/50 transition-colors">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-[var(--color-bg-secondary)]/50 border-b border-[var(--color-divider-soft)] shrink-0 select-none">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors ${
            editor.isActive("bold") ? "bg-[var(--color-bg-secondary)] !text-[var(--color-primary)] font-bold" : ""
          }`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors ${
            editor.isActive("italic") ? "bg-[var(--color-bg-secondary)] !text-[var(--color-primary)] italic" : ""
          }`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-6 bg-[var(--color-divider-soft)] mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors ${
            editor.isActive("heading", { level: 1 }) ? "bg-[var(--color-bg-secondary)] !text-[var(--color-primary)]" : ""
          }`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors ${
            editor.isActive("heading", { level: 2 }) ? "bg-[var(--color-bg-secondary)] !text-[var(--color-primary)]" : ""
          }`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-6 bg-[var(--color-divider-soft)] mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors ${
            editor.isActive("bulletList") ? "bg-[var(--color-bg-secondary)] !text-[var(--color-primary)]" : ""
          }`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors ${
            editor.isActive("orderedList") ? "bg-[var(--color-bg-secondary)] !text-[var(--color-primary)]" : ""
          }`}
          title="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors ${
            editor.isActive("blockquote") ? "bg-[var(--color-bg-secondary)] !text-[var(--color-primary)]" : ""
          }`}
          title="Blockquote"
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-6 bg-[var(--color-divider-soft)] mx-1" />

        <button
          type="button"
          onClick={addLink}
          className={`p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors ${
            editor.isActive("link") ? "bg-[var(--color-bg-secondary)] !text-[var(--color-primary)]" : ""
          }`}
          title="Add Link"
        >
          <Link2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={addImage}
          className="p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors"
          title="Add Image"
        >
          <ImagePlus className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-6 bg-[var(--color-divider-soft)] mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="px-6 py-4">
        <EditorContent editor={editor} />
      </div>

      {/* Basic global styles override inside container */}
      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--color-ink-muted);
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .ProseMirror {
          min-height: 400px;
        }
        .prose blockquote {
          border-left: 4px solid var(--color-primary);
          padding-left: 1.5rem;
          font-style: italic;
          color: var(--color-ink-muted);
        }
        .prose img {
          max-width: 100%;
          border-radius: 0.75rem;
        }
      `}</style>
    </div>
  );
}
