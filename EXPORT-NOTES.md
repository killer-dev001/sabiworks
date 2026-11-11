# Sabi — Source Export Notes

This ZIP is a faithful, unmodified export of the project's source code as it
stood at export time (Lovable project, TanStack Start + React 19 + Tailwind v4
+ Lovable Cloud/Supabase backend).

## What's inside
- `src/` — all application code: routes (homepage, auth, reset-password),
  Sabi design-system components (`src/components/sabi/`), shadcn UI
  components, hooks, libs, styling (`src/styles.css`), and tests.
- `drizzle/` — database schema and the Phase 1 SQL migration.
- `public/` — favicon and robots.txt.
- `media/images/` — the original image binaries used by the site. The app
  references images via Lovable asset-pointer files (`src/assets/*.asset.json`)
  which point to hosted URLs; the actual files are preserved here so the
  design assets are never lost.
- Config files: `package.json`, `vite.config.ts`, `tsconfig.json`,
  `eslint.config.js`, `supabase/config.toml`, `bun.lock`, `.env` (contains
  publishable-only keys, safe to keep or replace for your new host).

## Known state
- Build/typecheck: now clean. See SETUP.md for the Phase 2 migrations and verification steps.
  created (workspace selection, dashboards, discovery, projects, proposals,
  sidebar pages), so the typecheck still fails and the app is not yet
  runnable end-to-end. The export reflects exactly that state.
- Lovable-specific integrations (`src/integrations/*`, asset pointers) are
  part of the source; when moving to another builder, replace these with
  your target platform's equivalents.
