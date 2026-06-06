// screen-finances.jsx — Finances
function FinancesScreen({ nav }) {
  const actions = [
    { icon: 'arrow-up', label: 'Retrait', sub: 'Mobile money' },
    { icon: 'swap-horizontal', label: 'Transférer', sub: 'À un membre' },
    { icon: 'help-circle', label: 'Demander', sub: 'Retrait' },
    { icon: 'document-text', label: 'Relevé', sub: 'Télécharger' },
  ];
  const tx = [
    { dot: TX.ok, label: 'Cotisation #Mai2026', sub: 'Payé le 12 Mai 2024', amt: '-5000 fcfa', amtColor: TX.text, date: '12 Mai 2026' },
    { dot: TX.lime, label: 'Distribution', sub: 'Cycle 2026 - Séance 4', amt: '+25 000 fcfa', amtColor: TX.primary, date: '05 Mai 2026' },
    { dot: TX.ok, label: 'Remboursement prêt', sub: 'Prêt N°PRT-2026-015', amt: '-10 000 fcfa', amtColor: TX.text, date: '05 Mai 2026' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px' }}>
      {/* Wallet hero */}
      <div style={{ background: TX.gradSoft, borderRadius: 24, padding: 18, boxShadow: TX.shadowCard }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: TX.font, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: TX.textMuted }}>Solde disponible</span>
              <Icon name="eye-outline" size={15} color={TX.textMuted} />
            </div>
            <div style={{ fontFamily: TX.font, fontSize: 32, fontWeight: 700, color: TX.primary, letterSpacing: -0.5, marginTop: 4 }}>125 750 <span style={{ fontSize: 20 }}>FCFA</span></div>
            <div style={{ fontFamily: TX.font, fontSize: 12, color: TX.textLight, marginTop: 2 }}>129.00 USD</div>
          </div>
          <img src="../assets/illustrations/farmer-wallet.png" alt="" style={{ width: 92, height: 92, objectFit: 'contain', marginTop: -2 }} />
        </div>

        <div style={{ background: TX.white, borderRadius: 16, padding: 14, marginTop: 12, display: 'flex', alignItems: 'center', boxShadow: TX.shadowCard }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconBubble icon="arrow-down-circle" tint="lime" size={32} />
            <div>
              <div style={{ fontFamily: TX.font, fontSize: 11, color: TX.textMuted }}>Argent engagé</div>
              <div style={{ fontFamily: TX.font, fontSize: 14, fontWeight: 700, color: TX.text }}>45 000 fcfa</div>
              <div style={{ fontFamily: TX.font, fontSize: 10, color: TX.textLight }}>Prêt en cours</div>
            </div>
          </div>
          <div style={{ width: 1, background: TX.surface, alignSelf: 'stretch', margin: '0 12px' }} />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconBubble icon="wallet" tint="primary" size={32} />
            <div>
              <div style={{ fontFamily: TX.font, fontSize: 11, color: TX.textMuted }}>Gains totaux</div>
              <div style={{ fontFamily: TX.font, fontSize: 14, fontWeight: 700, color: TX.text }}>78 250 fcfa</div>
              <div style={{ fontFamily: TX.font, fontSize: 10, color: TX.textLight }}>Ce cycle</div>
            </div>
            <Icon name="chevron-forward" size={16} color={TX.textLight} />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <div style={{ fontFamily: TX.font, fontSize: 17, fontWeight: 700, color: TX.text, marginBottom: 12 }}>Actions rapides</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {actions.map((a, i) => (
            <button key={i} onClick={() => nav(a.label)} style={{ flex: 1, background: TX.white, borderRadius: 16, border: 'none', cursor: 'pointer', padding: '14px 6px', boxShadow: TX.shadowCard, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <Icon name={a.icon} size={22} color={TX.primary} />
              <span style={{ fontFamily: TX.font, fontSize: 12, fontWeight: 600, color: TX.text }}>{a.label}</span>
              <span style={{ fontFamily: TX.font, fontSize: 9, color: TX.textLight, textAlign: 'center' }}>{a.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Next due */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: TX.font, fontSize: 12, color: TX.textMuted, marginBottom: 6 }}>Prochaine échéance</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="calendar" size={17} color={TX.primary} />
              <span style={{ fontFamily: TX.font, fontSize: 16, fontWeight: 700, color: TX.primary }}>15 Juin 2026</span>
            </div>
            <div style={{ fontFamily: TX.font, fontSize: 11, color: TX.accent, marginTop: 4, fontWeight: 500 }}>Dans 2 semaines</div>
          </div>
          <div style={{ width: 1, background: TX.surface, alignSelf: 'stretch', margin: '0 14px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: TX.font, fontSize: 12, color: TX.textMuted, marginBottom: 6 }}>Montant à payer</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Icon name="checkmark-circle" size={17} color={TX.ok} />
              <span style={{ fontFamily: TX.font, fontSize: 16, fontWeight: 700, color: TX.text }}>5 000 fcfa</span>
            </div>
            <button onClick={() => nav('pay')} style={{ width: '100%', minHeight: 40, borderRadius: 999, border: `1px solid ${TX.primary}`, background: TX.white, color: TX.primary, fontFamily: TX.font, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              Payer maintenant <Icon name="chevron-forward" size={14} color={TX.primary} />
            </button>
          </div>
        </div>
      </Card>

      {/* Transactions */}
      <Card>
        <SectionHeader title="Dernières transactions" action="Voir historique" onAction={() => nav('history')} />
        {tx.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${TX.surface}` : 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: TX.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="checkmark" size={15} color={t.dot} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: TX.font, fontSize: 14, fontWeight: 600, color: TX.text }}>{t.label}</div>
              <div style={{ fontFamily: TX.font, fontSize: 11, color: TX.textLight }}>{t.sub}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: TX.font, fontSize: 14, fontWeight: 700, color: t.amtColor }}>{t.amt}</div>
              <div style={{ fontFamily: TX.font, fontSize: 10, color: t.amtColor === TX.primary ? TX.lime : TX.textLight }}>{t.date}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
window.FinancesScreen = FinancesScreen;
