import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { beforeAll, afterAll, describe, it } from "vitest";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  Timestamp,
  deleteDoc,
  disableNetwork,
  enableNetwork,
  onSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-noteo",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "noteoUsers/alice/notebooks/book"), {
      name: "Book",
      color: "#fff",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, "noteoUsers/alice/notes/note"), {
      title: "Private",
      notebookId: "book",
      tagIds: [],
      contentJson: "{}",
      plainText: "private",
      excerpt: "private",
      isFavorite: false,
      deletedAt: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastEditorDeviceId: "device",
      schemaVersion: 1,
    });
  });
}, 30000);
afterAll(async () => {
  await env?.cleanup();
});
describe("tenant isolation and validation", () => {
  it("creates tasks, preserves note creation dates, and supports trash/restore/cleanup", async () => {
    const db = env.authenticatedContext("alice").firestore();
    const n = doc(db, "noteoUsers/alice/notes/note");
    const original = (await getDoc(n)).data()!;
    await assertSucceeds(
      setDoc(n, {
        ...original,
        title: "Edited",
        deletedAt: Date.now(),
        updatedAt: Timestamp.now(),
      }),
    );
    await assertSucceeds(
      setDoc(n, {
        ...original,
        title: "Restored",
        deletedAt: null,
        updatedAt: Timestamp.now(),
      }),
    );
    const task = doc(db, "noteoUsers/alice/tasks/task");
    await assertSucceeds(
      setDoc(task, {
        noteId: "note",
        title: "Next step",
        completed: false,
        dueAt: "2026-11-11",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }),
    );
    await assertFails(
      setDoc(n, { ...original, createdAt: Timestamp.fromMillis(1) }),
    );
    await assertSucceeds(deleteDoc(task));
  });
  it("queues offline edits and receives server confirmation after reconnecting", async () => {
    const db = env.authenticatedContext("alice").firestore();
    const n = doc(db, "noteoUsers/alice/notes/note");
    const original = (await getDoc(n)).data()!;
    await disableNetwork(db);
    const pending = new Promise<void>((resolve, reject) => {
      const unsub = onSnapshot(
        n,
        { includeMetadataChanges: true },
        (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) {
            unsub();
            resolve();
          }
        },
        reject,
      );
    });
    const written = setDoc(n, {
      ...original,
      title: "Offline edit",
      updatedAt: Timestamp.now(),
    });
    await pending;
    await enableNetwork(db);
    await written;
    const result = await getDoc(n);
    if (
      result.data()?.title !== "Offline edit" ||
      result.metadata.hasPendingWrites
    )
      throw new Error("Offline edit did not synchronize");
  });

  it("allows owner reads and denies cross-account reads and list queries", async () => {
    await assertSucceeds(
      getDoc(
        doc(
          env.authenticatedContext("alice").firestore(),
          "noteoUsers/alice/notes/note",
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          env.authenticatedContext("bob").firestore(),
          "noteoUsers/alice/notes/note",
        ),
      ),
    );
    await assertFails(
      getDocs(
        collection(
          env.authenticatedContext("bob").firestore(),
          "noteoUsers/alice/notes",
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          env.unauthenticatedContext().firestore(),
          "noteoUsers/alice/notes/note",
        ),
      ),
    );
  });
  it("rejects cross-account writes, malformed data, and missing notebook references", async () => {
    await assertFails(
      setDoc(
        doc(
          env.authenticatedContext("bob").firestore(),
          "noteoUsers/alice/notes/evil",
        ),
        { title: "overwrite" },
      ),
    );
    await assertFails(
      setDoc(
        doc(
          env.authenticatedContext("alice").firestore(),
          "noteoUsers/alice/notebooks/invalid",
        ),
        { name: "invalid" },
      ),
    );
    const original = (
      await getDoc(
        doc(
          env.authenticatedContext("alice").firestore(),
          "noteoUsers/alice/notes/note",
        ),
      )
    ).data();
    await assertFails(
      setDoc(
        doc(
          env.authenticatedContext("alice").firestore(),
          "noteoUsers/alice/notes/missing",
        ),
        { ...original, notebookId: "missing" },
      ),
    );
  });
  it("allows safe uploads, denies other users, active types, oversized files, and nonexistent notes", async () => {
    const path = "noteo/alice/note/file/test.txt";
    const bytes = new TextEncoder().encode("private");
    await assertSucceeds(
      uploadBytes(
        ref(env.authenticatedContext("alice").storage(), path),
        bytes,
        { contentType: "text/plain" },
      ),
    );
    await assertFails(
      getBytes(ref(env.authenticatedContext("bob").storage(), path)),
    );
    await assertFails(
      getBytes(ref(env.unauthenticatedContext().storage(), path)),
    );
    await assertFails(
      uploadBytes(ref(env.authenticatedContext("bob").storage(), path), bytes, {
        contentType: "text/plain",
      }),
    );
    await assertFails(
      uploadBytes(
        ref(
          env.authenticatedContext("alice").storage(),
          "noteo/alice/note/file/test.svg",
        ),
        bytes,
        { contentType: "image/svg+xml" },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(
          env.authenticatedContext("alice").storage(),
          "noteo/alice/missing/file/test.txt",
        ),
        bytes,
        { contentType: "text/plain" },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(
          env.authenticatedContext("alice").storage(),
          "noteo/alice/note/file/huge.txt",
        ),
        new Uint8Array(10485761),
        { contentType: "text/plain" },
      ),
    );
  }, 30000);
});
