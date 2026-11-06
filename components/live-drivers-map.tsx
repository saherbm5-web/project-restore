'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LiveDriverMarker {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  is_online: boolean;
  car_number: string;
  rating: number;
  per_km_price: number;
}

interface LiveDriversMapProps {
  drivers: LiveDriverMarker[];
  height?: number;
  center?: { lat: number; lng: number };
  zoom?: number;
  selectedDriverId?: string | null;
  onDriverClick?: (id: string) => void;
  trackingDriverId?: string | null;
}

const GOLD = '#C9A86A';
const IRBID_DEFAULT = { lat: 32.5568, lng: 35.8478 };

function makeOnlineIcon(selected: boolean) {
  const size = selected ? 24 : 18;
  return L.divIcon({
    className: 'fon-live-driver-marker',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 10px rgba(34,197,94,0.7);${selected ? 'animation:pulse 1.5s infinite;' : ''}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function makeOfflineIcon() {
  return L.divIcon({
    className: 'fon-live-driver-marker-offline',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 0 6px rgba(239,68,68,0.5);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function LiveDriversMap({
  drivers,
  height = 400,
  center,
  zoom = 13,
  selectedDriverId,
  onDriverClick,
  trackingDriverId,
}: LiveDriversMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const selectedMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const c = center || IRBID_DEFAULT;
    const map = L.map(containerRef.current, {
      center: [c.lat, c.lng],
      zoom,
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
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existingIds = new Set(markersRef.current.keys());
    const newIds = new Set(drivers.map((d) => d.id));

    existingIds.forEach((id) => {
      if (!newIds.has(id)) {
        const m = markersRef.current.get(id);
        if (m) {
          m.remove();
          markersRef.current.delete(id);
        }
      }
    });

    drivers.forEach((d) => {
      const existing = markersRef.current.get(d.id);
      const isSelected = d.id === selectedDriverId || d.id === trackingDriverId;
      const icon = d.is_online ? makeOnlineIcon(isSelected) : makeOfflineIcon();

      if (existing) {
        existing.setLatLng([d.lat, d.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([d.lat, d.lng], { icon }).addTo(map);
        marker.bindPopup(
          `<div style="direction:rtl;text-align:right;font-family:sans-serif;min-width:180px;">
            <div style="font-weight:bold;font-size:14px;color:${GOLD};margin-bottom:4px;">${d.name}</div>
            <div style="font-size:12px;color:#666;margin-bottom:2px;">الهاتف: <span dir="ltr">${d.phone}</span></div>
            <div style="font-size:12px;color:#666;margin-bottom:2px;">رقم السيارة: <span dir="ltr">${d.car_number}</span></div>
            <div style="font-size:12px;margin-bottom:2px;">الحالة: <span style="color:${d.is_online ? '#22c55e' : '#ef4444'};font-weight:bold;">${d.is_online ? 'متصل' : 'غير متصل'}</span></div>
            <div style="font-size:12px;color:#666;margin-bottom:2px;">التقييم: ${d.rating.toFixed(1)}</div>
            <div style="font-size:12px;color:#666;">سعر الكم: ${d.per_km_price.toFixed(2)} د.أ</div>
          </div>`,
          { className: 'fon-live-popup' },
        );
        if (onDriverClick) {
          marker.on('click', () => onDriverClick(d.id));
        }
        markersRef.current.set(d.id, marker);
      }
    });

    if (selectedDriverId) {
      const m = markersRef.current.get(selectedDriverId);
      if (m) {
        m.openPopup();
        const d = drivers.find((d) => d.id === selectedDriverId);
        if (d) {
          map.setView([d.lat, d.lng], 15, { animate: true });
        }
      }
    }

    if (trackingDriverId) {
      const d = drivers.find((d) => d.id === trackingDriverId);
      if (d) {
        map.setView([d.lat, d.lng], 16, { animate: true });
      }
    }

    if (!selectedDriverId && !trackingDriverId && drivers.length > 0) {
      const onlineDrivers = drivers.filter((d) => d.is_online);
      const target = onlineDrivers.length > 0 ? onlineDrivers : drivers;
      if (target.length === 1) {
        map.setView([target[0].lat, target[0].lng], 14, { animate: true });
      } else if (target.length > 1) {
        const bounds = L.latLngBounds(target.map((d) => [d.lat, d.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers, selectedDriverId, trackingDriverId]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden border border-[#C9A86A]/20"
      style={{ height, background: '#0A1931' }}
    />
  );
}
