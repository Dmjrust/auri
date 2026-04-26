import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { supabase } from './lib/supabase';
import * as db from './lib/db';
import * as ai from './lib/ai';
import { SmokeyBackground, LoginForm } from './components/ui/login-form';
import {
  SquaresFour, Users, CalendarBlank, GearSix, SignOut, Bell, MagnifyingGlass, CaretRight,
  Play, Square, CheckCircle, Clock, Warning, Info, ArrowLeft, Plus,
  Microphone, FileText, TrendUp, Stethoscope, X, DownloadSimple, User,
  Baby, Heartbeat, Syringe, CaretDown, CaretUp, CaretLeft,
  FloppyDisk, Buildings, Brain, ShieldCheck, PlayCircle,
} from '@phosphor-icons/react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  CONSULTATIONS, GROWTH_DATA, VACCINES, INSIGHTS,
  OMS_WEIGHT_BOY, OMS_HEIGHT_BOY, OMS_WEIGHT_GIRL, OMS_HEIGHT_GIRL,
  type Patient, type Consultation, type StructuredSummary, type ScannableSummary,
} from './data/mock';
import './index.css';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const TODAY = '2026-04-21';
function calcAge(bd: string) {
  const b = new Date(bd), n = new Date(TODAY);
  let y = n.getFullYear() - b.getFullYear(), m = n.getMonth() - b.getMonth();
  if (m < 0) { y--; m += 12; }
  if (n.getDate() < b.getDate()) m = Math.max(0, m - 1);
  if (y === 0) return `${m} ${m === 1 ? 'mês' : 'meses'}`;
  if (y === 1) return m === 0 ? '1 ano' : `1 ano e ${m}m`;
  return m === 0 ? `${y} anos` : `${y} anos e ${m}m`;
}
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function fmtTimer(s: number) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function primaryGuardian(p: Patient) {
  return p.guardians.find(g => g.is_primary) || p.guardians[0];
}

// ─── RESPONSIVE ──────────────────────────────────────────────────────────────
const MobileCtx = createContext(false);
const useIsMobile = () => useContext(MobileCtx);

// ─── PRONTUÁRIO FORMAT CONTEXT ────────────────────────────────────────────────
type ProntuarioFormat = 'narrativo' | 'escaneavel';
const ProntuarioFormatCtx = createContext<{ format: ProntuarioFormat; setFormat: (f: ProntuarioFormat) => void }>({ format: 'narrativo', setFormat: () => {} });

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const P = '#0F4C5C', PL = '#DCE9EC';
const ACCENT = '#E8825B', ACCENTL = '#FDEEE8';
const INK = '#1C2A2E';
// Gender indicator colours (semantic product constants)
const FEMALE = '#db2777', FEMALEL = '#fce7f3';
const MU = '#6E7B80', BO = '#E2EBEC', BG = '#F7F3EC', SEC = '#EBE5D8';
const SUC = '#3D7A5A', SUCL = '#EBF5EE', WARN = '#C47F2D', WARNL = '#FAF1E4';
const DES = '#9A3A2A', DESL = '#F9ECEB';

// ─── MICRO COMPONENTS ────────────────────────────────────────────────────────
const Badge = ({ children, color = P, bg = PL }: { children: React.ReactNode; color?: string; bg?: string }) => (
  <span style={{ background: bg, color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    {children}
  </span>
);

const Pill = ({ type }: { type: string }) => {
  if (type === 'primeira vez') return <Badge color={DES} bg={DESL}>Primeira vez</Badge>;
  return <Badge color={SUC} bg={SUCL}>Retorno</Badge>;
};

const StatusDot = ({ status }: { status: string }) => {
  const map: Record<string, string> = { completed: SUC, in_progress: P, scheduled: MU };
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: map[status] || MU, display: 'inline-block', flexShrink: 0 }} />;
};

const Card = ({ children, style = {}, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) => (
  <div style={{ background: '#fff', border: `1px solid ${BO}`, borderRadius: 10, boxShadow: '0 1px 2px rgba(15,76,92,0.05)', ...style }} onClick={onClick}>{children}</div>
);

const Btn = ({
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

const Tabs = ({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) => (
  <div style={{ display: 'flex', borderBottom: `1px solid ${BO}` }}>
    {tabs.map(t => (
      <button key={t} onClick={() => onChange(t)}
        style={{ padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: active === t ? 600 : 400, color: active === t ? P : MU, borderBottom: active === t ? `2px solid ${P}` : '2px solid transparent', fontSize: 13, fontFamily: 'inherit', transition: 'all 0.15s', letterSpacing: active === t ? 0 : '0.01em' }}
      >{t}</button>
    ))}
  </div>
);

// ─── BOTTOM NAV (mobile) ─────────────────────────────────────────────────────
function BottomNav({ screen, go }: { screen: string; go: (s: string) => void }) {
  const navItems = [
    { id: 'dashboard', label: 'Início',     icon: SquaresFour },
    { id: 'patients',  label: 'Pacientes',  icon: Users },
    { id: 'agenda',    label: 'Agenda',     icon: CalendarBlank },
    { id: 'settings',  label: 'Config.',    icon: GearSix },
  ];
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, background: '#fff', borderTop: `1px solid ${BO}`, display: 'flex', zIndex: 100 }}>
      {navItems.map(({ id, label, icon: Icon }) => {
        const active = screen === id || (screen === 'patient-detail' && id === 'patients');
        return (
          <button key={id} onClick={() => go(id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer', color: active ? P : MU,
            fontFamily: 'inherit', padding: '4px 0', transition: 'color 0.15s',
          }}>
            <Icon size={20} weight={active ? 'fill' : 'regular'} />
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function Sidebar({ screen, go, doctorName }: { screen: string; go: (s: string) => void; doctorName: string }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard',     icon: SquaresFour },
    { id: 'patients',  label: 'Pacientes',      icon: Users },
    { id: 'agenda',    label: 'Agenda',         icon: CalendarBlank },
    { id: 'settings',  label: 'Configurações',  icon: GearSix },
  ];
  return (
    <div style={{ width: 264, minHeight: '100vh', background: '#fff', borderRight: `1px solid ${BO}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 14px 22px' }}>
        <img src="/brand/auri-logo-full.svg" alt="Auri" style={{ height: 28 }} />
      </div>
      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = screen === id || (screen === 'patient-detail' && id === 'patients');
          return (
            <button key={id} onClick={() => go(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', background: active ? PL : 'transparent', color: active ? P : '#4A5862', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: active ? 600 : 500, fontSize: 14, fontFamily: 'inherit', textAlign: 'left', transition: 'background 180ms, color 180ms' }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(28,42,46,0.04)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            ><Icon size={18} weight={active ? 'fill' : 'regular'} />{label}</button>
          );
        })}
      </nav>
      {/* User */}
      <div style={{ padding: '10px', borderTop: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E6D5B8', color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          {doctorName ? doctorName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() : 'DR'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{doctorName || 'Médico'}</div>
          <div style={{ fontSize: 11, color: MU }}>Pediatra</div>
        </div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU, padding: 4, flexShrink: 0 }} onClick={() => db.signOut()} title="Sair">
          <SignOut size={16} />
        </button>
      </div>
    </div>
  );
}

function Header({ breadcrumb, onBack, notifications = [], onNotificationClick }: {
  breadcrumb?: string[]; onBack?: () => void;
  notifications?: AppNotification[]; onNotificationClick?: (patientId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div style={{ height: 64, background: '#fff', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: MU }}>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: P, marginRight: 4, display: 'flex', padding: 0 }}>
            <ArrowLeft size={18} />
          </button>
        )}
        {(breadcrumb || []).map((b, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <CaretRight size={14} />}
            <span style={{ color: i === (breadcrumb||[]).length - 1 ? INK : MU, fontWeight: i === (breadcrumb||[]).length - 1 ? 600 : 400 }}>{b}</span>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <MagnifyingGlass size={18} color={MU} style={{ cursor: 'pointer' }} />
        <div ref={ref} style={{ position: 'relative' }}>
          <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 8, color: MU }}>
            <Bell size={18} color={open ? P : MU} />
            {notifications.length > 0 && (
              <span style={{ position: 'absolute', top: 0, right: 0, background: DES, color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>

          {open && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 360, background: '#fff', border: `1px solid ${BO}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Notificações</span>
                {notifications.length > 0 && <Badge color={DES} bg={DESL}>{notifications.length} pendente{notifications.length > 1 ? 's' : ''}</Badge>}
              </div>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '32px 18px', textAlign: 'center' as const, color: MU, fontSize: 13 }}>
                    <Bell size={28} color={BO} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                    Nenhuma notificação pendente
                  </div>
                ) : notifications.map((n, i) => (
                  <div key={i} onClick={() => { onNotificationClick?.(n.patientId); setOpen(false); }}
                    style={{ display: 'flex', gap: 12, padding: '12px 18px', borderBottom: i < notifications.length - 1 ? `1px solid ${BO}` : 'none', cursor: n.patientId ? 'pointer' : 'default', transition: 'background 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = PL; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: n.type === 'vaccine' ? WARNL : DESL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {n.type === 'vaccine' ? <Syringe size={15} color={WARN} /> : <CalendarBlank size={15} color={DES} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: MU, marginTop: 2 }}>{n.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Layout({ children, screen, go, breadcrumb, onBack, doctorName, notifications, onNotificationClick }: { children: React.ReactNode; screen: string; go: (s: string) => void; breadcrumb?: string[]; onBack?: () => void; doctorName: string; notifications?: AppNotification[]; onNotificationClick?: (patientId?: string) => void }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    const pageTitle = breadcrumb?.[breadcrumb.length - 1] || 'Vínculo';
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column' as const }}>
        <div style={{ height: 52, background: '#fff', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0, position: 'sticky' as const, top: 0, zIndex: 50 }}>
          {onBack
            ? <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: P, padding: 0, display: 'flex', flexShrink: 0 }}><ArrowLeft size={20} /></button>
            : <img src="/brand/auri-mark.svg" alt="Auri" style={{ height: 24, flexShrink: 0 }} />
          }
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{onBack ? pageTitle : ''}</span>
        </div>
        <main style={{ flex: 1, padding: 16, paddingBottom: 76, overflowY: 'auto' as const }}>{children}</main>
        <BottomNav screen={screen} go={go} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: BG }}>
      <Sidebar screen={screen} go={go} doctorName={doctorName} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header breadcrumb={breadcrumb} onBack={onBack} notifications={notifications} onNotificationClick={onNotificationClick} />
        <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>{children}</main>
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 6,
  fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

function LoginScreen({ onBack }: { onBack?: () => void }) {
  const [mobile, setMobile] = useState(window.innerWidth < 960);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [info, setInfo]     = useState('');

  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 960);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setInfo('');
    if (!email || !pass || (mode === 'signup' && !name)) {
      setError('Preencha todos os campos.'); return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: err } = await db.signUp(email, pass, name);
        if (err) throw err;
        setInfo('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      } else {
        const { error: err } = await db.signIn(email, pass);
        if (err) throw err;
      }
    } catch (e: any) {
      const msg: string = e?.message || '';
      if (msg.includes('Invalid login'))           setError('E-mail ou senha incorretos.');
      else if (msg.includes('already registered')) setError('E-mail já cadastrado. Faça login.');
      else setError(msg || 'Erro ao autenticar.');
    } finally { setLoading(false); }
  }

  const toggle = () => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); };

  // Token shorthands for this component
  const INK2 = '#4A5862', INK3 = '#6F7C84', BORDER_STRONG = '#C8D4D6';

  const inputStyle: React.CSSProperties = {
    width: '100%', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 14,
    padding: '11px 14px', border: `1px solid ${BORDER_STRONG}`, borderRadius: 8,
    background: '#fff', color: INK, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', minHeight: '100vh' }}>

      {/* ══ LEFT — editorial ══════════════════════════════════════════ */}
      <aside style={{ background: BG, padding: mobile ? '32px 24px' : '40px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        {/* sand-soft background disc */}
        <div style={{ position: 'absolute', width: 520, height: 520, borderRadius: '50%', background: '#F3EFE3', bottom: -180, right: -180, opacity: 0.7, zIndex: 0, pointerEvents: 'none' }} />

        {/* top content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Brand row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src="/brand/auri-logo-full.svg" alt="Auri" style={{ height: 28 }} />
            <div style={{ width: 1, height: 18, background: BORDER_STRONG }} />
            <div style={{ fontSize: 12, color: INK3, letterSpacing: '0.02em' }}>para pediatras</div>
          </div>

          {/* Editorial */}
          <div style={{ maxWidth: 480, marginTop: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: ACCENT, marginBottom: 18 }}>
              Copiloto de consulta
            </div>
            <h1 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: mobile ? 36 : 52, fontWeight: 400, lineHeight: 1.02, letterSpacing: '-0.025em', margin: '0 0 20px', color: INK, fontVariationSettings: '"opsz" 144' }}>
              Foque no paciente.<br />
              Auri cuida do{' '}
              <em style={{ fontStyle: 'italic', fontWeight: 500, color: P }}>prontuário</em>.
            </h1>
            <p style={{ fontSize: 16, lineHeight: 1.55, color: INK2, maxWidth: 420, margin: 0 }}>
              Auri ouve a consulta e organiza o prontuário automaticamente — para você voltar a olhar nos olhos das crianças, não na tela.
            </p>
          </div>

          {/* Quote card */}
          <div style={{ marginTop: 56, maxWidth: 460, background: '#fff', border: `1px solid ${BO}`, borderRadius: 12, padding: '22px 24px', boxShadow: '0 1px 2px rgba(28,42,46,0.05)' }}>
            <div style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 36, lineHeight: 0.7, color: ACCENT, marginBottom: 6, height: 14 }}>"</div>
            <p style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 18, fontWeight: 400, lineHeight: 1.4, letterSpacing: '-0.01em', color: INK, margin: '0 0 14px', fontVariationSettings: '"opsz" 36' }}>
              Voltei a olhar nos olhos das mães. Saí dos plantões sem 40 prontuários para digitar à noite.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: INK2 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #E6D5B8 0%, #FDEEE8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Fraunces", Georgia, serif', fontSize: 13, fontWeight: 500, color: P, flexShrink: 0 }}>
                RM
              </div>
              <div>
                <div style={{ color: INK, fontWeight: 500 }}>Dra. Renata Moraes</div>
                <div>Pediatra · Clínica Vivace, SP</div>
              </div>
            </div>
          </div>
        </div>

        {/* Left footer */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 20, fontSize: 12, color: INK3, flexWrap: 'wrap' as const, marginTop: 40 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 8px', background: '#EBF5EE', color: '#5B8A6F', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 1.5l5.5 2v4c0 3.5-2.5 6.5-5.5 7.5-3-1-5.5-4-5.5-7.5v-4l5.5-2z"/>
              <path d="M5.5 8L7 9.5L10.5 6"/>
            </svg>
            LGPD · CFM compatível
          </span>
          <a href="#" style={{ color: INK3, textDecoration: 'none' }}>Privacidade</a>
          <a href="#" style={{ color: INK3, textDecoration: 'none' }}>Termos</a>
          <a href="#" style={{ color: INK3, textDecoration: 'none' }}>Suporte</a>
          {onBack && (
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: INK3, fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={12} /> Voltar
            </button>
          )}
        </div>
      </aside>

      {/* ══ RIGHT — form ═════════════════════════════════════════════ */}
      <main style={{ background: '#fff', borderLeft: mobile ? 'none' : `1px solid ${BO}`, borderTop: mobile ? `1px solid ${BO}` : 'none', padding: mobile ? '32px 24px' : '40px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        {/* Top-right toggle */}
        <div style={{ position: mobile ? 'static' as const : 'absolute' as const, top: 32, right: 56, fontSize: 13, color: INK2, marginBottom: mobile ? 24 : 0, alignSelf: mobile ? 'flex-end' as const : undefined }}>
          {mode === 'login' ? 'Primeira vez no Auri?' : 'Já tem conta?'}
          <button onClick={toggle} style={{ background: 'none', border: 'none', color: P, fontWeight: 500, marginLeft: 4, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>
            {mode === 'login' ? 'Criar conta' : 'Entrar'}
          </button>
        </div>

        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Form head */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 30, fontWeight: 500, lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 8px', color: INK, fontVariationSettings: '"opsz" 72' }}>
              {mode === 'login' ? 'Bem-vinda de volta' : 'Crie sua conta'}
            </h2>
            <p style={{ fontSize: 14, color: INK2, margin: 0, lineHeight: 1.45 }}>
              {mode === 'login' ? 'Entre para começar as consultas de hoje.' : 'Comece sua avaliação de 14 dias.'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Name — signup only */}
            {mode === 'signup' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: INK, marginBottom: 6 }}>Nome completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Dra. Fulana de Tal" style={inputStyle} />
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: INK, marginBottom: 6 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" style={inputStyle} />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: INK, marginBottom: 6 }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" style={{ ...inputStyle, paddingRight: 72 }} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: INK3, fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '4px 8px', borderRadius: 4, fontFamily: 'inherit' }}>
                  {showPw ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            {/* Remember / forgot — login only */}
            {mode === 'login' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 0 22px', fontSize: 13 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: INK2, cursor: 'pointer', userSelect: 'none' as const }}>
                  <input type="checkbox" defaultChecked style={{ width: 16, height: 16, accentColor: P, cursor: 'pointer', margin: 0 }} />
                  Manter conectada
                </label>
                <a href="#" style={{ color: P, textDecoration: 'none', fontWeight: 500 }}>Esqueci a senha</a>
              </div>
            )}

            {/* Feedback */}
            {error && <div style={{ marginBottom: 14, fontSize: 13, color: '#B5503D', background: '#F9ECEB', border: '1px solid rgba(181,80,61,0.2)', borderRadius: 8, padding: '10px 14px' }}>{error}</div>}
            {info  && <div style={{ marginBottom: 14, fontSize: 13, color: '#5B8A6F',  background: '#EBF5EE',  border: '1px solid rgba(91,138,111,0.2)',   borderRadius: 8, padding: '10px 14px' }}>{info}</div>}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px 16px', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', background: P, color: '#fff', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0', color: INK3, fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, background: BO }} />
              ou
              <div style={{ flex: 1, height: 1, background: BO }} />
            </div>

            {/* Google */}
            <button type="button" onClick={() => db.signInWithGoogle()} style={{ width: '100%', padding: '12px 16px', border: `1px solid ${BORDER_STRONG}`, borderRadius: 8, fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer', background: '#fff', color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.08-1.79 2.72v2.27h2.9c1.7-1.56 2.69-3.87 2.69-6.63z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.27c-.8.55-1.84.87-3.06.87-2.36 0-4.36-1.59-5.07-3.74H.95v2.34C2.44 16 5.48 18 9 18z"/>
                <path fill="#FBBC05" d="M3.93 10.68c-.18-.54-.28-1.12-.28-1.71s.1-1.17.28-1.71V4.92H.95C.34 6.13 0 7.51 0 9s.34 2.87.95 4.08l2.98-2.4z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2 .95 4.92l2.98 2.34C4.64 5.17 6.64 3.58 9 3.58z"/>
              </svg>
              Continuar com Google
            </button>
          </form>

          <div style={{ marginTop: 28, textAlign: 'center' as const, fontSize: 13, color: INK3, lineHeight: 1.6 }}>
            Ao entrar você concorda com os{' '}
            <a href="#" style={{ color: INK2, textDecoration: 'none' }}>Termos</a>
            {' '}e a{' '}
            <a href="#" style={{ color: INK2, textDecoration: 'none' }}>Política de privacidade</a>.
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── LANDING PAGE ────────────────────────────────────────────────────────────
// Faithful reimplementation of ui_kits/marketing/index.html

// Design-system token aliases (CSS vars → JS constants)
const DS_INK2   = '#4A5862';
const DS_INK3   = '#6F7C84';
const DS_SAND   = '#E6D5B8';
const DS_PRISOFT = '#DCE9EC'; // approx oklch(94% 0.025 210)
const DS_DANGER = '#B5503D';

function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [mobile, setMobile] = useState(window.innerWidth < 900);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 900);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // button style helpers
  const btnPrimary = (lg = false): React.CSSProperties => ({
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: lg ? 15 : 13,
    fontWeight: 500,
    padding: lg ? '12px 20px' : '6px 12px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: P,
    color: '#fff',
    transition: 'all 180ms',
  });

  const btnGhost = (lg = false): React.CSSProperties => ({
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: lg ? 15 : 13,
    fontWeight: 500,
    padding: lg ? '12px 20px' : '6px 12px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    color: DS_INK2,
    transition: 'all 180ms',
  });

  const features = [
    { icon: <Microphone size={22} color={P} />,       title: 'Escuta inteligente',        desc: 'Distingue médico, paciente e acompanhante. Reconhece termos clínicos em português brasileiro com precisão de 97%.' },
    { icon: <FileText size={22} color={P} />,          title: 'Prontuário estruturado',     desc: 'Auri separa queixa, HMA, exame físico, hipóteses e plano. Você revisa antes de salvar — controle total.' },
    { icon: <ShieldCheck size={22} color={P} />,       title: 'Privacidade primeiro',       desc: 'Conformidade com LGPD e CFM. Áudio nunca é armazenado. Transcrição processada localmente sempre que possível.' },
    { icon: <TrendUp size={22} color={P} />,           title: 'Curvas e vacinas',           desc: 'Crescimento, IMC e esquema vacinal calculados automaticamente. Alertas para próximas doses e retornos.' },
    { icon: <CalendarBlank size={22} color={P} />,     title: 'Agenda integrada',           desc: 'Sincroniza com Google Calendar e os principais sistemas de clínicas brasileiras.' },
    { icon: <Baby size={22} color={P} />,              title: 'Pensado para pediatria',     desc: 'Vocabulário, percentis e protocolos específicos da pediatria. Não é uma ferramenta genérica adaptada.' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: '"Inter", system-ui, sans-serif', color: INK, WebkitFontSmoothing: 'antialiased' }}>

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <div style={{ background: BG }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 32px', display: 'flex', alignItems: 'center', gap: 32 }}>
          <img src="/brand/auri-logo-full.svg" alt="Auri" style={{ height: 40 }} />
          {!mobile && (
            <div style={{ marginLeft: 32, display: 'flex', gap: 24 }}>
              {[
                { l: 'Produto', href: '#produto' },
                { l: 'Privacidade', href: '#privacidade' },
                { l: 'Preços', href: '#precos' },
              ].map(({ l, href }) => (
                <a key={l} href={href} style={{ color: DS_INK2, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button style={btnGhost()} onClick={onEnter}>Entrar</button>
            <button style={btnPrimary()} onClick={onEnter}>Testar 14 dias</button>
          </div>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1120, margin: '40px auto 80px', padding: '0 32px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: ACCENT }}>
          Para pediatras
        </div>
        <h1 style={{
          fontFamily: '"Fraunces", Georgia, serif',
          fontSize: 'clamp(48px, 7vw, 84px)',
          fontWeight: 400,
          lineHeight: 1.0,
          letterSpacing: '-0.025em',
          margin: '18px 0 24px',
          color: INK,
          fontVariationSettings: '"opsz" 144',
          maxWidth: '14ch',
        }}>
          Foque no paciente.<br />
          Auri cuida do{' '}
          <em style={{ fontStyle: 'italic', color: P, fontWeight: 500 }}>prontuário</em>.
        </h1>
        <p style={{ fontSize: 19, lineHeight: 1.55, color: DS_INK2, maxWidth: '56ch', margin: '0 0 32px' }}>
          Auri ouve a consulta, transcreve o que importa e organiza o prontuário automaticamente. Você revisa, ajusta, e salva — em segundos, não em horas.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const }}>
          <button style={btnPrimary(true)} onClick={onEnter}>Começar avaliação</button>
          <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: DS_INK2, fontSize: 14, textDecoration: 'none' }}>
            <PlayCircle size={20} color={DS_INK2} /> Ver demo de 90s
          </a>
        </div>

        {/* Hero visual */}
        <div style={{
          marginTop: 64,
          background: '#fff',
          border: `1px solid ${BO}`,
          borderRadius: 20,
          boxShadow: '0 16px 40px rgba(28,42,46,0.10), 0 4px 12px rgba(28,42,46,0.05)',
          padding: 32,
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
          gap: 32,
          alignItems: 'center',
        }}>
          {/* Left — listening panel */}
          <div style={{ padding: 24, background: BG, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              {/* "Auri ouvindo" pill */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: ACCENTL, color: DS_DANGER }}>
                <span className="live-dot" />
                Auri ouvindo
              </span>
              {/* Timer */}
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: DS_INK2 }}>04:21</span>
            </div>
            {/* Wave */}
            <div className="hero-wave">
              {Array.from({ length: 9 }).map((_, i) => <span key={i} />)}
            </div>
            <div style={{ marginTop: 14, fontSize: 13, color: DS_INK2 }}>
              Lara Mendes · 4 anos · tosse seca há 3 dias
            </div>
          </div>

          {/* Right — testimonial */}
          <div>
            <div style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontSize: 22,
              lineHeight: 1.4,
              color: INK,
              fontStyle: 'italic',
            }}>
              "Voltei a olhar nos olhos das mães. O prontuário se escreve sozinho."
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: DS_SAND, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                RM
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Dra. Renata Moraes</div>
                <div style={{ fontSize: 12, color: DS_INK3 }}>Pediatra · Clínica Vivace, SP</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1120, margin: '0 auto 100px', padding: '0 32px' }}>
        <h2 style={{
          fontFamily: '"Fraunces", Georgia, serif',
          fontSize: 48,
          fontWeight: 400,
          letterSpacing: '-0.02em',
          maxWidth: '16ch',
          margin: '0 0 56px',
          color: INK,
          lineHeight: 1.1,
        }}>
          Menos digitação. Mais consulta.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: 24 }}>
          {features.map((f, i) => (
            <div key={i} style={{ padding: 28, background: '#fff', border: `1px solid ${BO}`, borderRadius: 14, boxShadow: '0 1px 2px rgba(28,42,46,0.05)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: DS_PRISOFT, color: P, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {f.icon}
              </div>
              <h3 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 22, fontWeight: 500, margin: '18px 0 8px', color: INK, letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: DS_INK2, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1120, margin: '0 auto 64px', padding: '0 32px' }}>
        <div style={{
          padding: mobile ? '48px 32px' : '64px 48px',
          background: P,
          color: BG,
          borderRadius: 20,
          display: 'flex',
          flexDirection: mobile ? 'column' as const : 'row' as const,
          gap: 32,
          alignItems: mobile ? 'flex-start' : 'center',
        }}>
          <div>
            <h2 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: mobile ? 32 : 44, fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 12px', color: '#fff', maxWidth: '14ch', lineHeight: 1.05 }}>
              Comece hoje. Sem cartão.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(220,233,236,0.85)', margin: 0, maxWidth: '36ch' }}>
              14 dias para experimentar com sua agenda real. Cancele quando quiser, exporte tudo a qualquer momento.
            </p>
          </div>
          <div style={{ marginLeft: mobile ? 0 : 'auto', display: 'flex', flexDirection: 'column' as const, gap: 10, minWidth: 220 }}>
            <button
              onClick={onEnter}
              style={{ width: '100%', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 15, fontWeight: 500, padding: '12px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', background: BG, color: P, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
            >
              Criar conta
            </button>
            <button
              style={{ width: '100%', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 15, fontWeight: 500, padding: '12px 20px', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: BG, border: '1px solid rgba(200,220,224,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
              onClick={() => {}}
            >
              Falar com vendas
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 32px 48px', display: 'flex', gap: 24, fontSize: 13, color: DS_INK3, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200 }}>© 2026 Auri Saúde Ltda · CNPJ 00.000.000/0001-00</div>
        {['LGPD', 'Termos', 'Contato'].map(l => (
          <a key={l} href="#" style={{ color: DS_INK3, textDecoration: 'none' }} onClick={e => e.preventDefault()}>{l}</a>
        ))}
      </footer>

    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardPage({ go, setActivePatient }: { go: (s: string) => void; setActivePatient: (p: Patient) => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [todayAppts, setTodayAppts] = useState<any[]>([]);
  const [overdueAppts, setOverdueAppts] = useState<{ patient_id: string; patient_name: string; scheduled_at: string }[]>([]);
  const [overdueVaccPatients, setOverdueVaccPatients] = useState<{ id: string; full_name: string; overdueCount: number; overdueNames: string[] }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ id: string; patient_id: string; patient_name: string; date: string; type: string }[]>([]);
  const [consultSummaries, setConsultSummaries] = useState<Record<string, { count: number; lastDate: string | null }>>({});
  const [lastPatient, setLastPatient] = useState<Patient | null>(null);
  const [evolutionData, setEvolutionData] = useState<{ date: string; 'Primeira vez': number; 'Retorno': number }[]>([]);
  const [evolutionPeriod, setEvolutionPeriod] = useState<7 | 30 | 90>(30);
  const isMobile = useIsMobile();
  const doctorName = 'Dr. Lucas Mendes';

  useEffect(() => {
    Promise.all([
      db.fetchPatients(),
      db.fetchTodayAppointments(),
      db.fetchDashboardStats(),
      db.fetchRecentActivity(),
      db.fetchConsultationSummaries(),
    ]).then(async ([ps, appts, stats, activity, summaries]) => {
      setPatients(ps);
      setTodayAppts(appts);
      setOverdueAppts(stats.overdueAppointments);
      setRecentActivity(activity);
      setConsultSummaries(summaries);
      if (activity.length > 0) {
        const lp = ps.find((p: Patient) => p.id === activity[0].patient_id);
        if (lp) setLastPatient(lp);
      }
      // Vacinas em atraso por paciente — captura nomes das vacinas
      const results: { id: string; full_name: string; overdueCount: number; overdueNames: string[] }[] = [];
      await Promise.all(ps.map(async (p: Patient) => {
        const bd = new Date(p.birth_date), now = new Date();
        const ageMonths = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
        const dbVs = await db.fetchVaccines(p.id).catch(() => []);
        const overdue = PNI_SCHEDULE.filter(pni => {
          const done = dbVs.find((v: any) => v.name === pni.name && v.dose === pni.dose && v.status === 'done');
          return !done && pni.age_months <= ageMonths;
        });
        if (overdue.length > 0) results.push({
          id: p.id,
          full_name: p.full_name,
          overdueCount: overdue.length,
          overdueNames: [...new Set(overdue.map(v => v.name))].slice(0, 3),
        });
      }));
      setOverdueVaccPatients(results);
    }).catch(() => {});
  }, []);

  // Load consultation evolution data
  useEffect(() => {
    db.fetchConsultationEvolution(evolutionPeriod).then(setEvolutionData).catch(() => {});
  }, [evolutionPeriod]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const todayStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Computed metrics
  const firstTimePatients = patients.filter(p => !(consultSummaries[p.id]?.count > 0));
  const retornosPendentes = overdueAppts.length;
  const completedToday = todayAppts.filter(a => a.status === 'completed').length;

  // Per-patient alert groups, ordenados por prioridade
  const alertsByPatient: Record<string, { patient: Patient | null; name: string; issues: { text: string; color: string }[]; priority: number }> = {};
  overdueAppts.forEach(a => {
    const daysDiff = Math.floor((now.getTime() - new Date(a.scheduled_at).getTime()) / 86400000);
    if (!alertsByPatient[a.patient_id]) alertsByPatient[a.patient_id] = { patient: patients.find(p => p.id === a.patient_id) || null, name: a.patient_name, issues: [], priority: 0 };
    alertsByPatient[a.patient_id].issues.push({ text: `Retorno vencido há ${daysDiff} dia${daysDiff !== 1 ? 's' : ''}`, color: DES });
    alertsByPatient[a.patient_id].priority += 10 + daysDiff;
  });
  overdueVaccPatients.forEach(v => {
    if (!alertsByPatient[v.id]) alertsByPatient[v.id] = { patient: patients.find(p => p.id === v.id) || null, name: v.full_name, issues: [], priority: 0 };
    const nameList = v.overdueNames.join(', ');
    alertsByPatient[v.id].issues.push({ text: `${v.overdueCount} vacina${v.overdueCount > 1 ? 's' : ''} em atraso${nameList ? ` (${nameList})` : ''}`, color: WARN });
    alertsByPatient[v.id].priority += v.overdueCount * 2;
  });
  const alertGroups = Object.values(alertsByPatient).sort((a, b) => b.priority - a.priority).slice(0, 5);

  // Atenção com nomes de pacientes
  const noReturnIn30 = patients.filter(p => {
    const s = consultSummaries[p.id];
    if (!s?.lastDate) return false;
    return (now.getTime() - new Date(s.lastDate).getTime()) / 86400000 > 30;
  });
  const attentionPoints: string[] = [];
  overdueVaccPatients.slice(0, 3).forEach(v => attentionPoints.push(`${v.full_name} — ${v.overdueCount} vacina${v.overdueCount > 1 ? 's' : ''} em atraso no PNI`));
  if (overdueVaccPatients.length > 3) attentionPoints.push(`+${overdueVaccPatients.length - 3} outros pacientes com vacinas em atraso`);
  noReturnIn30.slice(0, 3).forEach(p => attentionPoints.push(`${p.full_name} sem consulta há mais de 30 dias`));
  if (firstTimePatients.length > 0) attentionPoints.push(`${firstTimePatients.length} paciente${firstTimePatients.length > 1 ? 's' : ''} ainda sem consulta registrada`);

  const lastConsultDate = lastPatient ? consultSummaries[lastPatient.id]?.lastDate : null;

  const SectionHeader = ({ icon: Icon, title, action, onAction }: { icon: any; title: string; action?: string; onAction?: () => void }) => (
    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color={P} />
        <span style={{ fontWeight: 500, fontSize: 15, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em' }}>{title}</span>
      </div>
      {action && <Btn size="sm" variant="ghost" onClick={onAction}>{action}</Btn>}
    </div>
  );

  // Calculate next appointment and context
  const nextAppt = todayAppts.length > 0 ? todayAppts[0] : null;
  const agendaStr = todayAppts.length === 0
    ? 'Nenhuma consulta agendada'
    : `${todayAppts.length} consulta${todayAppts.length !== 1 ? 's' : ''} agendada${todayAppts.length !== 1 ? 's' : ''}, próxima às ${nextAppt?.time || ''} com ${nextAppt?.patient_name || ''}`;

  // Check if all KPIs are 0 (new user)
  const allKpisZero = todayAppts.length === 0 && retornosPendentes === 0 && overdueVaccPatients.length === 0 && firstTimePatients.length === 0;

  // Helper: format relative timestamp
  const formatRelativeTime = (iso: string) => {
    const then = new Date(iso).getTime(), now = new Date().getTime(), diff = (now - then) / 1000;
    if (diff < 60) return 'há poucos segundos';
    if (diff < 3600) return `há ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    return `há ${Math.floor(diff / 86400)}d`;
  };

  return (
    <div>
      {/* ── Greeting + Context ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 24 : 36, fontWeight: 500, color: INK, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.02em', lineHeight: 1.1, fontVariationSettings: '"opsz" 72' }}>
          {greeting}, Dr. {doctorName.split(' ')[0]}
        </h1>
        <p style={{ margin: '8px 0 0', color: MU, fontSize: 14, lineHeight: 1.4 }}>
          Hoje · {todayStr}. {agendaStr}{todayAppts.length === 0 ? ' — ' : '.'}
          {todayAppts.length === 0 && <a href="#" onClick={() => go('agenda')} style={{ color: P, textDecoration: 'none', fontWeight: 500 }}>Ver agenda da semana →</a>}
        </p>
      </div>

      {/* ── KPI Section ── */}
      {allKpisZero ? (
        <Card style={{ padding: '32px 24px', marginBottom: 24 }}>
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 24, fontWeight: 500, color: INK, marginBottom: 8 }}>Comece agora</div>
            <p style={{ color: MU, fontSize: 14, marginBottom: 24 }}>Sua primeira consulta vai aparecer aqui.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const }}>
              <Btn onClick={() => { const p = patients[0]; if (p) { setActivePatient(p); go('patient-detail'); } }}>
                <Stethoscope size={14} /> Iniciar primeira consulta
              </Btn>
              <Btn variant="secondary">Importar agenda do Google</Btn>
            </div>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '2fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          {/* Primary KPI — Consultas hoje */}
          <Card style={{ padding: '20px 24px', gridColumn: isMobile ? 'auto' : 'span 1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: MU, fontWeight: 500 }}>Consultas hoje</span>
              <div style={{ background: P + '18', borderRadius: 8, padding: 7 }}><CalendarBlank size={16} color={P} /></div>
            </div>
            <div style={{ fontSize: isMobile ? 28 : 32, fontWeight: 700, color: INK, fontFamily: '"JetBrains Mono", monospace', fontFeatureSettings: '"tnum"', letterSpacing: '-0.02em' }}>{todayAppts.length}</div>
            <div style={{ fontSize: 11, color: MU, marginTop: 4 }}>vs. semana passada: +{Math.floor(Math.random() * 5)}</div>
            {/* Mini sparkline — mock 14 days */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, marginTop: 12, height: 24 }}>
              {Array.from({ length: 14 }).map((_, i) => {
                const h = Math.floor(Math.random() * 20) + 5;
                const isToday = i === 13;
                return <div key={i} style={{ flex: 1, height: h, background: isToday ? ACCENT : P, opacity: isToday ? 1 : 0.4, borderRadius: 2 }} />;
              })}
            </div>
          </Card>

          {/* Secondary KPIs */}
          <Card style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: MU, fontWeight: 500 }}>Pacientes ativos</span>
              <div style={{ background: P + '18', borderRadius: 8, padding: 7 }}><Users size={16} color={P} /></div>
            </div>
            <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: INK, fontFamily: '"JetBrains Mono", monospace', fontFeatureSettings: '"tnum"' }}>{patients.length}</div>
            <div style={{ fontSize: 11, color: MU, marginTop: 4 }}>+{Math.floor(patients.length * 0.1)} este mês</div>
          </Card>

          <Card style={{ padding: '20px 24px', border: `1px solid ${overdueVaccPatients.length > 0 ? ACCENT : BO}`, background: overdueVaccPatients.length > 0 ? ACCENTL + '20' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: MU, fontWeight: 500 }}>Pendências</span>
              <div style={{ background: (overdueVaccPatients.length > 0 ? ACCENT : MU) + '18', borderRadius: 8, padding: 7 }}>
                <CheckCircle size={16} color={overdueVaccPatients.length > 0 ? ACCENT : MU} />
              </div>
            </div>
            <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: overdueVaccPatients.length > 0 ? ACCENT : INK, fontFamily: '"JetBrains Mono", monospace', fontFeatureSettings: '"tnum"' }}>
              {retornosPendentes + overdueVaccPatients.length}
            </div>
            <div style={{ fontSize: 11, color: MU, marginTop: 4 }}>{overdueVaccPatients.length > 0 ? 'ação requerida' : 'em dia'}</div>
          </Card>
        </div>
      )}

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: isMobile ? 12 : 20, alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 1. Consultas do dia */}
          {todayAppts.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', height: 56, padding: '0 20px', background: '#fff', border: `1px solid ${BO}`, borderRadius: 10, boxShadow: '0 1px 2px rgba(28,42,46,0.05)' }}>
              <CalendarBlank size={18} color={MU} style={{ marginRight: 12, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13, color: MU }}>Sem consultas agendadas para hoje</div>
              <a href="#" onClick={() => go('agenda')} style={{ color: P, textDecoration: 'none', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', marginLeft: 8 }}>Ver agenda →</a>
            </div>
          ) : (
            <Card>
              <SectionHeader
                icon={CalendarBlank}
                title={`Consultas de hoje (${completedToday}/${todayAppts.length})`}
                action="Ver agenda"
                onAction={() => go('agenda')}
              />
              {todayAppts.map((a, i) => {
              const patient = patients.find(p => p.id === a.patient_id);
              const isPending = a.status !== 'completed';
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
                  borderBottom: i < todayAppts.length - 1 ? `1px solid ${BO}` : 'none',
                  background: !isPending ? SUCL + '66' : 'transparent',
                }}>
                  <div style={{ textAlign: 'center' as const, minWidth: 44 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: isPending ? P : MU }}>{a.time}</div>
                  </div>
                  <div style={{ width: 1, height: 32, background: BO, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{a.patient_name}</span>
                      <span style={{ fontSize: 12, color: MU }}>{a.age}</span>
                      <Pill type={a.type} />
                      {isPending
                        ? <Badge color={WARN} bg={WARNL}>Pendente</Badge>
                        : <Badge color={SUC} bg={SUCL}>Realizada</Badge>}
                    </div>
                    {a.guardian && <div style={{ fontSize: 11, color: MU, marginTop: 2 }}>Resp: {a.guardian}</div>}
                  </div>
                  {isPending && patient && (
                    <Btn size="sm" onClick={e => { e.stopPropagation(); setActivePatient(patient); go('patient-detail'); }}>
                      <Stethoscope size={13} /> Iniciar
                    </Btn>
                  )}
                  {!isPending && patient && (
                    <Btn size="sm" variant="secondary" onClick={e => { e.stopPropagation(); setActivePatient(patient); go('patient-detail'); }}>
                      <FileText size={13} /> Prontuário
                    </Btn>
                  )}
                </div>
              );
            })}
          </Card>
          )}

          {/* 2. Evolução de consultas */}
          <Card>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ background: PL, borderRadius: 8, padding: 8 }}><TrendUp size={16} color={P} /></div>
                  <span style={{ fontWeight: 500, fontSize: 18, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em' }}>Evolução de consultas</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[7, 30, 90].map(days => (
                    <button key={days} onClick={() => setEvolutionPeriod(days as 7 | 30 | 90)}
                      style={{
                        fontSize: 11, padding: '6px 12px', borderRadius: 6, border: `1px solid ${evolutionPeriod === days ? P : BO}`, cursor: 'pointer',
                        background: evolutionPeriod === days ? P : 'transparent', color: evolutionPeriod === days ? '#fff' : MU,
                        fontWeight: 500, transition: 'all 0.15s', fontFamily: '"JetBrains Mono", monospace'
                      }}>
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
              {evolutionData.length < 7 ? (
                <div style={{ padding: '40px 0', textAlign: 'center' as const, color: MU }}>
                  <TrendUp size={24} color={BO} style={{ display: 'block', margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 14 }}>Continue usando o Auri por mais {7 - evolutionData.length} dias para ver tendências</div>
                </div>
              ) : (
                <>
                  {/* Inline legend */}
                  <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 12, height: 12, background: P, borderRadius: 2 }} />
                      <span style={{ color: MU }}>Retorno</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 12, height: 12, background: '#E6D5B8', borderRadius: 2 }} />
                      <span style={{ color: MU }}>Primeira vez</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={evolutionData} margin={{ top: 0, right: 30, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BO} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: MU }}
                        tickFormatter={(date) => {
                          const d = new Date(date);
                          return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                        }} />
                      <YAxis tick={{ fontSize: 11, fill: MU }} domain={[0, Math.max(10, Math.ceil((evolutionData.reduce((max, d) => Math.max(max, d['Primeira vez'] + d['Retorno']), 0) + 2) / 5) * 5)]} />
                      <Tooltip
                        contentStyle={{ background: '#fff', border: `1px solid ${BO}`, borderRadius: 8 }}
                        labelFormatter={(date) => {
                          const d = new Date(date);
                          return d.toLocaleDateString('pt-BR');
                        }}
                        formatter={(value: any) => value as number}
                      />
                      <Bar dataKey="Retorno" fill={P} radius={[3,3,0,0] as any} isAnimationActive={false} />
                      <Bar dataKey="Primeira vez" fill="#E6D5B8" radius={[3,3,0,0] as any} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          </Card>

          {/* 4. Pacientes */}
          <Card>
            <SectionHeader icon={Users} title="Pacientes" action="Ver todos" onAction={() => go('patients')} />
            {patients.length === 0 ? (
              <div style={{ padding: '32px 24px', textAlign: 'center' as const }}>
                <Users size={28} color={BO} style={{ display: 'block', margin: '0 auto 8px' }} />
                <div style={{ fontSize: 13, color: MU, marginBottom: 16 }}>Nenhum paciente cadastrado ainda.</div>
                <Btn onClick={() => go('patients')}><Plus size={14} /> Cadastrar paciente</Btn>
              </div>
            ) : patients.slice(0, 5).map((p, i) => {
              const isFirst = !(consultSummaries[p.id]?.count > 0);
              const lastDate = consultSummaries[p.id]?.lastDate;
              const nextReturn = (p as any).next_return as string | null;
              return (
                <div key={p.id} onClick={() => { setActivePatient(p); go('patient-detail'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: i < Math.min(patients.length, 5) - 1 ? `1px solid ${BO}` : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = PL; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: p.gender === 'M' ? PL : FEMALEL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={16} color={p.gender === 'M' ? P : FEMALE} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{p.full_name}</span>
                      <span style={{ fontSize: 12, color: MU }}>{calcAge(p.birth_date)}</span>
                      {isFirst
                        ? <Badge color={ACCENT} bg={ACCENTL}>1ª consulta</Badge>
                        : <Badge color={SUC} bg={SUCL}>Retorno</Badge>}
                    </div>
                    <div style={{ fontSize: 11, color: MU, marginTop: 2, display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                      <span>{primaryGuardian(p)?.name || '—'}</span>
                      {lastDate && <span>· Última: {fmtDate(lastDate)}</span>}
                      {nextReturn && <span>· Retorno: {fmtDate(nextReturn)}</span>}
                    </div>
                  </div>
                  <Btn size="sm" variant="secondary" onClick={e => { e.stopPropagation(); setActivePatient(p); go('patient-detail'); }}>
                    <Stethoscope size={13} /> Consultar
                  </Btn>
                </div>
              );
            })}
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 1. Próxima consulta — sticky, only if within 2h */}
          {todayAppts[0] && (
            (() => {
              const nextAppt = todayAppts[0];
              const [h, m] = nextAppt.time.split(':').map(Number);
              const apptTime = new Date(now);
              apptTime.setHours(h, m, 0, 0);
              const diffMinutes = (apptTime.getTime() - now.getTime()) / 60000;
              return diffMinutes > 0 && diffMinutes <= 120 ? (
                <Card style={{ border: `1.5px solid ${P}50`, background: PL }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${P}15`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={14} color={P} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: P }}>Próxima consulta em {Math.round(diffMinutes)} min</span>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{nextAppt.patient_name}</div>
                    <div style={{ fontSize: 12, color: MU, marginBottom: 12, lineHeight: 1.5 }}>
                      <div>{nextAppt.age} · Às {nextAppt.time}</div>
                      {nextAppt.guardian && <div>Resp: {nextAppt.guardian}</div>}
                    </div>
                    <Btn onClick={() => {
                      const p = patients.find(pt => pt.id === nextAppt.patient_id);
                      if (p) { setActivePatient(p); go('patient-detail'); }
                    }} style={{ width: '100%', justifyContent: 'center' }}>
                      <Stethoscope size={13} /> Iniciar consulta
                    </Btn>
                  </div>
                </Card>
              ) : null;
            })()
          )}

          {/* 2. Pendências — unified alerts + attention points */}
          <Card style={{ padding: 20 }}>
            <div style={{ fontWeight: 500, fontSize: 15, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: (alertGroups.length + attentionPoints.length) > 0 ? 14 : 0 }}>
              <Warning size={15} color={ACCENT} /> Pendências
              {(alertGroups.length + attentionPoints.length) > 0 && <Badge color={ACCENT} bg={ACCENTL}>{alertGroups.length + attentionPoints.length}</Badge>}
            </div>
            {(alertGroups.length + attentionPoints.length) === 0 ? (
              <div style={{ fontSize: 13, color: MU, textAlign: 'center' as const, padding: '12px 0' }}>Tudo em ordem</div>
            ) : (
              <div>
                {alertGroups.slice(0, 3).map((g, i) => (
                  <div key={`alert-${i}`}
                    onClick={() => { if (g.patient) { setActivePatient(g.patient); go('patient-detail'); } }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: `1px solid ${BO}`, cursor: g.patient ? 'pointer' : 'default', fontSize: 12 }}>
                    <Warning size={12} color={ACCENT} style={{ flexShrink: 0, marginTop: 3 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: MU, marginTop: 2 }}>{g.issues[0]?.text}</div>
                    </div>
                  </div>
                ))}
                {attentionPoints.slice(0, Math.max(0, 5 - alertGroups.length)).map((pt, i) => (
                  <div key={`attn-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: (i < Math.min(attentionPoints.length, 5 - alertGroups.length) - 1 || alertGroups.length > 0) ? `1px solid ${BO}` : 'none', fontSize: 12 }}>
                    <Info size={12} color={P} style={{ flexShrink: 0, marginTop: 3 }} />
                    <span style={{ flex: 1, color: INK }}>{pt}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 6. Atividade recente */}
          <Card style={{ padding: 20 }}>
            <div style={{ fontWeight: 500, fontSize: 15, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: recentActivity.length > 0 ? 14 : 0 }}>
              <Clock size={15} color={MU} /> Atividade recente
            </div>
            {recentActivity.length === 0 ? (
              <div style={{ fontSize: 13, color: MU, textAlign: 'center' as const, padding: '12px 0' }}>Nenhuma atividade ainda</div>
            ) : recentActivity.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < recentActivity.length - 1 ? `1px solid ${BO}` : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: SUCL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={13} color={SUC} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{a.patient_name}</div>
                  <div style={{ fontSize: 11, color: MU, display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                    {fmtDate(a.date)} · <Pill type={a.type} />
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>

    </div>
  );
}

// ─── NEW PATIENT MODAL ────────────────────────────────────────────────────────
function NewPatientModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Patient) => void }) {
  const [form, setForm] = useState({
    full_name: '', birth_date: '', gender: 'M' as 'M' | 'F',
    blood_type: '', delivery_type: 'Vaginal', gestational_age_weeks: '',
    birth_weight_g: '', notes: '',
    insurance_plan: '', insurance_card_number: '',
    guardian_name: '', guardian_relationship: 'Mãe', guardian_phone: '', guardian_email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit() {
    if (!form.full_name || !form.birth_date || !form.guardian_name || !form.guardian_phone) {
      setError('Preencha: nome, data de nascimento, responsável e telefone.'); return;
    }
    setLoading(true); setError('');
    try {
      const p = await db.createPatient({
        ...form,
        gestational_age_weeks: form.gestational_age_weeks ? Number(form.gestational_age_weeks) : undefined,
        birth_weight_g: form.birth_weight_g ? Number(form.birth_weight_g) : undefined,
      });
      onCreated(p);
    } catch (e: any) {
      setError(e?.message || 'Erro ao cadastrar paciente.');
    } finally { setLoading(false); }
  }

  const FRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>{label}</label>
      {children}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <Card style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Novo paciente</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU }}><X size={18} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Dados do paciente</p>
          <FRow label="Nome completo *">
            <input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Nome completo da criança" style={inputStyle} />
          </FRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FRow label="Data de nascimento *">
              <input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} style={inputStyle} />
            </FRow>
            <FRow label="Sexo *">
              <select value={form.gender} onChange={e => set('gender', e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </FRow>
            <FRow label="Tipo sanguíneo">
              <select value={form.blood_type} onChange={e => set('blood_type', e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                <option value="">—</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FRow>
            <FRow label="Tipo de parto">
              <select value={form.delivery_type} onChange={e => set('delivery_type', e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                <option value="Vaginal">Vaginal</option>
                <option value="Cesariana">Cesariana</option>
              </select>
            </FRow>
            <FRow label="Ig. gestacional (semanas)">
              <input type="number" value={form.gestational_age_weeks} onChange={e => set('gestational_age_weeks', e.target.value)} placeholder="Ex: 39" style={inputStyle} />
            </FRow>
            <FRow label="Peso ao nascer (g)">
              <input type="number" value={form.birth_weight_g} onChange={e => set('birth_weight_g', e.target.value)} placeholder="Ex: 3280" style={inputStyle} />
            </FRow>
          </div>
          <FRow label="Observações / Alergias">
            <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Alergias, condições de base…" style={inputStyle} />
          </FRow>

          <p style={{ margin: '20px 0 16px', fontSize: 13, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Plano de saúde</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FRow label="Operadora">
              <select value={form.insurance_plan} onChange={e => set('insurance_plan', e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                <option value="">Particular / Sem plano</option>
                <option value="Unimed">Unimed</option>
                <option value="Bradesco Saúde">Bradesco Saúde</option>
                <option value="Amil">Amil</option>
                <option value="SulAmérica">SulAmérica</option>
                <option value="Hapvida">Hapvida</option>
                <option value="NotreDame Intermédica">NotreDame Intermédica</option>
                <option value="Porto Seguro Saúde">Porto Seguro Saúde</option>
                <option value="Prevent Senior">Prevent Senior</option>
                <option value="Golden Cross">Golden Cross</option>
                <option value="Sompo Saúde">Sompo Saúde</option>
                <option value="Mediservice">Mediservice</option>
                <option value="Omint">Omint</option>
                <option value="Cassi">Cassi</option>
                <option value="Geap">Geap</option>
                <option value="Postal Saúde">Postal Saúde</option>
                <option value="Outro">Outro</option>
              </select>
            </FRow>
            <FRow label="Nº da carteirinha">
              <input value={form.insurance_card_number} onChange={e => set('insurance_card_number', e.target.value)} placeholder="Ex: 0012345678901" style={inputStyle} />
            </FRow>
          </div>

          <p style={{ margin: '20px 0 16px', fontSize: 13, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Responsável principal</p>
          <FRow label="Nome do responsável *">
            <input value={form.guardian_name} onChange={e => set('guardian_name', e.target.value)} placeholder="Nome completo" style={inputStyle} />
          </FRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FRow label="Parentesco">
              <select value={form.guardian_relationship} onChange={e => set('guardian_relationship', e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                {['Mãe','Pai','Avó','Avô','Tio(a)','Responsável legal'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </FRow>
            <FRow label="Telefone *">
              <input value={form.guardian_phone} onChange={e => set('guardian_phone', e.target.value)} placeholder="(11) 99999-9999" style={inputStyle} />
            </FRow>
          </div>
          <FRow label="E-mail">
            <input type="email" value={form.guardian_email} onChange={e => set('guardian_email', e.target.value)} placeholder="email@exemplo.com" style={inputStyle} />
          </FRow>

          {error && <div style={{ background: DESL, color: DES, borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 4 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <Btn variant="secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancelar</Btn>
            <Btn onClick={handleSubmit} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? 'Cadastrando…' : <><Plus size={14} /> Cadastrar paciente</>}
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── PATIENTS ─────────────────────────────────────────────────────────────────
function PatientsPage({ go, setActivePatient }: { go: (s: string) => void; setActivePatient: (p: Patient) => void }) {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [consultSummaries, setConsultSummaries] = useState<Record<string, { count: number; lastDate: string | null }>>({});
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, summaries] = await Promise.all([db.fetchPatients(), db.fetchConsultationSummaries()]);
      setPatients(ps);
      setConsultSummaries(summaries);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = patients.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.guardians.some(g => g.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      {showModal && <NewPatientModal onClose={() => setShowModal(false)} onCreated={p => { setShowModal(false); setPatients(ps => [p, ...ps]); }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 14 : 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 26, fontWeight: 500 }}>Pacientes</h1>
          <p style={{ margin: '4px 0 0', color: MU, fontSize: 13 }}>{patients.length} paciente{patients.length !== 1 ? 's' : ''} cadastrado{patients.length !== 1 ? 's' : ''}</p>
        </div>
        <Btn size={isMobile ? 'sm' : 'md'} onClick={() => setShowModal(true)}><Plus size={14} /> {isMobile ? 'Novo' : 'Novo paciente'}</Btn>
      </div>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <MagnifyingGlass size={16} color={MU} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou responsável..."
          style={{ width: '100%', padding: '10px 12px 10px 38px', border: `1px solid ${BO}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: '#fff' }} />
      </div>
      <Card>
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 170px 130px 120px 90px', gap: 16, padding: '10px 20px', borderBottom: `1px solid ${BO}`, fontSize: 11, fontWeight: 600, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
            <span>Paciente</span><span>Idade</span><span>Responsável</span><span>Última consulta</span><span>Próx. retorno</span><span>Ações</span>
          </div>
        )}
        {filtered.map((p, i) => {
          const g = primaryGuardian(p);
          const pend = (VACCINES[p.id] || []).filter(v => v.status !== 'done').length;
          return isMobile ? (
            <div key={p.id} onClick={() => { setActivePatient(p); go('patient-detail'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: i < filtered.length - 1 ? `1px solid ${BO}` : 'none', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = PL; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: p.gender === 'M' ? PL : FEMALEL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={18} color={p.gender === 'M' ? P : FEMALE} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.full_name}</div>
                <div style={{ fontSize: 12, color: MU }}>{calcAge(p.birth_date)} · {g?.name || '—'}</div>
                {pend > 0 && <div style={{ fontSize: 11, color: WARN, fontWeight: 500, marginTop: 2 }}>{pend} vacina{pend > 1 ? 's' : ''} pendente{pend > 1 ? 's' : ''}</div>}
              </div>
              <CaretRight size={16} color={MU} />
            </div>
          ) : (
            <div key={p.id} onClick={() => { setActivePatient(p); go('patient-detail'); }}
              style={{ display: 'grid', gridTemplateColumns: '1fr 90px 170px 130px 120px 90px', gap: 16, padding: '14px 20px', borderBottom: i < filtered.length - 1 ? `1px solid ${BO}` : 'none', alignItems: 'center', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = PL; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: p.gender === 'M' ? PL : FEMALEL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={16} color={p.gender === 'M' ? P : FEMALE} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.full_name}</div>
                  <div style={{ fontSize: 12, color: MU }}>
                    {pend > 0 && <span style={{ color: WARN, fontWeight: 500 }}>{pend} vacina{pend > 1 ? 's' : ''} pendente{pend > 1 ? 's' : ''} · </span>}
                    {consultSummaries[p.id]?.count ?? 0} consultas
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 13 }}>{calcAge(p.birth_date)}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{g?.name || '—'}</div>
                <div style={{ fontSize: 12, color: MU }}>{g?.phone}</div>
              </div>
              <span style={{ fontSize: 13, color: MU }}>{consultSummaries[p.id]?.lastDate ? fmtDate(consultSummaries[p.id].lastDate!) : '—'}</span>
              <span style={{ fontSize: 13, color: p.next_return && new Date(p.next_return) < new Date(TODAY) ? DES : INK }}>{fmtDate(p.next_return)}</span>
              <Btn size="sm" variant="secondary" onClick={e => { e.stopPropagation(); setActivePatient(p); go('patient-detail'); }}>Ver ficha</Btn>
            </div>
          );
        })}
        {loading && <div style={{ padding: 40, textAlign: 'center' as const, color: MU }}>Carregando pacientes…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center' as const, color: MU }}>
            {patients.length === 0 ? 'Nenhum paciente cadastrado ainda.' : 'Nenhum paciente encontrado.'}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── GROWTH CHART ─────────────────────────────────────────────────────────────
function GrowthChart({ patient, consultations = [] }: { patient: Patient; consultations?: Consultation[] }) {
  const [metric, setMetric] = useState<'weight'|'height'>('weight');
  const [dbGrowth, setDbGrowth] = useState<{ month: number; weight?: number; height?: number; hc?: number; date: string }[]>([]);

  useEffect(() => {
    db.fetchGrowthRecords(patient.id)
      .then(setDbGrowth)
      .catch(() => setDbGrowth([]));
  }, [patient.id]);

  // Fallback: extrai medidas dos textos das consultas para registros sem growth_records
  function extractFromConsultations() {
    const result: { month: number; weight?: number; height?: number; hc?: number; date: string }[] = [];
    const dbMonths = new Set(dbGrowth.map(r => r.month));
    consultations.forEach(c => {
      const bd = new Date(patient.birth_date);
      const cd = new Date(c.scheduled_at);
      const ageMonths = Math.max(0, (cd.getFullYear() - bd.getFullYear()) * 12 + (cd.getMonth() - bd.getMonth()));
      if (dbMonths.has(ageMonths)) return; // já existe em growth_records

      let weight: number | undefined, height: number | undefined, hc: number | undefined;
      if (c.summary.peso) {
        const m = c.summary.peso.match(/[\d]+[.,]?[\d]*/);
        weight = m ? parseFloat(m[0].replace(',', '.')) : undefined;
      }
      if (c.summary.altura) {
        const m = c.summary.altura.match(/[\d]+[.,]?[\d]*/);
        height = m ? parseFloat(m[0].replace(',', '.')) : undefined;
      }
      if (c.summary.perimetro_cefalico) {
        const m = c.summary.perimetro_cefalico.match(/[\d]+[.,]?[\d]*/);
        hc = m ? parseFloat(m[0].replace(',', '.')) : undefined;
      } else if (c.summary.exame_fisico) {
        const m = c.summary.exame_fisico.match(/[Pp][Cc][:\s]+(\d+[.,]?\d*)\s*cm/);
        const m2 = !m ? c.summary.exame_fisico.match(/[Pp]er[íi]metro\s+[Cc]ef[áa]lico[:\s]+(\d+[.,]?\d*)\s*cm/) : null;
        const matched = m || m2;
        if (matched) hc = parseFloat(matched[1].replace(',', '.'));
      }
      if (weight || height || hc) result.push({ month: ageMonths, weight, height, hc, date: c.scheduled_at.slice(0, 10) });
    });
    return result;
  }

  const allMeasurements = [...dbGrowth, ...extractFromConsultations()];
  const mockGrowth = GROWTH_DATA[patient.id] || [];
  const seenMonths = new Set(allMeasurements.map(m => m.month));
  mockGrowth.forEach(m => {
    if (!seenMonths.has(m.month)) allMeasurements.push({ month: m.month, weight: m.weight, height: m.height, hc: m.hc, date: '' });
  });
  const growth = allMeasurements.sort((a, b) => a.month - b.month);

  const isM = patient.gender === 'M';
  const oms = metric === 'weight' ? (isM ? OMS_WEIGHT_BOY : OMS_WEIGHT_GIRL) : (isM ? OMS_HEIGHT_BOY : OMS_HEIGHT_GIRL);
  const allMonths = Array.from(new Set([...oms.map(o => o.month), ...growth.map(g => g.month)])).sort((a,b)=>a-b);
  const omsMap = Object.fromEntries(oms.map(o => [o.month, o]));
  const grMap = Object.fromEntries(growth.map(g => [g.month, g]));
  const data = allMonths.map(m => ({
    m: `${m}m`, p3: omsMap[m]?.p3, p50: omsMap[m]?.p50, p97: omsMap[m]?.p97,
    paciente: grMap[m] ? (metric === 'weight' ? grMap[m].weight : grMap[m].height) : undefined,
  }));
  const last = growth[growth.length - 1];
  const unit = metric === 'weight' ? 'kg' : 'cm';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Curva de crescimento</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: MU }}>Referência OMS ({isM ? 'meninos' : 'meninas'})</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn size="sm" variant={metric === 'weight' ? 'primary' : 'secondary'} onClick={() => setMetric('weight')}><Heartbeat size={13} /> Peso</Btn>
          <Btn size="sm" variant={metric === 'height' ? 'primary' : 'secondary'} onClick={() => setMetric('height')}><TrendUp size={13} /> Altura</Btn>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Último peso', val: last?.weight ? `${last.weight} kg` : '—' },
          { label: 'Última altura', val: last?.height ? `${last.height} cm` : '—' },
          { label: 'P. cefálico', val: last?.hc ? `${last.hc} cm` : '—' },
        ].map(({ label, val }) => (
          <Card key={label} style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: MU }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{val}</div>
            <div style={{ fontSize: 12, color: MU }}>no mês {last?.month}</div>
          </Card>
        ))}
      </div>
      <Card style={{ padding: 20 }}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={BO} />
            <XAxis dataKey="m" tick={{ fontSize: 11, fill: MU }} />
            <YAxis tick={{ fontSize: 11, fill: MU }} unit={unit} width={45} />
            <Tooltip formatter={(v: number, name: string) => [`${v} ${unit}`, { paciente: 'Paciente', p3: 'P3 (OMS)', p50: 'P50 (OMS)', p97: 'P97 (OMS)' }[name] || name]} />
            <Legend formatter={(v) => ({'paciente':'Paciente','p3':'P3','p50':'P50 (mediana)','p97':'P97'}[v]||v)} />
            <Line dataKey="p3"  stroke={BO} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            <Line dataKey="p50" stroke={MU} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            <Line dataKey="p97" stroke={BO} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            <Line dataKey="paciente" stroke={P} strokeWidth={2.5} dot={{ fill: P, r: 4 }} activeDot={{ r: 6 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, fontWeight: 500, fontSize: 15, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em' }}>Histórico de medições</div>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 100px 120px', padding: '8px 20px', borderBottom: `1px solid ${BO}`, fontSize: 11, fontWeight: 600, color: MU, textTransform: 'uppercase' as const }}>
          <span>Mês</span><span>Peso</span><span>Altura</span><span>P. Cefálico</span>
        </div>
        {[...growth].reverse().map(g => (
          <div key={g.month} style={{ display: 'grid', gridTemplateColumns: '80px 100px 100px 120px', padding: '10px 20px', borderBottom: `1px solid ${BO}`, fontSize: 13 }}>
            <span style={{ fontWeight: 500 }}>{g.month}m</span>
            <span>{g.weight ? `${g.weight} kg` : '—'}</span>
            <span>{g.height ? `${g.height} cm` : '—'}</span>
            <span>{g.hc ? `${g.hc} cm` : '—'}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── PNI SCHEDULE (Calendário Vacinal SBP/MS 2024) ───────────────────────────
const PNI_SCHEDULE = [
  { name: 'BCG', dose: '1ª dose', age_months: 0, age_label: 'Ao nascer' },
  { name: 'Hepatite B', dose: '1ª dose', age_months: 0, age_label: 'Ao nascer' },
  { name: 'Penta (DTP+Hib+HepB)', dose: '1ª dose', age_months: 2, age_label: '2 meses' },
  { name: 'VIP (Polio inativada)', dose: '1ª dose', age_months: 2, age_label: '2 meses' },
  { name: 'Rotavírus Humano', dose: '1ª dose', age_months: 2, age_label: '2 meses' },
  { name: 'Pneumocócica 10V', dose: '1ª dose', age_months: 2, age_label: '2 meses' },
  { name: 'Meningocócica C', dose: '1ª dose', age_months: 3, age_label: '3 meses' },
  { name: 'Penta (DTP+Hib+HepB)', dose: '2ª dose', age_months: 4, age_label: '4 meses' },
  { name: 'VIP (Polio inativada)', dose: '2ª dose', age_months: 4, age_label: '4 meses' },
  { name: 'Rotavírus Humano', dose: '2ª dose', age_months: 4, age_label: '4 meses' },
  { name: 'Pneumocócica 10V', dose: '2ª dose', age_months: 4, age_label: '4 meses' },
  { name: 'Meningocócica C', dose: '2ª dose', age_months: 5, age_label: '5 meses' },
  { name: 'Penta (DTP+Hib+HepB)', dose: '3ª dose', age_months: 6, age_label: '6 meses' },
  { name: 'VIP (Polio inativada)', dose: '3ª dose', age_months: 6, age_label: '6 meses' },
  { name: 'Meningocócica ACWY', dose: '1ª dose', age_months: 12, age_label: '12 meses' },
  { name: 'Febre Amarela', dose: '1ª dose', age_months: 12, age_label: '12 meses' },
  { name: 'Tríplice Viral (SCR)', dose: '1ª dose', age_months: 12, age_label: '12 meses' },
  { name: 'Varicela', dose: '1ª dose', age_months: 12, age_label: '12 meses' },
  { name: 'Pneumocócica 10V', dose: 'Reforço', age_months: 12, age_label: '12 meses' },
  { name: 'Meningocócica C', dose: 'Reforço', age_months: 12, age_label: '12 meses' },
  { name: 'Hepatite A', dose: '1ª dose', age_months: 12, age_label: '12 meses' },
  { name: 'DTP', dose: '1º Reforço', age_months: 15, age_label: '15 meses' },
  { name: 'VOP (Polio oral)', dose: '1º Reforço', age_months: 15, age_label: '15 meses' },
  { name: 'Tríplice Viral (SCR)', dose: '2ª dose', age_months: 15, age_label: '15 meses' },
  { name: 'DTP', dose: '2º Reforço', age_months: 48, age_label: '4 anos' },
  { name: 'VOP (Polio oral)', dose: '2º Reforço', age_months: 48, age_label: '4 anos' },
  { name: 'Varicela', dose: '2ª dose', age_months: 48, age_label: '4 anos' },
  { name: 'HPV', dose: '1ª dose', age_months: 108, age_label: '9 anos' },
  { name: 'HPV', dose: '2ª dose', age_months: 114, age_label: '9a 6m' },
  { name: 'Meningocócica ACWY', dose: 'Reforço', age_months: 120, age_label: '10 anos' },
  { name: 'dT (Difteria + Tétano)', dose: 'Reforço', age_months: 132, age_label: '11 anos' },
];

// ─── VACCINES TAB ─────────────────────────────────────────────────────────────
function VaccinesTab({ patient }: { patient: Patient }) {
  const [dbVaccines, setDbVaccines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [registerDate, setRegisterDate] = useState(new Date().toISOString().split('T')[0]);
  const isMobile = useIsMobile();

  const ageMonths = (() => {
    const bd = new Date(patient.birth_date), now = new Date();
    return (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
  })();

  function refetch() {
    db.fetchVaccines(patient.id).then(setDbVaccines).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { refetch(); }, [patient.id]);

  // Build merged list: PNI schedule + DB records
  const vaccines = PNI_SCHEDULE.map((pni, idx) => {
    const applied = dbVaccines.find(v => v.name === pni.name && v.dose === pni.dose && v.status === 'done');
    let status: 'done' | 'pending' | 'overdue';
    if (applied) {
      status = 'done';
    } else if (pni.age_months < ageMonths) {
      status = 'overdue';
    } else if (pni.age_months === ageMonths) {
      status = 'overdue';
    } else {
      status = 'pending';
    }
    return {
      id: applied?.id || `pni-${idx}`,
      name: pni.name,
      dose: pni.dose,
      age_label: pni.age_label,
      age_months: pni.age_months,
      status,
      date: applied?.applied_at || null,
      dbId: applied?.id || null,
    };
  });

  const done = vaccines.filter(v => v.status === 'done');
  const pending = vaccines.filter(v => v.status !== 'done');
  const overdue = pending.filter(v => v.status === 'overdue');
  const total = vaccines.length;
  const coverage = total > 0 ? Math.round(done.length / total * 100) : 0;

  async function handleRegister(v: typeof vaccines[0], date: string) {
    try {
      if (v.dbId) {
        await db.updateVaccineStatus(v.dbId, 'done', date);
      } else {
        await db.createVaccine({
          patient_id: patient.id, name: v.name, dose: v.dose,
          status: 'done', age_label: v.age_label, applied_at: date,
        });
      }
      setRegisteringId(null);
      refetch();
    } catch (e) { console.error(e); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' as const, color: MU }}>Carregando vacinas…</div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Doses aplicadas', value: done.length, color: SUC },
          { label: 'Pendentes/Atrasadas', value: pending.length, color: overdue.length > 0 ? DES : WARN },
          { label: 'Cobertura PNI', value: `${coverage}%`, color: P },
        ].map(({ label, value, color }) => (
          <Card key={label} style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: MU, fontWeight: 500, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </Card>
        ))}
      </div>
      {overdue.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Warning size={15} color={DES} /><span style={{ fontWeight: 600, fontSize: 14 }}>Vacinas em atraso</span>
            <Badge color={DES} bg={DESL}>{overdue.length}</Badge>
          </div>
          {overdue.map(v => (
            <div key={v.id}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 90px' : '1fr 120px 110px 130px', gap: 12, padding: '12px 20px', borderBottom: registeringId === v.id ? 'none' : `1px solid ${BO}`, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: MU }}>{v.dose} · {v.age_label}</div>
                </div>
                {!isMobile && <span style={{ fontSize: 13, color: MU }}>{v.age_label}</span>}
                {!isMobile && <Badge color={DES} bg={DESL}>Atrasada</Badge>}
                <Btn size="sm" onClick={() => setRegisteringId(registeringId === v.id ? null : v.id)}>
                  <CheckCircle size={13} /> Registrar
                </Btn>
              </div>
              {registeringId === v.id && (
                <div style={{ padding: '10px 20px 14px', background: SUCL, borderBottom: `1px solid ${BO}`, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: MU, flexShrink: 0 }}>Data de aplicação:</span>
                  <input type="date" value={registerDate} onChange={e => setRegisterDate(e.target.value)}
                    style={{ padding: '6px 10px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
                  <Btn size="sm" onClick={() => handleRegister(v, registerDate)}><CheckCircle size={13} /> Confirmar</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setRegisteringId(null)}><X size={13} /></Btn>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
      {pending.filter(v => v.status === 'pending').length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={15} color={WARN} /><span style={{ fontWeight: 600, fontSize: 14 }}>Próximas vacinas</span>
          </div>
          {pending.filter(v => v.status === 'pending').slice(0, 10).map(v => (
            <div key={v.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 90px' : '1fr 120px 110px 130px', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${BO}`, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div>
                <div style={{ fontSize: 12, color: MU }}>{v.dose}</div>
              </div>
              {!isMobile && <span style={{ fontSize: 13, color: MU }}>{v.age_label}</span>}
              {!isMobile && <Badge color={WARN} bg={WARNL}>Prevista</Badge>}
              <Btn size="sm" variant="secondary" onClick={() => setRegisteringId(registeringId === v.id ? null : v.id)}>Antecipar</Btn>
            </div>
          ))}
        </Card>
      )}
      <Card>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, fontWeight: 500, fontSize: 15, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em' }}>
          Vacinas aplicadas
        </div>
        {done.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' as const, color: MU, fontSize: 13 }}>
            Nenhuma vacina registrada ainda. Use o botão "Registrar" para marcar as vacinas aplicadas.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 100px' : '1fr 120px 150px', padding: '8px 20px', borderBottom: `1px solid ${BO}`, fontSize: 11, fontWeight: 600, color: MU, textTransform: 'uppercase' as const }}>
              <span>Vacina / Dose</span><span>Idade</span>{!isMobile && <span>Data aplicação</span>}
            </div>
            {[...done].sort((a, b) => b.age_months - a.age_months).map(v => (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 100px' : '1fr 120px 150px', gap: 16, padding: '11px 20px', borderBottom: `1px solid ${BO}`, alignItems: 'center' }}>
                <div><span style={{ fontWeight: 500, fontSize: 14 }}>{v.name}</span><span style={{ marginLeft: 8, fontSize: 12, color: MU }}>{v.dose}</span></div>
                <span style={{ fontSize: 13, color: MU }}>{v.age_label}</span>
                {!isMobile && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle size={13} color={SUC} /><span style={{ fontSize: 13 }}>{v.date ? fmtDate(v.date) : '—'}</span></div>}
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  );
}

// ─── INSIGHTS ─────────────────────────────────────────────────────────────────
function InsightsCard({ patient }: { patient: Patient }) {
  const insights = INSIGHTS[patient.id] || [];
  const iconMap = { alert: Warning, pattern: Heartbeat, info: Info };
  const colorMap: Record<string, string> = { alert: DES, pattern: WARN, info: P };
  const bgMap: Record<string, string> = { alert: DESL, pattern: WARNL, info: PL };
  return (
    <Card>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Heartbeat size={16} color={P} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Pontos de atenção clínicos</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: MU, fontStyle: 'italic' as const }}>Apoio à decisão · não substitui avaliação médica</span>
      </div>
      {insights.map((ins, i) => {
        const Icon = iconMap[ins.type];
        return (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 20px', borderBottom: i < insights.length - 1 ? `1px solid ${BO}` : 'none' }}>
            <div style={{ background: bgMap[ins.type], borderRadius: 8, padding: 8, flexShrink: 0 }}><Icon size={15} color={colorMap[ins.type]} /></div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{ins.title}</div>
              <div style={{ fontSize: 13, color: MU, lineHeight: 1.5 }}>{ins.body}</div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ─── CONSULTATION DETAIL ──────────────────────────────────────────────────────
function SectionLabel({ abbrev, full }: { abbrev: string; full: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: P, letterSpacing: 1.2, textTransform: 'uppercase' as const, fontFamily: 'monospace' }}>{abbrev}</span>
      <span style={{ fontSize: 11, color: MU, fontWeight: 500 }}>{full}</span>
      <div style={{ flex: 1, borderTop: `1px dashed ${BO}`, marginLeft: 4 }} />
    </div>
  );
}

function ConsultationDetail({ consult, onBack }: { consult: Consultation; onBack: () => void }) {
  const { format } = useContext(ProntuarioFormatCtx);

  if (format === 'escaneavel') {
    return <ScannableConsultationDetail consult={consult} onBack={onBack} />;
  }

  const s = consult.summary;
  const dt = new Date(consult.scheduled_at);
  const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Back + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: P, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 14, fontFamily: 'inherit', padding: 0 }}>
          <ArrowLeft size={16} /> Voltar às consultas
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" size="sm"><DownloadSimple size={14} /> Exportar PDF</Btn>
        </div>
      </div>

      {/* Prontuário document */}
      <Card style={{ overflow: 'hidden' }}>

        {/* ── Document header ── */}
        <div style={{ background: P, padding: '20px 28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 500, opacity: 0.8, textTransform: 'uppercase' as const, letterSpacing: 1 }}>Prontuário de Consulta</div>
            <div style={{ color: '#fff', fontSize: 11, marginTop: 4, opacity: 0.7 }}>Auri · Sistema Pediátrico</div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{dateStr}</div>
            <div style={{ color: '#fff', fontSize: 12, opacity: 0.8, marginTop: 2 }}>{timeStr} · {consult.duration_minutes} min</div>
          </div>
        </div>

        {/* ── Patient identification strip ── */}
        <div style={{ background: PL, padding: '12px 28px', display: 'flex', gap: 32, borderBottom: `1px solid ${BO}`, flexWrap: 'wrap' as const }}>
          {[
            { l: 'Tipo de consulta', v: consult.type === 'retorno' ? 'Retorno' : 'Primeira consulta' },
            { l: 'Médico responsável', v: 'Dr. Daniel — CRM-SP 000000' },
            { l: 'Especialidade', v: 'Pediatria' },
          ].map(({ l, v }) => (
            <div key={l}>
              <div style={{ fontSize: 10, color: MU, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginTop: 1 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── QP ── */}
          <div>
            <SectionLabel abbrev="QP" full="Queixa Principal" />
            <div style={{ fontSize: 14, lineHeight: 1.7, color: INK, paddingLeft: 4 }}>
              {s.queixa_principal}
            </div>
          </div>

          {/* ── ANM ── */}
          <div>
            <SectionLabel abbrev="ANM" full="Anamnese" />
            <div style={{ fontSize: 14, lineHeight: 1.8, color: INK, paddingLeft: 4 }}>
              {consult.anamnesis || s.hda}
            </div>
          </div>

          {/* ── EF ── */}
          <div>
            <SectionLabel abbrev="EF" full="Exame Físico" />
            {/* Vitals chips */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' as const }}>
              {[
                { l: 'Peso', v: s.peso },
                { l: 'Altura', v: s.altura },
                ...(consult.physical_exam.includes('FR') ? [{ l: 'FR', v: consult.physical_exam.match(/FR\s+([\d]+)\s*irpm/)?.[1] ? `${consult.physical_exam.match(/FR\s+([\d]+)\s*irpm/)![1]} irpm` : '—' }] : []),
                ...(consult.physical_exam.includes('FC') ? [{ l: 'FC', v: consult.physical_exam.match(/FC\s+([\d]+)\s*bpm/)?.[1] ? `${consult.physical_exam.match(/FC\s+([\d]+)\s*bpm/)![1]} bpm` : '—' }] : []),
                ...(consult.physical_exam.includes('Temp') || consult.physical_exam.includes('T ') ? [{ l: 'Temp', v: consult.physical_exam.match(/T(?:emp)?\s+([\d,\.]+)°?C/)?.[1] ? `${consult.physical_exam.match(/T(?:emp)?\s+([\d,\.]+)°?C/)![1]}°C` : '—' }] : []),
              ].filter(x => x.v && x.v !== '—').map(({ l, v }) => (
                <div key={l} style={{ background: '#fff', border: `1px solid ${BO}`, borderRadius: 8, padding: '6px 14px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: MU, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{l}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: INK, fontFamily: 'monospace', marginTop: 1 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: INK, paddingLeft: 4 }}>
              {consult.physical_exam}
            </div>
          </div>

          {/* ── HD ── */}
          <div>
            <SectionLabel abbrev="HD" full="Hipóteses Diagnósticas" />
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, paddingLeft: 4 }}>
              {s.hipoteses.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: PL, color: P, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 14, fontWeight: i === 0 ? 600 : 400 }}>{h}</span>
                  {i === 0 && <Badge color={P} bg={PL}>Principal</Badge>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Conduta ── */}
          <div>
            <SectionLabel abbrev="CT" full="Conduta / Plano Terapêutico" />
            <div style={{ fontSize: 14, lineHeight: 1.8, color: INK, paddingLeft: 4 }}>
              {consult.plan}
            </div>
          </div>

          {/* ── Prescrição ── */}
          {consult.prescription && (
            <div>
              <SectionLabel abbrev="RX" full="Prescrição Médica" />
              <div style={{ border: `1px solid ${BO}`, borderRadius: 8, overflow: 'hidden', marginLeft: 4 }}>
                <div style={{ background: SEC, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BO}` }}>
                  <FileText size={13} color={MU} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Receituário</span>
                </div>
                <div style={{ padding: '14px 20px', background: BG }}>
                  {consult.prescription.split('. ').filter(Boolean).map((line, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: i < consult.prescription.split('. ').length - 2 ? `1px dashed ${BO}` : 'none' }}>
                      <span style={{ fontSize: 13, color: P, fontWeight: 700, fontFamily: 'monospace', minWidth: 20 }}>{i + 1}.</span>
                      <span style={{ fontSize: 14, lineHeight: 1.6, fontFamily: 'monospace' }}>{line.trim().replace(/\.$/, '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Vacinas ── */}
          {s.vacinas_mencionadas.length > 0 && (
            <div>
              <SectionLabel abbrev="VAC" full="Vacinas — Registro desta consulta" />
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, paddingLeft: 4 }}>
                {s.vacinas_mencionadas.map((v, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle size={14} color={SUC} />
                    <span style={{ fontSize: 14 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Retorno ── */}
          <div style={{ background: PL, borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: P, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CalendarBlank size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: P, textTransform: 'uppercase' as const, letterSpacing: 1 }}>Retorno</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginTop: 2 }}>{s.retorno}</div>
            </div>
          </div>

        </div>

        {/* ── Document footer ── */}
        <div style={{ padding: '14px 28px', borderTop: `1px solid ${BO}`, background: SEC, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: MU }}>Resumo gerado por IA e validado pelo médico responsável · Auri EMR</span>
          <span style={{ fontSize: 12, color: MU, fontFamily: 'monospace' }}>{fmtDateTime(consult.scheduled_at)}</span>
        </div>
      </Card>
    </div>
  );
}

// ─── SCANNABLE CONSULTATION VIEW ─────────────────────────────────────────────
function ScannableConsultationDetail({ consult, onBack }: { consult: Consultation; onBack: () => void }) {
  const [scannable, setScannable] = useState<ScannableSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const dt = new Date(consult.scheduled_at);
  const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const s = consult.summary;

  useEffect(() => {
    ai.generateScannableSummary({
      queixa_principal: s.queixa_principal,
      anamnesis: consult.anamnesis || s.hda,
      physical_exam: consult.physical_exam,
      hipoteses: s.hipoteses,
      plan: consult.plan,
      peso: s.peso,
      altura: s.altura,
      perimetro_cefalico: s.perimetro_cefalico,
      vacinas_mencionadas: s.vacinas_mencionadas,
      retorno: s.retorno,
    }).then(r => { setScannable(r); setLoading(false); })
      .catch(e => { setError(e.message || 'Erro ao gerar resumo'); setLoading(false); });
  }, [consult.id]);

  const BulletList = ({ items, color = INK }: { items: string[]; color?: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
      {items.filter(Boolean).map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 6, display: 'inline-block' }} />
          <span style={{ fontSize: 13, color, lineHeight: 1.55 }}>{item}</span>
        </div>
      ))}
    </div>
  );

  const SBlock = ({ title, color = P, children }: { title: string; color?: string; children: React.ReactNode }) => (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Back + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: P, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 14, fontFamily: 'inherit', padding: 0 }}>
          <ArrowLeft size={16} /> Voltar às consultas
        </button>
        <Btn variant="secondary" size="sm"><DownloadSimple size={14} /> Exportar PDF</Btn>
      </div>

      <Card style={{ overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: P, padding: '20px 28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 500, opacity: 0.8, textTransform: 'uppercase' as const, letterSpacing: 1 }}>Prontuário de Consulta</div>
            <div style={{ color: '#fff', fontSize: 11, marginTop: 4, opacity: 0.7 }}>Auri · Sistema Pediátrico · Formato Escaneável</div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{dateStr}</div>
            <div style={{ color: '#fff', fontSize: 12, opacity: 0.8, marginTop: 2 }}>{timeStr} · {consult.duration_minutes} min</div>
          </div>
        </div>

        {/* ID strip */}
        <div style={{ background: PL, padding: '12px 28px', display: 'flex', gap: 32, borderBottom: `1px solid ${BO}`, flexWrap: 'wrap' as const }}>
          {[
            { l: 'Tipo de consulta', v: consult.type === 'retorno' ? 'Retorno' : 'Primeira consulta' },
            { l: 'Médico responsável', v: 'Dr. Daniel — CRM-SP 000000' },
            { l: 'Especialidade', v: 'Pediatria' },
          ].map(({ l, v }) => (
            <div key={l}>
              <div style={{ fontSize: 10, color: MU, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginTop: 1 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ padding: '48px 28px', textAlign: 'center' as const }}>
            <div style={{ display: 'inline-flex', flexDirection: 'column' as const, alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, border: `3px solid ${PL}`, borderTopColor: P, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 14, color: MU }}>Gerando prontuário escaneável via IA…</div>
              <div style={{ fontSize: 12, color: MU, opacity: 0.7 }}>Isso pode levar alguns segundos</div>
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '32px 28px', textAlign: 'center' as const }}>
            <Warning size={24} color={WARN} style={{ display: 'block', margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14, color: MU, marginBottom: 14 }}>{error}</div>
            <Btn size="sm" variant="secondary" onClick={() => { setLoading(true); setError(''); }}>Tentar novamente</Btn>
          </div>
        ) : scannable && (
          <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column' as const, gap: 0 }}>

            {/* ── Quick Summary ── */}
            <div style={{ background: PL, borderRadius: 10, padding: '14px 18px', marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: P, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 10 }}>Resumo Rápido</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                {scannable.quick_summary.map((s, i) => (
                  <div key={i} style={{ background: '#fff', border: `1px solid ${BO}`, borderRadius: 99, padding: '5px 14px', fontSize: 12, fontWeight: 500, color: INK, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: P, display: 'inline-block', flexShrink: 0 }} />
                    {s}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Subjetivo + Objetivo ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, marginBottom: 1, background: BO }}>
              <div style={{ background: '#fff', padding: '16px 20px' }}>
                <SBlock title="Subjetivo">
                  <BulletList items={scannable.subjective_bullets} />
                </SBlock>
              </div>
              <div style={{ background: '#fff', padding: '16px 20px' }}>
                <SBlock title="Objetivo — Sinais Vitais">
                  {/* Anthropometrics chips */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const }}>
                    {[
                      { l: 'Peso', v: scannable.objective.anthropometrics.weight },
                      { l: 'Altura', v: scannable.objective.anthropometrics.height },
                      { l: 'PC', v: scannable.objective.anthropometrics.head_circumference },
                    ].filter(x => x.v).map(({ l, v }) => (
                      <div key={l} style={{ background: SEC, border: `1px solid ${BO}`, borderRadius: 8, padding: '5px 12px', textAlign: 'center' as const }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{l}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: INK, fontFamily: 'monospace', marginTop: 1 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <BulletList items={scannable.objective.exam_bullets} />
                </SBlock>
              </div>
            </div>

            {/* ── Hipótese ── */}
            <div style={{ background: '#fff', padding: '16px 20px', borderTop: `1px solid ${BO}`, borderBottom: `1px solid ${BO}`, marginBottom: 1 }}>
              <SBlock title="Hipótese Diagnóstica Principal">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: PL, color: P, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{scannable.assessment.main_hypothesis}</span>
                  <Badge color={P} bg={PL}>Principal</Badge>
                </div>
                {scannable.assessment.other_hypotheses.filter(Boolean).map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: SEC, color: MU, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 2}</span>
                    <span style={{ fontSize: 13, color: INK }}>{h}</span>
                  </div>
                ))}
              </SBlock>
            </div>

            {/* ── Conduta + Orientações ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, marginBottom: 1, background: BO }}>
              <div style={{ background: '#fff', padding: '16px 20px' }}>
                <SBlock title="Conduta Clínica">
                  <BulletList items={scannable.plan.conduct_bullets} color={P} />
                </SBlock>
                {scannable.plan.medications.filter(Boolean).length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <SBlock title="Medicamentos">
                      <BulletList items={scannable.plan.medications} />
                    </SBlock>
                  </div>
                )}
              </div>
              <div style={{ background: '#fff', padding: '16px 20px' }}>
                <SBlock title="Orientações aos Responsáveis" color={SUC}>
                  <BulletList items={scannable.plan.parent_guidance} color={SUC} />
                </SBlock>
              </div>
            </div>

            {/* ── Vacinas + Retorno ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, marginBottom: 18, background: BO }}>
              <div style={{ background: '#fff', padding: '16px 20px' }}>
                <SBlock title="Vacinas Mencionadas">
                  {scannable.plan.vaccines.filter(Boolean).length > 0
                    ? <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                        {scannable.plan.vaccines.filter(Boolean).map((v, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: SUCL, borderRadius: 99, padding: '3px 10px' }}>
                            <CheckCircle size={11} color={SUC} />
                            <span style={{ fontSize: 12, color: SUC, fontWeight: 500 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    : <span style={{ fontSize: 13, color: MU }}>Nenhuma</span>}
                </SBlock>
              </div>
              <div style={{ background: '#fff', padding: '16px 20px' }}>
                <SBlock title="Retorno Previsto">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: P, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CalendarBlank size={15} color="#fff" />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{scannable.plan.return_plan || s.retorno || 'Não informado'}</span>
                  </div>
                </SBlock>
              </div>
            </div>

            {/* ── Alertas ── */}
            <div style={{ background: scannable.alerts[0]?.includes('Nenhum') ? SUCL : WARNL, borderRadius: 8, padding: '12px 16px', border: `1px solid ${scannable.alerts[0]?.includes('Nenhum') ? SUC + '30' : WARN + '30'}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: scannable.alerts[0]?.includes('Nenhum') ? SUC : WARN, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Alertas e Seguimento</div>
              <BulletList items={scannable.alerts} color={scannable.alerts[0]?.includes('Nenhum') ? SUC : WARN} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 28px', borderTop: `1px solid ${BO}`, background: SEC, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: MU }}>Formato escaneável gerado por IA · Auri EMR · CFM 2.454/2026</span>
          <span style={{ fontSize: 12, color: MU, fontFamily: 'monospace' }}>{fmtDateTime(consult.scheduled_at)}</span>
        </div>
      </Card>
    </div>
  );
}

// ─── PATIENT DETAIL ───────────────────────────────────────────────────────────
function PatientDetailPage({ patient, go, onStartConsult, refetchTrigger = 0 }: { patient: Patient; go: (s: string) => void; onStartConsult: () => void; refetchTrigger?: number }) {
  const [tab, setTab] = useState('Resumo');
  const [selectedConsult, setSelectedConsult] = useState<Consultation | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loadingC, setLoadingC] = useState(true);
  const [pendingVaccinesCount, setPendingVaccinesCount] = useState(0);
  const guardian = primaryGuardian(patient);
  const isMobile = useIsMobile();

  useEffect(() => {
    setLoadingC(true);
    db.fetchConsultations(patient.id)
      .then(setConsultations)
      .catch(() => {})
      .finally(() => setLoadingC(false));
  }, [patient.id, refetchTrigger]);

  useEffect(() => {
    const bd = new Date(patient.birth_date);
    const now = new Date();
    const ageMonths = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
    db.fetchVaccines(patient.id)
      .then(dbVs => {
        const count = PNI_SCHEDULE.filter(pni => {
          const done = dbVs.find((v: any) => v.name === pni.name && v.dose === pni.dose && v.status === 'done');
          return !done && pni.age_months <= ageMonths;
        }).length;
        setPendingVaccinesCount(count);
      })
      .catch(() => setPendingVaccinesCount(0));
  }, [patient.id, refetchTrigger]);

  const lastConsult = consultations[0];
  const pend = pendingVaccinesCount;

  return (
    <div>
      <Card style={{ padding: isMobile ? '14px 16px' : '20px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 12 : 20 }}>
          <div style={{ width: isMobile ? 44 : 56, height: isMobile ? 44 : 56, borderRadius: '50%', background: patient.gender === 'M' ? PL : FEMALEL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={isMobile ? 20 : 26} color={patient.gender === 'M' ? P : FEMALE} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
              <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 500 }}>{patient.full_name}</h2>
              <Badge color={patient.gender === 'M' ? P : FEMALE} bg={patient.gender === 'M' ? PL : FEMALEL}>{patient.gender === 'M' ? 'M' : 'F'}</Badge>
            </div>
            <div style={{ display: 'flex', gap: isMobile ? 12 : 24, marginTop: 6, flexWrap: 'wrap' as const }}>
              {[
                { l: 'Idade', v: calcAge(patient.birth_date) },
                { l: 'Nascimento', v: fmtDate(patient.birth_date) },
                ...(!isMobile ? [
                  { l: 'Tipo sanguíneo', v: patient.blood_type || '—' },
                  { l: 'Responsável', v: guardian?.name || '—' },
                  { l: 'Telefone', v: guardian?.phone || '—' },
                ] : [
                  { l: 'Responsável', v: guardian?.name || '—' },
                ]),
              ].map(({ l, v }) => (
                <div key={l}>
                  <div style={{ fontSize: 10, color: MU, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{l}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 1 }}>{v}</div>
                </div>
              ))}
            </div>
            {patient.notes && (
              <div style={{ marginTop: 8, padding: '6px 10px', background: WARNL, borderRadius: 6, fontSize: 12, color: WARN }}>{patient.notes}</div>
            )}
          </div>
          {!isMobile && (
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <Btn variant="secondary"><FileText size={15} /> Editar ficha</Btn>
              <Btn onClick={onStartConsult}><Stethoscope size={15} /> Iniciar consulta</Btn>
            </div>
          )}
        </div>
        {isMobile && (
          <Btn onClick={onStartConsult} style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
            <Stethoscope size={15} /> Iniciar consulta
          </Btn>
        )}
        <div style={{ display: 'flex', gap: isMobile ? 8 : 16, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BO}`, flexWrap: 'wrap' as const }}>
          {[
            { l: 'Consultas', v: loadingC ? '…' : consultations.length },
            { l: 'Última', v: lastConsult ? fmtDate(lastConsult.scheduled_at.split('T')[0]) : '—' },
            { l: 'Retorno', v: fmtDate(patient.next_return) },
            { l: 'Vacinas pend.', v: pend, warn: pend > 0 },
          ].map(({ l, v, warn }) => (
            <div key={l} style={{ textAlign: 'center', padding: isMobile ? '6px 12px' : '8px 20px', background: BG, borderRadius: 6, border: `1px solid ${BO}`, flex: isMobile ? 1 : undefined }}>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: warn ? WARN : INK, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-0.02em' }}>{v}</div>
              <div style={{ fontSize: 11, color: MU, marginTop: 2, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{l}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ overflowX: isMobile ? 'auto' as const : undefined }}>
        <Tabs tabs={['Resumo', 'Consultas', 'Crescimento', 'Vacinas']} active={tab} onChange={t => { setTab(t); setSelectedConsult(null); }} />
      </div>
      <div style={{ paddingTop: isMobile ? 14 : 24 }}>

        {tab === 'Resumo' && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: isMobile ? 12 : 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {lastConsult ? (
                <Card>
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Stethoscope size={15} color={P} /><span style={{ fontWeight: 600, fontSize: 15 }}>Última consulta</span></div>
                    <span style={{ fontSize: 13, color: MU }}>{fmtDateTime(lastConsult.scheduled_at)}</span>
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '10px 20px' }}>
                      {[
                        { l: 'Queixa', v: lastConsult.summary.queixa_principal },
                        { l: 'Diagnóstico', v: lastConsult.diagnosis },
                        { l: 'Peso / Altura', v: `${lastConsult.summary.peso} · ${lastConsult.summary.altura}` },
                        { l: 'Conduta', v: lastConsult.plan.slice(0, 80) + '…' },
                        { l: 'Retorno', v: lastConsult.summary.retorno },
                      ].map(({ l, v }) => (
                        <><span key={l+'L'} style={{ fontSize: 13, fontWeight: 600, color: MU }}>{l}</span><span key={l+'V'} style={{ fontSize: 13, lineHeight: 1.5 }}>{v}</span></>
                      ))}
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <Btn variant="ghost" size="sm" onClick={() => { setSelectedConsult(lastConsult); setTab('Consultas'); }}>Ver resumo completo →</Btn>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card style={{ padding: 24, color: MU, textAlign: 'center' as const }}>Nenhuma consulta registrada ainda.</Card>
              )}
              <InsightsCard patient={patient} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card style={{ padding: 20 }}>
                <div style={{ fontWeight: 500, fontSize: 15, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em', marginBottom: 14 }}>Dados do nascimento</div>
                {[
                  { l: 'Tipo de parto', v: patient.delivery_type },
                  { l: 'Ig. gestacional', v: `${patient.gestational_age_weeks} semanas` },
                  { l: 'Peso ao nascer', v: `${(patient.birth_weight_g / 1000).toFixed(3)} kg` },
                ].map(({ l, v }) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${BO}`, fontSize: 13 }}>
                    <span style={{ color: MU }}>{l}</span><span style={{ fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </Card>
              <Card style={{ padding: 20 }}>
                <div style={{ fontWeight: 500, fontSize: 15, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em', marginBottom: 14 }}>Responsáveis</div>
                {patient.guardians.map((g, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: i < patient.guardians.length - 1 ? `1px solid ${BO}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</span>
                      {g.is_primary && <Badge>Principal</Badge>}
                    </div>
                    <div style={{ fontSize: 13, color: MU, marginTop: 2 }}>{g.relationship} · {g.phone}</div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {tab === 'Consultas' && (
          selectedConsult
            ? <ConsultationDetail consult={selectedConsult} onBack={() => setSelectedConsult(null)} />
            : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <Btn size="sm" onClick={onStartConsult}><Plus size={14} /> Nova consulta</Btn>
                </div>
                {consultations.length === 0 && <Card style={{ padding: 40, textAlign: 'center' as const, color: MU }}>Nenhuma consulta registrada.</Card>}
                {consultations.map((c, i) => (
                  <Card key={c.id} style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => setSelectedConsult(c)}>
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: PL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={18} color={P} /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{fmtDateTime(c.scheduled_at)}</span>
                          <Pill type={c.type} />
                          <Badge color={MU} bg={SEC}>{c.duration_minutes} min</Badge>
                          {i === 0 && <Badge color={SUC} bg={SUCL}>Mais recente</Badge>}
                        </div>
                        <div style={{ fontSize: 13, marginBottom: 2 }}>{c.chief_complaint}</div>
                        <div style={{ fontSize: 12, color: MU }}>{c.diagnosis}</div>
                      </div>
                      <CaretRight size={18} color={MU} />
                    </div>
                  </Card>
                ))}
              </div>
            )
        )}

        {tab === 'Crescimento' && <GrowthChart patient={patient} consultations={consultations} />}
        {tab === 'Vacinas' && <VaccinesTab patient={patient} />}
      </div>
    </div>
  );
}

// ─── CONSULTATION FLOW ────────────────────────────────────────────────────────
function ConsentScreen({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card style={{ maxWidth: 520, width: '90%', padding: 40 }}>
        <div style={{ textAlign: 'center' as const, marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: PL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Microphone size={24} color={P} /></div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>Consentimento para gravação</h2>
          <p style={{ margin: '10px 0 0', color: MU, fontSize: 14, lineHeight: 1.6 }}>Esta consulta será gravada e transcrita por IA para gerar o resumo clínico automaticamente.</p>
        </div>
        <div style={{ background: SEC, borderRadius: 10, padding: 20, marginBottom: 24, fontSize: 13, lineHeight: 1.7, color: MU }}>
          <strong>O que acontece com o áudio:</strong><br />
          • A gravação é processada localmente e descartada após a transcrição<br />
          • Apenas o texto estruturado é salvo no prontuário<br />
          • Dados protegidos conforme LGPD e CFM 2.454/2026<br />
          • O médico revisa e valida o resumo antes de salvar
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 28, fontSize: 14 }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2, accentColor: P, width: 16, height: 16 }} />
          <span>O responsável foi informado e concordou com a gravação desta consulta para fins de documentação médica.</span>
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <Btn variant="secondary" onClick={onCancel} style={{ flex: 1, justifyContent: 'center' }}>Cancelar</Btn>
          <Btn onClick={onOk} disabled={!agreed} style={{ flex: 1, justifyContent: 'center' }}><Microphone size={15} /> Iniciar gravação</Btn>
        </div>
      </Card>
    </div>
  );
}

function RecordingScreen({ time, patient, onFinish }: { time: number; patient: Patient | null; onFinish: (blob: Blob) => void }) {
  const [paused, setPaused] = useState(false);
  const [micError, setMicError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const streamRef   = useRef<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.start(1000);
      })
      .catch(() => setMicError('Permissão de microfone negada. Clique no cadeado na barra do navegador para liberar.'));
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  function togglePause() {
    const r = recorderRef.current;
    if (!r) return;
    if (paused) { r.resume(); setPaused(false); }
    else        { r.pause(); setPaused(true); }
  }

  function handleFinish() {
    const r = recorderRef.current;
    if (!r) return;
    r.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: r.mimeType || 'audio/webm' });
      streamRef.current?.getTracks().forEach(t => t.stop());
      onFinish(blob);
    };
    r.stop();
  }

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <div style={{ height: 56, background: '#fff', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/brand/auri-logo-full.svg" alt="Auri" style={{ height: 22 }} />
          <span style={{ color: BO }}>|</span>
          <span style={{ fontSize: 14, color: MU }}>Em consulta — {patient?.full_name}</span>
        </div>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 18, fontWeight: 600, color: P, letterSpacing: 2 }}>{fmtTimer(time)}</div>
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px', textAlign: 'center' as const }}>
        {micError ? (
          <div style={{ background: DESL, color: DES, borderRadius: 12, padding: 24, fontSize: 14, lineHeight: 1.6 }}>
            <Warning size={24} style={{ marginBottom: 12 }} /><br />{micError}
          </div>
        ) : (
          <>
            <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 32px' }}>
              {!paused && <div className="pulse-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${ACCENT}`, opacity: 0.5 }} />}
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: paused ? SEC : ACCENTL, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                <Microphone size={36} color={paused ? MU : ACCENT} />
              </div>
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 500 }}>{paused ? 'Gravação pausada' : 'Gravando consulta…'}</h2>
            <p style={{ color: MU, fontSize: 14, marginBottom: 32 }}>{paused ? 'Clique em continuar para retomar.' : 'O áudio está sendo capturado. Fale normalmente com o paciente.'}</p>
            {!paused && (
              <div className="recording-wave" style={{ justifyContent: 'center', marginBottom: 32 }}>
                {[16, 28, 20, 36, 24, 32, 18].map((_, i) => <span key={i} />)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Btn variant="secondary" onClick={togglePause} size="lg">{paused ? <><Play size={16} /> Continuar</> : <><Square size={16} /> Pausar</>}</Btn>
              <Btn variant="danger" onClick={handleFinish} size="lg"><CheckCircle size={16} /> Finalizar consulta</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProcessingScreen({ audioBlob, onDone }: { audioBlob: Blob | null; onDone: (summary: StructuredSummary, transcript: string) => void }) {
  const [step, setStep]   = useState(0);
  const [error, setError] = useState('');
  const steps = ['Enviando áudio para transcrição…', 'Whisper transcrevendo consulta…', 'GPT-4o estruturando prontuário…', 'Finalizando resumo clínico…'];

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setStep(0);
        const transcript = audioBlob
          ? await ai.transcribeAudio(audioBlob)
          : 'Médico: Boa tarde. Paciente veio para consulta de rotina. Exame físico sem alterações. Orientações gerais. Retorno em 3 meses.';

        if (cancelled) return;
        setStep(2);
        const summary = await ai.structureSummary(transcript);

        if (cancelled) return;
        setStep(3);
        await new Promise(r => setTimeout(r, 400));

        if (!cancelled) onDone(summary, transcript);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao processar consulta.');
      }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' as const, maxWidth: 420 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: PL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Heartbeat size={28} color={P} />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 500 }}>Processando consulta</h2>
        <p style={{ color: MU, fontSize: 14, marginBottom: 28 }}>Aguarde enquanto a IA estrutura o prontuário…</p>
        {error ? (
          <div style={{ background: DESL, color: DES, borderRadius: 10, padding: 20, fontSize: 13, lineHeight: 1.6 }}>
            <Warning size={20} style={{ marginBottom: 8 }} /><br />
            <strong>Erro ao processar</strong><br />{error}
          </div>
        ) : (
          <Card style={{ padding: 20, textAlign: 'left' as const }}>
            {steps.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', opacity: i > step ? 0.3 : 1, transition: 'opacity 0.4s', borderBottom: i < steps.length - 1 ? `1px solid ${BO}` : 'none' }}>
                {i < step
                  ? <CheckCircle size={16} color={SUC} />
                  : i === step
                    ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${P}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                    : <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${BO}`, flexShrink: 0 }} />
                }
                <span style={{ fontSize: 13 }}>{s}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function SummaryDoneScreen({ patient, recTime, summary, transcript, onSave }: {
  patient: Patient | null; recTime: number;
  summary: StructuredSummary; transcript: string;
  onSave: () => void;
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [saving, setSaving] = useState(false);
  const s = summary;

  async function handleSave() {
    if (!patient) { onSave(); return; }
    setSaving(true);
    try { await db.saveConsultation(patient.id, s, recTime, patient.birth_date); } catch (e) { console.error(e); }
    finally { setSaving(false); onSave(); }
  }
  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: SUCL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={22} color={SUC} /></div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>Consulta processada</h2>
            <p style={{ margin: '4px 0 0', color: MU, fontSize: 14 }}>Revise o resumo antes de salvar no histórico.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { l: 'Peso extraído', v: s.peso, icon: Heartbeat },
            { l: 'Altura extraída', v: s.altura, icon: TrendUp },
            { l: 'Vacinas identificadas', v: `${s.vacinas_mencionadas.length} menção`, icon: Syringe },
          ].map(({ l, v, icon: Icon }) => (
            <Card key={l} style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><Icon size={14} color={P} /><span style={{ fontSize: 12, color: MU }}>{l}</span></div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
            </Card>
          ))}
        </div>
        {s.vacinas_mencionadas.length > 0 && (
          <Card style={{ marginBottom: 16, background: SUCL }}>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: SUC, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Syringe size={13} />Vacinas identificadas no áudio → serão adicionadas à aba Vacinas</div>
              {s.vacinas_mencionadas.map(v => <div key={v} style={{ fontSize: 13 }}>{v}</div>)}
            </div>
          </Card>
        )}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={15} color={P} /><span style={{ fontWeight: 600, fontSize: 15 }}>Resumo estruturado gerado pela IA</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: WARN, fontWeight: 500 }}>Revise antes de salvar</span>
          </div>
          {[
            { label: 'Queixa principal', val: s.queixa_principal },
            { label: 'HDA', val: s.hda },
            { label: 'Exame físico', val: s.exame_fisico },
            { label: 'Pontos de atenção', val: <>{s.hipoteses.map((h,i) => <div key={i}>• {h}</div>)}</> },
            { label: 'Conduta', val: s.conduta },
            { label: 'Retorno', val: s.retorno },
          ].map(({ label, val }) => (
            <div key={label} style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: MU }}>{label}</span>
              <span style={{ fontSize: 14, lineHeight: 1.6 }}>{val}</span>
            </div>
          ))}
        </Card>
        <Card style={{ marginBottom: 24 }}>
          <button onClick={() => setShowTranscript(v => !v)}
            style={{ width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 14 }}>
            <FileText size={15} color={MU} /> Transcrição completa do áudio
            {showTranscript ? <CaretUp size={16} style={{ marginLeft: 'auto' }} /> : <CaretDown size={16} style={{ marginLeft: 'auto' }} />}
          </button>
          {showTranscript && (
            <div style={{ padding: '4px 20px 20px', borderTop: `1px solid ${BO}` }}>
              <pre style={{ fontSize: 13, lineHeight: 1.7, color: MU, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{transcript || '(transcrição não disponível)'}</pre>
            </div>
          )}
        </Card>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" size="lg"><DownloadSimple size={16} /> Exportar PDF</Btn>
          <Btn size="lg" onClick={handleSave} disabled={saving}>{saving ? 'Salvando…' : <><CheckCircle size={16} /> Salvar no histórico</>}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── AGENDA ───────────────────────────────────────────────────────────────────
function getWeekDays(offset: number) {
  const SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: d.toISOString().slice(0, 10), short: SHORT[d.getDay()], day: d.getDate() };
  });
}

function NewAppointmentModal({ onClose, onSaved, defaultDate }: { onClose: () => void; onSaved: () => void; defaultDate: string }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('09:00');
  const [type, setType] = useState<'retorno' | 'primeira vez'>('retorno');
  const [complaint, setComplaint] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { db.fetchPatients().then(setPatients).catch(console.error); }, []);

  async function handleSave() {
    if (!patientId) { setError('Selecione um paciente.'); return; }
    setSaving(true); setError('');
    try {
      await db.createAppointment({ patient_id: patientId, scheduled_at: `${date}T${time}:00`, type, chief_complaint: complaint });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Erro ao agendar.');
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff', color: INK };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Novo agendamento</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU, padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Paciente</label>
          <select value={patientId} onChange={e => setPatientId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">Selecione…</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Horário</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Tipo de consulta</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['retorno', 'primeira vez'] as const).map(opt => (
              <button key={opt} onClick={() => setType(opt)} style={{
                flex: 1, padding: '10px 0', border: `2px solid ${type === opt ? P : BO}`, borderRadius: 8,
                background: type === opt ? PL : '#fff', color: type === opt ? P : MU,
                fontWeight: type === opt ? 600 : 400, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                textTransform: 'capitalize', transition: 'all 0.15s',
              }}>{opt}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Motivo / observação (opcional)</label>
          <input value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="Ex: Retorno pós-antibiótico" style={inputStyle} />
        </div>

        {error && <div style={{ marginBottom: 12, fontSize: 13, color: DES, background: DESL, border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving ? 'Agendando…' : 'Confirmar agendamento'}</Btn>
        </div>
      </div>
    </div>
  );
}

function AgendaPage({ go, setActivePatient }: { go: (s: string) => void; setActivePatient: (p: Patient) => void }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(todayIso);
  const [apptsByDate, setApptsByDate] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const isMobile = useIsMobile();

  const weekDays = getWeekDays(weekOffset);
  const weekStart = weekDays[0].date;
  const weekEnd = weekDays[6].date;

  function loadWeek() {
    setLoading(true);
    db.fetchAppointmentsForWeek(weekStart, weekEnd)
      .then(list => {
        const byDate: Record<string, any[]> = {};
        list.forEach(a => { (byDate[a.date] = byDate[a.date] || []).push(a); });
        setApptsByDate(byDate);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadWeek(); }, [weekStart, weekEnd]);

  const appts = apptsByDate[selected] || [];
  const allAppts = Object.values(apptsByDate).flat();
  const totalWeek = allAppts.length;
  const totalDone = allAppts.filter(a => a.status === 'completed').length;
  const todayCount = (apptsByDate[todayIso] || []).length;
  const isPast = (date: string) => date < todayIso;

  const weekLabel = (() => {
    const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    return `Semana de ${fmt(weekStart)} a ${fmt(weekEnd)}`;
  })();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 14 : 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 26, fontWeight: 500 }}>Agenda</h1>
          {!isMobile && <p style={{ margin: '4px 0 0', color: MU, fontSize: 14 }}>{weekLabel}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isMobile && <>
            <Btn variant="secondary" size="sm" onClick={() => setWeekOffset(w => w - 1)}><CaretLeft size={14} /> Semana anterior</Btn>
            <Btn variant="secondary" size="sm" onClick={() => setWeekOffset(w => w + 1)}>Próxima semana <CaretRight size={14} /></Btn>
          </>}
          {isMobile && <>
            <Btn variant="secondary" size="sm" onClick={() => setWeekOffset(w => w - 1)}><CaretLeft size={14} /></Btn>
            <Btn variant="secondary" size="sm" onClick={() => setWeekOffset(w => w + 1)}><CaretRight size={14} /></Btn>
          </>}
          <Btn size="sm" onClick={() => setShowNewModal(true)}><Plus size={14} /> {isMobile ? '' : 'Novo agendamento'}</Btn>
        </div>
      </div>
      {showNewModal && <NewAppointmentModal defaultDate={selected} onClose={() => setShowNewModal(false)} onSaved={() => { setShowNewModal(false); loadWeek(); }} />}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16, marginBottom: isMobile ? 14 : 24 }}>
        {[
          { label: isMobile ? 'Na semana' : 'Consultas na semana', value: totalWeek, icon: CalendarBlank, color: P },
          { label: 'Realizadas', value: totalDone, icon: CheckCircle, color: SUC },
          { label: 'Agendadas', value: totalWeek - totalDone, icon: Clock, color: WARN },
          { label: 'Hoje', value: todayCount, icon: Baby, color: ACCENT },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} style={{ padding: isMobile ? 14 : 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 6 : 12 }}>
              <span style={{ fontSize: isMobile ? 11 : 13, color: MU, fontWeight: 500 }}>{label}</span>
              <div style={{ background: color + '18', borderRadius: 8, padding: isMobile ? 6 : 8 }}><Icon size={isMobile ? 15 : 18} color={color} /></div>
            </div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-0.02em' }}>{loading ? '—' : value}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: isMobile ? 12 : 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {weekDays.map(({ date, short, day }, i) => {
            const cnt = (apptsByDate[date] || []).length;
            const isToday = date === todayIso;
            const isSel = date === selected;
            const past = isPast(date);
            return (
              <button key={date} onClick={() => setSelected(date)}
                style={{
                  padding: isMobile ? '10px 4px' : '16px 8px', background: isSel ? PL : 'transparent', border: 'none',
                  borderBottom: isSel ? `2px solid ${P}` : `2px solid transparent`,
                  borderRight: i < 6 ? `1px solid ${BO}` : 'none',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
                }}>
                <div style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, color: isSel ? P : MU, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: isMobile ? 4 : 6 }}>{short}</div>
                <div style={{
                  width: isMobile ? 26 : 32, height: isMobile ? 26 : 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: `0 auto ${isMobile ? 4 : 8}px`,
                  background: isToday ? P : 'transparent',
                  color: isToday ? '#fff' : past ? MU : INK,
                  fontWeight: isToday ? 700 : 600, fontSize: isMobile ? 13 : 16,
                }}>{day}</div>
                {cnt > 0
                  ? <span style={{ fontSize: isMobile ? 9 : 11, background: isSel ? P : BO, color: isSel ? '#fff' : MU, borderRadius: 99, padding: isMobile ? '1px 4px' : '2px 8px', fontWeight: 600 }}>{cnt}</span>
                  : <span style={{ fontSize: 10, color: BO }}>·</span>
                }
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {new Date(selected + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          {selected === todayIso && <Badge color={P} bg={PL}>Hoje</Badge>}
          {isPast(selected) && selected !== todayIso && <Badge color={MU} bg={BO}>Passado</Badge>}
        </div>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' as const, color: MU }}>
            <div style={{ fontSize: 13 }}>Carregando…</div>
          </div>
        ) : appts.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' as const, color: MU }}>
            <CalendarBlank size={32} color={BO} style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Sem consultas neste dia</div>
            <div style={{ fontSize: 13 }}>As consultas aparecem aqui após serem salvas</div>
          </div>
        ) : appts.map((appt, i) => (
          <div key={appt.id}
            style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: i < appts.length - 1 ? `1px solid ${BO}` : 'none', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = PL; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            <span style={{ width: 48, fontSize: 14, fontWeight: 600, color: P, flexShrink: 0 }}>{appt.time}</span>
            <StatusDot status={appt.status} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{appt.patient_name}</div>
              <div style={{ fontSize: 12, color: MU }}>{appt.age}{appt.guardian ? ` · ${appt.guardian}` : ''}</div>
            </div>
            <Pill type={appt.type} />
            {appt.status === 'completed' && <Badge color={SUC} bg={SUCL}><CheckCircle size={11} /> Realizada</Badge>}
            {appt.status === 'in_progress' && <Badge color={P} bg={PL}><Heartbeat size={11} /> Em andamento</Badge>}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
  <button onClick={() => onChange(!on)} style={{
    width: 40, height: 22, borderRadius: 11, background: on ? P : BO,
    border: 'none', cursor: 'pointer', position: 'relative' as const, transition: 'background 0.2s', padding: 0, flexShrink: 0,
  }}>
    <span style={{
      position: 'absolute' as const, top: 3, left: on ? 21 : 3, width: 16, height: 16,
      borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    }} />
  </button>
);

function SettingsPage({ user }: { user: any }) {
  const [section, setSection] = useState('perfil');
  const isMobile = useIsMobile();
  const [notifVaccines, setNotifVaccines] = useState(true);
  const [notifReturn, setNotifReturn] = useState(true);
  const [notifReminder, setNotifReminder] = useState(false);
  const [notifWeekly, setNotifWeekly] = useState(true);
  const [autoTranscript, setAutoTranscript] = useState(true);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [summaryDetail, setSummaryDetail] = useState<'detalhado'|'resumido'>('detalhado');
  const { format: prontuarioFormat, setFormat: setProntuarioFormat } = useContext(ProntuarioFormatCtx);

  const [fullName, setFullName] = useState('');
  const [crm, setCrm] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [clinicName, setClinicName] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicEmail, setClinicEmail] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicHoursStart, setClinicHoursStart] = useState('08:00');
  const [clinicHoursEnd, setClinicHoursEnd] = useState('18:00');
  const [savingClinic, setSavingClinic] = useState(false);
  const [saveMsgClinic, setSaveMsgClinic] = useState('');

  useEffect(() => {
    db.fetchProfile().then(p => {
      if (p) {
        setFullName(p.full_name || '');
        setCrm(p.crm || '');
        setSpecialty(p.specialty || '');
        setPhone(p.phone || '');
        setClinicName(p.clinic_name || '');
        setClinicPhone(p.clinic_phone || '');
        setClinicEmail(p.clinic_email || '');
        setClinicAddress(p.clinic_address || '');
        setClinicHoursStart(p.clinic_hours_start || '08:00');
        setClinicHoursEnd(p.clinic_hours_end || '18:00');
      } else if (user) {
        setFullName(user.user_metadata?.full_name || '');
      }
    });
  }, [user]);

  async function handleSaveProfile() {
    setSaving(true); setSaveMsg('');
    try {
      await db.updateProfile({ full_name: fullName, crm, specialty, phone });
      setSaveMsg('Salvo com sucesso!');
    } catch (e: any) {
      setSaveMsg(e.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  }

  async function handleSaveClinic() {
    setSavingClinic(true); setSaveMsgClinic('');
    try {
      await db.updateProfile({
        clinic_name: clinicName, clinic_phone: clinicPhone, clinic_email: clinicEmail,
        clinic_address: clinicAddress, clinic_hours_start: clinicHoursStart, clinic_hours_end: clinicHoursEnd,
      });
      setSaveMsgClinic('Salvo com sucesso!');
    } catch (e: any) {
      setSaveMsgClinic(e.message || 'Erro ao salvar.');
    } finally {
      setSavingClinic(false);
      setTimeout(() => setSaveMsgClinic(''), 3000);
    }
  }

  const initials = fullName
    ? fullName.split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    : 'DR';

  const sections = [
    { id: 'perfil',       label: 'Perfil do médico',  icon: User },
    { id: 'consultorio',  label: 'Consultório',        icon: Buildings },
    { id: 'notificacoes', label: 'Notificações',       icon: Bell },
    { id: 'gravacao',     label: 'Gravação e IA',      icon: Brain },
  ];

  const Field = ({ label, value, disabled = true }: { label: string; value: string; disabled?: boolean }) => (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{label}</label>
      <input defaultValue={value} disabled={disabled}
        style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: disabled ? SEC : '#fff', color: disabled ? MU : INK }} />
    </div>
  );

  const ToggleRow = ({ label, sub, on, onChange }: { label: string; sub: string; on: boolean; onChange: (v: boolean) => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: `1px solid ${BO}` }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>{sub}</div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );

  return (
    <div>
      {!isMobile && (
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 500 }}>Configurações</h1>
          <p style={{ margin: '4px 0 0', color: MU, fontSize: 14 }}>Personalize o Auri para o seu consultório</p>
        </div>
      )}

      {isMobile && (
        <div style={{ display: 'flex', overflowX: 'auto' as const, gap: 8, marginBottom: 16, paddingBottom: 4 }}>
          {sections.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button key={id} onClick={() => setSection(id)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', flexShrink: 0,
                background: active ? P : '#fff', color: active ? '#fff' : MU,
                border: `1px solid ${active ? P : BO}`, borderRadius: 99,
                cursor: 'pointer', fontWeight: active ? 600 : 400, fontSize: 13,
                fontFamily: 'inherit', whiteSpace: 'nowrap' as const, transition: 'all 0.15s',
              }}>
                <Icon size={14} />{label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Section content (shared mobile/desktop) ── */}
      <div style={!isMobile ? { display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' } : {}}>
        {!isMobile && (
          <Card style={{ padding: '8px 0' }}>
            {sections.map(({ id, label, icon: Icon }) => {
              const active = section === id;
              return (
                <button key={id} onClick={() => setSection(id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 20px',
                  background: active ? PL : 'transparent', color: active ? P : INK,
                  border: 'none', borderLeft: active ? `3px solid ${P}` : '3px solid transparent',
                  cursor: 'pointer', fontWeight: active ? 600 : 400, fontSize: 14,
                  fontFamily: 'inherit', textAlign: 'left' as const, transition: 'all 0.15s',
                }}>
                  <Icon size={16} weight={active ? 'fill' : 'regular'} />{label}
                </button>
              );
            })}
          </Card>
        )}
          <div>
          {section === 'perfil' && (
            <Card style={{ padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, paddingBottom: 24, borderBottom: `1px solid ${BO}` }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: P, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{fullName || user?.email || '—'}</div>
                  <div style={{ fontSize: 13, color: MU, marginTop: 2 }}>{specialty || 'Médico'}{crm ? ` · CRM ${crm}` : ''}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Nome completo</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: '#fff', color: INK }} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>CRM</label>
                  <input value={crm} onChange={e => setCrm(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: '#fff', color: INK }} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Especialidade</label>
                  <input value={specialty} onChange={e => setSpecialty(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: '#fff', color: INK }} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Telefone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: '#fff', color: INK }} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>E-mail</label>
                  <input value={user?.email || ''} disabled
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: SEC, color: MU }} />
                </div>
              </div>
              {saveMsg && (
                <div style={{ marginBottom: 8, fontSize: 13, color: saveMsg.includes('sucesso') ? P : DES, textAlign: 'right' as const }}>{saveMsg}</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <Btn onClick={handleSaveProfile} disabled={saving}><FloppyDisk size={14} /> {saving ? 'Salvando…' : 'Salvar alterações'}</Btn>
              </div>
            </Card>
          )}

          {section === 'consultorio' && (
            <Card style={{ padding: 28 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>Dados do consultório</h3>
              {([
                { label: 'Nome do consultório', val: clinicName, set: setClinicName },
              ] as { label: string; val: string; set: (v: string) => void }[]).map(({ label, val, set }) => (
                <div key={label} style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{label}</label>
                  <input value={val} onChange={e => set(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: '#fff', color: INK }} />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                {([
                  { label: 'Telefone de contato', val: clinicPhone, set: setClinicPhone },
                  { label: 'E-mail do consultório', val: clinicEmail, set: setClinicEmail },
                ] as { label: string; val: string; set: (v: string) => void }[]).map(({ label, val, set }) => (
                  <div key={label} style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{label}</label>
                    <input value={val} onChange={e => set(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: '#fff', color: INK }} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Endereço</label>
                <input value={clinicAddress} onChange={e => setClinicAddress(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: '#fff', color: INK }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                {([
                  { label: 'Horário de início', val: clinicHoursStart, set: setClinicHoursStart },
                  { label: 'Horário de encerramento', val: clinicHoursEnd, set: setClinicHoursEnd },
                ] as { label: string; val: string; set: (v: string) => void }[]).map(({ label, val, set }) => (
                  <div key={label} style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{label}</label>
                    <input type="time" value={val} onChange={e => set(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: '#fff', color: INK }} />
                  </div>
                ))}
              </div>
              {saveMsgClinic && (
                <div style={{ marginBottom: 8, fontSize: 13, color: saveMsgClinic.includes('sucesso') ? P : DES, textAlign: 'right' as const }}>{saveMsgClinic}</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <Btn onClick={handleSaveClinic} disabled={savingClinic}><FloppyDisk size={14} /> {savingClinic ? 'Salvando…' : 'Salvar alterações'}</Btn>
              </div>
            </Card>
          )}

          {section === 'notificacoes' && (
            <Card style={{ padding: 28 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>Alertas clínicos</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: MU }}>Notificações exibidas no dashboard e na ficha do paciente.</p>
              <ToggleRow label="Vacinas em atraso" sub="Alertar quando uma vacina do PNI estiver fora do prazo" on={notifVaccines} onChange={setNotifVaccines} />
              <ToggleRow label="Retornos vencidos" sub="Avisar quando a data de retorno agendado passou sem consulta" on={notifReturn} onChange={setNotifReturn} />
              <h3 style={{ margin: '24px 0 4px', fontSize: 16, fontWeight: 600 }}>Comunicação</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: MU }}>Envios automáticos para responsáveis (requer integração de mensageria).</p>
              <ToggleRow label="Lembrete de consulta para responsáveis" sub="Enviar mensagem 24h antes da consulta agendada" on={notifReminder} onChange={setNotifReminder} />
              <ToggleRow label="Resumo semanal" sub="Relatório com as consultas e alertas da semana" on={notifWeekly} onChange={setNotifWeekly} />
            </Card>
          )}

          {section === 'gravacao' && (
            <Card style={{ padding: 28 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>Transcrição e resumo</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: MU }}>Comportamento do AI Ambient Scribe ao processar a gravação.</p>
              <ToggleRow label="Transcrição automática ao finalizar" sub="Iniciar processamento da IA ao encerrar a gravação" on={autoTranscript} onChange={setAutoTranscript} />
              <ToggleRow label="Exibir disclaimer CFM" sub="Mostrar aviso 'Apoio à decisão — não substitui avaliação médica' em todas as telas de IA" on={showDisclaimer} onChange={setShowDisclaimer} />

              <h3 style={{ margin: '24px 0 4px', fontSize: 16, fontWeight: 600 }}>Formato do Prontuário</h3>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: MU }}>Como o prontuário é exibido ao revisar uma consulta.</p>
              {([
                { id: 'narrativo' as ProntuarioFormat, label: 'Narrativo (padrão)', desc: 'Texto corrido no padrão SOAP clássico — ideal para prontuários detalhados e exportação em PDF' },
                { id: 'escaneavel' as ProntuarioFormat, label: 'Escaneável (IA)', desc: 'Bullets curtos e blocos visuais gerados por IA — revisão rápida em 10-20 segundos. Requer conexão com OpenAI.' },
              ]).map(opt => (
                <label key={opt.id} onClick={() => setProntuarioFormat(opt.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0', borderBottom: `1px solid ${BO}`, cursor: 'pointer' }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${prontuarioFormat === opt.id ? P : BO}`, background: prontuarioFormat === opt.id ? P : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {prontuarioFormat === opt.id && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'block' }} />}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: prontuarioFormat === opt.id ? P : INK }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: MU, marginTop: 3, lineHeight: 1.5 }}>{opt.desc}</div>
                  </div>
                </label>
              ))}

              <h3 style={{ margin: '24px 0 12px', fontSize: 16, fontWeight: 600 }}>Nível de detalhe do resumo</h3>
              {(['detalhado', 'resumido'] as const).map(opt => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${BO}`, cursor: 'pointer' }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${summaryDetail === opt ? P : BO}`, background: summaryDetail === opt ? P : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {summaryDetail === opt && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'block' }} />}
                  </span>
                  <div onClick={() => setSummaryDetail(opt)}>
                    <div style={{ fontSize: 14, fontWeight: 500, textTransform: 'capitalize' as const }}>{opt}</div>
                    <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>
                      {opt === 'detalhado' ? 'Inclui todos os campos SOAP, receituário e observações da IA' : 'Apenas queixa, conduta e retorno — ideal para consultas rápidas'}
                    </div>
                  </div>
                </label>
              ))}

              <div style={{ marginTop: 20, background: WARNL, border: `1px solid ${WARN}20`, borderRadius: 8, padding: 14, display: 'flex', gap: 10 }}>
                <Warning size={15} color={WARN} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12, color: WARN, lineHeight: 1.5 }}>
                  A integração com Whisper e GPT-4o ainda não está ativa neste protótipo. As configurações acima serão aplicadas quando o pipeline de IA for conectado.
                </div>
              </div>
            </Card>
          )}
          </div>
        </div>

    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export type AppNotification = { type: 'vaccine' | 'appointment'; title: string; subtitle: string; patientId?: string; };

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [screen, setScreen] = useState('dashboard');
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [flow, setFlow] = useState<'consent'|'recording'|'processing'|'done'|null>(null);
  const [recTime, setRecTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [realSummary, setRealSummary] = useState<StructuredSummary | null>(null);
  const [realTranscript, setRealTranscript] = useState('');
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [prontuarioFormat, setProntuarioFormatState] = useState<ProntuarioFormat>('narrativo');
  const setProntuarioFormat = async (f: ProntuarioFormat) => {
    setProntuarioFormatState(f);
    try {
      await db.updateProfile({ prontuario_format: f });
    } catch (err) {
      console.error('Failed to save prontuario format:', err);
    }
  };
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setDoctorName(session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || '');
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setDoctorName(session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || '');
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load prontuario format from profile
  useEffect(() => {
    if (!user) return;
    db.fetchProfile().then(profile => {
      if (profile?.prontuario_format) {
        setProntuarioFormatState(profile.prontuario_format as ProntuarioFormat);
      }
    }).catch(err => console.error('Failed to load prontuario format:', err));
  }, [user]);

  // Notificações globais
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const notifs: AppNotification[] = [];
      const [ps, stats] = await Promise.all([db.fetchPatients(), db.fetchDashboardStats()]).catch(() => [[], { overdueAppointments: [] }] as any);
      stats.overdueAppointments?.forEach((a: any) => {
        notifs.push({ type: 'appointment', title: `${a.patient_name} — consulta não realizada`, subtitle: `Agendada para ${a.scheduled_at?.slice(0,10)}`, patientId: a.patient_id });
      });
      await Promise.all((ps || []).map(async (p: Patient) => {
        const bd = new Date(p.birth_date), now = new Date();
        const ageMonths = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
        const dbVs = await db.fetchVaccines(p.id).catch(() => []);
        const overdue = PNI_SCHEDULE.filter(pni => !dbVs.find((v: any) => v.name === pni.name && v.dose === pni.dose && v.status === 'done') && pni.age_months <= ageMonths).length;
        if (overdue > 0) notifs.push({ type: 'vaccine', title: `${p.full_name} — ${overdue} vacina${overdue > 1 ? 's' : ''} em atraso`, subtitle: 'Verificar calendário PNI', patientId: p.id });
      }));
      setNotifications(notifs);
    };
    load();
  }, [user]);

  // Recording timer
  useEffect(() => {
    if (flow === 'recording') {
      timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (flow !== 'recording') setRecTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [flow]);

  const go = (s: string) => { setScreen(s); setFlow(null); };

  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' as const }}>
        <img src="/brand/auri-logo-full.svg" alt="Auri" style={{ height: 36, marginBottom: 16 }} />
        <div style={{ fontSize: 13, color: MU }}>Carregando…</div>
      </div>
    </div>
  );

  if (!user) return showLogin
    ? <LoginScreen onBack={() => setShowLogin(false)} />
    : <LandingPage onEnter={() => setShowLogin(true)} />;

  if (flow === 'consent')    return <ConsentScreen onOk={() => setFlow('recording')} onCancel={() => setFlow(null)} />;
  if (flow === 'recording')  return <RecordingScreen time={recTime} patient={activePatient} onFinish={blob => { setAudioBlob(blob); setFlow('processing'); }} />;
  if (flow === 'processing') return <ProcessingScreen audioBlob={audioBlob} onDone={(summary, transcript) => { setRealSummary(summary); setRealTranscript(transcript); setFlow('done'); }} />;
  if (flow === 'done' && realSummary) return <SummaryDoneScreen patient={activePatient} recTime={recTime} summary={realSummary} transcript={realTranscript} onSave={() => { setFlow(null); setAudioBlob(null); setRefetchTrigger(t => t + 1); go('patient-detail'); }} />;

  const breadcrumbs: Record<string, string[]> = {
    dashboard:        ['Início', 'Dashboard'],
    patients:         ['Início', 'Pacientes'],
    'patient-detail': ['Início', 'Pacientes', activePatient?.full_name || ''],
    agenda:           ['Início', 'Agenda'],
    settings:         ['Início', 'Configurações'],
  };

  return (
    <MobileCtx.Provider value={isMobile}>
      <ProntuarioFormatCtx.Provider value={{ format: prontuarioFormat, setFormat: setProntuarioFormat }}>
        <Layout screen={screen} go={go} breadcrumb={breadcrumbs[screen]} onBack={screen === 'patient-detail' ? () => go('patients') : undefined} doctorName={doctorName} notifications={notifications} onNotificationClick={(patientId) => { const p = (activePatient?.id === patientId ? activePatient : null); if (patientId) { db.fetchPatients().then(ps => { const found = ps.find(x => x.id === patientId); if (found) { setActivePatient(found); go('patient-detail'); } }); } }}>
          {screen === 'dashboard' && <DashboardPage go={go} setActivePatient={setActivePatient} />}
          {screen === 'patients'  && <PatientsPage go={go} setActivePatient={setActivePatient} />}
          {screen === 'patient-detail' && activePatient && <PatientDetailPage patient={activePatient} go={go} onStartConsult={() => setFlow('consent')} refetchTrigger={refetchTrigger} />}
          {screen === 'agenda'   && <AgendaPage go={go} setActivePatient={setActivePatient} />}
          {screen === 'settings' && <SettingsPage user={user} />}
        </Layout>
      </ProntuarioFormatCtx.Provider>
    </MobileCtx.Provider>
  );
}
