"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { chatApi } from "@/lib/api/chat";
import { membersApi } from "@/lib/api/members";
import { useChatSocket, type ChatStatus } from "@/lib/hooks/use-chat-socket";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatRelative } from "@/lib/utils/format";
import type { Message, Conversation } from "@/lib/types/chat";
import {
  Send, MessageSquare, Plus, Users as UsersIcon, User as UserIcon,
  Megaphone, Loader2, X, Search, ArrowLeft, Check, CheckCheck, Wifi, WifiOff,
} from "lucide-react";

function initials(name: string): string {
  return (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0] || "")
    .join("")
    .toUpperCase() || "?";
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function dateSeparatorLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(iso, today.toISOString())) return "Aujourd'hui";
  if (isSameDay(iso, yesterday.toISOString())) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConvTypeIcon({ type }: { type: Conversation["conv_type"] }) {
  if (type === "general") {
    return <Megaphone size={11} className="text-emerald-600" />;
  }
  if (type === "group") return <UsersIcon size={11} className="text-purple-600" />;
  if (type === "private") return <UserIcon size={11} className="text-blue-600" />;
  return null;
}

export default function ChatPage() {
  const qc = useQueryClient();
  const { currentMembership } = useAuthStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);
  // Sur mobile, on alterne entre la liste (gauche) et la conversation (droite)
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => chatApi.conversations(),
    refetchInterval: 5000, // refresh liste + unread count
  });

  // Polling court des messages quand le WS n'est pas live
  const [wsStatus, setWsStatus] = useState<ChatStatus>("offline");
  const { data: history = [], refetch: refetchMessages } = useQuery({
    queryKey: ["chat-messages", activeId],
    queryFn: () =>
      activeId ? chatApi.messages(activeId) : Promise.resolve([] as Message[]),
    enabled: !!activeId,
    refetchInterval: wsStatus === "live" ? false : 2500,
  });

  const { send: sendWS, status } = useChatSocket(activeId, (msg) => {
    if (msg.type === "chat.message" && msg.message) {
      // Le WS reçoit en temps réel — on déclenche un refetch pour refléter
      qc.invalidateQueries({ queryKey: ["chat-messages", activeId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }
  });

  useEffect(() => {
    setWsStatus(status);
  }, [status]);

  // Marque la conversation comme lue dès qu'on l'ouvre
  useEffect(() => {
    if (!activeId) return;
    chatApi.markRead(activeId).then(() => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }).catch(() => {});
  }, [activeId, qc]);

  // Scroll auto en bas
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history.length]);

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      activeId
        ? chatApi.send(activeId, { content, message_type: "text" })
        : Promise.reject(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages", activeId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const activeConv = conversations.find((c) => c.id === activeId);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !activeId) return;
    setDraft("");
    // Optimiste : si WS connecté, on envoie via WS ; sinon REST
    const sent = sendWS({
      type: "chat.message",
      content,
      message_type: "text",
    });
    if (!sent) {
      sendMut.mutate(content);
    }
  };

  const handleOpenConversation = (conv: { id: string; name: string }) => {
    setActiveId(conv.id);
    setMobileShowChat(true);
  };

  // Regroupement des messages par date pour les séparateurs
  const groupedMessages = useMemo(() => {
    const groups: Array<{ date: string; messages: Message[] }> = [];
    history.forEach((m) => {
      const last = groups[groups.length - 1];
      if (!last || !isSameDay(last.date, m.created_at)) {
        groups.push({ date: m.created_at, messages: [m] });
      } else {
        last.messages.push(m);
      }
    });
    return groups;
  }, [history]);

  return (
    <>
      <Topbar title="Chat" />

      {showNewConv && (
        <NewConversationModal
          onClose={() => setShowNewConv(false)}
          onCreated={(conv) => {
            setShowNewConv(false);
            qc.invalidateQueries({ queryKey: ["conversations"] });
            handleOpenConversation(conv);
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3 h-[calc(100vh-180px)]">
        {/* PANNEAU GAUCHE : liste des conversations */}
        <div
          className={`bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col ${
            mobileShowChat ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="px-3 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#1E3233]">
              Conversations
              {conversations.length > 0 && (
                <span className="ml-1.5 text-xs text-gray-400">
                  ({conversations.length})
                </span>
              )}
            </h2>
            <button
              onClick={() => setShowNewConv(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#43793F] text-white text-xs font-medium rounded-md hover:bg-[#43793F]"
              title="Nouvelle conversation"
            >
              <Plus size={12} /> Nouvelle
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <div className="p-6 text-center">
                <MessageSquare size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">Aucune conversation.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Cliquez sur « + Nouvelle » pour démarrer.
                </p>
              </div>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => handleOpenConversation(c)}
                className={`w-full flex items-center gap-2.5 p-3 text-left transition border-l-[3px] ${
                  activeId === c.id
                    ? "bg-[#F1F8E8] border-[#87C241]"
                    : "border-transparent hover:bg-gray-50"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                    c.conv_type === "general"
                      ? "bg-gradient-to-br from-emerald-400 to-emerald-600"
                      : c.conv_type === "group"
                        ? "bg-gradient-to-br from-purple-400 to-purple-600"
                        : "bg-gradient-to-br from-[#87C241] to-[#43793F]"
                  }`}
                >
                  {c.conv_type === "general" ? (
                    <Megaphone size={16} />
                  ) : c.conv_type === "group" ? (
                    <UsersIcon size={16} />
                  ) : (
                    initials(c.name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <ConvTypeIcon type={c.conv_type} />
                    <p className="text-sm font-semibold text-[#1E3233] truncate">
                      {c.name || "(Sans nom)"}
                    </p>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate">
                    {c.last_message?.content ?? "Pas encore de message"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {c.last_message_at && (
                    <span className="text-[10px] text-gray-400">
                      {formatRelative(c.last_message_at)}
                    </span>
                  )}
                  {c.my_unread_count > 0 && (
                    <span className="bg-[#43793F] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {c.my_unread_count > 99 ? "99+" : c.my_unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* PANNEAU DROIT : conversation active */}
        <div
          className={`bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden ${
            !mobileShowChat ? "hidden lg:flex" : "flex"
          }`}
          style={{
            backgroundImage:
              activeId && activeConv
                ? "linear-gradient(rgba(241,248,232,0.4), rgba(241,248,232,0.4))"
                : undefined,
          }}
        >
          {!activeId && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6">
              <MessageSquare size={40} className="text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">
                Sélectionnez une conversation
              </p>
              <p className="text-xs text-gray-400 mt-1 text-center">
                Vos messages s'affichent ici.
              </p>
            </div>
          )}

          {activeId && activeConv && (
            <>
              {/* Header conversation */}
              <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center gap-3">
                <button
                  onClick={() => setMobileShowChat(false)}
                  className="lg:hidden p-1.5 -ml-1 rounded-md text-gray-500 hover:bg-gray-100"
                  aria-label="Retour"
                >
                  <ArrowLeft size={16} />
                </button>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${
                    activeConv.conv_type === "general"
                      ? "bg-gradient-to-br from-emerald-400 to-emerald-600"
                      : activeConv.conv_type === "group"
                        ? "bg-gradient-to-br from-purple-400 to-purple-600"
                        : "bg-gradient-to-br from-[#87C241] to-[#43793F]"
                  }`}
                >
                  {activeConv.conv_type === "general" ? (
                    <Megaphone size={14} />
                  ) : activeConv.conv_type === "group" ? (
                    <UsersIcon size={14} />
                  ) : (
                    initials(activeConv.name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[#1E3233] truncate">
                    {activeConv.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>
                      {activeConv.members?.length ?? 0} participant
                      {(activeConv.members?.length ?? 0) > 1 ? "s" : ""}
                    </span>
                    <span>·</span>
                    <span>{activeConv.message_count} messages</span>
                  </div>
                </div>
                <ConnectionIndicator status={wsStatus} />
              </div>

              {/* Zone messages avec fond pattern doux */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4">
                {history.length === 0 && (
                  <div className="text-center mt-12">
                    <p className="text-sm text-gray-400">Aucun message.</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Écrivez le premier ci-dessous ✨
                    </p>
                  </div>
                )}

                {groupedMessages.map((group, gi) => (
                  <div key={gi} className="mb-4">
                    {/* Séparateur date */}
                    <div className="flex items-center justify-center mb-3">
                      <span className="bg-white/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-medium text-gray-500 shadow-sm">
                        {dateSeparatorLabel(group.date)}
                      </span>
                    </div>

                    {/* Messages du jour */}
                    <div className="space-y-1.5">
                      {group.messages.map((m, mi) => {
                        const isMine = m.sender === currentMembership?.id;
                        const prev = group.messages[mi - 1];
                        const showAvatar =
                          !isMine && (!prev || prev.sender !== m.sender);
                        const showName =
                          !isMine &&
                          activeConv.conv_type !== "private" &&
                          showAvatar;

                        return (
                          <div
                            key={m.id}
                            className={`flex items-end gap-2 ${
                              isMine ? "justify-end" : "justify-start"
                            }`}
                          >
                            {!isMine && (
                              <div className="w-7 h-7 shrink-0">
                                {showAvatar && (
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#87C241] to-[#43793F] flex items-center justify-center text-white text-[10px] font-bold">
                                    {initials(m.sender_name || "?")}
                                  </div>
                                )}
                              </div>
                            )}

                            <div
                              className={`max-w-[75%] sm:max-w-[65%] rounded-2xl px-3 py-2 shadow-sm ${
                                isMine
                                  ? "bg-[#43793F] text-white rounded-br-sm"
                                  : "bg-white text-gray-900 rounded-bl-sm border border-gray-100"
                              }`}
                            >
                              {showName && (
                                <p className="text-[10px] font-semibold text-[#43793F] mb-0.5">
                                  {m.sender_name}
                                </p>
                              )}
                              {m.message_type === "system" ? (
                                <p
                                  className={`text-xs italic ${
                                    isMine ? "text-white/80" : "text-gray-500"
                                  }`}
                                >
                                  {m.content}
                                </p>
                              ) : (
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {m.content}
                                </p>
                              )}
                              <div
                                className={`flex items-center justify-end gap-1 mt-0.5 text-[9px] ${
                                  isMine ? "text-white/70" : "text-gray-400"
                                }`}
                              >
                                <span>{timeLabel(m.created_at)}</span>
                                {isMine && (
                                  <CheckCheck size={11} className="opacity-80" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Composer */}
              <form
                onSubmit={handleSend}
                className="border-t border-gray-100 p-2.5 sm:p-3 flex items-center gap-2 bg-white"
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Écrire un message…"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sendMut.isPending}
                  className="p-2.5 bg-[#43793F] text-white rounded-full hover:bg-[#43793F] disabled:opacity-50 shrink-0"
                  aria-label="Envoyer"
                >
                  {sendMut.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ConnectionIndicator({ status }: { status: ChatStatus }) {
  if (status === "live") {
    return (
      <span
        title="Temps réel connecté"
        className="inline-flex items-center gap-1 text-[10px] text-emerald-600"
      >
        <Wifi size={11} /> Live
      </span>
    );
  }
  if (status === "connecting") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
        <Loader2 size={11} className="animate-spin" /> ...
      </span>
    );
  }
  return (
    <span
      title="Mode hors-ligne : messages relayés via REST + polling 2.5s"
      className="inline-flex items-center gap-1 text-[10px] text-amber-600"
    >
      <WifiOff size={11} /> Sync
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Modale Nouvelle conversation (réservée au président/bureau pour groupe et général)
// ─────────────────────────────────────────────────────────────────────

type ConvKind = "choose" | "private" | "group" | "general";

function NewConversationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conv: { id: string; name: string }) => void;
}) {
  const p = usePermissions();
  const canCreateGroup = p.isPresident || p.isBureau;

  const [step, setStep] = useState<ConvKind>("choose");
  const [error, setError] = useState("");

  const generalMut = useMutation({
    mutationFn: () => chatApi.getOrCreateGeneral(),
    onSuccess: (conv) => onCreated({ id: conv.id, name: conv.name }),
    onError: (err: any) =>
      setError(err.response?.data?.error || err.message || "Erreur"),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            {step === "choose" && "Nouvelle conversation"}
            {step === "private" && "Discuter avec un membre"}
            {step === "group" && "Créer un groupe"}
            {step === "general" && "Canal général de l'association"}
          </h3>
          <button onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-3">
            {error}
          </div>
        )}

        {step === "choose" && (
          <div className="space-y-2">
            <ChoiceCard
              icon={UserIcon}
              tint="bg-blue-50 text-blue-600"
              title="Discuter avec un membre"
              description="Conversation privée 1-à-1."
              onClick={() => {
                setError("");
                setStep("private");
              }}
            />
            {canCreateGroup ? (
              <ChoiceCard
                icon={UsersIcon}
                tint="bg-purple-50 text-purple-600"
                title="Créer un groupe"
                description="Inviter plusieurs membres dans une conversation nommée."
                onClick={() => {
                  setError("");
                  setStep("group");
                }}
              />
            ) : (
              <DisabledChoice
                icon={UsersIcon}
                title="Créer un groupe"
                description="Réservé au président et aux membres du bureau."
              />
            )}
            {canCreateGroup ? (
              <ChoiceCard
                icon={Megaphone}
                tint="bg-emerald-50 text-emerald-600"
                title="Canal général de l'association"
                description="Lu par TOUS les membres actifs. Idéal pour les annonces."
                onClick={() => {
                  setError("");
                  setStep("general");
                  generalMut.mutate();
                }}
                loading={generalMut.isPending}
              />
            ) : (
              <DisabledChoice
                icon={Megaphone}
                title="Canal général de l'association"
                description="Réservé au président et aux membres du bureau."
              />
            )}
          </div>
        )}

        {step === "private" && (
          <PrivateStep
            onCancel={() => setStep("choose")}
            onCreated={onCreated}
            onError={setError}
          />
        )}

        {step === "group" && (
          <GroupStep
            onCancel={() => setStep("choose")}
            onCreated={onCreated}
            onError={setError}
          />
        )}

        {step === "general" && (
          <div className="text-center py-6">
            <Loader2
              size={20}
              className="animate-spin mx-auto text-[#43793F] mb-2"
            />
            <p className="text-sm text-gray-500">
              Préparation du canal général…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChoiceCard({
  icon: Icon, tint, title, description, onClick, loading,
}: {
  icon: any;
  tint: string;
  title: string;
  description: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-start gap-3 p-3 border border-gray-200 rounded-xl hover:border-[#43793F] hover:bg-[#F1F8E8]/40 text-left transition disabled:opacity-50"
    >
      <div
        className={`w-9 h-9 ${tint} rounded-lg flex items-center justify-center shrink-0`}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Icon size={16} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1E3233]">{title}</p>
        <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
          {description}
        </p>
      </div>
    </button>
  );
}

function DisabledChoice({
  icon: Icon, title, description,
}: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl bg-gray-50 opacity-60 cursor-not-allowed">
      <div className="w-9 h-9 bg-gray-100 text-gray-400 rounded-lg flex items-center justify-center shrink-0">
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-500">{title}</p>
        <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );
}

function PrivateStep({
  onCancel, onCreated, onError,
}: {
  onCancel: () => void;
  onCreated: (conv: { id: string; name: string }) => void;
  onError: (msg: string) => void;
}) {
  const { currentMembership } = useAuthStore();
  const [search, setSearch] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: ["members", "active"],
    queryFn: () => membersApi.list({ status: "active" }),
  });

  const filtered = members
    .filter((m) => m.id !== currentMembership?.id)
    .filter((m) => {
      if (!search) return true;
      return (m.user_name || "")
        .toLowerCase()
        .includes(search.toLowerCase());
    });

  const mut = useMutation({
    mutationFn: () => chatApi.createPrivate(memberId!),
    onSuccess: (conv) => onCreated({ id: conv.id, name: conv.name }),
    onError: (err: any) =>
      onError(err.response?.data?.error || err.message || "Erreur"),
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un membre…"
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
        />
      </div>
      <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
        {filtered.length === 0 && (
          <p className="p-4 text-sm text-gray-400 text-center">Aucun membre.</p>
        )}
        {filtered.map((m) => (
          <button
            key={m.id}
            onClick={() => setMemberId(m.id)}
            className={`w-full flex items-center gap-2 p-2.5 text-left hover:bg-gray-50 transition ${
              memberId === m.id ? "bg-[#F1F8E8]" : ""
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#87C241] to-[#43793F] flex items-center justify-center text-white text-[10px] font-bold">
              {initials(m.user_name || "?")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {m.user_name}
              </p>
              <p className="text-[10px] text-gray-500">#{m.member_number}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
        >
          Retour
        </button>
        <button
          onClick={() => mut.mutate()}
          disabled={!memberId || mut.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
        >
          {mut.isPending && <Loader2 size={12} className="animate-spin" />}
          Démarrer
        </button>
      </div>
    </div>
  );
}

function GroupStep({
  onCancel, onCreated, onError,
}: {
  onCancel: () => void;
  onCreated: (conv: { id: string; name: string }) => void;
  onError: (msg: string) => void;
}) {
  const { currentMembership } = useAuthStore();
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: members = [] } = useQuery({
    queryKey: ["members", "active"],
    queryFn: () => membersApi.list({ status: "active" }),
  });

  const filtered = members
    .filter((m) => m.id !== currentMembership?.id)
    .filter((m) => {
      if (!search) return true;
      return (m.user_name || "")
        .toLowerCase()
        .includes(search.toLowerCase());
    });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mut = useMutation({
    mutationFn: () =>
      chatApi.createGroup({
        name: name.trim(),
        member_ids: Array.from(selected),
      }),
    onSuccess: (conv) => onCreated({ id: conv.id, name: conv.name }),
    onError: (err: any) =>
      onError(err.response?.data?.error || err.message || "Erreur"),
  });

  const canSubmit = name.trim().length >= 2 && selected.size >= 1;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Nom du groupe *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Commission trésorerie"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">
          Membres ({selected.size} sélectionné{selected.size > 1 ? "s" : ""})
        </label>
        <div className="relative mb-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
          {filtered.length === 0 && (
            <p className="p-4 text-sm text-gray-400 text-center">Aucun membre.</p>
          )}
          {filtered.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-2 p-2.5 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggle(m.id)}
                className="w-4 h-4 accent-[#43793F]"
              />
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#87C241] to-[#43793F] flex items-center justify-center text-white text-[10px] font-bold">
                {initials(m.user_name || "?")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {m.user_name}
                </p>
                <p className="text-[10px] text-gray-500">#{m.member_number}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
        >
          Retour
        </button>
        <button
          onClick={() => mut.mutate()}
          disabled={!canSubmit || mut.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
        >
          {mut.isPending && <Loader2 size={12} className="animate-spin" />}
          Créer le groupe
        </button>
      </div>
    </div>
  );
}
