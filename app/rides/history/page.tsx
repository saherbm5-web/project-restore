'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Car, MapPin, Navigation, Clock, Loader2, ArrowRight, Star } from 'lucide-react';
import { supabase, type Ride } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import LogoutButton from '@/app/components/LogoutButton';

export default function RideHistoryPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});

  const loadRides = useCallback(async () => {
    if (!session) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .in('status', ['completed', 'searching', 'in_progress', 'accepted'])
      .order('created_at', { ascending: false });

    console.log('[FON] Rides history query result — count:', data?.length, 'error:', error);
    if (error) {
      console.error('[FON] History error:', error.message);
      toast.error('History error: ' + error.message);
      setLoading(false);
      return;
    }
    if (data) {
      const rideList = data as Ride[];
      console.log('[FON] Rides loaded:', rideList.length);
      setRides(rideList);

      // Fetch driver names for all rides
      const driverIdSet = new Set<string>();
      rideList.forEach((r) => { if (r.driver_id) driverIdSet.add(r.driver_id); });
      const driverIds = Array.from(driverIdSet);
      if (driverIds.length > 0) {
        const { data: drivers } = await supabase
          .from('drivers')
          .select('id, name')
          .in('id', driverIds);
        if (drivers) {
          const names: Record<string, string> = {};
          for (const d of drivers as { id: string; name: string }[]) {
            names[d.id] = d.name;
          }
          setDriverNames(names);
        }
      }
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push('/');
      return;
    }
    void loadRides();
  }, [authLoading, session, router, loadRides]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-JO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen fon-gradient-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-fon-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen fon-gradient-dark pb-20">
      <LogoutButton />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-fon-black/90 backdrop-blur-md border-b border-fon-gold/20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full border border-fon-gold/20 flex items-center justify-center hover:bg-fon-gold/10 transition"
          >
            <ArrowRight className="w-5 h-5 text-fon-gold" />
          </button>
          <div className="text-center">
            <span className="text-lg font-black tracking-widest text-[#C9A86A]">FOCUS ON-TAXI</span>
            <p className="text-[8px] tracking-[0.4em] text-fon-gold-dark">سجل الرحلات</p>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        <h2 className="text-lg font-bold flex items-center gap-2 text-fon-gold mb-4">
          <Car className="w-5 h-5" />
          سجل الرحلات ({rides.length})
        </h2>

        {rides.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-fon-gold/10 flex items-center justify-center mb-4">
              <Car className="w-8 h-8 text-fon-gold-dark" />
            </div>
            <p className="text-sm text-fon-gold-dark">ما في رحلات مكتملة لحد الان</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rides.map((ride) => (
              <div key={ride.id} className="fon-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="fon-badge fon-badge-completed">مخلص</span>
                  <span className="text-xs text-fon-gold-dark flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(ride.created_at)} • {formatTime(ride.created_at)}
                  </span>
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-fon-gold mt-0.5 shrink-0" />
                    <span className="text-xs text-fon-gold-light">{ride.from_address}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Navigation className="w-3.5 h-3.5 text-fon-gold mt-0.5 shrink-0" />
                    <span className="text-xs text-fon-gold-light">{ride.to_address}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-fon-gold/10">
                  <div className="flex gap-4 text-xs">
                    <span className="text-fon-gold-dark">المسافة: <span className="text-fon-gold-light font-bold">{(ride.distance_km ?? 0).toFixed(1)} كم</span></span>
                    <span className="text-fon-gold-dark">الأجرة: <span className="text-green-400 font-bold">{(ride.price ?? 0).toFixed(2)} د.أ</span></span>
                  </div>
                  {ride.driver_id && driverNames[ride.driver_id] && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-fon-gold-light">{driverNames[ride.driver_id]}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => router.push(`/rating?rideId=${ride.id}`)}
                  className="w-full mt-3 py-2 text-xs font-semibold text-fon-gold border border-fon-gold/20 rounded-lg hover:bg-fon-gold/10 transition flex items-center justify-center gap-1.5"
                >
                  <Star className="w-3.5 h-3.5" />
                  قيّم الرحلة
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
