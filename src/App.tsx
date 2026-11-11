import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Leaf,
  Plus,
  Search,
  FileText,
  Star,
  BookOpen,
  Tags,
  ListTodo,
  Trash2,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Check,
  Cloud,
  CloudOff,
  Copy,
  Download,
  Printer,
  Paperclip,
  X,
  Menu,
  ArrowUpDown,
  MoreHorizontal,
  Sun,
  Moon,
  FolderOpen,
} from "lucide-react";
import {
  deleteObject,
  getBlob,
  ref,
  uploadBytesResumable,
  type UploadTask,
} from "firebase/storage";
import { storage, enableAnalytics } from "./lib/firebase";
import { Auth } from "./components/Auth";
import { Editor } from "./components/Editor";
import { useWorkspace } from "./useWorkspace";
import {
  download,
  formatDate,
  message,
  newNote,
  normalize,
  remapBackup,
  textFromJson,
  uid,
  validateContent,
  validateFile,
  backupSchema,
} from "./lib/utils";
import type { Attachment, Note, RecordType, Task } from "./types";
export default function App() {
  const w = useWorkspace(),
    navigate = useNavigate(),
    location = useLocation();
  const [selected, setSelected] = useState<string | null>(null),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("updated"),
    [mobileNav, setMobileNav] = useState(false),
    [panel, setPanel] = useState("notes"),
    [toast, setToast] = useState(""),
    [dark, setDark] = useState(localStorage.getItem("noteo:dark") === "true"),
    [upload, setUpload] = useState<number | null>(null),
    [importData, setImportData] = useState<unknown>(null),
    [importReport, setImportReport] = useState("");
  const uploadTask = useRef<UploadTask | null>(null),
    importInput = useRef<HTMLInputElement>(null);
  const device = useRef(sessionStorage.getItem("noteo:device") ?? uid());
  const owner = w.demo ? "demo" : (w.user?.uid ?? "");
  const activeOwner = useRef(owner);
  activeOwner.current = owner;
  useEffect(() => {
    sessionStorage.setItem("noteo:device", device.current);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("noteo:dark", String(dark));
  }, [dark]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!w.ready) return;
    if (w.user || w.demo) {
      if (!location.pathname.startsWith("/app"))
        navigate("/app/notes", { replace: true });
    } else if (location.pathname.startsWith("/app"))
      navigate("/login", { replace: true });
  }, [w.ready, w.user, w.demo, location.pathname]);
  useEffect(() => {
    const p = location.pathname.split("/");
    if (p[2] === "notes") {
      setPanel("notes");
      setSelected(p[3] ?? null);
    } else if (
      ["tasks", "settings", "trash", "notebooks", "tags"].includes(p[2])
    ) {
      setPanel(p[2]);
      setSelected(null);
    }
  }, [location.pathname]);
  useEffect(() => {
    setFilter("all");
    setSearch("");
    setUpload(null);
    uploadTask.current?.cancel();
    return () => {
      uploadTask.current?.cancel();
    };
  }, [owner]);
  const [draft, setDraft] = useState<Note | null>(null),
    [dirty, setDirty] = useState(false),
    [reset, setReset] = useState(0),
    [conflict, setConflict] = useState<Note | null>(null),
    [recovery, setRecovery] = useState<Note | null>(null);
  const draftRef = useRef(draft),
    generation = useRef(0),
    lastSent = useRef(""),
    baseline = useRef("");
  draftRef.current = draft;
  function draftKey(id: string) {
    return `noteo:draft:${owner}:${id}`;
  }
  function stash(n: Note) {
    if (w.demo) return;
    try {
      localStorage.setItem(draftKey(n.id), JSON.stringify(n));
    } catch {
      w.setError(
        "Le brouillon local ne peut pas être conservé. Exportez la note avant de quitter.",
      );
    }
  }
  function signature(n: Note) {
    return JSON.stringify([
      n.title,
      n.contentJson,
      n.notebookId,
      n.tagIds,
      n.isFavorite,
      n.deletedAt,
    ]);
  }
  const current = w.data.notes.find((n) => n.id === selected);
  useEffect(() => {
    generation.current++;
    setDirty(false);
    setConflict(null);
    setRecovery(null);
    setDraft(current ?? null);
    baseline.current = current ? signature(current) : "";
    lastSent.current = "";
    setReset((n) => n + 1);
    if (current && !w.demo) {
      const saved = localStorage.getItem(draftKey(current.id));
      if (saved) {
        try {
          const n = JSON.parse(saved) as Note;
          if (
            n.contentJson !== current.contentJson ||
            n.title !== current.title
          )
            setRecovery(n);
          else localStorage.removeItem(draftKey(current.id));
        } catch {}
      }
    }
  }, [selected, owner]);
  useEffect(() => {
    if (!current) return;
    if (!draftRef.current) {
      setDraft(current);
      baseline.current = signature(current);
      setReset((n) => n + 1);
      if (!w.demo) {
        try {
          const saved = localStorage.getItem(draftKey(current.id));
          if (saved) {
            const n = JSON.parse(saved) as Note;
            validateContent(n.contentJson);
            if (signature(n) !== signature(current)) setRecovery(n);
          }
        } catch {}
      }
      return;
    }
    const changed = signature(current) !== baseline.current;
    if (changed && signature(current) !== lastSent.current) {
      if (dirty) {
        setConflict(current);
      } else {
        setDraft(current);
        baseline.current = signature(current);
        setReset((n) => n + 1);
      }
    }
  }, [
    current?.contentJson,
    current?.title,
    current?.notebookId,
    current?.isFavorite,
    JSON.stringify(current?.tagIds),
  ]);
  function edit(patch: Partial<Note>) {
    const old = draftRef.current;
    if (!old) return;
    const n = {
      ...old,
      ...patch,
      updatedAt: Date.now(),
      lastEditorDeviceId: device.current,
    };
    setDraft(n);
    setDirty(true);
    stash(n);
  }
  useEffect(() => {
    if (!dirty || !draft || conflict) return;
    const n = draft,
      g = generation.current,
      who = owner;
    const timer = setTimeout(() => {
      try {
        validateContent(n.contentJson);
      } catch (e) {
        w.setError(message(e));
        return;
      }
      lastSent.current = signature(n);
      w.put("notes", n)
        .then(() => {
          if (activeOwner.current !== who) return;
          if (draftRef.current?.updatedAt === n.updatedAt) {
            if (g === generation.current) {
              setDirty(false);
              baseline.current = signature(n);
            }
            if (!w.demo) localStorage.removeItem(`noteo:draft:${who}:${n.id}`);
          }
        })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [draft, dirty, conflict]);
  const activeNotes = w.data.notes.filter((n) => !n.deletedAt);
  const visible = w.data.notes
    .filter((n) => (panel === "trash" ? !!n.deletedAt : !n.deletedAt))
    .filter(
      (n) =>
        filter === "all" ||
        (filter === "favorite" && n.isFavorite) ||
        filter === `book:${n.notebookId}` ||
        n.tagIds.some((t) => filter === `tag:${t}`),
    )
    .filter((n) =>
      normalize(
        n.title +
          " " +
          n.plainText +
          " " +
          n.tagIds
            .map((id) => w.data.tags.find((t) => t.id === id)?.name)
            .join(" "),
      ).includes(normalize(search)),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "created"
          ? b.createdAt - a.createdAt
          : b.updatedAt - a.updatedAt,
    );
  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      w.setError(message(e));
    }
  }
  function flushDraft() {
    const n = draftRef.current;
    if (dirty && n && !conflict) {
      lastSent.current = signature(n);
      void w.put("notes", n).catch(() => {});
    }
  }
  function openNote(id: string) {
    flushDraft();
    navigate(`/app/notes/${id}`);
    setMobileNav(false);
  }
  async function create() {
    const book = filter.startsWith("book:")
      ? filter.slice(5)
      : w.data.notebooks[0]?.id;
    if (!book) {
      w.setError(
        "Le carnet initial est indisponible. Vérifiez Firebase puis réessayez.",
      );
      return;
    }
    const n = newNote(book, device.current);
    flushDraft();
    setDraft(n);
    navigate(`/app/notes/${n.id}`);
    await w.put("notes", n);
  }
  function go(page: string, value = "all") {
    flushDraft();
    setFilter(value);
    navigate(`/app/${page}`);
    setMobileNav(false);
  }
  async function organize(kind: "notebooks" | "tags", id?: string) {
    const existing = w.data[kind].find((x) => x.id === id);
    const name = prompt(
      kind === "notebooks" ? "Nom du carnet" : "Nom du tag",
      existing?.name ?? "",
    )?.trim();
    if (!name) return;
    if (name.length > 80) throw new Error("80 caractères maximum.");
    const now = Date.now();
    await w.put(kind, {
      id: id ?? uid(),
      name,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(kind === "notebooks"
        ? { color: "#72917a" }
        : { normalizedName: normalize(name) }),
    });
  }
  async function deleteOrganization(kind: "notebooks" | "tags", id: string) {
    if (!confirm("Supprimer cet élément ? Les notes seront conservées."))
      return;
    if (kind === "notebooks") {
      if (w.data.notebooks.length <= 1)
        throw new Error("Conservez au moins un carnet.");
      const target = prompt(
        "Déplacer les notes vers ce carnet (saisir son nom) :",
        w.data.notebooks.find((b) => b.id !== id)?.name,
      );
      const book = w.data.notebooks.find(
        (b) => b.name === target && b.id !== id,
      );
      if (!book) throw new Error("Choisissez un autre carnet existant.");
      for (const n of (await w.getAll("notes")) as Note[])
        if (n.notebookId === id)
          await w.put("notes", { ...n, notebookId: book.id });
    } else {
      for (const n of (await w.getAll("notes")) as Note[])
        if (n.tagIds.includes(id))
          await w.put("notes", {
            ...n,
            tagIds: n.tagIds.filter((t) => t !== id),
          });
    }
    await w.del(kind, id);
    setFilter("all");
  }
  async function exportAll() {
    const kinds = ["notes", "notebooks", "tags", "tasks"] as const;
    const result: Record<string, unknown> = {
      version: 1,
      exportedAt: new Date().toISOString(),
      binaryFilesIncluded: false,
    };
    for (const k of kinds) result[k] = await w.getAll(k);
    download("noteo-export.json", JSON.stringify(result, null, 2));
    setToast("Export prêt · pièces jointes non incluses.");
  }
  async function importAll() {
    const d = remapBackup(importData);
    let done = 0;
    try {
      for (const kind of ["notebooks", "tags", "notes", "tasks"] as const)
        for (const item of d[kind]) {
          await w.put(kind, item as RecordType);
          setImportReport(`${++done} éléments importés…`);
        }
      setImportData(null);
      setToast(`${done} éléments importés.`);
    } catch (e) {
      setImportData(null);
      setImportReport(
        `${done} éléments importés avant l’échec. L’import n’est pas atomique. Ne relancez pas sans vérifier les données.`,
      );
      throw e;
    }
  }
  async function deleteFile(path: string) {
    if (w.demo) return;
    try {
      await deleteObject(ref(storage, path));
    } catch (e) {
      if ((e as { code?: string }).code !== "storage/object-not-found") throw e;
    }
  }
  async function addFile(file: File) {
    if (!draft) return;
    if (w.demo) throw new Error("Les uploads nécessitent un compte Firebase.");
    if (!w.online)
      throw new Error("Reconnectez-vous avant de joindre un fichier.");
    validateFile(file);
    const who = owner,
      noteId = draft.id,
      id = uid(),
      safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `noteo/${who}/${noteId}/${id}/${safe}`;
    const a: Attachment = {
      id,
      noteId,
      storagePath: path,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      createdAt: Date.now(),
      status: "uploading",
    };
    await w.put("attachments", a);
    setUpload(0);
    const task = uploadBytesResumable(ref(storage, path), file, {
      contentType: file.type,
    });
    uploadTask.current = task;
    await new Promise<void>((resolve, reject) =>
      task.on(
        "state_changed",
        (s) => {
          if (activeOwner.current === who)
            setUpload(Math.round((s.bytesTransferred / s.totalBytes) * 100));
        },
        reject,
        resolve,
      ),
    )
      .then(async () => {
        if (activeOwner.current === who)
          await w.put("attachments", { ...a, status: "ready" });
      })
      .finally(() => {
        setUpload(null);
        uploadTask.current = null;
      });
  }
  async function openFile(a: Attachment) {
    if (a.status !== "ready")
      throw new Error(
        "Upload interrompu. Supprimez cette entrée et sélectionnez à nouveau le fichier.",
      );
    const blob = await getBlob(ref(storage, a.storagePath), 10 * 1024 * 1024);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = a.originalName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function addTask() {
    if (!draft) return;
    const title = prompt("Quelle est la prochaine étape ?")?.trim();
    if (!title) return;
    const due =
      prompt(
        "Échéance facultative (AAAA-MM-JJ)",
        new Date().toLocaleDateString("en-CA"),
      ) || null;
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due))
      throw new Error("Utilisez le format AAAA-MM-JJ.");
    const now = Date.now();
    await w.put("tasks", {
      id: uid(),
      noteId: draft.id,
      title: title.slice(0, 200),
      completed: false,
      dueAt: due,
      createdAt: now,
      updatedAt: now,
    });
  }
  function taskRow(t: Task) {
    return (
      <div className={`task-row ${t.completed ? "completed" : ""}`} key={t.id}>
        <button
          aria-label={t.completed ? "Rouvrir la tâche" : "Terminer la tâche"}
          className="task-check"
          onClick={() =>
            run(() =>
              w.put("tasks", {
                ...t,
                completed: !t.completed,
                updatedAt: Date.now(),
              }),
            )
          }
        >
          {t.completed && <Check size={13} />}
        </button>
        <button className="task-title" onClick={() => openNote(t.noteId)}>
          {t.title}
        </button>
        {t.dueAt && <small>{t.dueAt}</small>}
        <button
          className="icon-button"
          title="Renommer la tâche"
          onClick={() => {
            const title = prompt("Titre de la tâche", t.title)?.trim();
            if (title)
              void run(() =>
                w.put("tasks", {
                  ...t,
                  title: title.slice(0, 200),
                  updatedAt: Date.now(),
                }),
              );
          }}
        >
          <MoreHorizontal size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Supprimer la tâche"
          onClick={() => run(() => w.del("tasks", t.id))}
        >
          <X size={15} />
        </button>
      </div>
    );
  }
  if (!w.ready)
    return (
      <div className="loading-screen">
        <Leaf /> Ouverture de votre espace…
      </div>
    );
  if (!w.user && !w.demo) return <Auth onDemo={w.startDemo} />;
  const title =
    panel === "trash"
      ? "Corbeille"
      : filter === "favorite"
        ? "Vos favoris"
        : filter.startsWith("book:")
          ? w.data.notebooks.find((b) => b.id === filter.slice(5))?.name
          : filter.startsWith("tag:")
            ? "# " + w.data.tags.find((t) => t.id === filter.slice(4))?.name
            : "Toutes les notes";
  return (
    <div className={`workspace ${selected ? "has-note" : ""}`}>
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">
            <Leaf size={22} />
          </span>
          noteo<span className="brand-dot">.</span>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileNav(false)}
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        </div>
        <button className="primary new-note" onClick={() => run(create)}>
          <Plus size={18} /> Nouvelle note <span>＋</span>
        </button>
        <div className="nav-label">VOTRE ESPACE</div>
        <nav>
          {[
            {
              icon: FileText,
              label: "Toutes les notes",
              page: "notes",
              value: "all",
              number: activeNotes.length,
            },
            {
              icon: Star,
              label: "Favoris",
              page: "notes",
              value: "favorite",
              number: activeNotes.filter((n) => n.isFavorite).length,
            },
            {
              icon: ListTodo,
              label: "Tâches",
              page: "tasks",
              value: "all",
              number: w.data.tasks.filter(
                (t) =>
                  !t.completed && activeNotes.some((n) => n.id === t.noteId),
              ).length,
            },
          ].map(({ icon: Icon, label, page, value, number }) => (
            <button
              className={panel === page && filter === value ? "nav-active" : ""}
              key={label}
              onClick={() => go(page, value)}
            >
              <Icon size={18} />
              <span>{label}</span>
              <small>{number}</small>
            </button>
          ))}
        </nav>
        <div className="nav-label">
          CARNETS
          <button
            title="Créer un carnet"
            onClick={() => run(() => organize("notebooks"))}
          >
            <Plus size={15} />
          </button>
        </div>
        <nav>
          {w.data.notebooks.map((b) => (
            <button
              key={b.id}
              className={filter === `book:${b.id}` ? "nav-active" : ""}
              onClick={() => go("notes", `book:${b.id}`)}
            >
              <BookOpen size={17} style={{ color: b.color }} />
              <span>{b.name}</span>
              <small>
                {activeNotes.filter((n) => n.notebookId === b.id).length}
              </small>
            </button>
          ))}
          <button className="subtle-nav" onClick={() => go("notebooks")}>
            <FolderOpen size={16} />
            <span>Gérer les carnets</span>
            <ChevronRight size={14} />
          </button>
        </nav>
        <div className="nav-label">
          TAGS
          <button
            title="Créer un tag"
            onClick={() => run(() => organize("tags"))}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="sidebar-tags">
          {w.data.tags.map((t) => (
            <button
              className={filter === `tag:${t.id}` ? "selected-tag" : ""}
              key={t.id}
              onClick={() => go("notes", `tag:${t.id}`)}
            >
              # {t.name}
            </button>
          ))}
          <button aria-label="Gérer les tags" onClick={() => go("tags")}>
            <Tags size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button
            onClick={() => go("trash")}
            className={panel === "trash" ? "nav-active" : ""}
          >
            <Trash2 size={17} />
            Corbeille
            <small>{w.data.notes.filter((n) => n.deletedAt).length}</small>
          </button>
          <button onClick={() => go("settings")}>
            <Settings size={17} />
            Paramètres
          </button>
          <div className="account">
            <span className="avatar">
              {w.demo
                ? "D"
                : (w.user?.displayName ??
                    w.user?.email ??
                    "N")[0].toUpperCase()}
            </span>
            <div>
              <strong>
                {w.demo
                  ? "Espace découverte"
                  : (w.user?.displayName ?? "Mon espace")}
              </strong>
              <small>{w.demo ? "Mode démonstration" : w.user?.email}</small>
            </div>
            <button aria-label="Se déconnecter" onClick={() => run(w.logout)}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <button
              className="icon-button menu-toggle"
              aria-label="Ouvrir le menu"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span>Mon espace</span>
            <ChevronRight size={13} />
            <strong>
              {panel === "notes"
                ? "Notes"
                : panel === "tasks"
                  ? "Tâches"
                  : panel === "settings"
                    ? "Paramètres"
                    : panel === "notebooks"
                      ? "Carnets"
                      : panel === "tags"
                        ? "Tags"
                        : "Corbeille"}
            </strong>
          </div>
          <div className="top-right">
            <span className="sync-status">
              {w.online ? <Cloud size={15} /> : <CloudOff size={15} />}
              <span>
                {w.demo
                  ? "Démonstration"
                  : !w.online
                    ? "Hors connexion"
                    : dirty
                      ? "Modifications locales"
                      : w.sync}
              </span>
            </span>
            <button
              className="icon-button"
              title="Changer de thème"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <span className="mini-avatar">
              {w.demo ? "D" : (w.user?.email ?? "N")[0].toUpperCase()}
            </span>
          </div>
        </header>
        {w.demo && (
          <div className="demo-banner">
            Vous explorez Noteo. Les modifications de cette démonstration ne
            sont pas sauvegardées.
            <button onClick={() => run(w.logout)}>
              Créer mon compte{" "}
              <ArrowLeft size={12} style={{ transform: "rotate(180deg)" }} />
            </button>
          </div>
        )}
        {w.error && (
          <div className="error-banner" role="alert">
            {w.error}
            <button aria-label="Fermer l’erreur" onClick={() => w.setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {panel === "notes" || panel === "trash" ? (
          <div className="notes-layout">
            <section className="note-list">
              <div className="list-heading">
                <span className="eyebrow">VOTRE COLLECTION</span>
                <h1>{title}</h1>
                <div>
                  <span>
                    {visible.length} note{visible.length > 1 ? "s" : ""}
                  </span>
                  <button
                    className="icon-button"
                    title="Créer une note"
                    onClick={() => run(create)}
                  >
                    <Plus size={19} />
                  </button>
                </div>
              </div>
              <div className="search-box">
                <Search size={17} />
                <input
                  aria-label="Rechercher dans les notes"
                  placeholder="Rechercher une idée…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    aria-label="Effacer la recherche"
                    onClick={() => setSearch("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="list-controls">
                <small>
                  {search
                    ? "Recherche parmi les notes chargées"
                    : "Un endroit pour chaque idée"}
                </small>
                <label title="Trier">
                  <ArrowUpDown size={13} />
                  <select
                    aria-label="Trier les notes"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="updated">Modification</option>
                    <option value="created">Création</option>
                    <option value="title">Titre</option>
                  </select>
                </label>
              </div>
              <div className="note-cards">
                {visible.map((n) => (
                  <button
                    className={`note-card ${selected === n.id ? "selected" : ""}`}
                    key={n.id}
                    onClick={() =>
                      panel === "trash" ? setSelected(n.id) : openNote(n.id)
                    }
                  >
                    <div className="note-card-date">
                      <span>{formatDate(n.updatedAt || n.createdAt)}</span>
                      {n.isFavorite && <Star size={13} fill="currentColor" />}
                    </div>
                    <h3>{n.title || "Sans titre"}</h3>
                    <p>
                      {n.excerpt || "Une page blanche, mille possibilités."}
                    </p>
                    <div className="note-card-bottom">
                      <span>
                        <BookOpen size={12} />
                        {w.data.notebooks.find((b) => b.id === n.notebookId)
                          ?.name ?? "Carnet"}
                      </span>
                      {n.tagIds.length > 0 && (
                        <span className="tiny-tag">
                          #{w.data.tags.find((t) => t.id === n.tagIds[0])?.name}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                {!visible.length && (
                  <div className="small-empty">
                    <Search size={26} />
                    <h3>
                      {search ? "Aucune note trouvée" : "Tout commence ici."}
                    </h3>
                    <p>
                      {search
                        ? "Essayez un autre mot."
                        : "Créez une note pour garder votre première idée."}
                    </p>
                  </div>
                )}
                {w.data.notes.length >= w.count && (
                  <button
                    className="secondary load-more"
                    onClick={() => w.setCount(w.count + 100)}
                  >
                    Charger 100 notes de plus
                  </button>
                )}
                <small className="search-scope">
                  {w.data.notes.length} notes chargées · recherche locale
                </small>
              </div>
            </section>
            <section className="note-detail">
              {panel === "trash" && selected ? (
                <div className="trash-detail">
                  <Trash2 size={35} />
                  <h2>{current?.title}</h2>
                  <p>{current?.plainText}</p>
                  <button
                    className="primary"
                    onClick={() =>
                      run(async () => {
                        if (current)
                          await w.put("notes", { ...current, deletedAt: null });
                        setSelected(null);
                      })
                    }
                  >
                    Restaurer la note
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      run(async () => {
                        if (
                          current &&
                          confirm(
                            "Supprimer définitivement cette note et ses fichiers ?",
                          )
                        ) {
                          await w.destroy(current, deleteFile);
                          setSelected(null);
                        }
                      })
                    }
                  >
                    Supprimer définitivement
                  </button>
                </div>
              ) : draft && selected ? (
                <>
                  <div className="note-actions">
                    <button
                      className="icon-button back-button"
                      title="Retour aux notes"
                      onClick={() => {
                        flushDraft();
                        navigate("/app/notes");
                      }}
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <span>
                      <BookOpen size={14} />
                      <select
                        aria-label="Carnet de la note"
                        value={draft.notebookId}
                        onChange={(e) => edit({ notebookId: e.target.value })}
                      >
                        {w.data.notebooks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={12} />
                    </span>
                    <div>
                      <button
                        className={`icon-button ${draft.isFavorite ? "favorited" : ""}`}
                        aria-label="Ajouter aux favoris"
                        onClick={() => edit({ isFavorite: !draft.isFavorite })}
                      >
                        <Star
                          size={17}
                          fill={draft.isFavorite ? "currentColor" : "none"}
                        />
                      </button>
                      <button
                        className="icon-button"
                        title="Dupliquer"
                        onClick={() =>
                          run(async () => {
                            const n = {
                              ...draft,
                              id: uid(),
                              title: (draft.title + " (copie)").slice(0, 200),
                              createdAt: Date.now(),
                              updatedAt: Date.now(),
                            };
                            await w.put("notes", n);
                            openNote(n.id);
                          })
                        }
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className="icon-button"
                        title="Exporter en texte"
                        onClick={() =>
                          download(
                            "noteo-note.txt",
                            draft.title + "\n\n" + draft.plainText,
                            "text/plain",
                          )
                        }
                      >
                        <Download size={17} />
                      </button>
                      <button
                        className="icon-button"
                        title="Imprimer"
                        onClick={() => window.print()}
                      >
                        <Printer size={17} />
                      </button>
                      <button
                        className="icon-button"
                        title="Mettre à la corbeille"
                        onClick={() =>
                          run(async () => {
                            setDirty(false);
                            draftRef.current = null;
                            await w.put("notes", {
                              ...draft,
                              deletedAt: Date.now(),
                            });
                            navigate("/app/notes");
                          })
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                  {recovery && (
                    <div className="recovery-box">
                      Un brouillon non synchronisé a été retrouvé.
                      <button
                        onClick={() => {
                          setDraft(recovery);
                          setDirty(true);
                          setReset((n) => n + 1);
                          setRecovery(null);
                        }}
                      >
                        Récupérer
                      </button>
                      <button
                        onClick={() => {
                          localStorage.removeItem(draftKey(recovery.id));
                          setRecovery(null);
                        }}
                      >
                        Ignorer
                      </button>
                    </div>
                  )}
                  {conflict && (
                    <div className="recovery-box">
                      Une autre version a été reçue. Votre brouillon est
                      conservé.
                      <button
                        onClick={() =>
                          run(async () => {
                            const copy = {
                              ...draft,
                              id: uid(),
                              title: (draft.title + " (récupération)").slice(
                                0,
                                200,
                              ),
                              createdAt: Date.now(),
                            };
                            await w.put("notes", copy);
                            setConflict(null);
                            openNote(copy.id);
                          })
                        }
                      >
                        Conserver une copie
                      </button>
                      <button
                        onClick={() => {
                          setDraft(conflict);
                          setDirty(false);
                          baseline.current = signature(conflict);
                          setReset((n) => n + 1);
                          setConflict(null);
                        }}
                      >
                        Charger la version distante
                      </button>
                    </div>
                  )}
                  <div className="note-document">
                    <div className="note-meta">
                      MODIFIÉE LE {formatDate(draft.updatedAt).toUpperCase()}
                      <span>•</span>
                      {draft.plainText.split(/\s+/).filter(Boolean).length} MOTS
                    </div>
                    <input
                      className="note-title"
                      aria-label="Titre de la note"
                      maxLength={200}
                      value={draft.title === "Sans titre" ? "" : draft.title}
                      placeholder="Sans titre"
                      onChange={(e) => edit({ title: e.target.value })}
                    />
                    <div className="note-tags">
                      {draft.tagIds.map((id) => (
                        <button
                          key={id}
                          onClick={() =>
                            edit({
                              tagIds: draft.tagIds.filter((t) => t !== id),
                            })
                          }
                        >
                          # {w.data.tags.find((t) => t.id === id)?.name}
                          <X size={11} />
                        </button>
                      ))}
                      <select
                        aria-label="Ajouter un tag"
                        value=""
                        onChange={(e) => {
                          if (e.target.value && draft.tagIds.length < 30)
                            edit({ tagIds: [...draft.tagIds, e.target.value] });
                        }}
                      >
                        <option value="">＋ Ajouter un tag</option>
                        {w.data.tags
                          .filter((t) => !draft.tagIds.includes(t.id))
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <Editor
                      key={draft.id}
                      content={draft.contentJson}
                      resetKey={`${draft.id}:${reset}`}
                      onChange={(json) => {
                        const plainText = textFromJson(JSON.parse(json)).slice(
                          0,
                          200000,
                        );
                        edit({
                          contentJson: json,
                          plainText,
                          excerpt: plainText.slice(0, 160),
                        });
                      }}
                    />

                    <div className="note-extras">
                      <div className="section-row">
                        <h4>
                          <Paperclip size={15} /> Pièces jointes
                        </h4>
                        <label className="text-button">
                          Ajouter un fichier
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain"
                            hidden
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void run(() => addFile(f));
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                      {upload !== null && (
                        <div className="upload-progress">
                          Upload {upload}% <progress max={100} value={upload} />
                          <button onClick={() => uploadTask.current?.cancel()}>
                            Annuler
                          </button>
                        </div>
                      )}
                      {w.data.attachments
                        .filter((a) => a.noteId === draft.id)
                        .map((a) => (
                          <div className="attachment" key={a.id}>
                            <Paperclip size={15} />
                            <button onClick={() => run(() => openFile(a))}>
                              {a.originalName}{" "}
                              {a.status !== "ready" ? "· à reprendre" : ""}
                            </button>
                            <small>{Math.ceil(a.size / 1024)} Ko</small>
                            <button
                              aria-label="Supprimer le fichier"
                              onClick={() =>
                                run(async () => {
                                  await deleteFile(a.storagePath);
                                  await w.del("attachments", a.id);
                                })
                              }
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      <div className="section-row">
                        <h4>
                          <ListTodo size={15} /> Prochaines étapes
                        </h4>
                        <button
                          className="text-button"
                          onClick={() => run(addTask)}
                        >
                          Ajouter une tâche
                        </button>
                      </div>
                      {w.data.tasks
                        .filter((t) => t.noteId === draft.id)
                        .map(taskRow)}
                    </div>
                    <div className="document-end">
                      <span />
                      Chaque idée mérite sa place.
                      <span />
                    </div>
                  </div>
                </>
              ) : (
                <div className="welcome-empty">
                  <div className="empty-illustration">
                    <div className="empty-paper">
                      <Leaf size={30} />
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="empty-star">✳</span>
                  </div>
                  <span className="eyebrow">
                    L’ESPRIT LIBRE, LES IDÉES AU CLAIR
                  </span>
                  <h2>
                    Votre prochaine idée
                    <br />a trouvé sa place.
                  </h2>
                  <p>
                    Sélectionnez une note pour reprendre le fil,
                    <br />
                    ou ouvrez une page blanche.
                  </p>
                  <button className="primary" onClick={() => run(create)}>
                    <Plus size={17} /> Écrire une nouvelle note
                  </button>
                  <div className="empty-bottom">
                    <Leaf size={13} /> Moins de bruit. Plus de sens.
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="content-page">
            <span className="eyebrow">VOTRE ESPACE, À VOTRE FAÇON</span>
            <h1>
              {panel === "tasks"
                ? "Une étape à la fois."
                : panel === "settings"
                  ? "Un espace qui vous ressemble."
                  : panel === "notebooks"
                    ? "Vos carnets."
                    : "Les liens entre vos idées."}
            </h1>
            {panel === "tasks" ? (
              <>
                <p className="muted">
                  Les prochaines étapes de vos notes, réunies au même endroit.
                </p>
                {[
                  "En retard",
                  "Aujourd’hui",
                  "À venir",
                  "Sans échéance",
                  "Terminées",
                ].map((group) => {
                  const today = new Date().toLocaleDateString("en-CA");
                  const tasks = w.data.tasks
                    .filter((t) => activeNotes.some((n) => n.id === t.noteId))
                    .filter((t) =>
                      group === "Terminées"
                        ? t.completed
                        : !t.completed &&
                          (group === "Sans échéance"
                            ? !t.dueAt
                            : group === "En retard"
                              ? !!t.dueAt && t.dueAt < today
                              : group === "Aujourd’hui"
                                ? t.dueAt === today
                                : !!t.dueAt && t.dueAt > today),
                    );
                  return (
                    <div className="task-group" key={group}>
                      <h3>
                        {group}
                        <span>{tasks.length}</span>
                      </h3>
                      {tasks.map(taskRow)}
                      {!tasks.length && (
                        <p className="muted small">Rien ici pour le moment.</p>
                      )}
                    </div>
                  );
                })}
              </>
            ) : panel === "settings" ? (
              <>
                <div className="settings-card">
                  <h3>Apparence</h3>
                  <p>Choisissez votre lumière.</p>
                  <button className="secondary" onClick={() => setDark(!dark)}>
                    {dark ? <Sun size={16} /> : <Moon size={16} />}{" "}
                    {dark
                      ? "Activer le thème clair"
                      : "Activer le thème sombre"}
                  </button>
                </div>
                <div className="settings-card">
                  <h3>Données et sauvegardes</h3>
                  <p>
                    L’export inclut notes, carnets, tags et tâches. Les fichiers
                    joints ne sont pas inclus.
                  </p>
                  <button className="secondary" onClick={() => run(exportAll)}>
                    <Download size={16} /> Exporter mes données
                  </button>
                  <button
                    className="secondary"
                    onClick={() => importInput.current?.click()}
                  >
                    Importer un export JSON
                  </button>
                  <input
                    type="file"
                    accept="application/json,.json"
                    ref={importInput}
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        void run(async () => {
                          if (f.size > 20 * 1024 * 1024)
                            throw new Error("20 Mio maximum.");
                          const parsed = backupSchema.parse(
                            JSON.parse(await f.text()),
                          );
                          setImportData(parsed);
                          setImportReport("");
                        });
                      e.target.value = "";
                    }}
                  />
                  {importReport && <p>{importReport}</p>}
                </div>
                <div className="settings-card">
                  <h3>Accès hors connexion</h3>
                  <p>
                    Sur votre appareil personnel, autorisez un cache persistant
                    des notes consultées. Sur un appareil partagé, conservez le
                    cache mémoire. Ce choix prend effet au rechargement. Les
                    fichiers joints et le démarrage de l’application sans réseau
                    ne sont pas garantis.
                  </p>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      defaultChecked={
                        localStorage.getItem("noteo:trusted") === "true"
                      }
                      onChange={(e) => {
                        localStorage.setItem(
                          "noteo:trusted",
                          String(e.target.checked),
                        );
                        setToast(
                          "Préférence enregistrée. Rechargez la page après synchronisation.",
                        );
                      }}
                    />{" "}
                    Ceci est mon appareil personnel
                  </label>
                </div>
                <div className="settings-card">
                  <h3>Confidentialité et fuseau horaire</h3>
                  <p>
                    Les dates utilisent le fuseau de votre navigateur :{" "}
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}. À
                    Madagascar, utilisez Indian/Antananarivo dans les réglages
                    de votre appareil.
                  </p>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      defaultChecked={
                        localStorage.getItem("noteo:analytics") === "true"
                      }
                      onChange={(e) => {
                        localStorage.setItem(
                          "noteo:analytics",
                          String(e.target.checked),
                        );
                        if (e.target.checked) void enableAnalytics();
                        else
                          setToast(
                            "Rechargez la page pour désactiver la session Analytics actuelle.",
                          );
                      }}
                    />{" "}
                    Autoriser les statistiques d’utilisation (sans contenu des
                    notes)
                  </label>
                </div>
              </>
            ) : (
              <>
                <p className="muted">
                  Organisez vos idées pour retrouver facilement ce qui compte.
                </p>
                <button
                  className="primary"
                  onClick={() =>
                    run(() =>
                      organize(panel === "notebooks" ? "notebooks" : "tags"),
                    )
                  }
                >
                  <Plus size={17} />{" "}
                  {panel === "notebooks" ? "Créer un carnet" : "Créer un tag"}
                </button>
                <div className="organization-grid">
                  {w.data[panel === "notebooks" ? "notebooks" : "tags"].map(
                    (item) => (
                      <div className="organization-card" key={item.id}>
                        <BookOpen size={25} />
                        <h3>{item.name}</h3>
                        <button
                          className="text-button"
                          onClick={() =>
                            go(
                              "notes",
                              `${panel === "notebooks" ? "book" : "tag"}:${item.id}`,
                            )
                          }
                        >
                          Ouvrir <ChevronRight size={14} />
                        </button>
                        <div>
                          <button
                            className="secondary"
                            onClick={() =>
                              run(() =>
                                organize(
                                  panel === "notebooks" ? "notebooks" : "tags",
                                  item.id,
                                ),
                              )
                            }
                          >
                            Renommer
                          </button>
                          <button
                            className="icon-button"
                            aria-label="Supprimer"
                            onClick={() =>
                              run(() =>
                                deleteOrganization(
                                  panel === "notebooks" ? "notebooks" : "tags",
                                  item.id,
                                ),
                              )
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {importData !== null && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmer l’import"
          >
            <h2>Importer vos idées.</h2>
            <p>
              {backupSchema.parse(importData).notes.length} notes seront
              ajoutées avec de nouveaux identifiants. Les fichiers joints ne
              seront pas importés. L’import peut être partiel en cas d’erreur.
            </p>
            <p>{importReport}</p>
            <button
              className="primary"
              disabled={!!importReport}
              onClick={() => run(importAll)}
            >
              Confirmer l’import
            </button>
            <button
              className="secondary"
              disabled={!!importReport}
              onClick={() => setImportData(null)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
