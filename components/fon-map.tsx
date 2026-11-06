'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CarType } from '@/lib/supabase';

export interface NearbyCar {
  id: string;
  lat: number;
  lng: number;
  car_type: CarType | null;
  name: string;
  car_number: string | null;
  car_year: string | null;
  rating: number;
  distance: number;
  photo_url: string | null;
  phone: string | null;
  selected: boolean;
}

interface FonMapProps {
  userLocation?: { lat: number; lng: number } | null;
  nearbyCars?: NearbyCar[];
  fromLat?: number | null;
  fromLng?: number | null;
  toLat?: number | null;
  toLng?: number | null;
  className?: string;
  routePoints?: number[][] | null;
  extraPolyline?: [[number, number], [number, number]] | null;
}

const GOLD = '#C9A86A';
const GOLD_LIGHT = '#E8D5A3';

const userIcon = L.divIcon({
  className: 'fon-user-marker',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#2d7dff;border:3px solid #fff;box-shadow:0 0 10px rgba(45,125,255,0.7),0 0 20px rgba(45,125,255,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const carIcon = L.divIcon({
  className: 'fon-car-marker',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:${GOLD_LIGHT};border:2px solid ${GOLD};box-shadow:0 0 6px rgba(201,168,106,0.4);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const carSelectedIcon = L.divIcon({
  className: 'fon-car-marker-selected',
  html: `<div style="width:22px;height:22px;border-radius:50%;background:${GOLD};border:3px solid #fff;box-shadow:0 0 12px rgba(201,168,106,0.8);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const fromIcon = L.divIcon({
  className: 'fon-from-marker',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 0 8px rgba(34,197,94,0.5);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const toIcon = L.divIcon({
  className: 'fon-to-marker',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 0 8px rgba(239,68,68,0.5);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function FonMap({
  userLocation,
  nearbyCars = [],
  fromLat,
  fromLng,
  toLat,
  toLng,
  className = '',
  routePoints = null,
  extraPolyline = null,
}: FonMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeRef = useRef<L.Polyline | null>(null);
  const traceRef = useRef<L.Polyline | null>(null);
  const extraLineRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const fromMarkerRef = useRef<L.Marker | null>(null);
  const toMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [31.9454, 35.9284],
      zoom: 13,
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

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    nearbyCars.forEach((car) => {
      const icon = car.selected ? carSelectedIcon : carIcon;
      const marker = L.marker([car.lat, car.lng], { icon }).addTo(map);
      markersRef.current.push(marker);
    });
  }, [nearbyCars]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);
      map.setView([userLocation.lat, userLocation.lng], 14, { animate: true });
    }
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }
    if (fromMarkerRef.current) {
      fromMarkerRef.current.remove();
      fromMarkerRef.current = null;
    }
    if (toMarkerRef.current) {
      toMarkerRef.current.remove();
      toMarkerRef.current = null;
    }

    const fLat = fromLat ?? userLocation?.lat;
    const fLng = fromLng ?? userLocation?.lng;

    if (fLat != null && fLng != null) {
      fromMarkerRef.current = L.marker([fLat, fLng], { icon: fromIcon }).addTo(map);
    }

    if (toLat != null && toLng != null) {
      toMarkerRef.current = L.marker([toLat, toLng], { icon: toIcon }).addTo(map);
    }

    if (fLat != null && fLng != null && toLat != null && toLng != null) {
      routeRef.current = L.polyline(
        [
          [fLat, fLng],
          [toLat, toLng],
        ],
        { color: GOLD, weight: 3, opacity: 0.7, dashArray: '8 6' },
      ).addTo(map);

      const bounds = L.latLngBounds([
        [fLat, fLng],
        [toLat, toLng],
      ]);
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [fromLat, fromLng, toLat, toLng, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (traceRef.current) {
      traceRef.current.remove();
      traceRef.current = null;
    }

    if (routePoints && routePoints.length > 1) {
      const latlngs = routePoints.map(([lat, lng]) => [lat, lng] as [number, number]);
      traceRef.current = L.polyline(latlngs, { color: '#22c55e', weight: 4, opacity: 0.8 }).addTo(map);
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [routePoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (extraLineRef.current) {
      extraLineRef.current.remove();
      extraLineRef.current = null;
    }

    if (extraPolyline) {
      extraLineRef.current = L.polyline(extraPolyline, { color: '#3b82f6', weight: 3, opacity: 0.6, dashArray: '6 4' }).addTo(map);
    }
  }, [extraPolyline]);

  return <div ref={containerRef} className={`w-full h-full ${className}`} style={{ background: '#0A1931' }} />;
}
