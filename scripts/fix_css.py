with open("f:/AirVintage Project/AirVintage/frontend/src/App.css", "r", encoding="utf-8") as f:
    lines = f.readlines()

index = -1
for i, line in enumerate(lines):
    if "/* ── Light Mode Specific Contrast Fixes ── */" in line:
        index = i
        break

if index != -1:
    lines = lines[:index]

light_mode_css = """/* ── Light Mode Specific Contrast Fixes ── */
.light .score-label,
.light .score-gauge-wrap text,
.light .trend-today-badge,
.light .trend-day-label.today {
  filter: brightness(0.65) saturate(1.5) !important;
}

.light .nav-live-dot {
  background: var(--success) !important;
}

.light .nav-live-label {
  color: var(--success) !important;
}

.light .nav-live-chip {
  background: rgba(22, 163, 74, 0.12) !important;
  border-color: rgba(22, 163, 74, 0.3) !important;
}

.light .nav-logo-text {
  background: linear-gradient(110deg, #0284c7 0%, #0369a1 45%, #047857 100%) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
}

.light .nav-badge {
  background: linear-gradient(110deg, rgba(2, 132, 199, 0.1), rgba(4, 120, 87, 0.1)) !important;
  color: #0284c7 !important;
  border-color: rgba(2, 132, 199, 0.3) !important;
}
"""

with open("f:/AirVintage Project/AirVintage/frontend/src/App.css", "w", encoding="utf-8") as f:
    f.writelines(lines)
    f.write(light_mode_css)
