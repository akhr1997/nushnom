import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Trophy, Star, MapPin, Camera, Search, Sparkles, Award, ChefHat,
  Utensils, Plus, X, Check, Flame, ArrowLeft,
  Loader2, Heart, TrendingUp, Edit2, Trash2
} from "lucide-react";

const FONT_LINK_ID = "nushnom-fonts";
function useFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

const CUISINES = [
  "North Indian", "South Indian", "Mughlai", "Parsi", "Gujarati",
  "Seafood / Malvani", "Street Food", "Cafe", "Continental", "Chinese",
  "Desserts", "Bakery", "Modern Indian", "Other"
];

const SEED_RESTAURANTS = [];

const LEVELS = [
  { name: "Street Food Rookie", min: 0 },
  { name: "Thali Explorer", min: 50 },
  { name: "Curry Connoisseur", min: 150 },
  { name: "Thali Champion", min: 300 },
  { name: "Zaika Legend", min: 500 },
];

const BADGE_DEFS = [
  { id: "first-bite", label: "First bite", icon: "star", check: (s) => s.reviews.length >= 1 },
  { id: "century", label: "Century club", icon: "trophy", check: (s) => s.reviews.length >= 10 },
  { id: "explorer", label: "Cuisine explorer", icon: "map", check: (s) => s.cuisineCount >= 5 },
  { id: "shutterbug", label: "Shutterbug", icon: "camera", check: (s) => s.photoCount >= 5 },
  { id: "top-critic", label: "Top critic", icon: "flame", check: (s) => s.topScoreCount >= 3 },
];

function getLevel(points) {
  let current = LEVELS[0];
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].min) { current = LEVELS[i]; idx = i; }
  }
  const next = LEVELS[idx + 1];
  return { ...current, idx, next };
}

function computeBadges(reviews) {
  const cuisineSet = new Set();
  let photoCount = 0;
  let topScoreCount = 0;
  reviews.forEach(r => {
    (r.cuisines || []).forEach(c => cuisineSet.add(c));
    (r.dishes || []).forEach(d => { if (d.photo) photoCount++; });
    if (r.recommendationScore >= 4.5) topScoreCount++;
  });
  const stats = { reviews, cuisineCount: cuisineSet.size, photoCount, topScoreCount };
  return BADGE_DEFS.filter(b => b.check(stats)).map(b => b.id);
}

const SLICES_PER_PIZZA = 8;
const OPENAI_SENTIMENT_MODEL = "gpt-4o";

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
  if (!text || text.trim().length < 3) return 3;
  const fallbackScore = scoreLocalSentiment(text);
  const apiKey = window.NUSHNOM_OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return fallbackScore;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_SENTIMENT_MODEL,
        instructions: "Score restaurant review text for enthusiasm and positivity, independent of any star rating. Respond with only JSON: {\"score\": number}. Score is 0 to 5, one decimal place. 5 = ecstatic/glowing, 3 = mixed/neutral, 0 = very negative.",
        input: text,
        text: { format: { type: "json_object" } },
      }),
    });
    if (!response.ok) return fallbackScore;
    const data = await response.json();
    const outputText = data.output_text || (data.output || []).flatMap(item => item.content || []).filter(content => content.type === "output_text").map(content => content.text).join("");
    if (!outputText) return fallbackScore;
    const cleaned = outputText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const score = Number(parsed.score);
    return Number.isFinite(score) ? Math.max(0, Math.min(5, score)) : fallbackScore;
  } catch (e) {
    return fallbackScore;
  }
}

function scoreLocalSentiment(text) {
  const normalized = text.toLowerCase();
  const negativeWords = ["bad", "terrible", "awful", "horrible", "worst", "bland", "stale", "cold", "overpriced", "disappointing", "disappointed", "hate", "hated", "not good", "would not", "never again"];
  const positiveWords = ["amazing", "excellent", "incredible", "perfect", "loved", "love", "delicious", "fantastic", "favorite", "favourite", "must try", "best", "great", "recommend"];
  const negativeHits = negativeWords.filter(word => normalized.includes(word)).length;
  const positiveHits = positiveWords.filter(word => normalized.includes(word)).length;
  if (negativeHits > positiveHits) return Math.max(0.5, 2.2 - negativeHits * 0.4);
  if (positiveHits > negativeHits) return Math.min(5, 3.6 + positiveHits * 0.35);
  return 3;
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

async function loadData() {
  try {
    const result = await window.storage.get(STORAGE_KEY, true);
    if (result && result.value) return JSON.parse(result.value);
  } catch (e) {}
  return { restaurants: SEED_RESTAURANTS, reviews: [] };
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
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={size}
          fill={(hover || value) >= n ? "#FFB627" : "none"}
          color={(hover || value) >= n ? "#FFB627" : "#6E5C93"}
          style={{ cursor: readOnly ? "default" : "pointer", transition: "transform 0.1s" }}
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
    <div style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#3A2560" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke="#FFB627" strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center"
      }}>
        <Trophy size={22} color="#FFB627" />
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#F5EFE6", fontWeight: 700 }}>{points}</span>
      </div>
    </div>
  );
}

function BadgeChip({ badge }) {
  const icons = { star: Star, trophy: Trophy, map: Utensils, camera: Camera, flame: Flame };
  const Icon = icons[badge.icon] || Award;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, background: "#3A2560",
      border: "1px solid #4E3480", borderRadius: 10, padding: "6px 12px",
      fontSize: 12, color: "#F5EFE6", fontFamily: "'Inter', sans-serif", fontWeight: 500
    }}>
      <Icon size={13} color="#FF4D8D" />
      {badge.label}
    </div>
  );
}

function RestaurantCard({ restaurant, reviews, onClick }) {
  const rReviews = reviews.filter(r => r.restaurantId === restaurant.id);
  const avgScore = rReviews.length
    ? rReviews.reduce((s, r) => s + r.recommendationScore, 0) / rReviews.length
    : 0;
  const topDish = rReviews.find(r => r.recommendedDish)?.recommendedDish;
  return (
    <div
      onClick={onClick}
      style={{
        background: "linear-gradient(155deg, #2E1B52, #241640)",
        border: "1px solid #4E3480", borderRadius: 16, padding: 16,
        cursor: onClick ? "pointer" : "default", position: "relative",
        transition: "transform 0.15s, border-color 0.15s"
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "#FF4D8D"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "#4E3480"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, color: "#F5EFE6", fontWeight: 700 }}>{restaurant.name}</div>
          <div style={{ fontSize: 12, color: "#B8A9D9", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <MapPin size={11} /> {restaurant.area}
          </div>
        </div>
        <div style={{
          background: "#FFB627", color: "#412402", fontFamily: "'Space Mono', monospace",
          fontWeight: 700, fontSize: 13, borderRadius: 10, padding: "4px 8px", flexShrink: 0
        }}>
          {avgScore.toFixed(1)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {restaurant.cuisines.map(c => (
          <span key={c} style={{ fontSize: 11, color: "#B8A9D9", background: "#1B1030", border: "1px solid #3A2560", borderRadius: 10, padding: "3px 8px" }}>{c}</span>
        ))}
      </div>
      {topDish && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#FF9BC0", display: "flex", alignItems: "center", gap: 5 }}>
          <ChefHat size={13} /> Try the {topDish}
        </div>
      )}
    </div>
  );
}

const btnPrimary = {
  flex: 1, background: "#FF4D8D", color: "#4B1528", border: "none", borderRadius: 12,
  padding: "10px 14px", fontWeight: 700, fontFamily: "'Inter', sans-serif", fontSize: 14, cursor: "pointer"
};
const btnGhost = {
  flex: 1, background: "transparent", color: "#B8A9D9", border: "1px solid #4E3480", borderRadius: 12,
  padding: "10px 14px", fontWeight: 500, fontFamily: "'Inter', sans-serif", fontSize: 14, cursor: "pointer"
};
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #4E3480",
  background: "#1B1030", color: "#F5EFE6", fontSize: 14, boxSizing: "border-box", fontFamily: "'Inter', sans-serif"
};
const labelStyle = { fontSize: 12, color: "#B8A9D9", marginBottom: 6, display: "block", fontWeight: 500 };

function SushiBeltLoader() {
  const items = ["🍣", "🍤", "🍱", "🍙", "🥢", "🍣", "🍤", "🍱", "🍙", "🥢"];
  return (
    <div style={{
      width: "100%", overflow: "hidden", background: "#1B1030", border: "2px solid #4E3480",
      borderRadius: 16, padding: "16px 0 10px", marginBottom: 20, position: "relative"
    }}>
      <div style={{
        display: "flex", gap: 28, width: "max-content",
        animation: "beltScroll 6s linear infinite"
      }}>
        {[...items, ...items].map((emoji, i) => (
          <span key={i} style={{ fontSize: 30 }}>{emoji}</span>
        ))}
      </div>
      <div style={{
        marginTop: 10, height: 5,
        background: "repeating-linear-gradient(90deg, #FFB627 0 10px, transparent 10px 20px)"
      }} />
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
    <div style={{ background: "#1B1030", border: "1px solid #3A2560", borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Dish name"
          value={dish.name}
          onChange={e => onChange({ ...dish, name: e.target.value })}
        />
        <button onClick={onRemove} style={{ background: "none", border: "none", color: "#FF4D8D", cursor: "pointer" }}><X size={18} /></button>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <StarRating value={dish.rating} onChange={n => onChange({ ...dish, rating: n })} size={16} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#B8A9D9", cursor: "pointer" }}>
          <Camera size={14} /> {dish.photo ? "Change photo" : "Add photo"}
          <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
        </label>
        {dish.photo && <img src={dish.photo} alt="" style={{ width: 32, height: 32, borderRadius: 10, objectFit: "cover" }} />}
      </div>
      <textarea
        style={{ ...inputStyle, resize: "vertical", minHeight: 50 }}
        placeholder="What did you think of this dish?"
        value={dish.review}
        onChange={e => onChange({ ...dish, review: e.target.value })}
      />
    </div>
  );
}

function AddReviewFlow({ restaurants, reviews, onAddRestaurant, onSubmit, onClose }) {
  const [mode, setMode] = useState("pick");
  const [query, setQuery] = useState("");
  const [restaurant, setRestaurant] = useState(null);
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState("");

  const [cuisines, setCuisines] = useState([]);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [dishes, setDishes] = useState([]);
  const [recommendedDish, setRecommendedDish] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  const filtered = query.trim().length >= 2
    ? restaurants.filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  const pickRestaurant = (r) => { setRestaurant(r); setCuisines(r.cuisines.length ? [r.cuisines[0]] : []); setMode("review"); };

  const addNewRestaurant = () => {
    if (!newName.trim()) return;
    const r = {
      id: "r" + Date.now(), name: newName.trim(), area: newArea.trim() || "Mumbai",
      lat: 19.0 + Math.random() * 0.15, lng: 72.82 + Math.random() * 0.05, cuisines: []
    };
    onAddRestaurant(r);
    pickRestaurant(r);
  };

  const toggleCuisine = (c) => {
    setCuisines(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const addDish = () => setDishes(prev => [...prev, { id: "d" + Date.now() + Math.random(), name: "", rating: 0, review: "", photo: null }]);
  const updateDish = (id, val) => setDishes(prev => prev.map(d => d.id === id ? val : d));
  const removeDish = (id) => setDishes(prev => prev.filter(d => d.id !== id));

  const canSubmit = restaurant && cuisines.length > 0 && rating > 0 && reviewText.trim().length > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    const sentimentScore = await scoreSentiment(reviewText);
    const recommendationScore = Math.round(((rating * 0.7) + (sentimentScore * 0.3)) * 10) / 10;
    const review = {
      id: "rev" + Date.now(),
      restaurantId: restaurant.id,
      cuisines,
      starRating: rating,
      reviewText,
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
    const t = setTimeout(() => { onClose(); }, 2400);
    return () => clearTimeout(t);
  }, [done]);

  if (done) {
    const { wholePizzas, currentSlices } = getPizzaProgress(reviews.length + 1);
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, color: "#F5EFE6", marginBottom: 6 }}>Review logged!</div>
        <div style={{ fontSize: 13, color: "#B8A9D9", marginBottom: 20 }}>{restaurant.name} · recommendation score {done.recommendationScore}/5</div>
        <SushiBeltLoader />
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#FFB627" }}>
          🍕 Slice {currentSlices === 0 ? SLICES_PER_PIZZA : currentSlices}/{SLICES_PER_PIZZA} added{currentSlices === 0 ? ` · pizza #${wholePizzas} complete!` : ""}
        </div>
        <div style={{ fontSize: 11, color: "#6E5C93", marginTop: 16 }}>Heading back to your dashboard...</div>
      </div>
    );
  }

  if (mode === "pick") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, color: "#F5EFE6" }}>Find a restaurant</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#B8A9D9", cursor: "pointer" }}><X size={20} /></button>
        </div>
        <input style={inputStyle} placeholder="Search restaurants already added to NushNom..." value={query} onChange={e => setQuery(e.target.value)} />
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
          {filtered.length > 0 && (
            <div style={{ fontSize: 11, color: "#6E5C93", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>Already on NushNom</div>
          )}
          {filtered.map(r => (
            <div key={r.id} onClick={() => pickRestaurant(r)} style={{
              background: "#1B1030", border: "1px solid #3A2560", borderRadius: 12, padding: "10px 14px",
              cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <div style={{ color: "#F5EFE6", fontSize: 14, fontWeight: 500 }}>{r.name}</div>
                <div style={{ color: "#B8A9D9", fontSize: 12 }}>{r.area}</div>
              </div>
              <Plus size={16} color="#FF4D8D" />
            </div>
          ))}

          {query.trim().length >= 2 && filtered.length === 0 && (
            <div style={{ color: "#B8A9D9", fontSize: 13, background: "#1B1030", border: "1px dashed #4E3480", borderRadius: 12, padding: 14 }}>
              No saved restaurant found. Add a new restaurant below.
            </div>
          )}
          <div style={{ background: "#1B1030", border: "1px dashed #4E3480", borderRadius: 12, padding: 14 }}>
            <div style={{ color: "#F5EFE6", fontSize: 14, marginBottom: 8 }}>Add a new restaurant</div>
            <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Restaurant name" value={newName} onChange={e => setNewName(e.target.value)} />
            <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Area (e.g. Bandra)" value={newArea} onChange={e => setNewArea(e.target.value)} />
            <button disabled={!newName.trim()} onClick={addNewRestaurant} style={{ ...btnPrimary, flex: "none", opacity: newName.trim() ? 1 : 0.5 }}>Add and continue</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={() => setMode("pick")} style={{ background: "none", border: "none", color: "#B8A9D9", cursor: "pointer" }}><ArrowLeft size={18} /></button>
        <div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 19, color: "#F5EFE6" }}>{restaurant.name}</div>
          <div style={{ fontSize: 12, color: "#B8A9D9" }}>{restaurant.area}</div>
        </div>
      </div>

      <label style={labelStyle}>Cuisine</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {CUISINES.map(c => (
          <span key={c} onClick={() => toggleCuisine(c)} style={{
            fontSize: 12, padding: "6px 12px", borderRadius: 10, cursor: "pointer",
            border: `1px solid ${cuisines.includes(c) ? "#FF4D8D" : "#3A2560"}`,
            background: cuisines.includes(c) ? "#4B1528" : "#1B1030",
            color: cuisines.includes(c) ? "#FF9BC0" : "#B8A9D9"
          }}>{c}</span>
        ))}
      </div>

      <label style={labelStyle}>Overall rating</label>
      <div style={{ marginBottom: 16 }}><StarRating value={rating} onChange={setRating} /></div>

      <label style={labelStyle}>Overall review</label>
      <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical", marginBottom: 16 }}
        placeholder="How was the food, service, vibe..."
        value={reviewText} onChange={e => setReviewText(e.target.value)} />

      <label style={labelStyle}>Dishes you tried</label>
      {dishes.map(d => <DishRow key={d.id} dish={d} onChange={val => updateDish(d.id, val)} onRemove={() => removeDish(d.id)} />)}
      <button onClick={addDish} style={{ ...btnGhost, flex: "none", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Plus size={14} /> Add a dish
      </button>

      {dishes.some(d => d.name) && (
        <>
          <label style={labelStyle}>Dish you'd recommend to others</label>
          <select style={{ ...inputStyle, marginBottom: 16 }} value={recommendedDish} onChange={e => setRecommendedDish(e.target.value)}>
            <option value="">None in particular</option>
            {dishes.filter(d => d.name).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </>
      )}

      <button
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
        style={{
          ...btnPrimary, flex: "none", width: "100%", opacity: (!canSubmit || submitting) ? 0.5 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8
        }}
      >
        {submitting ? <><Loader2 size={16} className="spin" /> Scoring your review...</> : "Submit review"}
      </button>
    </div>
  );
}



function PizzaTracker({ reviewCount, onAddReview }) {
  const { wholePizzas, currentSlices } = getPizzaProgress(reviewCount);
  const cx = 60, cy = 60, r = 50;
  return (
    <div style={{
      background: "#241640", border: "1px solid #4E3480", borderRadius: 16, padding: 20, marginBottom: 20,
      display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap"
    }}>
      <svg width="110" height="110" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="#1B1030" stroke="#4E3480" strokeWidth="2" />
        {Array.from({ length: SLICES_PER_PIZZA }).map((_, i) => (
          <path key={i} d={wedgePath(i, SLICES_PER_PIZZA, cx, cy, r - 2)} fill={i < currentSlices ? "#FFB627" : "transparent"} stroke="#4E3480" strokeWidth="1.5" />
        ))}
      </svg>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 16, color: "#F5EFE6", marginBottom: 4 }}>Pizza progress</div>
        <div style={{ fontSize: 12, color: "#B8A9D9", marginBottom: 8 }}>
          Slice {currentSlices}/{SLICES_PER_PIZZA} in this pie · every review adds a slice
        </div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#FFB627" }}>
          🍕 {wholePizzas} whole {wholePizzas === 1 ? "pizza" : "pizzas"} baked
        </div>
      </div>
      {onAddReview && (
        <button onClick={onAddReview} style={{ ...btnPrimary, flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "12px 20px" }}>
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
  const [dishes, setDishes] = useState(review.dishes || []);
  const [recommendedDish, setRecommendedDish] = useState(review.recommendedDish || "");
  const [submitting, setSubmitting] = useState(false);

  const toggleCuisine = (c) => setCuisines(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const addDish = () => setDishes(prev => [...prev, { id: "d" + Date.now() + Math.random(), name: "", rating: 0, review: "", photo: null }]);
  const updateDish = (id, val) => setDishes(prev => prev.map(d => d.id === id ? val : d));
  const removeDish = (id) => setDishes(prev => prev.filter(d => d.id !== id));

  const canSave = cuisines.length > 0 && rating > 0 && reviewText.trim().length > 0;

  const handleSave = async () => {
    setSubmitting(true);
    const sentimentScore = await scoreSentiment(reviewText);
    const recommendationScore = Math.round(((rating * 0.7) + (sentimentScore * 0.3)) * 10) / 10;
    onSave({
      cuisines, starRating: rating, reviewText, sentimentScore, recommendationScore,
      dishes, recommendedDish: recommendedDish || null,
    });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "#B8A9D9", cursor: "pointer" }}><ArrowLeft size={18} /></button>
        <div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 19, color: "#F5EFE6" }}>Edit review</div>
          <div style={{ fontSize: 12, color: "#B8A9D9" }}>{restaurant ? restaurant.name : "Unknown restaurant"}</div>
        </div>
      </div>

      <label style={labelStyle}>Cuisine</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {CUISINES.map(c => (
          <span key={c} onClick={() => toggleCuisine(c)} style={{
            fontSize: 12, padding: "6px 12px", borderRadius: 10, cursor: "pointer",
            border: `1px solid ${cuisines.includes(c) ? "#FF4D8D" : "#3A2560"}`,
            background: cuisines.includes(c) ? "#4B1528" : "#1B1030",
            color: cuisines.includes(c) ? "#FF9BC0" : "#B8A9D9"
          }}>{c}</span>
        ))}
      </div>

      <label style={labelStyle}>Overall rating</label>
      <div style={{ marginBottom: 16 }}><StarRating value={rating} onChange={setRating} /></div>

      <label style={labelStyle}>Overall review</label>
      <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical", marginBottom: 16 }}
        value={reviewText} onChange={e => setReviewText(e.target.value)} />

      <label style={labelStyle}>Dishes you tried</label>
      {dishes.map(d => <DishRow key={d.id} dish={d} onChange={val => updateDish(d.id, val)} onRemove={() => removeDish(d.id)} />)}
      <button onClick={addDish} style={{ ...btnGhost, flex: "none", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Plus size={14} /> Add a dish
      </button>

      {dishes.some(d => d.name) && (
        <>
          <label style={labelStyle}>Dish you'd recommend to others</label>
          <select style={{ ...inputStyle, marginBottom: 16 }} value={recommendedDish} onChange={e => setRecommendedDish(e.target.value)}>
            <option value="">None in particular</option>
            {dishes.filter(d => d.name).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </>
      )}

      <button
        disabled={!canSave || submitting}
        onClick={handleSave}
        style={{
          ...btnPrimary, flex: "none", width: "100%", opacity: (!canSave || submitting) ? 0.5 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8
        }}
      >
        {submitting ? <><Loader2 size={16} className="spin" /> Saving...</> : "Save changes"}
      </button>
    </div>
  );
}

function ManageReviews({ restaurants, reviews, onUpdateReview, onDeleteReview, onClose }) {
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  if (editingId) {
    const review = reviews.find(r => r.id === editingId);
    const restaurant = restaurants.find(r => r.id === review.restaurantId);
    return (
      <EditReviewForm
        review={review}
        restaurant={restaurant}
        onCancel={() => setEditingId(null)}
        onSave={(updates) => { onUpdateReview(editingId, updates); setEditingId(null); }}
      />
    );
  }

  const sorted = [...reviews].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, color: "#F5EFE6" }}>Manage reviews</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#B8A9D9", cursor: "pointer" }}><X size={20} /></button>
      </div>

      {sorted.length === 0 ? (
        <div style={{ color: "#B8A9D9", fontSize: 13, textAlign: "center", padding: "30px 0" }}>No reviews yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto" }}>
          {sorted.map(rv => {
            const restaurant = restaurants.find(r => r.id === rv.restaurantId);
            return (
              <div key={rv.id} style={{ background: "#1B1030", border: "1px solid #3A2560", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#F5EFE6", fontSize: 14, fontWeight: 600 }}>{restaurant ? restaurant.name : "Unknown restaurant"}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                      <StarRating value={rv.starRating} readOnly size={13} />
                      <span style={{ fontSize: 11, color: "#B8A9D9" }}>{new Date(rv.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#B8A9D9", marginTop: 6 }}>
                      {rv.reviewText.length > 130 ? rv.reviewText.slice(0, 130) + "…" : rv.reviewText}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setEditingId(rv.id)} style={{
                      background: "none", border: "1px solid #4E3480", borderRadius: 10, padding: 7, cursor: "pointer", color: "#B8A9D9"
                    }}><Edit2 size={14} /></button>
                    <button onClick={() => setConfirmDeleteId(rv.id)} style={{
                      background: "none", border: "1px solid #FF4D8D", borderRadius: 10, padding: 7, cursor: "pointer", color: "#FF4D8D"
                    }}><Trash2 size={14} /></button>
                  </div>
                </div>
                {confirmDeleteId === rv.id && (
                  <div style={{
                    marginTop: 10, background: "#2A0F1C", border: "1px solid #FF4D8D", borderRadius: 10, padding: 10,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap"
                  }}>
                    <span style={{ fontSize: 12, color: "#FF9BC0" }}>Delete this review permanently?</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ ...btnGhost, flex: "none", padding: "6px 12px", fontSize: 12 }}>Cancel</button>
                      <button onClick={() => { onDeleteReview(rv.id); setConfirmDeleteId(null); }} style={{ ...btnPrimary, flex: "none", padding: "6px 12px", fontSize: 12 }}>Delete</button>
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

function Dashboard({ restaurants, reviews, profile, onAddReview }) {
  const [selectedCuisine, setSelectedCuisine] = useState("");

  const scored = useMemo(() => {
    return restaurants.map(r => {
      const rReviews = reviews.filter(rv => rv.restaurantId === r.id);
      if (!rReviews.length) return null;
      const avg = rReviews.reduce((s, rv) => s + rv.recommendationScore, 0) / rReviews.length;
      return { restaurant: r, avg };
    }).filter(Boolean).sort((a, b) => b.avg - a.avg);
  }, [restaurants, reviews]);

  const top5 = scored.slice(0, 5);

  const byCuisine = useMemo(() => {
    const map = {};
    scored.forEach(({ restaurant, avg }) => {
      restaurant.cuisines.forEach(c => {
        if (!map[c]) map[c] = [];
        map[c].push({ restaurant, avg });
      });
    });
    Object.keys(map).forEach(c => map[c] = map[c].sort((a, b) => b.avg - a.avg).slice(0, 3));
    return map;
  }, [scored]);

  const cuisinesWithData = Object.keys(byCuisine).filter(c => byCuisine[c].length > 0);
  const activeCuisine = selectedCuisine || cuisinesWithData[0] || "";
  const activeCuisinePicks = activeCuisine ? byCuisine[activeCuisine] || [] : [];

  return (
    <div>
      <PizzaTracker reviewCount={reviews.length} onAddReview={onAddReview} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <TrendingUp size={18} color="#FFB627" />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, color: "#F5EFE6" }}>Top 5 recommended</div>
      </div>
      {top5.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 32 }}>
          {top5.map(({ restaurant }) => <RestaurantCard key={restaurant.id} restaurant={restaurant} reviews={reviews} />)}
        </div>
      )}

      {cuisinesWithData.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Utensils size={18} color="#FF4D8D" />
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, color: "#F5EFE6" }}>Top picks by cuisine</div>
          </div>
          <select
            value={activeCuisine}
            onChange={e => setSelectedCuisine(e.target.value)}
            style={{ ...inputStyle, marginBottom: 14 }}
          >
            {cuisinesWithData.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 32 }}>
            {activeCuisinePicks.map(({ restaurant }) => <RestaurantCard key={restaurant.id + activeCuisine} restaurant={restaurant} reviews={reviews} />)}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      border: "1px dashed #4E3480", borderRadius: 16, padding: 30, textAlign: "center", marginBottom: 32
    }}>
      <Heart size={26} color="#6E5C93" style={{ marginBottom: 8 }} />
      <div style={{ color: "#B8A9D9", fontSize: 14 }}>No reviews yet. Once the first one lands, the leaderboard fills in here.</div>
    </div>
  );
}

export default function NushNom() {
  useFonts();
  const [data, setData] = useState(null);
  const [view, setView] = useState("dashboard"); // dashboard | add | manage
  const isNushRoute = window.location.pathname.replace(/\/+$/, "") === "/nush";

  useEffect(() => {
    loadData().then(setData);
  }, []);

  useEffect(() => {
    if (data) saveData(data);
  }, [data]);

  if (!data) {
    return (
      <div style={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center", background: "#1B1030" }}>
        <Loader2 size={24} color="#FFB627" className="spin" />
      </div>
    );
  }

  const badges = computeBadges(data.reviews);
  const profile = { badges };

  const closeToDashboard = () => setView("dashboard");

  const addRestaurant = (r) => setData(prev => ({ ...prev, restaurants: [...prev.restaurants, r] }));
  const addReview = (review) => setData(prev => ({
    ...prev,
    reviews: [...prev.reviews, review],
    restaurants: prev.restaurants.map(r => r.id === review.restaurantId
      ? { ...r, cuisines: Array.from(new Set([...(r.cuisines || []), ...(review.cuisines || [])])) }
      : r
    ),
  }));
  const updateReview = (id, updates) => setData(prev => {
    const target = prev.reviews.find(r => r.id === id);
    if (!target) return prev;
    return {
      ...prev,
      reviews: prev.reviews.map(r => r.id === id ? { ...r, ...updates } : r),
      restaurants: prev.restaurants.map(r => r.id === target.restaurantId
        ? { ...r, cuisines: Array.from(new Set([...(r.cuisines || []), ...(updates.cuisines || [])])) }
        : r
      ),
    };
  });
  const deleteReview = (id) => setData(prev => ({ ...prev, reviews: prev.reviews.filter(r => r.id !== id) }));

  return (
    <div style={{
      background: "#1B1030", minHeight: "100vh", padding: "28px 20px",
      fontFamily: "'Inter', sans-serif"
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .blink-cursor { animation: blink 1s step-end infinite; }
        @keyframes beltScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        ::selection { background: #FF4D8D; color: #4B1528; }
      `}</style>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, opacity: 0.1,
        background: "repeating-linear-gradient(0deg, #000 0px, transparent 1px, transparent 2px, #000 3px)"
      }} />
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: "#FF4D8D",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <ChefHat size={22} color="#4B1528" />
            </div>
            <div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 24, color: "#F5EFE6", fontWeight: 800, lineHeight: 1 }}>NushNom</div>
              <div style={{ fontSize: 11, color: "#B8A9D9" }}>Anushka's Mumbai food quest</div>
            </div>
          </div>
          {isNushRoute && view === "dashboard" && (
            <button aria-label="Manage reviews" title="Manage reviews" onClick={() => setView("manage")} style={{
              background: "none", border: "1px solid #4E3480", borderRadius: 10, padding: 8,
              color: "#B8A9D9", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Edit2 size={12} />
            </button>
          )}
        </div>

        {view === "dashboard" && (
          <Dashboard restaurants={data.restaurants} reviews={data.reviews} profile={profile} onAddReview={isNushRoute ? () => setView("add") : null} />
        )}

        {view === "add" && (
          <div style={{ background: "#241640", border: "1px solid #4E3480", borderRadius: 16, padding: 22 }}>
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
          <div style={{ background: "#241640", border: "1px solid #4E3480", borderRadius: 16, padding: 22 }}>
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
    </div>
  );
}
