# Study Globe v2

Personal study workspace prototype with local storage only.

## v2 wording

- Studies are study workspaces.
- Topics are reusable things being studied.
- Notes include written notes, pasted text, images, scriptures/references, timeline entries, research questions, and personal takeaways.
- Search finds studies, topics, notes, tags, and scripture/reference fields.
- Links show how studies, topics, notes, tags, and scriptures relate.

## Data migration

Study Globe v2 keeps the existing `study-globe-v1-data` local storage key and migrates old v1.3 data in the browser:

- Old Topics become Topics.
- Old Topic category and tags carry over.
- Old study items become Notes attached to the migrated Topic.
- Shared records still update everywhere they are used.

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
