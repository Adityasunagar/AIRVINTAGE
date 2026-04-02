import React, { useState, useEffect, useCallback } from "react";

const NewsPage = ({ theme }) => {
  const [region, setRegion] = useState("india");
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = useCallback(async (selectedRegion) => {
    setLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/news?region=${selectedRegion}`);
      if (response.ok) {
        const data = await response.json();
        setNews(data.news);
      }
    } catch (error) {
      console.error("Error fetching news:", error);
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

      <div className="news-grid">
        {loading ? (
          <div className="news-loading">
            <div className="spinner"></div>
            <p>Fetching latest reports...</p>
          </div>
        ) : news.length > 0 ? (
          news.map((item, index) => (
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
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="news-read-more"
                >
                  Read Full Article
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                </a>
              </div>
            </article>
          ))
        ) : (
          <div className="news-empty">
            <p>No news available at the moment. Please try again later.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsPage;
