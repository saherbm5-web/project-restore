'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LogoutButton() {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <button
      onClick={handleLogout}
      className="fixed top-4 left-4 bg-[#F5E6CC] hover:bg-[#E8D5B5] text-[#0F2440] border border-[#D4B896] px-5 py-2 rounded-full text-sm font-bold z-[9999] shadow-lg flex items-center gap-2 transition-all hover:scale-105"
    >
      <LogOut className="w-4 h-4" />
      خروج
    </button>
  );
}
