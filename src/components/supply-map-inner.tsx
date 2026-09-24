"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";

export type MapNode = { id: string; name: string; type: string; city: string; lat: number; lng: number; color: string; label: string; step?: number };
export type MapFlow = { from: string; to: string; kg: number; label?: string; pending?: boolean };

function curve(a: [number, number], b: [number, number], bend = 0.18, steps = 32): [number, number][] {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([(1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2, (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2]);
  }
  return pts;
}

function Fit({ nodes }: { nodes: MapNode[] }) {
  const map = useMap();
  useEffect(() => {
    if (!nodes.length) return;
    map.fitBounds(L.latLngBounds(nodes.map((n) => [n.lat, n.lng])), { padding: [48, 48] });
  }, [map, nodes]);
  return null;
}

export default function SupplyMapInner({ nodes, flows, height = 560, interactive = true }: { nodes: MapNode[]; flows: MapFlow[]; height?: number; interactive?: boolean }) {
  const maxKg = Math.max(1, ...flows.map((f) => f.kg));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const icon = (n: MapNode) =>
    L.divIcon({
      className: "",
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      html: `<div style="position:relative;width:34px;height:34px">
        <span style="position:absolute;inset:0;border-radius:999px;background:${n.color};opacity:.22;animation:ping 2.4s cubic-bezier(0,0,.2,1) infinite"></span>
        <span style="position:absolute;inset:5px;border-radius:999px;background:${n.color};border:2.5px solid #fbf8f2;box-shadow:0 4px 10px rgba(0,0,0,.25);display:grid;place-items:center;color:#fbf8f2;font:700 10px var(--font-jetbrains)">${n.step ?? n.label}</span>
      </div>`,
    });

  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl ring-1 ring-line">
      <style>{`@keyframes ping{75%,100%{transform:scale(1.9);opacity:0}}`}</style>
      <MapContainer center={[20.5, 76]} zoom={5} scrollWheelZoom={interactive} dragging={interactive} zoomControl={interactive} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        <Fit nodes={nodes} />
        {flows.map((f, i) => {
          const a = byId.get(f.from);
          const b = byId.get(f.to);
          if (!a || !b) return null;
          const pts = curve([a.lat, a.lng], [b.lat, b.lng]);
          return (
            <Polyline key={i} positions={pts} pathOptions={{ color: f.pending ? "#d6a021" : "#b0412a", weight: 1.5 + (f.kg / maxKg) * 6, opacity: 0.75, dashArray: f.pending ? "6 8" : undefined, lineCap: "round" }}>
              {f.label && <Tooltip sticky>{f.label}</Tooltip>}
            </Polyline>
          );
        })}
        {nodes.map((n) => (
          <Marker key={n.id} position={[n.lat, n.lng]} icon={icon(n)}>
            <Tooltip direction="top" offset={[0, -14]} opacity={1}>
              <div style={{ fontFamily: "var(--font-hanken)" }}>
                <b>{n.name}</b>
                <br />
                <span style={{ color: "#857d6e" }}>{n.city}</span>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
