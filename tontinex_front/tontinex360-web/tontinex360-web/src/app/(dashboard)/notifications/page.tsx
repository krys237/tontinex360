"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { notificationsApi } from "@/lib/api/notifications";
import { useNotifStore } from "@/lib/stores/notification-store";
import { formatRelative } from "@/lib/utils/format";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { setUnreadCount } = useNotifStore();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
  });

  const markReadMut = useMutation({
    mutationFn: (ids: string[]) => notificationsApi.markRead(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      notificationsApi.unreadCount().then(setUnreadCount);
    },
  });

  const markAllReadMut = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      setUnreadCount(0);
    },
  });

  const unread = notifications.filter((n: any) => !n.is_read);

  return (
    <>
      <Topbar title="Notifications" />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {unread.length} non lue{unread.length > 1 ? "s" : ""} sur {notifications.length}
        </p>
        {unread.length > 0 && (
          <button
            onClick={() => markAllReadMut.mutate()}
            disabled={markAllReadMut.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {markAllReadMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
            Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading && <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>}
        {!isLoading && notifications.length === 0 && (
          <div className="p-12 text-center">
            <Bell size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucune notification.</p>
          </div>
        )}
        {notifications.length > 0 && (
          <div className="divide-y divide-gray-100">
            {notifications.map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-4 transition ${
                  n.is_read ? "" : "bg-blue-50/40"
                }`}
              >
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                  n.is_read ? "bg-transparent" : "bg-[#43793F]"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{formatRelative(n.created_at)}</p>
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => markReadMut.mutate([n.id])}
                    disabled={markReadMut.isPending}
                    className="text-gray-400 hover:text-emerald-600 disabled:opacity-50"
                    title="Marquer comme lue"
                  >
                    <Check size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
