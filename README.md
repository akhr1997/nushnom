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
- A `window.storage` key-value API (Claude.ai artifact persistence) — if porting outside Claude.ai, replace `loadData()` / `saveData()` in the file with your own persistence layer (e.g. `localStorage`, a backend API, Supabase, etc.)

### Curator route

Public visitors see the reviewed dashboard. Nush can add and manage reviews from the hidden `/nush` route. Restaurant search in the add flow uses Foursquare Places when `VITE_FOURSQUARE_API_KEY` is set, and keeps manual restaurant creation as a fallback.

For quick local testing, you can also set `window.NUSHNOM_FOURSQUARE_API_KEY`.

## OpenAI API usage

Sentiment scoring can use the OpenAI Responses API with `gpt-4o`, then blends with the star rating into a "recommendation score" used to rank the dashboard.

For local/client-only use, the app falls back to a simple built-in sentiment checker so obvious negative text like "coffee was really bad" still affects the score. For production, proxy OpenAI calls through a backend instead of exposing an API key in the browser. For quick local testing, set `window.NUSHNOM_OPENAI_API_KEY` or `VITE_OPENAI_API_KEY`.
