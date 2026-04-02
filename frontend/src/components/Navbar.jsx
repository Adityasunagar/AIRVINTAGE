import React from "react";
import logo from "../logo.svg";


function Navbar({ currentPage, setCurrentPage, locationName, theme, setTheme, onRefresh, loading }) {
  const city = locationName?.city || null;

  const navLinks = [
    { id: "dashboard", label: "Dashboard" },
    { id: "map",       label: "Map"       },
    { id: "news",      label: "News"      },
    { id: "about",     label: "About"     },
  ];

  return (
    <nav className="navbar">
      {/* Brand */}
      <div className="nav-logo" onClick={() => setCurrentPage("dashboard")}>
        <img src={logo} alt="AirVintage logo" className="av-logo-img" />
        <span className="nav-logo-text">AirVintage</span>
        <span className="nav-badge">BETA</span>
      </div>

      {/* Page links */}
      <div className="nav-links">
        {navLinks.map((link) => (
          <button
            key={link.id}
            className={`nav-link ${currentPage === link.id ? "active" : ""}`}
            onClick={() => setCurrentPage(link.id)}
          >
            {link.label}
          </button>
        ))}
      </div>

      {/* Right controls */}
      <div className="nav-right">
        {city && (
          <div className="nav-location">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
