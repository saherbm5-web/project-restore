'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  User,
  Phone,
  Star,
  Car,
  Wallet as WalletIcon,
  Edit3,
  LogOut,
  History,
  Camera,
  Check,
  X,
  Bell,
} from 'lucide-react';
import { supabase, type Profile, type Wallet, type Ride, type Broadcast } from '@/lib/supabase';

export default function AccountPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [showRides, setShowRides] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [showBroadcast, setShowBroadcast] = useState(true);

  useEffect(() => {
    const savedPhone = localStorage.getItem('fon_taxi_phone');
    if (savedPhone) {
      setPhone(savedPhone);
      loadProfile(savedPhone);
    }
  }, []);

  const loadProfile = useCallback(async (phoneNum: string) => {
    setLoading(true);
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', phoneNum)
      .maybeSingle();
    if (prof) {
      setProfile(prof as Profile);
      setEditName((prof as Profile).name ?? '');
      setEditPhone((prof as Profile).phone);
    }
    const { data: wal } = await supabase
      .from('wallets')
      .select('*')
      .eq('phone', phoneNum)
      .maybeSingle();
    setWallet(wal as Wallet | null);
    const { data: rds } = await supabase
      .from('rides')
      .select('*')
      .eq('customer_phone', phoneNum)
      .order('created_at', { ascending: false })
      .limit(20);
    setRides((rds ?? []) as Ride[]);
    setLoading(false);
  }, []);

  const handleLookup = async () => {
    if (phone.length < 8) {
      toast.error('اكتب رقم موبايل صحيح');
      return;
    }
    setLoading(true);
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (!existing) {
      const { data: newProf, error } = await supabase
        .from('profiles')
        .insert({ phone, name: '', rating: 5.0, total_rides: 0 })
        .select()
        .single();
      if (!error && newProf) {
        setProfile(newProf as Profile);
        setEditName('');
        setEditPhone(phone);
        localStorage.setItem('fon_taxi_phone', phone);
      }
    } else {
      localStorage.setItem('fon_taxi_phone', phone);
      await loadProfile(phone);
    }
    setLoading(false);
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: editName,
        phone: editPhone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);
    if (error) {
      toast.error('ما زبط حفظ البيانات');
      setSaving(false);
      return;
    }
    setProfile({ ...profile, name: editName, phone: editPhone });
    setEditing(false);
    setSaving(false);
    toast.success('تم حفظ بياناتك');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    const ext = file.name.split('.').pop();
    const fileName = `avatar-${profile.phone}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('topup-proofs')
      .upload(fileName, file);
    if (uploadError) {
      toast.error('ما زبط رفع الصورة');
      return;
    }
    const { data: urlData } = supabase.storage
      .from('topup-proofs')
      .getPublicUrl(fileName);
    const avatarUrl = urlData.publicUrl;
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    if (!error) {
      setProfile({ ...profile, avatar_url: avatarUrl });
      toast.success('تم تحديث الصورة');
    }
  };

  useEffect(() => {
    const loadBroadcasts = async () => {
      const { data } = await supabase
        .from('broadcasts')
        .select('*')
        .eq('target', 'customers')
        .order('created_at', { ascending: false })
        .limit(3);
      if (data) {
        const now = Date.now();
        const recent = (data as Broadcast[]).filter((b) => now - new Date(b.created_at).getTime() < 24 * 60 * 60 * 1000);
        setBroadcasts(recent);
      }
    };
    loadBroadcasts();
  }, []);

  const handleLogout = async () => {
     localStorage.clear();
    sessionStorage.clear();
    toast.success('تم تسجيل الخروج');
    window.location.href = "/";
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return { text: 'بانتظار', color: 'text-yellow-400' };
      case 'accepted': return { text: 'مقبولة', color: 'text-blue-400' };
      case 'completed': return { text: 'مكتملة', color: 'text-green-400' };
      case 'cancelled': return { text: 'ملغاة', color: 'text-red-400' };
      default: return { text: status, color: 'text-fon-gold-dark' };
    }
  };

  return (
    <div className="min-h-screen fon-gradient-dark overflow-x-hidden max-w-full">
      {showBroadcast && broadcasts.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="fon-card px-4 py-3 flex items-center gap-3 animate-slide-up">
            <Bell className="w-5 h-5 text-fon-gold flex-shrink-0" />
            <p className="text-sm text-fon-gold-light flex-1 truncate">{broadcasts[0].message}</p>
            <button onClick={() => setShowBroadcast(false)} className="flex-shrink-0">
              <X className="w-4 h-4 text-fon-gold-dark hover:text-fon-gold" />
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-fon-black/90 backdrop-blur-md border-b border-fon-gold/20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-fon-gold-dark hover:text-fon-gold transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">رجوع</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 fon-gradient-gold rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-fon-black" />
            </div>
            <h1 className="text-lg font-bold fon-text-gradient-gold">حسابي</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {!profile ? (
          <div className="space-y-5 animate-fade-in">
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full fon-gradient-gold flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-fon-black" />
              </div>
              <h2 className="text-xl font-bold text-fon-gold-light mb-1">حسابي</h2>
              <p className="text-sm text-fon-gold-dark">ادخل رقم موبايلك للدخول لحسابك</p>
            </div>
            <div className="fon-card p-5 space-y-3">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXX"
                className="fon-input w-full px-4 py-3 text-sm"
                dir="ltr"
              />
              <button
                onClick={handleLookup}
                disabled={loading}
                className="fon-btn-gold w-full py-3 text-base font-bold"
              >
                {loading ? 'بدور...' : 'دخول'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 animate-fade-in">
            {/* Profile Header */}
            <div className="fon-card p-6 text-center">
              <div className="relative inline-block mb-4">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="صورة شخصية"
                    className="w-24 h-24 rounded-full object-cover border-2 border-fon-gold mx-auto"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full fon-gradient-gold flex items-center justify-center mx-auto">
                    <User className="w-12 h-12 text-fon-black" />
                  </div>
                )}
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-fon-gold rounded-full flex items-center justify-center cursor-pointer border-2 border-fon-black hover:bg-fon-gold-light transition">
                  <Camera className="w-4 h-4 text-fon-black" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {editing ? (
                <div className="space-y-3 text-right">
                  <div>
                    <label className="text-xs text-fon-gold-dark mb-1 block">الاسم</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="اسمك الكامل"
                      className="fon-input w-full px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-fon-gold-dark mb-1 block">رقم الموبايل</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="07XXXXXXXX"
                      className="fon-input w-full px-4 py-2.5 text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="flex-1 py-2.5 text-sm font-semibold text-fon-black bg-fon-gold rounded-lg hover:bg-fon-gold-light transition flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      حفظ
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="flex-1 py-2.5 text-sm font-semibold text-fon-gold-dark border border-fon-gold/30 rounded-lg hover:bg-fon-gold/10 transition flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-fon-gold-light mb-1">
                    {profile.name || 'بدون اسم'}
                  </h2>
                  <p className="text-sm text-fon-gold-dark mb-4" dir="ltr">
                    {profile.phone}
                  </p>
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-fon-gold/20">
                    <div>
                      <div className="flex items-center justify-center gap-1 text-fon-gold mb-1">
                        <Star className="w-3.5 h-3.5 fill-fon-gold" />
                        <span className="text-lg font-bold">{profile.rating.toFixed(1)}</span>
                      </div>
                      <p className="text-xs text-fon-gold-dark">التقييم</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-fon-gold mb-1">
                        <Car className="w-3.5 h-3.5" />
                        <span className="text-lg font-bold">{profile.total_rides}</span>
                      </div>
                      <p className="text-xs text-fon-gold-dark">رحلاتي</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-fon-gold mb-1">
                        <WalletIcon className="w-3.5 h-3.5" />
                        <span className="text-lg font-bold">{wallet ? wallet.balance.toFixed(1) : '0'}</span>
                      </div>
                      <p className="text-xs text-fon-gold-dark">رصيد المحفظة</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            {!editing && (
              <div className="space-y-3">
                <button
                  onClick={() => setEditing(true)}
                  className="fon-card w-full p-4 flex items-center gap-3 hover:bg-fon-gold/5 transition text-right"
                >
                  <Edit3 className="w-5 h-5 text-fon-gold" />
                  <span className="text-sm font-semibold text-fon-gold-light flex-1">تعديل البيانات</span>
                </button>

                <button
                  onClick={() => setShowRides(!showRides)}
                  className="fon-card w-full p-4 flex items-center gap-3 hover:bg-fon-gold/5 transition text-right"
                >
                  <History className="w-5 h-5 text-fon-gold" />
                  <span className="text-sm font-semibold text-fon-gold-light flex-1">سجل رحلاتي</span>
                  <span className="text-xs text-fon-gold-dark">{rides.length}</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full p-4 flex items-center gap-3 text-right rounded-xl border border-red-400/30 bg-red-500/5 hover:bg-red-500/10 transition"
                >
                  <LogOut className="w-5 h-5 text-red-400" />
                  <span className="text-sm font-semibold text-red-400 flex-1">تسجيل خروج</span>
                </button>
              </div>
            )}

            {/* Ride History */}
            {showRides && (
              <div className="space-y-3 animate-slide-up">
                <h3 className="text-sm font-semibold text-fon-gold mb-2">سجل رحلاتي</h3>
                {rides.length === 0 ? (
                  <div className="fon-card p-6 text-center">
                    <p className="text-sm text-fon-gold-dark">ما عندك رحلات بعد</p>
                  </div>
                ) : (
                  rides.map((ride) => {
                    const st = statusLabel(ride.status);
                    return (
                      <div key={ride.id} className="fon-card p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-semibold ${st.color}`}>{st.text}</span>
                          <span className="text-sm font-bold fon-text-gradient-gold">
                            {ride.price?.toFixed(2)} د.أ
                          </span>
                        </div>
                        <div className="flex items-start gap-2 mb-1">
                          <span className="text-xs text-fon-gold-dark mt-0.5">من:</span>
                          <span className="text-xs text-fon-gold-light">{ride.from_address}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-fon-gold-dark mt-0.5">لوين:</span>
                          <span className="text-xs text-fon-gold-light">{ride.to_address}</span>
                        </div>
                        <p className="text-xs text-fon-gold-dark mt-2">
                          {new Date(ride.created_at).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
