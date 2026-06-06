'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { PhoneInput } from '@/components/ui/phone-input';
import { BrandLogo } from '@/components/ui/brand-logo';
import { DEFAULT_COUNTRY } from '@/lib/utils/countries';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    telephone: DEFAULT_COUNTRY.dial,
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    password_confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleaned = form.telephone.replace(/[\s-]/g, '');
    if (!cleaned.startsWith('+') || cleaned.length < 7) {
      setError('Numéro de téléphone invalide.');
      return;
    }
    if (form.password !== form.password_confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload: any = { ...form, telephone: cleaned };
      if (!payload.email || payload.email.trim() === '') delete payload.email;
      await register(payload);

      // L'utilisateur n'est pas encore actif (is_active=False).
      // On purge les tokens, on garde le téléphone en sessionStorage
      // et on redirige vers /verify-otp.
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        sessionStorage.setItem('otp_phone', cleaned);
      }
      router.push(`/verify-otp?phone=${encodeURIComponent(cleaned)}&next=/login`);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-7 shadow-lg">
      <div className="flex flex-col items-center mb-6">
        <BrandLogo variant="full" size={48} priority className="mb-3" />
        <h1 className="text-2xl font-bold text-[#43793F]">Créer un compte</h1>
        <p className="text-sm text-gray-500 mt-1">Rejoignez votre tontine en quelques secondes</p>
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
            <input type="text" value={form.first_name}
              onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              placeholder="Jean" required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input type="text" value={form.last_name}
              onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
              placeholder="Kamga" required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
          <PhoneInput
            value={form.telephone}
            onChange={v => setForm(f => ({ ...f, telephone: v }))}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email (optionnel)</label>
          <input type="email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="jean@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
          <input type="password" value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required minLength={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
          <input type="password" value={form.password_confirm}
            onChange={e => setForm(f => ({ ...f, password_confirm: e.target.value }))}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]" />
        </div>

        <button type="submit" disabled={loading}
          className="w-full py-2.5 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] transition disabled:opacity-50">
          {loading ? 'Inscription...' : "S'inscrire"}
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-4">
        Déjà un compte ? <Link href="/login" className="text-[#43793F] font-medium">Se connecter</Link>
      </p>
    </div>
  );
}

function extractError(err: any): string {
  if (!err) return 'Erreur inconnue.';
  if (err.message === 'Network Error') {
    return "Impossible de joindre le serveur. Vérifiez que le backend tourne.";
  }
  const data = err.response?.data;
  if (!data) return err.message || "Erreur lors de l'inscription.";
  if (typeof data === 'string') return data;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    parts.push(`${k} : ${Array.isArray(v) ? v.join(' ') : String(v)}`);
  }
  return parts.length ? parts.join(' ; ') : "Erreur lors de l'inscription.";
}
