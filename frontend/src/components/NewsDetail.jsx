import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

const FALLBACK_IMAGES = [
  "https://picsum.photos/id/10/800/450",
  "https://picsum.photos/id/28/800/450",
];

export default function NewsDetail() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const [article, setArticle]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      // 1. Try sessionStorage first (instant — populated when user clicked the card)
      const cached = sessionStorage.getItem(`article_${id}`);
      if (cached) {
        try {
          setArticle(JSON.parse(cached));
          setLoading(false);
          return;
        } catch (_) { /* fall through to backend */ }
      }

      // 2. Fallback: fetch from backend cache
      try {
        const res = await fetch(`http://127.0.0.1:8000/news/${id}`);
        if (!res.ok) throw new Error(res.status === 404
          ? "Article not found. Please go back and open it from the news list."
          : `Server error (${res.status})`
        );
        setArticle(await res.json());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return (
    <div className="nd-page">
      <div className="nd-container">
        <div className="nd-skel nd-skel-back" />
        <div className="nd-skel nd-skel-hero" style={{ height: 340 }} />
        <div className="nd-skel nd-skel-tag" style={{ marginTop: 28 }} />
        <div className="nd-skel nd-skel-title" />
        <div className="nd-skel nd-skel-title" style={{ width: "70%" }} />
        <div className="nd-skel nd-skel-line" />
        <div className="nd-skel nd-skel-line" />
        <div className="nd-skel nd-skel-line" style={{ width: "80%" }} />
      </div>
    </div>
  );

  if (error) return (
    <div className="nd-page">
      <div className="nd-container">
        <button className="nd-back-btn" onClick={() => navigate("/news")}>
          ← Back to News
        </button>
        <div className="nd-error-box">
          <span style={{ fontSize: 48 }}>⚠️</span>
          <h2>Could not load article</h2>
          <p>{error}</p>
          <button className="nd-back-btn" onClick={() => navigate("/news")}>
            Return to News List
          </button>
        </div>
      </div>
    </div>
  );

  if (!article) return null;

  const pubDateFormatted = article.pubDate
    ? new Date(article.pubDate).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })
    : null;

  return (
    <div className="nd-page">
      <div className="nd-container">

        {/* ── Back Button ── */}
        <button className="nd-back-btn" onClick={() => navigate("/news")}>
          ←&nbsp;Back to News
        </button>

        {/* ── Hero Image ── */}
        <div className="nd-hero-wrapper">
          <img
            src={article.imageUrl || FALLBACK_IMAGES[0]}
            alt={article.title}
            className="nd-hero-img"
            onError={(e) => { e.target.src = FALLBACK_IMAGES[0]; }}
          />
          <div className="nd-hero-overlay" />
        </div>

        {/* ── Meta ── */}
        <div className="nd-meta-row">
          <span className="nd-category-badge">Environment · AQI</span>
          {article.source && <span className="nd-source-badge">{article.source}</span>}
        </div>

        {/* ── Title ── */}
        <h1 className="nd-title">{article.title}</h1>

        {/* ── Date ── */}
        {pubDateFormatted && (
          <p className="nd-date">{pubDateFormatted}</p>
        )}

        {/* ── Divider ── */}
        <hr className="nd-divider" />

        {/* ── Content ── */}
        <div className="nd-content">
          {article.content
            ? article.content.split(/\n+/).map((para, i) =>
                para.trim() ? <p key={i}>{para.trim()}</p> : null
              )
            : <p>{article.description}</p>
          }
        </div>

        {/* ── Attribution ── */}
        <div className="nd-attribution">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>
            Summary sourced from publicly available RSS metadata.
            {article.link && article.link !== "#" && (
              <> For the full article, <a href={article.link} target="_blank" rel="noopener noreferrer"
                className="nd-ext-link">visit the original publisher ↗</a></>
            )}
          </span>
        </div>

      </div>
    </div>
  );
}
