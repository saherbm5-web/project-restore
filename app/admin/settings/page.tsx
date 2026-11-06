'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Settings as SettingsIcon,
  DollarSign,
  CreditCard,
  Save,
  Loader2,
  Clock,
  Smartphone,
  Building2,
  Plus,
  Trash2,
  Banknote,
  Ticket,
  Copy,
  CheckCircle2,
  XCircle,
  Gift,
} from 'lucide-react';
import { supabase, type CarType, CAR_TYPE_LABELS } from '@/lib/supabase';
import { CAR_TYPE_PRICING } from '@/lib/pricing';

type SettingsTab = 'pricing' | 'payment' | 'promos';
type PromoSubTab = 'discount' | 'bonus';

interface CarPricingEntry {
  opening: number;
  km_price_day: number;
  km_price_night: number;
}

interface PricingSettings {
  id: number;
  night_start_hour: number;
  night_end_hour: number;
  wait_price_per_min: number;
  included_km: number;
  car_pricing: Record<string, CarPricingEntry>;
}

interface PromoCodeRow {
  id: string;
  code: string;
  discount_value: number;
  discount_type: 'percent' | 'fixed';
  applicable_to: 'rider' | 'driver' | 'all';
  max_uses: number;
  used_count: number;
  expiry: string | null;
  is_active: boolean;
  created_at: string;
}

interface WalletBonusRow {
  id: string;
  code: string;
  bonus_value: number;
  bonus_type: 'percent' | 'fixed';
  min_recharge: number;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface PaymentMethodRow {
  id: number;
  code: string;
  name: string;
  icon: string | null;
  type: string;
  account_number: string | null;
  account_name: string | null;
  bank_name: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
}

const TYPE_LABELS: Record<string, string> = {
  iban: 'آيبان IBAN',
  cliq: 'كليك CliQ',
  zain_cash: 'زين كاش ZainCash',
};

const TYPE_ICONS: Record<string, typeof CreditCard> = {
  iban: Building2,
  cliq: Smartphone,
  zain_cash: Banknote,
};

const CAR_TYPES = Object.keys(CAR_TYPE_LABELS) as CarType[];

export default function AdminSettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>('pricing');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [payMethods, setPayMethods] = useState<PaymentMethodRow[]>([]);
  const [payForm, setPayForm] = useState({
    type: 'iban' as 'iban' | 'cliq' | 'zain_cash',
    name: '',
    account_number: '',
    account_name: '',
    bank_name: '',
    instructions: '',
  });
  const [paySaving, setPaySaving] = useState(false);
  const [promoCodes, setPromoCodes] = useState<PromoCodeRow[]>([]);
  const [promoSaving, setPromoSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [promoSubTab, setPromoSubTab] = useState<PromoSubTab>('discount');
  const [bonusCodes, setBonusCodes] = useState<WalletBonusRow[]>([]);
  const [bonusSaving, setBonusSaving] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusForm, setBonusForm] = useState({
    bonus_value: 10,
    bonus_type: 'percent' as 'percent' | 'fixed',
    min_recharge: 0,
    days_valid: 30,
  });

  useEffect(() => {
    (async () => {
      try {
        const { data: pd } = await supabase
          .from('pricing_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();
        if (pd) setPricing(pd as PricingSettings);

        const { data: pm } = await supabase
          .from('payment_methods')
          .select('*')
          .order('sort_order', { ascending: true });
        if (pm) setPayMethods(pm as PaymentMethodRow[]);

        const { data: pc } = await supabase
          .from('promo_codes')
          .select('*')
          .order('created_at', { ascending: false });
        if (pc) setPromoCodes(pc as PromoCodeRow[]);

        const { data: bc } = await supabase
          .from('wallet_bonus_codes')
          .select('*')
          .order('created_at', { ascending: false });
        if (bc) setBonusCodes(bc as WalletBonusRow[]);
      } catch {
        toast.error('ما زبط تحميل الإعدادات');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const savePricing = async () => {
    if (!pricing) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pricing_settings')
        .upsert({
          id: 1,
          night_start_hour: pricing.night_start_hour,
          night_end_hour: pricing.night_end_hour,
          wait_price_per_min: pricing.wait_price_per_min,
          included_km: pricing.included_km,
          car_pricing: pricing.car_pricing,
        });
      if (error) throw error;
      toast.success('تم حفظ إعدادات التسعيرة');
    } catch (e) {
      toast.error('ما زبط الحفظ: ' + ((e as Error).message || 'خطأ غير معروف'));
    } finally {
      setSaving(false);
    }
  };

  const addPayMethod = async () => {
    if (!payForm.account_number.trim()) {
      toast.error('اكتب رقم الحساب');
      return;
    }
    setPaySaving(true);
    try {
      const code = `${payForm.type}_${Date.now()}`;
      const iconName = payForm.type === 'iban' ? 'credit-card' : payForm.type === 'cliq' ? 'smartphone' : 'banknote';
      const label = TYPE_LABELS[payForm.type] ?? payForm.type;
      const { error } = await supabase.from('payment_methods').insert({
        code,
        name: payForm.name.trim() || label,
        icon: iconName,
        type: payForm.type,
        account_number: payForm.account_number.trim(),
        account_name: payForm.account_name.trim() || null,
        bank_name: payForm.bank_name.trim() || null,
        instructions: payForm.instructions.trim() || null,
        is_active: true,
        sort_order: payMethods.length,
      });
      if (error) throw error;
      toast.success('تم إضافة طريقة الدفع');
      setPayForm({ type: 'iban', name: '', account_number: '', account_name: '', bank_name: '', instructions: '' });
      const { data } = await supabase.from('payment_methods').select('*').order('sort_order', { ascending: true });
      if (data) setPayMethods(data as PaymentMethodRow[]);
    } catch {
      toast.error('ما زبط الإضافة');
    } finally {
      setPaySaving(false);
    }
  };

  const deletePayMethod = async (id: number) => {
    const { error } = await supabase.from('payment_methods').delete().eq('id', id);
    if (error) { toast.error('ما زبط الحذف'); return; }
    toast.info('تم حذف الطريقة');
    setPayMethods((prev) => prev.filter((m) => m.id !== id));
  };

  const togglePayMethod = async (id: number, currentActive: boolean) => {
    const { error } = await supabase.from('payment_methods').update({ is_active: !currentActive }).eq('id', id);
    if (error) { toast.error('ما زبط التحديث'); return; }
    setPayMethods((prev) => prev.map((m) => m.id === id ? { ...m, is_active: !currentActive } : m));
  };

  const generatePromoCode = async () => {
    setPromoSaving(true);
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      const { data, error } = await supabase
        .from('promo_codes')
        .insert({
          code,
          discount_value: 10,
          discount_type: 'percent',
          applicable_to: 'all',
          max_uses: 50,
          used_count: 0,
          is_active: true,
          expiry: expiry.toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      setPromoCodes((prev) => [data as PromoCodeRow, ...prev]);
      toast.success(`تم توليد الكود: ${code}`);
    } catch {
      toast.error('ما زبط توليد الكود');
    } finally {
      setPromoSaving(false);
    }
  };

  const togglePromoCode = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from('promo_codes').update({ is_active: !currentActive }).eq('id', id);
    if (error) { toast.error('ما زبط التحديث'); return; }
    setPromoCodes((prev) => prev.map((p) => p.id === id ? { ...p, is_active: !currentActive } : p));
  };

  const deletePromoCode = async (id: string) => {
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (error) { toast.error('ما زبط الحذف'); return; }
    setPromoCodes((prev) => prev.filter((p) => p.id !== id));
    toast.info('تم حذف الكود');
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const generateBonusCode = async () => {
    setBonusSaving(true);
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + bonusForm.days_valid);
      const { data, error } = await supabase
        .from('wallet_bonus_codes')
        .insert({
          code,
          bonus_value: bonusForm.bonus_value,
          bonus_type: bonusForm.bonus_type,
          min_recharge: bonusForm.min_recharge,
          max_uses: 100,
          used_count: 0,
          is_active: true,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      setBonusCodes((prev) => [data as WalletBonusRow, ...prev]);
      toast.success(`تم توليد كود البونص: ${code}`);
      setShowBonusModal(false);
    } catch {
      toast.error('ما زبط توليد كود البونص');
    } finally {
      setBonusSaving(false);
    }
  };

  const toggleBonusCode = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from('wallet_bonus_codes').update({ is_active: !currentActive }).eq('id', id);
    if (error) { toast.error('ما زبط التحديث'); return; }
    setBonusCodes((prev) => prev.map((b) => b.id === id ? { ...b, is_active: !currentActive } : b));
  };

  const deleteBonusCode = async (id: string) => {
    const { error } = await supabase.from('wallet_bonus_codes').delete().eq('id', id);
    if (error) { toast.error('ما زبط الحذف'); return; }
    setBonusCodes((prev) => prev.filter((b) => b.id !== id));
    toast.info('تم حذف كود البونص');
  };

  const updateCarPricing = (type: CarType, field: keyof CarPricingEntry, value: number) => {
    if (!pricing) return;
    const current = pricing.car_pricing[type] ?? CAR_TYPE_PRICING[type];
    setPricing({
      ...pricing,
      car_pricing: {
        ...pricing.car_pricing,
        [type]: { ...current, [field]: value },
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0A1931 0%, #162447 100%)' }}>
        <Loader2 className="w-8 h-8 text-[#C9A86A] animate-spin" />
      </div>
    );
  }

  const goldColor = '#C9A86A';
  const goldDark = '#9E8245';
  const lightGold = '#E8D5A3';
  const cardStyle = { background: 'rgba(22,36,71,0.5)' };
  const inputClass = "w-full px-4 py-2.5 rounded-lg border border-[#C9A86A]/30 bg-[#0A1931] text-sm outline-none focus:border-[#C9A86A]";
  const labelClass = "text-xs mb-1.5 block";

  return (
    <div className="min-h-screen pb-20 overflow-x-hidden max-w-full" style={{ background: 'linear-gradient(180deg, #0A1931 0%, #162447 100%)' }}>
      <header className="sticky top-0 z-40 backdrop-blur-md border-b border-[#C9A86A]/20" style={{ background: 'rgba(10,25,49,0.92)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 text-sm font-semibold transition hover:scale-[1.02]"
            style={{ color: goldDark }}
          >
            <ArrowLeft className="w-5 h-5" />
            رجوع
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' }}>
              <SettingsIcon className="w-5 h-5" style={{ color: '#0A1931' }} />
            </div>
            <h1 className="text-lg font-bold" style={{ color: goldColor }}>الإعدادات</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('pricing')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition ${
              tab === 'pricing' ? 'text-[#0A1931]' : 'border border-[#C9A86A]/20 hover:bg-[#C9A86A]/10'
            }`}
            style={tab === 'pricing' ? { background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' } : { color: goldColor }}
          >
            <DollarSign className="w-4 h-4" />
            التسعيرة
          </button>
          <button
            onClick={() => setTab('payment')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition ${
              tab === 'payment' ? 'text-[#0A1931]' : 'border border-[#C9A86A]/20 hover:bg-[#C9A86A]/10'
            }`}
            style={tab === 'payment' ? { background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' } : { color: goldColor }}
          >
            <CreditCard className="w-4 h-4" />
            طرق الدفع
          </button>
          <button
            onClick={() => setTab('promos')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition ${
              tab === 'promos' ? 'text-[#0A1931]' : 'border border-[#C9A86A]/20 hover:bg-[#C9A86A]/10'
            }`}
            style={tab === 'promos' ? { background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' } : { color: goldColor }}
          >
            <Ticket className="w-4 h-4" />
            أكواد الخصم
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-4">
        {tab === 'pricing' && pricing && (
          <div className="space-y-5 animate-fade-in">
            <div className="rounded-2xl border border-[#C9A86A]/15 p-5" style={cardStyle}>
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: goldColor }}>
                <Clock className="w-4 h-4" />
                وقت التسعيرة الليلية
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} style={{ color: goldDark }}>من الساعة</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={pricing.night_start_hour}
                    onChange={(e) => setPricing({ ...pricing, night_start_hour: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                    style={{ color: lightGold }}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className={labelClass} style={{ color: goldDark }}>إلى الساعة</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={pricing.night_end_hour}
                    onChange={(e) => setPricing({ ...pricing, night_end_hour: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                    style={{ color: lightGold }}
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#C9A86A]/15 p-5" style={cardStyle}>
              <label className="text-sm font-bold mb-3 block" style={{ color: goldColor }}>
                المسافة المشمولة بالسعر الأساسي (كم)
              </label>
              <select
                value={pricing.included_km ?? 3}
                onChange={(e) => setPricing({ ...pricing, included_km: Number(e.target.value) })}
                className={inputClass}
                style={{ color: lightGold }}
              >
                <option value={2}>2 كم</option>
                <option value={3}>3 كم</option>
              </select>
            </div>

            <div className="rounded-2xl border border-[#C9A86A]/15 p-5" style={cardStyle}>
              <label className="text-sm font-bold mb-3 block" style={{ color: goldColor }}>
                سعر دقيقة الانتظار (د.أ)
              </label>
              <input
                type="number"
                step="0.01"
                value={pricing.wait_price_per_min}
                onChange={(e) => setPricing({ ...pricing, wait_price_per_min: parseFloat(e.target.value) || 0 })}
                className={inputClass}
                style={{ color: lightGold }}
                dir="ltr"
              />
            </div>

            <div className="rounded-2xl border border-[#C9A86A]/15 p-5 space-y-4" style={cardStyle}>
              <h3 className="text-sm font-bold" style={{ color: goldColor }}>التسعيرة حسب نوع المركبة</h3>
              {CAR_TYPES.map((type) => {
                const cp = pricing.car_pricing[type] ?? CAR_TYPE_PRICING[type];
                return (
                  <div key={type} className="rounded-xl border border-[#C9A86A]/10 p-4" style={{ background: 'rgba(10,25,49,0.4)' }}>
                    <p className="text-sm font-semibold mb-3" style={{ color: lightGold }}>{CAR_TYPE_LABELS[type]}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] mb-1 block" style={{ color: goldDark }}>فتحة العداد</label>
                        <input
                          type="number"
                          step="0.01"
                          value={cp.opening}
                          onChange={(e) => updateCarPricing(type, 'opening', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg border border-[#C9A86A]/20 bg-[#0A1931] text-xs outline-none focus:border-[#C9A86A]"
                          style={{ color: lightGold }}
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] mb-1 block" style={{ color: goldDark }}>سعر الكيلو نهاراً</label>
                        <input
                          type="number"
                          step="0.01"
                          value={cp.km_price_day}
                          onChange={(e) => updateCarPricing(type, 'km_price_day', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg border border-[#C9A86A]/20 bg-[#0A1931] text-xs outline-none focus:border-[#C9A86A]"
                          style={{ color: lightGold }}
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] mb-1 block" style={{ color: goldDark }}>سعر الكيلو ليلاً</label>
                        <input
                          type="number"
                          step="0.01"
                          value={cp.km_price_night}
                          onChange={(e) => updateCarPricing(type, 'km_price_night', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg border border-[#C9A86A]/20 bg-[#0A1931] text-xs outline-none focus:border-[#C9A86A]"
                          style={{ color: lightGold }}
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={savePricing}
              disabled={saving}
              className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition hover:scale-[1.01] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)', color: '#0A1931' }}
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              حفظ إعدادات التسعيرة
            </button>
          </div>
        )}

        {tab === 'payment' && (
          <div className="space-y-5 animate-fade-in">
            {/* Existing payment methods list */}
            <div className="rounded-2xl border border-[#C9A86A]/15 p-5 space-y-3" style={cardStyle}>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: goldColor }}>
                <CreditCard className="w-4 h-4" />
                طرق الدفع الحالية ({payMethods.filter(m => m.code !== 'wallet').length})
              </h3>
              {payMethods.filter(m => m.code !== 'wallet').length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: goldDark }}>ما في طرق دفع بعد</p>
              ) : (
                <div className="space-y-2">
                  {payMethods.filter(m => m.code !== 'wallet').map((m) => {
                    const Icon = TYPE_ICONS[m.type] ?? CreditCard;
                    return (
                      <div key={m.id} className="rounded-xl border border-[#C9A86A]/10 p-3 flex items-center gap-3" style={{ background: 'rgba(10,25,49,0.4)' }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(201,168,106,0.15)' }}>
                          <Icon className="w-4 h-4" style={{ color: goldColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: lightGold }}>{m.name}</p>
                          <p className="text-[10px] truncate font-mono" style={{ color: goldDark }} dir="ltr">{m.account_number || '—'}</p>
                        </div>
                        <button
                          onClick={() => togglePayMethod(m.id, m.is_active)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition flex-shrink-0 ${
                            m.is_active
                              ? 'bg-green-500/15 text-green-400 border-green-500/30'
                              : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                          }`}
                        >
                          {m.is_active ? 'فعال' : 'متوقف'}
                        </button>
                        <button
                          onClick={() => deletePayMethod(m.id)}
                          className="p-1.5 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 transition flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add new payment method form */}
            <div className="rounded-2xl border border-[#C9A86A]/15 p-5 space-y-4" style={cardStyle}>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: goldColor }}>
                <Plus className="w-4 h-4" />
                إضافة طريقة دفع
              </h3>

              {/* Type selector */}
              <div>
                <label className={labelClass} style={{ color: goldDark }}>النوع</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['iban', 'cliq', 'zain_cash'] as const).map((t) => {
                    const Icon = TYPE_ICONS[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setPayForm({ ...payForm, type: t, name: TYPE_LABELS[t] })}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition ${
                          payForm.type === t
                            ? 'border-[#C9A86A] bg-[#C9A86A]/10'
                            : 'border-[#C9A86A]/20 hover:border-[#C9A86A]/50'
                        }`}
                      >
                        <Icon className="w-5 h-5" style={{ color: payForm.type === t ? goldColor : goldDark }} />
                        <span className="text-[10px] font-bold" style={{ color: payForm.type === t ? lightGold : goldDark }}>
                          {TYPE_LABELS[t]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelClass} style={{ color: goldDark }}>اسم الظهور</label>
                <input
                  type="text"
                  value={payForm.name}
                  onChange={(e) => setPayForm({ ...payForm, name: e.target.value })}
                  placeholder={TYPE_LABELS[payForm.type] ?? ''}
                  className={inputClass}
                  style={{ color: lightGold }}
                />
              </div>

              <div>
                <label className={labelClass} style={{ color: goldDark }}>
                  {payForm.type === 'iban' ? 'رقم الـ IBAN' : payForm.type === 'cliq' ? 'الاسم المختصر (CliQ Alias)' : 'رقم محفظة زين كاش'}
                </label>
                <input
                  type="text"
                  value={payForm.account_number}
                  onChange={(e) => setPayForm({ ...payForm, account_number: e.target.value })}
                  placeholder={payForm.type === 'iban' ? 'JOXX XXXX ...' : 'مثال: 079xxxxxxx'}
                  className={inputClass}
                  style={{ color: lightGold }}
                  dir="ltr"
                />
              </div>

              {payForm.type === 'iban' && (
                <div>
                  <label className={labelClass} style={{ color: goldDark }}>اسم البنك</label>
                  <input
                    type="text"
                    value={payForm.bank_name}
                    onChange={(e) => setPayForm({ ...payForm, bank_name: e.target.value })}
                    placeholder="مثال: بنك الإسكان"
                    className={inputClass}
                    style={{ color: lightGold }}
                  />
                </div>
              )}

              <div>
                <label className={labelClass} style={{ color: goldDark }}>الاسم المستعار</label>
                <input
                  type="text"
                  value={payForm.account_name}
                  onChange={(e) => setPayForm({ ...payForm, account_name: e.target.value })}
                  placeholder="اسم صاحب الحساب"
                  className={inputClass}
                  style={{ color: lightGold }}
                />
              </div>

              <div>
                <label className={labelClass} style={{ color: goldDark }}>تعليمات الدفع (اختياري)</label>
                <textarea
                  value={payForm.instructions}
                  onChange={(e) => setPayForm({ ...payForm, instructions: e.target.value })}
                  placeholder="تعليمات تظهر للمستخدم عند اختيار هذه الطريقة"
                  rows={2}
                  className={inputClass}
                  style={{ color: lightGold }}
                />
              </div>

              <button
                onClick={addPayMethod}
                disabled={paySaving || !payForm.account_number.trim()}
                className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition hover:scale-[1.01] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)', color: '#0A1931' }}
              >
                {paySaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                إضافة طريقة الدفع
              </button>
            </div>
          </div>
        )}
        {tab === 'promos' && (
          <div className="space-y-5 animate-fade-in">
            {/* Sub-tabs: discount codes vs bonus codes */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPromoSubTab('discount')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                  promoSubTab === 'discount' ? 'text-[#0A1931]' : 'border border-[#C9A86A]/20 hover:bg-[#C9A86A]/10'
                }`}
                style={promoSubTab === 'discount' ? { background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' } : { color: goldColor }}
              >
                <Ticket className="w-3.5 h-3.5" />
                توليد كود خصم
              </button>
              <button
                onClick={() => setPromoSubTab('bonus')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                  promoSubTab === 'bonus' ? 'text-[#0A1931]' : 'border border-[#C9A86A]/20 hover:bg-[#C9A86A]/10'
                }`}
                style={promoSubTab === 'bonus' ? { background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)' } : { color: goldColor }}
              >
                <Gift className="w-3.5 h-3.5" />
                توليد كود بونص
              </button>
            </div>

            {/* Discount codes sub-tab */}
            {promoSubTab === 'discount' && (
              <div className="rounded-2xl border border-[#C9A86A]/15 p-5 space-y-4" style={cardStyle}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: goldColor }}>
                    <Ticket className="w-4 h-4" />
                    اكواد الخصم ({promoCodes.length})
                  </h3>
                  <button
                    onClick={generatePromoCode}
                    disabled={promoSaving}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition hover:scale-[1.02] disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)', color: '#0A1931' }}
                  >
                    {promoSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    ولّد كود جديد
                  </button>
                </div>

                {promoCodes.length === 0 ? (
                  <p className="text-xs text-center py-6" style={{ color: goldDark }}>ما في اكواد بعد</p>
                ) : (
                  <div className="space-y-2">
                    {promoCodes.map((p) => (
                      <div key={p.id} className="rounded-xl border border-[#C9A86A]/10 p-3 flex items-center gap-3" style={{ background: 'rgba(10,25,49,0.4)' }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold font-mono" style={{ color: lightGold }} dir="ltr">{p.code}</span>
                            <button onClick={() => copyCode(p.code)} className="p-1 rounded hover:bg-[#C9A86A]/10 transition">
                              {copiedCode === p.code ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" style={{ color: goldDark }} />}
                            </button>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px]" style={{ color: goldDark }}>
                            <span>{p.discount_type === 'percent' ? `${p.discount_value}%` : `${p.discount_value} د.أ`}</span>
                            <span>•</span>
                            <span>{p.applicable_to === 'all' ? 'للجميع' : p.applicable_to === 'rider' ? 'للراكب' : 'للسائق'}</span>
                            <span>•</span>
                            <span>{p.used_count}/{p.max_uses} استخدام</span>
                            {p.expiry && (
                              <>
                                <span>•</span>
                                <span style={{ color: new Date(p.expiry) < new Date() ? '#ef4444' : goldDark }}>
                                  {new Date(p.expiry).toLocaleDateString('ar-JO')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => togglePromoCode(p.id, p.is_active)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition flex-shrink-0 ${
                            p.is_active
                              ? 'bg-green-500/15 text-green-400 border-green-500/30'
                              : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                          }`}
                        >
                          {p.is_active ? 'فعال' : 'متوقف'}
                        </button>
                        <button
                          onClick={() => deletePromoCode(p.id)}
                          className="p-1.5 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 transition flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bonus codes sub-tab */}
            {promoSubTab === 'bonus' && (
              <div className="rounded-2xl border border-[#C9A86A]/15 p-5 space-y-4" style={cardStyle}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: goldColor }}>
                    <Gift className="w-4 h-4" />
                    اكواد بونص الشحن ({bonusCodes.length})
                  </h3>
                  <button
                    onClick={() => setShowBonusModal(true)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)', color: '#0A1931' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    ولّد كود بونص
                  </button>
                </div>

                {bonusCodes.length === 0 ? (
                  <p className="text-xs text-center py-6" style={{ color: goldDark }}>ما في اكواد بونص بعد</p>
                ) : (
                  <div className="space-y-2">
                    {bonusCodes.map((b) => (
                      <div key={b.id} className="rounded-xl border border-[#C9A86A]/10 p-3 flex items-center gap-3" style={{ background: 'rgba(10,25,49,0.4)' }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold font-mono" style={{ color: lightGold }} dir="ltr">{b.code}</span>
                            <button onClick={() => copyCode(b.code)} className="p-1 rounded hover:bg-[#C9A86A]/10 transition">
                              {copiedCode === b.code ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" style={{ color: goldDark }} />}
                            </button>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px]" style={{ color: goldDark }}>
                            <span>{b.bonus_type === 'percent' ? `بونص ${b.bonus_value}%` : `بونص ${b.bonus_value} د.أ`}</span>
                            <span>•</span>
                            <span>حد ادنى: {b.min_recharge} د.أ</span>
                            <span>•</span>
                            <span>{b.used_count}/{b.max_uses} استخدام</span>
                            {b.expires_at && (
                              <>
                                <span>•</span>
                                <span style={{ color: new Date(b.expires_at) < new Date() ? '#ef4444' : goldDark }}>
                                  {new Date(b.expires_at).toLocaleDateString('ar-JO')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleBonusCode(b.id, b.is_active)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition flex-shrink-0 ${
                            b.is_active
                              ? 'bg-green-500/15 text-green-400 border-green-500/30'
                              : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                          }`}
                        >
                          {b.is_active ? 'فعال' : 'متوقف'}
                        </button>
                        <button
                          onClick={() => deleteBonusCode(b.id)}
                          className="p-1.5 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 transition flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bonus code generation modal */}
            {showBonusModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowBonusModal(false)}>
                <div className="rounded-2xl border border-[#C9A86A]/30 p-6 w-full max-w-md space-y-4" style={{ background: '#0A1931' }} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: goldColor }}>
                      <Gift className="w-4 h-4" />
                      توليد كود بونص شحن
                    </h3>
                    <button onClick={() => setShowBonusModal(false)} className="p-1" style={{ color: goldDark }}>
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <div>
                    <label className={labelClass} style={{ color: goldDark }}>نوع البونص</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setBonusForm({ ...bonusForm, bonus_type: 'percent' })}
                        className={`py-2.5 rounded-lg border-2 text-xs font-bold transition ${
                          bonusForm.bonus_type === 'percent' ? 'border-[#C9A86A] bg-[#C9A86A]/10' : 'border-[#C9A86A]/20'
                        }`}
                        style={{ color: bonusForm.bonus_type === 'percent' ? lightGold : goldDark }}
                      >
                        نسبة مئوية %
                      </button>
                      <button
                        onClick={() => setBonusForm({ ...bonusForm, bonus_type: 'fixed' })}
                        className={`py-2.5 rounded-lg border-2 text-xs font-bold transition ${
                          bonusForm.bonus_type === 'fixed' ? 'border-[#C9A86A] bg-[#C9A86A]/10' : 'border-[#C9A86A]/20'
                        }`}
                        style={{ color: bonusForm.bonus_type === 'fixed' ? lightGold : goldDark }}
                      >
                        مبلغ ثابت د.أ
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass} style={{ color: goldDark }}>
                      قيمة البونص {bonusForm.bonus_type === 'percent' ? '(%)' : '(د.أ)'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[10, 20, 50].map((v) => (
                        <button
                          key={v}
                          onClick={() => setBonusForm({ ...bonusForm, bonus_value: v })}
                          className={`py-2.5 rounded-lg border-2 text-sm font-bold transition ${
                            bonusForm.bonus_value === v ? 'border-[#C9A86A] bg-[#C9A86A]/10' : 'border-[#C9A86A]/20'
                          }`}
                          style={{ color: bonusForm.bonus_value === v ? lightGold : goldDark }}
                        >
                          {v}{bonusForm.bonus_type === 'percent' ? '%' : ''}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={bonusForm.bonus_value}
                      onChange={(e) => setBonusForm({ ...bonusForm, bonus_value: parseFloat(e.target.value) || 0 })}
                      className={inputClass}
                      style={{ color: lightGold, marginTop: '8px' }}
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className={labelClass} style={{ color: goldDark }}>الحد الادنى للشحن (د.أ)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bonusForm.min_recharge}
                      onChange={(e) => setBonusForm({ ...bonusForm, min_recharge: parseFloat(e.target.value) || 0 })}
                      className={inputClass}
                      style={{ color: lightGold }}
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className={labelClass} style={{ color: goldDark }}>مدة الصلاحية (ايام)</label>
                    <input
                      type="number"
                      value={bonusForm.days_valid}
                      onChange={(e) => setBonusForm({ ...bonusForm, days_valid: parseInt(e.target.value) || 30 })}
                      className={inputClass}
                      style={{ color: lightGold }}
                      dir="ltr"
                    />
                  </div>

                  <button
                    onClick={generateBonusCode}
                    disabled={bonusSaving}
                    className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition hover:scale-[1.01] disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #C9A86A, #E8D5A3)', color: '#0A1931' }}
                  >
                    {bonusSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gift className="w-5 h-5" />}
                    توليد الكود
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
