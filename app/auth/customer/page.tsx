'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User, Phone, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export default function CustomerAuthPage() {
  const router = useRouter();
  const { signIn, session, loading: authLoading } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // If already logged in as customer, go to map
  useEffect(() => {
    if (!authLoading && session?.role === 'customer') {
      router.push('/app/customer');
    }
  }, [authLoading, session, router]);

  const sendOTP = async () => {
    if (phone.length < 8) {
      toast.error('اكتب رقم موبايل صحيح');
      return;
    }
    setLoading(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ phone }),
      });
      if (!response.ok) throw new Error('Failed');
      const result = await response.json();
      setSent(true);
      if (result.smsSent) {
        toast.success('بعتنا لك رمز التحقق على رقمك');
      } else {
        toast.success(`رمز التحقق: ${result.code}`);
      }
    } catch {
      toast.error('ما زبط إرسال الرمز - جرب مرة تانية');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (code.length < 4) {
      toast.error('اكتب رمز التحقق');
      return;
    }
    setLoading(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ phone, verify: true, code }),
      });
      const result = await response.json();
      if (!response.ok || !result.verified) {
        toast.error(result.error || 'رمز غلط');
        setLoading(false);
        return;
      }

      // Create or update profile
      await supabase.from('profiles').upsert({
        phone,
        role: 'customer',
        rating: 5.0,
        total_rides: 0,
      }, { onConflict: 'phone' });

      // Ensure wallet exists
      await supabase.from('wallets').upsert({
        phone,
        balance: 0,
      }, { onConflict: 'phone' });

      // Sign in with Supabase auth (creates persistent session)
      await signIn('customer', phone);
      toast.success('تم تسجيل الدخول');
      router.push('/app/customer');
    } catch {
      toast.error('ما زبط التحقق - جرب مرة تانية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen fon-gradient-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 fon-gradient-gold rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-fon-black" />
          </div>
          <h1 className="text-2xl font-bold fon-text-gradient-gold">دخول الراكب</h1>
          <p className="text-sm text-fon-gold-dark mt-1">FOCUS ON-TAXI</p>
        </div>

        <div className="fon-card p-6 space-y-5">
          {!sent ? (
            <>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-fon-gold-light mb-2">
                  <Phone className="w-4 h-4" /> رقم الجوال
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-fon-gold-dark px-3 py-3 bg-white/5 rounded-lg border border-fon-gold/20">+962</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="7XXXXXXXX"
                    className="fon-input flex-1 px-4 py-3 text-sm"
                    dir="ltr"
                    onKeyDown={(e) => e.key === 'Enter' && sendOTP()}
                  />
                </div>
              </div>
              <button onClick={sendOTP} disabled={loading} className="fon-btn-gold w-full py-3.5 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                إرسال رمز التحقق
              </button>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-sm text-fon-gold-dark mb-1">أرسلنا رمز التحقق إلى</p>
                <p className="text-sm text-fon-gold-light font-semibold" dir="ltr">+962{phone}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-fon-gold-light mb-2 block">رمز التحقق</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="••••"
                  className="fon-input w-full px-4 py-3 text-center text-2xl tracking-widest"
                  dir="ltr"
                  maxLength={4}
                  onKeyDown={(e) => e.key === 'Enter' && verifyOTP()}
                />
              </div>
              <button onClick={verifyOTP} disabled={loading} className="fon-btn-gold w-full py-3.5 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                تحقق ودخول
              </button>
              <button onClick={() => { setSent(false); setCode(''); }} className="w-full text-xs text-fon-gold-dark hover:text-fon-gold transition">
                تغيير الرقم
              </button>
            </>
          )}
        </div>

        <div className="text-center mt-4 space-y-2">
          <button
            onClick={() => router.push('/')}
            className="w-full mt-6 bg-gradient-to-r from-[#C9A86A] to-[#E8D5A3] text-[#0A1931] py-3.5 rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-all"
          >
            ارجع للصفحة الرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}
