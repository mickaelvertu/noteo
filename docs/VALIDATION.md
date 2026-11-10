# Validation

Executed during implementation on 10 November 2026:

- TypeScript typecheck and Vite production build passed.
- Unit tests passed: normalized search, block text extraction, content/file limits, valid import remapping, dangling references, duplicate IDs, malformed document structure and unsafe imported links.
- Firestore/Storage emulator tests passed: owner reads, cross-account/anonymous denial, invalid writes, missing references, valid file upload, prohibited MIME types, excessive file size, and nonexistent-note attachment rejection.
- Emulator lifecycle tests passed: task creation/removal, note edit, trash/restore, immutable creation timestamps, offline queued edits and server confirmation after reconnecting.
- Browser preview checked: login screen, explicitly labeled demo entry, note selection, note creation, title/body editing, list updates, trash and restoration.
- Production dependency audit passed with zero reported vulnerabilities. The gRPC override selects the patched 1.14 release used by Node tooling; browser Firebase transport does not use gRPC.

## Live checks still required

Production Firebase provider activation, real Google/email login, existing shared-project rules integration, real bucket CORS/downloads, interrupted uploads against production, two-device editing conflicts, physical mobile-browser behavior and Hosting publication were not verified or deployed in this session. No production test user or private note was created.

The app does not claim collaborative merge, OCR, background reminders, durable attachment upload queues or a cold offline start. See README for limits and setup steps.
