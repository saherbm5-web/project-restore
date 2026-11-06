'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Users,
  MapPin,
  Navigation,
  Clock,
  Settings as SettingsIcon,
  X,
  Route as RouteIcon,
  User,
  Activity,
  Power,
  Wifi,
  WifiOff,
  Wallet as WalletIcon,
  Tag,
  Plus,
  Trash2,
  Edit2,
  Shuffle,
  List,
  Map as MapIcon,
  MinusCircle,
  ArrowDownCircle,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import type { TripMapData } from '@/components/trips-map';
import type { LiveDriverMarker } from '@/components/live-drivers-map';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, FileImage, Crosshair } from 'lucide-react';

const TripsMap = dynamic(() => import('@/components/trips-map'), { ssr: false, loading: () => null });
const LiveDriversMap = dynamic(() => import('@/components/live-drivers-map'), { ssr: false, loading: () => null });

// --- Types ---

interface DBDriver {
  id: string;
  name: string;
  phone: string;
  car_number: string;
  car_type: string | null;
  car_model: string | null;
  car_color: string | null;
  car_year: string | null;
  national_id: string | null;
  license_number: string | null;
  status: string;
  is_approved: boolean;
  is_online: boolean;
  is_active: boolean | null;
  rating: number;
  total_rides: number;
  vehicle_license_url: string | null;
  driver_with_car_url: string | null;
  selfie_url: string | null;
  created_at: string;
  lat: number | null;
  lng: number | null;
}

interface DBRide {
  id: string;
  customer_phone: string;
  from_address: string;
  to_address: string;
  from_lat: number | null;
  from_lng: number | null;
  to_lat: number | null;
  to_lng: number | null;
  distance_km: number;
  price: number;
  status: string;
  driver_id: string | null;
  created_at: string;
}

interface DBPassenger {
  id: string;
  phone: string;
  name: string | null;
  avatar_url: string | null;
  rating: number;
  total_rides: number;
  is_blocked: boolean;
  created_at: string;
}

interface DBWallet {
  id: string;
  phone: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

interface DBPromo {
  id: string;
  code: string;
  discount_value: number;
  discount_type: string;
  applicable_to: string;
  max_uses: number;
  used_count: number;
  expiry: string | null;
  is_active: boolean;
  created_at: string;
}

type Tab = 'drivers' | 'passengers' | 'trips' | 'live' | 'wallets' | 'discounts' | 'topups';

interface TopupRequest {
  id: string;
  phone: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  proof_url: string | null;
  created_at: string;
  source_account: string | null;
  company_account: string | null;
  user_role: string | null;
}

// --- Helpers ---

const STATUS_LABELS: Record<string, string> = {
  pending: 'بالانتظار',
  in_progress: 'بالطريق',
  completed: 'مخلص',
  cancelled: 'ملغي',
};

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/15 text-green-400 border-green-500/30',
    cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors[status] || ''}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ar-JO', { day: 'numeric', month: 'short' });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' });
}

function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const rideStatusMap: Record<string, TripMapData['status']> = {
  completed: 'completed',
  in_progress: 'in_progress',
  cancelled: 'cancelled',
};

// --- Main Component ---

export default function AdminApp() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('drivers');
  const [tripsView, setTripsView] = useState<'list' | 'map'>('list');
  const [loaded, setLoaded] = useState(false);
  const [mapModalTrips, setMapModalTrips] = useState<{ title: string; trips: TripMapData[] } | null>(null);

  // Wallet state
  const [walletTab, setWalletTab] = useState<'passenger' | 'captain'>('passenger');
  const [walletAction, setWalletAction] = useState<{ entry: DBWallet; type: 'charge' | 'deduct' } | null>(null);
  const [amountInput, setAmountInput] = useState('');

  // Discount form state
  const [discountForm, setDiscountForm] = useState({
    code: '',
    value: '',
    discountType: 'percent' as 'percent' | 'fixed',
    applicableTo: 'all' as 'rider' | 'driver' | 'all',
    expiry: '',
    maxUses: '',
  });

  // Topup requests state
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [topupProcessing, setTopupProcessing] = useState<string | null>(null);

  // Real DB state
  const [dbDrivers, setDbDrivers] = useState<DBDriver[]>([]);
  const [selectedDBDriver, setSelectedDBDriver] = useState<DBDriver | null>(null);
  const [driverActionLoading, setDriverActionLoading] = useState<string | null>(null);
  const [dbRides, setDbRides] = useState<DBRide[]>([]);
  const [dbPassengers, setDbPassengers] = useState<DBPassenger[]>([]);
  const [dbWallets, setDbWallets] = useState<DBWallet[]>([]);
  const [dbPromoCodes, setDbPromoCodes] = useState<DBPromo[]>([]);
  const [discountLoading, setDiscountLoading] = useState(false);

  // Live map state
  const [driverMapModal, setDriverMapModal] = useState<DBDriver | null>(null);
  const [trackingDriverId, setTrackingDriverId] = useState<string | null>(null);
  const [kmPriceDay, setKmPriceDay] = useState(0.35);

  const loadDBDrivers = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('drivers')
        .select('id, name, phone, car_number, car_type, car_model, car_color, car_year, national_id, license_number, status, is_approved, is_online, is_active, rating, total_rides, vehicle_license_url, driver_with_car_url, selfie_url, created_at, lat, lng')
        .order('created_at', { ascending: false });
      if (data) setDbDrivers(data as DBDriver[]);
    } catch { /* ignore */ }
  }, []);

  const loadDBRides = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('rides')
        .select('id, customer_phone, from_address, to_address, from_lat, from_lng, to_lat, to_lng, distance_km, price, status, driver_id, created_at')
        .order('created_at', { ascending: false });
      if (data) setDbRides(data as DBRide[]);
    } catch { /* ignore */ }
  }, []);

  const loadDBPassengers = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, phone, name, avatar_url, rating, total_rides, is_blocked, created_at')
        .eq('role', 'customer')
        .order('created_at', { ascending: false });
      if (data) setDbPassengers(data as DBPassenger[]);
    } catch { /* ignore */ }
  }, []);

  const loadDBWallets = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('wallets')
        .select('id, phone, balance, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (data) setDbWallets(data as DBWallet[]);
    } catch { /* ignore */ }
  }, []);

  const loadDBPromos = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setDbPromoCodes(data as DBPromo[]);
    } catch { /* ignore */ }
  }, []);

  const loadTopupRequests = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('type', 'topup')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (data) setTopupRequests(data as TopupRequest[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoaded(true);
    loadTopupRequests();
    loadDBDrivers();
    loadDBRides();
    loadDBPassengers();
    loadDBWallets();
    loadDBPromos();
    supabase
      .from('settings')
      .select('km_price_day')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.km_price_day) setKmPriceDay(data.km_price_day);
      });
  }, [loadTopupRequests, loadDBDrivers, loadDBRides, loadDBPassengers, loadDBWallets, loadDBPromos]);

  const pendingDrivers = useMemo(() => dbDrivers.filter((d) => d.status === 'pending_approval'), [dbDrivers]);
  const availableDrivers = useMemo(() => dbDrivers.filter((d) => d.status !== 'pending_approval'), [dbDrivers]);

  const liveMapMarkers: LiveDriverMarker[] = useMemo(() => {
    return availableDrivers
      .filter((d) => d.lat != null && d.lng != null)
      .map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        lat: d.lat!,
        lng: d.lng!,
        is_online: d.is_online,
        car_number: d.car_number,
        rating: d.rating,
        per_km_price: kmPriceDay,
      }));
  }, [availableDrivers, kmPriceDay]);

  const driverPhoneSet = useMemo(() => new Set(dbDrivers.map((d) => d.phone)), [dbDrivers]);
  const passengerPhoneSet = useMemo(() => new Set(dbPassengers.map((p) => p.phone)), [dbPassengers]);

  const passengerWallets = useMemo(() => dbWallets.filter((w) => passengerPhoneSet.has(w.phone) && !driverPhoneSet.has(w.phone)), [dbWallets, passengerPhoneSet, driverPhoneSet]);
  const captainWallets = useMemo(() => dbWallets.filter((w) => driverPhoneSet.has(w.phone)), [dbWallets, driverPhoneSet]);

  const filteredWallets = useMemo(() => {
    return walletTab === 'passenger' ? passengerWallets : captainWallets;
  }, [walletTab, passengerWallets, captainWallets]);

  const approveDriver = async (driverId: string) => {
    setDriverActionLoading(driverId);
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: 'available', is_approved: true, is_active: true })
        .eq('id', driverId);
      if (error) throw error;
      toast.success('تمت الموافقة على السائق');
      setSelectedDBDriver(null);
      await loadDBDrivers();
    } catch {
      toast.error('ما زبطت الموافقة');
    } finally {
      setDriverActionLoading(null);
    }
  };

  const rejectDriver = async (driverId: string) => {
    setDriverActionLoading(driverId);
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: 'rejected', is_approved: false })
        .eq('id', driverId);
      if (error) throw error;
      toast.info('تم رفض السائق');
      setSelectedDBDriver(null);
      await loadDBDrivers();
    } catch {
      toast.error('ما زبط الرفض');
    } finally {
      setDriverActionLoading(null);
    }
  };

  // Realtime: listen for new topup requests
  useEffect(() => {
    const channel = supabase
      .channel('admin-topup-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: 'type=eq.topup' },
        (payload) => {
          const txn = payload.new as TopupRequest;
          if (txn.status === 'pending') {
            setTopupRequests((prev) => [txn, ...prev]);
            toast.success(`طلب شحن جديد بقيمة ${txn.amount.toFixed(2)} د.أ من ${txn.phone}`);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Realtime: listen for driver changes — update in-place for live tracking
  useEffect(() => {
    const channel = supabase
      .channel('admin-drivers-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        (payload) => {
          console.log('[FON] Driver changed:', payload.eventType, payload.new);
          const updated = payload.new as DBDriver;
          if (payload.eventType === 'INSERT') {
            setDbDrivers((prev) => [updated, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setDbDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as DBDriver;
            setDbDrivers((prev) => prev.filter((d) => d.id !== deleted.id));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Realtime: listen for wallet changes
  useEffect(() => {
    const channel = supabase
      .channel('admin-wallets-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets' },
        () => { void loadDBWallets(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadDBWallets]);

  const approveTopup = async (txnId: string, phone: string, amount: number) => {
    setTopupProcessing(txnId);
    try {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('phone', phone)
        .maybeSingle();
      const currentBalance = wallet?.balance ?? 0;
      const newBalance = currentBalance + amount;
      const { error: wErr } = await supabase
        .from('wallets')
        .upsert({ phone, balance: newBalance }, { onConflict: 'phone' });
      if (wErr) throw wErr;
      const { error: tErr } = await supabase
        .from('wallet_transactions')
        .update({ status: 'approved' })
        .eq('id', txnId);
      if (tErr) throw tErr;
      setTopupRequests((prev) => prev.filter((t) => t.id !== txnId));
      toast.success('تم شحن المحفظة بنجاح');
    } catch {
      toast.error('ما زبط الموافقة على الشحن');
    } finally {
      setTopupProcessing(null);
    }
  };

  const rejectTopup = async (txnId: string) => {
    setTopupProcessing(txnId);
    try {
      const { error } = await supabase
        .from('wallet_transactions')
        .update({ status: 'rejected' })
        .eq('id', txnId);
      if (error) throw error;
      setTopupRequests((prev) => prev.filter((t) => t.id !== txnId));
      toast.info('تم رفض طلب الشحن');
    } catch {
      toast.error('ما زبط الرفض');
    } finally {
      setTopupProcessing(null);
    }
  };

  const toggleDriverOnlineDB = async (driverId: string, currentOnline: boolean) => {
    try {
      const updates: { is_online: boolean; lat?: number | null; lng?: number | null } = { is_online: !currentOnline };
      if (currentOnline) {
        updates.lat = null;
        updates.lng = null;
      }
      const { error } = await supabase
        .from('drivers')
        .update(updates)
        .eq('id', driverId);
      if (error) throw error;
      toast.success(currentOnline ? 'تم فصل السائق' : 'تم وصل السائق');
    } catch {
      toast.error('ما زبط تحديث الحالة');
    }
  };

  const disconnectAllDB = async () => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_online: false, lat: null, lng: null })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast.success('تم فصل جميع السائقين');
    } catch {
      toast.error('ما زبط فصل الكل');
    }
  };

  const submitWalletAction = async () => {
    if (!walletAction) return;
    const amount = parseFloat(amountInput);
    if (!amount || amount <= 0) return;
    const delta = walletAction.type === 'charge' ? amount : -amount;
    const newBalance = Math.max(0, parseFloat((walletAction.entry.balance + delta).toFixed(2)));
    const { error } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', walletAction.entry.id);
    if (error) { toast.error('ما زبط تحديث الرصيد'); return; }
    setWalletAction(null);
    setAmountInput('');
    await loadDBWallets();
    toast.success('تم تحديث الرصيد');
  };

  // Discount CRUD (DB-based)
  const submitDiscount = async () => {
    if (!discountForm.code.trim()) return;
    const val = parseFloat(discountForm.value);
    if (isNaN(val)) return;
    const uses = parseInt(discountForm.maxUses) || 100;
    const expiry = discountForm.expiry || null;
    setDiscountLoading(true);
    try {
      const { error } = await supabase.from('promo_codes').insert({
        code: discountForm.code.trim().toUpperCase(),
        discount_value: val,
        discount_type: discountForm.discountType,
        applicable_to: discountForm.applicableTo,
        max_uses: uses,
        expiry,
        is_active: true,
      });
      if (error) throw error;
      toast.success('تم إضافة الكود');
      setDiscountForm({ code: '', value: '', discountType: 'percent', applicableTo: 'all', expiry: '', maxUses: '' });
      await loadDBPromos();
    } catch {
      toast.error('ما زبط إضافة الكود');
    } finally {
      setDiscountLoading(false);
    }
  };

  const deleteDiscount = async (id: string) => {
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (error) { toast.error('ما زبط الحذف'); return; }
    toast.info('تم حذف الكود');
    await loadDBPromos();
  };

  const toggleDiscountActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from('promo_codes').update({ is_active: !currentActive }).eq('id', id);
    if (error) { toast.error('ما زبط التحديث'); return; }
    await loadDBPromos();
  };

  // --- Derived data ---

  const dbRideMapData: TripMapData[] = useMemo(() => {
    return dbRides
      .filter((r) => r.from_lat != null && r.from_lng != null)
      .map((r) => ({
        id: r.id,
        fromLat: r.from_lat!,
        fromLng: r.from_lng!,
        toLat: r.to_lat ?? r.from_lat!,
        toLng: r.to_lng ?? r.from_lng!,
        status: rideStatusMap[r.status] ?? 'pending',
        driverName: r.driver_id ? dbDrivers.find((d) => d.id === r.driver_id)?.name ?? '—' : '—',
        fromLabel: r.from_address?.slice(0, 40) ?? '—',
        toLabel: r.to_address?.slice(0, 40) ?? '—',
        price: r.price,
        customerPhone: r.customer_phone,
        distanceKm: r.distance_km,
      }));
  }, [dbRides, dbDrivers]);

  const openSingleDBRideMap = (r: DBRide) => {
    const trip: TripMapData = {
      id: r.id,
      fromLat: r.from_lat ?? 32.5568,
      fromLng: r.from_lng ?? 35.8478,
      toLat: r.to_lat ?? r.from_lat ?? 32.5568,
      toLng: r.to_lng ?? r.from_lng ?? 35.8478,
      status: rideStatusMap[r.status] ?? 'pending',
      driverName: r.driver_id ? dbDrivers.find((d) => d.id === r.driver_id)?.name ?? '—' : '—',
      fromLabel: r.from_address ?? '—',
      toLabel: r.to_address ?? '—',
      price: r.price,
      customerPhone: r.customer_phone,
      distanceKm: r.distance_km,
    };
    setMapModalTrips({ title: `مشوار`, trips: [trip] });
  };

  // --- Render ---

  const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
    { id: 'drivers', label: 'السواق', icon: Users },
    { id: 'passengers', label: 'الركاب', icon: User },
    { id: 'trips', label: 'المشاوير', icon: RouteIcon },
    { id: 'live', label: 'التحكم المباشر', icon: Activity },
    { id: 'wallets', label: 'المحفظة', icon: WalletIcon },
    { id: 'topups', label: 'طلبات الشحن', icon: ArrowDownCircle },
    { id: 'discounts', label: 'أكواد الخصم', icon: Tag },
  ];

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0A1931 0%, #162447 100%)' }}>
        <div className="w-8 h-8 border-2 border-[#C9A86A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cardStyle = { background: 'rgba(22,36,71,0.5)' };
  const goldColor = '#C9A86A';
  const goldDark = '#9E8245';
  const lightGold = '#E8D5A3';

  const renderPromoRow = (d: DBPromo) => {
    const valueDisplay = d.discount_type === 'percent' ? `${d.discount_value}%` : `${d.discount_value} د.أ`;
    const applicableLabel = d.applicable_to === 'rider' ? 'راكب' : d.applicable_to === 'driver' ? 'كابتن' : 'الكل';
    return (
      <tr key={d.id} className="border-b border-[#C9A86A]/10 hover:bg-[#C9A86A]/5 transition" style={{ color: lightGold }}>
        <td className="p-3 font-bold font-mono" dir="ltr" style={{ color: goldColor }}>{d.code}</td>
        <td className="p-3 text-center font-bold">{valueDisplay}</td>
        <td className="p-3 text-center text-xs">{applicableLabel}</td>
        <td className="p-3 text-center text-xs">
          <span style={{ color: goldColor }}>{d.used_count}</span>
          <span style={{ color: goldDark }}> / {d.max_uses}</span>
        </td>
        <td className="p-3 text-center">
          <button
            onClick={() => toggleDiscountActive(d.id, d.is_active)}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition ${
              d.is_active
                ? 'bg-green-500/15 text-green-400 border-green-500/30'
                : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
            }`}
          >
            {d.is_active ? 'فعال' : 'متوقف'}
          </button>
        </td>
        <td className="p-3 text-center">
          <button
            onClick={() => deleteDiscount(d.id)}
            className="p-1.5 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen pb-20 overflow-x-hidden max-w-full" style={{ background: 'linear-gradient(180deg, #0A1931 0%, #162447 100%)' }}>
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-3 bg-[#0f1f3c] relative z-50 border-b border-[#C9A86A]/20">
        <div className="order-1 z-50">
          <button
            type="button"
            onClick={() => { localStorage.clear(); sessionStorage.clear(); void supabase.auth.signOut(); window.location.href = '/auth/admin'; }}
            className="w-10 h-10 rounded-full border border-[#C9A86A]/20 flex items-center justify-center hover:bg-[#C9A86A]/10 transition relative z-50"
            title="خروج"
          >
            <LogOut className="w-5 h-5" style={{ color: goldColor }} />
          </button>
        </div>
        <div className="order-2 flex items-center gap-3 z-50">
          <div className="text-right">
            <span className="text-lg font-black tracking-widest block" style={{ color: goldColor }}>FOCUS ON-TAXI</span>
            <span className="text-[8px] tracking-[0.4em]" style={{ color: goldDark }}>FON - لوحة التحكم</span>
          </div>
          <button
            type="button"
            onClick={() => router.push('/admin/settings')}
            className="w-10 h-10 rounded-full border border-[#C9A86A]/20 flex items-center justify-center hover:bg-[#C9A86A]/10 transition relative z-50"
            title="الإعدادات"
          >
            <SettingsIcon className="w-5 h-5" style={{ color: goldColor }} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg whitespace-nowrap transition relative ${
                tab === t.id ? 'text-[#0A1931]' : 'border border-[#C9A86A]/20 hover:bg-[#C9A86A]/10'
              }`}
              style={tab === t.id ? { background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' } : { color: goldColor }}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.id === 'drivers' && pendingDrivers.length > 0 && (
                <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse" style={{ boxShadow: '0 0 8px rgba(239,68,68,0.6)' }}>
                  {pendingDrivers.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-4">
        {/* Drivers Tab */}
        {tab === 'drivers' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: goldColor }}>
              <Users className="w-5 h-5" /> السائقين ({dbDrivers.length})
            </h2>

            {pendingDrivers.length > 0 && (
              <div className="rounded-2xl p-4 border border-red-500/40 flex items-center gap-3 animate-pulse" style={{ background: 'rgba(239,68,68,0.12)' }}>
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-sm font-bold text-red-300">
                  يوجد {pendingDrivers.length} سواقين جدد بانتظار الموافقة
                </p>
              </div>
            )}

            {pendingDrivers.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold flex items-center gap-2 text-yellow-400">
                  <Clock className="w-4 h-4" /> بانتظار الموافقة
                </h3>
                {pendingDrivers.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-2xl p-4 border border-yellow-500/30 flex items-center justify-between"
                    style={{ background: 'rgba(234,179,8,0.08)' }}
                  >
                    <div
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                      onClick={() => setSelectedDBDriver(d)}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-[#C9A86A]/20 flex items-center justify-center">
                        {d.selfie_url ? (
                          <img src={d.selfie_url} alt={d.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5" style={{ color: goldColor }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate" style={{ color: lightGold }}>{d.name}</div>
                        <div className="text-xs flex items-center gap-2" style={{ color: goldDark }}>
                          <span dir="ltr">{d.phone}</span>
                          <span>•</span>
                          <span dir="ltr">{d.car_number}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => approveDriver(d.id)}
                        disabled={driverActionLoading === d.id}
                        className="px-3 py-2 text-xs font-bold rounded-lg text-green-400 border border-green-400/30 hover:bg-green-400/10 transition disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {driverActionLoading === d.id ? (
                          <span className="w-3.5 h-3.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        موافقة
                      </button>
                      <button
                        onClick={() => rejectDriver(d.id)}
                        disabled={driverActionLoading === d.id}
                        className="px-3 py-2 text-xs font-bold rounded-lg text-red-400 border border-red-400/30 hover:bg-red-400/10 transition disabled:opacity-40 flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        رفض
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {pendingDrivers.length > 0 && (
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: goldColor }}>
                  <Users className="w-4 h-4" /> السائقين المعتمدين ({availableDrivers.length})
                </h3>
              )}
              <div className="overflow-x-auto rounded-2xl border border-[#C9A86A]/15" style={cardStyle}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#C9A86A]/15" style={{ color: goldDark }}>
                      <th className="text-right p-3 font-semibold">الاسم</th>
                      <th className="text-right p-3 font-semibold">الموبايل</th>
                      <th className="text-right p-3 font-semibold">رقم السيارة</th>
                      <th className="text-right p-3 font-semibold">نوع السيارة</th>
                      <th className="text-center p-3 font-semibold">الحالة</th>
                      <th className="text-center p-3 font-semibold">التقييم</th>
                      <th className="text-center p-3 font-semibold">المشاوير</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableDrivers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-sm" style={{ color: goldDark }}>
                          ما في سائقين معتمدين
                        </td>
                      </tr>
                    ) : (
                      availableDrivers.map((d) => (
                        <tr
                          key={d.id}
                          onClick={() => setSelectedDBDriver(d)}
                          className="border-b border-[#C9A86A]/10 cursor-pointer hover:bg-[#C9A86A]/5 transition"
                          style={{ color: lightGold }}
                        >
                          <td className="p-3 font-semibold">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-[#C9A86A]/20 flex items-center justify-center">
                                {d.selfie_url ? (
                                  <img src={d.selfie_url} alt={d.name} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-3.5 h-3.5" style={{ color: goldColor }} />
                                )}
                              </div>
                              {d.name}
                            </div>
                          </td>
                          <td className="p-3 text-xs" dir="ltr">{d.phone}</td>
                          <td className="p-3 text-xs" dir="ltr">{d.car_number}</td>
                          <td className="p-3 text-xs">{d.car_type || '-'}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              d.is_online ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                            }`}>
                              {d.is_online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                              {d.is_online ? 'متصل' : 'غير متصل'}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold">{d.rating.toFixed(1)}</td>
                          <td className="p-3 text-center font-bold">{d.total_rides}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Passengers Tab */}
        {tab === 'passengers' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: goldColor }}>
              <User className="w-5 h-5" /> الركاب ({dbPassengers.length})
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-[#C9A86A]/15" style={cardStyle}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#C9A86A]/15" style={{ color: goldDark }}>
                    <th className="text-right p-3 font-semibold">الاسم</th>
                    <th className="text-right p-3 font-semibold">الموبايل</th>
                    <th className="text-center p-3 font-semibold">عدد المشاوير</th>
                    <th className="text-center p-3 font-semibold">التقييم</th>
                    <th className="text-center p-3 font-semibold">رصيد المحفظة</th>
                    <th className="text-center p-3 font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {dbPassengers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-sm" style={{ color: goldDark }}>
                        ما في ركاب مسجلين
                      </td>
                    </tr>
                  ) : (
                    dbPassengers.map((p) => {
                      const wallet = dbWallets.find((w) => w.phone === p.phone);
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-[#C9A86A]/10 hover:bg-[#C9A86A]/5 transition"
                          style={{ color: lightGold }}
                        >
                          <td className="p-3 font-semibold">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-[#C9A86A]/20 flex items-center justify-center">
                                {p.avatar_url ? (
                                  <img src={p.avatar_url} alt={p.name ?? ''} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-3.5 h-3.5" style={{ color: goldColor }} />
                                )}
                              </div>
                              {p.name || p.phone}
                            </div>
                          </td>
                          <td className="p-3 text-xs" dir="ltr">{p.phone}</td>
                          <td className="p-3 text-center font-bold">{p.total_rides}</td>
                          <td className="p-3 text-center font-bold">{p.rating.toFixed(1)}</td>
                          <td className="p-3 text-center">
                            <span className={`font-bold ${(wallet?.balance ?? 0) > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                              {(wallet?.balance ?? 0).toFixed(2)} د.أ
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              p.is_blocked ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-green-500/15 text-green-400 border-green-500/30'
                            }`}>
                              {p.is_blocked ? 'محظور' : 'فعال'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trips Tab */}
        {tab === 'trips' && (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: goldColor }}>
                <RouteIcon className="w-5 h-5" /> المشاوير ({dbRides.length})
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg overflow-hidden border border-[#C9A86A]/30">
                  <button
                    onClick={() => setTripsView('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition ${
                      tripsView === 'list' ? 'text-[#0A1931]' : 'hover:bg-[#C9A86A]/10'
                    }`}
                    style={tripsView === 'list' ? { background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' } : { color: goldColor }}
                  >
                    <List className="w-3.5 h-3.5" /> قائمة
                  </button>
                  <button
                    onClick={() => setTripsView('map')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition border-r border-[#C9A86A]/30 ${
                      tripsView === 'map' ? 'text-[#0A1931]' : 'hover:bg-[#C9A86A]/10'
                    }`}
                    style={tripsView === 'map' ? { background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' } : { color: goldColor }}
                  >
                    <MapIcon className="w-3.5 h-3.5" /> خريطة
                  </button>
                </div>
              </div>
            </div>

            {tripsView === 'list' && (
              <div className="overflow-x-auto rounded-2xl border border-[#C9A86A]/15" style={cardStyle}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#C9A86A]/15" style={{ color: goldDark }}>
                      <th className="text-right p-3 font-semibold">الراكب</th>
                      <th className="text-right p-3 font-semibold">السائق</th>
                      <th className="text-right p-3 font-semibold">من</th>
                      <th className="text-right p-3 font-semibold">إلى</th>
                      <th className="text-center p-3 font-semibold">السعر</th>
                      <th className="text-center p-3 font-semibold">المسافة</th>
                      <th className="text-center p-3 font-semibold">التاريخ</th>
                      <th className="text-center p-3 font-semibold">الحالة</th>
                      <th className="text-center p-3 font-semibold">خريطة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbRides.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-sm" style={{ color: goldDark }}>
                          ما في مشاوير
                        </td>
                      </tr>
                    ) : (
                      dbRides.map((r) => {
                        const driverName = r.driver_id ? dbDrivers.find((d) => d.id === r.driver_id)?.name ?? '—' : '—';
                        const fromShort = r.from_address ? r.from_address.slice(0, 30) + (r.from_address.length > 30 ? '...' : '') : '—';
                        const toShort = r.to_address ? r.to_address.slice(0, 30) + (r.to_address.length > 30 ? '...' : '') : '—';
                        return (
                          <tr key={r.id} className="border-b border-[#C9A86A]/10 hover:bg-[#C9A86A]/5 transition" style={{ color: lightGold }}>
                            <td className="p-3 text-xs font-semibold" dir="ltr">{r.customer_phone}</td>
                            <td className="p-3 text-xs font-semibold">{driverName}</td>
                            <td className="p-3 text-xs">
                              <div className="flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" style={{ color: goldColor }} />{fromShort}</div>
                            </td>
                            <td className="p-3 text-xs">
                              <div className="flex items-center gap-1"><Navigation className="w-3 h-3 shrink-0" style={{ color: goldColor }} />{toShort}</div>
                            </td>
                            <td className="p-3 text-center font-bold text-green-400">{r.price.toFixed(2)} د.أ</td>
                            <td className="p-3 text-center text-xs" style={{ color: goldDark }}>{r.distance_km.toFixed(1)} كم</td>
                            <td className="p-3 text-center text-xs" style={{ color: goldDark }}>
                              <div>{formatDate(r.created_at)}</div>
                              <div>{formatTime(r.created_at)}</div>
                            </td>
                            <td className="p-3 text-center">{statusBadge(r.status)}</td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => openSingleDBRideMap(r)}
                                className="p-1.5 rounded-lg border border-[#C9A86A]/30 hover:bg-[#C9A86A]/10 transition"
                                style={{ color: goldColor }}
                                title="عرض المسار على الخريطة"
                              >
                                <MapPin className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {tripsView === 'map' && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: goldDark }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' }} />
                    بداية / نهاية (مخلصة)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ background: '#3b82f6' }} />
                    رحلة بالطريق (متحركة)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ background: '#6b7280' }} />
                    ملغية
                  </span>
                </div>
                <div className="h-[500px] rounded-2xl overflow-hidden border border-[#C9A86A]/15">
                  <TripsMap trips={dbRideMapData} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Control Tab */}
        {tab === 'live' && (
          <div className="animate-fade-in space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: goldColor }}>
                <Activity className="w-5 h-5" /> التحكم المباشر
              </h2>
              <button
                onClick={disconnectAllDB}
                className="px-4 py-2 text-xs font-bold rounded-lg text-red-400 border border-red-400/30 hover:bg-red-400/10 transition flex items-center gap-2"
              >
                <Power className="w-4 h-4" />
                قطع الاتصال عن الكل
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl p-4 border border-[#C9A86A]/15" style={cardStyle}>
                <div className="flex items-center gap-2 text-xs mb-2" style={{ color: goldDark }}>
                  <Users className="w-3.5 h-3.5" /> إجمالي السائقين
                </div>
                <div className="text-2xl font-bold" style={{ color: goldColor }}>{availableDrivers.length}</div>
              </div>
              <div className="rounded-2xl p-4 border border-green-500/15" style={cardStyle}>
                <div className="flex items-center gap-2 text-xs mb-2" style={{ color: goldDark }}>
                  <Wifi className="w-3.5 h-3.5" /> متصلين
                </div>
                <div className="text-2xl font-bold text-green-400">{availableDrivers.filter((d) => d.is_online).length}</div>
              </div>
              <div className="rounded-2xl p-4 border border-gray-500/15" style={cardStyle}>
                <div className="flex items-center gap-2 text-xs mb-2" style={{ color: goldDark }}>
                  <WifiOff className="w-3.5 h-3.5" /> غير متصلين
                </div>
                <div className="text-2xl font-bold text-gray-400">{availableDrivers.filter((d) => !d.is_online).length}</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: goldColor }}>
                <MapPin className="w-4 h-4" /> خريطة السائقين ({liveMapMarkers.length} على الخريطة)
              </h3>
              {liveMapMarkers.length > 0 ? (
                <LiveDriversMap
                  drivers={liveMapMarkers}
                  height={400}
                  selectedDriverId={driverMapModal?.id ?? null}
                  trackingDriverId={trackingDriverId}
                  onDriverClick={(id) => {
                    const d = availableDrivers.find((d) => d.id === id);
                    if (d) setDriverMapModal(d);
                  }}
                />
              ) : (
                <div className="rounded-2xl border border-[#C9A86A]/15 p-8 text-center" style={cardStyle}>
                  <p className="text-sm" style={{ color: goldDark }}>ما في سائقين عندهم إحداثيات موقع</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableDrivers.map((d) => (
                <div
                  key={d.id}
                  className="rounded-2xl p-4 border border-[#C9A86A]/15 flex items-center justify-between cursor-pointer hover:border-[#C9A86A]/40 transition"
                  style={cardStyle}
                  onClick={() => setDriverMapModal(d)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center" style={{ background: d.is_online ? 'rgba(34,197,94,0.15)' : 'rgba(156,130,69,0.15)' }}>
                      {d.selfie_url ? (
                        <img src={d.selfie_url} alt={d.name} className="w-full h-full object-cover" />
                      ) : d.is_online ? (
                        <Wifi className="w-5 h-5 text-green-400" />
                      ) : (
                        <WifiOff className="w-5 h-5" style={{ color: goldDark }} />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold" style={{ color: lightGold }}>{d.name}</div>
                      <div className="text-[10px] flex items-center gap-1.5" style={{ color: goldDark }}>
                        <span dir="ltr">{d.phone}</span>
                        <span>•</span>
                        <span dir="ltr">{d.car_number}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center gap-1.5 text-xs font-bold ${d.is_online ? 'text-green-400' : 'text-red-400'}`}>
                      <span className={`w-2 h-2 rounded-full ${d.is_online ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                      {d.is_online ? 'متصل' : 'غير متصل'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleDriverOnlineDB(d.id, d.is_online); }}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition ${
                        d.is_online
                          ? 'text-red-400 border border-red-400/30 hover:bg-red-400/10'
                          : 'text-green-400 border border-green-400/30 hover:bg-green-400/10'
                      }`}
                    >
                      {d.is_online ? 'فصل' : 'وصل'}
                    </button>
                  </div>
                </div>
              ))}
              {availableDrivers.length === 0 && (
                <div className="col-span-full rounded-2xl border border-[#C9A86A]/15 p-8 text-center" style={cardStyle}>
                  <p className="text-sm" style={{ color: goldDark }}>ما في سائقين معتمدين</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wallets Tab */}
        {tab === 'wallets' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: goldColor }}>
              <WalletIcon className="w-5 h-5" /> المحفظة
            </h2>

            <div className="flex gap-2">
              <button
                onClick={() => setWalletTab('passenger')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
                  walletTab === 'passenger' ? 'text-[#0A1931]' : 'border border-[#C9A86A]/20 hover:bg-[#C9A86A]/10'
                }`}
                style={walletTab === 'passenger' ? { background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' } : { color: goldColor }}
              >
                <User className="w-4 h-4" /> ركاب ({passengerWallets.length})
              </button>
              <button
                onClick={() => setWalletTab('captain')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
                  walletTab === 'captain' ? 'text-[#0A1931]' : 'border border-[#C9A86A]/20 hover:bg-[#C9A86A]/10'
                }`}
                style={walletTab === 'captain' ? { background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' } : { color: goldColor }}
              >
                <Users className="w-4 h-4" /> كباتن ({captainWallets.length})
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#C9A86A]/15" style={cardStyle}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#C9A86A]/15" style={{ color: goldDark }}>
                    <th className="text-right p-3 font-semibold">الموبايل</th>
                    <th className="text-center p-3 font-semibold">الرصيد</th>
                    <th className="text-center p-3 font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWallets.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-sm" style={{ color: goldDark }}>
                        ما في محافظ
                      </td>
                    </tr>
                  ) : (
                    filteredWallets.map((w) => (
                      <tr key={w.id} className="border-b border-[#C9A86A]/10 hover:bg-[#C9A86A]/5 transition" style={{ color: lightGold }}>
                        <td className="p-3 text-xs font-semibold" dir="ltr">{w.phone}</td>
                        <td className="p-3 text-center">
                          <span className={`font-bold ${w.balance > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                            {w.balance.toFixed(2)} د.أ
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => { setWalletAction({ entry: w, type: 'charge' }); setAmountInput(''); }}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg text-green-400 border border-green-400/30 hover:bg-green-400/10 transition"
                            >
                              <ArrowDownCircle className="w-3.5 h-3.5" /> شحن
                            </button>
                            <button
                              onClick={() => { setWalletAction({ entry: w, type: 'deduct' }); setAmountInput(''); }}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg text-red-400 border border-red-400/30 hover:bg-red-400/10 transition"
                            >
                              <MinusCircle className="w-3.5 h-3.5" /> خصم
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Topup Requests Tab */}
        {tab === 'topups' && (
          <div className="animate-fade-in space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: goldColor }}>
              <ArrowDownCircle className="w-5 h-5" /> طلبات الشحن ({topupRequests.length})
            </h2>
            {topupRequests.length === 0 ? (
              <div className="rounded-2xl border border-[#C9A86A]/15 p-8 text-center" style={cardStyle}>
                <p className="text-sm" style={{ color: goldDark }}>ما في طلبات شحن بانتظار</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topupRequests.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-[#C9A86A]/15 p-4" style={cardStyle}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-sm font-bold" style={{ color: lightGold }}>
                          <span dir="ltr">{t.phone}</span>
                          {t.user_role && (
                            <span
                              className="mr-2 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                              style={{
                                color: t.user_role === 'driver' ? '#60A5FA' : lightGold,
                                borderColor: t.user_role === 'driver' ? 'rgba(96,165,250,0.3)' : 'rgba(232,213,163,0.3)',
                                background: t.user_role === 'driver' ? 'rgba(96,165,250,0.1)' : 'rgba(232,213,163,0.1)',
                              }}
                            >
                              {t.user_role === 'driver' ? 'كابتن' : 'راكب'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs mt-1" style={{ color: goldDark }}>
                          {new Date(t.created_at).toLocaleDateString('ar-JO')}{' '}
                          {new Date(t.created_at).toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-xs mt-1" style={{ color: goldDark }}>
                          الطريقة: {t.method}
                          {t.reference && <span className="mr-2">• رقم العملية: <span dir="ltr">{t.reference}</span></span>}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-xl font-bold text-green-400">{t.amount.toFixed(2)} د.أ</div>
                      </div>
                    </div>

                    {(t.source_account || t.company_account) && (
                      <div className="mb-3 rounded-lg p-3 space-y-1.5" style={{ background: 'rgba(10,25,49,0.5)' }}>
                        {t.source_account && (
                          <div className="flex items-center justify-between text-xs">
                            <span style={{ color: goldDark }}>حساب المصدر:</span>
                            <span className="font-mono" style={{ color: lightGold }} dir="ltr">{t.source_account}</span>
                          </div>
                        )}
                        {t.company_account && (
                          <div className="flex items-center justify-between text-xs">
                            <span style={{ color: goldDark }}>حساب الشركة:</span>
                            <span className="font-mono" style={{ color: lightGold }} dir="ltr">{t.company_account}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {t.proof_url && (
                      <div className="mb-3">
                        <a
                          href={t.proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#C9A86A]/30 hover:bg-[#C9A86A]/10 transition"
                          style={{ color: goldColor }}
                        >
                          <FileImage className="w-3.5 h-3.5" />
                          عرض إثبات التحويل
                        </a>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveTopup(t.id, t.phone, t.amount)}
                        disabled={topupProcessing === t.id}
                        className="flex-1 py-2.5 text-xs font-bold rounded-lg text-green-400 border border-green-400/30 hover:bg-green-400/10 transition disabled:opacity-40 flex items-center justify-center gap-1.5"
                      >
                        {topupProcessing === t.id ? (
                          <span className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        موافقة وشحن
                      </button>
                      <button
                        onClick={() => rejectTopup(t.id)}
                        disabled={topupProcessing === t.id}
                        className="flex-1 py-2.5 text-xs font-bold rounded-lg text-red-400 border border-red-400/30 hover:bg-red-400/10 transition disabled:opacity-40 flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        رفض
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Discount Codes Tab */}
        {tab === 'discounts' && (
          <div className="animate-fade-in space-y-5">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: goldColor }}>
              <Tag className="w-5 h-5" /> أكواد الخصم ({dbPromoCodes.length})
            </h2>

            {/* Form */}
            <div className="rounded-2xl border border-[#C9A86A]/15 p-5 space-y-4" style={cardStyle}>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: goldColor }}>
                <Plus className="w-4 h-4" /> كود جديد
              </h3>
              <div className="space-y-3">
                {/* Code + generate */}
                <div>
                  <label className="text-xs mb-1 block" style={{ color: goldDark }}>الكود</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={discountForm.code}
                      onChange={(e) => setDiscountForm({ ...discountForm, code: e.target.value.toUpperCase() })}
                      placeholder="مثلاً WELCOME10"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-[#C9A86A]/30 bg-[#0A1931] outline-none focus:border-[#C9A86A]"
                      style={{ color: lightGold }}
                      dir="ltr"
                    />
                    <button
                      onClick={() => setDiscountForm({ ...discountForm, code: generateRandomCode() })}
                      className="px-3 py-2 text-xs font-bold rounded-lg border border-[#C9A86A]/30 hover:bg-[#C9A86A]/10 transition flex items-center gap-1"
                      style={{ color: goldColor }}
                      title="توليد عشوائي"
                    >
                      <Shuffle className="w-3.5 h-3.5" /> توليد
                    </button>
                  </div>
                </div>

                {/* Value + discount type side-by-side */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: goldDark }}>القيمة</label>
                    <input
                      type="number"
                      step="0.01"
                      value={discountForm.value}
                      onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })}
                      placeholder="مثلاً 10"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#C9A86A]/30 bg-[#0A1931] outline-none focus:border-[#C9A86A]"
                      style={{ color: lightGold }}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: goldDark }}>نوع الخصم</label>
                    <select
                      value={discountForm.discountType}
                      onChange={(e) => setDiscountForm({ ...discountForm, discountType: e.target.value as 'percent' | 'fixed' })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#C9A86A]/30 bg-[#0A1931] outline-none"
                      style={{ color: lightGold }}
                    >
                      <option value="percent">٪ نسبة</option>
                      <option value="fixed">د.أ دينار</option>
                    </select>
                  </div>
                </div>

                {/* Applicable to */}
                <div>
                  <label className="text-xs mb-1 block" style={{ color: goldDark }}>الفئة</label>
                  <select
                    value={discountForm.applicableTo}
                    onChange={(e) => setDiscountForm({ ...discountForm, applicableTo: e.target.value as 'rider' | 'driver' | 'all' })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#C9A86A]/30 bg-[#0A1931] outline-none"
                    style={{ color: lightGold }}
                  >
                    <option value="rider">راكب</option>
                    <option value="driver">كابتن</option>
                    <option value="all">الكل (كابتن وراكب)</option>
                  </select>
                </div>

                {/* Max uses + expiry side-by-side */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: goldDark }}>عدد الاستخدامات</label>
                    <input
                      type="number"
                      value={discountForm.maxUses}
                      onChange={(e) => setDiscountForm({ ...discountForm, maxUses: e.target.value })}
                      placeholder="100"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#C9A86A]/30 bg-[#0A1931] outline-none focus:border-[#C9A86A]"
                      style={{ color: lightGold }}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: goldDark }}>تاريخ الانتهاء</label>
                    <input
                      type="date"
                      value={discountForm.expiry}
                      onChange={(e) => setDiscountForm({ ...discountForm, expiry: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#C9A86A]/30 bg-[#0A1931] outline-none focus:border-[#C9A86A]"
                      style={{ color: lightGold }}
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={submitDiscount}
                disabled={!discountForm.code.trim() || !discountForm.value || discountLoading}
                className="w-full py-3 text-sm font-bold rounded-xl transition disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)', color: '#0A1931' }}
              >
                {discountLoading ? (
                  <span className="w-4 h-4 border-2 border-[#0A1931] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                + إضافة الكود
              </button>
            </div>

            {/* All Promo Codes Table */}
            <div>
              <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: goldColor }}>
                <Tag className="w-4 h-4" /> كل الأكواد ({dbPromoCodes.length})
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-[#C9A86A]/15" style={cardStyle}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#C9A86A]/15" style={{ color: goldDark }}>
                      <th className="text-right p-3 font-semibold">الكود</th>
                      <th className="text-center p-3 font-semibold">القيمة</th>
                      <th className="text-center p-3 font-semibold">الفئة</th>
                      <th className="text-center p-3 font-semibold">الاستخدام</th>
                      <th className="text-center p-3 font-semibold">الحالة</th>
                      <th className="text-center p-3 font-semibold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbPromoCodes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-sm" style={{ color: goldDark }}>
                          ما في أكواد بعد
                        </td>
                      </tr>
                    ) : (
                      dbPromoCodes.map((d) => renderPromoRow(d))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Driver Map Modal with Live Tracking */}
      {driverMapModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(10,25,49,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={() => { setDriverMapModal(null); setTrackingDriverId(null); }}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-[#C9A86A]/20 p-6 animate-slide-up"
            style={{ background: 'linear-gradient(180deg, #162447 0%, #0A1931 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' }}>
                  {driverMapModal.selfie_url ? (
                    <img src={driverMapModal.selfie_url} alt={driverMapModal.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-6 h-6" style={{ color: '#0A1931' }} />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: lightGold }}>{driverMapModal.name}</h2>
                  <div className="flex items-center gap-2 text-xs" style={{ color: goldDark }}>
                    <span dir="ltr">{driverMapModal.phone}</span>
                    <span>•</span>
                    <span dir="ltr">{driverMapModal.car_number}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setDriverMapModal(null); setTrackingDriverId(null); }}
                className="hover:opacity-70 transition"
                style={{ color: goldDark }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${
                driverMapModal.is_online ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${driverMapModal.is_online ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                {driverMapModal.is_online ? 'متصل' : 'غير متصل'}
              </span>
              <span className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#C9A86A]/30" style={{ color: goldColor }}>
                التقييم: {driverMapModal.rating.toFixed(1)}
              </span>
              <span className="text-xs font-bold px-3 py-1.5 rounded-full border border-[#C9A86A]/30" style={{ color: goldColor }}>
                سعر الكم: {kmPriceDay.toFixed(2)} د.أ
              </span>
              {driverMapModal.lat != null && driverMapModal.lng != null ? (
                <span className="text-[10px] font-mono px-2 py-1 rounded-full border border-[#C9A86A]/20" style={{ color: goldDark }} dir="ltr">
                  {driverMapModal.lat.toFixed(4)}, {driverMapModal.lng.toFixed(4)}
                </span>
              ) : (
                <span className="text-[10px] px-2 py-1 rounded-full border border-yellow-500/20 text-yellow-400">
                  لا يوجد موقع - سيتم استخدام موقع إربد الافتراضي
                </span>
              )}
            </div>

            <LiveDriversMap
              drivers={liveMapMarkers.filter((m) => m.id === driverMapModal.id || m.is_online)}
              height={350}
              center={
                driverMapModal.lat != null && driverMapModal.lng != null
                  ? { lat: driverMapModal.lat, lng: driverMapModal.lng }
                  : { lat: 32.5568, lng: 35.8478 }
              }
              zoom={driverMapModal.lat != null ? 15 : 13}
              selectedDriverId={driverMapModal.id}
              trackingDriverId={trackingDriverId}
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  if (trackingDriverId === driverMapModal.id) {
                    setTrackingDriverId(null);
                    toast.info('تم إيقاف التتبع المباشر');
                  } else {
                    if (driverMapModal.lat == null) {
                      toast.error('ما في إحداثيات لهذا السائق - ما يقدر يتتبع');
                      return;
                    }
                    setTrackingDriverId(driverMapModal.id);
                    toast.success('تم تفعيل التتبع المباشر - يتم تحديث الموقع تلقائياً');
                  }
                }}
                className={`flex-1 py-3 text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                  trackingDriverId === driverMapModal.id
                    ? 'text-[#0A1931] bg-gradient-to-br from-[#C9A86A] to-[#E8D5A3]'
                    : 'text-[#C9A86A] border border-[#C9A86A]/30 hover:bg-[#C9A86A]/10'
                }`}
              >
                <Crosshair className={`w-5 h-5 ${trackingDriverId === driverMapModal.id ? 'animate-spin' : ''}`} />
                {trackingDriverId === driverMapModal.id ? 'إيقاف التتبع المباشر' : 'تتبع مباشر'}
              </button>
              <button
                onClick={() => { setDriverMapModal(null); setTrackingDriverId(null); }}
                className="px-6 py-3 text-sm font-bold rounded-xl text-red-400 border border-red-400/30 hover:bg-red-400/10 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DB Driver Details Modal */}
      {selectedDBDriver && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(10,25,49,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedDBDriver(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-[#C9A86A]/20 p-6 animate-slide-up"
            style={{ background: 'linear-gradient(180deg, #162447 0%, #0A1931 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' }}>
                  {selectedDBDriver.selfie_url ? (
                    <img src={selectedDBDriver.selfie_url} alt={selectedDBDriver.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-7 h-7" style={{ color: '#0A1931' }} />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: lightGold }}>{selectedDBDriver.name}</h2>
                  <div className="flex items-center gap-2 text-xs" style={{ color: goldDark }}>
                    <span dir="ltr">{selectedDBDriver.phone}</span>
                    <span>•</span>
                    <span dir="ltr">{selectedDBDriver.car_number}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedDBDriver(null)} className="hover:opacity-70 transition" style={{ color: goldDark }}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-5">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${
                selectedDBDriver.status === 'pending_approval'
                  ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                  : selectedDBDriver.status === 'rejected'
                  ? 'bg-red-500/15 text-red-400 border-red-500/30'
                  : 'bg-green-500/15 text-green-400 border-green-500/30'
              }`}>
                {selectedDBDriver.status === 'pending_approval' ? 'بانتظار الموافقة' : selectedDBDriver.status === 'rejected' ? 'مرفوض' : 'معتمد'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="rounded-xl p-3 border border-[#C9A86A]/15" style={{ background: 'rgba(10,25,49,0.5)' }}>
                <div className="text-[10px] mb-1" style={{ color: goldDark }}>الاسم الكامل</div>
                <div className="text-sm font-semibold" style={{ color: lightGold }}>{selectedDBDriver.name}</div>
              </div>
              <div className="rounded-xl p-3 border border-[#C9A86A]/15" style={{ background: 'rgba(10,25,49,0.5)' }}>
                <div className="text-[10px] mb-1" style={{ color: goldDark }}>رقم الهاتف</div>
                <div className="text-sm font-semibold" style={{ color: lightGold }} dir="ltr">{selectedDBDriver.phone}</div>
              </div>
              <div className="rounded-xl p-3 border border-[#C9A86A]/15" style={{ background: 'rgba(10,25,49,0.5)' }}>
                <div className="text-[10px] mb-1" style={{ color: goldDark }}>الرقم الوطني</div>
                <div className="text-sm font-semibold" style={{ color: lightGold }} dir="ltr">{selectedDBDriver.national_id || '-'}</div>
              </div>
              <div className="rounded-xl p-3 border border-[#C9A86A]/15" style={{ background: 'rgba(10,25,49,0.5)' }}>
                <div className="text-[10px] mb-1" style={{ color: goldDark }}>رقم السيارة</div>
                <div className="text-sm font-semibold" style={{ color: lightGold }} dir="ltr">{selectedDBDriver.car_number}</div>
              </div>
              <div className="rounded-xl p-3 border border-[#C9A86A]/15" style={{ background: 'rgba(10,25,49,0.5)' }}>
                <div className="text-[10px] mb-1" style={{ color: goldDark }}>نوع السيارة</div>
                <div className="text-sm font-semibold" style={{ color: lightGold }}>{selectedDBDriver.car_type || '-'}</div>
              </div>
              <div className="rounded-xl p-3 border border-[#C9A86A]/15" style={{ background: 'rgba(10,25,49,0.5)' }}>
                <div className="text-[10px] mb-1" style={{ color: goldDark }}>موديل السيارة</div>
                <div className="text-sm font-semibold" style={{ color: lightGold }}>{selectedDBDriver.car_model || '-'}</div>
              </div>
              <div className="rounded-xl p-3 border border-[#C9A86A]/15" style={{ background: 'rgba(10,25,49,0.5)' }}>
                <div className="text-[10px] mb-1" style={{ color: goldDark }}>لون السيارة</div>
                <div className="text-sm font-semibold" style={{ color: lightGold }}>{selectedDBDriver.car_color || '-'}</div>
              </div>
              <div className="rounded-xl p-3 border border-[#C9A86A]/15" style={{ background: 'rgba(10,25,49,0.5)' }}>
                <div className="text-[10px] mb-1" style={{ color: goldDark }}>سنة الصنع</div>
                <div className="text-sm font-semibold" style={{ color: lightGold }} dir="ltr">{selectedDBDriver.car_year || '-'}</div>
              </div>
              <div className="rounded-xl p-3 border border-[#C9A86A]/15" style={{ background: 'rgba(10,25,49,0.5)' }}>
                <div className="text-[10px] mb-1" style={{ color: goldDark }}>رقم الرخصة</div>
                <div className="text-sm font-semibold" style={{ color: lightGold }} dir="ltr">{selectedDBDriver.license_number || '-'}</div>
              </div>
              <div className="rounded-xl p-3 border border-[#C9A86A]/15" style={{ background: 'rgba(10,25,49,0.5)' }}>
                <div className="text-[10px] mb-1" style={{ color: goldDark }}>التقييم</div>
                <div className="text-sm font-semibold" style={{ color: lightGold }}>{selectedDBDriver.rating.toFixed(1)} / 5</div>
              </div>
            </div>

            <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: goldColor }}>
              <FileImage className="w-4 h-4" /> الصور والمستندات
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'صورة شخصية', url: selectedDBDriver.selfie_url },
                { label: 'رخصة السيارة', url: selectedDBDriver.vehicle_license_url },
                { label: 'السائق مع السيارة', url: selectedDBDriver.driver_with_car_url },
              ].map((img) => (
                <div key={img.label} className="rounded-xl overflow-hidden border border-[#C9A86A]/15" style={{ background: 'rgba(10,25,49,0.5)' }}>
                  <div className="aspect-video flex items-center justify-center" style={{ background: 'rgba(10,25,49,0.6)' }}>
                    {img.url ? (
                      <a href={img.url} target="_blank" rel="noopener noreferrer">
                        <img src={img.url} alt={img.label} className="w-full h-full object-cover hover:opacity-80 transition" />
                      </a>
                    ) : (
                      <FileImage className="w-8 h-8" style={{ color: goldDark }} />
                    )}
                  </div>
                  <div className="text-[10px] text-center py-1.5" style={{ color: goldDark }}>{img.label}</div>
                </div>
              ))}
            </div>

            {selectedDBDriver.status === 'pending_approval' && (
              <div className="flex gap-3">
                <button
                  onClick={() => approveDriver(selectedDBDriver.id)}
                  disabled={driverActionLoading === selectedDBDriver.id}
                  className="flex-1 py-3 text-sm font-bold rounded-xl text-green-400 border border-green-400/30 hover:bg-green-400/10 transition disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {driverActionLoading === selectedDBDriver.id ? (
                    <span className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                  موافقة وتفعيل
                </button>
                <button
                  onClick={() => rejectDriver(selectedDBDriver.id)}
                  disabled={driverActionLoading === selectedDBDriver.id}
                  className="flex-1 py-3 text-sm font-bold rounded-xl text-red-400 border border-red-400/30 hover:bg-red-400/10 transition disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  رفض
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wallet Action Modal */}
      {walletAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(10,25,49,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={() => { setWalletAction(null); setAmountInput(''); }}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-[#C9A86A]/20 p-6 space-y-4 animate-slide-up"
            style={{ background: 'linear-gradient(180deg, #162447 0%, #0A1931 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: lightGold }}>
                {walletAction.type === 'charge' ? 'شحن المحفظة' : 'خصم من المحفظة'}
              </h2>
              <button onClick={() => { setWalletAction(null); setAmountInput(''); }} style={{ color: goldDark }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl p-3 border border-[#C9A86A]/15" style={{ background: 'rgba(10,25,49,0.5)' }}>
              <div className="text-xs" style={{ color: goldDark }} dir="ltr">{walletAction.entry.phone}</div>
              <div className="text-xs mt-1" style={{ color: goldDark }}>
                الرصيد الحالي: <span className="text-green-400 font-bold">{walletAction.entry.balance.toFixed(2)} د.أ</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block" style={{ color: goldColor }}>
                {walletAction.type === 'charge' ? 'مبلغ الشحن' : 'مبلغ الخصم'} (د.أ)
              </label>
              <input
                type="number"
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="مثلاً 10"
                className="w-full px-4 py-3 text-lg rounded-xl border border-[#C9A86A]/30 bg-[#0A1931] outline-none focus:border-[#C9A86A]"
                style={{ color: lightGold }}
                dir="ltr"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              {[5, 10, 20].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmountInput(String(amt))}
                  className="flex-1 py-2.5 text-sm font-bold rounded-lg border-2 border-[#C9A86A]/30 bg-[#0A1931] hover:border-[#C9A86A] hover:bg-[#C9A86A]/10 transition"
                  style={{ color: lightGold }}
                >
                  {amt} د.أ
                </button>
              ))}
            </div>
            <button
              onClick={submitWalletAction}
              disabled={!amountInput || parseFloat(amountInput) <= 0}
              className="w-full py-3 text-base font-bold rounded-xl transition disabled:opacity-40"
              style={{
                background: walletAction.type === 'charge'
                  ? 'linear-gradient(135deg, #22c55e, #4ade80)'
                  : 'linear-gradient(135deg, #ef4444, #f87171)',
                color: '#fff',
              }}
            >
              {walletAction.type === 'charge' ? 'تأكيد الشحن' : 'تأكيد الخصم'}
            </button>
          </div>
        </div>
      )}

      {/* Map Modal */}
      {mapModalTrips && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(10,25,49,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMapModalTrips(null)}
        >
          <div
            className="w-full max-w-3xl rounded-3xl border border-[#C9A86A]/20 p-5 animate-slide-up"
            style={{ background: 'linear-gradient(180deg, #162447 0%, #0A1931 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: lightGold }}>
                <MapPin className="w-5 h-5" style={{ color: goldColor }} />
                {mapModalTrips.title}
                <span className="text-xs font-normal" style={{ color: goldDark }}>
                  ({mapModalTrips.trips.length} مشوار)
                </span>
              </h2>
              <button
                onClick={() => setMapModalTrips(null)}
                className="hover:opacity-70 transition"
                style={{ color: goldDark }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="h-[450px] rounded-2xl overflow-hidden border border-[#C9A86A]/15">
              <TripsMap trips={mapModalTrips.trips} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
