"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export default function CreateAssociationPage() {
  const router = useRouter();
  const { setActiveAssociation, setAssociations, associations } = useAuthStore();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    city: "",
    region: "",
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");

  const createMut = useMutation({
    mutationFn: () => authApi.createAssociation({
      name: form.name,
      slug: form.slug,
      description: form.description,
      city: form.city,
      region: form.region,
    }),
    onSuccess: (data) => {
      setActiveAssociation(data.association);
      setAssociations([...associations, data.association]);
      router.push("/dashboard");
    },
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === "string" ? data : data?.detail || data?.error || "Erreur lors de la création");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.slug) {
      setError("Le nom et l'identifiant unique sont requis.");
      return;
    }
    createMut.mutate();
  };

  return (
    <>
      <Topbar title="Créer une association" />
      <Link href="/no-association" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour
      </Link>

      <div className="max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#F1F8E8] rounded-lg flex items-center justify-center">
              <Building2 size={18} className="text-[#43793F]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Nouvelle association</h2>
              <p className="text-xs text-gray-500">Vous serez automatiquement le fondateur et président.</p>
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l&apos;association *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => {
                  const v = e.target.value;
                  setForm(f => ({
                    ...f,
                    name: v,
                    slug: slugTouched ? f.slug : slugify(v),
                  }));
                }}
                placeholder="Tontine des Amis"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Identifiant unique (slug) *</label>
              <input
                type="text"
                value={form.slug}
                onChange={e => {
                  setSlugTouched(true);
                  setForm({ ...form, slug: slugify(e.target.value) });
                }}
                placeholder="tontine-des-amis"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Identifiant URL unique, sans espaces ni accents.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Brève description de l'objet de l'association"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                  placeholder="Douala"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Région</label>
                <input
                  type="text"
                  value={form.region}
                  onChange={e => setForm({ ...form, region: e.target.value })}
                  placeholder="Littoral"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={createMut.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] transition disabled:opacity-50"
              >
                {createMut.isPending && <Loader2 size={14} className="animate-spin" />}
                Créer l&apos;association
              </button>
            </div>
          </form>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900">
          <p className="font-semibold mb-1">À noter</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Vous serez automatiquement membre fondateur et président.</li>
            <li>Une période d&apos;essai gratuite est activée selon le plan par défaut.</li>
            <li>Les rôles et postes de bureau standards sont créés automatiquement.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
