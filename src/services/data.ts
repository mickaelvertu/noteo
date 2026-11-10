import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  limit,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Kind, RecordType } from "../types";
const root = (user: string, kind: Kind) =>
  collection(db, "noteoUsers", user, kind);
function decode(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      v instanceof Timestamp ? v.toMillis() : v,
    ]),
  );
}
export function subscribe(
  user: string,
  kind: Kind,
  count: number,
  onData: (items: RecordType[], pending: boolean, cached: boolean) => void,
  onError: (e: unknown) => void,
) {
  return onSnapshot(
    query(root(user, kind), orderBy("createdAt", "desc"), limit(count)),
    { includeMetadataChanges: true },
    (snap) =>
      onData(
        snap.docs.map(
          (d) =>
            ({
              ...decode(d.data({ serverTimestamps: "estimate" })),
              id: d.id,
            }) as RecordType,
        ),
        snap.metadata.hasPendingWrites,
        snap.metadata.fromCache,
      ),
    onError,
  );
}
export async function save(user: string, kind: Kind, value: RecordType) {
  const { id, ...rest } = value;
  const data: Record<string, unknown> = { ...rest };
  if ("updatedAt" in data) data.updatedAt = serverTimestamp();
  if (typeof data.createdAt === "number")
    data.createdAt = Timestamp.fromMillis(data.createdAt);
  await setDoc(doc(root(user, kind), id), data);
}
export async function remove(user: string, kind: Kind, id: string) {
  await deleteDoc(doc(root(user, kind), id));
}
export async function initializeUser(user: string, name: string) {
  const profile = doc(db, "noteoUsers", user);
  const p = await getDoc(profile);
  if (!p.exists())
    await setDoc(profile, {
      displayName: name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      settings: {},
    });
  const notebook = doc(root(user, "notebooks"), "default");
  if (!(await getDoc(notebook)).exists())
    await setDoc(notebook, {
      name: "Mes notes",
      color: "#346b55",
      createdAt: Timestamp.fromMillis(Date.now()),
      updatedAt: serverTimestamp(),
    });
}
export async function allRecords(user: string, kind: Kind) {
  const result = await getDocs(root(user, kind));
  return result.docs.map(
    (d) => ({ ...decode(d.data()), id: d.id }) as RecordType,
  );
}
