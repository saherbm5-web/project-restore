'use client';

import { useState, useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import dynamic from 'next/dynamic';
import { X, MapPin, Rocket, Loader2, CheckCircle2, Search } from 'lucide-react';
import { haversineDistance } from '@/lib/pricing';
import { openDirectGPS } from '@/lib/gps-nav';
import { reverseGeocode, searchAddress, type SearchResult } from '@/lib/geo';
import type { Ride } from '@/lib/supabase';


interface DropoffPickerModalProps {
  ride: Ride;
  initialLat?: number | null;
  initialLng?: number | null;
  onClose: () => void;
  onSaved: (updatedRide: Ride) => void;
}

const FonMap = dynamic(() => import('@/components/fon-map'), { ssr: false, loading: () => null });

export default function DropoffPickerModal({
  ride,
  initialLat,
  initialLng,
  onClose,
  onSaved,
}: DropoffPickerModalProps) {
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(
    ride.to_lat != null && ride.to_lng != null ? { lat: ride.to_lat, lng: ride.to_lng } : null
  );
  const [address, setAddress] = useState<string>(ride.to_address || '');
  const [saving, setSaving] = useState(false);
  const [osrmRoute, setOsrmRoute] = useState<number[][] | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [phase, setPhase] = useState<'pick' | 'route'>(
    ride.to_lat != null && ride.to_lng != null ? 'route' : 'pick'
  );
  const [destinationQuery, setDestinationQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phase !== 'route' || !dropoff) return;
    if (ride.from_lat == null || ride.from_lng == null) return;

    setLoadingRoute(true);
    setOsrmRoute(null);
    const url = `https://router.project-osrm.org/route/v1/driving/${ride.from_lng},${ride.from_lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng] as number[]
          );
          setOsrmRoute(coords);
          setRouteDistance(data.routes[0].distance / 1000);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingRoute(false));
  }, [phase, dropoff, ride.from_lat, ride.from_lng]);

  const handleSearch = async (query: string) => {
    setDestinationQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchAddress(query);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const selectResult = (result: SearchResult) => {
    setDropoff({ lat: result.lat, lng: result.lng });
    setAddress(result.display_name);
    setDestinationQuery(result.display_name);
    setSearchResults([]);
    setPhase('pick');
  };

  const handleMapClick = async (lat: number, lng: number) => {
    setDropoff({ lat, lng });
    setPhase('pick');
    try {
      const addr = await reverseGeocode(lat, lng);
      setAddress(addr);
    } catch {
      setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  const handleConfirm = async () => {
    if (!dropoff) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/rest/v1/rides?id=eq.${ride.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
          },
          body: JSON.stringify({
            to_lat: dropoff.lat,
            to_lng: dropoff.lng,
            to_address: address,
          }),
        }
      );
      if (!res.ok) throw new Error('Failed to save');
      onSaved({ ...ride, to_lat: dropoff.lat, to_lng: dropoff.lng, to_address: address });
      setPhase('route');
    } catch {
      // ignore error
    } finally {
      setSaving(false);
    }
  };

  const directDistance =
    dropoff && ride.from_lat != null && ride.from_lng != null
      ? haversineDistance(ride.from_lat, ride.from_lng, dropoff.lat, dropoff.lng)
      : null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-[#0A1931]/90 backdrop-blur-sm animate-fade-in">
      <div className="fon-card w-full max-w-md p-5 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-fon-gold-light flex items-center gap-2">
            <MapPin className="w-4 h-4 text-fon-gold" />
            {phase === 'pick' ? 'وين بدك توصل الراكب؟' : 'الملاحة للوجهة'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-fon-gold-dark hover:bg-fon-gold/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {phase === 'pick' && (
          <div className="relative space-y-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fon-gold-dark" />
              <input
                type="text"
                value={destinationQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && destinationQuery.trim().length >= 3) {
                    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                    setSearching(true);
                    searchAddress(destinationQuery).then((results) => {
                      setSearchResults(results);
                      setSearching(false);
                    });
                  }
                }}
                placeholder="اكتب الوجهة: اربد مول، جامعة اليرموك..."
                className="fon-input w-full pr-10 pl-10 py-2.5 text-sm"
                dir="rtl"
              />
              {searching && (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fon-gold animate-spin" />
              )}
              {destinationQuery && !searching && (
                <button
                  onClick={() => {
                    setDestinationQuery('');
                    setSearchResults([]);
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-fon-gold-dark hover:text-fon-gold"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchResults.length > 0 && (
              <ul className="bg-fon-dark border border-fon-gold/20 rounded-lg max-h-36 overflow-y-auto z-30 relative">
                {searchResults.map((r, i) => (
                  <li
                    key={i}
                    onClick={() => selectResult(r)}
                    className="px-3 py-2.5 hover:bg-fon-gold/10 cursor-pointer border-b border-fon-gold/10 last:border-0 flex items-start gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-fon-gold mt-0.5 shrink-0" />
                    <span className="text-xs text-fon-gold-light line-clamp-2">{r.display_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Leaflet map with click-to-set-dropoff */}
        <DropoffMap
          pickupLat={ride.from_lat}
          pickupLng={ride.from_lng}
          dropoff={dropoff}
          osrmRoute={osrmRoute}
          loadingRoute={loadingRoute}
          onMapClick={handleMapClick}
        />

        {/* Address / distance info */}
        {dropoff && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs text-fon-gold-light bg-fon-dark rounded-lg p-3">
              <MapPin className="w-3.5 h-3.5 text-fon-gold mt-0.5 shrink-0" />
              <span className="break-words">{address || `${dropoff.lat.toFixed(4)}, ${dropoff.lng.toFixed(4)}`}</span>
            </div>
            <div className="flex items-center justify-between bg-fon-dark rounded-lg p-3">
              <span className="text-xs text-fon-gold-dark">المسافة</span>
              <span className="text-sm font-bold text-fon-gold-light">
                {routeDistance != null
                  ? `${routeDistance.toFixed(2)} كم (طريق)`
                  : directDistance != null
                    ? `${directDistance.toFixed(2)} كم (مباشر)`
                    : '—'}
              </span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-2">
          {phase === 'pick' && (
            <button
              onClick={handleConfirm}
              disabled={!dropoff || saving}
              className={`w-full py-3 flex items-center justify-center gap-2 text-sm font-bold rounded-lg transition ${
                dropoff
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-600 text-gray-300'
              }`}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {dropoff
                ? `احفظ الوجهة${address ? ' - ' + address.substring(0, 30) : ''}`
                : 'اختر الوجهة من الخريطة او اكتبها'}
            </button>
          )}
          {phase === 'route' && dropoff && (
            <button
              onClick={() => openDirectGPS(dropoff.lat, dropoff.lng, 'وجهة الراكب')}
              className="w-full py-3.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 bg-green-500 text-white hover:bg-green-600 transition"
            >
              <Rocket className="w-4 h-4" />
              افتح GPS
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-semibold text-fon-gold-dark border border-fon-gold/20 rounded-lg hover:bg-fon-gold/10 transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

interface DropoffMapProps {
  pickupLat: number | null;
  pickupLng: number | null;
  dropoff: { lat: number; lng: number } | null;
  osrmRoute: number[][] | null;
  loadingRoute: boolean;
  onMapClick: (lat: number, lng: number) => void;
}

function DropoffMap({
  pickupLat,
  pickupLng,
  dropoff,
  osrmRoute,
  loadingRoute,
  onMapClick,
}: DropoffMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{
    map: import('leaflet').Map;
    pickupMarker: import('leaflet').Marker | null;
    dropoffMarker: import('leaflet').Marker | null;
    routeLine: import('leaflet').Polyline | null;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || mapRef.current || !containerRef.current) return;

      const center: [number, number] =
        pickupLat != null && pickupLng != null ? [pickupLat, pickupLng] : [31.9454, 35.9284];

      const map = L.map(containerRef.current, {
        center,
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      const pickupIcon = L.divIcon({
        className: 'fon-pickup-marker',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 0 8px rgba(34,197,94,0.5);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      let pickupMarker: import('leaflet').Marker | null = null;
      if (pickupLat != null && pickupLng != null) {
        pickupMarker = L.marker([pickupLat, pickupLng], { icon: pickupIcon }).addTo(map);
      }

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = { map, pickupMarker, dropoffMarker: null, routeLine: null };
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.map.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    import('leaflet').then((L) => {
      if (!mapRef.current) return;

      if (mapRef.current.dropoffMarker) {
        mapRef.current.dropoffMarker.remove();
        mapRef.current.dropoffMarker = null;
      }

      if (dropoff) {
        const dropoffIcon = L.divIcon({
          className: 'fon-dropoff-marker',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 0 8px rgba(239,68,68,0.5);"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        mapRef.current.dropoffMarker = L.marker([dropoff.lat, dropoff.lng], { icon: dropoffIcon }).addTo(mapRef.current.map);
        mapRef.current.map.setView([dropoff.lat, dropoff.lng], 14, { animate: true });
      }
    });
  }, [dropoff]);

  useEffect(() => {
    if (!mapRef.current) return;

    import('leaflet').then((L) => {
      if (!mapRef.current) return;

      if (mapRef.current.routeLine) {
        mapRef.current.routeLine.remove();
        mapRef.current.routeLine = null;
      }

      if (osrmRoute && osrmRoute.length > 1) {
        const latlngs = osrmRoute.map(([lat, lng]) => [lat, lng] as [number, number]);
        mapRef.current.routeLine = L.polyline(latlngs, { color: '#C9A86A', weight: 4, opacity: 0.8 }).addTo(mapRef.current.map);
        const bounds = L.latLngBounds(latlngs);
        mapRef.current.map.fitBounds(bounds, { padding: [60, 60] });
      }
    });
  }, [osrmRoute]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-64 rounded-xl border border-fon-gold/20" style={{ background: '#0A1931' }} />
      {loadingRoute && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0A1931]/60 rounded-xl">
          <Loader2 className="w-6 h-6 text-fon-gold animate-spin" />
        </div>
      )}
    </div>
  );
}
