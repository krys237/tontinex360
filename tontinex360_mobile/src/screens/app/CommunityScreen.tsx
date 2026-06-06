import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { Card, HeaderIconBtn, Chip, IconBubble } from '../../components/ui';
import { governanceApi } from '../../lib/api/governance';
import { eventsApi, EVENT_TYPE_LABEL } from '../../lib/api/events';
import { cyclesApi } from '../../lib/api/cycles';
import { chatApi } from '../../lib/api/chat';
import { membersApi } from '../../lib/api/members';
import { notificationsApi } from '../../lib/api/notifications';
import { timeAgo, formatDateFr } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type TabKey = 'fil' | 'reunions' | 'votes' | 'membres';
type SubTabKey = 'avenir' | 'passees' | 'calendrier';

const SUBTABS: { key: SubTabKey; label: string; icon: IoniconName }[] = [
  { key: 'avenir', label: 'À venir', icon: 'calendar' },
  { key: 'passees', label: 'Passées', icon: 'time-outline' },
  { key: 'calendrier', label: 'Calendrier', icon: 'calendar-outline' },
];

/** Réunion unifiée : séance de cycle OU événement, normalisée pour l'affichage. */
type Reunion = {
  key: string;
  id: string;
  kind: 'session' | 'event';
  title: string;
  subtitle?: string;
  typeLabel: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string;
  status: string;
};

const TABS: { key: TabKey; label: string; icon: IoniconName }[] = [
  { key: 'fil', label: 'Fil', icon: 'newspaper-outline' },
  { key: 'reunions', label: 'Réunions', icon: 'chatbubble-ellipses-outline' },
  { key: 'votes', label: 'Votes', icon: 'mail-outline' },
  { key: 'membres', label: 'Membres', icon: 'people-outline' },
];

const MONTHS_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];
function parseDate(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function hhmm(t?: string | null) {
  return t ? t.slice(0, 5) : '';
}

export default function CommunityScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<TabKey>('reunions');
  const [subTab, setSubTab] = useState<SubTabKey>('avenir');

  const unreadQ = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: notificationsApi.unreadCount,
  });
  const annQ = useQuery({
    queryKey: ['announcements'],
    queryFn: () => governanceApi.announcements(),
  });
  const eventsQ = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.list(),
  });
  const sessionsQ = useQuery({
    queryKey: ['sessions'],
    queryFn: () => cyclesApi.sessions(),
  });
  const convQ = useQuery({
    queryKey: ['conversations'],
    queryFn: chatApi.conversations,
  });
  const chatUnread = (convQ.data ?? []).reduce(
    (n, c) => n + (c.my_unread_count || 0),
    0,
  );
  const pollsQ = useQuery({
    queryKey: ['polls'],
    queryFn: () => governanceApi.polls(),
    enabled: tab === 'votes',
  });
  const membersQ = useQuery({
    queryKey: ['members'],
    queryFn: () => membersApi.list(),
    enabled: tab === 'membres',
  });

  const refreshing =
    annQ.isRefetching ||
    eventsQ.isRefetching ||
    sessionsQ.isRefetching ||
    pollsQ.isRefetching ||
    membersQ.isRefetching;
  const onRefresh = () => {
    annQ.refetch();
    eventsQ.refetch();
    sessionsQ.refetch();
    if (tab === 'votes') pollsQ.refetch();
    if (tab === 'membres') membersQ.refetch();
  };

  const announcements = annQ.data ?? [];
  const heroAnn = announcements[0];
  const feed = announcements.slice(1);
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  // Réunions = séances du cycle (cycles) + événements (events), fusionnées.
  const reunions: Reunion[] = [
    ...(sessionsQ.data ?? []).map<Reunion>(s => ({
      key: `s_${s.id}`,
      id: s.id,
      kind: 'session',
      title: `Séance N°${s.session_number}`,
      subtitle: s.host_member_name
        ? `Animée par ${s.host_member_name}`
        : undefined,
      typeLabel: 'Séance',
      date: s.date,
      start_time: s.start_time,
      end_time: s.end_time,
      location: s.location,
      status: s.status,
    })),
    ...(eventsQ.data ?? []).map<Reunion>(e => ({
      key: `e_${e.id}`,
      id: e.id,
      kind: 'event',
      title: e.title,
      subtitle: e.description || undefined,
      typeLabel: EVENT_TYPE_LABEL[e.event_type] ?? 'Événement',
      date: e.date,
      start_time: e.start_time,
      end_time: e.end_time,
      location: e.location,
      status: e.status,
    })),
  ];
  const isUpcoming = (r: Reunion) => {
    if (r.status === 'cancelled' || r.status === 'completed') return false;
    const d = parseDate(r.date);
    return !d || d >= startOfToday;
  };
  const upcoming = reunions
    .filter(isUpcoming)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const past = reunions
    .filter(r => !isUpcoming(r))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const nextR = upcoming[0];
  const reunionsLoading = eventsQ.isLoading || sessionsQ.isLoading;

  const openReunion = (r: Reunion) =>
    navigation.navigate(
      r.kind === 'session' ? 'SessionDetail' : 'EventDetail',
      { id: r.id },
    );

  const renderEvent = (r: Reunion, i: number) => {
    const d = parseDate(r.date);
    return (
      <Pressable
        key={r.key}
        style={[styles.eventRow, i > 0 && styles.eventDivider]}
        onPress={() => openReunion(r)}
      >
        <View style={styles.dateCol}>
          <Text style={styles.dateDay}>{d ? d.getDate() : '--'}</Text>
          <Text style={styles.dateMonth}>
            {d ? MONTHS_FR[d.getMonth()] : ''}
          </Text>
          <Text style={styles.dateYear}>{d ? d.getFullYear() : ''}</Text>
        </View>
        <View style={styles.eventBar} />
        <View style={styles.flex}>
          <View style={styles.eventTitleRow}>
            <Text style={styles.eventTitle} numberOfLines={1}>
              {r.title}
            </Text>
            <Chip
              label={r.typeLabel}
              tint={r.kind === 'session' ? 'green' : 'gold'}
              style={styles.eventChip}
            />
          </View>
          {r.subtitle ? (
            <Text style={styles.eventDesc} numberOfLines={1}>
              {r.subtitle}
            </Text>
          ) : null}
          <View style={styles.eventMeta}>
            {r.start_time ? (
              <Text style={styles.metaItem}>
                <Ionicons
                  name="time-outline"
                  size={11}
                  color={colors.textLight}
                />{' '}
                {hhmm(r.start_time)}
                {r.end_time ? ` - ${hhmm(r.end_time)}` : ''}
              </Text>
            ) : null}
            {r.location ? (
              <Text style={styles.metaItem} numberOfLines={1}>
                <Ionicons
                  name="location-outline"
                  size={11}
                  color={colors.textLight}
                />{' '}
                {r.location}
              </Text>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.title}>Communauté</Text>
            <Text style={styles.subtitle}>
              Restez informé. Restez connecté.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <HeaderIconBtn
              icon="chatbubbles-outline"
              badge={chatUnread}
              onPress={() => navigation.navigate('Chat')}
            />
            <HeaderIconBtn
              icon="calendar-outline"
              onPress={() => {
                setTab('reunions');
                setSubTab('calendrier');
              }}
            />
            <HeaderIconBtn
              icon="notifications-outline"
              badge={unreadQ.data}
              onPress={() => navigation.navigate('Notifications')}
            />
          </View>
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {TABS.map(t => {
            const active = tab === t.key;
            return active ? (
              <LinearGradient
                key={t.key}
                colors={[colors.green[500], colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tab}
              >
                <Pressable
                  style={styles.tabInner}
                  onPress={() => setTab(t.key)}
                >
                  <Ionicons name={t.icon} size={15} color={colors.white} />
                  <Text style={styles.tabTextActive}>{t.label}</Text>
                </Pressable>
              </LinearGradient>
            ) : (
              <Pressable
                key={t.key}
                style={[styles.tab, styles.tabInactive]}
                onPress={() => setTab(t.key)}
              >
                <Ionicons name={t.icon} size={15} color={colors.textMuted} />
                <Text style={styles.tabText}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* RÉUNIONS */}
        {tab === 'reunions' && (
          <>
            {/* Hero — prochaine réunion */}
            {nextR ? (
              <LinearGradient
                colors={[colors.greenBg, colors.greenBgDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <View style={styles.heroTop}>
                  <View style={styles.flex}>
                    <Text style={styles.heroKicker}>
                      Prochaine réunion · {nextR.typeLabel}
                    </Text>
                    <Text style={styles.heroTitle}>{nextR.title}</Text>
                    <View style={styles.heroInfo}>
                      {parseDate(nextR.date) ? (
                        <View style={styles.heroInfoLine}>
                          <Ionicons
                            name="calendar"
                            size={14}
                            color={colors.primary}
                          />
                          <Text style={styles.heroInfoText}>
                            {formatDateFr(nextR.date, false)}
                          </Text>
                        </View>
                      ) : null}
                      {nextR.start_time ? (
                        <View style={styles.heroInfoLine}>
                          <Ionicons
                            name="time"
                            size={14}
                            color={colors.primary}
                          />
                          <Text style={styles.heroInfoText}>
                            {hhmm(nextR.start_time)}
                            {nextR.end_time ? ` - ${hhmm(nextR.end_time)}` : ''}
                          </Text>
                        </View>
                      ) : null}
                      {nextR.location ? (
                        <View style={styles.heroInfoLine}>
                          <Ionicons
                            name="location"
                            size={14}
                            color={colors.primary}
                          />
                          <Text style={styles.heroInfoText} numberOfLines={1}>
                            {nextR.location}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Image
                    source={require('../../assets/illustrations/calendar-meeting.png')}
                    style={styles.heroImg}
                    resizeMode="contain"
                  />
                </View>
                <Pressable
                  style={styles.heroDetailsBtn}
                  onPress={() => openReunion(nextR)}
                >
                  <Text style={styles.heroDetailsText}>Voir les détails</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={15}
                    color={colors.white}
                  />
                </Pressable>
              </LinearGradient>
            ) : null}

            {/* Sous-onglets */}
            <View style={styles.subTabs}>
              {SUBTABS.map(s => {
                const active = subTab === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setSubTab(s.key)}
                    style={[styles.subTab, active && styles.subTabActive]}
                  >
                    <Ionicons
                      name={s.icon}
                      size={14}
                      color={active ? colors.white : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.subTabText,
                        active && styles.subTabTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* À venir / Passées */}
            {subTab !== 'calendrier' &&
              (reunionsLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                (() => {
                  const list = subTab === 'avenir' ? upcoming : past;
                  return list.length === 0 ? (
                    <Card style={styles.card}>
                      <Text style={styles.empty}>
                        {subTab === 'avenir'
                          ? 'Aucun évènement à venir.'
                          : 'Aucun évènement passé.'}
                      </Text>
                    </Card>
                  ) : (
                    <>
                      <Text style={styles.sectionTitle}>
                        {subTab === 'avenir'
                          ? 'Évènement à venir'
                          : 'Évènements passés'}
                      </Text>
                      {list.map(renderEvent)}
                    </>
                  );
                })()
              ))}

            {/* Calendrier — à venir, groupé par mois */}
            {subTab === 'calendrier' &&
              (upcoming.length === 0 ? (
                <Card style={styles.card}>
                  <Text style={styles.empty}>Aucun évènement programmé.</Text>
                </Card>
              ) : (
                Object.entries(
                  upcoming.reduce<Record<string, Reunion[]>>((acc, r) => {
                    const d = parseDate(r.date);
                    const key = d
                      ? `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
                      : 'À planifier';
                    (acc[key] ??= []).push(r);
                    return acc;
                  }, {}),
                ).map(([month, list]) => (
                  <View key={month}>
                    <Text style={styles.monthHeader}>{month}</Text>
                    {list.map(renderEvent)}
                  </View>
                ))
              ))}
          </>
        )}

        {/* FIL D'ACTUALITÉ */}
        {tab === 'fil' &&
          (annQ.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : announcements.length === 0 ? (
            <Card style={styles.card}>
              <Text style={styles.empty}>Aucune annonce.</Text>
            </Card>
          ) : (
            <>
              {/* Hero — dernière annonce, cliquable pour lire en grand */}
              {heroAnn ? (
                <Pressable
                  onPress={() =>
                    navigation.navigate('AnnouncementDetail', {
                      id: heroAnn.id,
                    })
                  }
                >
                  <LinearGradient
                    colors={[colors.greenBg, colors.greenBgDeep]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                  >
                    <View style={styles.heroTop}>
                      <View style={styles.flex}>
                        <Text style={styles.heroKicker}>Annonce du bureau</Text>
                        <Text style={styles.heroTitle}>{heroAnn.title}</Text>
                        {heroAnn.content ? (
                          <Text style={styles.heroBody} numberOfLines={3}>
                            {heroAnn.content}
                          </Text>
                        ) : null}
                      </View>
                      <Image
                        source={require('../../assets/illustrations/calendar-meeting.png')}
                        style={styles.heroImg}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.heroBtn}>
                      <Text style={styles.heroBtnText}>Voir détails</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={15}
                        color={colors.white}
                      />
                    </View>
                  </LinearGradient>
                </Pressable>
              ) : null}

              {/* Liste des annonces */}
              {feed.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Dernières annonces</Text>
                  <Card style={styles.card}>
                    {feed.map((a, i) => (
                      <Pressable
                        key={a.id}
                        onPress={() =>
                          navigation.navigate('AnnouncementDetail', {
                            id: a.id,
                          })
                        }
                        style={[styles.feedRow, i > 0 && styles.histDivider]}
                      >
                        <IconBubble
                          icon="megaphone-outline"
                          tint={a.is_read ? 'primary' : 'lime'}
                          size={38}
                        />
                        <View style={styles.flex}>
                          <View style={styles.annTop}>
                            <Text style={styles.feedTitle} numberOfLines={1}>
                              {a.title}
                            </Text>
                            {a.priority === 'urgent' ||
                            a.priority === 'high' ? (
                              <Chip
                                label={
                                  a.priority === 'urgent'
                                    ? 'Urgent'
                                    : 'Important'
                                }
                                tint={
                                  a.priority === 'urgent' ? 'danger' : 'gold'
                                }
                              />
                            ) : null}
                          </View>
                          {a.content ? (
                            <Text style={styles.feedPreview} numberOfLines={2}>
                              {a.content}
                            </Text>
                          ) : null}
                          <Text style={styles.feedMeta}>
                            {a.author_name ? `${a.author_name} · ` : ''}
                            {timeAgo(a.created_at)}
                          </Text>
                        </View>
                        {!a.is_read ? <View style={styles.dot} /> : null}
                      </Pressable>
                    ))}
                  </Card>
                </>
              ) : null}
            </>
          ))}

        {/* VOTES */}
        {tab === 'votes' &&
          (pollsQ.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (pollsQ.data ?? []).length === 0 ? (
            <Card style={styles.card}>
              <Text style={styles.empty}>Aucun sondage pour le moment.</Text>
            </Card>
          ) : (
            (pollsQ.data ?? []).map(p => (
              <Pressable
                key={p.id}
                onPress={() =>
                  Alert.alert(p.title, 'Le détail du vote arrive bientôt.')
                }
              >
                <Card style={styles.card}>
                  <View style={styles.annTop}>
                    <Text style={styles.annTitle} numberOfLines={1}>
                      {p.title}
                    </Text>
                    <Chip
                      label={
                        p.is_open_now ? 'Ouvert' : p.status_display || p.status
                      }
                      tint={p.is_open_now ? 'green' : 'grey'}
                    />
                  </View>
                  <Text style={styles.annBody} numberOfLines={2}>
                    {p.question}
                  </Text>
                  <View style={styles.pollMeta}>
                    {p.is_anonymous ? (
                      <Text style={styles.metaItem}>
                        <Ionicons
                          name="lock-closed"
                          size={11}
                          color={colors.textLight}
                        />{' '}
                        Anonyme
                      </Text>
                    ) : null}
                    {p.has_voted ? (
                      <Text style={styles.voted}>✓ Vous avez voté</Text>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            ))
          ))}

        {/* MEMBRES */}
        {tab === 'membres' &&
          (membersQ.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (membersQ.data ?? []).length === 0 ? (
            <Card style={styles.card}>
              <Text style={styles.empty}>Aucun membre.</Text>
            </Card>
          ) : (
            <Card style={styles.card}>
              {(membersQ.data ?? []).map((m, i) => (
                <View
                  key={m.id}
                  style={[styles.memberRow, i > 0 && styles.histDivider]}
                >
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberInitials}>
                      {(m.user_name || '?').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {m.user_name}
                    </Text>
                    <Text style={styles.memberNum}>{m.member_number}</Text>
                  </View>
                  <Chip
                    label={m.is_active ? 'Actif' : 'Inactif'}
                    tint={m.is_active ? 'green' : 'grey'}
                  />
                </View>
              ))}
            </Card>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  title: { fontSize: font.size.x2, fontWeight: font.bold, color: colors.text },
  subtitle: { marginTop: 2, fontSize: font.size.sm, color: colors.textMuted },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  tabsRow: { gap: 8, paddingRight: 8 },
  tab: { borderRadius: 999 },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.textMuted,
  },
  tabTextActive: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.white,
  },

  hero: { borderRadius: radius.hero, padding: 18, ...cardShadow },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  heroKicker: { fontSize: font.size.sm, color: colors.textMuted },
  heroTitle: {
    fontSize: font.size.lg,
    fontWeight: font.bold,
    color: colors.primary,
    marginTop: 4,
    lineHeight: font.size.lg * 1.25,
  },
  heroBody: {
    fontSize: font.size.sm,
    color: colors.green[900],
    marginTop: 8,
    lineHeight: font.size.sm * 1.4,
  },
  heroImg: { width: 96, height: 96, alignSelf: 'flex-start' },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  heroBtnText: {
    color: colors.white,
    fontSize: font.size.sm,
    fontWeight: font.semibold,
  },

  sectionTitle: {
    fontSize: font.size.lg,
    fontWeight: font.bold,
    color: colors.text,
  },

  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  feedTitle: {
    flex: 1,
    fontSize: font.size.md,
    fontWeight: font.bold,
    color: colors.text,
  },
  feedPreview: {
    fontSize: font.size.sm,
    color: colors.textMuted,
    lineHeight: font.size.sm * 1.4,
    marginTop: 2,
  },
  feedMeta: { fontSize: font.size.xs, color: colors.textLight, marginTop: 5 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green[500],
  },

  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  dateCol: { width: 38, alignItems: 'center' },
  dateDay: {
    fontSize: font.size.lg,
    fontWeight: font.bold,
    color: colors.text,
    lineHeight: 20,
  },
  dateMonth: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.green[500],
  },
  dateYear: { fontSize: font.size.xs, color: colors.textLight },
  eventBar: {
    width: 2,
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 2,
  },
  eventTitle: {
    fontSize: font.size.md,
    fontWeight: font.bold,
    color: colors.text,
  },
  eventDesc: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 2 },
  eventMeta: { flexDirection: 'row', gap: 12, marginTop: 5, flexWrap: 'wrap' },
  metaItem: { fontSize: 10, color: colors.textLight },
  joinBtn: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinText: {
    color: colors.white,
    fontSize: font.size.sm,
    fontWeight: font.semibold,
  },
  joinBtnDone: { backgroundColor: colors.green[600] },

  // Hero — infos + actions
  heroInfo: { gap: 6, marginTop: 12 },
  heroInfoLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroInfoText: {
    flex: 1,
    fontSize: font.size.sm,
    color: colors.green[900],
    fontWeight: font.medium,
  },
  heroBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  heroCta: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  heroCtaPrimary: { backgroundColor: colors.primary },
  heroCtaPrimaryText: {
    color: colors.white,
    fontSize: font.size.sm,
    fontWeight: font.semibold,
  },
  heroCtaLime: { backgroundColor: colors.green[500] },
  heroCtaLimeText: {
    color: colors.white,
    fontSize: font.size.sm,
    fontWeight: font.semibold,
  },
  heroDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  heroDetailsText: {
    color: colors.white,
    fontSize: font.size.sm,
    fontWeight: font.semibold,
  },

  // Sous-onglets
  subTabs: { flexDirection: 'row', gap: 8 },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  subTabActive: { backgroundColor: colors.primary },
  subTabText: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.textMuted,
  },
  subTabTextActive: { color: colors.white },

  // Ligne événement (extras)
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventChip: { paddingHorizontal: 8, paddingVertical: 1 },
  eventDivider: { borderTopWidth: 2, borderTopColor: colors.surfaceAlt },
  monthHeader: {
    fontSize: font.size.md,
    fontWeight: font.bold,
    color: colors.primary,
    marginTop: 10,
    marginBottom: 2,
  },

  card: { borderRadius: radius.lg, ...cardShadow },
  empty: { fontSize: font.size.sm, color: colors.textMuted },
  annTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  annTitle: {
    flex: 1,
    fontSize: font.size.md,
    fontWeight: font.bold,
    color: colors.text,
  },
  annBody: {
    fontSize: font.size.sm,
    color: colors.textMuted,
    lineHeight: font.size.sm * 1.5,
    marginTop: 2,
  },
  annAuthor: {
    marginTop: 8,
    fontSize: font.size.xs,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  pollMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  voted: {
    fontSize: font.size.xs,
    color: colors.success,
    fontWeight: font.semibold,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  histDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: {
    fontSize: font.size.sm,
    fontWeight: font.bold,
    color: colors.green[500],
  },
  memberName: {
    fontSize: font.size.md,
    fontWeight: font.semibold,
    color: colors.text,
  },
  memberNum: { fontSize: font.size.xs, color: colors.textLight },
});
