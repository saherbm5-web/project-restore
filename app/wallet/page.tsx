'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Wallet as WalletIcon,
  ArrowLeft,
  Plus,
  CheckCircle2,
  Clock,
  Car,
  Banknote,
  Loader2,
  Smartphone,
  Building2,
  Copy,
  CreditCard,
  Gift,
  Check,
} from 'lucide-react';
import { supabase, type WalletTransaction, type WalletBonusCode } from '@/lib/supabase';
import { getOrCreateWallet } from '@/lib/wallet';

interface PaymentMethod {
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

const typeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  iban: Building2,
  cliq: Smartphone,
  zain_cash: Banknote,
};

const typeGradient: Record<string, string> = {
  iban: 'from-blue-500/20 to-blue-700/20 border-blue-400/40',
  cliq: 'from-emerald-500/20 to-emerald-700/20 border-emerald-400/40',
  zain_cash: 'from-amber-500/20 to-amber-700/20 border-amber-400/40',
};

const PRESET_AMOUNTS = [5, 10, 20, 50];

export default function WalletPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [bonusInput, setBonusInput] = useState('');
  const [appliedBonus, setAppliedBonus] = useState<WalletBonusCode | null>(null);
  const [bonusChecking, setBonusChecking] = useState(false);
  const [fallbackSettings, setFallbackSettings] = useState<Record<string, string>>({});

  const loadPaymentMethods = useCallback(async () => {
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .neq('code', 'wallet')
      .order('sort_order', { ascending: true });
    if (data) setPaymentMethods(data as PaymentMethod[]);

    const { data: ps } = await supabase
      .from('payment_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (ps) {
      const r = ps as Record<string, string | null>;
      setFallbackSettings({
        cliq: r.cliq_alias || r.click_number || '',
        zain_cash: r.wallet_number || '',
        iban: r.bank_iban || r.iban || '',
      });
    }
  }, []);

  const loadWalletData = useCallback(async (phoneNum: string) => {
    setLoading(true);
    try {
      const wallet = await getOrCreateWallet(phoneNum);
      setBalance(wallet.balance ?? 0);

      const { data: txns } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('phone', phoneNum)
        .order('created_at', { ascending: false })
        .limit(20);
      setTransactions((txns ?? []) as WalletTransaction[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedPhone =
      localStorage.getItem('fon_customer_phone') ||
      localStorage.getItem('fon_taxi_phone');
    const savedDriver = localStorage.getItem('fon_driver');
    let phoneNum = savedPhone;
    if (!phoneNum && savedDriver) {
      try {
        const d = JSON.parse(savedDriver);
        if (d.phone) phoneNum = d.phone;
      } catch { /* ignore */ }
    }
    if (phoneNum) {
      setPhone(phoneNum);
      loadWalletData(phoneNum);
    }
    loadPaymentMethods();
  }, [loadWalletData, loadPaymentMethods]);

  useEffect(() => {
    if (!phone) return;
    const channel = supabase
      .channel(`wallet-${phone}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: `phone=eq.${phone}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setBalance((payload.new as { balance: number }).balance);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: `phone=eq.${phone}` },
        (payload) => {
          setTransactions((prev) => [payload.new as WalletTransaction, ...prev]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [phone]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`تم نسخ ${label}`);
    } catch {
      toast.error('ما زبط النسخ');
    }
  };

  const handleApplyBonus = async () => {
    if (!bonusInput.trim()) return;
    setBonusChecking(true);
    try {
      const { data } = await supabase
        .from('wallet_bonus_codes')
        .select('*')
        .eq('code', bonusInput.trim().toUpperCase())
        .maybeSingle();
      if (!data || !(data as WalletBonusCode).is_active) {
        toast.error('كود غير صحيح');
        setAppliedBonus(null);
        return;
      }
      const bonus = data as WalletBonusCode;
      if (bonus.expires_at && new Date(bonus.expires_at) < new Date()) {
        toast.error('الكود منتهي الصلاحية');
        setAppliedBonus(null);
        return;
      }
      if (bonus.used_count >= bonus.max_uses) {
        toast.error('تم استخدام الكود الحد الاقصى');
        setAppliedBonus(null);
        return;
      }
      setAppliedBonus(bonus);
      toast.success(`تم تطبيق بونص ${bonus.bonus_type === 'percent' ? bonus.bonus_value + '%' : bonus.bonus_value + ' د.أ'}`);
    } catch {
      toast.error('ما زبط التحقق من الكود');
    } finally {
      setBonusChecking(false);
    }
  };

  const handleConfirmTopup = async () => {
    const finalAmount = amount === 'custom' ? customAmount : amount;
    const parsedAmount = parseFloat(finalAmount);
    if (!selectedMethod) {
      toast.error('اختر طريقة الدفع');
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('اكتب مبلغ صحيح');
      return;
    }
    if (!phone) {
      toast.error('ما في رقم مسجل');
      return;
    }

    if (appliedBonus && appliedBonus.min_recharge > 0 && parsedAmount < appliedBonus.min_recharge) {
      toast.error(`الحد الادنى للشحن لهذا الكود: ${appliedBonus.min_recharge} د.أ`);
      return;
    }

    const bonusAmount = appliedBonus
      ? appliedBonus.bonus_type === 'percent'
        ? (parsedAmount * appliedBonus.bonus_value) / 100
        : appliedBonus.bonus_value
      : 0;
    const totalCredit = parsedAmount + bonusAmount;

    setSubmitting(true);
    try {
      const { error: txError } = await supabase
        .from('wallet_transactions')
        .insert({
          phone,
          amount: totalCredit,
          type: 'topup',
          method: selectedMethod.code,
          status: 'pending',
          user_role: localStorage.getItem('fon_role') || 'customer',
        });
      if (txError) {
        toast.error(`ما زبط: ${txError.message}`);
        return;
      }

      if (appliedBonus) {
        await supabase
          .from('wallet_bonus_codes')
          .update({ used_count: appliedBonus.used_count + 1 })
          .eq('id', appliedBonus.id);
        setAppliedBonus(null);
        setBonusInput('');
      }

      setDone(true);
      toast.success('تم إرسال طلب الشحن');
    } catch {
      toast.error('ما زبط الشحن');
    } finally {
      setSubmitting(false);
    }
  };

  const txnLabel = (type: string) => {
    switch (type) {
      case 'topup': return { text: 'شحن المحفظة', icon: Plus, color: 'text-green-400' };
      case 'ride_payment': return { text: 'دفع رحلة', icon: Car, color: 'text-red-400' };
      case 'admin_adjust': return { text: 'تعديل الإدارة', icon: Banknote, color: 'text-blue-400' };
      default: return { text: type, icon: Banknote, color: 'text-fon-gold-dark' };
    }
  };

  if (!phone) {
    return (
      <div className="min-h-screen fon-gradient-dark flex items-center justify-center px-4">
        <div className="text-center">
          <WalletIcon className="w-12 h-12 text-fon-gold-dark mx-auto mb-3" />
          <p className="text-sm text-fon-gold-dark">سجل دخولك الأول لعرض محفظتك</p>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="w-full mt-6 bg-gradient-to-r from-[#C9A86A] to-[#E8D5A3] text-[#0A1931] py-3.5 rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-all"
          >
            ارجع للصفحة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen fon-gradient-dark overflow-x-hidden max-w-full">
      <header className="sticky top-0 z-40 bg-fon-black/90 backdrop-blur-md border-b border-fon-gold/20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-fon-gold-dark hover:text-fon-gold transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">رجوع</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 fon-gradient-gold rounded-lg flex items-center justify-center">
              <WalletIcon className="w-5 h-5 text-fon-black" />
            </div>
            <h1 className="text-lg font-bold fon-text-gradient-gold">محفظتي</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-fon-gold animate-spin" />
          </div>
        ) : done ? (
          <div className="animate-fade-in space-y-5">
            {/* Success screen */}
            <div className="fon-card p-8 text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-green-400/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold fon-text-gradient-gold mb-2">تم إرسال طلب الشحن</h2>
                <p className="text-sm text-fon-gold-light leading-relaxed">
                  حوّل المبلغ على الرقم الظاهر في طريقة الدفع،
                  <br />
                  وسيتم شحن محفظتك خلال دقائق بعد تأكيد الإدارة
                </p>
              </div>
              <button
                onClick={() => { setDone(false); setSelectedMethod(null); setAmount(''); setCustomAmount(''); }}
                className="fon-btn-gold w-full py-3.5 text-base font-bold"
              >
                تمام
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 animate-fade-in">
            {/* Balance Card */}
            <div className="fon-card p-6 text-center">
              <p className="text-sm text-fon-gold-dark mb-2">رصيدك الحالي</p>
              <p className="text-5xl font-bold fon-text-gradient-gold mb-1 tabular-nums">
                {balance.toFixed(2)}
              </p>
              <p className="text-xs text-fon-gold-dark">دينار أردني</p>
            </div>

            {/* Top-up section */}
            <div className="fon-card p-5 space-y-5">
              <h3 className="text-sm font-semibold text-fon-gold">اشحن المحفظة</h3>

              {/* Step 1: Amount selection */}
              <div>
                <label className="text-xs text-fon-gold-dark mb-2 block">1. اختر المبلغ (د.أ)</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => { setAmount(String(amt)); setCustomAmount(''); }}
                      className={`py-3 text-lg font-bold rounded-xl border-2 transition ${
                        amount === String(amt)
                          ? 'border-fon-gold bg-fon-gold/10 text-fon-gold-light'
                          : 'border-fon-gold/20 text-fon-gold-dark hover:border-fon-gold/40'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setAmount('custom'); }}
                    placeholder="مبلغ مخصص"
                    className="fon-input w-full px-4 py-3 text-base font-bold text-center tabular-nums"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Bonus code input */}
              <div className="rounded-xl border border-fon-gold/30 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 p-4 space-y-3">
                <p className="text-xs font-bold text-fon-gold flex items-center gap-1.5">
                  <Gift className="w-4 h-4" />
                  ادخل كود البونص (اختياري)
                </p>
                <div className="flex gap-2">
                  <input
                    value={bonusInput}
                    onChange={(e) => setBonusInput(e.target.value.toUpperCase())}
                    placeholder="BONUS20"
                    className="fon-input flex-1 px-3 py-2 text-sm font-mono"
                    dir="ltr"
                  />
                  <button
                    onClick={handleApplyBonus}
                    disabled={bonusChecking || !bonusInput.trim()}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-fon-gold text-fon-black disabled:opacity-50 transition hover:scale-[1.02]"
                  >
                    {bonusChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تطبيق'}
                  </button>
                </div>
                {appliedBonus && (() => {
                  const amt = parseFloat(amount === 'custom' ? customAmount : amount) || 0;
                  const bonusAmt = appliedBonus.bonus_type === 'percent'
                    ? (amt * appliedBonus.bonus_value) / 100
                    : appliedBonus.bonus_value;
                  const total = amt + bonusAmt;
                  return (
                    <div className="bg-black/20 rounded-lg p-3 text-xs space-y-1.5">
                      <div className="flex justify-between text-fon-gold-dark">
                        <span>مبلغ الشحن:</span>
                        <span className="text-fon-gold-light font-bold">{amt.toFixed(2)} د.أ</span>
                      </div>
                      <div className="flex justify-between text-green-400 font-bold">
                        <span>بونص {appliedBonus.bonus_type === 'percent' ? `${appliedBonus.bonus_value}%` : `${appliedBonus.bonus_value} د.أ`} ({appliedBonus.code})</span>
                        <span>+{bonusAmt.toFixed(2)} د.أ</span>
                      </div>
                      {appliedBonus.min_recharge > 0 && amt < appliedBonus.min_recharge && (
                        <p className="text-red-400 text-[10px]">الحد الادنى للشحن: {appliedBonus.min_recharge} د.أ</p>
                      )}
                      <div className="flex justify-between font-bold text-sm border-t border-fon-gold/20 pt-1.5">
                        <span className="text-fon-gold-light">الرصيد النهائي:</span>
                        <span className="text-fon-gold">{total.toFixed(2)} د.أ</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Step 2: Payment method cards — large with visible numbers */}
              <div>
                <label className="text-xs text-fon-gold-dark mb-2 block">2. اختر طريقة الدفع</label>
                {paymentMethods.length === 0 ? (
                  <p className="text-xs text-center text-fon-gold-dark py-4">
                    ما في طرق دفع مفعلة حالياً - تواصل مع الإدارة
                  </p>
                ) : (
                  <div className="space-y-3">
                    {paymentMethods.map((method) => {
                      const Icon = typeIcon[method.type] ?? CreditCard;
                      const isSelected = selectedMethod?.id === method.id;
                      const gradient = typeGradient[method.type] ?? 'from-fon-gold/20 to-fon-gold/5 border-fon-gold/40';
                      return (
                        <button
                          key={method.id}
                          onClick={() => setSelectedMethod(method)}
                          className={`w-full text-right rounded-2xl border-2 p-4 transition-all bg-gradient-to-br ${gradient} ${
                            isSelected
                              ? 'ring-2 ring-green-400 shadow-lg scale-[1.01]'
                              : 'opacity-80 hover:opacity-100'
                          }`}
                        >
                          {/* Header row: icon + name + checkmark */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white">{method.name}</p>
                                {method.bank_name && (
                                  <p className="text-[10px] text-white/60">{method.bank_name}</p>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="w-7 h-7 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0">
                                <Check className="w-4 h-4 text-white" strokeWidth={3} />
                              </div>
                            )}
                          </div>

                          {/* Account number — large bold (with fallback to payment_settings) */}
                          {(() => {
                            const displayNumber = method.account_number || fallbackSettings[method.type] || '';
                            if (!displayNumber) return null;
                            return (
                              <div className="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2.5">
                                <p className="text-lg font-bold text-white break-all flex-1 tabular-nums" dir="ltr">
                                  {displayNumber}
                                </p>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(displayNumber, 'الرقم'); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); copyToClipboard(displayNumber, 'الرقم'); } }}
                                  className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition cursor-pointer"
                                  title="نسخ الرقم"
                                >
                                  <Copy className="w-4 h-4 text-white" />
                                </span>
                              </div>
                            );
                          })()}

                          {/* Account name */}
                          {(method.account_name || (fallbackSettings[method.type] && 'S.B.M')) && (
                            <p className="text-xs text-white/70 mt-2">
                              الاسم: <span className="font-semibold text-white">{method.account_name || 'S.B.M'}</span>
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 3: Confirm */}
              <button
                onClick={handleConfirmTopup}
                disabled={submitting || !selectedMethod || (!amount || (amount === 'custom' && (!customAmount || parseFloat(customAmount) <= 0)))}
                className="fon-btn-gold w-full py-4 text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                تأكيد الشحن
              </button>

              {/* Selected payment instructions */}
              {selectedMethod && (() => {
                const selectedNumber = selectedMethod.account_number || fallbackSettings[selectedMethod.type] || '';
                const selectedName = selectedMethod.account_name || (selectedNumber ? 'S.B.M' : '');
                return (
                  <div className="rounded-xl bg-[#EAF3FF] border border-blue-200 p-4 mt-4 text-slate-800">
                    <p className="font-bold text-sm mb-2">{selectedMethod.name}</p>
                    {selectedNumber ? (
                      <div className="bg-white rounded-lg flex justify-between items-center gap-3 px-3 py-2">
                        <span className="font-mono font-bold text-[13px] break-all" dir="ltr">{selectedNumber}</span>
                        <button
                          onClick={() => copyToClipboard(selectedNumber, 'الرقم')}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg flex-shrink-0"
                          aria-label="نسخ رقم الدفع"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <p className="bg-white rounded-lg px-3 py-2 text-xs text-red-600">رقم الدفع غير متوفر حالياً</p>
                    )}
                    {selectedName && <p className="text-xs mt-2 text-gray-500">الاسم: {selectedName}</p>}
                    <p className="text-xs mt-2 text-gray-500">حوّل المبلغ ثم انتظر تأكيد الإدارة</p>
                  </div>
                );
              })()}
            </div>

            {/* Transaction History Toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="fon-card w-full p-4 flex items-center gap-3 hover:bg-fon-gold/5 transition text-right"
            >
              <Clock className="w-5 h-5 text-fon-gold" />
              <span className="text-sm font-semibold text-fon-gold-light flex-1">سجل الحركات</span>
              <span className="text-xs text-fon-gold-dark">{transactions.length}</span>
            </button>

            {/* Transaction History */}
            {showHistory && (
              <div className="space-y-2 animate-slide-up">
                {transactions.length === 0 ? (
                  <div className="fon-card p-6 text-center">
                    <p className="text-sm text-fon-gold-dark">ما في حركات بعد</p>
                  </div>
                ) : (
                  transactions.map((txn) => {
                    const label = txnLabel(txn.type);
                    const Icon = label.icon;
                    const txnStatus = (txn as WalletTransaction & { status?: string }).status;
                    return (
                      <div key={txn.id} className="fon-card p-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-fon-gold/10 flex items-center justify-center shrink-0">
                          <Icon className={`w-4 h-4 ${label.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-fon-gold-light">{label.text}</p>
                          <p className="text-[10px] text-fon-gold-dark">
                            {new Date(txn.created_at).toLocaleDateString('ar-JO')}{' '}
                            {new Date(txn.created_at).toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {txnStatus === 'pending' && (
                            <span className="text-[10px] text-fon-gold">بانتظار تأكيد الأدمن</span>
                          )}
                        </div>
                        <span className={`text-sm font-bold ${txn.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {txn.amount > 0 ? '+' : ''}{txn.amount.toFixed(2)} د.أ
                        </span>
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
