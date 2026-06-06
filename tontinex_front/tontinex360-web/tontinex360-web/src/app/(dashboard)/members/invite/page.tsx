"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { invitationsApi } from "@/lib/api/invitations";
import { membersApi } from "@/lib/api/members";
import { ArrowLeft, Send, Loader2, Check } from "lucide-react";

export default function InviteMemberPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    phone: "",
    name: "",
    role: "",
    channel: "email" as "email" | "sms" | "whatsapp" | "link",
    message: "",
    auto_mark_fees_paid: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => membersApi.roles(),
  });

  const sendMut = useMutation({
    mutationFn: () => invitationsApi.send({
      ...form,
      ...(!form.role ? { role: undefined } : {}),
    }),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => router.push("/members"), 1500);
    },
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === "string" ? data : data?.detail || "Erreur d'envoi");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.email && !form.phone) {
      setError("Email ou téléphone requis.");
      return;
    }
    sendMut.mutate();
  };

  return (
    <>
      <Topbar title="Inviter un membre" />
      <Link href="/members" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour
      </Link>

      <div className="max-w-2xl">
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-lg mb-4 flex items-center gap-2">
            <Check size={14} /> Invitation envoyée. Redirection…
          </div>
        )}
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du destinataire</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Jean Kamga"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="jean@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="+237 6XX XXX XXX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Canal d&apos;envoi</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {(["email", "sms", "whatsapp", "link"] as const).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, channel: c })}
                    className={`px-3 py-2 text-sm rounded-lg border ${
                      form.channel === c
                        ? "border-[#43793F] bg-[#F1F8E8] text-[#43793F]"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {c === "email" ? "Email" : c === "sms" ? "SMS" : c === "whatsapp" ? "WhatsApp" : "Lien"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rôle initial (optionnel)</label>
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Aucun rôle (membre simple)</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message personnalisé</label>
              <textarea
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                rows={3}
                placeholder="Bienvenue dans notre association !"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Frais d'adhésion : ce membre est-il déjà à jour ? */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.auto_mark_fees_paid}
                  onChange={e => setForm({ ...form, auto_mark_fees_paid: e.target.checked })}
                  className="mt-1"
                />
                <div className="text-xs text-amber-900">
                  <span className="font-medium">Ce membre est déjà à jour de ses frais d'adhésion</span>
                  <p className="text-amber-700 mt-0.5">
                    Cochez si l'inscription et le fond de membre ont déjà été payés (membre fondateur, ancien membre qui revient, etc.). Le membre sera <strong>directement actif</strong> à l'acceptation sans avoir à payer.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={sendMut.isPending}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] disabled:opacity-50"
          >
            {sendMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Envoyer l&apos;invitation
          </button>
        </form>
      </div>
    </>
  );
}
