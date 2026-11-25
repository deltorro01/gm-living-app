// Map of the matched areas, coloured by match score.
// Loaded only when the user opens the map (see React.lazy in App.jsx), so
// Leaflet never runs during prerendering and isn't in the main download.

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FIT_BANDS as BANDS, fitBand } from "./bands.js";

const colorFor = (score) => fitBand(score).color;

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export default function AreaMap({ areas, budgetType, money, onSelect, center = [53.48, -2.24] }) {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);

  useEffect(() => {
    map.current = L.map(box.current, { scrollWheelZoom: false }).setView(center, 10);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => map.current.remove();
  }, []);

  // Zoom to fit only when the set of areas shown changes (not on every score change).
  const areaKey = areas
    .map((a) => a.area)
    .sort()
    .join("|");
  useEffect(() => {
    const points = areas.map((a) => [a.lat, a.lng]);
    if (points.length) map.current.fitBounds(points, { padding: [30, 30], maxZoom: 13, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaKey]);

  useEffect(() => {
    layer.current.clearLayers();
    // Draw lower scores first so the best matches sit on top.
    [...areas].reverse().forEach((area) => {
      const rank = areas.indexOf(area) + 1;
      const cost =
        budgetType === "rent" ? `Rent ${money(area.averageRent)} pcm` : `Typical price ${money(area.averageHousePrice)}`;
      const marker = L.circleMarker([area.lat, area.lng], {
        radius: rank <= 3 ? 11 : 8,
        color: "#ffffff",
        weight: 2,
        fillColor: colorFor(area.match),
        fillOpacity: 0.95,
      })
        .bindTooltip(`${escapeHtml(area.area)} ${area.match}%`)
        .bindPopup(
          `<strong>#${rank} ${escapeHtml(area.area)}</strong> (${escapeHtml(area.borough)})<br>` +
            `${area.match}% match<br>${escapeHtml(cost)}<br>About ${area.commuteCityMinutes} mins to the city centre`
        );
      if (onSelect) marker.on("click", () => onSelect(area.area));
      marker.addTo(layer.current);
    });
  }, [areas, budgetType, money, onSelect]);

  return (
    <div>
      <div ref={box} className="area-map" role="region" aria-label="Map of matching areas" />
      <div className="map-legend">
        {BANDS.map((b) => (
          <span key={b.label} className="map-legend-item">
            <span className="map-dot" style={{ background: b.color }} />
            {b.label}
          </span>
        ))}
        <span className="map-legend-item muted">Bigger dots are your top 3</span>
      </div>
    </div>
  );
}
