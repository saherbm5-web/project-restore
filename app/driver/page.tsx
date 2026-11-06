'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import {
  Car,
  MapPin,
  Navigation,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Plus,
  Power,
  Bell,
  Loader2,
  Clock3,
  Users,
  Fuel,
  Wallet as WalletIcon,
  Tag,
  X,
  ChevronDown,
  LogOut,
  Phone,
} from 'lucide-react';
import { supabase, type Ride, type Driver, type FuelType, type PromoCode } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { chargeWalletForRide } from '@/lib/wallet';
import { calculatePrice, haversineDistance, isNightTime, loadPricingSettings } from '@/lib/pricing';
import { notifyTaxiArrived } from '@/lib/notifications';
import { getCurrentLocation, watchLocation, requestLocationPermission, type LocationWatch } from '@/lib/geo-location';
import LogoutButton from '@/app/components/LogoutButton';
import TopupModal from '@/components/topup-modal';
import NavigationModal from '@/components/navigation-modal';
import DropoffPickerModal from '@/components/dropoff-picker-modal';

const CAR_TYPE_ICONS: Record<string, typeof Car> = {
  electric: Car,
  hybrid: Car,
  petrol: Car,
  premium: Car,
  lady: Car,
  family: Users,
};

const FUEL_TYPE_ICONS: Record<FuelType, typeof Car> = {
  electric: Fuel,
  hybrid: Fuel,
  petrol: Fuel,
};

const FonMap = dynamic(() => import('@/components/fon-map'), { ssr: false, loading: () => null });

function HistoryList() {
  const router = useRouter();
  return (
    <div className="text-center py-8">
      <button
        onClick={() => router.push('/rides/history')}
        className="fon-btn-gold px-8 py-3 text-sm font-bold rounded-xl"
      >
        شوف سجل الرحلات المكتملة
      </button>
    </div>
  );
}

type Tab = 'pending' | 'myrides' | 'history' | 'wallet';

export default function DriverApp() {
  const router = useRouter();
  const { session, loading: authLoading, signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [tab, setTab] = useState<Tab>('pending');
  const [driver, setDriver] = useState<Driver | null>(null);
  const [pendingRides, setPendingRides] = useState<Ride[]>([]);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [promoBonus, setPromoBonus] = useState(0);
  const [promoCodeData, setPromoCodeData] = useState<PromoCode | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [broadcasts, setBroadcasts] = useState<{ id: string; message: string; created_at: string }[]>([]);
  const [showBroadcast, setShowBroadcast] = useState(true);
  const [showTopup, setShowTopup] = useState(false);
  const [activeNavigationRide, setActiveNavigationRide] = useState<Ride | null>(null);
  const [showNavigationModal, setShowNavigationModal] = useState(false);
  const [activeDropoffRide, setActiveDropoffRide] = useState<Ride | null>(null);
  const [showDropoffPicker, setShowDropoffPicker] = useState(false);
  const [showCallButtons, setShowCallButtons] = useState(false);
  const locationWatchRef = useRef<LocationWatch | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tripDistanceRef = useRef<number>(0);
  const tripLastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const activeRideIdRef = useRef<string | null>(null);
  const routePointsRef = useRef<number[][]>([]);
  const [completedRideSummary, setCompletedRideSummary] = useState<{
    ride: Ride;
    distance: number;
    price: number;
    routePoints: number[][];
  } | null>(null);

  // Load driver from auth session, set online, and start GPS tracking on login
  useEffect(() => {
    if (authLoading) return;
    if (!session || session.role !== 'driver' || !session.driverId) {
      router.push('/auth/driver');
      return;
    }
    supabase
      .from('drivers')
      .select('*')
      .eq('id', session.driverId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          const d = data as Driver;
          setDriver(d);
          if (d.is_approved) {
            // Set online + grab GPS location immediately
            await supabase
              .from('drivers')
              .update({ is_online: true })
              .eq('id', d.id);
            setDriver({ ...d, is_online: true });
            startLocationTracking(d.id);
          }
        } else {
          router.push('/auth/driver');
        }
      });
  }, [authLoading, session, router]);

  // Request location permission and start continuous GPS tracking via Capacitor Geolocation
  const startLocationTracking = useCallback(async (driverId: string) => {
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        toast.error('شغل ال GPS واعطي اذن الموقع');
        return;
      }
    } catch {
      toast.error('شغل ال GPS واعطي اذن الموقع');
      return;
    }

    // Clear any existing watch
    if (locationWatchRef.current) {
      locationWatchRef.current.clear();
      locationWatchRef.current = null;
    }
    if (locationIntervalRef.current != null) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }

    locationWatchRef.current = await watchLocation(async (loc) => {
      const { lat, lng } = loc;
      console.log('[FON] Driver GPS update:', lat, lng);
      await supabase
        .from('drivers')
        .update({
          current_lat: lat,
          current_lng: lng,
          lat,
          lng,
          is_online: true,
          location_updated_at: new Date().toISOString(),
        })
        .eq('id', driverId);

      // Accumulate only plausible GPS movement and persist live trip totals.
      if (activeRideIdRef.current && tripLastPosRef.current) {
        const segment = haversineDistance(
          tripLastPosRef.current.lat,
          tripLastPosRef.current.lng,
          lat,
          lng,
        );
        if (segment > 0.005 && segment <= 0.2) {
          tripDistanceRef.current += segment;
          routePointsRef.current.push([lat, lng]);
          const { data: activeRide } = await supabase
            .from('rides')
            .select('id, car_type, distance_km, price')
            .eq('id', activeRideIdRef.current)
            .eq('status', 'in_progress')
            .maybeSingle();
          if (activeRide) {
            const pricing = await loadPricingSettings();
            const carType = (activeRide.car_type ?? 'petrol') as Parameters<typeof calculatePrice>[4];
            const livePrice = calculatePrice(
              tripDistanceRef.current,
              0,
              isNightTime(new Date(), pricing?.night_start_hour, pricing?.night_end_hour),
              undefined,
              carType,
              pricing,
            );
            const liveDistance = Math.round(tripDistanceRef.current * 100) / 100;
            await supabase
              .from('rides')
              .update({ distance_km: liveDistance, price: livePrice, route_points: routePointsRef.current })
              .eq('id', activeRide.id)
              .eq('status', 'in_progress');
            setMyRides((prev) => prev.map((ride) => ride.id === activeRide.id
              ? { ...ride, distance_km: liveDistance, price: livePrice, route_points: routePointsRef.current }
              : ride));
          }
        }
      }
      tripLastPosRef.current = { lat, lng };
    });
  }, []);

  // Set offline when app closes / page hidden
  useEffect(() => {
    if (!driver || !driver.is_approved) return;
    const goOffline = () => {
      const data = JSON.stringify({ is_online: false, lat: null, lng: null, current_lat: null, current_lng: null });
      if (driver.id) {
        try {
          navigator.sendBeacon(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/rest/v1/drivers?id=eq.${driver.id}`,
            new Blob([data], { type: 'application/json' })
          );
        } catch {
          // ignore
        }
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        goOffline();
        if (locationIntervalRef.current != null) {
          clearInterval(locationIntervalRef.current);
          locationIntervalRef.current = null;
        }
      }
    };
    window.addEventListener('beforeunload', goOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', goOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [driver]);

  // Cleanup location watch and interval on unmount
  useEffect(() => {
    return () => {
      if (locationWatchRef.current) {
        locationWatchRef.current.clear();
        locationWatchRef.current = null;
      }
      if (locationIntervalRef.current != null) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, []);

  const playBeepSequence = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      let count = 0;
      const interval = setInterval(() => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.15);
        count++;
        if (count >= 5) {
          clearInterval(interval);
          ctx.close();
        }
      }, 300);
    } catch {
      // AudioContext not available
    }
  }, []);

  // Realtime subscription for pending rides — listen to ALL rides changes (INSERT + UPDATE)
  useEffect(() => {
    if (!driver) return;
    if (!driver.is_approved) return;

    // Fetch initial pending rides
    supabase
      .from('rides')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[FON] Error fetching pending rides:', error);
        if (data) setPendingRides(data);
      });

    // Fetch my rides
    supabase
      .from('rides')
      .select('*')
      .eq('driver_id', driver.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[FON] Error fetching my rides:', error);
        if (data) {
          const rides = data as Ride[];
          setMyRides(rides);
          const activeRide = rides.find((ride) => ride.status === 'in_progress');
          if (activeRide) {
            activeRideIdRef.current = activeRide.id;
            tripDistanceRef.current = activeRide.distance_km ?? 0;
            routePointsRef.current = activeRide.route_points ?? [];
            void getCurrentLocation().then((loc) => {
              tripLastPosRef.current = { lat: loc.lat, lng: loc.lng };
              if (routePointsRef.current.length === 0) routePointsRef.current.push([loc.lat, loc.lng]);
            }).catch(() => {});
          }
        }
      });

    const channel = supabase
      .channel('driver-pending-rides')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        (payload) => {
          console.log('[FON] Realtime rides event:', payload.eventType, payload.new ?? payload.old);
          if (payload.eventType === 'INSERT') {
            const newRide = payload.new as Ride;
            if (newRide.status === 'pending') {
              setPendingRides((prev) => {
                if (prev.find((r) => r.id === newRide.id)) return prev;
                return [newRide, ...prev];
              });
              playBeepSequence();
              toast.info('طلب جديد!');
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Ride;
            if (updated.status !== 'pending') {
              setPendingRides((prev) => prev.filter((r) => r.id !== updated.id));
            }
            setMyRides((prev) => {
              const exists = prev.find((r) => r.id === updated.id);
              if (exists) {
                return prev.map((r) => (r.id === updated.id ? updated : r));
              }
              if (updated.driver_id === driver.id) {
                return [updated, ...prev];
              }
              return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as Ride;
            setPendingRides((prev) => prev.filter((r) => r.id !== deleted.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driver, playBeepSequence]);

  // Load wallet balance and broadcasts for driver
  useEffect(() => {
    if (!driver) return;
    const loadWallet = async () => {
      const { data } = await supabase
        .from('wallets')
        .select('balance')
        .eq('phone', driver.phone)
        .maybeSingle();
      if (data) setWalletBalance(data.balance);
    };
    loadWallet();

    const loadBroadcasts = async () => {
      const { data } = await supabase
        .from('broadcasts')
        .select('id, message, created_at')
        .eq('target', 'captains')
        .order('created_at', { ascending: false })
        .limit(5);
      if (data) {
        const now = Date.now();
        const recent = (data as { id: string; message: string; created_at: string }[]).filter((b) => {
          return now - new Date(b.created_at).getTime() < 24 * 60 * 60 * 1000;
        });
        setBroadcasts(recent);
      }
    };
    loadBroadcasts();
  }, [driver]);

  const checkCaptainPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoChecking(true);
    try {
      const { data } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', promoCode.trim().toUpperCase())
        .maybeSingle();
      if (!data) {
        toast.error('كود غير صحيح');
        setPromoBonus(0);
        setPromoCodeData(null);
        return;
      }
      const promo = data as PromoCode;
      if (!promo.is_active) {
        toast.error('هذا الكود معطل');
        setPromoBonus(0);
        setPromoCodeData(null);
        return;
      }
      if (promo.applicable_to !== 'driver' && promo.applicable_to !== 'all') {
        toast.error('هذا الكود للركاب فقط');
        setPromoBonus(0);
        setPromoCodeData(null);
        return;
      }
      if (promo.expiry && new Date(promo.expiry) < new Date()) {
        toast.error('انتهت صلاحية الكود');
        return;
      }
      if (promo.used_count >= promo.max_uses) {
        toast.error('تم استخدام الكود الحد الأقصى');
        return;
      }
      setPromoCodeData(promo);
      setPromoBonus(promo.discount_value);
      if (promo.discount_type === 'percent') {
        toast.success(`بونص ${promo.discount_value}% مطبق`);
      } else {
        toast.success(`بونص ${promo.discount_value} د.أ مطبق`);
      }
    } catch {
      toast.error('ما زبط التحقق');
    } finally {
      setPromoChecking(false);
    }
  };

  const dismissDriverBroadcast = () => {
    const ids = broadcasts.map((b) => b.id).join(',');
    localStorage.setItem('fon_driver_seen_broadcasts', ids);
    setShowBroadcast(false);
  };

  const toggleOnline = async () => {
    if (!driver) return;
    const newStatus = !driver.is_online;
    const { error } = await supabase
      .from('drivers')
      .update({ is_online: newStatus })
      .eq('id', driver.id);
    if (error) {
      toast.error('ما زبط تحديث الحالة');
      return;
    }
    setDriver({ ...driver, is_online: newStatus });

    if (newStatus) {
      toast.success('صرت متصل - نحدد موقعك');
      startLocationTracking(driver.id);
    } else {
      toast.success('صرت غير متصل');
      if (locationWatchRef.current) {
        locationWatchRef.current.clear();
        locationWatchRef.current = null;
      }
      await supabase
        .from('drivers')
        .update({ is_online: false, lat: null, lng: null, current_lat: null, current_lng: null })
        .eq('id', driver.id);
    }
  };

  const acceptRide = async (ride: Ride) => {
    if (!driver) return;
    setProcessingId(ride.id);
    try {
      const { error } = await supabase
        .from('rides')
        .update({
          status: 'accepted',
          driver_id: driver.id,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', ride.id)
        .eq('status', 'pending');
      if (error) throw error;

      setPendingRides((prev) => prev.filter((r) => r.id !== ride.id));
      setMyRides((prev) => [{ ...ride, status: 'accepted', driver_id: driver.id }, ...prev]);
      setActiveNavigationRide({ ...ride, status: 'accepted', driver_id: driver.id });
      setShowNavigationModal(true);
      toast.success('قبلت الطلب');
    } catch {
      toast.error('ما زبط القبول - يمكن سائق تاني سبقك');
      setPendingRides((prev) => prev.filter((r) => r.id !== ride.id));
    } finally {
      setProcessingId(null);
    }
  };

  const rejectRide = (rideId: string) => {
    setPendingRides((prev) => prev.filter((r) => r.id !== rideId));
    toast.success('رفضت الطلب');
  };

  const arrivedAt = async (rideId: string) => {
    setProcessingId(rideId);
    try {
      const { data: ride, error: rErr } = await supabase
        .from('rides')
        .update({ status: 'arrived' })
        .eq('id', rideId)
        .select()
        .single();
      if (rErr) throw rErr;
      setMyRides((prev) => prev.map((r) => (r.id === rideId ? { ...r, status: 'arrived' } : r)));

      // Play arrival sound to confirm
      try { new Audio('/sounds/arrived.wav').play().catch(() => {}); } catch { /* ignore */ }

      // Insert notification via edge function so customer gets realtime alert
      try {
        await supabase.functions.invoke('driver-arrived', {
          body: {
            passenger_id: ride.customer_phone,
            driver_name: driver?.name || '',
            driver_phone: driver?.phone || '',
            ride_id: ride.id,
          },
        });
      } catch { /* ignore edge function error */ }

      void notifyTaxiArrived();
      setShowCallButtons(true);
      toast.success('وصلت للمكان - بانتظار الراكب');
    } catch {
      toast.error('ما زبط تحديث الحالة');
    } finally {
      setProcessingId(null);
    }
  };

  const startRide = async (rideId: string) => {
    setProcessingId(rideId);
    try {
      const { data: ride, error } = await supabase
        .from('rides')
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq('id', rideId)
        .select()
        .single();
      if (error) throw error;
      setMyRides((prev) => prev.map((r) => (r.id === rideId ? { ...r, status: 'in_progress' } : r)));
      // Start real-time distance tracking for this ride
      activeRideIdRef.current = rideId;
      tripDistanceRef.current = 0;
      tripLastPosRef.current = null;
      routePointsRef.current = [];
      // Capture current position as starting point
      try {
        const loc = await getCurrentLocation();
        tripLastPosRef.current = { lat: loc.lat, lng: loc.lng };
        routePointsRef.current.push([loc.lat, loc.lng]);
      } catch { /* ignore — will pick up first interval reading */ }
      toast.success('الراكب صار بالسيارة - انطلقت الرحلة');
    } catch {
      toast.error('ما زبط تحديث الحالة');
    } finally {
      setProcessingId(null);
    }
  };

  const completeRide = async (rideId: string) => {
    setProcessingId(rideId);
    try {
      const { data: currentRide } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .maybeSingle();

      if (!currentRide) {
        toast.error('ما لقيت الرحلة');
        return;
      }

      const actualDistance = Math.max(
        activeRideIdRef.current === rideId ? tripDistanceRef.current : 0,
        currentRide.distance_km ?? 0,
      );
      const pricing = await loadPricingSettings();
      const carType = (currentRide.car_type ?? driver?.car_type ?? 'petrol') as Parameters<typeof calculatePrice>[4];
      const finalFare = calculatePrice(
        actualDistance,
        0,
        isNightTime(new Date(), pricing?.night_start_hour, pricing?.night_end_hour),
        undefined,
        carType,
        pricing,
      );
      const roundedDistance = Math.round(actualDistance * 100) / 100;
      const finalRoutePoints = routePointsRef.current;

      const { data: ride, error } = await supabase
        .from('rides')
        .update({
          status: 'completed',
          price: finalFare,
          final_price: finalFare,
          distance_km: roundedDistance,
          route_points: finalRoutePoints,
          completed_at: new Date().toISOString(),
        })
        .eq('id', rideId)
        .select()
        .single();
      if (error) throw error;

      if (ride && ride.payment_method === 'wallet' && ride.customer_phone) {
        if (finalFare > 0) {
          await chargeWalletForRide(ride.customer_phone, finalFare, rideId);
        }
      } else if (ride && ride.payment_method === 'cash') {
        await supabase.from('payments').insert({
          ride_id: rideId,
          phone: ride.customer_phone,
          amount: finalFare,
          method: 'cash',
          status: 'paid',
        });
      }

      if (driver) {
        await supabase
          .from('drivers')
          .update({ total_rides: (driver.total_rides ?? 0) + 1 })
          .eq('id', driver.id);
      }

      setCompletedRideSummary({
        ride: ride as Ride,
        distance: roundedDistance,
        price: finalFare,
        routePoints: finalRoutePoints,
      });

      activeRideIdRef.current = null;
      tripDistanceRef.current = 0;
      tripLastPosRef.current = null;
      routePointsRef.current = [];

      setMyRides((prev) => prev.map((r) => (r.id === rideId ? { ...r, status: 'completed', price: finalFare, distance_km: roundedDistance } : r)));
      toast.success(`خلصت الرحلة - الأجرة ${finalFare.toFixed(2)} د.أ`);
    } catch {
      toast.error('ما زبط تخليص الرحلة');
    } finally {
      setProcessingId(null);
    }
  };

  const logout = async () => {
    if (locationWatchRef.current) {
      locationWatchRef.current.clear();
      locationWatchRef.current = null;
    }
    if (locationIntervalRef.current != null) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    if (driver) {
      await supabase
        .from('drivers')
        .update({ is_online: false, lat: null, lng: null, current_lat: null, current_lng: null })
        .eq('id', driver.id)
        .then();
    }
    await signOut();
    router.push('/');
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' });
  };

  const statusBadge = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'بالانتظار',
      accepted: 'مقبول',
      arrived: 'وصلت',
      in_progress: 'بالطريق',
      completed: 'مخلص',
      cancelled: 'ملغي',
    };
    return (
      <span className={`fon-badge fon-badge-${status}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Loading state — driver data is being fetched from DB
  if (!driver) {
    return (
      <div className="min-h-screen fon-gradient-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-fon-gold animate-spin" />
      </div>
    );
  }

  // Pending approval screen — driver registered but not yet approved
  if (driver && !driver.is_approved) {
    return (
      <div className="min-h-screen fon-gradient-dark flex items-center justify-center px-4">
        <LogoutButton />
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-fon-gold/10 flex items-center justify-center mx-auto mb-4 animate-pulse-gold">
              <Clock3 className="w-10 h-10 text-fon-gold" />
            </div>
            <h1 className="text-2xl font-bold fon-text-gradient-gold mb-2">حسابك قيد المراجعة</h1>
            <p className="text-sm text-fon-gold-light mb-1">{driver.name}</p>
            <p className="text-sm text-fon-gold-dark leading-relaxed">
              سيتم تفعيل حسابك خلال 24 ساعة بعد مراجعة الإدارة
            </p>
          </div>
          <div className="fon-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-fon-gold-dark">الاسم</span>
              <span className="text-sm font-semibold text-fon-gold-light">{driver.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-fon-gold-dark">الموبايل</span>
              <span className="text-sm font-semibold text-fon-gold-light" dir="ltr">{driver.phone}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-fon-gold-dark">رقم السيارة</span>
              <span className="text-sm font-semibold text-fon-gold-light" dir="ltr">{driver.car_number}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-fon-gold/20">
              <span className="text-xs text-fon-gold-dark">الحالة</span>
              <span className="fon-badge fon-badge-pending">قيد المراجعة</span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); logout(); }}
            className="w-full mt-4 py-3 text-sm font-semibold text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            تسجيل خروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen fon-gradient-dark pb-20 overflow-x-hidden max-w-full">
      <LogoutButton />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-fon-black/90 backdrop-blur-md border-b border-fon-gold/20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <div>
                <span className="text-lg font-black tracking-widest text-[#C9A86A]">FOCUS ON-TAXI</span>
                <span className="block text-[8px] tracking-[0.4em] text-fon-gold-dark">FON - السائق</span>
              </div>
              <p className="text-[10px] text-fon-gold-dark">{driver.name} - {driver.car_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleOnline}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                driver.is_online
                  ? 'text-green-400 border-green-400/30 bg-green-400/10'
                  : 'text-gray-500 border-gray-500/30'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              {driver.is_online ? 'متصل' : 'غير متصل'}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-fon-gold-light border border-fon-gold/30 rounded-lg hover:bg-fon-gold/10 transition"
              >
                <User className="w-3.5 h-3.5" />
                الكابتن
                <ChevronDown className={`w-3 h-3 transition ${showMenu ? 'rotate-180' : ''}`} />
              </button>
              {showMenu && (
                <div className="absolute top-[110%] right-0 w-36 py-2 rounded-xl border border-fon-gold/20 bg-[#0A1931] shadow-2xl z-50">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); logout(); }}
                    className="w-full text-right px-4 py-2.5 hover:bg-red-400/10 text-red-400 font-bold text-sm flex items-center gap-2 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    خروج
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Broadcast notification */}
      {showBroadcast && broadcasts.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="fon-card px-4 py-3 flex items-center gap-3 animate-slide-up">
            <Bell className="w-5 h-5 text-fon-gold flex-shrink-0" />
            <p className="text-sm text-fon-gold-light flex-1 truncate">{broadcasts[0].message}</p>
            <button onClick={dismissDriverBroadcast} className="flex-shrink-0">
              <X className="w-4 h-4 text-fon-gold-dark hover:text-fon-gold" />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('pending')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
              tab === 'pending'
                ? 'fon-gradient-gold text-fon-black'
                : 'text-fon-gold border border-fon-gold/20'
            }`}
          >
            <Bell className="w-4 h-4" />
            الطلبات
            {pendingRides.length > 0 && (
              <span className="bg-fon-black text-fon-gold px-1.5 py-0.5 rounded-full text-[10px]">
                {pendingRides.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('myrides')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
              tab === 'myrides'
                ? 'fon-gradient-gold text-fon-black'
                : 'text-fon-gold border border-fon-gold/20'
            }`}
          >
            <Car className="w-4 h-4" />
            مشاويري
            {myRides.length > 0 && (
              <span className="bg-fon-dark text-fon-gold px-1.5 py-0.5 rounded-full text-[10px]">
                {myRides.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
              tab === 'history'
                ? 'fon-gradient-gold text-fon-black'
                : 'text-fon-gold border border-fon-gold/20'
            }`}
          >
            <Clock className="w-4 h-4" />
            السجل
          </button>
          <button
            onClick={() => setTab('wallet')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
              tab === 'wallet'
                ? 'fon-gradient-gold text-fon-black'
                : 'text-fon-gold border border-fon-gold/20'
            }`}
          >
            <WalletIcon className="w-4 h-4" />
            محفظتي
          </button>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {/* Pending Rides */}
        {tab === 'pending' && (
          <div className="space-y-4 animate-fade-in">
            {!driver.is_online && (
              <div className="fon-card p-4 text-center">
                <p className="text-sm text-fon-gold-dark">أنت غير متصل - فعل حسابك عشان تستقبل الطلبات</p>
              </div>
            )}
            {driver.is_online && pendingRides.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-full bg-fon-gold/10 flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8 text-fon-gold-dark" />
                </div>
                <p className="text-sm text-fon-gold-dark">ما في طلبات جديدة</p>
                <p className="text-xs text-fon-gold-dark/50 mt-1">بانتظار الطلبات...</p>
              </div>
            )}
            {pendingRides.map((ride) => (
              <div key={ride.id} className="fon-card p-5 animate-slide-up">
                <div className="flex items-center justify-between mb-3">
                  <span className="fon-badge fon-badge-pending">طلب جديد</span>
                  <span className="text-xs text-fon-gold-dark flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatTime(ride.created_at)}
                  </span>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-fon-gold mt-0.5 shrink-0" />
                    <span className="text-xs text-fon-gold-light">{ride.from_address}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Navigation className="w-4 h-4 text-fon-gold mt-0.5 shrink-0" />
                    <span className="text-xs text-fon-gold-light">{ride.to_address}</span>
                  </div>
                </div>

                {/* Route Map — driver to customer */}
                {ride.from_lat != null && ride.from_lng != null && (
                  <div className="h-48 mb-4 rounded-xl overflow-hidden border border-fon-gold/20">
                    <FonMap
                      fromLat={driver.current_lat}
                      fromLng={driver.current_lng}
                      toLat={ride.from_lat}
                      toLng={ride.from_lng}
                      extraPolyline={
                        driver.current_lat != null && driver.current_lng != null
                          ? [[driver.current_lat, driver.current_lng], [ride.from_lat, ride.from_lng]]
                          : null
                      }
                      routePoints={
                        ride.to_lat != null && ride.to_lng != null
                          ? [[ride.from_lat, ride.from_lng], [ride.to_lat, ride.to_lng]]
                          : null
                      }
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-fon-dark rounded-lg p-2 text-center">
                    <div className="text-[10px] text-fon-gold-dark">المسافة</div>
                    <div className="text-sm font-bold text-fon-gold-light">
                      {driver.current_lat != null && driver.current_lng != null && ride.from_lat != null && ride.from_lng != null
                        ? haversineDistance(driver.current_lat, driver.current_lng, ride.from_lat, ride.from_lng).toFixed(2)
                        : ride.distance_km}
                      كم
                    </div>
                  </div>
                  <div className="bg-fon-dark rounded-lg p-2 text-center">
                    <div className="text-[10px] text-fon-gold-dark">السعر</div>
                    <div className="text-sm font-bold text-fon-gold-light">{ride.price?.toFixed(2)}</div>
                  </div>
                  <div className="bg-fon-dark rounded-lg p-2 text-center">
                    <div className="text-[10px] text-fon-gold-dark">الموبايل</div>
                    <div className="text-xs font-bold text-fon-gold-light" dir="ltr">{ride.customer_phone}</div>
                  </div>
                </div>
                {ride.from_lat && ride.from_lng && (
                  <button
                    onClick={() => { setActiveNavigationRide(ride); setShowNavigationModal(true); }}
                    className="flex items-center justify-center gap-1.5 w-full py-2 mb-3 text-xs font-semibold text-fon-gold border border-fon-gold/20 rounded-lg hover:bg-fon-gold/10 transition"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    شوف الخريطة
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptRide(ride)}
                    disabled={processingId === ride.id}
                    className="flex-1 py-3 fon-btn-gold flex items-center justify-center gap-2 text-sm"
                  >
                    {processingId === ride.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    قبل
                  </button>
                  <button
                    onClick={() => rejectRide(ride.id)}
                    disabled={processingId === ride.id}
                    className="flex-1 py-3 text-sm font-semibold text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    ارفض
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* My Rides */}
        {tab === 'myrides' && (
          <div className="space-y-3 animate-fade-in">
            {myRides.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-full bg-fon-gold/10 flex items-center justify-center mb-4">
                  <Car className="w-8 h-8 text-fon-gold-dark" />
                </div>
                <p className="text-sm text-fon-gold-dark">ما في مشاوير لحد الان</p>
              </div>
            )}
            {myRides.map((ride) => (
              <div key={ride.id} className="fon-card p-4">
                <div className="flex items-center justify-between mb-3">
                  {statusBadge(ride.status)}
                  <span className="text-xs text-fon-gold-dark flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatTime(ride.created_at)}
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

                {/* Trip map for in_progress rides */}
                {ride.status === 'in_progress' && ride.from_lat != null && ride.from_lng != null && (
                  <div className="h-40 mb-3 rounded-xl overflow-hidden border border-fon-gold/20">
                    <FonMap
                      fromLat={ride.from_lat}
                      fromLng={ride.from_lng}
                      toLat={ride.to_lat}
                      toLng={ride.to_lng}
                      userLocation={driver.current_lat != null && driver.current_lng != null
                        ? { lat: driver.current_lat, lng: driver.current_lng }
                        : null
                      }
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex gap-3 text-xs">
                    <span className="text-fon-gold-dark">{ride.distance_km} كم</span>
                    <span className="text-fon-gold-light font-bold">{ride.price?.toFixed(2)} د.أ</span>
                    <span className="text-fon-gold-dark" dir="ltr">{ride.customer_phone}</span>
                  </div>
                  <div className="flex gap-2">
                    {ride.status === 'accepted' && (
                      <>
                        <button
                          onClick={() => { setActiveNavigationRide(ride); setShowNavigationModal(true); }}
                          className="px-3 py-1.5 text-xs font-semibold text-fon-gold border border-fon-gold/30 rounded-lg hover:bg-fon-gold/10 transition flex items-center gap-1.5"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          شوف الخريطة
                        </button>
                        <button
                          onClick={() => arrivedAt(ride.id)}
                          disabled={processingId === ride.id}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-400 border border-blue-400/30 rounded-lg hover:bg-blue-400/10 transition flex items-center gap-1.5"
                        >
                          {processingId === ride.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                          وصلت
                        </button>
                      </>
                    )}
                    {ride.status === 'arrived' && (
                      <>
                        {showCallButtons && ride.customer_phone && (
                          <a
                            href={`tel:${ride.customer_phone}`}
                            className="px-3 py-1.5 text-xs font-semibold text-green-400 border border-green-400/30 rounded-lg hover:bg-green-400/10 transition flex items-center gap-1.5"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            اتصل بالراكب
                          </a>
                        )}
                        <button
                          onClick={() => startRide(ride.id)}
                          disabled={processingId === ride.id}
                          className="px-3 py-1.5 text-xs font-semibold text-fon-gold border border-fon-gold/30 rounded-lg hover:bg-fon-gold/10 transition flex items-center gap-1.5"
                        >
                          {processingId === ride.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Car className="w-3.5 h-3.5" />}
                          الراكب صار بالسيارة
                        </button>
                      </>
                    )}
                    {ride.status === 'in_progress' && (
                      <>
                        <button
                          onClick={() => { setActiveDropoffRide(ride); setShowDropoffPicker(true); }}
                          className="px-3 py-1.5 text-xs font-semibold text-fon-gold border border-fon-gold/30 rounded-lg hover:bg-fon-gold/10 transition flex items-center gap-1.5"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          وين بدك؟
                        </button>
                        <button
                          onClick={() => completeRide(ride.id)}
                          disabled={processingId === ride.id}
                          className="px-3 py-1.5 text-xs font-semibold text-green-400 border border-green-400/30 rounded-lg hover:bg-green-400/10 transition flex items-center gap-1.5"
                        >
                          {processingId === ride.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          خلصت الرحلة
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* History */}
        {tab === 'history' && (
          <div className="animate-fade-in">
            <HistoryList />
          </div>
        )}
        {/* Wallet */}
        {tab === 'wallet' && (
          <div className="space-y-4 animate-fade-in">
            <div className="fon-card p-6 text-center">
              <div className="w-14 h-14 rounded-full fon-gradient-gold flex items-center justify-center mx-auto mb-3">
                <WalletIcon className="w-7 h-7 text-fon-black" />
              </div>
              <p className="text-xs text-fon-gold-dark mb-1">رصيد المحفظة</p>
              <p className="text-3xl font-bold fon-text-gradient-gold">{walletBalance.toFixed(2)} د.أ</p>
              <button
                onClick={() => setShowTopup(true)}
                className="mt-4 w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition hover:scale-[1.01]"
                style={{ background: '#e6d5a0', color: '#0f1f3c' }}
              >
                <Plus className="w-5 h-5" />
                اشحن المحفظة
              </button>
            </div>

            {/* Captain promo code */}
            <div className="fon-card p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-fon-gold">
                <Tag className="w-4 h-4" />
                كود البونص
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="اكتب كود البونص"
                  className="fon-input flex-1 px-4 py-2.5 text-sm"
                />
                <button
                  onClick={checkCaptainPromo}
                  disabled={promoChecking || !promoCode.trim()}
                  className="px-4 py-2.5 text-sm font-semibold text-fon-black bg-fon-gold rounded-lg hover:bg-fon-gold-light transition disabled:opacity-50"
                >
                  تطبيق
                </button>
              </div>
              {promoBonus > 0 && promoCodeData && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  {promoCodeData.discount_type === 'percent'
                    ? `بونص ${promoBonus}% مطبق على مشاويرك`
                    : `بونص ${promoBonus} د.أ مطبق على مشاويرك`}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Trip Summary Modal */}
      {completedRideSummary && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#0A1931]/90 backdrop-blur-sm animate-fade-in">
          <div className="fon-card w-full max-w-md p-6 space-y-5 animate-slide-up">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-400/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-lg font-bold text-fon-gold-light">خلصت الرحلة</h2>
            </div>

            {/* Trip route map */}
            {completedRideSummary.routePoints.length > 1 && (
              <div className="h-48 rounded-xl overflow-hidden border border-fon-gold/20">
                <FonMap routePoints={completedRideSummary.routePoints} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-fon-dark rounded-lg p-3 text-center">
                <div className="text-[10px] text-fon-gold-dark">المسافة المقطوعة</div>
                <div className="text-lg font-bold text-fon-gold-light">{completedRideSummary.distance.toFixed(1)} كم</div>
              </div>
              <div className="bg-fon-dark rounded-lg p-3 text-center">
                <div className="text-[10px] text-fon-gold-dark">سعر الرحلة</div>
                <div className="text-lg font-bold text-green-400">{completedRideSummary.price.toFixed(2)} د.أ</div>
              </div>
            </div>

            <button
              onClick={() => setCompletedRideSummary(null)}
              className="fon-btn-gold w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              تمام
            </button>
          </div>
        </div>
      )}

      {showNavigationModal && activeNavigationRide && (
        <NavigationModal
          ride={activeNavigationRide}
          onClose={() => setShowNavigationModal(false)}
          onArrived={arrivedAt}
          initialDriverLat={driver.current_lat}
          initialDriverLng={driver.current_lng}
        />
      )}

      {showDropoffPicker && activeDropoffRide && (
        <DropoffPickerModal
          ride={activeDropoffRide}
          initialLat={driver.current_lat}
          initialLng={driver.current_lng}
          onClose={() => setShowDropoffPicker(false)}
          onSaved={(updated) => {
            setMyRides((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          }}
        />
      )}

      <TopupModal
        open={showTopup}
        onClose={() => setShowTopup(false)}
        phone={driver?.phone || ''}
        role="driver"
        currentBalance={walletBalance}
        onBalanceChange={setWalletBalance}
      />
    </div>
  );
}
