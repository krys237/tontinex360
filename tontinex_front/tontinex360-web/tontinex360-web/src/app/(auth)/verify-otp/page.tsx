'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api/auth';
import { ShieldCheck, Loader2, Check, MessageCircle, Phone, Mail } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';

const OTP_LENGTH = 6;

function VerifyOtpInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneFromUrl = searchParams.get('phone') || '';
  const next = searchParams.get('next') || '/login';

  const [phone, setPhone] = useState(phoneFromUrl);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [emailOverride, setEmailOverride] = useState('');
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Pré-remplit le phone depuis sessionStorage si pas en URL
  useEffect(() => {
    if (!phone) {
      const saved = typeof window !== 'undefined' ? sessionStorage.getItem('otp_phone') : null;
      if (saved) setPhone(saved);
    }
    inputsRef.current[0]?.focus();
  }, []);

  // Cooldown du bouton "Renvoyer"
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleDigitChange = (i: number, raw: string) => {
    const val = raw.replace(/\D/g, '');
    if (!val) {
      const next = [...digits];
      next[i] = '';
      setDigits(next);
      return;
    }
    // Coller plusieurs chiffres
    if (val.length > 1) {
      const arr = val.slice(0, OTP_LENGTH).split('');
      const next = [...digits];
      arr.forEach((d, idx) => { if (i + idx < OTP_LENGTH) next[i + idx] = d; });
      setDigits(next);
      const lastIdx = Math.min(i + arr.length, OTP_LENGTH - 1);
      inputsRef.current[lastIdx]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = val[0];
    setDigits(next);
    if (i < OTP_LENGTH - 1) inputsRef.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const otp = digits.join('');
    if (otp.length !== OTP_LENGTH) {
      setError(`Le code doit contenir ${OTP_LENGTH} chiffres.`);
      return;
    }
    if (!phone) {
      setError('Numéro de téléphone manquant.');
      return;
    }
    setLoading(true);
    try {
      await authApi.validateOtp({ telephone: phone, otp });
      setSuccess(true);
      // Nettoyage du sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('otp_phone');
      }
      setTimeout(() => router.push(next), 1500);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!phone) {
      setError('Numéro de téléphone manquant.');
      return;
    }
    if (channel === 'email' && !emailOverride && !/@/.test(phone)) {
      // Pas d'email saisi : on laisse le backend utiliser l'email du compte
      // (sentOtp gère le fallback). Si aucun email lié, le backend renverra l'erreur.
    }
    setResending(true);
    setError('');
    setInfo('');
    try {
      await authApi.resendOtp(phone, {
        channel,
        ...(emailOverride ? { email: emailOverride } : {}),
      });
      setResendCooldown(60);
      const label =
        channel === 'email' ? 'email' : channel === 'sms' ? 'SMS' : 'WhatsApp';
      setInfo(`Nouveau code envoyé par ${label}.`);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <Check size={24} className="text-emerald-600" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Compte validé</h1>
        <p className="text-sm text-gray-500">Redirection en cours…</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-7 shadow-lg">
      <div className="flex flex-col items-center mb-5">
        <BrandLogo variant="full" size={48} priority className="mb-3" />
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-[#43793F]" />
          <h1 className="text-2xl font-bold text-[#43793F]">Vérification du compte</h1>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Un code à {OTP_LENGTH} chiffres a été envoyé au numéro
        {phone ? <strong className="text-gray-900"> {phone}</strong> : ''}.
      </p>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}
      {info && !error && (
        <div className="bg-emerald-50 text-emerald-700 text-sm p-3 rounded-lg mb-4">
          {info}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!phoneFromUrl && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+237..."
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Code de vérification</label>
          <div className="flex items-center justify-center gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-11 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#43793F] focus:border-transparent"
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Valider
        </button>
      </form>

      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center mb-2">
          Vous n&apos;avez pas reçu le code ? Choisissez un canal :
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <ChannelButton
            icon={MessageCircle}
            label="WhatsApp"
            active={channel === 'whatsapp'}
            onClick={() => setChannel('whatsapp')}
          />
          <ChannelButton
            icon={Phone}
            label="SMS"
            active={channel === 'sms'}
            onClick={() => setChannel('sms')}
          />
          <ChannelButton
            icon={Mail}
            label="Email"
            active={channel === 'email'}
            onClick={() => setChannel('email')}
          />
        </div>

        {channel === 'email' && (
          <input
            type="email"
            value={emailOverride}
            onChange={(e) => setEmailOverride(e.target.value)}
            placeholder="Email (laisser vide pour utiliser celui du compte)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
          />
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={resending || resendCooldown > 0 || !phone}
          className="w-full py-2 text-sm text-[#43793F] font-medium border border-[#43793F] rounded-lg disabled:opacity-50 disabled:text-gray-400 disabled:border-gray-300 hover:bg-[#F1F8E8] inline-flex items-center justify-center gap-2"
        >
          {resending && <Loader2 size={14} className="animate-spin" />}
          {resending
            ? 'Envoi...'
            : resendCooldown > 0
              ? `Renvoyer dans ${resendCooldown}s`
              : `Renvoyer par ${channel === 'email' ? 'Email' : channel === 'sms' ? 'SMS' : 'WhatsApp'}`}
        </button>
      </div>

      <p className="text-center text-sm text-gray-500 mt-5 pt-4 border-t border-gray-100">
        <Link href="/login" className="text-[#43793F] font-medium">Retour à la connexion</Link>
      </p>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="bg-white rounded-xl border border-gray-200 p-8 text-center"><Loader2 size={20} className="animate-spin text-gray-400 mx-auto" /></div>}>
      <VerifyOtpInner />
    </Suspense>
  );
}

function ChannelButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg border text-xs font-medium transition ${
        active
          ? 'border-[#43793F] bg-[#F1F8E8] text-[#43793F]'
          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function extractError(err: any): string {
  if (!err) return 'Erreur inconnue.';
  if (err.message === 'Network Error') return 'Impossible de joindre le serveur.';
  const data = err.response?.data;
  if (!data) return 'Code invalide.';
  if (typeof data === 'string') return data;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  return 'Code invalide.';
}
