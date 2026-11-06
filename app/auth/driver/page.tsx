'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Car, Phone, Loader2, User, Hash, Calendar, Palette, FileImage,
  CheckCircle2, X, Clock3, Plus, LogOut, Zap, Fuel, Gauge, Crown,
  Flower2, Users, Upload,
} from 'lucide-react';
import { supabase, type Driver, type CarType } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { captureAndUpload } from '@/lib/camera';

const VEHICLE_TYPES: { id: CarType; label: string; icon: typeof Car }[] = [
  { id: 'electric', label: 'كهربائية', icon: Zap },
  { id: 'hybrid', label: 'هايبرد', icon: Fuel },
  { id: 'petrol', label: 'بنزين', icon: Gauge },
  { id: 'premium', label: 'مميز', icon: Crown },
  { id: 'lady', label: 'ليدي', icon: Flower2 },
  { id: 'family', label: 'عائلي', icon: Users },
];

type UploadField = 'driver_license' | 'vehicle_license' | 'driver_with_car' | 'selfie';
type UploadState = { url: string | null; preview: string | null };

export default function DriverAuthPage() {
  const router = useRouter();
  const { signIn, session, loading: authLoading, signOut } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [uploadingField, setUploadingField] = useState<UploadField | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [existingDriver, setExistingDriver] = useState<Driver | null>(null);
  const [form, setForm] = useState({
    name: '', national_id: '', car_number: '', car_type: 'electric' as CarType, car_year: '', car_color: '',
  });
  const [driverLicense, setDriverLicense] = useState<UploadState>({ url: null, preview: null });
  const [vehicleLicense, setVehicleLicense] = useState<UploadState>({ url: null, preview: null });
  const [driverWithCar, setDriverWithCar] = useState<UploadState>({ url: null, preview: null });
  const [selfie, setSelfie] = useState<UploadState>({ url: null, preview: null });
  const [savedDriver, setSavedDriver] = useState<Driver | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (session?.role === 'driver' && session.driverId) {
      supabase
        .from('drivers')
        .select('*')
        .eq('id', session.driverId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const d = data as Driver;
            if (d.is_approved) router.push('/driver');
            else setStep(4);
            setSavedDriver(d);
          }
        });
    }
  }, [authLoading, session, router]);

  const checkPhone = async () => {
    if (phone.length < 8) {
      toast.error('اكتب رقم موبايل صحيح');
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('drivers')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

      if (data) {
        const d = data as Driver;
        setExistingDriver(d);
        if (d.is_approved) {
          await sendOTPForPhone(phone);
          setStep(3);
        } else {
          setSavedDriver(d);
          setStep(4);
        }
      } else {
        setStep(2);
      }
    } catch {
      toast.error('صار خطأ — جرب مرة تانية');
    } finally {
      setLoading(false);
    }
  };

  const sendOTPForPhone = async (p: string) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ phone: p }),
    });
    if (!response.ok) throw new Error('OTP send failed');
    const result = await response.json();
    if (result.smsSent) {
      toast.success('بعتنا لك رمز التحقق على رقمك');
    } else {
      toast.success(`رمز التحقق: ${result.code}`);
    }
  };

  const handleUpload = async (field: UploadField, identifier: string) => {
    setUploadingField(field);
    try {
      const { url, preview } = await captureAndUpload(field, identifier);
      if (url) {
        const newState: UploadState = { url, preview };
        if (field === 'driver_license') setDriverLicense(newState);
        else if (field === 'vehicle_license') setVehicleLicense(newState);
        else if (field === 'driver_with_car') setDriverWithCar(newState);
        else if (field === 'selfie') setSelfie(newState);
        toast.success('تم رفع الصورة');
      } else {
        toast.error('ما زبط رفع الصورة');
      }
    } catch (err) {
      console.error('UPLOAD ERROR:', err);
      toast.error('ما زبط رفع الصورة');
    } finally {
      setUploadingField(null);
    }
  };

  const submitRegistration = async () => {
    if (!form.name.trim() || !phone.trim() || !form.car_number.trim()) {
      toast.error('عبّي الاسم، الموبايل، ورقم السيارة'); return;
    }
    if (!driverLicense.url || !vehicleLicense.url || !driverWithCar.url || !selfie.url) {
      toast.error('ارفع الصور الأربع المطلوبة'); return;
    }
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('drivers')
        .select('id, is_approved')
        .eq('phone', phone)
        .maybeSingle();
      if (existing) {
        const d = existing as { id: string; is_approved: boolean };
        if (d.is_approved) {
          toast.error('هذا الرقم مسجل مسبقاً - سجل الدخول بدل التسجيل من جديد');
        } else {
          toast.error('هذا الرقم مسجل وبانتظار الموافقة - تواصل مع الإدارة');
        }
        setStep(1);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('drivers')
        .insert({
          name: form.name, phone, national_id: form.national_id, car_number: form.car_number,
          car_type: form.car_type, fuel_type: 'diesel', car_year: form.car_year, car_color: form.car_color,
          driver_license_url: driverLicense.url,
          vehicle_license_url: vehicleLicense.url,
          driver_with_car_url: driverWithCar.url,
          selfie_url: selfie.url,
          is_online: false, is_approved: false, status: 'pending_approval',
        })
        .select().single();
      if (error) throw error;
      const driver = data as Driver;
      setSavedDriver(driver);
      await sendOTPForPhone(phone);
      setStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('هذا الرقم مسجل مسبقاً');
        setStep(1);
      } else {
        toast.error('ما زبط التسجيل - جرب مرة تانية');
      }
    } finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    if (code.length < 4) { toast.error('اكتب رمز التحقق'); return; }
    setLoading(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ phone, verify: true, code }),
      });
      const result = await response.json();
      if (!response.ok || !result.verified) {
        toast.error(result.error || 'رمز غلط'); setLoading(false); return;
      }
      const driverId = savedDriver?.id || existingDriver?.id;
      await signIn('driver', phone, driverId);
      if (savedDriver && !savedDriver.is_approved) {
        setStep(4);
        toast.success('تم تأكيد رقمك - حسابك قيد المراجعة');
      } else {
        toast.success('تم تسجيل الدخول');
        router.push('/driver');
      }
    } catch {
      toast.error('ما زبط التحقق');
    } finally { setLoading(false); }
  };

  const handleExit = async () => {
    await signOut();
    window.location.href = '/';
  };

  const FileUploadSlot = ({ label, hint, field, state, setState }: {
    label: string; hint: string; field: UploadField;
    state: UploadState; setState: (s: UploadState) => void;
  }) => (
    <div>
      <label className="flex items-center gap-2 text-sm font-semibold text-fon-gold mb-2">
        <FileImage className="w-4 h-4" /> {label}
        {state.url && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
      </label>
      {state.preview ? (
        <div className="relative rounded-2xl overflow-hidden border-2 border-fon-gold/30">
          <img src={state.preview} alt={label} className="w-full h-32 object-cover" />
          <div className="absolute bottom-0 left-0 right-0 bg-[#0A1931]/80 px-3 py-1.5 flex items-center justify-between">
            <div className="min-w-0 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
              <span className="text-[10px] text-fon-gold-light truncate">تم الرفع</span>
            </div>
            <button onClick={() => setState({ url: null, preview: null })}
              className="w-7 h-7 rounded-full bg-[#0A1931] flex items-center justify-center text-red-400 hover:bg-red-500/20 transition shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => handleUpload(field, form.name || phone)}
            className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-[#0A1931]/80 text-[10px] text-fon-gold-light hover:bg-[#0A1931] transition"
          >
            تغيير
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => handleUpload(field, form.name || phone)}
          disabled={uploadingField === field}
          className="flex flex-col items-center justify-center gap-2 w-full h-32 rounded-2xl border-2 border-dashed border-[#e6d5a0]/30 bg-[#162447] hover:border-[#e6d5a0]/60 hover:bg-[#e6d5a0]/5 transition"
        >
          {uploadingField === field ? (
            <Loader2 className="w-6 h-6 text-fon-gold animate-spin" />
          ) : (
            <>
              <Upload className="w-6 h-6 text-[#e6d5a0]" />
              <span className="text-xs text-fon-gold-dark flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> {hint}
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen fon-gradient-dark flex items-center justify-center px-4 relative">
      <button onClick={handleExit}
        className="fixed top-4 left-4 z-[999] px-5 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition hover:scale-105"
        style={{ background: '#e6d5a0', color: '#0f1f3c' }}>
        <span>خروج</span><LogOut className="w-4 h-4" />
      </button>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 fon-gradient-gold rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Car className="w-8 h-8 text-fon-black" />
          </div>
          <h1 className="text-2xl font-bold fon-text-gradient-gold">FON TAXI - السائق</h1>
          <p className="text-sm text-fon-gold-dark mt-1">
            {step === 1 && 'أدخل رقم موبايلك'}
            {step === 2 && 'سجل ككابتن جديد'}
            {step === 3 && 'تأكيد رقم الموبايل'}
            {step === 4 && 'حسابك قيد المراجعة'}
          </p>
        </div>

        {/* Step 1: Phone check */}
        {step === 1 && (
          <div className="fon-card p-6 space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-fon-gold-light mb-2">
                <Phone className="w-4 h-4" /> رقم الهاتف
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-fon-gold-dark px-3 py-3 bg-white/5 rounded-lg border border-fon-gold/20">+962</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XXXXXXXX" className="fon-input flex-1 px-4 py-3 text-sm" dir="ltr"
                  onKeyDown={(e) => e.key === 'Enter' && checkPhone()} />
              </div>
            </div>
            <button onClick={checkPhone} disabled={loading} className="fon-btn-gold w-full py-3.5 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              متابعة
            </button>
          </div>
        )}

        {/* Step 2: Registration Form */}
        {step === 2 && (
          <div className="fon-card p-6 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto" style={{ borderRadius: '16px', background: '#162447' }}>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-fon-gold mb-2">
                <User className="w-4 h-4" /> الاسم الكامل
              </label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="اسمك الكامل" className="fon-input w-full px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-fon-gold mb-2">
                <Hash className="w-4 h-4" /> الرقم الوطني
              </label>
              <input type="text" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })}
                placeholder="#" className="fon-input w-full px-4 py-3 text-sm" dir="ltr" />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-fon-gold mb-2">
                <Car className="w-4 h-4" /> رقم المركبة
              </label>
              <input type="text" value={form.car_number} onChange={(e) => setForm({ ...form, car_number: e.target.value })}
                placeholder="مثال: 12-34567" className="fon-input w-full px-4 py-3 text-sm" dir="ltr" />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-fon-gold mb-2">
                <Car className="w-4 h-4" /> نوع المركبة
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {VEHICLE_TYPES.map((vt) => {
                  const Icon = vt.icon;
                  const isSelected = form.car_type === vt.id;
                  return (
                    <button key={vt.id} onClick={() => setForm({ ...form, car_type: vt.id })}
                      className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-all"
                      style={{
                        border: isSelected ? '2px solid #e6d5a0' : '1px solid #e6d5a0',
                        background: isSelected ? '#e6d5a0' : '#162447',
                        color: isSelected ? '#0f1f3c' : '#e6d5a0',
                        boxShadow: isSelected ? '0 0 12px rgba(230,213,160,0.4)' : 'none',
                      }}>
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-semibold">{vt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-fon-gold mb-2">
                <Calendar className="w-4 h-4" /> صنف المركبة وسنة الصنع
              </label>
              <input type="text" value={form.car_year} onChange={(e) => setForm({ ...form, car_year: e.target.value })}
                placeholder="مثال: تويوتا كامري 2020" className="fon-input w-full px-4 py-3 text-sm" dir="ltr" />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-fon-gold mb-2">
                <Palette className="w-4 h-4" /> لون المركبة
              </label>
              <input type="text" value={form.car_color} onChange={(e) => setForm({ ...form, car_color: e.target.value })}
                placeholder="مثال: أبيض" className="fon-input w-full px-4 py-3 text-sm" />
            </div>
            <div className="pt-2 border-t border-fon-gold/20 space-y-4">
              <h3 className="text-sm font-semibold text-fon-gold">الصور المطلوبة</h3>
              <FileUploadSlot label="رخصة السائق - Driver License" hint="اضغط لالتقاط أو اختيار صورة الرخصة" field="driver_license" state={driverLicense} setState={setDriverLicense} />
              <FileUploadSlot label="رخصة المركبة - Vehicle License" hint="اضغط لالتقاط أو اختيار صورة الرخصة" field="vehicle_license" state={vehicleLicense} setState={setVehicleLicense} />
              <FileUploadSlot label="صورة السائق والمركبة - Driver & Vehicle Photo" hint="اضغط لالتقاط أو اختيار الصورة" field="driver_with_car" state={driverWithCar} setState={setDriverWithCar} />
              <FileUploadSlot label="صورة سيلفي - Selfie Photo" hint="اضغط لالتقاط أو اختيار صورة سيلفي" field="selfie" state={selfie} setState={setSelfie} />
            </div>
            <button onClick={submitRegistration} disabled={loading || uploadingField !== null || !driverLicense.url || !vehicleLicense.url || !driverWithCar.url || !selfie.url}
              className="fon-btn-gold w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              تسجيل وإرسال رمز التحقق
            </button>
          </div>
        )}

        {/* Step 3: OTP */}
        {step === 3 && (
          <div className="fon-card p-6 space-y-5">
            <div className="text-center">
              <p className="text-sm text-fon-gold-dark mb-1">أرسلنا رمز التحقق إلى</p>
              <p className="text-sm text-fon-gold-light font-semibold" dir="ltr">+962{phone}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-fon-gold-light mb-2 block">رمز التحقق</label>
              <input type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="••••" className="fon-input w-full px-4 py-3 text-center text-2xl tracking-widest"
                dir="ltr" maxLength={4} onKeyDown={(e) => e.key === 'Enter' && verifyOTP()} autoFocus />
            </div>
            <button onClick={verifyOTP} disabled={loading} className="fon-btn-gold w-full py-3.5 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              تأكيد الرمز
            </button>
          </div>
        )}

        {/* Step 4: Pending */}
        {step === 4 && savedDriver && (
          <div className="fon-card p-8 text-center space-y-4 animate-slide-up">
            <div className="w-20 h-20 rounded-full bg-fon-gold/10 flex items-center justify-center mx-auto animate-pulse-gold">
              <Clock3 className="w-10 h-10 text-fon-gold" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-fon-gold-light mb-2">تم استلام طلبك</h2>
              <p className="text-sm text-fon-gold-dark leading-relaxed">
                سيتم مراجعة بياناتك واعتمادك خلال 24 ساعة
              </p>
            </div>
            <div className="bg-fon-dark rounded-lg p-4 text-right space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-fon-gold-dark">الاسم</span>
                <span className="text-sm font-semibold text-fon-gold-light">{savedDriver.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-fon-gold-dark">الموبايل</span>
                <span className="text-sm font-semibold text-fon-gold-light" dir="ltr">{savedDriver.phone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-fon-gold-dark">رقم السيارة</span>
                <span className="text-sm font-semibold text-fon-gold-light" dir="ltr">{savedDriver.car_number}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-fon-gold/20">
                <span className="text-xs text-fon-gold-dark">الحالة</span>
                <span className="fon-badge fon-badge-pending">قيد المراجعة</span>
              </div>
            </div>
            <button onClick={handleExit} className="w-full py-3 text-sm font-semibold text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition">
              تسجيل خروج
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
