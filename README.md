# website

Personal website. React 19 + TypeScript + Vite, set up as an npm-workspaces monorepo.
The main page is [pip-walk](https://github.com/CmderChris/pip-walk), an interactive 3D scene
(Three.js / react-three-fiber), which lives in this repo as a workspace package.

## Layout

```
apps/web/             the website (Vite + React)
packages/pip-walk/    the pip-walk component (imported with git subtree)
```

## Getting started

Requires Node 24.14.1 or newer (see `packages/pip-walk/.nvmrc`).

```
npm install
npm run dev
```

## Scripts (run from the repo root)

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the website dev server |
| `npm run dev:pip-walk` | Start pip-walk's own standalone dev app |
| `npm run build` | Build the pip-walk library, then the website (output in `apps/web/dist`) |
| `npm run build:lib` | Build only the pip-walk library |
| `npm run lint` | Lint all workspaces |
| `npm run preview` | Preview the production build |
| `npm run sync:pull` | Pull changes from the standalone pip-walk repo into `packages/pip-walk` |
| `npm run sync:push` | Push changes under `packages/pip-walk` to the standalone pip-walk repo |

## How pip-walk is wired in

- npm workspaces symlink `node_modules/pip-walk` to `packages/pip-walk`, so the site imports it as `pip-walk`.
- **Dev:** `apps/web/vite.config.ts` aliases `pip-walk` to its source, so edits hot-reload.
- **Build:** `npm run build` builds the library first; the site then bundles `packages/pip-walk/dist`.
  The component is lazy-loaded in `apps/web/src/App.tsx`, so it ships as a separate chunk.
- **Assets:** the scene's model, textures and environment map are not bundled. `vite.config.ts` serves
  and copies them to `/pip-walk/` (the `assetBase` passed to `<PipWalk>`). If pip-walk gains a new asset,
  add it to the `pipWalkAssets` list in `apps/web/vite.config.ts`.
- React, three and `@react-three/*` are peer dependencies of pip-walk, provided by the site and deduped.
