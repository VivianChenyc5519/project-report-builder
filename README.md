# Project Builder Tool — Frontend POC

Frontend-only React + TypeScript implementation based on the supplied Figma/PDF prototype.

## Run

```bash
npm install
npm run dev
```

## Implemented interactions

- Desktop-first project overview matching the supplied visual direction.
- Card hover animation: content slides away and **View Details** slides up from the bottom.
- Project arrow opens a project-only view.
- User-added cards show a `−` control in project-only view.
- `+` opens **Import from file** / **Input manually**.
- File import uses the browser file picker only. Search for `BACKEND HANDOFF` to connect parser/upload logic later.
- Manual card form changes dynamically for Metric / Milestone / Image.
- Metric cards support arbitrary string values and multiple bubble entries.
- Metric entries can be added/deleted only while editing the detailed card.
- Detail view has mock Mail / WhatsApp / Slack / external Copy actions.
- Internal card copy/merge uses `⌘C`/`⌘V` on macOS (`Ctrl+C`/`Ctrl+V` also works). Only same-type cards merge.
- Image cards intentionally use a placeholder. Search for `BACKEND HANDOFF` to connect real assets later.

## Backend integration points

The UI currently owns state locally. The main places intended for replacement are marked with `BACKEND HANDOFF` comments:

1. File selection / parsing in `App.tsx`.
2. Image upload / returned image URL.
3. Future persistence for project/card mutations.
4. Future communication-app integrations for share/export.

## Data model

See `src/types.ts`. The frontend contract is intentionally simple so a backend can later return `Project[]` / `SnippetCard` JSON directly.
