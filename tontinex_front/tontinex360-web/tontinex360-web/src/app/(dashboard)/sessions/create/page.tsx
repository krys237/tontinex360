"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { sessionsApi } from "@/lib/api/sessions";
import { cyclesApi } from "@/lib/api/cycles";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function CreateSessionPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    cycle: "",
    session_number: "",
    date: "",
    start_time: "",
    end_time: "",
    location: "",
    notes: "",
    status: "scheduled" as const,
  });
  const [error, setError] = useState("");

  const { data: cycles = [] } = useQuery({
    queryKey: ["cycles", "active"],
    queryFn: () => cyclesApi.list({ status: "active" }),
  });

  const createMut = useMutation({
    mutationFn: () => sessionsApi.create({
      cycle: form.cycle,
      session_number: form.session_number ? Number(form.session_number) : undefined,
      date: form.date,
      start_time: form.start_time || undefined,
      end_time: form.end_time || undefined,
      location: form.location,
      notes: form.notes,
      status: form.status,
    } as any),
    onSuccess: (s: any) => router.push(`/sessions/${s.id}`),
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === "string" ? data : data?.detail || "Erreur lors de la création");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.cycle || !form.date) {
      setError("Cycle et date sont requis.");
      return;
    }
    createMut.mutate();
  };

  return (
    <>
      <Topbar title="Nouvelle séance" />
      <Link href="/sessions" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour
      </Link>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cycle *</label>
            <select
              value={form.cycle}
              onChange={e => setForm({ ...form, cycle: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
            >
              <option value="">Choisir un cycle…</option>
              {cycles.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {cycles.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Aucun cycle actif. <Link href="/tontines" className="underline">Créer un cycle</Link> d&apos;abord.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° séance</label>
              <input
                type="number"
                value={form.session_number}
                onChange={e => setForm({ ...form, session_number: e.target.value })}
                placeholder="Auto si vide"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure début</label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => setForm({ ...form, start_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure fin</label>
              <input
                type="time"
                value={form.end_time}
                onChange={e => setForm({ ...form, end_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
            <input
              type="text"
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="Siège de l'association"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6">
          <button
            type="submit"
            disabled={createMut.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] transition disabled:opacity-50"
          >
            {createMut.isPending && <Loader2 size={14} className="animate-spin" />}
            Créer la séance
          </button>
          <Link href="/sessions" className="px-4 py-2 border border-gray-200 rounded-lg text-sm">
            Annuler
          </Link>
        </div>
      </form>
    </>
  );
}
