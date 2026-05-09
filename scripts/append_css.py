import os

css = """
/* ═══════════════════════════════════════════════
   MAP UI OVERHAUL CSS
═══════════════════════════════════════════════ */

/* ── Glassmorphism Dark ── */
.glassmorphism-dark {
  background: rgba(13, 27, 46, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  color: #e8e8e8;
}

/* ── Collapsible Legend ── */
.map-legend-container {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
  transition: all 0.3s ease;
}

.map-legend-pill {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease, background 0.2s;
}

.map-legend-pill:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.05);
}

.map-legend-card {
  border-radius: 12px;
  padding: 16px;
  width: 220px;
  animation: fadeInScale 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes fadeInScale {
  0% { opacity: 0; transform: scale(0.95) translateY(-10px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

/* ── Layer Menu Card (Slide-In) ── */
.custom-layer-card {
  position: absolute;
  top: 150px;
  right: 12px;
  z-index: 1000;
  border-radius: 8px;
  padding: 16px 18px;
  min-width: 220px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  transform: translateX(120%);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s;
}

.custom-layer-card.open {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}

.layer-option {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.layer-option:hover {
  background: rgba(255, 255, 255, 0.05);
}

.layer-option input[type="radio"],
.layer-option input[type="checkbox"] {
  accent-color: #00d4ff;
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.layer-option span {
  font-size: 13px;
  color: #e8e8e8;
}

/* ── Windy-Style Bottom Info Bar ── */
.windy-bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 36px;
  background: rgba(13, 27, 46, 0.9);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  color: #e8e8e8;
  font-size: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.w-bar-left {
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.w-bar-center {
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 400px;
  margin: 0 20px;
}

.w-bar-gradient {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, #00e400, #ffff00, #ff7e00, #ff0000, #8f3f97, #7e0023);
}

/* ── Dark Popup ── */
.dark-popup .leaflet-popup-content-wrapper {
  background: rgba(13, 27, 46, 0.95) !important;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.1);
  color: #e8e8e8;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  padding: 0;
}
.dark-popup .leaflet-popup-tip {
  background: rgba(13, 27, 46, 0.95) !important;
}

/* ── Mobile Responsiveness ── */
@media (max-width: 600px) {
  .windy-bottom-bar {
    padding: 0 8px;
  }
  .w-bar-center {
    display: none;
  }
  .custom-layer-card {
    top: 150px;
    right: 8px;
    min-width: 200px;
  }
  .map-legend-card {
    width: 200px;
  }
}
"""

with open(r'f:\AirVintage Project\AirVintage\frontend\src\App.css', 'a', encoding='utf-8') as f:
    f.write(css)

print("CSS appended to App.css successfully.")
