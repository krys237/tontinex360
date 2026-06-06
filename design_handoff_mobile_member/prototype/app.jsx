// app.jsx — Tontinex360 mobile UI kit shell (tab nav + device frame)

const TABS = [
  { key: 'home', label: 'Accueil', icon: 'home' },
  { key: 'tontines', label: 'Tontines', icon: 'layers' },
  { key: 'community', label: 'Communauté', icon: 'people' },
  { key: 'finances', label: 'Finances', icon: 'wallet' },
  { key: 'profile', label: 'Profil', icon: 'person' },
];

function TabBar({ active, onChange }) {
  return (
    <div style={{
      display: 'flex', background: TX.white, borderTop: `1px solid ${TX.surface}`,
      paddingTop: 8, paddingBottom: 26,
    }}>
      {TABS.map(t => {
        const on = active === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)} style={{
            flex: 1, background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: 0,
          }}>
            <Icon name={t.icon} size={22} color={on ? TX.primary : TX.textLight} />
            <span style={{ fontFamily: TX.font, fontSize: 10, fontWeight: 500, color: on ? TX.primary : TX.textLight }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Toast for nav feedback (since this is a cosmetic prototype)
function useToast() {
  const [msg, setMsg] = React.useState(null);
  const show = (m) => { setMsg(m); clearTimeout(window.__tt); window.__tt = setTimeout(() => setMsg(null), 1600); };
  return [msg, show];
}

function StubScreen({ icon, illustration, title, body }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 28px', gap: 14, minHeight: 460 }}>
      {illustration
        ? <img src={illustration} alt="" style={{ width: 120, height: 120, objectFit: 'contain' }} />
        : <IconBubble icon={icon} tint="lime" size={72} />}
      <div style={{ fontFamily: TX.font, fontSize: 19, fontWeight: 700, color: TX.text }}>{title}</div>
      <div style={{ fontFamily: TX.font, fontSize: 14, color: TX.textMuted, lineHeight: 1.5, maxWidth: 260 }}>{body}</div>
      <div style={{ marginTop: 6, fontFamily: TX.font, fontSize: 11, color: TX.textLight, background: TX.surface, borderRadius: 999, padding: '6px 12px' }}>
        Écran non fourni dans les références — placeholder
      </div>
    </div>
  );
}

function App() {
  const [active, setActive] = React.useState('home');
  const [toast, showToast] = useToast();
  const nav = (where) => showToast('Action : ' + where);

  let screen;
  if (active === 'home') screen = <HomeScreen nav={(w) => { if (w === 'contribute' || w === 'tontines') setActive('tontines'); else nav(w); }} />;
  else if (active === 'tontines') screen = <ContributeScreen nav={nav} />;
  else if (active === 'finances') screen = <FinancesScreen nav={nav} />;
  else if (active === 'community') screen = <CommunityScreen nav={nav} />;
  else if (active === 'profile') screen = <ProfileScreen nav={nav} />;

  return (
    <IOSDevice>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: TX.background }}>
        {/* Scrollable screen content */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 54, paddingBottom: 18 }}>
          {screen}
        </div>
        {/* Tab bar */}
        <TabBar active={active} onChange={setActive} />
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 110, transform: 'translateX(-50%)', zIndex: 80,
          background: 'rgba(30,50,51,0.94)', color: '#fff', fontFamily: TX.font, fontSize: 13, fontWeight: 500,
          padding: '10px 18px', borderRadius: 999, whiteSpace: 'nowrap', boxShadow: TX.shadowLifted,
        }}>{toast}</div>
      )}
    </IOSDevice>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
