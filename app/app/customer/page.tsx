'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Geolocation } from '@capacitor/geolocation';
import dynamic from 'next/dynamic';
import {
  Navigation,
  Crosshair,
  LogOut,
  Wallet,
  Tag,
  Bell,
  X,
  Loader2,
  Car,
  Phone,
  CheckCircle2,
  MapPin,
  AlertCircle,
  ArrowRight,
  Banknote,
  Plus,
  Star,
  Clock,
} from 'lucide-react';
import { supabase, type Broadcast, type PromoCode, type Ride, CAR_TYPE_LABELS, type CarType } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { reverseGeocode, searchAddress, type SearchResult } from '@/lib/geo';
import { haversineDistance, calculatePrice, isNightTime, loadPricingSettings, type DBPricingSettings } from '@/lib/pricing';
import { getWalletBalance } from '@/lib/wallet';
import { enableBackgroundMode, disableBackgroundMode, notifyTaxiArrived } from '@/lib/notifications';
import type { NearbyCar } from '@/components/fon-map';
import LogoutButton from '@/app/components/LogoutButton';
import TopupModal from '@/components/topup-modal';

const FonMap = dynamic(() => import('@/components/fon-map'), { ssr: false, loading: () => null });

type Phase = 'idle' | 'requesting' | 'searching' | 'assigned' | 'in_progress' | 'completed';
type PayMethod = 'wallet' | 'cash';

const AMMAN: { lat: number; lng: number } = { lat: 32.5555, lng: 35.9284 };
const SEARCH_RADIUS_KM = 3;

interface DriverWithDetails {
  id: string;
  name: string;
  phone: string | null;
  car_type: CarType | null;
  current_lat: number | null;
  current_lng: number | null;
  car_number: string | null;
  car_year: string | null;
  selfie_url: string | null;
  rating: number;
}

export default function CustomerApp() {
  const router = useRouter();
  const { session, loading: authLoading, signOut } = useAuth();
  const [phone, setPhone] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<DriverWithDetails[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [pricingSettings, setPricingSettings] = useState<DBPricingSettings | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoChecking, setPromoChecking] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [showBroadcast, setShowBroadcast] = useState(true);
  const [locating, setLocating] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [dropoffResults, setDropoffResults] = useState<SearchResult[]>([]);
  const [dropoffAddr, setDropoffAddr] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchingDropoff, setSearchingDropoff] = useState(false);
  const [otpPopup, setOtpPopup] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topupMessage, setTopupMessage] = useState<string | undefined>(undefined);
  const [sendingDriverId, setSendingDriverId] = useState<string | null>(null);
  const [assignedRide, setAssignedRide] = useState<Ride | null>(null);
  const [assignedDriver, setAssignedDriver] = useState<DriverWithDetails | null>(null);
  const [driverLivePos, setDriverLivePos] = useState<{ lat: number; lng: number } | null>(null);
  const [showArrivedModal, setShowArrivedModal] = useState(false);
  const arrivedAudioRef = useRef<HTMLAudioElement | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    loadPricingSettings().then(setPricingSettings);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!session || session.role !== 'customer') {
      router.push('/auth/customer');
      return;
    }
    const p = session.phone;
    setPhone(p);
    loadWallet(p);
    loadBroadcasts();
    detectLocation();
    checkActiveOrder(p);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [router, authLoading, session]);

  const loadWallet = async (p: string) => {
    const bal = await getWalletBalance(p);
    setWalletBalance(bal);
  };

  const loadBroadcasts = async () => {
    const { data } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('target', 'customers')
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) {
      const now = Date.now();
      const recent = (data as Broadcast[]).filter((b) => {
        const created = new Date(b.created_at).getTime();
        return now - created < 24 * 60 * 60 * 1000;
      });
      setBroadcasts(recent);
      const seen = localStorage.getItem('fon_seen_broadcasts') || '';
      const unseen = recent.filter((b) => !seen.includes(b.id));
      setShowBroadcast(unseen.length > 0);
    }
  };

  const checkActiveOrder = async (p: string) => {
    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq('customer_phone', p)
      .in('status', ['pending', 'accepted', 'arrived', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const ride = data as Ride;
      setActiveRide(ride);
      setCurrentRide(ride);
      setAssignedRide(ride);
      setPhase(
        ride.status === 'pending'
          ? 'searching'
          : ride.status === 'in_progress'
            ? 'in_progress'
            : 'assigned',
      );

      if (ride.driver_id) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('id, name, phone, car_type, current_lat, current_lng, car_number, car_year, selfie_url, rating')
          .eq('id', ride.driver_id)
          .maybeSingle();
        if (driverData) {
          setAssignedDriver(driverData as DriverWithDetails);
        }
      }
    }
  };

  const detectLocation = useCallback(async () => {
    setLocating(true);
    try {
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000,
          });
        });
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(loc);
        const addr = await reverseGeocode(loc.lat, loc.lng);
        setPickupAddress(addr);

        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {},
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
      } else {
        throw new Error('No geolocation');
      }
    } catch {
      setUserLocation(AMMAN);
      setPickupAddress('عمّان، الأردن');
      toast.info('ما قدرنا نحدد موقعك — خلّينا على عمّان');
    } finally {
      setLocating(false);
    }
  }, []);

  // Fetch nearby drivers — real drivers only, within 3km, no is_online filter
  useEffect(() => {
    if (!userLocation) return;

    const fetchNearby = async () => {
      const { data } = await supabase
        .from('drivers')
        .select('*')
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (!data) return;

      const drivers: DriverWithDetails[] = data
        .filter((d) => {
          const dLat = (d as Record<string, unknown>).lat as number | null;
          const dLng = (d as Record<string, unknown>).lng as number | null;
          if (dLat == null || dLng == null) return false;
          const dist = haversineDistance(userLocation.lat, userLocation.lng, dLat, dLng);
          return dist <= SEARCH_RADIUS_KM;
        })
        .map((d) => {
          const dLat = (d as Record<string, unknown>).lat as number;
          const dLng = (d as Record<string, unknown>).lng as number;
          return {
            id: d.id,
            name: d.name || 'كابتن',
            phone: (d as Record<string, unknown>).phone as string | null,
            car_type: d.car_type as CarType | null,
            current_lat: dLat,
            current_lng: dLng,
            car_number: d.car_number,
            car_year: d.car_year,
            selfie_url: (d as Record<string, unknown>).selfie_url as string | null,
            rating: (d as Record<string, unknown>).rating as number ?? 5,
          };
        });

      setNearbyDrivers(drivers);
    };

    fetchNearby();
    const channel = supabase
      .channel('customer-nearby-drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchNearby())
      .subscribe();
    const interval = setInterval(fetchNearby, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userLocation]);

  const nearbyCars: NearbyCar[] = useMemo(() => {
    if (!userLocation) return [];
    return nearbyDrivers
      .map((d) => {
        if (d.current_lat == null || d.current_lng == null) return null;
        const dist = haversineDistance(userLocation.lat, userLocation.lng, d.current_lat, d.current_lng);
        return {
          id: d.id,
          lat: d.current_lat,
          lng: d.current_lng,
          car_type: d.car_type,
          name: d.name,
          car_number: d.car_number,
          car_year: d.car_year,
          rating: d.rating,
          distance: dist,
          photo_url: d.selfie_url,
          phone: d.phone,
          selected: d.id === selectedDriverId,
        } as NearbyCar;
      })
      .filter((c): c is NearbyCar => c !== null)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }, [nearbyDrivers, userLocation, selectedDriverId]);

  const tripEstimate = useMemo(() => {
    if (!userLocation || !dropoffLocation) return null;
    const dist = haversineDistance(userLocation.lat, userLocation.lng, dropoffLocation.lat, dropoffLocation.lng);
    const nightStart = pricingSettings?.night_start_hour ?? 22;
    const nightEnd = pricingSettings?.night_end_hour ?? 6;
    const night = isNightTime(new Date(), nightStart, nightEnd);

    const selectedDriver = nearbyDrivers.find((d) => d.id === selectedDriverId);
    const carType = (selectedDriver?.car_type ?? 'petrol') as CarType;
    const price = calculatePrice(dist, 0, night, undefined, carType, pricingSettings);
    const eta = Math.max(5, Math.round(dist * 2.5));

    return { dist, price, eta, night, carType };
  }, [userLocation, dropoffLocation, pricingSettings, nearbyDrivers, selectedDriverId]);

  useEffect(() => {
    if (!currentRide) return;
    const channel = supabase
      .channel(`ride-${currentRide.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${currentRide.id}` },
        async (payload) => {
          const updated = payload.new as Ride;
          setCurrentRide(updated);
          setActiveRide(updated);
          setAssignedRide(updated);

          if (updated.status === 'accepted') {
            setPhase('assigned');
            toast.success('قبل كابتن طلبك! جاي إليك');
          } else if (updated.status === 'arrived') {
            handleArrivedAlert();
          } else if (updated.status === 'in_progress') {
            setPhase('in_progress');
            stopArrivedAlert();
            toast.info('الرحلة بدأت - استمتع برحلتك');
            void disableBackgroundMode();
          } else if (updated.status === 'completed') {
            setPhase('completed');
            stopArrivedAlert();
            toast.success('خلصت الرحلة، يعطيك العافية');
            void disableBackgroundMode();
            const rideId = updated.id;
            setTimeout(() => {
              setPhase('idle');
              setCurrentRide(null);
              setActiveRide(null);
              setAssignedRide(null);
              setAssignedDriver(null);
              loadWallet(phone);
              if (rideId) {
                router.push(`/rating?rideId=${rideId}`);
              }
            }, 2000);
          } else if (updated.status === 'cancelled') {
            setPhase('idle');
            stopArrivedAlert();
            setCurrentRide(null);
            setActiveRide(null);
            setAssignedRide(null);
            setAssignedDriver(null);
            void disableBackgroundMode();
            toast.error('ألغيت الرحلة');
          }

          if (updated.driver_id && !assignedDriver) {
            const { data: driverData } = await supabase
              .from('drivers')
              .select('id, name, phone, car_type, current_lat, current_lng, car_number, car_year, selfie_url, rating')
              .eq('id', updated.driver_id)
              .maybeSingle();
            if (driverData) {
              setAssignedDriver(driverData as DriverWithDetails);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRide, phone, assignedDriver, router]);

  const checkPromo = async () => {
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
        setPromoDiscount(0);
        return;
      }

      const promo = data as PromoCode;
      if (!promo.is_active) {
        toast.error('هذا الكود معطل');
        setPromoDiscount(0);
        return;
      }
      if (promo.applicable_to !== 'rider' && promo.applicable_to !== 'all') {
        toast.error('هذا الكود للسائقين فقط');
        setPromoDiscount(0);
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

      setPromoDiscount(promo.discount_value);
      if (promo.discount_type === 'percent') {
        toast.success(`تم تطبيق خصم ${promo.discount_value}%`);
      } else {
        toast.success(`تم تطبيق خصم ${promo.discount_value} د.أ`);
      }
    } catch {
      toast.error('ما زبط التحقق من الكود');
    } finally {
      setPromoChecking(false);
    }
  };

  const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const requestRide = async (targetDriverId?: string) => {
    if (!userLocation) {
      toast.error('حدد موقعك أولاً');
      return;
    }
    if (!phone) {
      toast.error('ما في رقم مسجل');
      return;
    }

    const driverId = targetDriverId ?? selectedDriverId;
    const selectedDriver = nearbyDrivers.find((d) => d.id === driverId);
    const carType = selectedDriver?.car_type ?? 'petrol';

    if (targetDriverId) setSendingDriverId(targetDriverId);
    setPhase('requesting');
    try {
      const otp = generateOTP();
      const fare = tripEstimate?.price ?? 1.0;
      const dist = tripEstimate?.dist ?? 0;

      const insertPayload = {
        customer_phone: phone,
        from_address: pickupAddress || 'موقع الراكب',
        to_address: dropoffAddr || 'غير محدد',
        from_lat: userLocation.lat,
        from_lng: userLocation.lng,
        to_lat: dropoffLocation?.lat ?? null,
        to_lng: dropoffLocation?.lng ?? null,
        distance_km: dist,
        price: fare,
        status: 'pending' as const,
        payment_method: payMethod,
        car_type: carType as string,
        driver_id: driverId ?? null,
      };

      const { data, error } = await supabase
        .from('rides')
        .insert(insertPayload)
        .select()
        .single();

      if (error || !data) {
        toast.error(error?.message || 'ما زبط إرسال الطلب');
        setPhase('idle');
        return;
      }

      const ride = data as Ride;
      setCurrentRide(ride);
      setActiveRide(ride);
      setAssignedRide(ride);
      setSelectedDriverId(driverId);
      localStorage.setItem('fon_active_ride_id', ride.id);
      setPhase('searching');
      setOtpPopup(otp);
      setSendingDriverId(null);
      void enableBackgroundMode();
      toast.success(`تم إرسال الطلب${selectedDriver ? ' ل' + selectedDriver.name : ''}`);

      if (promoDiscount > 0) {
        const { data: pc } = await supabase
          .from('promo_codes')
          .select('used_count')
          .eq('code', promoCode.trim().toUpperCase())
          .maybeSingle();
        if (pc) {
          await supabase
            .from('promo_codes')
            .update({ used_count: (pc as PromoCode).used_count + 1 })
            .eq('code', promoCode.trim().toUpperCase());
        }
      }
    } catch {
      toast.error('صار خطأ — ما زبط إرسال الطلب');
      setPhase('idle');
      setSendingDriverId(null);
    }
  };

  const cancelOrder = async () => {
    if (!currentRide) return;
    await supabase.from('rides').update({ status: 'cancelled' }).eq('id', currentRide.id);
    localStorage.removeItem('fon_active_ride_id');
    setPhase('idle');
    setCurrentRide(null);
    setActiveRide(null);
    setAssignedRide(null);
    setAssignedDriver(null);
    void disableBackgroundMode();
    toast.info('ألغيت الطلب');
  };

  const stopArrivedAlert = useCallback(() => {
    if (arrivedAudioRef.current) {
      arrivedAudioRef.current.pause();
      arrivedAudioRef.current.currentTime = 0;
      arrivedAudioRef.current = null;
    }
    setShowArrivedModal(false);
  }, []);

  const handleArrivedAlert = useCallback(() => {
    try {
      if (!arrivedAudioRef.current) {
        const audio = new Audio('/sounds/tone.wav');
        audio.loop = true;
        audio.play().catch(() => {});
        arrivedAudioRef.current = audio;
      }
    } catch {
      // Audio not available
    }

    try {
      if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500, 200, 500]);
      }
    } catch {
      // Vibration not supported
    }

    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const n = new Notification('FOCUS ON-TAXI - الكابتن وصل!', {
          body: 'الكابتن وصل لموقعك - اطلع هلا',
          icon: '/icons/icon-192.png',
          requireInteraction: true,
          tag: 'fon-arrived',
        });
        n.onclick = () => {
          window.focus();
          stopArrivedAlert();
          n.close();
        };
      }
    } catch {
      // Notifications not available
    }

    void notifyTaxiArrived();
    setShowArrivedModal(true);
    toast.success('الكابتن وصل لمكانك!');
  }, [stopArrivedAlert]);

  // Realtime tracking of assigned driver's position
  useEffect(() => {
    if (!assignedDriver?.id) {
      setDriverLivePos(null);
      return;
    }
    // Initial fetch of driver position
    const fetchDriverPos = async () => {
      const { data } = await supabase
        .from('drivers')
        .select('current_lat, current_lng')
        .eq('id', assignedDriver.id)
        .maybeSingle();
      if (data && (data as { current_lat: number | null }).current_lat != null) {
        setDriverLivePos({
          lat: (data as { current_lat: number }).current_lat,
          lng: (data as { current_lng: number }).current_lng,
        });
      }
    };
    void fetchDriverPos();

    const channel = supabase
      .channel(`driver-track-${assignedDriver.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${assignedDriver.id}` },
        (payload) => {
          const updated = payload.new as { current_lat: number | null; current_lng: number | null };
          if (updated.current_lat != null && updated.current_lng != null) {
            setDriverLivePos({ lat: updated.current_lat, lng: updated.current_lng });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignedDriver?.id]);

  const driverToCustomerDistance = useMemo(() => {
    if (!driverLivePos || !userLocation) return null;
    return haversineDistance(driverLivePos.lat, driverLivePos.lng, userLocation.lat, userLocation.lng);
  }, [driverLivePos, userLocation]);

  // Listen for driver_arrived notifications via realtime
  useEffect(() => {
    if (!phone) return;
    const channel = supabase
      .channel('customer-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${phone}` },
        (payload) => {
          const n = payload.new as { type: string; body: string; driver_name?: string; driver_phone?: string };
          if (n.type === 'driver_arrived') {
            handleArrivedAlert();
            try { navigator.vibrate?.([500, 200, 500]); } catch { /* ignore */ }
            try {
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification('السايق وصل', { body: n.body, requireInteraction: true });
              }
            } catch { /* ignore */ }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [phone, handleArrivedAlert]);

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  const handleBack = () => {
    router.back();
  };

  const handleDropoffSearch = async (query: string) => {
    setDropoffQuery(query);
    if (query.trim().length < 3) {
      setDropoffResults([]);
      return;
    }
    setSearchingDropoff(true);
    try {
      const results = await searchAddress(query);
      setDropoffResults(results);
    } catch {
      setDropoffResults([]);
    } finally {
      setSearchingDropoff(false);
    }
  };

  const selectDropoff = (result: SearchResult) => {
    setDropoffLocation({ lat: result.lat, lng: result.lng });
    setDropoffAddr(result.display_name);
    setDropoffQuery(result.display_name);
    setDropoffResults([]);
  };

  const clearDropoff = () => {
    setDropoffLocation(null);
    setDropoffAddr('');
    setDropoffQuery('');
    setDropoffResults([]);
  };

  const dismissBroadcast = () => {
    const ids = broadcasts.map((b) => b.id).join(',');
    localStorage.setItem('fon_seen_broadcasts', ids);
    setShowBroadcast(false);
  };

  const carLabel = (type: CarType | null) => {
    if (!type) return 'سيدان';
    return CAR_TYPE_LABELS[type] ?? type;
  };

  const driversWithin3km = useMemo(() => {
    if (!userLocation) return [];
    return nearbyCars.filter((c) => (c.distance ?? 0) <= SEARCH_RADIUS_KM);
  }, [nearbyCars, userLocation]);

  return (
    <div className="fixed inset-0 bg-fon-black overflow-y-auto">
      <LogoutButton />

      {/* Broadcast notification bar */}
      {showBroadcast && broadcasts.length > 0 && (
        <div className="sticky top-0 z-30 pt-3 px-3 pb-1 bg-fon-black">
          <div className="fon-card px-4 py-3 flex items-center gap-3 animate-slide-up">
            <Bell className="w-5 h-5 text-fon-gold flex-shrink-0" />
            <p className="text-sm text-fon-gold-light flex-1 truncate">{broadcasts[0].message}</p>
            <button onClick={dismissBroadcast} className="flex-shrink-0">
              <X className="w-4 h-4 text-fon-gold-dark hover:text-fon-gold" />
            </button>
          </div>
        </div>
      )}

      {/* Top bar — back + logout */}
      <div className="sticky top-0 z-20 flex justify-between p-3">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-fon-black/80 backdrop-blur-sm border border-fon-gold/20 flex items-center justify-center hover:bg-fon-gold/10 transition"
        >
          <ArrowRight className="w-5 h-5 text-fon-gold" />
        </button>
        <button
          onClick={handleLogout}
          className="w-10 h-10 rounded-full bg-fon-black/80 backdrop-blur-sm border border-fon-gold/20 flex items-center justify-center hover:bg-fon-gold/10 transition"
        >
          <LogOut className="w-5 h-5 text-fon-gold" />
        </button>
      </div>

      {/* Map at top with floating driver cards inside */}
      <div className="relative w-full h-[55vh] overflow-hidden">
        <div className="w-full h-full overflow-hidden">
          <FonMap
            userLocation={userLocation}
            nearbyCars={nearbyCars}
            fromLat={userLocation?.lat}
            fromLng={userLocation?.lng}
            toLat={dropoffLocation?.lat}
            toLng={dropoffLocation?.lng}
            className="rounded-none"
          />
        </div>

        {/* Locate button — inside map, top-right */}
        <button
          onClick={detectLocation}
          disabled={locating}
          className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-fon-black/80 backdrop-blur-sm border border-fon-gold/20 flex items-center justify-center hover:bg-fon-gold/10 transition shadow-lg"
        >
          {locating ? <Loader2 className="w-5 h-5 text-fon-gold animate-spin" /> : <Crosshair className="w-5 h-5 text-fon-gold" />}
        </button>

        {/* Floating driver cards — bottom of map */}
        {phase === 'idle' && driversWithin3km.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 z-[500] flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {driversWithin3km.map((car) => {
              const isSelected = car.id === selectedDriverId;
              const ct = (car.car_type as CarType) ?? 'petrol';
              const nightStart = pricingSettings?.night_start_hour ?? 22;
              const nightEnd = pricingSettings?.night_end_hour ?? 6;
              const night = isNightTime(new Date(), nightStart, nightEnd);
              let estPrice: number | null = null;
              if (dropoffLocation && userLocation) {
                const tripDist = haversineDistance(userLocation.lat, userLocation.lng, dropoffLocation.lat, dropoffLocation.lng);
                estPrice = calculatePrice(tripDist, 0, night, undefined, ct, pricingSettings);
              }
              return (
                <div
                  key={car.id}
                  className={`min-w-[110px] h-[82px] rounded-xl p-2 backdrop-blur-md transition text-right flex flex-col justify-between shrink-0 border ${
                    isSelected
                      ? 'border-fon-gold bg-[#0A1931]/95'
                      : 'border-white/10 bg-slate-900/95 hover:border-fon-gold/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-fon-gold/20 flex items-center justify-center">
                      {car.photo_url ? (
                        <img src={car.photo_url} alt={car.name} className="w-full h-full object-cover" />
                      ) : (
                        <Car className="w-3 h-3 text-fon-gold" />
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-white truncate">{car.name}</span>
                  </div>
                  {estPrice != null && tripEstimate && (
                    <div className="text-[8px] text-white/70 leading-tight">
                      {tripEstimate.dist.toFixed(1)} كم • {tripEstimate.eta} د وصول • {estPrice.toFixed(2)} د.أ
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (sendingDriverId) return;
                      requestRide(car.id);
                    }}
                    className={`text-[9px] rounded px-1 py-0.5 text-center font-bold transition flex items-center justify-center gap-1 ${
                      sendingDriverId === car.id
                        ? 'bg-fon-gold/50 text-fon-black'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    {sendingDriverId === car.id ? (
                      <>
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : (
                      'طلب السايق'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Controls below map */}
      <div className="p-4 space-y-4 bg-slate-900">
        {phase === 'idle' && (
          <div className="space-y-4 animate-slide-up">
            {/* Current location address */}
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-fon-gold flex-shrink-0" />
              <span className="text-fon-gold-light truncate">{pickupAddress || 'حدد موقعك'}</span>
            </div>

            {/* Dropoff destination input */}
            <div className="relative">
              <label className="text-xs text-fon-gold-dark mb-1.5 block">لوين بدك تروح؟ (اختياري)</label>
              <div className="relative">
                <Navigation className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fon-gold-dark" />
                <input
                  type="text"
                  value={dropoffQuery}
                  onChange={(e) => handleDropoffSearch(e.target.value)}
                  placeholder="اكتب اسم المكان أو العنوان..."
                  className="fon-input w-full pr-10 pl-10 py-2.5 text-sm"
                  dir="rtl"
                />
                {dropoffQuery && (
                  <button
                    onClick={clearDropoff}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-fon-gold-dark hover:text-fon-gold"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {searchingDropoff && (
                  <Loader2 className="absolute left-9 top-1/2 -translate-y-1/2 w-4 h-4 text-fon-gold animate-spin" />
                )}
              </div>
              {dropoffResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-fon-dark border border-fon-gold/20 rounded-lg shadow-2xl z-30 max-h-48 overflow-y-auto">
                  {dropoffResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => selectDropoff(r)}
                      className="w-full text-right px-3 py-2.5 hover:bg-fon-gold/10 transition border-b border-fon-gold/10 last:border-0 flex items-start gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5 text-fon-gold mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-fon-gold-light line-clamp-2">{r.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Wallet section */}
            <div className="fon-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-fon-gold/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-fon-gold" />
                </div>
                <div>
                  <p className="text-xs text-fon-gold-dark">رصيد المحفظة</p>
                  <p className="text-lg font-bold text-fon-gold-light">{walletBalance.toFixed(2)} د.أ</p>
                </div>
              </div>
              <button
                onClick={() => { setTopupMessage(undefined); setShowTopUp(true); }}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-fon-black bg-fon-gold rounded-lg hover:bg-fon-gold-light transition"
              >
                <Plus className="w-4 h-4" />
                اشحن المحفظة
              </button>
            </div>

            {/* Ride history link */}
            <button
              onClick={() => router.push('/rides/history')}
              className="w-full py-2.5 text-xs font-semibold text-fon-gold border border-fon-gold/20 rounded-lg hover:bg-fon-gold/10 transition flex items-center justify-center gap-2"
            >
              <Clock className="w-3.5 h-3.5" />
              سجل الرحلات
            </button>

            {/* Promo code */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Tag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fon-gold-dark" />
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="كود الخصم (اختياري)"
                  className="fon-input w-full pr-10 pl-3 py-2.5 text-sm"
                />
              </div>
              <button
                onClick={checkPromo}
                disabled={promoChecking || !promoCode.trim()}
                className="px-4 py-2.5 text-sm font-semibold text-fon-black bg-fon-gold rounded-lg hover:bg-fon-gold-light transition disabled:opacity-50"
              >
                تطبيق
              </button>
            </div>

            {promoDiscount > 0 && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                خصم {promoDiscount}% مطبق
              </div>
            )}

            {/* Payment method radio */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const fare = tripEstimate?.price ?? 1.0;
                  if (walletBalance < fare) {
                    setTopupMessage(`رصيدك لا يكفي — تحتاج ${(fare - walletBalance).toFixed(2)} د.أ إضافية. اشحن أولاً`);
                    setShowTopUp(true);
                  } else {
                    setPayMethod('wallet');
                  }
                }}
                className={`py-3 rounded-lg border-2 transition flex items-center justify-center gap-2 text-sm font-semibold ${
                  payMethod === 'wallet'
                    ? 'border-fon-gold bg-fon-gold/10 text-fon-gold-light'
                    : 'border-fon-gold/20 text-fon-gold-dark hover:border-fon-gold/40'
                }`}
              >
                <Wallet className="w-4 h-4" />
                ادفع بالمحفظة
              </button>
              <button
                onClick={() => setPayMethod('cash')}
                className={`py-3 rounded-lg border-2 transition flex items-center justify-center gap-2 text-sm font-semibold ${
                  payMethod === 'cash'
                    ? 'border-fon-gold bg-fon-gold/10 text-fon-gold-light'
                    : 'border-fon-gold/20 text-fon-gold-dark hover:border-fon-gold/40'
                }`}
              >
                <Banknote className="w-4 h-4" />
                كاش عند الوصول
              </button>
            </div>

            {/* Request ride button */}
            <button
              onClick={() => requestRide()}
              disabled={!userLocation}
              className={`w-full py-5 text-xl font-bold flex items-center justify-center gap-3 transition-all duration-300 ${
                userLocation
                  ? 'fon-btn-gold'
                  : 'bg-fon-dark border border-fon-gold/20 text-fon-gold-dark cursor-not-allowed'
              }`}
            >
              <Navigation className="w-6 h-6" />
              {selectedDriverId ? 'اطلب من الكابتن المختار' : 'اطلب تكسي الآن'}
            </button>
            {!userLocation && (
              <p className="text-xs text-fon-gold-dark text-center flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                اضغط زر التحديد لمعرفة موقعك
              </p>
            )}
          </div>
        )}

        {phase === 'requesting' && (
          <div className="text-center py-6">
            <Loader2 className="w-8 h-8 text-fon-gold animate-spin mx-auto mb-3" />
            <p className="text-sm text-fon-gold-light">جاري إرسال الطلب...</p>
          </div>
        )}

        {phase === 'searching' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-fon-gold/10 flex items-center justify-center mx-auto animate-pulse-gold">
              <Car className="w-8 h-8 text-fon-gold" />
            </div>
            <div>
              <p className="text-lg font-bold text-fon-gold-light">بدور على كابتن</p>
              <p className="text-xs text-fon-gold-dark mt-1">انتظر قبول الطلب...</p>
            </div>
            {tripEstimate && (
              <div className="fon-card p-3 flex items-center justify-center gap-4 text-xs">
                <span className="text-fon-gold-dark">المسافة: <span className="text-fon-gold-light font-bold">{tripEstimate.dist} كم</span></span>
                <span className="text-fon-gold-dark">الأجرة: <span className="text-green-400 font-bold">{tripEstimate.price.toFixed(2)} د.أ</span></span>
              </div>
            )}
            <button onClick={cancelOrder} className="w-full py-3 text-sm font-semibold text-red-400 border border-red-400/30 rounded-lg hover:bg-red-500/10 transition">
              إلغاء الطلب
            </button>
          </div>
        )}

        {phase === 'assigned' && currentRide && (
          <div className="space-y-4 animate-slide-up">
            {assignedDriver && (
              <div className="fon-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-fon-gold/20 flex items-center justify-center">
                    {assignedDriver.selfie_url ? (
                      <img src={assignedDriver.selfie_url} alt={assignedDriver.name} className="w-full h-full object-cover" />
                    ) : (
                      <Car className="w-7 h-7 text-fon-gold" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-fon-gold-light truncate">{assignedDriver.name}</p>
                    <div className="flex items-center gap-2 text-xs text-fon-gold-dark">
                      <span dir="ltr">{assignedDriver.car_number}</span>
                      {(assignedDriver.rating ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-400">
                          <Star className="w-3 h-3 fill-amber-400" />
                          {assignedDriver.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  {assignedDriver.phone && (
                    <a
                      href={`tel:${assignedDriver.phone}`}
                      className="w-10 h-10 rounded-full bg-fon-gold/10 border border-fon-gold/30 flex items-center justify-center hover:bg-fon-gold/20 transition flex-shrink-0"
                    >
                      <Phone className="w-4 h-4 text-fon-gold" />
                    </a>
                  )}
                </div>
                {driverToCustomerDistance != null && (
                  <div className="flex items-center gap-2 text-xs bg-fon-dark rounded-lg px-3 py-2">
                    <Navigation className="w-3.5 h-3.5 text-fon-gold shrink-0" />
                    <span className="text-fon-gold-dark">المسافة بينك وبين الكابتن:</span>
                    <span className="text-fon-gold-light font-bold">{driverToCustomerDistance.toFixed(2)} كم</span>
                  </div>
                )}
              </div>
            )}

            {/* Live tracking map — driver heading to customer */}
            {driverLivePos && userLocation && (
              <div className="h-56 rounded-xl overflow-hidden border border-fon-gold/20">
                <FonMap
                  userLocation={userLocation}
                  nearbyCars={[{
                    id: assignedDriver?.id ?? 'driver',
                    lat: driverLivePos.lat,
                    lng: driverLivePos.lng,
                    car_type: assignedDriver?.car_type ?? null,
                    name: assignedDriver?.name ?? '',
                    car_number: assignedDriver?.car_number ?? null,
                    car_year: assignedDriver?.car_year ?? null,
                    rating: assignedDriver?.rating ?? 0,
                    distance: driverToCustomerDistance ?? 0,
                    photo_url: assignedDriver?.selfie_url ?? null,
                    phone: assignedDriver?.phone ?? null,
                    selected: true,
                  }]}
                  extraPolyline={
                    driverLivePos && userLocation
                      ? [[driverLivePos.lat, driverLivePos.lng], [userLocation.lat, userLocation.lng]]
                      : null
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="fon-card p-3 text-center">
                <p className="text-xs text-fon-gold-dark">الحالة</p>
                <p className="text-sm font-semibold text-fon-gold">
                  {currentRide.status === 'accepted' ? 'في الطريق' : currentRide.status === 'arrived' ? 'وصل' : 'جاري'}
                </p>
              </div>
              <div className="fon-card p-3 text-center">
                <p className="text-xs text-fon-gold-dark">الأجرة</p>
                <p className="text-sm font-bold text-green-400">{(assignedRide?.price ?? tripEstimate?.price ?? 0).toFixed(2)} د.أ</p>
              </div>
              <div className="fon-card p-3 text-center">
                <p className="text-xs text-fon-gold-dark">المسافة</p>
                <p className="text-sm font-semibold text-fon-gold-light">{(assignedRide?.distance_km ?? tripEstimate?.dist ?? 0).toFixed(1)} كم</p>
              </div>
            </div>
            <button onClick={cancelOrder} className="w-full py-3 text-sm font-semibold text-red-400 border border-red-400/30 rounded-lg hover:bg-red-500/10 transition">
              إلغاء الرحلة
            </button>
          </div>
        )}

        {phase === 'in_progress' && currentRide && (
          <div className="space-y-3 animate-slide-up">
            <div className="text-center">
              <p className="text-lg font-bold text-fon-gold-light">الرحلة جارية</p>
              <p className="text-xs text-fon-gold-dark">بالطريق لوجهتك</p>
            </div>
            {assignedRide && (
              <div className="fon-card p-3 flex items-center justify-around text-xs">
                <span className="text-fon-gold-dark">الأجرة: <span className="text-green-400 font-bold">{(assignedRide.price ?? 0).toFixed(2)} د.أ</span></span>
                <span className="text-fon-gold-dark">المسافة: <span className="text-fon-gold-light font-bold">{(assignedRide.distance_km ?? 0).toFixed(1)} كم</span></span>
              </div>
            )}
          </div>
        )}

        {phase === 'completed' && (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <p className="text-lg font-bold text-fon-gold-light">خلصت الرحلة</p>
            <p className="text-xs text-fon-gold-dark">شكراً لاستخدامك FON TAXI</p>
          </div>
        )}
      </div>

      {/* OTP Confirmation Popup */}
      {otpPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A1931]/85 backdrop-blur-sm animate-fade-in"
          onClick={() => setOtpPopup(null)}
        >
          <div
            className="fon-card w-full max-w-sm p-8 space-y-5 text-center animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-green-400/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-fon-gold-light mb-1">تم تأكيد حجزك</h2>
              <p className="text-sm text-fon-gold-dark">رمز التأكيد هو:</p>
            </div>
            <div className="bg-fon-dark rounded-2xl py-6 px-4">
              <p className="text-4xl font-bold fon-text-gradient-gold tracking-widest" dir="ltr">
                {otpPopup}
              </p>
            </div>
            <p className="text-xs text-fon-gold-dark">
              احتفظ بهذا الرمز — الكابتن راح يطلبه منك عند الوصول
            </p>
            <button onClick={() => setOtpPopup(null)} className="fon-btn-gold w-full py-3 text-sm font-semibold">
              تمام
            </button>
          </div>
        </div>
      )}

      <TopupModal
        open={showTopUp}
        onClose={() => setShowTopUp(false)}
        phone={phone}
        role="customer"
        currentBalance={walletBalance}
        onBalanceChange={setWalletBalance}
        message={topupMessage}
      />

      {/* Arrived Alert Modal */}
      {showArrivedModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0A1931]/90 backdrop-blur-sm animate-fade-in"
          onClick={stopArrivedAlert}
        >
          <div
            className="fon-card w-full max-w-sm p-8 space-y-5 text-center animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-20 h-20 rounded-full bg-green-400/15 flex items-center justify-center mx-auto animate-pulse">
              <Car className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-fon-gold-light mb-1">الكابتن وصل!</h2>
              <p className="text-sm text-fon-gold-dark">الكابتن وصل لموقعك - اطلع هلا</p>
            </div>
            {assignedDriver && (
              <div className="fon-card p-3 flex items-center justify-center gap-2 text-sm">
                <span className="text-fon-gold-light font-bold">{assignedDriver.name}</span>
                <span className="text-fon-gold-dark" dir="ltr">{assignedDriver.car_number}</span>
              </div>
            )}
            {assignedDriver?.phone && (
              <a
                href={`tel:${assignedDriver.phone}`}
                className="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold rounded-xl bg-fon-gold/10 border border-fon-gold/30 text-fon-gold hover:bg-fon-gold/20 transition"
              >
                <Phone className="w-4 h-4" />
                اتصل بالكابتن
              </a>
            )}
            <button
              onClick={stopArrivedAlert}
              className="fon-btn-gold w-full py-3 text-sm font-semibold"
            >
              تمام، طالع
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



