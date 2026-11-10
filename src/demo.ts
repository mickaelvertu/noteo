import type { Data } from "./types";
const now = Date.now();
const json = (title: string, body: string) =>
  JSON.stringify({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: title }],
      },
      ...body
        .split("\n")
        .map((text) => ({
          type: "paragraph",
          content: [{ type: "text", text }],
        })),
    ],
  });
export const demoData: Data = {
  notebooks: [
    {
      id: "default",
      name: "Mes notes",
      color: "#637b5c",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "work",
      name: "Projets & travail",
      color: "#cd9b53",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "ideas",
      name: "Idées au fil des jours",
      color: "#7497af",
      createdAt: now,
      updatedAt: now,
    },
  ],
  tags: [
    {
      id: "inspiration",
      name: "inspiration",
      normalizedName: "inspiration",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "important",
      name: "important",
      normalizedName: "important",
      createdAt: now,
      updatedAt: now,
    },
  ],
  notes: [
    [
      "welcome",
      "Un peu de place pour vos idées",
      "default",
      "Bienvenue dans votre nouvel espace.",
      "Une idée, une liste, un projet qui prend forme… Tout commence par une note.\nNoteo vous aide à garder ce qui compte, et à retrouver le fil quand vous en avez besoin.\nCréez des carnets pour vos projets. Ajoutez des tags pour relier vos idées. Et faites de cet espace le vôtre.",
    ],
    [
      "project",
      "Faire grandir un projet",
      "work",
      "Du premier croquis aux prochaines étapes.",
      "Définir une intention claire.\nDécouper le projet en petites étapes concrètes.\nGarder une trace des décisions et des idées à explorer.",
    ],
    [
      "ideas",
      "Les petites idées du matin",
      "ideas",
      "Ces pensées qui méritent de rester.",
      "Un carnet ouvert, un café, dix minutes pour écrire.\nQu’est-ce que j’aimerais essayer cette semaine ?",
    ],
    [
      "reading",
      "À lire, à regarder, à écouter",
      "default",
      "Une collection de découvertes.",
      "Un livre recommandé par un ami.\nUne conversation qui change la perspective.\nUn article à retrouver plus tard.",
    ],
  ].map(([id, title, notebookId, excerpt, body], i) => ({
    id,
    title,
    notebookId,
    tagIds: i === 0 ? ["inspiration"] : [],
    contentJson: json(
      i === 0 ? "Les grandes choses commencent par une petite note." : title,
      body,
    ),
    plainText: body,
    excerpt,
    isFavorite: i === 0,
    deletedAt: null,
    createdAt: now - i * 86400000,
    updatedAt: now - i * 86400000,
    lastEditorDeviceId: "demo",
    schemaVersion: 1,
  })),
  tasks: [],
  attachments: [],
};
