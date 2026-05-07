import React, { useState, useEffect, useCallback } from "react";

const NewsPage = ({ theme, locationName }) => {
  const localCity = locationName?.city;
  const [region, setRegion] = useState(localCity || "world");
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Article Reader State
  const [activeArticle, setActiveArticle] = useState(null);
  const [articleContent, setArticleContent] = useState(null);
  const [fetchingArticle, setFetchingArticle] = useState(false);
  const [articleError, setArticleError] = useState(null);

  const openArticle = async (e, url) => {
    if (region !== localCity) return; // Allow normal redirect if not local
    e.preventDefault();
    setActiveArticle(url);
    setFetchingArticle(true);
    setArticleError(null);
    setArticleContent(null);
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/article?url=${encodeURIComponent(url)}`);
      if (res.ok) {
         const data = await res.json();
         if (data.error) throw new Error(data.error);
         setArticleContent(data);
      } else {
         throw new Error("Failed to load article");
      }
    } catch(err) {
       setArticleError(err.message);
    } finally {
       setFetchingArticle(false);
    }
  };

  const closeArticle = () => {
    setActiveArticle(null);
    setArticleContent(null);
    setArticleError(null);
  };

  const fetchNews = useCallback(async (selectedRegion) => {
    setLoading(true);
    setError(null);
    console.log(`🔄 [NewsPage] Fetching ${selectedRegion} news...`);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${apiUrl}/news?region=${selectedRegion}`);
      console.log(`📊 API Response Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ API Response Data:`, data);
        console.log(`📈 Total articles received: ${data.count || 0}`);
        
        if (data.news && data.news.length > 0) {
          console.log(`🎯 First article:`, data.news[0]);
        }
        
        setNews(data.news || []);
        
        if (!data.news || data.news.length === 0) {
          console.warn(`⚠️ API returned 0 articles for region: ${selectedRegion}`);
        }
      } else {
        const errorText = await response.text();
        console.error(`❌ HTTP Error ${response.status}: ${errorText}`);
        setError(`Failed to fetch ${selectedRegion} news (HTTP ${response.status})`);
        setNews([]);
      }
    } catch (error) {
      console.error("❌ Network Error:", error);
      setError("Unable to connect to news service. Please check your internet connection and backend is running.");
      setNews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(region);
  }, [region, fetchNews]);

  // Premium default images for articles that don't have one in their RSS metadata
  const fallbackImages = [
    "https://picsum.photos/id/10/600/400", // Nature / Forest
    "https://picsum.photos/id/11/600/400", // Nature / Landscape
    "https://picsum.photos/id/13/600/400", // Nature / River
    "https://picsum.photos/id/14/600/400", // Ocean / Environment
    "https://picsum.photos/id/28/600/400", // Forest
    "https://picsum.photos/id/29/600/400", // Mountains
    "https://picsum.photos/id/16/600/400"  // Landscape
  ];

  const handleImageError = (e, index) => {
    const fallbackSrc = fallbackImages[index % fallbackImages.length];
    if (e.target.src !== fallbackSrc) {
      e.target.src = fallbackSrc;
    }
  };

  return (
    <div className={`news-page-container ${theme}`}>
      <header className="news-header">
        <h2 className="news-title">Atmospheric News</h2>
        <p className="news-subtitle">Stay informed about the environment & climate</p>
        
        <div className="news-tabs">
          {localCity && (
            <button 
              className={`news-tab ${region === localCity ? "active" : ""}`} 
              onClick={() => setRegion(localCity)}
              title={`News for ${localCity}`}
            >
              Local ({localCity})
            </button>
          )}
          <button 
            className={`news-tab ${region === "india" ? "active" : ""}`} 
            onClick={() => setRegion("india")}
          >
            India
          </button>
          <button 
            className={`news-tab ${region === "world" ? "active" : ""}`} 
            onClick={() => setRegion("world")}
          >
            World
          </button>
        </div>
      </header>

      {loading ? (
        <div className="skeleton-news-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-news-card">
              <div className="skeleton-news-image" />
              <div className="skeleton-news-content">
                <div className="skeleton-news-title" />
                <div className="skeleton-news-desc" />
                <div className="skeleton-news-desc" />
                <div className="skeleton-news-desc" />
                <div 
                  className="skeleton-news-desc" 
                  style={{ marginTop: "12px", width: "50%" }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="news-grid">
          <div className="news-error">
            <div className="error-icon">⚠️</div>
            <h3>Unable to Load News</h3>
            <p>{error}</p>
            <button 
              className="retry-btn"
              onClick={() => fetchNews(region)}
            >
              Try Again
            </button>
          </div>
        </div>
      ) : news.length > 0 ? (
        <div className="news-grid">
          {news.map((item, index) => (
            <article key={index} className="news-card">
              <div className="news-image-wrapper">
                <img 
                  src={item.imageUrl || fallbackImages[index % fallbackImages.length]} 
                  alt={item.title} 
                  className="news-image" 
                  loading="lazy"
                  onError={(e) => handleImageError(e, index)}
                />
              </div>
              <div className="news-card-content">
                <span className="news-date">{item.pubDate}</span>
                <h3 className="news-card-title">{item.title}</h3>
                <p className="news-description">{item.description}</p>
                <a 
                  href={item.link} 
                  target={region === localCity ? "_self" : "_blank"} 
                  rel="noopener noreferrer" 
                  className="news-read-more"
                  onClick={(e) => { if(region === localCity) openArticle(e, item.link); }}
                >
                  Read Full Article
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="news-grid">
          <div className="news-empty">
            <p>No news available at the moment.</p>
            <button 
              className="retry-btn"
              onClick={() => fetchNews(region)}
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Internal Article Reader Modal */}
      {activeArticle && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: '800px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '30px', position: 'relative', marginTop: '20px' }}>
            <button 
              onClick={closeArticle}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-1)', padding: '8px 16px', borderRadius: '100px', cursor: 'pointer', marginBottom: '20px', fontWeight: 'bold' }}>
              ← Close Reader
            </button>

            {fetchingArticle ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-2)' }}>Extracting article content securely...</div>
            ) : articleError ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#f87171' }}>
                <p>Failed to extract text from the publisher.</p>
                <a href={activeArticle} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', marginTop: '10px', display: 'inline-block' }}>Visit original page instead</a>
              </div>
            ) : articleContent ? (
              <div>
                <h1 style={{ fontSize: '28px', color: 'var(--text-1)', marginBottom: '24px', lineHeight: '1.3' }}>{articleContent.title}</h1>
                <div style={{ color: 'var(--text-2)', fontSize: '17px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                  {articleContent.content || "Empty content payload. Wait for publishers to update."}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsPage;
