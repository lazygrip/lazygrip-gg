'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Strikethrough, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Code2, Link as LinkIcon,
  Minus, Undo, Redo,
} from 'lucide-react'
import { useEffect } from 'react'

interface TiptapEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function TiptapEditor({ content, onChange, placeholder }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Write your description...',
      }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: { class: 'tiptap-editor-content' },
    },
    immediatelyRender: false,
  })

  // Sync external content changes (for editing existing posts)
  useEffect(() => {
    if (editor && content && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [content, editor])

  if (!editor) {
    return (
      <div style={{ minHeight: 280, padding: 14, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8 }}>
        Loading editor...
      </div>
    )
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL (leave empty to remove):', previousUrl || 'https://')
    if (url === null) return
    if (url === '' || url === 'https://') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div
      style={{
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 8,
        background: 'var(--bg-primary, #fff)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 2,
          padding: 6,
          borderBottom: '1px solid var(--border, #e5e7eb)',
          background: 'var(--bg-secondary, #f9fafb)',
        }}
      >
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough size={14} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 size={14} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote size={14} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Inline code"
        >
          <Code size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="Code block"
        >
          <Code2 size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={setLink}
          active={editor.isActive('link')}
          title="Link"
        >
          <LinkIcon size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Divider line"
        >
          <Minus size={14} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          <Redo size={14} />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      <style jsx global>{`
        .tiptap-editor-content {
          min-height: 280px;
          padding: 14px 16px;
          font-size: 15px;
          line-height: 1.65;
          color: var(--text-primary, #111827);
          outline: none;
        }
        .tiptap-editor-content p { margin: 0 0 12px 0; }
        .tiptap-editor-content p:last-child { margin-bottom: 0; }
        .tiptap-editor-content h2 {
          font-size: 20px;
          font-weight: 600;
          margin: 20px 0 10px 0;
          color: var(--text-primary, #111827);
        }
        .tiptap-editor-content h3 {
          font-size: 17px;
          font-weight: 600;
          margin: 16px 0 8px 0;
          color: var(--text-primary, #111827);
        }
        .tiptap-editor-content ul,
        .tiptap-editor-content ol {
          padding-left: 24px;
          margin: 0 0 12px 0;
        }
        .tiptap-editor-content li { margin: 4px 0; }
        .tiptap-editor-content li p { margin: 0; }
        .tiptap-editor-content blockquote {
          border-left: 3px solid var(--accent, #10b981);
          padding-left: 14px;
          margin: 12px 0;
          color: var(--text-secondary, #6b7280);
        }
        .tiptap-editor-content code {
          background: var(--bg-secondary, #f3f4f6);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: ui-monospace, 'SF Mono', Menlo, Monaco, monospace;
          font-size: 13px;
        }
        .tiptap-editor-content pre {
          background: #1f2937;
          color: #f9fafb;
          padding: 12px 14px;
          border-radius: 6px;
          margin: 12px 0;
          overflow-x: auto;
        }
        .tiptap-editor-content pre code {
          background: none;
          color: inherit;
          padding: 0;
          font-size: 13px;
        }
        .tiptap-editor-content a {
          color: var(--accent, #10b981);
          text-decoration: underline;
        }
        .tiptap-editor-content hr {
          border: none;
          border-top: 1px solid var(--border, #e5e7eb);
          margin: 18px 0;
        }
        .tiptap-editor-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--text-muted, #9ca3af);
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  )
}

function ToolbarButton({ onClick, active, disabled, title, children }: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        border: 'none',
        background: active ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
        color: active ? 'var(--accent, #10b981)' : 'var(--text-secondary, #4b5563)',
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: 'var(--border, #e5e7eb)', margin: '0 4px' }} />
}
