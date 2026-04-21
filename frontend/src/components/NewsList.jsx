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

const CATEGORY_TABS = [
  { id: "aqi",     label: "Air Quality" },
  { id: "weather", label: "Weather"     },
  { id: "climate", label: "Climate"     },
];

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

export default function NewsList({ locationName }) {
  const navigate = useNavigate();
  const localCity = locationName?.city;

  const [region, setRegion] = useState(localCity || "world");
  const [news, setNews]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchNews = useCallback(async (r) => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`http://127.0.0.1:8000/news?region=${encodeURIComponent(r)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNews(data.news || []);
    } catch (e) {
      setError(e.message);
      setNews([]);
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
    ...(localCity ? [{ id: localCity, label: `📍 ${localCity}` }] : []),
    { id: "india", label: "India" },
    { id: "world", label: "World" },
  ];

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
      </div>

      {/* ── Content ── */}
      {loading ? (
        <NewsListSkeleton />
      ) : error ? (
        <div className="nl-state-box">
          <span className="nl-state-icon">⚠️</span>
          <h3>Unable to load news</h3>
          <p>{error}</p>
          <button className="nl-retry-btn" onClick={() => fetchNews(region)}>Try Again</button>
        </div>
      ) : news.length === 0 ? (
        <div className="nl-state-box">
          <span className="nl-state-icon">📰</span>
          <h3>No articles found</h3>
          <p>Try a different region or check back shortly.</p>
          <button className="nl-retry-btn" onClick={() => fetchNews(region)}>Refresh</button>
        </div>
      ) : (
        <div className="nl-grid">
          {news.map((article, idx) => (
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
                <div className="nl-card-category-badge">
                  {CATEGORY_TABS[idx % CATEGORY_TABS.length]?.label || "Environment"}
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
