// screen-contribute.jsx — Cotiser (Cotisations)
function ContributeScreen({ nav }) {
  const months = [
    { m: 'Mai 2024', paid: '12 Mai 2024', amt: '30 000 FCFA' },
    { m: 'Avril 2024', paid: '12 Avr 2024', amt: '30 000 FCFA' },
    { m: 'Mars 2024', paid: '12 Mar 2024', amt: '30 000 FCFA' },
    { m: 'Février 2024', paid: '12 Fév 2024', amt: '30 000 FCFA' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px' }}>
      {/* Hero card */}
      <div style={{ background: TX.gradSoft, borderRadius: 24, padding: 18, boxShadow: TX.shadowCard }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: TX.font, fontSize: 14, color: TX.textDark, display: 'flex', alignItems: 'center', gap: 5 }}>Bonjour 🙂</div>
            <div style={{ fontFamily: TX.font, fontSize: 22, fontWeight: 700, color: TX.text, marginTop: 2 }}>Paul KAMGA</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ fontFamily: TX.font, fontSize: 14, fontWeight: 600, color: TX.primary }}>Tontine Espoir Plus</span>
              <Chip tint="green" style={{ padding: '2px 9px', fontSize: 11 }}>Groupe A</Chip>
            </div>
          </div>
          <img src="../assets/illustrations/piggy-bank.png" alt="" style={{ width: 86, height: 86, objectFit: 'contain', marginTop: -4 }} />
        </div>

        {/* white sub-card: two columns */}
        <div style={{ background: TX.white, borderRadius: 16, padding: 16, marginTop: 14, display: 'flex', boxShadow: TX.shadowCard }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: TX.font, fontSize: 12, color: TX.textMuted, marginBottom: 6 }}>Statut global</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon name="checkmark-circle" size={20} color={TX.ok} />
              <span style={{ fontFamily: TX.font, fontSize: 19, fontWeight: 700, color: TX.primary }}>À jour</span>
            </div>
            <div style={{ fontFamily: TX.font, fontSize: 11, color: TX.textLight, marginTop: 6, lineHeight: 1.4 }}>Félicitations ! Vous êtes à jour dans votre cotisation.</div>
          </div>
          <div style={{ width: 1, background: TX.surface, margin: '0 14px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: TX.font, fontSize: 12, color: TX.textMuted, marginBottom: 6 }}>Prochaine échéance</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon name="calendar" size={18} color={TX.accent} />
              <span style={{ fontFamily: TX.font, fontSize: 17, fontWeight: 700, color: TX.text }}>15 Juin 2026</span>
            </div>
            <div style={{ fontFamily: TX.font, fontSize: 11, color: TX.accent, marginTop: 6, fontWeight: 500 }}>Dans 2 semaines</div>
          </div>
        </div>
      </div>

      {/* Three stat tiles */}
      <div style={{ display: 'flex', gap: 12 }}>
        <MiniStat label="Total cotisé" value="150 000" hint="fcfa" />
        <MiniStat label="Mois payés" value="4 / 12" icon="checkmark-circle" iconColor={TX.ok} />
        <MiniStat label="Mois en retard" value="0" icon="calendar-clear" iconColor={TX.danger} />
      </div>

      {/* CTA */}
      <button onClick={() => nav('proof')} style={{
        minHeight: 56, borderRadius: 16, border: 'none', cursor: 'pointer', width: '100%',
        background: TX.gradPrimary, color: '#fff', boxShadow: TX.shadowLifted,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        fontFamily: TX.font, fontSize: 16, fontWeight: 600,
      }}>
        <Icon name="wallet" size={20} color="#fff" />
        Cotiser maintenant
      </button>

      {/* History */}
      <Card>
        <SectionHeader title="Aperçu des cotisations" action="Voir historique" onAction={() => nav('history')} />
        {months.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${TX.surface}` : 'none' }}>
            <Icon name="checkmark-circle" size={22} color={TX.ok} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: TX.font, fontSize: 14, fontWeight: 600, color: TX.text }}>{row.m}</div>
              <div style={{ fontFamily: TX.font, fontSize: 11, color: TX.textLight }}>Payé le {row.paid}</div>
            </div>
            <span style={{ fontFamily: TX.font, fontSize: 14, fontWeight: 700, color: TX.primary }}>{row.amt}</span>
            <Icon name="chevron-forward" size={16} color={TX.textLight} />
          </div>
        ))}
      </Card>
    </div>
  );
}

function MiniStat({ label, value, hint, icon, iconColor }) {
  return (
    <div style={{ flex: 1, background: TX.white, borderRadius: 16, padding: 14, boxShadow: TX.shadowCard, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center', minWidth: 0 }}>
      {icon ? <Icon name={icon} size={18} color={iconColor} /> : <div style={{ height: 18 }} />}
      <span style={{ fontFamily: TX.font, fontSize: 12, color: TX.textMuted, marginTop: 2 }}>{label}</span>
      <span style={{ fontFamily: TX.font, fontSize: 15, fontWeight: 700, color: TX.text }}>{value}</span>
      {hint && <span style={{ fontFamily: TX.font, fontSize: 10, color: TX.textLight }}>{hint}</span>}
    </div>
  );
}
window.ContributeScreen = ContributeScreen;
