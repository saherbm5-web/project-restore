'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface TripMapData {
  id: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  status: 'completed' | 'in_progress' | 'cancelled' | 'pending';
  driverName: string;
  fromLabel: string;
  toLabel: string;
  price?: number;
  customerPhone?: string;
  distanceKm?: number;
}

interface TripsMapProps {
  trips: TripMapData[];
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#C9A86A',
  in_progress: '#3b82f6',
  cancelled: '#6b7280',
  pending: '#fbbf24',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'مخلصة',
  in_progress: 'بالطريق',
  cancelled: 'ملغية',
  pending: 'بالانتظار',
};

function makeIcon(color: string, size = 12, isPickup = true) {
  const label = isPickup ? 'A' : 'B';
  return L.divIcon({
    className: 'fon-trip-marker',
    html: `<div style="width:${size + 6}px;height:${size + 6}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 6px ${color}80;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:bold;">${label}</div>`,
    iconSize: [size + 6, size + 6],
    iconAnchor: [(size + 6) / 2, (size + 6) / 2],
  });
}

export default function TripsMap({ trips }: TripsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [31.9454, 35.9284],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layers: L.Layer[] = [];

    trips.forEach((trip) => {
      const color = STATUS_COLORS[trip.status] ?? STATUS_COLORS.completed;
      const statusLabel = STATUS_LABELS[trip.status] ?? trip.status;

      const fromMarker = L.marker([trip.fromLat, trip.fromLng], { icon: makeIcon(color, 10, true) }).addTo(map);
      const toMarker = L.marker([trip.toLat, trip.toLng], { icon: makeIcon(color, 10, false) }).addTo(map);

      const line = L.polyline(
        [
          [trip.fromLat, trip.fromLng],
          [trip.toLat, trip.toLng],
        ],
        { color, weight: 3, opacity: 0.6, dashArray: trip.status === 'in_progress' ? '8 6' : undefined },
      ).addTo(map);

      const popupHtml = `<div style="direction:rtl;text-align:right;font-family:sans-serif;min-width:200px;">
        <div style="font-weight:bold;font-size:13px;color:${color};margin-bottom:6px;border-bottom:1px solid ${color}40;padding-bottom:4px;">${statusLabel}</div>
        <div style="font-size:11px;color:#888;margin-bottom:3px;">السائق: <span style="color:#333;font-weight:bold;">${trip.driverName}</span></div>
        ${trip.customerPhone ? `<div style="font-size:11px;color:#888;margin-bottom:3px;">الراكب: <span dir="ltr" style="color:#333;">${trip.customerPhone}</span></div>` : ''}
        ${trip.price != null ? `<div style="font-size:11px;color:#888;margin-bottom:3px;">الأجرة: <span style="color:#22c55e;font-weight:bold;">${trip.price.toFixed(2)} د.أ</span></div>` : ''}
        ${trip.distanceKm != null ? `<div style="font-size:11px;color:#888;margin-bottom:3px;">المسافة: <span style="color:#333;">${trip.distanceKm.toFixed(1)} كم</span></div>` : ''}
        <div style="font-size:10px;color:#aaa;margin-top:4px;border-top:1px solid #eee;padding-top:4px;">
          <div style="margin-bottom:2px;"><span style="color:#22c55e;">●</span> من: ${trip.fromLabel}</div>
          <div><span style="color:#ef4444;">●</span> إلى: ${trip.toLabel}</div>
        </div>
      </div>`;

      fromMarker.bindPopup(popupHtml, { className: 'fon-trip-popup' });
      toMarker.bindPopup(popupHtml, { className: 'fon-trip-popup' });

      fromMarker.bindTooltip(trip.fromLabel, { permanent: false, direction: 'top', className: 'fon-map-tooltip' });
      toMarker.bindTooltip(trip.toLabel, { permanent: false, direction: 'top', className: 'fon-map-tooltip' });

      layers.push(fromMarker, toMarker, line);
    });

    if (trips.length > 0) {
      const bounds = L.latLngBounds(
        trips.flatMap((t) => [
          [t.fromLat, t.fromLng],
          [t.toLat, t.toLng],
        ]),
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      layers.forEach((l) => map.removeLayer(l));
    };
  }, [trips]);

  return <div ref={containerRef} className="w-full h-full" style={{ background: '#0A1931' }} />;
}
