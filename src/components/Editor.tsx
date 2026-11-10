import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Link,
  Minus,
  Heading2,
  Undo2,
  Redo2,
} from "lucide-react";
import { useEffect, useRef } from "react";
export function Editor({
  content,
  onChange,
  resetKey,
}: {
  content: string;
  onChange: (json: string) => void;
  resetKey: string;
}) {
  const change = useRef(onChange);
  change.current = onChange;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          protocols: ["http", "https", "mailto"],
          isAllowedUri: (url) => /^(https?:\/\/|mailto:)/i.test(url),
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: "Une pensée, une idée… écrivez librement.",
      }),
    ],
    content: JSON.parse(content),
    onUpdate: ({ editor }) => change.current(JSON.stringify(editor.getJSON())),
    editorProps: {
      attributes: { class: "note-prose", "aria-label": "Contenu de la note" },
    },
  });
  useEffect(() => {
    if (editor)
      editor.commands.setContent(JSON.parse(content), { emitUpdate: false });
  }, [resetKey, editor]);
  if (!editor) return null;
  const actions = [
    {
      icon: Heading2,
      title: "Titre",
      active: editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      icon: Bold,
      title: "Gras",
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      title: "Italique",
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      icon: Underline,
      title: "Souligné",
      active: editor.isActive("underline"),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      icon: List,
      title: "Liste",
      active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      title: "Liste numérotée",
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: ListTodo,
      title: "Cases à cocher",
      active: editor.isActive("taskList"),
      run: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      icon: Quote,
      title: "Citation",
      active: editor.isActive("blockquote"),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      icon: Code,
      title: "Bloc de code",
      active: editor.isActive("codeBlock"),
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      icon: Link,
      title: "Lien",
      active: editor.isActive("link"),
      run: () => {
        const link = prompt("Adresse du lien (https://…)");
        if (link === null) return;
        if (!link) editor.chain().focus().unsetLink().run();
        else if (/^(https?:\/\/|mailto:)/i.test(link))
          editor.chain().focus().setLink({ href: link }).run();
        else alert("Utilisez une adresse https://, http:// ou mailto:.");
      },
    },
    {
      icon: Minus,
      title: "Séparateur",
      run: () => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      icon: Undo2,
      title: "Annuler",
      run: () => editor.chain().focus().undo().run(),
    },
    {
      icon: Redo2,
      title: "Rétablir",
      run: () => editor.chain().focus().redo().run(),
    },
  ];
  return (
    <>
      <div className="editor-toolbar">
        {actions.map(({ icon: Icon, title, active, run }) => (
          <button
            key={title}
            title={title}
            aria-label={title}
            className={active ? "active" : ""}
            onClick={run}
          >
            <Icon size={17} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </>
  );
}
