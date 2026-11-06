'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, User, Car, Shield, Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LandingPage() {
  const router = useRouter();
  const { session, loading, signOut } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (session) {
      if (session.role === 'customer') router.push('/app/customer');
      else if (session.role === 'driver') router.push('/driver');
      else if (session.role === 'admin') router.push('/admin');
    }
  }, [session, loading, router]);

  const chooseRole = (role: 'customer' | 'driver' | 'admin') => {
    if (role === 'customer') router.push('/auth/customer');
    else if (role === 'driver') router.push('/auth/driver');
    else router.push('/auth/admin');
  };

  const handleExit = async () => {
    await signOut();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0A1931 0%, #162447 100%)' }}>
        <div className="w-8 h-8 border-2 border-[#C9A86A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0A1931 0%, #162447 100%)' }}
    >
      <button
        onClick={handleExit}
        className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full border border-[#C9A86A]/20 flex items-center justify-center hover:bg-[#C9A86A]/10 transition"
        title="خروج"
      >
        <LogOut className="w-5 h-5" style={{ color: '#C9A86A' }} />
      </button>
      <div className="absolute top-[-100px] right-[-100px] w-96 h-96 rounded-full bg-[#C9A86A]/5 blur-3xl" />
      <div className="absolute bottom-[-100px] left-[-100px] w-96 h-96 rounded-full bg-[#C9A86A]/5 blur-3xl" />

      <div className="mb-16 text-center animate-fade-in relative z-10">
        <div className="w-28 h-28 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #C9A86A 0%, #E8D5A3 50%, #C9A86A 100%)', boxShadow: '0 12px 40px rgba(201,168,106,0.3)' }}
        >
          <Crown className="w-16 h-16" style={{ color: '#0A1931' }} />
        </div>
        <div className="mb-2">
          <span className="text-4xl font-black tracking-widest" style={{ color: '#C9A86A' }}>FOCUS ON-TAXI</span>
          <span className="block text-[10px] tracking-[0.6em] opacity-70 mt-1" style={{ color: '#E8D5A3' }}>FON</span>
        </div>
        <p className="mt-3 text-lg" style={{ color: '#C9A86A' }}>
          خدمة توصيل فاخرة في الأردن
        </p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <Sparkles className="w-4 h-4" style={{ color: '#C9A86A' }} />
          <span className="text-xs uppercase tracking-[0.3em]" style={{ color: '#9E8245' }}>
            Luxury Ride Service
          </span>
          <Sparkles className="w-4 h-4" style={{ color: '#C9A86A' }} />
        </div>
      </div>

      <div className="w-full max-w-sm space-y-4 animate-slide-up relative z-10">
        <button
          onClick={() => chooseRole('customer')}
          className="w-full py-5 text-xl font-bold flex items-center justify-center gap-3 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #C9A86A 0%, #E8D5A3 100%)',
            color: '#0A1931',
            boxShadow: '0 8px 25px rgba(201,168,106,0.35)',
          }}
        >
          <User className="w-6 h-6" />
          دخول كـ راكب
        </button>

        <button
          onClick={() => chooseRole('driver')}
          className="w-full py-5 text-xl font-bold flex items-center justify-center gap-3 rounded-2xl border-2 transition-all duration-300 hover:bg-[#C9A86A]/10"
          style={{ borderColor: '#C9A86A', color: '#C9A86A', background: 'transparent' }}
        >
          <Car className="w-6 h-6" />
          دخول كـ كابتن
        </button>

        <button
          onClick={() => chooseRole('admin')}
          className="w-full py-5 text-xl font-bold flex items-center justify-center gap-3 rounded-2xl border transition-all duration-300 hover:bg-[#C9A86A]/5"
          style={{ borderColor: 'rgba(201,168,106,0.3)', color: '#9E8245', background: 'transparent' }}
        >
          <Shield className="w-6 h-6" />
          دخول أدمن
        </button>
      </div>

      <p className="text-xs mt-16 relative z-10" style={{ color: 'rgba(201,168,106,0.4)' }}>
        © 2026 FOCUS ON-TAXI
      </p>
    </div>
  );
}
