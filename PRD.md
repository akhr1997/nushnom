# PRD: [App Name TBD] — Anushka's Personal Food Review App

## 1. Overview
A gamified, public-facing food review app where **one person (Anushka)** is the sole reviewer/curator, and **anyone** can browse her reviews to decide where to eat — mostly in Mumbai, extensible to all of India. Every review she submits earns her points, levels her up, and updates a public leaderboard-style dashboard of her top picks.

Think: "a foodie influencer's personal Zomato, gamified like a leveling RPG."

## 2. Users & Roles
| Role | Who | Permissions |
|---|---|---|
| **Curator** | Anushka only | Add/edit/delete reviews, earn points, unlock badges |
| **Viewer** | Everyone else (public link) | Browse dashboard, search restaurants, read reviews — read-only |

### Access control approach (Requirement 5)
Since this is a lightweight prototype (no user accounts/backend auth system), the cleanest options are:

- **Option A — Passcode gate (recommended for prototype):** An "Add Review" button is visible to everyone, but tapping it asks for a simple PIN/passcode known only to her. No login screens, no accounts table — just a gate on the write action.
- **Option B — Secret URL:** Public dashboard lives at the main URL; a separate, unlisted `/admin` route is where she adds reviews. Security by obscurity — fine for a fun personal app, not bulletproof.
- **Option C — Real auth (v2):** Email/Google login restricted to her single email address. Correct long-term answer, overkill for a v1 prototype.

**Recommendation:** A + B combined — passcode-protected review form, on a route that isn't linked from the public nav.

## 3. Gamification Layer (Requirement 1 theme)
- **Points per review submitted** (base points), with **bonus points** for: adding dish-level reviews, adding photos, writing a longer/more detailed review.
- **Levels** (e.g. "Street Food Rookie" → "Thali Champion" → "Zaika Legend") based on cumulative points.
- **Streaks** for reviewing in consecutive weeks (optional, fun touch).
- **Badges** (e.g. "First Biryani Review," "5 Cuisines Explored," "10 Reviews in Mumbai").
- Dashboard becomes her personal "game profile."

## 4. Dashboard (Requirement 1)
Public landing page showing:
1. **Anushka's game stats** — points, level, streak, badges, total reviews, cities/cuisines explored.
2. **Top 5 Recommended Places overall** — ranked by a combined score (see §6).
3. **Top 3 Recommended Places per Cuisine** — e.g. Top 3 North Indian, Top 3 Cafes, Top 3 Desserts, etc.
4. *(Suggested addition)* — a searchable/filterable full list of all her reviewed places below the highlights, and a "Recommended Dishes" spotlight strip.

## 5. Adding a Review — Two Entry Points (Requirement 3)
**Flow A — Search & Select**
Type a restaurant name → search results (Mumbai-focused, but works pan-India) → pick the correct one.

**Flow B — Map Select**
A map view showing pins only for restaurants → tap a pin → same review form opens.

> ⚠️ **Prototype constraint:** A live, fully interactive Google Maps embed requires a Google Maps JavaScript API key, which isn't available in this sandboxed prototype environment. For v1 I'll build a **stylized, game-like map view** (custom pins on a styled canvas, positioned by real lat/long) rather than an embedded live Google Map. Functionally identical for her (tap a pin → review form), just not literal Google Maps tiles. If you have a Google Maps API key later, swapping in the real map is a small change.

Both flows should pull from the **same underlying restaurant list** so there's no duplication — restaurants are looked up/added once, reviews attach to them.

## 6. Review Input Form (Requirement 4)
| Field | Type | Notes |
|---|---|---|
| Restaurant | Pre-filled from Flow A/B | Read-only in the form |
| Cuisine | Dropdown | Single or multi-select (e.g. a biryani place could be "Mughlai + North Indian") |
| Overall rating | Star rating (1–5) | Her explicit score |
| Overall review | Textbox | Free text |
| **Smart secondary score** | Auto-generated | Her review text is run through sentiment/quality analysis (via Claude) to produce a second signal — how genuinely enthusiastic/positive the writing is, not just the star number. This blends with her star rating into a single **Recommendation Score** used to rank the dashboard's "Top 5" and "Top 3 per cuisine" (Requirement 4.iii). |
| Dishes tried | Repeatable group | Dish name, photo upload, individual dish rating, individual dish review text |
| Recommended dish | Dropdown (from dishes added above) or free text | "The one dish to try" — highlighted on the restaurant's page |

**Recommendation Score (draft formula):** `(star_rating × 0.7) + (sentiment_score × 0.3)`, normalized to 5. Open to tuning once we see it in action.

## 7. Data Model (draft)
- **Restaurant**: id, name, location (lat/lng, area, city), cuisines[]
- **Review**: id, restaurantId, cuisineTags[], starRating, reviewText, sentimentScore, recommendationScore, recommendedDish, dishes[], pointsEarned, timestamp
- **Dish**: name, photo, dishRating, dishReviewText
- **Profile/Game state**: totalPoints, level, badges[], streak

## 8. Out of Scope for v1 (candidates for v2)
- Real Google Maps tiles (needs API key)
- Public accounts / comments / likes from other users
- Multi-curator support
- Native mobile app (v1 is a responsive web app)

## 9. Tech Approach for the Prototype
- Single-page web app (interactive artifact), works on mobile and desktop.
- Reviews/restaurants/points stored persistently (shared, so everyone viewing sees the same data) — she's the only one who can write to it.
- Sentiment scoring done live via Claude when she submits a review.
- Seed data: a real starter list of well-known Mumbai restaurants so the app isn't empty on first load.

## 10. Open Questions
1. App name — see options in next message.
2. Map style preference.
3. Gamification depth for v1 (simple points+level vs. full badges/streaks).
