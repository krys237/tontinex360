// screen-home.jsx — Accueil (Home)
function HomeScreen({ nav }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px' }}>
      {/* Greeting header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
        <span style={{ fontFamily: TX.font, fontSize: 24, fontWeight: 700, color: TX.text }}>Bonjour Paula,</span>
        <HeaderIconBtn icon="notifications-outline" badge="2" onClick={() => nav('notif')} />
      </div>

      {/* Status banner */}
      <div style={{ background: TX.gradLime, borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 14, boxShadow: TX.shadowCard }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="checkmark" size={20} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontFamily: TX.font, fontWeight: 700, fontSize: 15 }}>Vous êtes à jour&nbsp;! 😊</div>
          <div style={{ color: 'rgba(255,255,255,0.92)', fontFamily: TX.font, fontSize: 12 }}>Prochaine cotisation dans 5 jours</div>
        </div>
        <Icon name="chevron-forward" size={20} color="#fff" />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, background: TX.white, borderRadius: 16, padding: 16, boxShadow: TX.shadowCard, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ fontFamily: TX.font, fontSize: 12, fontWeight: 500, color: TX.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Tontine Horizon Plus</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: TX.font, fontSize: 22, fontWeight: 700, color: TX.primary, letterSpacing: -0.3 }}>125 000</span>
            <span style={{ fontFamily: TX.font, fontSize: 11, fontWeight: 600, color: TX.lime }}>Cfa</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Icon name="cash" size={20} color={TX.accent} />
          </div>
        </div>
        <div style={{ flex: 1, background: TX.white, borderRadius: 16, padding: 16, boxShadow: TX.shadowCard, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ fontFamily: TX.font, fontSize: 12, fontWeight: 500, color: TX.textMuted }}>Votre tour</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: TX.font, fontSize: 22, fontWeight: 700, color: TX.primary, letterSpacing: -0.3 }}>4ᵉ</span>
            <span style={{ fontFamily: TX.font, fontSize: 13, fontWeight: 500, color: TX.textMuted }}>sur 12</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Icon name="trophy" size={20} color={TX.accent} />
          </div>
        </div>
      </div>

      {/* Cotisations progress */}
      <Card>
        <SectionHeader title="Cotisations" action="Voir" onAction={() => nav('contribute')} />
        <ProgressBar value={6 / 12} />
        <div style={{ fontFamily: TX.font, fontSize: 12, color: TX.textMuted, marginTop: 8 }}>6 / 12 mois payés</div>
      </Card>

      {/* Primary CTA */}
      <button onClick={() => nav('contribute')} style={{
        minHeight: 56, borderRadius: 16, border: 'none', cursor: 'pointer', width: '100%',
        background: TX.gradPrimary, color: '#fff', boxShadow: TX.shadowLifted,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        fontFamily: TX.font, fontSize: 16, fontWeight: 600,
      }}>
        <Icon name="wallet" size={20} color="#fff" />
        Cotiser maintenant
      </button>

      {/* Activité récente */}
      <Card>
        <SectionHeader title="Activité récente" action="Voir" onAction={() => nav('notif')} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 10 }}>
          <IconBubble icon="checkmark" tint="lime" size={32} />
          <div style={{ flex: 1, fontFamily: TX.font, fontSize: 14, fontWeight: 500, color: TX.text }}>Paiement validé – 20 000 FCFA</div>
          <Icon name="checkmark-circle" size={20} color={TX.ok} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 10, borderTop: `1px solid ${TX.surface}` }}>
          <IconBubble icon="document-text" tint="primary" size={32} />
          <div style={{ flex: 1, fontFamily: TX.font, fontSize: 14, fontWeight: 500, color: TX.text }}>Demande de prêt envoyée</div>
          <Icon name="checkmark-circle" size={20} color={TX.ok} />
        </div>
      </Card>

      {/* No-delay banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: TX.dangerSoft, borderRadius: 16, padding: 14 }}>
        <Icon name="information-circle" size={18} color={TX.danger} />
        <span style={{ fontFamily: TX.font, fontSize: 14, fontWeight: 500, color: TX.danger }}>Aucun retard actuellement</span>
      </div>
    </div>
  );
}
window.HomeScreen = HomeScreen;
