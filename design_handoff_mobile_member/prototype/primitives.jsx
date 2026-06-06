// primitives.jsx — Tontinex360 shared UI primitives
// Colors mirror src/theme/index.ts. Exposed on window for cross-file use.

const TX = {
  primary: '#43793F', primaryDark: '#3D6A2A', primaryDarker: '#232B1D',
  primaryLight: '#5A8C3F', primarySoft: '#97BD4D', lime: '#87C241', limeSoft: '#A8D26A',
  greenBg: '#F1F8E8', greenBgDeep: '#E0F0CC',
  accent: '#E5BC2C', accentLight: '#EDD743', accentSoft: '#FBF6CF', accentBeige: '#EFDB99',
  danger: '#9A5356', dangerDark: '#7A4044', dangerSoft: '#FCE7E7',
  white: '#FFFFFF', background: '#FAFAFA', surface: '#F4F4F5', surfaceMuted: '#EBEBEB',
  border: '#DFDEDE', textLight: '#A0A0A0', textMuted: '#707070', textDark: '#47563D',
  text: '#1E3233', ok: '#34C759', info: '#007AFF',
  font: "'Poppins', -apple-system, system-ui, sans-serif",
  shadowCard: '0 2px 8px rgba(67,121,63,0.08)',
  shadowLifted: '0 8px 24px rgba(67,121,63,0.12)',
  gradLime: 'linear-gradient(135deg, #87C241, #43793F)',
  gradPrimary: 'linear-gradient(135deg, #43793F, #3D6A2A)',
  gradSoft: 'linear-gradient(135deg, #F1F8E8, #E0F0CC)',
};

// Icon comes from icons.jsx (inline SVG, loaded before this file)

// Soft tinted circular icon container
const BUBBLE_TINTS = {
  lime: { bg: TX.greenBg, fg: TX.lime },
  primary: { bg: TX.greenBgDeep, fg: TX.primary },
  accent: { bg: TX.accentSoft, fg: TX.accent },
  danger: { bg: TX.dangerSoft, fg: TX.danger },
  info: { bg: '#E0F2FE', fg: TX.info },
};
function IconBubble({ icon, size = 40, tint = 'lime', style = {} }) {
  const t = BUBBLE_TINTS[tint] || BUBBLE_TINTS.lime;
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2, background: t.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style,
    }}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={t.fg} />
    </div>
  );
}

function Card({ children, style = {}, flat = false, pad = 16, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: TX.white, borderRadius: 16, padding: pad,
      boxShadow: flat ? 'none' : TX.shadowCard, ...style,
    }}>{children}</div>
  );
}

function Button({ label, onPress, variant = 'primary', iconLeft, iconRight, style = {} }) {
  const [pressed, setPressed] = React.useState(false);
  const variants = {
    primary: { background: TX.primary, color: TX.white },
    lime: { background: TX.lime, color: TX.white },
    secondary: { background: TX.white, color: TX.text, border: `1px solid ${TX.border}` },
    ghost: { background: 'transparent', color: TX.textMuted, minHeight: 44 },
    danger: { background: TX.dangerSoft, color: TX.dangerDark, border: `1px solid ${TX.danger}` },
  };
  return (
    <button
      onClick={onPress}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        minHeight: 56, borderRadius: 999, border: 'none', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '0 24px', fontFamily: TX.font, fontSize: 16, fontWeight: 600, letterSpacing: 0.2,
        transition: 'opacity .12s, transform .12s',
        opacity: pressed ? 0.85 : 1, transform: pressed ? 'scale(0.99)' : 'none',
        ...variants[variant], ...style,
      }}>
      {iconLeft}{label}{iconRight}
    </button>
  );
}

const CHIP_TINTS = {
  green: { bg: TX.greenBgDeep, fg: TX.primary },
  gold: { bg: TX.accentSoft, fg: '#9a7b10' },
  danger: { bg: TX.dangerSoft, fg: TX.dangerDark },
  grey: { bg: TX.surface, fg: TX.textMuted },
};
function Chip({ children, tint = 'green', style = {} }) {
  const t = CHIP_TINTS[tint] || CHIP_TINTS.green;
  return (
    <span style={{
      padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: t.bg, color: t.fg, display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: TX.font, ...style,
    }}>{children}</span>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ fontFamily: TX.font, fontSize: 16, fontWeight: 600, color: TX.text }}>{title}</span>
      {action && (
        <span onClick={onAction} style={{ fontFamily: TX.font, fontSize: 13, fontWeight: 600, color: TX.primary, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {action}
        </span>
      )}
    </div>
  );
}

function ProgressBar({ value = 0.5, height = 10 }) {
  return (
    <div style={{ height, background: TX.surfaceMuted, borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(1, value) * 100}%`, background: TX.gradLime, borderRadius: 999, transition: 'width .4s' }} />
    </div>
  );
}

// Stat tile — white card with corner icon bubble + green value
function StatTile({ label, value, hint, icon, tint = 'lime' }) {
  return (
    <div style={{ flex: 1, background: TX.white, borderRadius: 16, padding: 16, boxShadow: TX.shadowCard, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: TX.font, fontSize: 12, fontWeight: 500, color: TX.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {icon && <IconBubble icon={icon} tint={tint} size={32} />}
      </div>
      <span style={{ fontFamily: TX.font, fontSize: 22, fontWeight: 700, color: TX.primary, letterSpacing: -0.3 }}>{value}</span>
      {hint && <span style={{ fontFamily: TX.font, fontSize: 11, color: TX.textLight }}>{hint}</span>}
    </div>
  );
}

// Avatar — initials on tinted circle
function Avatar({ name = '', size = 44, tint = 'lime' }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const t = BUBBLE_TINTS[tint] || BUBBLE_TINTS.lime;
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: t.bg, color: t.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TX.font, fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// Round shadowed header icon button (bell, calendar...)
function HeaderIconBtn({ icon, badge, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 44, height: 44, borderRadius: 16, background: TX.white, border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: TX.shadowCard, position: 'relative',
    }}>
      <Icon name={icon} size={22} color={TX.primary} />
      {badge ? (
        <span style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: TX.danger, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TX.font }}>{badge}</span>
      ) : null}
    </button>
  );
}

Object.assign(window, {
  TX, IconBubble, Card, Button, Chip, SectionHeader, ProgressBar, StatTile, Avatar, HeaderIconBtn,
});
