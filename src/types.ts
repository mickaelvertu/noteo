export type Note = {
  id: string;
  title: string;
  notebookId: string;
  tagIds: string[];
  contentJson: string;
  plainText: string;
  excerpt: string;
  isFavorite: boolean;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
  lastEditorDeviceId: string;
  schemaVersion: 1;
};
export type Notebook = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
};
export type Tag = {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: number;
  updatedAt: number;
};
export type Task = {
  id: string;
  noteId: string;
  title: string;
  completed: boolean;
  dueAt: string | null;
  createdAt: number;
  updatedAt: number;
};
export type Attachment = {
  id: string;
  noteId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: number;
  status: "ready" | "uploading";
};
export type Data = {
  notes: Note[];
  notebooks: Notebook[];
  tags: Tag[];
  tasks: Task[];
  attachments: Attachment[];
};
export type Kind = keyof Data;
export type RecordType = Note | Notebook | Tag | Task | Attachment;
export const emptyData: Data = {
  notes: [],
  notebooks: [],
  tags: [],
  tasks: [],
  attachments: [],
};
