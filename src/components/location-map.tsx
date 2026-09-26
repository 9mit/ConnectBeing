"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

function createLeafletIcon() {
  if (typeof window === "undefined") return undefined;
  return L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
}

export default function LocationMap({
  myPos,
  partnerPos,
}: {
  myPos: { lat: number; lng: number } | null;
  partnerPos: { lat: number; lng: number } | null;
}) {
  const [icon, setIcon] = useState<L.Icon | undefined>(undefined);

  useEffect(() => {
    setIcon(createLeafletIcon());
  }, []);

  const center = partnerPos ?? myPos ?? { lat: 20.5937, lng: 78.9629 };

  return (
    <div className="h-80 overflow-hidden rounded-2xl border border-rose-200">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={partnerPos || myPos ? 13 : 5}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {myPos && icon ? <Marker position={[myPos.lat, myPos.lng]} icon={icon} /> : null}
        {partnerPos && icon ? (
          <Marker position={[partnerPos.lat, partnerPos.lng]} icon={icon} />
        ) : null}
      </MapContainer>
    </div>
  );
}
