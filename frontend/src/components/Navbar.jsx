import React from "react";

/* ── AirVintage Logo SVG — Premium Redesign ── */
function AVLogo() {
  return (
    <svg
      width="40" height="40" viewBox="0 0 40 40" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="AirVintage logo"
      className="av-logo-svg"
    >
      <defs>
        {/* Primary sky-to-mint gradient */}
        <linearGradient id="avG1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        {/* Dimmer fill background */}
        <radialGradient id="avG2" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.0" />
        </radialGradient>
        {/* Inner glow disc */}
        <radialGradient id="avGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
        <filter id="avBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      {/* ── Outer ring with gradient stroke ── */}
      <circle cx="20" cy="20" r="18.5"
        fill="url(#avG2)"
        stroke="url(#avG1)" strokeWidth="1.4"
        strokeDasharray="4 2.5"
        strokeLinecap="round"
      />

      {/* ── Inner solid ring ── */}
      <circle cx="20" cy="20" r="14"
        fill="none"
        stroke="url(#avG1)" strokeWidth="0.9" strokeOpacity="0.5"
      />

      {/* ── Glow halo (blurred) ── */}
      <circle cx="20" cy="20" r="13"
        fill="url(#avGlow)"
        filter="url(#avBlur)"
      />

      {/* ── Air-flow arcs (wind waves) ── */}
      {/* Top arc */}
      <path
        d="M10.5 15 Q14 11.5 20 13 Q26 14.5 29.5 15"
        stroke="url(#avG1)" strokeWidth="1.2"
        strokeLinecap="round" fill="none" strokeOpacity="0.65"
      />
      {/* Bottom arc */}
      <path
        d="M10.5 25 Q14 28.5 20 27 Q26 25.5 29.5 25"
        stroke="url(#avG1)" strokeWidth="1.2"
        strokeLinecap="round" fill="none" strokeOpacity="0.65"
      />

      {/* ── AV Monogram ── */}
      {/* A — left half */}
      <path
        d="M13 26 L16.5 14 L18.2 19.5"
        stroke="url(#avG1)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      {/* A crossbar */}
      <line x1="13.8" y1="22" x2="17.8" y2="22"
        stroke="url(#avG1)" strokeWidth="1.6" strokeLinecap="round"
      />
      {/* V */}
      <path
        d="M18.2 14 L21.5 26 L25 14"
        stroke="url(#avG1)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" fill="none"
      />

      {/* ── Centre dot ── */}
      <circle cx="20" cy="20" r="1.5" fill="url(#avG1)" opacity="0.8" />
    </svg>
  );
}

function Navbar({ currentPage, setCurrentPage, locationName, theme, setTheme, onRefresh, loading }) {
  const city = locationName?.city || null;

  const navLinks = [
    { id: "dashboard", label: "Dashboard" },
    { id: "map",       label: "Map"       },
    { id: "about",     label: "About"     },
  ];

  return (
    <nav className="navbar">
      {/* Brand */}
      <div className="nav-logo" onClick={() => setCurrentPage("dashboard")}>
        <AVLogo />
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
