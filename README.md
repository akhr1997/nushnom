# NushNom 🍕

A gamified food review app built for Anushka — search-and-review flow for restaurants in Mumbai (and beyond), with a "pizza progress" mechanic where every review adds a slice, and a sushi-belt loading animation on submit.

## Files

- `NushNom.jsx` — **default theme**: Vintage Arcade (pixel fonts, CRT scanlines, retro palette)
- `NushNom_Modern.jsx` — dark purple/pink theme
- `NushNom_Light.jsx` — warm cream/raspberry light theme
- `PRD.md` — the original product spec this was built from

All three files are self-contained single-file React components with identical functionality — only the visual theme differs.

## Setup

These are React components meant to run as Claude.ai artifacts, or can be adapted into any React project (Vite, Next.js, etc.) with:

- `lucide-react` for icons
- Supabase for shared restaurant/review storage, with local storage fallback when Supabase env vars are not configured

### Database setup

Phase 1 uses Supabase tables for restaurants, Nush's reviews, cuisines, and dishes.

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. Add these environment variables locally and in Netlify:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

The current schema includes public read access and temporary write access for the hidden `/nush` route. Before adding visitor likes/comments, replace the temporary write policies with authenticated or server-side admin writes.

If Supabase is configured, the app reads and writes only to Supabase. Local storage is used only as a fallback when Supabase env vars are not present.

### Curator route

Public visitors see the reviewed dashboard. Nush can add and manage reviews from the hidden `/nush` route. Restaurant search in the add flow uses Foursquare Places when `VITE_FOURSQUARE_API_KEY` is set, and keeps manual restaurant creation as a fallback.

For quick local testing, you can also set `window.NUSHNOM_FOURSQUARE_API_KEY`.

## OpenAI API usage

Sentiment scoring can use the OpenAI Responses API with `gpt-4o`, then blends with the star rating into a "recommendation score" used to rank the dashboard.

For local/client-only use, the app falls back to a simple built-in sentiment checker so obvious negative text like "coffee was really bad" still affects the score. For production, proxy OpenAI calls through a backend instead of exposing an API key in the browser. For quick local testing, set `window.NUSHNOM_OPENAI_API_KEY` or `VITE_OPENAI_API_KEY`.
