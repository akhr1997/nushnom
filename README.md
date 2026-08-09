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

### Google Places API key

Restaurant search uses the Google Places API (Text Search, New). Open the file and set your key here:

```js
const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";
```

Required APIs on that key (Google Cloud Console → APIs & Services):
- **Places API (New)**

Restrict the key with HTTP referrer restrictions once deployed.

### Passcode

Only the "curator" (Anushka) can add or edit/delete reviews, gated by a simple passcode — not real auth, just a lightweight gate:

```js
const PASSCODE = "nushnom25";
```

Change this before sharing the app publicly.

## Anthropic API usage

Two features call the Anthropic Messages API directly from the client:
- **Sentiment scoring** — blends with the star rating into a "recommendation score" used to rank the dashboard
- (Both run client-side; no backend required when used as a Claude.ai artifact, where the API call is proxied automatically)

If you port this outside Claude.ai, you'll need to either proxy these calls through your own backend (recommended, to avoid exposing an Anthropic API key client-side) or adapt the scoring logic.
