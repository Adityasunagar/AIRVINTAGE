import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "../logo.svg";

const NAV_LINKS = [
  { path: "/",        label: "Dashboard" },
  { path: "/map",     label: "Map"       },
  { path: "/forecast",label: "Forecast"  },
  { path: "/news",    label: "News"      },
  { path: "/about",   label: "About"     },
];

function Navbar({ locationName, theme, setTheme, onRefresh, loading }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const city      = locationName?.city || null;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);

  const go = (path) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="navbar">
      {/* Brand */}
      <div className="nav-logo" onClick={() => go("/")} style={{ cursor: "pointer" }}>
        <img src={logo} alt="AirVintage logo" className="av-logo-img" />
        <span className="nav-logo-text">AirVintage</span>
        <span className="nav-badge">BETA</span>
      </div>

      {/* Page links */}
      <div className="nav-links">
        {NAV_LINKS.map((link) => (
          <button
            key={link.path}
            className={`nav-link ${isActive(link.path) ? "active" : ""}`}
            onClick={() => go(link.path)}
          >
            {link.label}
          </button>
        ))}
      </div>

      {/* Right controls */}
      <div className="nav-right">
        {city && (
          <div className="nav-location">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {city}
          </div>
        )}

        <button
          className={`nav-icon-btn ${loading ? "spinning" : ""}`}
          onClick={onRefresh}
          title="Refresh data"
          disabled={loading}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>

        <button
          className="nav-icon-btn"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <button
          className="nav-icon-btn mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          title="Toggle Menu"
        >
          {isMobileMenuOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="mobile-nav-menu">
          {NAV_LINKS.map((link) => (
            <button
              key={link.path}
              className={`mobile-nav-link ${isActive(link.path) ? "active" : ""}`}
              onClick={() => go(link.path)}
            >
              {link.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

export default Navbar;
