import { z } from "zod";
import type { Data, Note } from "../types";
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export const uid = () => crypto.randomUUID();
export function textFromJson(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const n = json as { text?: string; content?: unknown[]; type?: string };
  return (
    n.text ??
    (n.content ?? [])
      .map(textFromJson)
      .join(
        ["doc", "bulletList", "orderedList", "taskList"].includes(n.type ?? "")
          ? "\n"
          : " ",
      )
  );
}
export const formatDate = (n: number) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(
    n,
  );
export function validateContent(value: string) {
  if (new TextEncoder().encode(value).length > 500 * 1024)
    throw new Error("La note dépasse la limite de 500 Kio.");
  const root: unknown = JSON.parse(value);
  const types = new Set([
    "doc",
    "paragraph",
    "text",
    "heading",
    "bulletList",
    "orderedList",
    "listItem",
    "taskList",
    "taskItem",
    "blockquote",
    "codeBlock",
    "horizontalRule",
    "hardBreak",
  ]);
  function walk(node: unknown, depth = 0): void {
    if (depth > 30 || !node || typeof node !== "object")
      throw new Error("Document de note invalide.");
    const n = node as {
      type?: string;
      text?: unknown;
      content?: unknown[];
      marks?: { type: string; attrs?: { href?: unknown } }[];
    };
    if (
      !types.has(n.type ?? "") ||
      (n.type === "text" && typeof n.text !== "string")
    )
      throw new Error("Type de contenu non pris en charge.");
    if (n.content !== undefined) {
      if (!Array.isArray(n.content)) throw new Error("Contenu invalide.");
      n.content.forEach((child) => walk(child, depth + 1));
    }
    if (n.marks !== undefined) {
      if (!Array.isArray(n.marks)) throw new Error("Formatage invalide.");
      for (const mark of n.marks) {
        if (
          !["bold", "italic", "underline", "strike", "code", "link"].includes(
            mark.type,
          )
        )
          throw new Error("Formatage non pris en charge.");
        if (
          mark.type === "link" &&
          (typeof mark.attrs?.href !== "string" ||
            !/^(https?:\/\/|mailto:)/i.test(mark.attrs.href))
        )
          throw new Error("Lien non autorisé.");
      }
    }
  }
  if (
    !root ||
    typeof root !== "object" ||
    (root as { type?: string }).type !== "doc"
  )
    throw new Error("La note doit contenir un document structuré.");
  walk(root);
}
const base = {
  id: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
};
const noteSchema = z.object({
  ...base,
  title: z.string().max(200),
  notebookId: z.string(),
  tagIds: z.array(z.string()).max(30),
  contentJson: z.string().refine((v) => {
    try {
      validateContent(v);
      return true;
    } catch {
      return false;
    }
  }),
  plainText: z.string().max(200000),
  excerpt: z.string().max(160),
  isFavorite: z.boolean(),
  deletedAt: z.number().nullable(),
  lastEditorDeviceId: z.string(),
  schemaVersion: z.literal(1),
});
export const backupSchema = z
  .object({
    version: z.literal(1),
    notes: z.array(noteSchema).max(5000),
    notebooks: z
      .array(
        z.object({
          ...base,
          name: z.string().min(1).max(80),
          color: z.string(),
        }),
      )
      .max(500),
    tags: z
      .array(
        z.object({
          ...base,
          name: z.string().min(1).max(80),
          normalizedName: z.string(),
        }),
      )
      .max(2000),
    tasks: z
      .array(
        z.object({
          ...base,
          noteId: z.string(),
          title: z.string().min(1).max(200),
          completed: z.boolean(),
          dueAt: z.string().nullable(),
        }),
      )
      .max(10000),
  })
  .superRefine((d, ctx) => {
    const books = new Set(d.notebooks.map((x) => x.id)),
      tags = new Set(d.tags.map((x) => x.id)),
      notes = new Set(d.notes.map((x) => x.id));
    if (
      [d.notes, d.notebooks, d.tags, d.tasks].some(
        (a) => new Set(a.map((x) => x.id)).size !== a.length,
      ) ||
      d.notes.some(
        (n) => !books.has(n.notebookId) || n.tagIds.some((t) => !tags.has(t)),
      ) ||
      d.tasks.some((t) => !notes.has(t.noteId))
    )
      ctx.addIssue({
        code: "custom",
        message: "Identifiants dupliqués ou références manquantes.",
      });
  });
export function remapBackup(input: unknown): Omit<Data, "attachments"> {
  const d = backupSchema.parse(input);
  const map = new Map(
    [...d.notebooks, ...d.tags, ...d.notes, ...d.tasks].map((x) => [
      x.id,
      uid(),
    ]),
  );
  return {
    notebooks: d.notebooks.map((x) => ({ ...x, id: map.get(x.id)! })),
    tags: d.tags.map((x) => ({ ...x, id: map.get(x.id)! })),
    notes: d.notes.map((x) => ({
      ...x,
      id: map.get(x.id)!,
      notebookId: map.get(x.notebookId)!,
      tagIds: x.tagIds.map((t) => map.get(t)!),
    })),
    tasks: d.tasks.map((x) => ({
      ...x,
      id: map.get(x.id)!,
      noteId: map.get(x.noteId)!,
    })),
  };
}
export function download(
  name: string,
  body: string,
  mime = "application/json",
) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function newNote(notebookId: string, device: string): Note {
  const now = Date.now();
  return {
    id: uid(),
    title: "Sans titre",
    notebookId,
    tagIds: [],
    contentJson: '{"type":"doc","content":[{"type":"paragraph"}]}',
    plainText: "",
    excerpt: "",
    isFavorite: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    lastEditorDeviceId: device,
    schemaVersion: 1,
  };
}
export const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
];
export function validateFile(file: { size: number; type: string }) {
  if (file.size === 0) throw new Error("Le fichier est vide.");
  if (!allowedTypes.includes(file.type))
    throw new Error("Format non autorisé. Images, PDF et texte uniquement.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Fichier trop volumineux (10 Mio maximum).");
}
export function message(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  const messages: Record<string, string> = {
    "auth/invalid-credential": "Email ou mot de passe incorrect.",
    "auth/email-already-in-use": "Cet email possède déjà un compte.",
    "auth/weak-password": "Utilisez un mot de passe de 6 caractères minimum.",
    "auth/popup-blocked": "Autorisez les fenêtres popup pour Google.",
    "auth/unauthorized-domain":
      "Ce domaine doit être autorisé dans Firebase Authentication.",
    "auth/operation-not-allowed":
      "Activez ce fournisseur dans Firebase Authentication.",
    "permission-denied": "Accès refusé. Vérifiez les règles Firebase Noteo.",
    "auth/network-request-failed": "Connexion réseau indisponible.",
    "storage/unauthorized":
      "Accès au fichier refusé. Vérifiez les règles Storage.",
  };
  return (
    messages[code] ??
    (error instanceof Error ? error.message : "Une erreur est survenue.")
  );
}
