import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Trophy,
  Star,
  MapPin,
  Camera,
  Sparkles,
  Award,
  ChefHat,
  Utensils,
  Plus,
  X,
  Check,
  Flame,
  ArrowLeft,
  Loader2,
  Heart,
  TrendingUp,
  Edit2,
  Trash2,
} from "lucide-react";

const FONT_LINK_ID = "nushnom-fonts";
function useFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&family=Tilt+Neon&display=swap";
    document.head.appendChild(link);
  }, []);
}

const DISPLAY_FONT = "'Tilt Neon', 'Outfit', sans-serif";
const BODY_FONT = "'Outfit', sans-serif";
const MONO_FONT = "'Space Mono', monospace";

const CUISINE_GROUPS = [
  {
    label: "Indian regional",
    cuisines: [
      "North Indian",
      "South Indian",
      "Gujarati",
      "Goan",
      "Modern Indian",
    ],
  },
  {
    label: "Asian",
    cuisines: ["Chinese", "Japanese", "Sushi", "Korean", "Thai", "Asian"],
  },
  {
    label: "Global",
    cuisines: [
      "Italian",
      "Mexican",
      "Middle Eastern",
      "Turkish",
      "Greek",
      "American",
      "Continental",
    ],
  },
  {
    label: "Casual bites",
    cuisines: ["Street Food", "Chaat", "Burgers", "Fast Food"],
  },
  {
    label: "Cafes & sweets",
    cuisines: ["Cafe", "Coffee", "Desserts", "Ice Cream", "Bakery"],
  },
  {
    label: "Dietary",
    cuisines: ["Healthy", "Vegan"],
  },
  {
    label: "Other",
    cuisines: ["Other"],
  },
];

const CUISINES = CUISINE_GROUPS.flatMap((group) => group.cuisines);

const LEGACY_SEED_RESTAURANT_IDS = new Set(
  Array.from({ length: 12 }, (_, i) => `r${i + 1}`)
);

const LEVELS = [
  { name: "Street Food Rookie", min: 0 },
  { name: "Thali Explorer", min: 50 },
  { name: "Curry Connoisseur", min: 150 },
  { name: "Thali Champion", min: 300 },
  { name: "Zaika Legend", min: 500 },
];

const BADGE_DEFS = [
  {
    id: "first-bite",
    label: "First bite",
    icon: "star",
    check: (s) => s.reviews.length >= 1,
  },
  {
    id: "century",
    label: "Century club",
    icon: "trophy",
    check: (s) => s.reviews.length >= 10,
  },
  {
    id: "explorer",
    label: "Cuisine explorer",
    icon: "map",
    check: (s) => s.cuisineCount >= 5,
  },
  {
    id: "shutterbug",
    label: "Shutterbug",
    icon: "camera",
    check: (s) => s.photoCount >= 5,
  },
  {
    id: "top-critic",
    label: "Top critic",
    icon: "flame",
    check: (s) => s.topScoreCount >= 3,
  },
];

function getLevel(points) {
  let current = LEVELS[0];
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].min) {
      current = LEVELS[i];
      idx = i;
    }
  }
  const next = LEVELS[idx + 1];
  return { ...current, idx, next };
}

function computeBadges(reviews) {
  const cuisineSet = new Set();
  let photoCount = 0;
  let topScoreCount = 0;
  reviews.forEach((r) => {
    (r.cuisines || []).forEach((c) => cuisineSet.add(c));
    (r.dishes || []).forEach((d) => {
      if (d.photo) photoCount++;
    });
    if (r.recommendationScore >= 4.5) topScoreCount++;
  });
  const stats = {
    reviews,
    cuisineCount: cuisineSet.size,
    photoCount,
    topScoreCount,
  };
  return BADGE_DEFS.filter((b) => b.check(stats)).map((b) => b.id);
}

const SLICES_PER_PIZZA = 8;
const OPENAI_SENTIMENT_MODEL = "gpt-4o";
const FOURSQUARE_API_VERSION = "2025-06-17";

function getPizzaProgress(reviewCount) {
  const wholePizzas = Math.floor(reviewCount / SLICES_PER_PIZZA);
  const currentSlices = reviewCount % SLICES_PER_PIZZA;
  return { wholePizzas, currentSlices };
}

function wedgePath(i, total, cx, cy, r) {
  const angle = (2 * Math.PI) / total;
  const start = i * angle - Math.PI / 2;
  const end = start + angle;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

async function scoreSentiment(text) {
  if (!text || text.trim().length < 3) return null;
  const fallbackScore = scoreLocalSentiment(text);
  const apiKey =
    window.NUSHNOM_OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return fallbackScore;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_SENTIMENT_MODEL,
        instructions:
          'Score restaurant review text for enthusiasm and positivity, independent of any star rating. Respond with only JSON: {"score": number}. Score is 0 to 5, one decimal place. 5 = ecstatic/glowing, 3 = mixed/neutral, 0 = very negative.',
        input: text,
        text: { format: { type: "json_object" } },
      }),
    });
    if (!response.ok) return fallbackScore;
    const data = await response.json();
    const outputText =
      data.output_text ||
      (data.output || [])
        .flatMap((item) => item.content || [])
        .filter((content) => content.type === "output_text")
        .map((content) => content.text)
        .join("");
    if (!outputText) return fallbackScore;
    const cleaned = outputText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const score = Number(parsed.score);
    return Number.isFinite(score)
      ? Math.max(0, Math.min(5, score))
      : fallbackScore;
  } catch (e) {
    return fallbackScore;
  }
}

function scoreLocalSentiment(text) {
  const normalized = text.toLowerCase();
  const negativeWords = [
    "bad",
    "terrible",
    "awful",
    "horrible",
    "worst",
    "bland",
    "stale",
    "cold",
    "overpriced",
    "disappointing",
    "disappointed",
    "hate",
    "hated",
    "not good",
    "would not",
    "never again",
  ];
  const positiveWords = [
    "amazing",
    "excellent",
    "incredible",
    "perfect",
    "loved",
    "love",
    "delicious",
    "fantastic",
    "favorite",
    "favourite",
    "must try",
    "best",
    "great",
    "recommend",
  ];
  const negativeHits = negativeWords.filter((word) =>
    normalized.includes(word)
  ).length;
  const positiveHits = positiveWords.filter((word) =>
    normalized.includes(word)
  ).length;
  if (negativeHits > positiveHits) {
    return Math.max(0.5, 2.2 - negativeHits * 0.4);
  }
  if (positiveHits > negativeHits) {
    return Math.min(5, 3.6 + positiveHits * 0.35);
  }
  return 3;
}

function calculateRecommendationScore(rating, sentimentScore) {
  const effectiveSentiment = Number.isFinite(sentimentScore)
    ? sentimentScore
    : rating;
  return Math.round((rating * 0.7 + effectiveSentiment * 0.3) * 10) / 10;
}

function getFoursquareArea(place) {
  const location = place.location || {};
  return (
    location.locality ||
    location.neighborhood?.[0] ||
    location.region ||
    location.address ||
    "Mumbai"
  );
}

async function searchFoursquarePlaces(query, signal) {
  if (!query || query.trim().length < 3) return { results: [], error: null };
  const browserApiKey = window.NUSHNOM_FOURSQUARE_API_KEY;
  const useProxy = !browserApiKey;

  try {
    const params = new URLSearchParams({
      query: query.trim(),
      near: "Mumbai, Maharashtra",
      limit: "8",
      sort: "RELEVANCE",
    });
    const url = useProxy
      ? `/api/foursquare/search?${params.toString()}`
      : `https://places-api.foursquare.com/places/search?${params.toString()}`;
    const response = await fetch(url, {
      signal,
      headers: browserApiKey
        ? {
            Accept: "application/json",
            Authorization: `Bearer ${browserApiKey}`,
            "X-Places-Api-Version": FOURSQUARE_API_VERSION,
          }
        : {
            Accept: "application/json",
          },
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        results: [],
        error:
          data.message || `Foursquare search failed (HTTP ${response.status})`,
      };
    }
    return {
      results: (data.results || []).map((place) => {
        const mainGeo = place.geocodes?.main || {};
        const location = place.location || {};
        return {
          id: `fsq-${place.fsq_place_id}`,
          name: place.name || "Unknown restaurant",
          area: getFoursquareArea(place),
          lat: Number(place.latitude ?? mainGeo.latitude) || 19.076,
          lng: Number(place.longitude ?? mainGeo.longitude) || 72.8777,
          address:
            location.formatted_address ||
            [location.address, location.locality, location.region]
              .filter(Boolean)
              .join(", "),
          categories: (place.categories || []).map((category) => category.name),
        };
      }),
      error: null,
    };
  } catch (e) {
    if (e.name === "AbortError") return { results: [], error: null };
    return { results: [], error: "Network error reaching Foursquare" };
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STORAGE_KEY = "nushnom-data";

function removeUnreviewedLegacySeeds(data) {
  const reviews = data.reviews || [];
  const reviewedRestaurantIds = new Set(reviews.map((r) => r.restaurantId));
  return {
    restaurants: (data.restaurants || []).filter(
      (r) =>
        !LEGACY_SEED_RESTAURANT_IDS.has(r.id) || reviewedRestaurantIds.has(r.id)
    ),
    reviews,
  };
}

async function loadData() {
  try {
    const result = await window.storage.get(STORAGE_KEY, true);
    if (result && result.value) {
      return removeUnreviewedLegacySeeds(JSON.parse(result.value));
    }
  } catch (e) {}
  return { restaurants: [], reviews: [] };
}

async function saveData(data) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(data), true);
  } catch (e) {}
}

function StarRating({ value, onChange, size = 22, readOnly = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          fill={(hover || value) >= n ? "#ffd23f" : "none"}
          color={(hover || value) >= n ? "#ffd23f" : "#5c5470"}
          style={{
            cursor: readOnly ? "default" : "pointer",
            transition: "transform 0.1s",
          }}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          onClick={() => !readOnly && onChange && onChange(n)}
        />
      ))}
    </div>
  );
}

function XPRing({ points, level }) {
  const span = level.next ? level.next.min - level.min : 1;
  const progress = level.next ? Math.min(1, (points - level.min) / span) : 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div
      style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}
    >
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#3d2466"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#ffd23f"
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Trophy size={22} color="#ffd23f" />
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: 13,
            color: "#fffbe8",
            fontWeight: 700,
          }}
        >
          {points}
        </span>
      </div>
    </div>
  );
}

function BadgeChip({ badge }) {
  const icons = {
    star: Star,
    trophy: Trophy,
    map: Utensils,
    camera: Camera,
    flame: Flame,
  };
  const Icon = icons[badge.icon] || Award;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "#3d2466",
        border: "1px solid #4a2f7a",
        borderRadius: 2,
        padding: "6px 12px",
        fontSize: 12,
        color: "#fffbe8",
        fontFamily: BODY_FONT,
        fontWeight: 500,
      }}
    >
      <Icon size={13} color="#ff2e63" />
      {badge.label}
    </div>
  );
}

function RestaurantCard({ restaurant, reviews, onClick, badge }) {
  const rReviews = reviews.filter((r) => r.restaurantId === restaurant.id);
  const avgScore = rReviews.length
    ? rReviews.reduce((s, r) => s + r.recommendationScore, 0) / rReviews.length
    : 0;
  const topDish = rReviews.find((r) => r.recommendedDish)?.recommendedDish;
  return (
    <div
      onClick={onClick}
      style={{
        background: "linear-gradient(155deg, #241442, #1a0b2e)",
        border: "1px solid #4a2f7a",
        borderRadius: 4,
        padding: 16,
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        transition: "transform 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.borderColor = "#ff2e63";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "#4a2f7a";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 17,
              color: "#fffbe8",
              fontWeight: 700,
            }}
          >
            {restaurant.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#8b8bc4",
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: 2,
            }}
          >
            <MapPin size={11} /> {restaurant.area}
          </div>
        </div>
        <div
          style={{
            background: "#ffd23f",
            color: "#2e1a00",
            fontFamily: MONO_FONT,
            fontWeight: 700,
            fontSize: 13,
            borderRadius: 2,
            padding: "4px 8px",
            flexShrink: 0,
          }}
        >
          {avgScore.toFixed(1)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {restaurant.cuisines.map((c) => (
          <span
            key={c}
            style={{
              fontSize: 11,
              color: "#8b8bc4",
              background: "#0d0221",
              border: "1px solid #3d2466",
              borderRadius: 2,
              padding: "3px 8px",
            }}
          >
            {c}
          </span>
        ))}
      </div>
      {topDish && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "#ff85a8",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <ChefHat size={13} /> Try the {topDish}
        </div>
      )}
      {badge && (
        <div
          style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            color: "#2e1a00",
            background: "#ff85a8",
            borderRadius: 2,
            padding: "4px 8px",
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          <Flame size={12} /> {badge}
        </div>
      )}
    </div>
  );
}

function RestaurantDetailsModal({ restaurant, reviews, onClose }) {
  const rReviews = reviews
    .filter((r) => r.restaurantId === restaurant.id)
    .sort((a, b) => b.timestamp - a.timestamp);
  const avgScore = rReviews.length
    ? rReviews.reduce((s, r) => s + r.recommendationScore, 0) / rReviews.length
    : 0;
  const cuisines = Array.from(
    new Set([
      ...(restaurant.cuisines || []),
      ...rReviews.flatMap((r) => r.cuisines || []),
    ])
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(13, 2, 33, 0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          maxHeight: "88vh",
          overflowY: "auto",
          background: "#1a0b2e",
          border: "1px solid #4a2f7a",
          borderRadius: 4,
          padding: 20,
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 20,
                color: "#fffbe8",
                lineHeight: 1.3,
              }}
            >
              {restaurant.name}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#8b8bc4",
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginTop: 5,
              }}
            >
              <MapPin size={12} /> {restaurant.area}
            </div>
          </div>
          <button
            aria-label="Close details"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#8b8bc4",
              cursor: "pointer",
              height: 28,
            }}
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Average recommendation</div>
          <div
            style={{
              display: "inline-flex",
              background: "#ffd23f",
              color: "#2e1a00",
              fontFamily: MONO_FONT,
              fontSize: 13,
              borderRadius: 2,
              padding: "6px 10px",
            }}
          >
            {avgScore.toFixed(1)}/5
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Cuisines</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {cuisines.map((c) => (
              <span
                key={c}
                style={{
                  fontSize: 11,
                  color: "#8b8bc4",
                  background: "#0d0221",
                  border: "1px solid #3d2466",
                  borderRadius: 2,
                  padding: "3px 8px",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rReviews.map((rv) => (
            <div
              key={rv.id}
              style={{
                background: "#0d0221",
                border: "1px solid #3d2466",
                borderRadius: 3,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={labelStyle}>Overall rating</div>
                  <StarRating value={rv.starRating} readOnly size={16} />
                  <div style={{ ...labelStyle, marginTop: 10 }}>
                    Review date
                  </div>
                  <div style={{ fontSize: 11, color: "#8b8bc4", marginTop: 5 }}>
                    {new Date(rv.timestamp).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>Recommendation score</div>
                  <div style={{ fontSize: 12, color: "#ffd23f" }}>
                    {rv.recommendationScore}/5
                  </div>
                  {rv.mustTry && (
                    <>
                      <div style={{ ...labelStyle, marginTop: 10 }}>
                        Must try
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          color: "#ff85a8",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <Flame size={13} /> Yes
                      </div>
                    </>
                  )}
                </div>
              </div>
              {rv.recommendedDish && (
                <div style={{ marginBottom: 10 }}>
                  <div style={labelStyle}>Recommended dish</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#ff85a8",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <ChefHat size={13} /> {rv.recommendedDish}
                  </div>
                </div>
              )}
              <div style={labelStyle}>Overall review</div>
              <div
                style={{
                  color: "#fffbe8",
                  fontSize: 14,
                  lineHeight: 1.5,
                  marginBottom: (rv.dishes || []).length ? 12 : 0,
                }}
              >
                {rv.reviewText}
              </div>

              {(rv.dishes || []).length > 0 && (
                <div>
                  <div style={labelStyle}>Dishes tried</div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {(rv.dishes || []).map((d) => (
                      <div
                        key={d.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: d.photo ? "72px 1fr" : "1fr",
                          gap: 10,
                          background: "#1a0b2e",
                          border: "1px solid #3d2466",
                          borderRadius: 3,
                          padding: 10,
                        }}
                      >
                        {d.photo && (
                          <img
                            src={d.photo}
                            alt={d.name || "Dish"}
                            style={{
                              width: 72,
                              height: 72,
                              borderRadius: 2,
                              objectFit: "cover",
                            }}
                          />
                        )}
                        <div>
                          <div style={labelStyle}>Dish name</div>
                          <div
                            style={{
                              color: "#fffbe8",
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            {d.name || "Unnamed dish"}
                          </div>
                          <div style={{ ...labelStyle, marginTop: 8 }}>
                            Dish rating
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <StarRating
                              value={d.rating || 0}
                              readOnly
                              size={13}
                            />
                          </div>
                          {d.review && (
                            <>
                              <div style={{ ...labelStyle, marginTop: 8 }}>
                                Dish review
                              </div>
                              <div
                                style={{
                                  color: "#8b8bc4",
                                  fontSize: 12,
                                  lineHeight: 1.45,
                                  marginTop: 6,
                                }}
                              >
                                {d.review}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const btnPrimary = {
  flex: 1,
  background: "#ff2e63",
  color: "#3d0d1f",
  border: "none",
  borderRadius: 3,
  padding: "10px 14px",
  fontWeight: 700,
  fontFamily: BODY_FONT,
  fontSize: 14,
  cursor: "pointer",
};
const btnGhost = {
  flex: 1,
  background: "transparent",
  color: "#8b8bc4",
  border: "1px solid #4a2f7a",
  borderRadius: 3,
  padding: "10px 14px",
  fontWeight: 500,
  fontFamily: BODY_FONT,
  fontSize: 14,
  cursor: "pointer",
};
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 3,
  border: "1px solid #4a2f7a",
  background: "#0d0221",
  color: "#fffbe8",
  fontSize: 14,
  boxSizing: "border-box",
  fontFamily: BODY_FONT,
};
const labelStyle = {
  fontSize: 12,
  color: "#8b8bc4",
  marginBottom: 6,
  display: "block",
  fontWeight: 500,
};

function SushiBeltLoader() {
  const items = ["🍣", "🍤", "🍱", "🍙", "🥢", "🍣", "🍤", "🍱", "🍙", "🥢"];
  return (
    <div
      style={{
        width: "100%",
        overflow: "hidden",
        background: "#0d0221",
        border: "2px solid #4a2f7a",
        borderRadius: 4,
        padding: "16px 0 10px",
        marginBottom: 20,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 28,
          width: "max-content",
          animation: "beltScroll 6s linear infinite",
        }}
      >
        {[...items, ...items].map((emoji, i) => (
          <span key={i} style={{ fontSize: 30 }}>
            {emoji}
          </span>
        ))}
      </div>
      <div
        style={{
          marginTop: 10,
          height: 5,
          background:
            "repeating-linear-gradient(90deg, #ffd23f 0 10px, transparent 10px 20px)",
        }}
      />
    </div>
  );
}

function DishRow({ dish, onChange, onRemove }) {
  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    onChange({ ...dish, photo: b64 });
  };
  return (
    <div
      style={{
        background: "#0d0221",
        border: "1px solid #3d2466",
        borderRadius: 3,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Dish name"
          value={dish.name}
          onChange={(e) => onChange({ ...dish, name: e.target.value })}
        />
        <button
          onClick={onRemove}
          style={{
            background: "none",
            border: "none",
            color: "#ff2e63",
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <StarRating
          value={dish.rating}
          onChange={(n) => onChange({ ...dish, rating: n })}
          size={16}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#8b8bc4",
            cursor: "pointer",
          }}
        >
          <Camera size={14} /> {dish.photo ? "Change photo" : "Add photo"}
          <input
            type="file"
            accept="image/*"
            onChange={handlePhoto}
            style={{ display: "none" }}
          />
        </label>
        {dish.photo && (
          <img
            src={dish.photo}
            alt=""
            style={{
              width: 32,
              height: 32,
              borderRadius: 2,
              objectFit: "cover",
            }}
          />
        )}
      </div>
      <textarea
        style={{ ...inputStyle, resize: "vertical", minHeight: 50 }}
        placeholder="What did you think of this dish?"
        value={dish.review}
        onChange={(e) => onChange({ ...dish, review: e.target.value })}
      />
    </div>
  );
}

function CuisineSelector({ selected, onToggle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
      {CUISINE_GROUPS.map((group) => (
        <div key={group.label}>
          <div
            style={{
              ...labelStyle,
              marginBottom: 7,
              color: "#5c5470",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {group.label}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {group.cuisines.map((c) => (
              <span
                key={c}
                onClick={() => onToggle(c)}
                style={{
                  fontSize: 12,
                  padding: "6px 12px",
                  borderRadius: 2,
                  cursor: "pointer",
                  border: `1px solid ${
                    selected.includes(c) ? "#ff2e63" : "#3d2466"
                  }`,
                  background: selected.includes(c) ? "#3d0d1f" : "#0d0221",
                  color: selected.includes(c) ? "#ff85a8" : "#8b8bc4",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AddReviewFlow({
  restaurants,
  reviews,
  onAddRestaurant,
  onSubmit,
  onClose,
}) {
  const [mode, setMode] = useState("pick");
  const [query, setQuery] = useState("");
  const [restaurant, setRestaurant] = useState(null);
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState("");
  const [foursquareResults, setFoursquareResults] = useState([]);
  const [foursquareSearching, setFoursquareSearching] = useState(false);
  const [foursquareError, setFoursquareError] = useState(null);

  const [cuisines, setCuisines] = useState([]);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [mustTry, setMustTry] = useState(false);
  const [dishes, setDishes] = useState([]);
  const [recommendedDish, setRecommendedDish] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  const filtered =
    query.trim().length >= 2
      ? restaurants.filter((r) =>
          r.name.toLowerCase().includes(query.toLowerCase())
        )
      : [];
  const foursquareDropdownResults = foursquareResults.filter(
    (place) =>
      !filtered.some(
        (r) =>
          r.name.toLowerCase() === place.name.toLowerCase() || r.id === place.id
      )
  );

  useEffect(() => {
    setNewName((current) => {
      if (!current.trim()) return query;
      return current === query.slice(0, -1) || query.startsWith(current)
        ? query
        : current;
    });
  }, [query]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setFoursquareResults([]);
      setFoursquareError(null);
      setFoursquareSearching(false);
      return;
    }

    const controller = new AbortController();
    setFoursquareSearching(true);
    setFoursquareError(null);
    const t = window.setTimeout(async () => {
      const { results, error } = await searchFoursquarePlaces(
        trimmed,
        controller.signal
      );
      if (!controller.signal.aborted) {
        setFoursquareResults(results);
        setFoursquareError(error);
        setFoursquareSearching(false);
      }
    }, 900);

    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  const pickRestaurant = (r) => {
    setRestaurant(r);
    setCuisines(r.cuisines.length ? [r.cuisines[0]] : []);
    setMode("review");
  };

  const addNewRestaurant = () => {
    if (!newName.trim()) return;
    const r = {
      id: "r" + Date.now(),
      name: newName.trim(),
      area: newArea.trim() || "Mumbai",
      lat: 19.0 + Math.random() * 0.15,
      lng: 72.82 + Math.random() * 0.05,
      cuisines: [],
    };
    onAddRestaurant(r);
    pickRestaurant(r);
  };

  const pickFoursquareResult = (place) => {
    const existing = restaurants.find(
      (r) =>
        r.name.toLowerCase() === place.name.toLowerCase() ||
        r.id === place.id
    );
    if (existing) {
      pickRestaurant(existing);
      return;
    }
    const r = {
      id: place.id,
      name: place.name,
      area: place.area,
      lat: place.lat,
      lng: place.lng,
      cuisines: [],
    };
    onAddRestaurant(r);
    pickRestaurant(r);
  };

  const toggleCuisine = (c) => {
    setCuisines((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const addDish = () =>
    setDishes((prev) => [
      ...prev,
      {
        id: "d" + Date.now() + Math.random(),
        name: "",
        rating: 0,
        review: "",
        photo: null,
      },
    ]);
  const updateDish = (id, val) =>
    setDishes((prev) => prev.map((d) => (d.id === id ? val : d)));
  const removeDish = (id) =>
    setDishes((prev) => prev.filter((d) => d.id !== id));

  const canSubmit =
    restaurant &&
    cuisines.length > 0 &&
    rating > 0 &&
    reviewText.trim().length > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    const sentimentScore = await scoreSentiment(reviewText);
    const recommendationScore = calculateRecommendationScore(
      rating,
      sentimentScore
    );
    const review = {
      id: "rev" + Date.now(),
      restaurantId: restaurant.id,
      cuisines,
      starRating: rating,
      reviewText,
      mustTry,
      sentimentScore,
      recommendationScore,
      dishes,
      recommendedDish: recommendedDish || null,
      timestamp: Date.now(),
    };
    setSubmitting(false);
    setDone(review);
    onSubmit(review);
  };

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => {
      onClose();
    }, 2400);
    return () => clearTimeout(t);
  }, [done]);

  if (done) {
    const completedReviewCount = Math.max(1, reviews.length);
    const { wholePizzas, currentSlices } = getPizzaProgress(completedReviewCount);
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 18,
            color: "#fffbe8",
            marginBottom: 6,
          }}
        >
          Review logged!
        </div>
        <div style={{ fontSize: 13, color: "#8b8bc4", marginBottom: 20 }}>
          {restaurant.name} · recommendation score {done.recommendationScore}/5
        </div>
        <SushiBeltLoader />
        <div
          style={{
            fontFamily: MONO_FONT,
            fontSize: 13,
            color: "#ffd23f",
          }}
        >
          🍕 Slice {currentSlices === 0 ? SLICES_PER_PIZZA : currentSlices}/
          {SLICES_PER_PIZZA} added
          {currentSlices === 0 ? ` · pizza #${wholePizzas} complete!` : ""}
        </div>
        <div style={{ fontSize: 11, color: "#5c5470", marginTop: 16 }}>
          Heading back to your dashboard...
        </div>
      </div>
    );
  }

  if (mode === "pick") {
    return (
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 20,
              color: "#fffbe8",
            }}
          >
            Find a restaurant
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#8b8bc4",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>
        <input
          style={inputStyle}
          placeholder="Search restaurants in Mumbai..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          {filtered.length > 0 && (
            <div
              style={{
                fontSize: 11,
                color: "#5c5470",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginTop: 2,
              }}
            >
              Already on NushNom
            </div>
          )}
          {filtered.map((r) => (
            <div
              key={r.id}
              onClick={() => pickRestaurant(r)}
              style={{
                background: "#0d0221",
                border: "1px solid #3d2466",
                borderRadius: 3,
                padding: "10px 14px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{ color: "#fffbe8", fontSize: 14, fontWeight: 500 }}
                >
                  {r.name}
                </div>
                <div style={{ color: "#8b8bc4", fontSize: 12 }}>{r.area}</div>
              </div>
              <Plus size={16} color="#ff2e63" />
            </div>
          ))}

          {query.trim().length >= 3 && (
            <div
              style={{
                fontSize: 11,
                color: "#5c5470",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginTop: filtered.length ? 10 : 2,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              From Foursquare{" "}
              {foursquareSearching && <Loader2 size={11} className="spin" />}
            </div>
          )}
          {foursquareError && (
            <div
              style={{
                color: "#8b8bc4",
                fontSize: 13,
                background: "#2a0d10",
                border: "1px solid #ff2e63",
                borderRadius: 3,
                padding: 14,
              }}
            >
              {foursquareError}
            </div>
          )}
          {foursquareDropdownResults.map((place) => (
            <div
              key={place.id}
              onClick={() => pickFoursquareResult(place)}
              style={{
                background: "#0d0221",
                border: "1px solid #3d2466",
                borderRadius: 3,
                padding: "10px 14px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{ color: "#fffbe8", fontSize: 14, fontWeight: 500 }}
                >
                  {place.name}
                </div>
                <div
                  style={{
                    color: "#8b8bc4",
                    fontSize: 12,
                    marginTop: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                  }}
                  title={place.address}
                >
                  {place.area}
                </div>
              </div>
              <Plus size={16} color="#ff2e63" />
            </div>
          ))}
          {query.trim().length >= 3 &&
            !foursquareSearching &&
            !foursquareError &&
            filtered.length === 0 &&
            foursquareDropdownResults.length === 0 && (
              <div
                style={{
                  color: "#8b8bc4",
                  fontSize: 13,
                  background: "#0d0221",
                  border: "1px dashed #4a2f7a",
                  borderRadius: 3,
                  padding: 14,
                }}
              >
                No Foursquare match found. Add it manually below.
              </div>
            )}
          {query.trim().length >= 3 && (
            <div style={{ color: "#5c5470", fontSize: 11 }}>
              Place search powered by{" "}
              <a
                href="https://foursquare.com/products/places"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#8b8bc4" }}
              >
                Foursquare Places
              </a>
            </div>
          )}
          <div
            style={{
              background: "#0d0221",
              border: "1px dashed #4a2f7a",
              borderRadius: 3,
              padding: 14,
            }}
          >
            <div style={{ color: "#fffbe8", fontSize: 14, marginBottom: 8 }}>
              Add a new restaurant
            </div>
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              placeholder="Restaurant name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              placeholder="Area (e.g. Bandra)"
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
            />
            <button
              disabled={!newName.trim()}
              onClick={addNewRestaurant}
              style={{
                ...btnPrimary,
                flex: "none",
                opacity: newName.trim() ? 1 : 0.5,
              }}
            >
              Add and continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => setMode("pick")}
          style={{
            background: "none",
            border: "none",
            color: "#8b8bc4",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 19,
              color: "#fffbe8",
            }}
          >
            {restaurant.name}
          </div>
          <div style={{ fontSize: 12, color: "#8b8bc4" }}>
            {restaurant.area}
          </div>
        </div>
      </div>

      <label style={labelStyle}>Cuisine</label>
      <CuisineSelector selected={cuisines} onToggle={toggleCuisine} />

      <label style={labelStyle}>Overall rating</label>
      <div style={{ marginBottom: 16 }}>
        <StarRating value={rating} onChange={setRating} />
      </div>

      <label style={labelStyle}>Overall review</label>
      <textarea
        style={{
          ...inputStyle,
          minHeight: 80,
          resize: "vertical",
          marginBottom: 16,
        }}
        placeholder="How was the food, service, vibe..."
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
      />

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#fffbe8",
          fontSize: 13,
          marginBottom: 16,
          cursor: "pointer",
          width: "fit-content",
        }}
      >
        <input
          type="checkbox"
          checked={mustTry}
          onChange={(e) => setMustTry(e.target.checked)}
          style={{ accentColor: "#ff2e63" }}
        />
        Must Try
      </label>

      <label style={labelStyle}>Dishes you tried</label>
      {dishes.map((d) => (
        <DishRow
          key={d.id}
          dish={d}
          onChange={(val) => updateDish(d.id, val)}
          onRemove={() => removeDish(d.id)}
        />
      ))}
      <button
        onClick={addDish}
        style={{
          ...btnGhost,
          flex: "none",
          marginBottom: 16,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Plus size={14} /> Add a dish
      </button>

      {dishes.some((d) => d.name) && (
        <>
          <label style={labelStyle}>Dish you'd recommend to others</label>
          <select
            style={{ ...inputStyle, marginBottom: 16 }}
            value={recommendedDish}
            onChange={(e) => setRecommendedDish(e.target.value)}
          >
            <option value="">None in particular</option>
            {dishes
              .filter((d) => d.name)
              .map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
          </select>
        </>
      )}

      <button
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
        style={{
          ...btnPrimary,
          flex: "none",
          width: "100%",
          opacity: !canSubmit || submitting ? 0.5 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="spin" /> Scoring your review...
          </>
        ) : (
          "Submit review"
        )}
      </button>
    </div>
  );
}

function PizzaTracker({ reviewCount, onAddReview }) {
  const { wholePizzas, currentSlices } = getPizzaProgress(reviewCount);
  const cx = 60,
    cy = 60,
    r = 50;
  return (
    <div
      style={{
        background: "#1a0b2e",
        border: "1px solid #4a2f7a",
        borderRadius: 4,
        padding: 20,
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 20,
        flexWrap: "wrap",
      }}
    >
      <svg
        width="110"
        height="110"
        viewBox="0 0 120 120"
        style={{ flexShrink: 0 }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="#0d0221"
          stroke="#4a2f7a"
          strokeWidth="2"
        />
        {Array.from({ length: SLICES_PER_PIZZA }).map((_, i) => (
          <path
            key={i}
            d={wedgePath(i, SLICES_PER_PIZZA, cx, cy, r - 2)}
            fill={i < currentSlices ? "#ffd23f" : "transparent"}
            stroke="#4a2f7a"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 16,
            color: "#fffbe8",
            marginBottom: 4,
          }}
        >
          Pizza progress
        </div>
        <div style={{ fontSize: 12, color: "#8b8bc4", marginBottom: 8 }}>
          Slice {currentSlices}/{SLICES_PER_PIZZA} in this pie · every review
          adds a slice
        </div>
        <div
          style={{
            fontFamily: MONO_FONT,
            fontSize: 13,
            color: "#ffd23f",
          }}
        >
          🍕 {wholePizzas} whole {wholePizzas === 1 ? "pizza" : "pizzas"} baked
        </div>
      </div>
      {onAddReview && (
        <button
          onClick={onAddReview}
          style={{
            ...btnPrimary,
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 20px",
          }}
        >
          <Plus size={16} /> Add review
        </button>
      )}
    </div>
  );
}

function EditReviewForm({ review, restaurant, onSave, onCancel }) {
  const [cuisines, setCuisines] = useState(review.cuisines || []);
  const [rating, setRating] = useState(review.starRating);
  const [reviewText, setReviewText] = useState(review.reviewText);
  const [mustTry, setMustTry] = useState(Boolean(review.mustTry));
  const [dishes, setDishes] = useState(review.dishes || []);
  const [recommendedDish, setRecommendedDish] = useState(
    review.recommendedDish || ""
  );
  const [submitting, setSubmitting] = useState(false);

  const toggleCuisine = (c) =>
    setCuisines((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  const addDish = () =>
    setDishes((prev) => [
      ...prev,
      {
        id: "d" + Date.now() + Math.random(),
        name: "",
        rating: 0,
        review: "",
        photo: null,
      },
    ]);
  const updateDish = (id, val) =>
    setDishes((prev) => prev.map((d) => (d.id === id ? val : d)));
  const removeDish = (id) =>
    setDishes((prev) => prev.filter((d) => d.id !== id));

  const canSave =
    cuisines.length > 0 && rating > 0 && reviewText.trim().length > 0;

  const handleSave = async () => {
    setSubmitting(true);
    const sentimentScore = await scoreSentiment(reviewText);
    const recommendationScore = calculateRecommendationScore(
      rating,
      sentimentScore
    );
    onSave({
      cuisines,
      starRating: rating,
      reviewText,
      mustTry,
      sentimentScore,
      recommendationScore,
      dishes,
      recommendedDish: recommendedDish || null,
    });
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <button
          onClick={onCancel}
          style={{
            background: "none",
            border: "none",
            color: "#8b8bc4",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 19,
              color: "#fffbe8",
            }}
          >
            Edit review
          </div>
          <div style={{ fontSize: 12, color: "#8b8bc4" }}>
            {restaurant ? restaurant.name : "Unknown restaurant"}
          </div>
        </div>
      </div>

      <label style={labelStyle}>Cuisine</label>
      <CuisineSelector selected={cuisines} onToggle={toggleCuisine} />

      <label style={labelStyle}>Overall rating</label>
      <div style={{ marginBottom: 16 }}>
        <StarRating value={rating} onChange={setRating} />
      </div>

      <label style={labelStyle}>Overall review</label>
      <textarea
        style={{
          ...inputStyle,
          minHeight: 80,
          resize: "vertical",
          marginBottom: 16,
        }}
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
      />

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#fffbe8",
          fontSize: 13,
          marginBottom: 16,
          cursor: "pointer",
          width: "fit-content",
        }}
      >
        <input
          type="checkbox"
          checked={mustTry}
          onChange={(e) => setMustTry(e.target.checked)}
          style={{ accentColor: "#ff2e63" }}
        />
        Must Try
      </label>

      <label style={labelStyle}>Dishes you tried</label>
      {dishes.map((d) => (
        <DishRow
          key={d.id}
          dish={d}
          onChange={(val) => updateDish(d.id, val)}
          onRemove={() => removeDish(d.id)}
        />
      ))}
      <button
        onClick={addDish}
        style={{
          ...btnGhost,
          flex: "none",
          marginBottom: 16,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Plus size={14} /> Add a dish
      </button>

      {dishes.some((d) => d.name) && (
        <>
          <label style={labelStyle}>Dish you'd recommend to others</label>
          <select
            style={{ ...inputStyle, marginBottom: 16 }}
            value={recommendedDish}
            onChange={(e) => setRecommendedDish(e.target.value)}
          >
            <option value="">None in particular</option>
            {dishes
              .filter((d) => d.name)
              .map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
          </select>
        </>
      )}

      <button
        disabled={!canSave || submitting}
        onClick={handleSave}
        style={{
          ...btnPrimary,
          flex: "none",
          width: "100%",
          opacity: !canSave || submitting ? 0.5 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="spin" /> Saving...
          </>
        ) : (
          "Save changes"
        )}
      </button>
    </div>
  );
}

function ManageReviews({
  restaurants,
  reviews,
  onUpdateReview,
  onDeleteReview,
  onClose,
}) {
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  if (editingId) {
    const review = reviews.find((r) => r.id === editingId);
    const restaurant = restaurants.find((r) => r.id === review.restaurantId);
    return (
      <EditReviewForm
        review={review}
        restaurant={restaurant}
        onCancel={() => setEditingId(null)}
        onSave={(updates) => {
          onUpdateReview(editingId, updates);
          setEditingId(null);
        }}
      />
    );
  }

  const sorted = [...reviews].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 20,
            color: "#fffbe8",
          }}
        >
          Manage reviews
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#8b8bc4",
            cursor: "pointer",
          }}
        >
          <X size={20} />
        </button>
      </div>

      {sorted.length === 0 ? (
        <div
          style={{
            color: "#8b8bc4",
            fontSize: 13,
            textAlign: "center",
            padding: "30px 0",
          }}
        >
          No reviews yet.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            maxHeight: 480,
            overflowY: "auto",
          }}
        >
          {sorted.map((rv) => {
            const restaurant = restaurants.find(
              (r) => r.id === rv.restaurantId
            );
            return (
              <div
                key={rv.id}
                style={{
                  background: "#0d0221",
                  border: "1px solid #3d2466",
                  borderRadius: 3,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: "#fffbe8",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {restaurant ? restaurant.name : "Unknown restaurant"}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 3,
                      }}
                    >
                      <StarRating value={rv.starRating} readOnly size={13} />
                      <span style={{ fontSize: 11, color: "#8b8bc4" }}>
                        {new Date(rv.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#8b8bc4", marginTop: 6 }}
                    >
                      {rv.reviewText.length > 130
                        ? rv.reviewText.slice(0, 130) + "…"
                        : rv.reviewText}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => setEditingId(rv.id)}
                      style={{
                        background: "none",
                        border: "1px solid #4a2f7a",
                        borderRadius: 2,
                        padding: 7,
                        cursor: "pointer",
                        color: "#8b8bc4",
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(rv.id)}
                      style={{
                        background: "none",
                        border: "1px solid #ff2e63",
                        borderRadius: 2,
                        padding: 7,
                        cursor: "pointer",
                        color: "#ff2e63",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {confirmDeleteId === rv.id && (
                  <div
                    style={{
                      marginTop: 10,
                      background: "#2a0d10",
                      border: "1px solid #ff2e63",
                      borderRadius: 2,
                      padding: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "#ff85a8" }}>
                      Delete this review permanently?
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{
                          ...btnGhost,
                          flex: "none",
                          padding: "6px 12px",
                          fontSize: 12,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          onDeleteReview(rv.id);
                          setConfirmDeleteId(null);
                        }}
                        style={{
                          ...btnPrimary,
                          flex: "none",
                          padding: "6px 12px",
                          fontSize: 12,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DashboardStats({ stats }) {
  const items = [
    { label: "Nush average", value: stats.averageScore, detail: "Across reviewed places", icon: Trophy, color: "#ffd23f" },
    { label: "Cuisine crush", value: stats.topCuisine, detail: `${stats.topCuisineCount} ${stats.topCuisineCount === 1 ? "review" : "reviews"}`, icon: Utensils, color: "#ff2e63" },
    { label: "Dish diary", value: stats.dishCount, detail: `${stats.photoCount} with photos`, icon: ChefHat, color: "#ff85a8" },
    { label: "Hit rate", value: stats.hitRate, detail: "Rated 4.5+", icon: Flame, color: "#ff7a3d" },
  ];

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Award size={18} color="#ffd23f" />
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: 18, color: "#fffbe8" }}>Nush stats</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 12 }}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} style={{ background: "#1a0b2e", border: "1px solid #4a2f7a", borderRadius: 4, padding: 14, minHeight: 96 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#8b8bc4" }}>{item.label}</div>
                <Icon size={16} color={item.color} />
              </div>
              <div style={{ color: "#fffbe8", fontFamily: DISPLAY_FONT, fontSize: 16, lineHeight: 1.35, overflowWrap: "anywhere" }}>{item.value}</div>
              <div style={{ color: "#8b8bc4", fontSize: 12, marginTop: 8 }}>{item.detail}</div>
            </div>
          );
        })}
      </div>
      <div style={{ background: "#0d0221", border: "1px solid #3d2466", borderRadius: 4, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
        <div>
          <div style={labelStyle}>Latest bite</div>
          <div style={{ color: "#fffbe8", fontSize: 14 }}>{stats.latestBite}</div>
        </div>
        <div>
          <div style={labelStyle}>Dish crush</div>
          <div style={{ color: "#fffbe8", fontSize: 14 }}>{stats.dishCrush}</div>
        </div>
        <div>
          <div style={labelStyle}>Photo memory rate</div>
          <div style={{ color: "#fffbe8", fontSize: 14 }}>{stats.photoRate}</div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ restaurants, reviews, profile, onAddReview }) {
  const [selectedCuisine, setSelectedCuisine] = useState("");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);

  const scored = useMemo(() => {
    return restaurants
      .map((r) => {
        const rReviews = reviews.filter((rv) => rv.restaurantId === r.id);
        if (!rReviews.length) return null;
        const avg =
          rReviews.reduce((s, rv) => s + rv.recommendationScore, 0) /
          rReviews.length;
        return { restaurant: r, avg };
      })
      .filter(Boolean)
      .sort((a, b) => b.avg - a.avg);
  }, [restaurants, reviews]);

  const top5 = scored.slice(0, 5);

  const mustTryPicks = useMemo(() => {
    const seen = new Set();
    return [...reviews]
      .filter((review) => review.mustTry)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((review) => ({
        review,
        restaurant: restaurants.find((r) => r.id === review.restaurantId),
      }))
      .filter(({ restaurant }) => restaurant)
      .filter(({ restaurant }) => {
        if (seen.has(restaurant.id)) return false;
        seen.add(restaurant.id);
        return true;
      })
      .slice(0, 6);
  }, [restaurants, reviews]);

  const byCuisine = useMemo(() => {
    const map = {};
    scored.forEach(({ restaurant, avg }) => {
      restaurant.cuisines.forEach((c) => {
        if (!map[c]) map[c] = [];
        map[c].push({ restaurant, avg });
      });
    });
    Object.keys(map).forEach(
      (c) => (map[c] = map[c].sort((a, b) => b.avg - a.avg).slice(0, 3))
    );
    return map;
  }, [scored]);

  const cuisinesWithData = Object.keys(byCuisine).filter(
    (c) => byCuisine[c].length > 0
  );
  const groupedCuisinesWithData = CUISINE_GROUPS.map((group) => ({
    ...group,
    cuisines: group.cuisines.filter((c) => cuisinesWithData.includes(c)),
  })).filter((group) => group.cuisines.length > 0);
  const groupedCuisineSet = new Set(
    groupedCuisinesWithData.flatMap((group) => group.cuisines)
  );
  const uncategorizedCuisinesWithData = cuisinesWithData.filter(
    (c) => !groupedCuisineSet.has(c)
  );
  const activeCuisine = selectedCuisine || cuisinesWithData[0] || "";
  const activeCuisinePicks = activeCuisine
    ? byCuisine[activeCuisine] || []
    : [];
  const selectedRestaurant = restaurants.find(
    (r) => r.id === selectedRestaurantId
  );
  const stats = useMemo(() => {
    const averageScore = reviews.length
      ? (
          reviews.reduce((sum, review) => sum + review.recommendationScore, 0) /
          reviews.length
        ).toFixed(1)
      : "0.0";
    const cuisineCounts = {};
    reviews.forEach((review) => {
      (review.cuisines || []).forEach((cuisine) => {
        cuisineCounts[cuisine] = (cuisineCounts[cuisine] || 0) + 1;
      });
    });
    const [topCuisine = "Waiting", topCuisineCount = 0] =
      Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1])[0] || [];
    const dishes = reviews.flatMap((review) =>
      (review.dishes || []).map((dish) => ({
        ...dish,
        restaurantId: review.restaurantId,
        timestamp: review.timestamp,
      }))
    );
    const namedDishes = dishes.filter((dish) => dish.name);
    const photoCount = dishes.filter((dish) => dish.photo).length;
    const hitCount = reviews.filter(
      (review) => review.recommendationScore >= 4.5
    ).length;
    const latestReview = [...reviews].sort(
      (a, b) => b.timestamp - a.timestamp
    )[0];
    const latestRestaurant = latestReview
      ? restaurants.find((r) => r.id === latestReview.restaurantId)
      : null;
    const dishCrush = namedDishes.sort((a, b) => {
      if ((b.rating || 0) !== (a.rating || 0)) {
        return (b.rating || 0) - (a.rating || 0);
      }
      return (b.timestamp || 0) - (a.timestamp || 0);
    })[0];

    return {
      averageScore,
      topCuisine,
      topCuisineCount,
      dishCount: namedDishes.length,
      photoCount,
      hitRate: reviews.length
        ? `${Math.round((hitCount / reviews.length) * 100)}%`
        : "0%",
      latestBite: latestReview
        ? `${latestRestaurant ? latestRestaurant.name : "Unknown"} · ${new Date(latestReview.timestamp).toLocaleDateString()}`
        : "No bites logged yet",
      dishCrush: dishCrush
        ? `${dishCrush.name} · ${dishCrush.rating || 0}/5`
        : "No dishes logged yet",
      photoRate: dishes.length
        ? `${Math.round((photoCount / dishes.length) * 100)}% of dishes`
        : "No dish photos yet",
    };
  }, [restaurants, reviews]);

  return (
    <div>
      <PizzaTracker reviewCount={reviews.length} onAddReview={onAddReview} />
      {reviews.length > 0 && <DashboardStats stats={stats} />}

      {mustTryPicks.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <Flame size={18} color="#ff85a8" />
            <div
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 18,
                color: "#fffbe8",
              }}
            >
              Must try
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
              marginBottom: 32,
            }}
          >
            {mustTryPicks.map(({ restaurant }) => (
              <RestaurantCard
                key={`must-try-${restaurant.id}`}
                restaurant={restaurant}
                reviews={reviews}
                badge="Must Try"
                onClick={() => setSelectedRestaurantId(restaurant.id)}
              />
            ))}
          </div>
        </>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <TrendingUp size={18} color="#ffd23f" />
        <div
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 18,
            color: "#fffbe8",
          }}
        >
          Top 5 recommended
        </div>
      </div>
      {top5.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
            marginBottom: 32,
          }}
        >
          {top5.map(({ restaurant }) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              reviews={reviews}
              onClick={() => setSelectedRestaurantId(restaurant.id)}
            />
          ))}
        </div>
      )}

      {cuisinesWithData.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <Utensils size={18} color="#ff2e63" />
            <div
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 18,
                color: "#fffbe8",
              }}
            >
              Top picks by cuisine
            </div>
          </div>
          <select
            value={activeCuisine}
            onChange={(e) => setSelectedCuisine(e.target.value)}
            style={{ ...inputStyle, marginBottom: 14 }}
          >
            {groupedCuisinesWithData.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.cuisines.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
            ))}
            {uncategorizedCuisinesWithData.length > 0 && (
              <optgroup label="Uncategorized">
                {uncategorizedCuisinesWithData.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
              marginBottom: 32,
            }}
          >
            {activeCuisinePicks.map(({ restaurant }) => (
              <RestaurantCard
                key={restaurant.id + activeCuisine}
                restaurant={restaurant}
                reviews={reviews}
                onClick={() => setSelectedRestaurantId(restaurant.id)}
              />
            ))}
          </div>
        </>
      )}
      {selectedRestaurant && (
        <RestaurantDetailsModal
          restaurant={selectedRestaurant}
          reviews={reviews}
          onClose={() => setSelectedRestaurantId(null)}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        border: "1px dashed #4a2f7a",
        borderRadius: 4,
        padding: 30,
        textAlign: "center",
        marginBottom: 32,
      }}
    >
      <Heart size={26} color="#5c5470" style={{ marginBottom: 8 }} />
      <div style={{ color: "#8b8bc4", fontSize: 14 }}>
        No reviews yet. Once the first one lands, the leaderboard fills in here.
      </div>
    </div>
  );
}

function AnushkaIntroDialog({ onClose }) {
  const [photoAvailable, setPhotoAvailable] = useState(true);
  const [showLoveEgg, setShowLoveEgg] = useState(false);
  const photoSrc = "/anushka-sushi.jpeg";
  const triggerLoveEgg = () => {
    setShowLoveEgg(true);
    window.setTimeout(() => setShowLoveEgg(false), 3200);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(13, 2, 33, 0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          maxHeight: "88vh",
          overflowY: "auto",
          background: "#1a0b2e",
          border: "1px solid #4a2f7a",
          borderRadius: 4,
          padding: 22,
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          color: "#fffbe8",
          position: "relative",
        }}
      >
        <style>{`
          .anushka-copy {
            font-family: ${BODY_FONT};
            font-size: 16px;
            line-height: 1.72;
            color: #d7d0f4;
            font-weight: 400;
          }
          .anushka-copy p {
            margin: 0 0 14px;
          }
          .anushka-copy strong {
            color: #fffbe8;
            font-weight: 700;
          }
          .anushka-copy em {
            color: #f1dcff;
            font-style: italic;
          }
          @keyframes cupidFloat {
            0% { transform: translateX(-54px) translateY(10px) rotate(-8deg); opacity: 0; }
            18% { opacity: 1; }
            55% { transform: translateX(20px) translateY(-5px) rotate(5deg); opacity: 1; }
            100% { transform: translateX(72px) translateY(-18px) rotate(8deg); opacity: 0; }
          }
          @keyframes arrowStrike {
            0% { transform: translateX(-86px) rotate(-12deg); opacity: 0; }
            22% { opacity: 1; }
            60% { transform: translateX(4px) rotate(-12deg); opacity: 1; }
            100% { transform: translateX(4px) rotate(-12deg); opacity: 0; }
          }
          @keyframes heartPop {
            0%, 40% { transform: scale(0.82); filter: drop-shadow(0 0 0 rgba(255,46,99,0)); }
            58% { transform: scale(1.28); filter: drop-shadow(0 0 18px rgba(255,46,99,0.9)); }
            100% { transform: scale(1); filter: drop-shadow(0 0 8px rgba(255,46,99,0.45)); }
          }
          @keyframes loveMessage {
            0%, 48% { opacity: 0; transform: translateY(8px); }
            64%, 100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1.18,
              letterSpacing: 0,
              color: "#fffbe8",
            }}
          >
            Hey there, Anushka here! 👋
          </div>
          <button
            aria-label="Close Anushka intro"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#8b8bc4",
              cursor: "pointer",
              height: 28,
            }}
          >
            <X size={22} />
          </button>
        </div>

        {photoAvailable && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              margin: "4px 0 18px",
            }}
          >
            <div
              style={{
                width: 220,
                height: 220,
                borderRadius: "50%",
                position: "relative",
                overflow: "hidden",
                border: "3px solid #ff2e63",
                boxShadow:
                  "0 0 0 4px #3d0d1f, 0 18px 45px rgba(0,0,0,0.35)",
                background: "#0d0221",
              }}
            >
              <img
                src={photoSrc}
                alt=""
                aria-hidden="true"
                onError={() => setPhotoAvailable(false)}
                style={{
                  position: "absolute",
                  inset: -18,
                  width: "calc(100% + 36px)",
                  height: "calc(100% + 36px)",
                  objectFit: "cover",
                  filter: "blur(12px)",
                  transform: "scale(1.1)",
                  opacity: 0.75,
                }}
              />
              <img
                src={photoSrc}
                alt="Anushka holding a sushi plate"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "64% 52%",
                }}
              />
            </div>
          </div>
        )}

        <div className="anushka-copy">
          <p>
            Part-time lawyer ⚖️, full-time traveller ✈️, and{" "}
            <strong>professionally obsessed with food</strong>
            . 🍜
          </p>
          <p>
            One of the things that keeps me going is the very important
            responsibility of finding{" "}
            <strong>what I’m going to eat next</strong>
            .
          </p>
          <p>
            New city? Cool.
            <br />
            Beautiful views? Love them.
            <br />
            But more importantly…{" "}
            <strong>where are we eating?</strong>
          </p>
          <p>
            To give you an idea of how seriously I take food: someone once
            lovingly fed me a piece of dosa… and I{" "}
            <strong>took it OUT OF MY MOUTH</strong>{" "}
            because there wasn't enough chutney on it. 😭
          </p>
          <p>
            Yes. Someone fed me.
            <br />
            Yes. I accepted it.
            <br />
            Yes. I took it back out.
            <br />
            Yes. They still{" "}
            <button
              onClick={triggerLoveEgg}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                margin: 0,
                color: "inherit",
                cursor: "pointer",
                font: "inherit",
                textDecoration: "none",
              }}
            >
              love
            </button>{" "}
            me :p
          </p>
          <p>
            <strong>The dosa deserved more chutney. I stand by my decision.</strong>
          </p>
          <p>
            When it comes to cuisines, I don’t discriminate — my stomach
            believes in equal opportunity😂 and unfortunately for everyone
            around me, when I discover something I love, liking it quietly is
            simply not an option.
          </p>
          <p>
            <strong>YOU need to try it too.</strong>
          </p>
          <p>And then YOU.</p>
          <p>And probably that person over there as well.</p>
          <p>
            Which is basically how this website came into existence — a
            permanent home for all the restaurants, dishes, hidden gems, and{" "}
            <em>“OMG YOU HAVE TO TRY THIS”</em> recommendations living in my
            head.
          </p>
          <p>
            I've already successfully converted a few innocent people into{" "}
            <strong>sushi lovers</strong>. 🍣
          </p>
          <p>
            Including one <em>particular someone</em> who apparently went all
            the way to <strong>Japan</strong>{" "}
            without having proper sushi.
          </p>
          <p>
            Imagine going to Japan and needing{" "}
            <strong>me</strong> to introduce you to
            sushi afterwards.
          </p>
          <p>Embarrassing, really. 😂</p>
          <p>Anyway, welcome to my little food universe.</p>
          <p>
            Come for the recommendations. Stay for the unsolicited opinions.
          </p>
          <p style={{ color: "#ff85a8", marginBottom: 0 }}>
            <strong>I eat. I judge. You benefit.</strong> ❤️🍴
          </p>
        </div>
        {showLoveEgg && (
          <div
            aria-live="polite"
            style={{
              position: "sticky",
              bottom: 12,
              margin: "18px auto 0",
              width: "min(320px, 100%)",
              background: "#0d0221",
              border: "1px solid #ff2e63",
              borderRadius: 4,
              padding: "14px 16px",
              textAlign: "center",
              boxShadow: "0 16px 42px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                position: "relative",
                height: 74,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "18%",
                  fontSize: 34,
                  animation: "cupidFloat 2.2s ease-out forwards",
                }}
              >
                👼
              </span>
              <span
                style={{
                  position: "absolute",
                  left: "38%",
                  fontSize: 30,
                  animation: "arrowStrike 2.2s ease-out forwards",
                }}
              >
                🏹
              </span>
              <span
                style={{
                  fontSize: 42,
                  animation: "heartPop 2.2s ease-out forwards",
                }}
              >
                ❤️
              </span>
            </div>
            <div
              style={{
                color: "#fffbe8",
                fontFamily: BODY_FONT,
                fontSize: 15,
                fontWeight: 800,
                lineHeight: 1.45,
                letterSpacing: 0,
                animation: "loveMessage 2.2s ease-out forwards",
              }}
            >
              Ashu loves you infinitely
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function isOwnerRoute() {
  const path = window.location.pathname.replace(/\/+$/, "");
  const hash = window.location.hash.replace(/^#/, "").replace(/\/+$/, "");
  const params = new URLSearchParams(window.location.search);
  return (
    path === "/nush" ||
    path.endsWith("/nush") ||
    hash === "/nush" ||
    hash === "nush" ||
    params.get("mode") === "nush"
  );
}

export default function NushNom() {
  useFonts();
  const [data, setData] = useState(null);
  const [view, setView] = useState("dashboard"); // dashboard | add | manage
  const [showAnushkaIntro, setShowAnushkaIntro] = useState(false);
  const isNushRoute = isOwnerRoute();

  useEffect(() => {
    loadData().then(setData);
  }, []);

  useEffect(() => {
    if (data) saveData(data);
  }, [data]);

  if (!data) {
    return (
      <div
        style={{
          minHeight: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d0221",
        }}
      >
        <Loader2 size={24} color="#ffd23f" className="spin" />
      </div>
    );
  }

  const badges = computeBadges(data.reviews);
  const profile = { badges };

  const closeToDashboard = () => setView("dashboard");

  const addRestaurant = (r) =>
    setData((prev) => ({ ...prev, restaurants: [...prev.restaurants, r] }));
  const addReview = (review) =>
    setData((prev) => ({
      ...prev,
      reviews: [...prev.reviews, review],
      restaurants: prev.restaurants.map((r) =>
        r.id === review.restaurantId
          ? {
              ...r,
              cuisines: Array.from(
                new Set([...(r.cuisines || []), ...(review.cuisines || [])])
              ),
            }
          : r
      ),
    }));
  const updateReview = (id, updates) =>
    setData((prev) => {
      const target = prev.reviews.find((r) => r.id === id);
      if (!target) return prev;
      return {
        ...prev,
        reviews: prev.reviews.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        ),
        restaurants: prev.restaurants.map((r) =>
          r.id === target.restaurantId
            ? {
                ...r,
                cuisines: Array.from(
                  new Set([...(r.cuisines || []), ...(updates.cuisines || [])])
                ),
              }
            : r
        ),
      };
    });
  const deleteReview = (id) =>
    setData((prev) => ({
      ...prev,
      reviews: prev.reviews.filter((r) => r.id !== id),
    }));

  return (
    <div
      style={{
        background: "#0d0221",
        minHeight: "100vh",
        padding: "28px 20px",
        fontFamily: BODY_FONT,
      }}
    >
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .blink-cursor { animation: blink 1s step-end infinite; }
        @keyframes beltScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        ::selection { background: #ff2e63; color: #3d0d1f; }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 50,
          opacity: 0.1,
          background:
            "repeating-linear-gradient(0deg, #000 0px, transparent 1px, transparent 2px, #000 3px)",
        }}
      />
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 3,
                background: "#ff2e63",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChefHat size={22} color="#3d0d1f" />
            </div>
            <div>
              <div
                style={{
                  fontFamily: DISPLAY_FONT,
                  fontSize: 24,
                  color: "#fffbe8",
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                NushNom
              </div>
              <div style={{ fontSize: 11, color: "#8b8bc4" }}>
                <button
                  onClick={() => setShowAnushkaIntro(true)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    color: "#ff2e63",
                    textDecoration: "underline",
                    cursor: "pointer",
                    font: "inherit",
                    fontWeight: 700,
                  }}
                >
                  Anushka
                </button>
                's Mumbai food quest
              </div>
            </div>
          </div>
          {isNushRoute && view === "dashboard" && (
            <button
              aria-label="Manage reviews"
              title="Manage reviews"
              onClick={() => setView("manage")}
              style={{
                background: "none",
                border: "1px solid #4a2f7a",
                borderRadius: 2,
                padding: 8,
                color: "#8b8bc4",
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Edit2 size={12} />
            </button>
          )}
        </div>

        {view === "dashboard" && (
          <Dashboard
            restaurants={data.restaurants}
            reviews={data.reviews}
            profile={profile}
            onAddReview={isNushRoute ? () => setView("add") : null}
          />
        )}

        {view === "add" && (
          <div
            style={{
              background: "#1a0b2e",
              border: "1px solid #4a2f7a",
              borderRadius: 4,
              padding: 22,
            }}
          >
            <AddReviewFlow
              restaurants={data.restaurants}
              reviews={data.reviews}
              onAddRestaurant={addRestaurant}
              onSubmit={addReview}
              onClose={closeToDashboard}
            />
          </div>
        )}

        {view === "manage" && (
          <div
            style={{
              background: "#1a0b2e",
              border: "1px solid #4a2f7a",
              borderRadius: 4,
              padding: 22,
            }}
          >
            <ManageReviews
              restaurants={data.restaurants}
              reviews={data.reviews}
              onUpdateReview={updateReview}
              onDeleteReview={deleteReview}
              onClose={closeToDashboard}
            />
          </div>
        )}
      </div>
      {showAnushkaIntro && (
        <AnushkaIntroDialog onClose={() => setShowAnushkaIntro(false)} />
      )}
    </div>
  );
}
