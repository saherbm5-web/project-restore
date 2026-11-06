'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Star, CheckCircle2, Loader2, ArrowRight, Car } from 'lucide-react';
import { supabase, type Ride } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import LogoutButton from '@/app/components/LogoutButton';

export default function RatingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rideId = searchParams.get('rideId') || '';
  const { session, loading: authLoading } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [driverName, setDriverName] = useState<string>('');
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alreadyRated, setAlreadyRated] = useState(false);

  const loadRide = useCallback(async () => {
    if (!rideId) return;
    const { data } = await supabase
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .maybeSingle();
    if (data) {
      const r = data as Ride;
      setRide(r);
      if (r.driver_id) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('name')
          .eq('id', r.driver_id)
          .maybeSingle();
        if (driverData) setDriverName((driverData as { name: string }).name);
      }
      const { data: existing } = await supabase
        .from('driver_ratings')
        .select('id')
        .eq('ride_id', rideId)
        .maybeSingle();
      if (existing) setAlreadyRated(true);
    }
    setLoading(false);
  }, [rideId]);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push('/');
      return;
    }
    if (session?.role === 'driver') {
      router.push('/driver');
      return;
    }
    void loadRide();
  }, [authLoading, session, router, loadRide]);

  const submitRating = async () => {
    if (stars === 0) {
      toast.error('اختر تقييم من 1 إلى 5 نجوم');
      return;
    }
    if (!ride) return;
    setSubmitting(true);
    try {
      const { error: ratingError } = await supabase
        .from('driver_ratings')
        .insert({
          ride_id: rideId,
          driver_id: ride.driver_id,
          customer_phone: ride.customer_phone,
          rating: stars,
          comment: comment.trim() || null,
        });
      if (ratingError) throw ratingError;

      if (ride.driver_id) {
        const { data: ratingsData } = await supabase
          .from('driver_ratings')
          .select('rating')
          .eq('driver_id', ride.driver_id);
        if (ratingsData && ratingsData.length > 0) {
          const avg = ratingsData.reduce((sum, r) => sum + (r as { rating: number }).rating, 0) / ratingsData.length;
          await supabase
            .from('drivers')
            .update({ rating: Math.round(avg * 100) / 100 })
            .eq('id', ride.driver_id);
        }
      }

      toast.success('شكراً لتقييمك!');
      router.push('/app/customer');
    } catch {
      toast.error('ما زبط إرسال التقييم');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen fon-gradient-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-fon-gold animate-spin" />
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="min-h-screen fon-gradient-dark flex items-center justify-center px-4">
        <LogoutButton />
        <div className="text-center">
          <p className="text-sm text-fon-gold-dark mb-4">ما لقينا الرحلة</p>
          <button onClick={() => router.push('/')} className="fon-btn-gold px-6 py-2.5 text-sm font-semibold rounded-lg">
            الصفحة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen fon-gradient-dark flex items-center justify-center px-4 py-8">
      <LogoutButton />
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-green-400/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold fon-text-gradient-gold mb-2">خلصت الرحلة</h1>
          <p className="text-sm text-fon-gold-dark">قيم تجربتك مع الكابتن</p>
        </div>

        <div className="fon-card p-4 mb-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-fon-gold/10 flex items-center justify-center">
              <Car className="w-5 h-5 text-fon-gold" />
            </div>
            <div>
              <p className="text-xs text-fon-gold-dark">الكابتن</p>
              <p className="text-sm font-bold text-fon-gold-light">{driverName || 'كابتن'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-fon-gold/10">
            <div className="text-center">
              <p className="text-xs text-fon-gold-dark">الأجرة</p>
              <p className="text-lg font-bold text-green-400">{(ride.price ?? 0).toFixed(2)} د.أ</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-fon-gold-dark">المسافة</p>
              <p className="text-lg font-bold text-fon-gold-light">{(ride.distance_km ?? 0).toFixed(1)} كم</p>
            </div>
          </div>
        </div>

        {alreadyRated ? (
          <div className="fon-card p-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <p className="text-sm text-fon-gold-light">تم تقييم هذه الرحلة من قبل</p>
            <button
              onClick={() => router.push('/app/customer')}
              className="fon-btn-gold w-full py-3 text-sm font-semibold rounded-lg"
            >
              العودة
            </button>
          </div>
        ) : (
          <>
            <div className="fon-card p-6 space-y-5">
              <div className="text-center">
                <p className="text-sm text-fon-gold-light mb-4">كم تعطي من نجوم؟</p>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setStars(n)}
                      onMouseEnter={() => setHoverStars(n)}
                      onMouseLeave={() => setHoverStars(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-10 h-10 transition ${(hoverStars || stars) >= n ? 'fill-amber-400 text-amber-400' : 'text-fon-gold-dark'}`}
                      />
                    </button>
                  ))}
                </div>
                {stars > 0 && (
                  <p className="text-xs text-fon-gold mt-2">
                    {stars === 1 && 'سيء جداً'}
                    {stars === 2 && 'سيء'}
                    {stars === 3 && 'مقبول'}
                    {stars === 4 && 'جيد'}
                    {stars === 5 && 'ممتاز!'}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-fon-gold-dark mb-2 block">تعليق (اختياري)</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="اكتب تعليقك عن الكابتن..."
                  rows={3}
                  className="fon-input w-full px-4 py-2.5 text-sm resize-none"
                />
              </div>

              <button
                onClick={submitRating}
                disabled={stars === 0 || submitting}
                className="fon-btn-gold w-full py-3.5 text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                إرسال التقييم
              </button>
            </div>

            <button
              onClick={() => router.push('/app/customer')}
              className="w-full mt-3 py-2.5 text-xs font-semibold text-fon-gold-dark hover:text-fon-gold transition flex items-center justify-center gap-1.5"
            >
              تخطي التقييم
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
