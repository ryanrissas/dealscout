"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapDeal {
  id: string; street: string; city: string;
  lat: number; lng: number;
  color: string | null; score: number | null;
  ratio: number | null; cf: number | null; price: number | null;
}

const HEX: Record<string, string> = {
  DARK_GREEN: "#0B5A32", GREEN: "#1F8A4C", YELLOW: "#B45309", RED: "#B42318",
};

function icon(color: string | null, score: number | null) {
  const bg = HEX[color ?? ""] ?? "#71747C";
  return L.divIcon({
    className: "",
    html: `<div style="background:${bg};color:#fff;font-family:var(--font-mono),monospace;font-weight:700;font-size:11px;line-height:1;padding:4px 6px;border-radius:2px;border:1.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);white-space:nowrap">${score ?? "•"}</div>`,
    iconAnchor: [14, 12],
  });
}

export default function DealMap({ points }: { points: MapDeal[] }) {
  const center: [number, number] = points.length
    ? [points.reduce((a, p) => a + p.lat, 0) / points.length, points.reduce((a, p) => a + p.lng, 0) / points.length]
    : [41.6528, -83.5379]; // Toledo
  return (
    <div className="card overflow-hidden">
      <MapContainer center={center} zoom={11} style={{ height: 540, width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={icon(p.color, p.score)}>
            <Popup>
              <div style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13 }}>
                <strong>{p.street}</strong>
                <br />{p.city}
                <br />Price: {p.price != null ? `$${p.price.toLocaleString()}` : "Unknown"}
                <br />Ratio: {p.ratio != null ? `${p.ratio.toFixed(2)}%` : "Unknown"}
                <br />CF/mo: {p.cf != null ? `$${Math.round(p.cf).toLocaleString()}` : "Unknown"}
                <br /><a href={`/deals/${p.id}`}>Open deal →</a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="border-t border-hairline px-3 py-1.5 text-xs text-ink-faint">
        Map tiles load from OpenStreetMap and need internet access.
      </div>
    </div>
  );
}
