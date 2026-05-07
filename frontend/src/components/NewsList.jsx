import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const FALLBACK_IMAGES = [
  "https://picsum.photos/id/10/600/400",
  "https://picsum.photos/id/11/600/400",
  "https://picsum.photos/id/13/600/400",
  "https://picsum.photos/id/28/600/400",
  "https://picsum.photos/id/29/600/400",
  "https://picsum.photos/id/16/600/400",
];


// Keyword-based article category classifier
function classifyArticle(title = "", description = "") {
  const text = (title + " " + description).toLowerCase();
  if (/aqi|pm2\.5|pm10|pollution|smog|particulate|air quality|haze|ozone|nitrogen dioxide/.test(text)) return "Air Quality";
  if (/rain|flood|storm|cyclone|hurricane|weather|temperature|humidity|drought|snow/.test(text)) return "Weather";
  if (/climate|carbon|emission|greenhouse|global warm|fossil fuel|renewable|net zero/.test(text)) return "Climate";
  return "Environment";
}

const CATEGORY_COLORS = {
  "Air Quality":  { bg: "rgba(251,146,60,0.15)",  color: "#fb923c" },
  "Weather":      { bg: "rgba(56,189,248,0.15)",  color: "#38bdf8" },
  "Climate":      { bg: "rgba(74,222,128,0.15)",  color: "#4ade80" },
  "Environment":  { bg: "rgba(167,139,250,0.15)", color: "#a78bfa" },
};

function NewsListSkeleton() {
  return (
    <div className="nl-grid">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="nl-card nl-skeleton-card">
          <div className="nl-card-img nl-skel" />
          <div className="nl-card-body">
            <div className="nl-skel nl-skel-tag" />
            <div className="nl-skel nl-skel-title" />
            <div className="nl-skel nl-skel-line" />
            <div className="nl-skel nl-skel-line" style={{ width: "70%" }} />
            <div className="nl-card-footer">
              <div className="nl-skel nl-skel-meta" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const FALLBACK_NEWS = [
  {
    id: "mock1",
    title: "Global Initiatives Launch for Cleaner Urban Air",
    description: "New policies introduced aiming at reducing PM2.5 levels in major metropolitan areas over the next decade.",
    category: "Air Quality",
    source: "Global Environment Org",
    pubDate: new Date().toISOString(),
    link: "#"
  },
  {
    id: "mock2",
    title: "Unexpected Weather Patterns Disrupt Agriculture",
    description: "Farmers report significant challenges due to recent climate shifts bringing unseasonal rainfall and droughts.",
    category: "Weather",
    source: "Climate Daily",
    pubDate: new Date(Date.now() - 86400000).toISOString(),
    link: "#"
  },
  {
    id: "mock3",
    title: "Renewable Energy Adoption Hits Record High",
    description: "More countries are committing to renewable energy standards, promising a substantial cut in greenhouse gas emissions.",
    category: "Climate",
    source: "Eco Watch",
    pubDate: new Date(Date.now() - 172800000).toISOString(),
    link: "#"
  },
  {
    id: "mock4",
    title: "Ocean Temperatures Reach Unprecedented Peaks",
    description: "Marine biologists warn of severe ecosystem impacts as ocean temperatures continue to rise at an alarming rate.",
    category: "Environment",
    source: "Nature Network",
    pubDate: new Date(Date.now() - 259200000).toISOString(),
    link: "#"
  }
];

export default function NewsList({ locationName }) {
  const navigate = useNavigate();
  const [region, setRegion] = useState("india");
  const [news, setNews]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const fetchNews = useCallback(async (r) => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
      const res  = await fetch(`${apiUrl}/news?region=${encodeURIComponent(r)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      // Use fallback if API returns empty to ensure something is always shown
      if (!data.news || data.news.length === 0) {
        setNews(FALLBACK_NEWS);
      } else {
        setNews(data.news);
      }
    } catch (e) {
      setError(e.message);
      // Ensure we display fallback data in case of any network error or backend issue
      setNews(FALLBACK_NEWS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNews(region); }, [region, fetchNews]);

  const handleCardClick = (article) => {
    // Store article in sessionStorage so the detail page can read it without
    // a separate network call (the cache endpoint is also available as fallback)
    sessionStorage.setItem(`article_${article.id}`, JSON.stringify(article));
    navigate(`/news/${article.id}`);
  };

  const tabs = [
    { id: "india", label: "🇮🇳 India" },
    { id: "world", label: "🌍 World" },
  ];

  const filteredNews = news.filter((article) => {
    const textToSearch = (article.title || "") + " " + (article.description || "");
    const matchesSearch = textToSearch.toLowerCase().includes(searchQuery.toLowerCase());
    const category = classifyArticle(article.title, article.description);
    const matchesCategory = selectedCategory === "All" || category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="nl-page">
      {/* ── Header ── */}
      <div className="nl-header">
        <div>
          <h1 className="nl-title">Atmospheric News</h1>
          <p className="nl-subtitle">AQI · Weather · Climate · Environment</p>
        </div>

        {/* Region tabs */}
        <div className="nl-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`nl-tab${region === t.id ? " active" : ""}`}
              onClick={() => setRegion(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Filters & Search ── */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
            {["All", "Air Quality", "Weather", "Climate", "Environment"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: selectedCategory === cat ? 'none' : '1px solid var(--card-border)',
                  background: selectedCategory === cat ? 'var(--accent)' : 'transparent',
                  color: selectedCategory === cat ? '#fff' : 'var(--text-2)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: selectedCategory === cat ? '600' : '400',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          <div style={{ flex: '1', minWidth: '200px', maxWidth: '300px' }}>
            <input
              type="text"
              placeholder="Search news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid var(--card-border)',
                background: 'var(--card-bg)',
                color: 'var(--text-1)',
                outline: 'none',
                fontSize: '0.9rem'
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <NewsListSkeleton />
      ) : error && filteredNews.length === 0 ? (
        <div className="nl-state-box">
          <span className="nl-state-icon">⚠️</span>
          <h3>Unable to load news</h3>
          <p>{error}</p>
          <button className="nl-retry-btn" onClick={() => fetchNews(region)}>Try Again</button>
        </div>
      ) : filteredNews.length === 0 ? (
        <div className="nl-state-box">
          <span className="nl-state-icon">📰</span>
          <h3>No articles found</h3>
          <p>{news.length > 0 ? "Try adjusting your search or category filters." : "Try a different region or check back shortly."}</p>
          {news.length > 0 ? (
             <button className="nl-retry-btn" onClick={() => { setSearchQuery(""); setSelectedCategory("All"); }}>Clear Filters</button>
          ) : (
             <button className="nl-retry-btn" onClick={() => fetchNews(region)}>Refresh</button>
          )}
        </div>
      ) : (
        <div className="nl-grid">
          {filteredNews.map((article, idx) => (
            <article
              key={article.id || idx}
              className="nl-card"
              onClick={() => handleCardClick(article)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && handleCardClick(article)}
            >
              <div className="nl-card-img-wrapper">
                <img
                  src={article.imageUrl || FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length]}
                  alt={article.title}
                  className="nl-card-img"
                  loading="lazy"
                  onError={(e) => { e.target.src = FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length]; }}
                />
                <div
                  className="nl-card-category-badge"
                  style={{
                    background: CATEGORY_COLORS[classifyArticle(article.title, article.description)]?.bg,
                    color: CATEGORY_COLORS[classifyArticle(article.title, article.description)]?.color,
                    border: `1px solid ${CATEGORY_COLORS[classifyArticle(article.title, article.description)]?.color}33`,
                  }}
                >
                  {classifyArticle(article.title, article.description)}
                </div>
              </div>

              <div className="nl-card-body">
                <div className="nl-card-meta">
                  {article.source && <span className="nl-source">{article.source}</span>}
                  {article.source && article.pubDate && <span className="nl-dot">·</span>}
                  {article.pubDate && (
                    <span className="nl-date">
                      {new Date(article.pubDate).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </span>
                  )}
                </div>

                <h2 className="nl-card-title">{article.title}</h2>
                <p className="nl-card-desc">{article.description}</p>

                <div className="nl-card-footer">
                  <span className="nl-read-more">
                    Read Full Article
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
