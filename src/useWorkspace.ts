import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "./lib/firebase";
import {
  subscribe,
  save,
  remove,
  initializeUser,
  allRecords,
} from "./services/data";
import {
  emptyData,
  type Data,
  type Kind,
  type RecordType,
  type Note,
} from "./types";
import { demoData } from "./demo";
import { message } from "./lib/utils";
export function useWorkspace() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [demo, setDemo] = useState(false),
    [data, setData] = useState<Data>(emptyData),
    [count, setCount] = useState(100),
    [error, setError] = useState(""),
    [sync, setSync] = useState("Connexion…"),
    [online, setOnline] = useState(navigator.onLine);
  const active = useRef(""),
    pending = useRef(new Set<string>()),
    cached = useRef(new Set<string>());
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        active.current = u?.uid ?? "";
        setData(emptyData);
        setUser(u);
        setReady(true);
        setError("");
      }),
    [],
  );
  useEffect(() => {
    const fn = () => setOnline(navigator.onLine);
    window.addEventListener("online", fn);
    window.addEventListener("offline", fn);
    return () => {
      window.removeEventListener("online", fn);
      window.removeEventListener("offline", fn);
    };
  }, []);
  useEffect(() => {
    if (!user || demo) return;
    const id = user.uid;
    pending.current.clear();
    cached.current.clear();
    let cancelled = false;
    initializeUser(id, user.displayName ?? "").catch(
      (e) => !cancelled && setError(message(e)),
    );
    const unsub = (Object.keys(emptyData) as Kind[]).map((kind) =>
      subscribe(
        id,
        kind,
        kind === "notes" ? count : 10000,
        (items, p, c) => {
          if (active.current !== id) return;
          setData((prev) => ({ ...prev, [kind]: items }));
          p ? pending.current.add(kind) : pending.current.delete(kind);
          c ? cached.current.add(kind) : cached.current.delete(kind);
          setSync(
            pending.current.size
              ? "En attente de synchronisation"
              : cached.current.size
                ? "Données locales"
                : "Synchronisé",
          );
        },
        (e) => {
          if (active.current === id) {
            setError(message(e));
            setSync("Erreur de synchronisation");
          }
        },
      ),
    );
    return () => {
      cancelled = true;
      unsub.forEach((f) => f());
    };
  }, [user, demo, count]);
  async function put(kind: Kind, value: RecordType) {
    if (demo) {
      setData((prev) => ({
        ...prev,
        [kind]: [value, ...prev[kind].filter((x) => x.id !== value.id)],
      }));
      return;
    }
    const id = active.current;
    if (!id) throw new Error("Connectez-vous pour enregistrer.");
    setSync("En attente de synchronisation");
    try {
      await save(id, kind, value);
    } catch (e) {
      if (active.current === id) {
        setError(message(e));
        setSync("Erreur de synchronisation");
      }
      throw e;
    }
  }
  async function del(kind: Kind, id: string) {
    if (demo) {
      setData((prev) => ({
        ...prev,
        [kind]: prev[kind].filter((x) => x.id !== id),
      }));
      return;
    }
    await remove(active.current, kind, id);
  }
  async function logout() {
    if (demo) {
      setDemo(false);
      setData(emptyData);
    } else {
      active.current = "";
      setData(emptyData);
      await signOut(auth);
    }
  }
  function startDemo() {
    active.current = "";
    setDemo(true);
    setData(structuredClone(demoData));
    setSync("Démonstration · non sauvegardée");
  }
  async function getAll(kind: Kind) {
    return demo ? data[kind] : allRecords(active.current, kind);
  }
  async function destroy(
    note: Note,
    deleteFile: (path: string) => Promise<void>,
  ) {
    const attachments = await getAll("attachments");
    for (const a of attachments as Data["attachments"])
      if (a.noteId === note.id) {
        await deleteFile(a.storagePath);
        await del("attachments", a.id);
      }
    for (const t of (await getAll("tasks")) as Data["tasks"])
      if (t.noteId === note.id) await del("tasks", t.id);
    await del("notes", note.id);
  }
  return {
    user,
    ready,
    demo,
    data,
    count,
    setCount,
    error,
    setError,
    sync,
    online,
    put,
    del,
    logout,
    startDemo,
    getAll,
    destroy,
  };
}
