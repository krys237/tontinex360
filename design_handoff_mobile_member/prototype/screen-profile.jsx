// screen-profile.jsx — Profil
function Switch({ on, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      width: 46, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 3,
      background: on ? TX.lime : TX.surfaceMuted, transition: 'background .15s', flexShrink: 0,
      display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
    }}>
      <span style={{ width: 22, height: 22, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'all .15s' }} />
    </button>
  );
}

function Row({ icon, tint, label, value, right, last, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer',
      borderTop: last === 'first' ? 'none' : `1px solid ${TX.surface}`,
    }}>
      <IconBubble icon={icon} tint={tint || 'lime'} size={36} />
      <span style={{ flex: 1, fontFamily: TX.font, fontSize: 14, fontWeight: 500, color: TX.text }}>{label}</span>
      {value && <span style={{ fontFamily: TX.font, fontSize: 13, color: TX.textMuted }}>{value}</span>}
      {right !== undefined ? right : <Icon name="chevron-forward" size={16} color={TX.textLight} />}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontFamily: TX.font, fontSize: 12, fontWeight: 600, color: TX.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, margin: '4px 4px 2px' }}>{children}</div>;
}

function ProfileScreen({ nav }) {
  const [notif, setNotif] = React.useState(true);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
        <span style={{ fontFamily: TX.font, fontSize: 24, fontWeight: 700, color: TX.text }}>Profil</span>
        <HeaderIconBtn icon="create" onClick={() => nav('edit')} />
      </div>

      {/* Profile hero */}
      <div style={{ background: TX.gradSoft, borderRadius: 24, padding: 20, boxShadow: TX.shadowCard }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: TX.gradLime, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TX.font, fontWeight: 700, fontSize: 24 }}>PK</div>
            <button onClick={() => nav('photo')} style={{ position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13, background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: TX.shadowCard }}>
              <Icon name="camera" size={14} color={TX.primary} />
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: TX.font, fontSize: 19, fontWeight: 700, color: TX.text }}>Paula Kamga</div>
            <div style={{ fontFamily: TX.font, fontSize: 13, color: TX.textMuted, marginTop: 1 }}>+237 6 90 12 34 56</div>
            <div style={{ marginTop: 8 }}><Chip tint="green" style={{ padding: '3px 11px' }}>Membre</Chip></div>
          </div>
        </div>

        {/* mini info row */}
        <div style={{ display: 'flex', background: '#fff', borderRadius: 16, padding: 14, marginTop: 16, boxShadow: TX.shadowCard }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: TX.font, fontSize: 15, fontWeight: 700, color: TX.primary }}>3</div>
            <div style={{ fontFamily: TX.font, fontSize: 10, color: TX.textMuted }}>Tontines</div>
          </div>
          <div style={{ width: 1, background: TX.surface }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: TX.font, fontSize: 15, fontWeight: 700, color: TX.text }}>#042</div>
            <div style={{ fontFamily: TX.font, fontSize: 10, color: TX.textMuted }}>N° membre</div>
          </div>
          <div style={{ width: 1, background: TX.surface }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: TX.font, fontSize: 15, fontWeight: 700, color: TX.text }}>Jan 2024</div>
            <div style={{ fontFamily: TX.font, fontSize: 10, color: TX.textMuted }}>Membre depuis</div>
          </div>
        </div>
      </div>

      {/* Compte */}
      <div>
        <SectionLabel>Compte</SectionLabel>
        <Card>
          <Row icon="create" tint="lime" label="Modifier mon profil" last="first" onClick={() => nav('edit')} />
          <Row icon="lock-closed" tint="primary" label="Changer le mot de passe" onClick={() => nav('password')} />
          <Row icon="shield-checkmark" tint="accent" label="Sécurité & connexion" onClick={() => nav('security')} />
        </Card>
      </div>

      {/* Préférences */}
      <div>
        <SectionLabel>Préférences</SectionLabel>
        <Card>
          <Row icon="notifications-outline" tint="primary" label="Notifications" last="first"
               right={<Switch on={notif} onToggle={() => setNotif(v => !v)} />} onClick={() => setNotif(v => !v)} />
          <Row icon="globe" tint="info" label="Langue · Language" value="Français" onClick={() => nav('lang')} />
        </Card>
      </div>

      {/* Mon association */}
      <div>
        <SectionLabel>Mon association</SectionLabel>
        <Card>
          <Row icon="business" tint="lime" label="Mon adhésion" value="Horizon" last="first" onClick={() => nav('membership')} />
          <Row icon="document-text" tint="primary" label="Mes procurations" onClick={() => nav('proxies')} />
        </Card>
      </div>

      {/* Support */}
      <div>
        <SectionLabel>Support</SectionLabel>
        <Card>
          <Row icon="help-circle" tint="lime" label="Aide & FAQ" last="first" onClick={() => nav('help')} />
          <Row icon="document-text" tint="primary" label="Conditions d'utilisation" onClick={() => nav('terms')} />
          <Row icon="information-circle" tint="info" label="À propos" value="v1.0.0" onClick={() => nav('about')} />
        </Card>
      </div>

      {/* Logout */}
      <button onClick={() => nav('logout')} style={{
        minHeight: 52, borderRadius: 999, cursor: 'pointer', width: '100%',
        background: TX.dangerSoft, color: TX.dangerDark, border: `1px solid ${TX.danger}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: TX.font, fontSize: 15, fontWeight: 600,
      }}>
        <Icon name="log-out" size={18} color={TX.dangerDark} />
        Se déconnecter
      </button>

      <div style={{ textAlign: 'center', fontFamily: TX.font, fontSize: 11, color: TX.textLight, paddingBottom: 4 }}>
        TontineX360 · TIM SARL · Douala
      </div>
    </div>
  );
}
window.ProfileScreen = ProfileScreen;
