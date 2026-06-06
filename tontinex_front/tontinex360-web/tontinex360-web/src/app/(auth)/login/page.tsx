'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { membersApi } from '@/lib/api/members';
import { getLandingPath } from '@/lib/utils/permissions';
import { useAuthStore } from '@/lib/stores/auth-store';
import { PhoneInput } from '@/components/ui/phone-input';
import { BrandLogo } from '@/components/ui/brand-logo';
import { DEFAULT_COUNTRY } from '@/lib/utils/countries';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const setCurrentMembership = useAuthStore(s => s.setCurrentMembership);

  const [telephone, setTelephone] = useState(DEFAULT_COUNTRY.dial);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleaned = telephone.replace(/[\s-]/g, '');
    if (!cleaned.startsWith('+') || cleaned.length < 7) {
      setError('Numéro de téléphone invalide.');
      return;
    }

    setLoading(true);
    try {
      const res = await login({ telephone: cleaned, password });

      let target = '/dashboard';
      const associations = useAuthStore.getState().associations;
      if (associations.length > 0) {
        try {
          const list = await membersApi.list();
          const norm = (s: string | null | undefined) =>
            (s || '').replace(/[\s-]/g, '').toLowerCase();
          const myTel = norm(res.user.telephone);
          const lite = list.find(m => norm(m.user_telephone) === myTel);
          if (lite) {
            const full = await membersApi.get(lite.id);
            setCurrentMembership(full);
            target = getLandingPath(full);
          }
        } catch {
          // fallback
        }
      }
      router.push(target);
    } catch (err: any) {
      // Si l'utilisateur n'est pas activé (OTP non validé), on le redirige vers la vérification.
      const status = err.response?.status;
      const data = err.response?.data;
      const msg = (typeof data === 'string' ? data : data?.error || data?.detail || '') + '';

      const looksInactive =
        status === 400 || status === 401
        ? /inactif|not active|invalides|invalid|otp/i.test(msg)
        : false;

      if (looksInactive) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('otp_phone', cleaned);
        }
        router.push(`/verify-otp?phone=${encodeURIComponent(cleaned)}&next=/login`);
        return;
      }
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-lg">
      {/* Logo + titre brand */}
      <div className="flex flex-col items-center mb-7">
        <BrandLogo variant="full" size={56} priority className="mb-3" />
        <h1 className="text-2xl font-bold text-[#43793F]">Bienvenue !</h1>
        <p className="text-sm text-gray-500 mt-1">Entrez vos identifiants pour vous connecter</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4 flex items-start gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Téléphone</label>
          <PhoneInput value={telephone} onChange={setTelephone} required />
          <p className="text-xs text-gray-400 mt-1">📱 Format international +237 6XX XXX XXX</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mot de passe</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F] focus:border-transparent transition" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-[#43793F] to-[#43793F] text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all disabled:opacity-50 mt-2">
          {loading ? 'Connexion…' : 'Se connecter →'}
        </button>
      </form>

      <div className="flex items-center my-5">
        <div className="flex-1 h-px bg-gray-100"></div>
        <span className="px-3 text-xs text-gray-400 uppercase tracking-wide font-medium">ou</span>
        <div className="flex-1 h-px bg-gray-100"></div>
      </div>

      <p className="text-center text-sm text-gray-600">
        Pas encore de compte ?{' '}
        <Link href="/register" className="text-[#43793F] font-bold hover:underline">Créer un compte</Link>
      </p>

      <div className="mt-6 p-4 bg-[#F1F8E9] border border-[#C8E6C9] rounded-xl">
        <p className="text-xs text-[#43793F] font-semibold">🛡️ Architecture non-custodial</p>
        <p className="text-xs text-gray-600 mt-1">
          TontineX360 ne détient aucun fonds. Toutes les cotisations restent dans le compte
          bancaire de votre tontine.
        </p>
      </div>
    </div>
  );
}

function extractError(err: any): string {
  if (!err) return 'Erreur inconnue.';
  if (err.message === 'Network Error') {
    return "Impossible de joindre le serveur. Vérifiez que le backend tourne sur l'URL configurée (NEXT_PUBLIC_API_URL).";
  }
  const data = err.response?.data;
  if (!data) return err.message || 'Identifiants invalides.';
  if (typeof data === 'string') return data;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
    return data.non_field_errors.join(' ');
  }
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    parts.push(`${k} : ${Array.isArray(v) ? v.join(' ') : String(v)}`);
  }
  return parts.length ? parts.join(' ; ') : 'Identifiants invalides.';
}
