# Sabi

A creative services marketplace connecting brands with creatives.

Built with TanStack Start, React 19, TypeScript, Tailwind CSS v4 and Supabase.
Hosted on Netlify.

## Development

```sh
npm install
npm run dev
```

Create a `.env` file with:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## Deploy (Netlify)

Build command `vite build`, publish directory `dist/client` (set in `netlify.toml`).
Add the two `VITE_SUPABASE_*` variables in Netlify site settings.

## Database

Apply the migrations in `drizzle/migrations` in order. See `SETUP.md`.
