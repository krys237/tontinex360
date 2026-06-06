// screen-community.jsx — Communauté
function CommunityScreen({ nav }) {
  const [tab, setTab] = React.useState('Réunions');
  const [subTab, setSubTab] = React.useState('À venir');
  const tabs = [
    { key: 'Fil d’actualité', icon: 'newspaper-outline' },
    { key: 'Réunions', icon: 'chatbubble-ellipses' },
    { key: 'Votes', icon: 'mail-outline' },
    { key: 'Membres', icon: 'people-outline' },
  ];
  const events = [1, 2, 3];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 8 }}>
        <div>
          <div style={{ fontFamily: TX.font, fontSize: 24, fontWeight: 700, color: TX.text }}>Communauté</div>
          <div style={{ fontFamily: TX.font, fontSize: 13, color: TX.textMuted, marginTop: 2 }}>Restez informé. Restez connecté.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <HeaderIconBtn icon="calendar-outline" onClick={() => nav('cal')} />
          <HeaderIconBtn icon="notifications-outline" badge="2" onClick={() => nav('notif')} />
        </div>
      </div>

      {/* Top tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              background: active ? TX.gradLime : 'transparent', color: active ? '#fff' : TX.textMuted,
              fontFamily: TX.font, fontSize: 13, fontWeight: 600,
            }}>
              <Icon name={t.icon} size={15} color={active ? '#fff' : TX.textMuted} />
              {t.key}
            </button>
          );
        })}
      </div>

      {/* Bureau announcement hero */}
      <div style={{ background: TX.gradSoft, borderRadius: 24, padding: 18, boxShadow: TX.shadowCard }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: TX.font, fontSize: 12, color: TX.textMuted }}>Annonce du bureau</div>
            <div style={{ fontFamily: TX.font, fontSize: 17, fontWeight: 700, color: TX.primary, marginTop: 4, lineHeight: 1.25 }}>Réunion générale du mois de Juin</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              <InfoLine icon="calendar" text="Samedi 15 Juin 2025" />
              <InfoLine icon="time" text="18h00 - 20h00" />
              <InfoLine icon="location" text="Yaoundé - Bastos, Salle Horizon" />
            </div>
          </div>
          <img src="../assets/illustrations/calendar-meeting.png" alt="" style={{ width: 96, height: 96, objectFit: 'contain', alignSelf: 'flex-start' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Button label="Confirmer ma présence" variant="primary" onPress={() => nav('confirm')} style={{ flex: 1, minHeight: 46, fontSize: 13, padding: '0 12px' }} />
          <Button label="Voir les détails" variant="lime" onPress={() => nav('details')} style={{ flex: 1, minHeight: 46, fontSize: 13, padding: '0 12px' }} />
        </div>
      </div>

      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {['À venir', 'Passées', 'Calendrier'].map(s => {
          const active = subTab === s;
          return (
            <button key={s} onClick={() => setSubTab(s)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 999,
              border: 'none', cursor: 'pointer',
              background: active ? TX.gradLime : 'transparent', color: active ? '#fff' : TX.textMuted,
              fontFamily: TX.font, fontSize: 13, fontWeight: 600,
            }}>
              <Icon name={s === 'Calendrier' ? 'calendar-outline' : s === 'Passées' ? 'time-outline' : 'calendar'} size={14} color={active ? '#fff' : TX.textMuted} />
              {s}
            </button>
          );
        })}
      </div>

      <div style={{ fontFamily: TX.font, fontSize: 17, fontWeight: 700, color: TX.text }}>Évènement à venir</div>

      {/* Event rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {events.map((e, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: i ? `1px solid ${TX.surface}` : 'none' }}>
            <div style={{ textAlign: 'center', flexShrink: 0, width: 38 }}>
              <div style={{ fontFamily: TX.font, fontSize: 18, fontWeight: 700, color: TX.text, lineHeight: 1 }}>25</div>
              <div style={{ fontFamily: TX.font, fontSize: 11, color: TX.lime, fontWeight: 600 }}>Mai</div>
              <div style={{ fontFamily: TX.font, fontSize: 10, color: TX.textLight }}>2026</div>
            </div>
            <div style={{ width: 2, alignSelf: 'stretch', background: TX.surfaceMuted, borderRadius: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: TX.font, fontSize: 14, fontWeight: 700, color: TX.text }}>Réunion mensuelle</span>
                <Chip tint="gold" style={{ padding: '1px 8px', fontSize: 10 }}>Obligatoire</Chip>
              </div>
              <div style={{ fontFamily: TX.font, fontSize: 12, color: TX.textMuted, marginTop: 2 }}>Bilan du cycle et perspective</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: TX.font, fontSize: 10, color: TX.textLight }}><Icon name="time-outline" size={11} color={TX.textLight} /> 18h00 - 20h00</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: TX.font, fontSize: 10, color: TX.textLight }}><Icon name="location-outline" size={11} color={TX.textLight} /> Bastos</span>
              </div>
            </div>
            <button onClick={() => nav('join')} style={{ flexShrink: 0, minHeight: 38, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer', background: TX.primary, color: '#fff', fontFamily: TX.font, fontSize: 12, fontWeight: 600 }}>Je participe</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoLine({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <Icon name={icon} size={14} color={TX.primary} />
      <span style={{ fontFamily: TX.font, fontSize: 13, color: TX.textDark, fontWeight: 500 }}>{text}</span>
    </div>
  );
}
window.CommunityScreen = CommunityScreen;
