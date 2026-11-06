'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Lock, Mail, Loader2, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminAuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase
          .from('profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.role === 'admin') router.push('/admin');
          });
      }
    });
  }, [router]);

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('اكتب الايميل وكلمة السر');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (prof?.role === 'admin') {
          toast.success('أهلاً بك في لوحة التحكم');
          router.push('/admin');
        } else {
          toast.error('ليس لديك صلاحية الأدمن');
          await supabase.auth.signOut();
        }
      }
    } catch {
      toast.error('ما زبط الدخول - تأكد من بياناتك');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    router.push('/auth/admin');
  };

  return (
    <div className="min-h-screen fon-gradient-dark px-4 py-0">
      {/* Top bar — logout button left, settings icon right */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-3 backdrop-blur-md border-b border-fon-gold/20" style={{ background: 'rgba(10,25,49,0.92)' }}>
        <button
          onClick={handleLogout}
          className="w-10 h-10 rounded-full bg-fon-black/80 backdrop-blur-sm border border-fon-gold/20 flex items-center justify-center hover:bg-fon-gold/10 transition"
        >
          <LogOut className="w-5 h-5 text-fon-gold" />
        </button>
        <div className="w-10 h-10 rounded-full bg-fon-black/80 backdrop-blur-sm border border-fon-gold/20 flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-fon-gold" />
        </div>
      </div>
      <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 fon-gradient-gold rounded-2xl flex items-center justify-center mx-auto mb-4">
            <SettingsIcon className="w-8 h-8 text-fon-black" />
          </div>
          <h1 className="text-2xl font-bold fon-text-gradient-gold">لوحة التحكم - دخول الأدمن</h1>
          <p className="text-sm text-fon-gold-dark mt-1">FOCUS ON-TAXI — دخول مخصص للإدارة فقط</p>
        </div>

        <div className="fon-card p-6 space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-fon-gold-light mb-2">
              <Mail className="w-4 h-4" /> الايميل
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@fontaxi.jo"
              className="fon-input w-full px-4 py-3 text-sm"
              dir="ltr"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-fon-gold-light mb-2">
              <Lock className="w-4 h-4" /> كلمة السر
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="fon-input w-full px-4 py-3 text-sm"
              dir="ltr"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="fon-btn-gold w-full py-3.5 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            دخول
          </button>
        </div>

        <div className="text-center mt-4 space-y-2">
          <Link href="/auth/customer" className="block text-xs text-fon-gold-dark hover:text-fon-gold transition">
            دخول كراكب
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
