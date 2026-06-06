"use client";
import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { invitationsApi } from "@/lib/api/invitations";
import { Loader2, MailCheck, AlertTriangle } from "lucide-react";

type Mode = "loading" | "register" | "login" | "expired" | "invalid";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [error, setError] = useState("");

  const checkQuery = useQuery({
    queryKey: ["invitation-check", token],
    queryFn: () => invitationsApi.check(token),
    retry: false,
  });
    
  useEffect(() => {
    if (checkQuery.isLoading) return;
    if (checkQuery.isError) {
      setMode("invalid");
      return;
    }
    const data: any = checkQuery.data;
    if (!data) {
      setMode("invalid");
      return;
    }
    if (data.status && data.status !== "pending") {
      setMode("expired");
      return;
    }
    setMode(data.user_exists ? "login" : "register");
  }, [checkQuery.data, checkQuery.isLoading, checkQuery.isError]);

  if (mode === "loading") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Loader2 size={24} className="text-gray-400 mx-auto mb-3 animate-spin" />
        <p className="text-sm text-gray-500">Vérification de l&apos;invitation…</p>
      </div>
    );
  }

  if (mode === "invalid" || mode === "expired") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <AlertTriangle size={28} className="text-red-500 mx-auto mb-3" />
        <h1 className="text-lg font-semibold mb-1">Invitation invalide</h1>
        <p className="text-sm text-gray-500">
          {mode === "expired"
            ? "Cette invitation est expirée ou a déjà été utilisée."
            : "Le lien d'invitation est introuvable ou incorrect."}
        </p>
      </div>
    );
  }

  return mode === "register"
    ? <RegisterAcceptForm token={token} onError={setError} error={error} router={router} />
    : <LoginAcceptForm token={token} onError={setError} error={error} router={router} />;
}

function RegisterAcceptForm({ token, onError, error, router }: any) {
  const [form, setForm] = useState({
    telephone: "", first_name: "", last_name: "", email: "",
    password: "", password_confirm: "",
  });

  const mut = useMutation({
    mutationFn: () => invitationsApi.registerAccept({ token, ...form }),
    onSuccess: (data: any) => {
      if (data.tokens) {
        localStorage.setItem("access_token", data.tokens.access);
        localStorage.setItem("refresh_token", data.tokens.refresh);
      }
      router.push("/dashboard");
    },
    onError: (err: any) => {
      const data = err.response?.data;
      onError(typeof data === "string" ? data : data?.detail || "Erreur lors de l'inscription");
    },
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <MailCheck size={18} className="text-[#43793F]" />
        <h1 className="text-lg font-semibold">Accepter l&apos;invitation</h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">Créez votre compte pour rejoindre l&apos;association.</p>
      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
        <input type="tel" value={form.telephone}
          onChange={e => setForm({ ...form, telephone: e.target.value })}
          placeholder="Téléphone" required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input type="text" value={form.first_name}
            onChange={e => setForm({ ...form, first_name: e.target.value })}
            placeholder="Prénom" required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" value={form.last_name}
            onChange={e => setForm({ ...form, last_name: e.target.value })}
            placeholder="Nom" required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <input type="email" value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          placeholder="Email (optionnel)"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <input type="password" value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          placeholder="Mot de passe" required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <input type="password" value={form.password_confirm}
          onChange={e => setForm({ ...form, password_confirm: e.target.value })}
          placeholder="Confirmer le mot de passe" required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />

        <button type="submit" disabled={mut.isPending}
          className="w-full py-2.5 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] disabled:opacity-50">
          {mut.isPending ? "Inscription..." : "S'inscrire et rejoindre"}
        </button>
      </form>
    </div>
  );
}

function LoginAcceptForm({ token, onError, error, router }: any) {
  const [form, setForm] = useState({ telephone: "", password: "" });

  const mut = useMutation({
    mutationFn: () => invitationsApi.loginAccept({ token, ...form }),
    onSuccess: (data: any) => {
      if (data.tokens) {
        localStorage.setItem("access_token", data.tokens.access);
        localStorage.setItem("refresh_token", data.tokens.refresh);
      }
      router.push("/dashboard");
    },
    onError: (err: any) => {
      const data = err.response?.data;
      onError(typeof data === "string" ? data : data?.detail || "Identifiants invalides");
    },
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <MailCheck size={18} className="text-[#43793F]" />
        <h1 className="text-lg font-semibold">Accepter l&apos;invitation</h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">Connectez-vous pour rejoindre l&apos;association.</p>
      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
        <input type="tel" value={form.telephone}
          onChange={e => setForm({ ...form, telephone: e.target.value })}
          placeholder="Téléphone" required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <input type="password" value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          placeholder="Mot de passe" required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />

        <button type="submit" disabled={mut.isPending}
          className="w-full py-2.5 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] disabled:opacity-50">
          {mut.isPending ? "Connexion..." : "Se connecter et rejoindre"}
        </button>
      </form>
    </div>
  );
}
