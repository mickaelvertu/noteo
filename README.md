# Noteo

A calm, French-first notes workspace built with React, TypeScript, Vite, Tiptap and Firebase. Desktop three-panel layout, responsive mobile navigation, light/dark themes, email/password and Google login, notebooks, tags, favorites, tasks, attachments, trash, JSON backup/import and text/print export.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Choose **Découvrir Noteo sans compte** to explore the explicitly labeled, in-memory demo. Demo data never becomes production data and is discarded on reload or logout. Attachments require a real account.

## Firebase setup

The supplied Firebase web configuration points to **commandegileada**. It contains client identifiers, not administrator credentials. No service account is included.

1. Enable **Email/Password** and **Google** in Firebase Authentication.
2. Add your actual development and hosting domains to Authentication's authorized domains.
3. Create/enable Cloud Firestore and Cloud Storage. Check the project's billing requirements in the console before enabling services.
4. **Review and merge** the `noteoUsers/{uid}` Firestore and `noteo/{uid}` Storage rule blocks into your existing project's rules. The included complete rules are suitable for an isolated emulator. They deny all unrelated paths. Deploying them over an existing application's rules could break that application. Conversely, existing catch-all permissive rules can override the intended isolation because matching allow rules are additive.
5. Add the index exclusions from `firestore.indexes.json` to your existing index configuration. Do not delete existing indexes/exclusions.
6. For authenticated file downloads, configure bucket CORS for the exact deployed origin if browser requests require it. Example: `docs/storage-cors.example.json`; replace its origin before applying it with your authenticated Google Cloud CLI.
7. Test with two accounts before releasing to users.

All Noteo data is namespaced under `noteoUsers/{uid}`. Storage objects live under `noteo/{uid}/{noteId}/{attachmentId}/{safeFilename}`. Authorization is enforced by Firebase rules, not by the client API key or UI.

### Local emulator development

Use Java 21+ for Firebase emulators. In one terminal:

```sh
npx firebase emulators:start --project commandegileada --only auth,firestore,storage
```

In another terminal, copy `.env.example` to `.env.local`, enable `VITE_USE_EMULATORS=true`, and run `npm run dev`. The SDK connects to loopback emulator ports. This workflow is for a local browser on the same machine; a remote device cannot reach your loopback ports.

### Verify

```sh
npm run typecheck
npm test
npm run build
npm run test:rules
```

`test:rules` uses **demo-noteo**, isolated from production, and downloads emulator binaries on its first run. Tests cover import reference integrity, content limits, file validation, owner access, cross-account and anonymous denial, and Storage type/size restrictions. GitHub Actions runs the same checks.

## Deploy only Noteo Hosting

The repository configures target `noteo` without claiming that this globally unique site ID has already been created.

```sh
npx firebase login
npx firebase hosting:sites:list --project commandegileada
# Only if the site does not exist and its ID is available:
npx firebase hosting:sites:create noteo --project commandegileada
npx firebase target:apply hosting noteo noteo --project commandegileada
npm run build
npx firebase deploy --only hosting:noteo --project commandegileada
```

Do not run an unqualified `firebase deploy` against this shared project. Merge/review rules separately. If `noteo` is unavailable, choose and explicitly configure your own site ID. SPA rewrites support refreshes on deep note URLs. No Firebase deployment credentials are committed.

## Data behavior and practical limits

- Autosave waits about 800 ms. Server-confirmed status uses Firestore pending-write/cache metadata; offline writes remain pending.
- Local recovery drafts are stored by account and note before persistence. Navigation flushes the current draft. Failed writes preserve it for recovery when reopening the note. Browser storage failure is surfaced. Drafts can remain on a shared computer: use trusted devices for sensitive notes and clear site data when appropriate.
- Persistent Firestore caching is opt-in in Settings and takes effect after reload. Default cache is in memory. Cached notes can be edited offline; notes not yet cached and attachment binaries are not guaranteed available. The app shell has no service worker, so a cold offline start is not promised. IndexedDB availability varies by browser; if persistent caching cannot initialize, turn off the device preference and reload.
- This is single-user document synchronization, not live collaborative editing. Detected incoming changes during local editing offer a recovery copy or the remote version. Firestore uses last-write behavior for concurrent fields; a CRDT merge is not implemented, and conflicts that occur before a device observes the remote change are not guaranteed to be detected.
- Search covers loaded notes only (100 initially, then increments of 100). It is accent/case insensitive, with notebook/tag/favorite filtering. No PDF/image OCR or account-wide search service. Notebook/tag/task/attachment lists are bounded at 10,000 entries each. Exports fetch all records and should be used with suitably sized accounts.
- Rich content is stored as Tiptap JSON, capped at 500 KiB. The searchable plain-text projection is capped at 200,000 characters. Note titles: 200 characters; notebook/tag names: 80; tags per note: 30. Large projections and attachment binaries never go into the note document.
- Supported attachment types: JPEG, PNG, WebP, GIF, PDF and plain text, up to 10 MiB. Downloads use the authenticated SDK rather than permanently public download links. A rejected or interrupted upload retains an entry; remove it and reselect the file to retry. Upload selections are not retained after reload.
- JSON backup includes notes, notebooks, tags and tasks, **not attachment binaries**. Import validates before mutation, remaps IDs, displays counts, and writes sequentially. It is not atomic: review the reported partial progress before retrying.
- Deleting a notebook moves its notes to a selected remaining notebook. Deleting a tag removes its references. Permanent note deletion cleans attached objects/metadata and linked tasks before deleting the note; failures are reported so the operation can be retried.
- Dates follow the device timezone. For Madagascar, configure **Indian/Antananarivo** on the device. Task deadlines are calendar dates. No background reminders are implemented.
- Google Analytics is optional and consent-based, has no note content events, and never blocks the app. A reload completes disabling an already initialized analytics session.

## Source map

- `src/components/Auth.tsx`: login/signup/reset screens.
- `src/components/Editor.tsx`: rich editor and formatting controls.
- `src/App.tsx`: workspace UI, drafts, organization, tasks, attachments, backups.
- `src/useWorkspace.ts`: account-scoped state, subscriptions and write operations.
- `src/services/data.ts`: Firestore adapter and timestamp conversion.
- `src/lib/utils.ts`: import validation, IDs, content/file validation and text extraction.
- `firestore.rules`, `storage.rules`: owner isolation and payload constraints.

## Release verification

See `docs/VALIDATION.md` for executed checks and remaining live Firebase checks. Production Authentication, rules, bucket CORS and Hosting must be verified using the owner's Firebase access; repository creation alone does not configure those services.
