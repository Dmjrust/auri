import React from 'react';
import { P, PL, MU, BO, INK, SEC, DES, DESL, SUC, SUCL, WARN, WARNL } from '../lib/design';

export const Badge = ({ children, color = P, bg = PL }: { children: React.ReactNode; color?: string; bg?: string }) => (
  <span style={{ background: bg, color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    {children}
  </span>
);

export const Pill = ({ type }: { type: string }) => {
  if (type === 'primeira vez') return <Badge color={DES} bg={DESL}>Primeira vez</Badge>;
  return <Badge color={SUC} bg={SUCL}>Retorno</Badge>;
};

// Z-escore badge com cor por classificação OMS
export const ZBadge = ({ z }: { z: number | null }) => {
  if (z === null || isNaN(z)) return null;
  const abs = Math.abs(z);
  const [col, bg, bord] = abs > 2
    ? [DES,  '#FEF2F2', '#FECACA']
    : abs > 1
    ? [WARN, WARNL,     '#F3C07B']
    : [SUC,  SUCL,      '#BBF7D0'];
  const sign = z >= 0 ? '+' : '';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 5px', borderRadius: 4, fontSize: 11, fontWeight: 700, color: col, background: bg, border: `1px solid ${bord}`, fontFamily: '"JetBrains Mono", "Fira Mono", monospace', fontFeatureSettings: '"tnum"', letterSpacing: '-0.01em' }}>
      Z {sign}{z.toFixed(1)}
    </span>
  );
};

export const StatusDot = ({ status }: { status: string }) => {
  const map: Record<string, string> = { completed: SUC, in_progress: P, scheduled: MU };
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: map[status] || MU, display: 'inline-block', flexShrink: 0 }} />;
};

export const Card = ({ children, style = {}, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) => (
  <div style={{ background: '#fff', border: `1px solid ${BO}`, borderRadius: 10, boxShadow: '0 1px 2px rgba(15,76,92,0.05)', ...style }} onClick={onClick}>{children}</div>
);

export const Btn = ({
  children, onClick, variant = 'primary', size = 'md', disabled = false, style = {},
}: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary'|'secondary'|'ghost'|'danger';
  size?: 'sm'|'md'|'lg'; disabled?: boolean; style?: React.CSSProperties;
}) => {
  const v: Record<string, React.CSSProperties> = {
    primary:   { background: P, color: '#fff', border: `1px solid ${P}` },
    secondary: { background: SEC, color: INK, border: `1px solid ${BO}` },
    ghost:     { background: 'transparent', color: P, border: '1px solid transparent' },
    danger:    { background: DES, color: '#fff', border: `1px solid ${DES}` },
  };
  const s: Record<string, React.CSSProperties> = {
    sm: { fontSize: 12, padding: '5px 12px' },
    md: { fontSize: 13, padding: '8px 16px' },
    lg: { fontSize: 14, padding: '11px 22px' },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...v[variant], ...s[size], borderRadius: 6, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', transition: 'filter 0.15s, opacity 0.15s', ...style }}
    >{children}</button>
  );
};

export const Tabs = ({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) => (
  <div style={{ display: 'flex', borderBottom: `1px solid ${BO}` }}>
    {tabs.map(t => (
      <button key={t} onClick={() => onChange(t)}
        style={{ padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: active === t ? 600 : 400, color: active === t ? P : MU, borderBottom: active === t ? `2px solid ${P}` : '2px solid transparent', fontSize: 13, fontFamily: 'inherit', transition: 'all 0.15s', letterSpacing: active === t ? 0 : '0.01em' }}
      >{t}</button>
    ))}
  </div>
);
