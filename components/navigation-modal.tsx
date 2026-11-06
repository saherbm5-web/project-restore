'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Navigation, MapPin, CheckCircle2, Loader2, Rocket } from 'lucide-react';
import dynamic from 'next/dynamic';
import { haversineDistance } from '@/lib/pricing';
import { openDirectGPS } from '@/lib/gps-nav';
import type { Ride } from '@/lib/supabase';


interface NavigationModalProps {
  ride: Ride;
  onClose: () => void;
  onArrived: (rideId: string) => void;
  initialDriverLat?: number | null;
  initialDriverLng?: number | null;
}

const FonMap = dynamic(() => import('@/components/fon-map'), { ssr: false, loading: () => null });

export default function NavigationModal({
  ride,
  onClose,
  onArrived,
  initialDriverLat,
  initialDriverLng,
}: NavigationModalProps) {
  const isDropoffPhase = ride.status === 'in_progress';
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(
    initialDriverLat != null && initialDriverLng != null
      ? { lat: initialDriverLat, lng: initialDriverLng }
      : null
  );
  const [arriving, setArriving] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const destLat = isDropoffPhase ? ride.to_lat : ride.from_lat;
  const destLng = isDropoffPhase ? ride.to_lng : ride.from_lng;
  const destLabel = isDropoffPhase ? 'وجهة الراكب' : 'موقع الراكب';
  const destAddress = isDropoffPhase ? ride.to_address : ride.from_address;

  const distance =
    driverPos && destLat != null && destLng != null
      ? haversineDistance(driverPos.lat, driverPos.lng, destLat, destLng)
      : null;

  const handleArrived = () => {
    setArriving(true);
    onArrived(ride.id);
    setArriving(false);
    if (!isDropoffPhase && ride.to_lat != null && ride.to_lng != null) {
      openDirectGPS(ride.to_lat, ride.to_lng, 'وجهة الراكب');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#0A1931]/90 backdrop-blur-sm animate-fade-in">
      <div className="fon-card w-full max-w-md p-5 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-fon-gold-light flex items-center gap-2">
            <Navigation className="w-4 h-4 text-fon-gold" />
            {isDropoffPhase ? 'الملاحة للوجهة' : 'الملاحة للراكب'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-fon-gold-dark hover:bg-fon-gold/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Map */}
        {destLat != null && destLng != null && (
          <div className="h-56 rounded-xl overflow-hidden border border-fon-gold/20">
            <FonMap
              userLocation={driverPos}
              fromLat={driverPos?.lat ?? null}
              fromLng={driverPos?.lng ?? null}
              toLat={destLat}
              toLng={destLng}
              extraPolyline={
                driverPos
                  ? [[driverPos.lat, driverPos.lng], [destLat, destLng]] as [[number, number], [number, number]]
                  : null
              }
            />
          </div>
        )}

        {/* Distance info */}
        <div className="fon-card p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-fon-gold" />
            <span className="text-xs text-fon-gold-dark">المسافة</span>
          </div>
          <span className="text-sm font-bold text-fon-gold-light">
            {distance != null ? `${distance.toFixed(2)} كم` : '—'}
          </span>
        </div>

        {/* Destination address */}
        <div className="flex items-start gap-2 text-xs text-fon-gold-light bg-fon-dark rounded-lg p-3">
          <MapPin className="w-3.5 h-3.5 text-fon-gold mt-0.5 shrink-0" />
          <span>{destAddress || destLabel}</span>
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          {destLat != null && destLng != null && (
            <button
              onClick={() => openDirectGPS(destLat, destLng, destLabel)}
              className="w-full py-3.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 bg-green-500 text-white hover:bg-green-600 transition"
            >
              <Rocket className="w-4 h-4" />
              ابدأ الملاحة لـ{destLabel}
            </button>
          )}
          {!isDropoffPhase && (
            <button
              onClick={handleArrived}
              disabled={arriving}
              className="w-full py-3 fon-btn-gold flex items-center justify-center gap-2 text-sm font-bold"
            >
              {arriving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              وصلت للراكب
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
