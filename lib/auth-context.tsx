'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Driver } from '@/lib/supabase';

export type AppRole = 'customer' | 'driver' | 'admin';

export interface AuthSession {
  role: AppRole;
  phone: string;
  driverId?: string;
}

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  signIn: (role: AppRole, phone: string, driverId?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const SESSION_KEY = 'fon_auth_session';
const FON_USER_KEY = 'fon_user';

function phoneToEmail(phone: string): string {
  return `${phone.replace(/[^0-9]/g, '')}@fon-taxi.app`;
}

function phoneToPassword(phone: string): string {
  return `Fon_${phone.replace(/[^0-9]/g, '')}_2026`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount — check both localStorage and Supabase
  useEffect(() => {
    let mounted = true;

    const restore = async () => {
      // 1. Check localStorage for our app session (fon_auth_session or fon_user)
      const saved = localStorage.getItem(SESSION_KEY) || localStorage.getItem(FON_USER_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as AuthSession;
          if (mounted) {
            setSession(parsed);
            setLoading(false);
          }
          // Keep both keys in sync
          localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
          localStorage.setItem(FON_USER_KEY, JSON.stringify(parsed));

          // 2. Try to restore Supabase session too (refresh token)
          const { data: { session: supaSession } } = await supabase.auth.getSession();
          if (!supaSession && mounted) {
            // No active Supabase session — try to sign in silently with stored phone
            // This re-establishes the session if the refresh token expired
            if (parsed.phone) {
              await supabase.auth.signInWithPassword({
                email: phoneToEmail(parsed.phone),
                password: phoneToPassword(parsed.phone),
              }).catch(() => {});
            }
          }
          return;
        } catch {
          // Fall through
        }
      }

      // 3. Check if Supabase has a session even without localStorage
      const { data: { session: supaSession } } = await supabase.auth.getSession();
      if (supaSession && mounted) {
        const phone = supaSession.user?.email?.replace('@fon-taxi.app', '') ?? '';
        const role = (supaSession.user?.user_metadata?.['role'] as AppRole) ?? 'customer';
        const driverId = supaSession.user?.user_metadata?.['driver_id'] as string | undefined;
        const restored: AuthSession = { role, phone, driverId };
        localStorage.setItem(SESSION_KEY, JSON.stringify(restored));
        setSession(restored);
      }
      if (mounted) setLoading(false);
    };

    restore();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, supaSession) => {
      (async () => {
        if (!supaSession) {
          // Session was revoked or signed out
          // Only clear if we didn't just sign in (avoid race)
          const stillSaved = localStorage.getItem(SESSION_KEY) || localStorage.getItem(FON_USER_KEY);
          if (!stillSaved && mounted) {
            setSession(null);
          }
          return;
        }
        // Session exists — make sure our app state reflects it
        const phone = supaSession.user?.email?.replace('@fon-taxi.app', '') ?? '';
        const role = (supaSession.user?.user_metadata?.['role'] as AppRole) ?? 'customer';
        const driverId = supaSession.user?.user_metadata?.['driver_id'] as string | undefined;
        const newSession: AuthSession = { role, phone, driverId };
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
        localStorage.setItem(FON_USER_KEY, JSON.stringify(newSession));
        if (mounted) setSession(newSession);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (role: AppRole, phone: string, driverId?: string) => {
    const email = phoneToEmail(phone);
    const password = phoneToPassword(phone);

    // Try to sign in first (returning user)
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

    let user = signInData.user;

    // If user doesn't exist, sign up
    if (error && (error.message.includes('Invalid login') || error.message.includes('not confirmed'))) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role, phone, driver_id: driverId },
        },
      });
      if (signUpError) throw signUpError;
      user = signUpData.user;
    } else if (error) {
      throw error;
    }

    // If we have a session but need to update metadata (e.g., driver_id changed)
    if (user && driverId) {
      await supabase.auth.updateUser({
        data: { role, phone, driver_id: driverId },
      });
    }

    const newSession: AuthSession = { role, phone, driverId };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    localStorage.setItem(FON_USER_KEY, JSON.stringify(newSession));
    setSession(newSession);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(FON_USER_KEY);
    localStorage.removeItem('fon_customer_phone');
    localStorage.removeItem('fon_driver');
    localStorage.removeItem('fon_role');
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
