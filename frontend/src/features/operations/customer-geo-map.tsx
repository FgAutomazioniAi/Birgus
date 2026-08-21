"use client";

import { MapContainer, Popup, TileLayer, CircleMarker } from "react-leaflet";

export interface CustomerGeoPoint {
  id: string;
  customerName: string;
  label?: string | null;
  latitude: number;
  longitude: number;
}

export function CustomerGeoMap({ points, selectedId }: { points: CustomerGeoPoint[]; selectedId: string | null }) {
  const selected = points.find((point) => point.id === selectedId) ?? points[0];

  if (!selected) {
    return <div className="flex h-full items-center justify-center text-sm text-text-muted">Nessun punto geocodificato.</div>;
  }

  return (
    <MapContainer center={[selected.latitude, selected.longitude]} zoom={8} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((point) => {
        const active = point.id === selected.id;
        return (
          <CircleMarker
            key={point.id}
            center={[point.latitude, point.longitude]}
            radius={active ? 10 : 7}
            pathOptions={{
              color: active ? "#b42318" : "#0f766e",
              fillColor: active ? "#b42318" : "#0f766e",
              fillOpacity: 0.78,
            }}
          >
            <Popup>
              <strong>{point.customerName}</strong>
              <br />
              {point.label}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
