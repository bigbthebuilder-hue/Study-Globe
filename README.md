# Study Globe v2

Personal study workspace prototype with local storage only.

## v2 structure

- Projects are study workspaces.
- Subjects are reusable things being studied.
- Study Material includes notes, pasted text, images, scriptures/references, timeline entries, research questions, and personal takeaways.
- Search finds projects, subjects, study material, tags, and scripture/reference fields.
- Connections show linked projects, subjects, study material, shared tags, and shared scripture/reference links.

## Data migration

Study Globe v2 keeps the existing `study-globe-v1-data` local storage key and migrates old v1.3 data in the browser:

- Old Topics become Subjects.
- Old Topic category and tags carry over.
- Old study items become Study Material linked to the migrated Subject by ID.
- Linked records are shared by ID, so edits update everywhere they are used.

## Boundaries

- No SQL.
- No archive.
- No sync, login, Supabase, or cloud storage.
- No JW Library import, PDF import, OCR, AI tagging, media import, or globe animation yet.

## Run locally

```bash
npm install
npm run build
npm run dev
```
