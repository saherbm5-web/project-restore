'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  X,
  Plus,
  Loader2,
  CheckCircle2,
  Banknote,
  Building2,
  Copy,
  AlertCircle,
  Smartphone,
  CreditCard,
  Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TopupModalProps {
  open: boolean;
  onClose: () => void;
  phone: string;
  role: 'customer' | 'driver';
  currentBalance: number;
  onBalanceChange: (balance: number) => void;
  message?: string;
}

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

const PRESET_AMOUNTS = [10, 20, 50];

export default function TopupModal({ open, onClose, phone, role, currentBalance, message }: TopupModalProps) {
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount('');
      setCustomAmount('');
      setDone(false);
      setSelectedMethod(null);
      fetchPaymentMethods();
    }
  }, [open]);

  const fetchPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .neq('code', 'wallet')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      if (data) setPaymentMethods(data as PaymentMethod[]);
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`تم نسخ ${label}`);
    } catch {
      toast.error('ما زبط النسخ — انسخه يدوياً');
    }
  };

  const handleSubmit = async () => {
    const finalAmount = amount === 'custom' ? customAmount : amount;
    const amt = parseFloat(finalAmount);
    if (!amt || amt <= 0) {
      toast.error('اكتب مبلغ صحيح');
      return;
    }
    if (!selectedMethod) {
      toast.error('اختر طريقة الدفع');
      return;
    }
    setSubmitting(true);
    try {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      const { error } = await supabase.from('wallet_transactions').insert({
        wallet_id: wallet?.id ?? null,
        phone,
        amount: amt,
        type: 'topup',
        status: 'pending',
        user_role: role,
        method: selectedMethod.code,
      });

      if (error) throw error;

      setDone(true);
      toast.success('تم إرسال طلب الشحن');
    } catch {
      toast.error('ما زبط إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A1931]/85 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="fon-card w-full max-w-md p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold fon-text-gradient-gold flex items-center gap-2">
            <Plus className="w-5 h-5" />
            شحن المحفظة
          </h2>
          <button onClick={onClose} className="text-fon-gold-dark hover:text-fon-gold transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-green-400/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-fon-gold-light">تم إرسال طلبك</p>
              <p className="text-xs text-fon-gold-dark mt-1 leading-relaxed">
                حوّل المبلغ على الرقم الظاهر في طريقة الدفع،
                <br />
                وسيتم شحن محفظتك خلال دقائق بعد تأكيد الإدارة
              </p>
            </div>
            <button onClick={onClose} className="fon-btn-gold w-full py-3 text-sm font-semibold">
              تمام
            </button>
          </div>
        ) : (
          <>
            {message && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300">{message}</p>
              </div>
            )}

            <div className="fon-card p-3 flex items-center justify-between">
              <span className="text-xs text-fon-gold-dark">رصيدك الحالي</span>
              <span className="text-sm font-bold text-fon-gold-light">{currentBalance.toFixed(2)} د.أ</span>
            </div>

            {/* Step 1: Amount */}
            <div>
              <label className="text-xs text-fon-gold-dark mb-2 block">1. اختر المبلغ (د.أ)</label>
              <div className="grid grid-cols-3 gap-2">
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
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setAmount('custom'); }}
                  placeholder="مبلغ مخصص"
                  className="fon-input w-full px-4 py-3 text-base font-bold text-center"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Step 2: Payment methods — large cards with visible numbers */}
            {paymentMethods.length === 0 ? (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-center">
                <p className="text-xs text-red-300">لا توجد طرق دفع مفعلة حالياً. تواصل مع الإدارة.</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs text-fon-gold-dark mb-2 block">2. اختر طريقة الدفع</label>
                  <div className="space-y-2.5">
                    {paymentMethods.map((method) => {
                      const Icon = typeIcon[method.type] ?? CreditCard;
                      const isSelected = selectedMethod?.id === method.id;
                      const gradient = typeGradient[method.type] ?? 'from-fon-gold/20 to-fon-gold/5 border-fon-gold/40';
                      return (
                        <button
                          key={method.id}
                          onClick={() => setSelectedMethod(method)}
                          className={`w-full text-right rounded-2xl border-2 p-3.5 transition-all bg-gradient-to-br ${gradient} ${
                            isSelected
                              ? 'ring-2 ring-green-400 shadow-lg scale-[1.01]'
                              : 'opacity-80 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                                <Icon className="w-4.5 h-4.5 text-white" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white">{method.name}</p>
                                {method.bank_name && (
                                  <p className="text-[10px] text-white/60">{method.bank_name}</p>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0">
                                <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                              </div>
                            )}
                          </div>

                          {method.account_number && (
                            <div className="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2">
                              <p className="text-base font-bold text-white break-all flex-1 tabular-nums" dir="ltr">
                                {method.account_number}
                              </p>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); copyToClipboard(method.account_number!, 'الرقم'); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); copyToClipboard(method.account_number!, 'الرقم'); } }}
                                className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition cursor-pointer"
                                title="نسخ الرقم"
                              >
                                <Copy className="w-3.5 h-3.5 text-white" />
                              </span>
                            </div>
                          )}

                          {method.account_name && (
                            <p className="text-xs text-white/70 mt-1.5">
                              الاسم: <span className="font-semibold text-white">{method.account_name}</span>
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3: Confirm */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedMethod || (!amount || (amount === 'custom' && (!customAmount || parseFloat(customAmount) <= 0)))}
                  className="fon-btn-gold w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Banknote className="w-5 h-5" />
                  )}
                  تأكيد طلب الشحن
                </button>

                {selectedMethod && (
                  <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-green-300 leading-relaxed">
                      حوّل المبلغ على الرقم الظاهر وسيتم شحن محفظتك خلال دقائق بعد تأكيد الإدارة
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
