"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";

export interface CustomerGeoPoint {
  id: string;
  customerName: string;
  label?: string | null;
  latitude: number;
  longitude: number;
}

const escapeHtml = (value: string): string => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  "\"": "&quot;",
})[character] ?? character);

export function CustomerGeoMap({ points, selectedId }: { points: CustomerGeoPoint[]; selectedId: string | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = points.find((point) => point.id === selectedId) ?? points[0];

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !selected) {
      return;
    }

    // Clear stale Leaflet state that may remain on the element after a hot reload.
    delete (container as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
    container.replaceChildren();

    const map = L.map(container, { scrollWheelZoom: true }).setView([selected.latitude, selected.longitude], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    for (const point of points) {
      const active = point.id === selected.id;
      const color = active ? "#b42318" : "#0f766e";
      const popup = `<strong>${escapeHtml(point.customerName)}</strong>${point.label ? `<br />${escapeHtml(point.label)}` : ""}`;
      L.circleMarker([point.latitude, point.longitude], {
        radius: active ? 10 : 7,
        color,
        fillColor: color,
        fillOpacity: 0.78,
      }).addTo(map).bindPopup(popup);
    }

    return () => {
      map.remove();
    };
  }, [points, selected]);

  if (!selected) {
    return <div className="flex h-full items-center justify-center text-sm text-text-muted">Nessun punto geocodificato.</div>;
  }

  return <div ref={containerRef} className="h-full w-full" aria-label="Mappa clienti" />;
}
