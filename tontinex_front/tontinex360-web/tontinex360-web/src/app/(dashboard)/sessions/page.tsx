"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { sessionsApi } from "@/lib/api/sessions";
import { cyclesApi } from "@/lib/api/cycles";
import { formatDate } from "@/lib/utils/format";
import { SESSION_STATUS } from "@/lib/utils/constants";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { Plus, MapPin, ChevronRight } from "lucide-react";

export default function SessionsPage() {
  const p = usePermissions();
  const [selectedCycle, setSelectedCycle] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: cycles = [] } = useQuery({
    queryKey: ["cycles"],
    queryFn: () => cyclesApi.list(),
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions", selectedCycle, statusFilter],
    queryFn: () => sessionsApi.list({
      ...(selectedCycle ? { cycle: selectedCycle } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
  });

  const canCreate = p.isPresident || p.canAny(['*', 'cycles.*', 'sessions.create']);

  return (
    <>
      <Topbar title="Séances" />

      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <select
            value={selectedCycle}
            onChange={e => setSelectedCycle(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
          >
            <option value="">Tous les cycles</option>
            {cycles.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
          >
            <option value="">Tous statuts</option>
            <option value="scheduled">Programmées</option>
            <option value="in_progress">En cours</option>
            <option value="completed">Terminées</option>
            <option value="cancelled">Annulées</option>
            <option value="postponed">Reportées</option>
          </select>
        </div>

        {canCreate && (
          <Link href="/sessions/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] transition">
            <Plus size={14} /> Nouvelle séance
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading && (
          <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>
        )}
        {!isLoading && sessions.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-400">Aucune séance.</p>
        )}
        {sessions.length > 0 && (
          <div className="divide-y divide-gray-100">
            {sessions.map(s => {
              const st = SESSION_STATUS[s.status as keyof typeof SESSION_STATUS];
              return (
                <Link key={s.id} href={`/sessions/${s.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-gray-50 transition">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold ${
                    s.status === "completed" ? "bg-emerald-50 text-emerald-600" :
                    s.status === "scheduled" ? "bg-blue-50 text-blue-600" :
                    s.status === "in_progress" ? "bg-amber-50 text-amber-600" :
                    "bg-gray-50 text-gray-600"
                  }`}>
                    S{s.session_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Séance n°{s.session_number}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(s.date)}
                      {s.start_time ? ` · ${s.start_time.slice(0, 5)}` : ""}
                    </p>
                    {s.location && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <MapPin size={10} /> {s.location}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    st?.color || "bg-gray-100 text-gray-600"
                  }`}>
                    {st?.label || s.status}
                  </span>
                  <ChevronRight size={16} className="text-gray-400" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
