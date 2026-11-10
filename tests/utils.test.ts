import { describe, it, expect } from "vitest";
import {
  newNote,
  normalize,
  textFromJson,
  validateFile,
  remapBackup,
  validateContent,
} from "../src/lib/utils";
describe("safe content and backups", () => {
  it("normalizes search without losing French accents in stored text", () =>
    expect(normalize("Idées À Étudier")).toBe("idees a etudier"));
  it("preserves text boundaries between paragraphs", () =>
    expect(
      textFromJson({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ text: "A" }] },
          { type: "paragraph", content: [{ text: "B" }] },
        ],
      }),
    ).toBe("A\nB"));
  it("rejects active file types and excessive payloads", () => {
    expect(() => validateFile({ type: "image/svg+xml", size: 100 })).toThrow();
    expect(() =>
      validateFile({ type: "application/pdf", size: 11 * 1024 * 1024 }),
    ).toThrow();
    expect(() =>
      validateFile({ type: "application/pdf", size: 1024 }),
    ).not.toThrow();
    expect(() => validateContent(JSON.stringify("x".repeat(512001)))).toThrow();
  });
  it("remaps all imported relationships and rejects dangling references", () => {
    const n = newNote("book", "device");
    const input = {
      version: 1,
      notebooks: [
        { id: "book", name: "Test", color: "#fff", createdAt: 1, updatedAt: 1 },
      ],
      notes: [n],
      tags: [],
      tasks: [
        {
          id: "task",
          noteId: n.id,
          title: "Faire",
          completed: false,
          dueAt: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    };
    const d = remapBackup(input);
    expect(d.notes[0].id).not.toBe(n.id);
    expect(d.notes[0].notebookId).toBe(d.notebooks[0].id);
    expect(d.tasks[0].noteId).toBe(d.notes[0].id);
    expect(() => remapBackup({ ...input, notebooks: [] })).toThrow();
  });
  it("rejects malformed document structure and unsafe imported links", () => {
    expect(() => validateContent("{}")).toThrow();
    expect(() =>
      validateContent(
        JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "unsafe",
                  marks: [
                    { type: "link", attrs: { href: "javascript:alert(1)" } },
                  ],
                },
              ],
            },
          ],
        }),
      ),
    ).toThrow();
  });
  it("rejects duplicate ids and malformed JSON before mutation", () => {
    const n = newNote("book", "device");
    expect(() =>
      remapBackup({
        version: 1,
        notes: [n, n],
        notebooks: [],
        tags: [],
        tasks: [],
      }),
    ).toThrow();
    expect(() => validateContent("{oops")).toThrow();
  });
});
