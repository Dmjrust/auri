import React, { useState, useEffect, useRef, useContext, useCallback, useDeferredValue, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { IconComponent, AppointmentRow } from './lib/types';
import { supabase } from './lib/supabase';
import * as db from './lib/db';
import * as ai from './lib/ai';
import { SmokeyBackground, LoginForm } from './components/ui/login-form';
import { TodayPatientCard } from './components/TodayPatientCard';
import { DevelopmentTab } from './components/DevelopmentTab';
import { OnboardingSetup } from './components/OnboardingSetup';
import type { DayBriefingItem, ChronicDashboardData } from './lib/db';
import {
  SquaresFour, Users, CalendarBlank, GearSix, SignOut, Bell, MagnifyingGlass, CaretRight,
  Play, Square, CheckCircle, Clock, Warning, Info, ArrowLeft, Plus,
  Microphone, FileText, TrendUp, Stethoscope, X, DownloadSimple, User,
  Baby, Heartbeat, Syringe, CaretDown, CaretUp, CaretLeft,
  FloppyDisk, Buildings, Brain, ShieldCheck, PlayCircle, PencilSimple, Trash,
  ChartBar, ArrowUp, ArrowDown, ArrowRight, Lightbulb, Check,
  Star, ArrowCounterClockwise, House, WarningCircle, UserPlus, UsersThree,
  Flask, ClockCounterClockwise, Sparkle,
} from '@phosphor-icons/react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  INSIGHTS,
  OMS_WEIGHT_BOY, OMS_HEIGHT_BOY, OMS_WEIGHT_GIRL, OMS_HEIGHT_GIRL,
  type Patient, type Consultation, type StructuredSummary, type ScannableSummary,
  type AnamnesePrimeiraConsultaData, defaultAnamnesePrimeiraConsulta,
  type AnamneseAdultaData, defaultAnamneseAdulta,
  type ConsultaAdultoData, type ProblemaAtivo, type Medication, type Allergy,
  type ClinicalDocument, type LabMarker,
} from './data/mock';
import './index.css';
import { LandingPage } from './pages/LandingPage';
import { P, PL, ACCENT, ACCENTL, INK, FEMALE, FEMALEL, MU, BO, BG, SEC, SUC, SUCL, WARN, WARNL, DES, DESL } from './lib/design';
import { calcAge, fmtDate, fmtDateTime, fmtTimer, primaryGuardian } from './lib/auri-utils';
import { calcZScore, zToPercentile, _getLms } from './lib/zscore';
import { MobileCtx, useIsMobile } from './contexts/MobileContext';
import { ProntuarioFormatCtx } from './contexts/ProntuarioContext';
import { PatientProvider, usePatients } from './contexts/PatientContext';
import { GrowthChart } from './components/GrowthChart';
import { VaccinesTab, PNI_SCHEDULE } from './components/VaccinesTab';
import { AdultVaccinesTab } from './components/AdultVaccinesTab';
import { Badge, Pill, ZBadge, StatusDot, Card, Btn, Tabs } from './components/auri-ui';
import { RequireRole, useRequireRole } from './components/RequireRole';
import {
  AnamBoolSeg, AnamSelect, ConsultTypeBadge,
  AnamnesePrimeiraConsulta, AnamneseAdultaFields,
  ConsentScreen, RecordingScreen, ProcessingScreen, SummaryDoneScreen,
} from './components/ConsultationFlow';
import { SecretaryDashboard } from './components/SecretaryDashboard';
import { TeamSection } from './components/TeamSection';
import { useAuthProfile } from './contexts/AuthProfileContext';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10);
const SIDEBAR_W = 264; // desktop sidebar width in px — change here if resizing

// ─── RESPONSIVE ──────────────────────────────────────────────────────────────

// ─── PRONTUÁRIO FORMAT CONTEXT ────────────────────────────────────────────────
// (imported from ./contexts/ProntuarioContext)
type ProntuarioFormat = 'narrativo' | 'escaneavel';

// ─── BOTTOM NAV (mobile) ─────────────────────────────────────────────────────
function BottomNav({ screen, go }: { screen: string; go: (s: string) => void }) {
  const { isDoctor, isAdmin } = useAuthProfile();
  const allNavItems = [
    { id: 'dashboard', label: 'Início',     icon: SquaresFour,  doctorOnly: false },
    { id: 'patients',  label: 'Pacientes',  icon: Users,         doctorOnly: false },
    { id: 'agenda',    label: 'Agenda',     icon: CalendarBlank, doctorOnly: false },
    { id: 'settings',  label: 'Config.',    icon: GearSix,       doctorOnly: true  },
  ];
  const navItems = isAdmin
    ? [{ id: 'admin', label: 'Admin', icon: ShieldCheck, doctorOnly: false }]
    : allNavItems.filter(i => !i.doctorOnly || isDoctor);
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
function Sidebar({ screen, go, doctorName, specialty = 'Pediatria' }: { screen: string; go: (s: string) => void; doctorName: string; specialty?: string }) {
  const { isDoctor, isAdmin, role, fullName } = useAuthProfile();
  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard',            icon: SquaresFour,  doctorOnly: false, adminOnly: false },
    { id: 'patients',  label: 'Pacientes',             icon: Users,         doctorOnly: false, adminOnly: false },
    { id: 'agenda',    label: 'Agenda',                icon: CalendarBlank, doctorOnly: false, adminOnly: false },
    { id: 'painel',    label: 'Painel do consultório', icon: ChartBar,      doctorOnly: true,  adminOnly: false },
    { id: 'settings',  label: 'Configurações',         icon: GearSix,       doctorOnly: true,  adminOnly: false },
  ];
  const adminNavItems = [
    { id: 'admin', label: 'Admin', icon: ShieldCheck, doctorOnly: false, adminOnly: true },
  ];
  const navItems = isAdmin
    ? adminNavItems
    : allNavItems.filter(i => !i.doctorOnly || isDoctor);
  // Nome exibido: fullName do perfil (médico ou secretaria)
  const displayName = fullName || doctorName || 'Usuário';
  const displayRole = isAdmin ? 'Admin' : role === 'secretaria' ? 'Secretaria' : (specialty || 'Médico');
  return (
    <div style={{ width: SIDEBAR_W, height: '100%', background: '#fff', borderRight: `1px solid ${BO}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 14px 22px' }}>
        <img src="/brand/auri-logo-full.svg" alt="Auri" style={{ height: 44 }} />
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
          {displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || 'AU'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{displayName}</div>
          <div style={{ fontSize: 11, color: MU }}>{displayRole}</div>
        </div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU, padding: 4, flexShrink: 0 }} onClick={() => db.signOut()} title="Sair">
          <SignOut size={16} />
        </button>
      </div>
    </div>
  );
}

function Header({ breadcrumb, onBack, notifications = [], onNotificationClick, onClearNotifications }: {
  breadcrumb?: string[]; onBack?: () => void;
  notifications?: AppNotification[]; onNotificationClick?: (patientId?: string) => void; onClearNotifications?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
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
        <MagnifyingGlass size={18} color={MU} style={{ cursor: 'pointer' }} onClick={() => setScreen('patients')} />
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
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: isMobile ? 'calc(100vw - 24px)' : 360, background: '#fff', border: `1px solid ${BO}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Notificações</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {notifications.length > 0 && <Badge color={DES} bg={DESL}>{notifications.length} pendente{notifications.length > 1 ? 's' : ''}</Badge>}
                  {notifications.length > 0 && (
                    <button onClick={onClearNotifications} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: MU, padding: '4px 8px', borderRadius: 6, transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = BO + '20'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      Limpar
                    </button>
                  )}
                </div>
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

function Layout({ children, screen, go, breadcrumb, onBack, doctorName, doctorSpecialty, notifications, onNotificationClick, onClearNotifications }: { children: React.ReactNode; screen: string; go: (s: string) => void; breadcrumb?: string[]; onBack?: () => void; doctorName: string; doctorSpecialty?: string; notifications?: AppNotification[]; onNotificationClick?: (patientId?: string) => void; onClearNotifications?: () => void }) {
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
    <div style={{ display: 'flex', height: '100vh', background: BG }}>
      <Sidebar screen={screen} go={go} doctorName={doctorName} specialty={doctorSpecialty ?? 'Pediatria'} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header breadcrumb={breadcrumb} onBack={onBack} notifications={notifications} onNotificationClick={onNotificationClick} onClearNotifications={onClearNotifications} />
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
            <img src="/brand/auri-logo-full.svg" alt="Auri" style={{ height: 44 }} />
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
          <a href="#" style={{ color: INK3, textDecoration: 'none' }} onClick={e => { e.preventDefault(); toast.info('Documento em elaboração. Dúvidas: suporte@auri.com.br'); }}>Privacidade</a>
          <a href="#" style={{ color: INK3, textDecoration: 'none' }} onClick={e => { e.preventDefault(); toast.info('Documento em elaboração. Dúvidas: suporte@auri.com.br'); }}>Termos</a>
          <a href="mailto:suporte@auri.com.br" style={{ color: INK3, textDecoration: 'none' }}>Suporte</a>
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
                <a href="#" style={{ color: P, textDecoration: 'none', fontWeight: 500 }} onClick={async e => {
                  e.preventDefault();
                  if (!email) { toast.error('Digite seu email acima primeiro.'); return; }
                  const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
                  if (resetErr) toast.error('Erro ao enviar email de recuperação.');
                  else toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
                }}>Esqueci a senha</a>
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
            <a href="#" style={{ color: INK2, textDecoration: 'none' }} onClick={e => { e.preventDefault(); toast.info('Documento em elaboração. Dúvidas: suporte@auri.com.br'); }}>Termos</a>
            {' '}e a{' '}
            <a href="#" style={{ color: INK2, textDecoration: 'none' }} onClick={e => { e.preventDefault(); toast.info('Documento em elaboração. Dúvidas: suporte@auri.com.br'); }}>Política de privacidade</a>.
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── LANDING PAGE — componente extraído para src/pages/LandingPage.tsx ───────
// (importado no topo do arquivo)

// Token aliases mantidos para uso residual em outros componentes inline
const DS_INK2   = '#4A5862';
const DS_INK3   = '#6F7C84';
const DS_SAND   = '#E6D5B8';
const DS_PRISOFT = '#DCE9EC';
const DS_DANGER = '#B5503D';

// LandingPage removida deste arquivo — ver src/pages/LandingPage.tsx
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _LandingPageRemoved_STUB({ onEnter: _onEnter }: { onEnter: () => void }) {
  const [mobile, setMobile] = useState(window.innerWidth < 900);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 900);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const DS_SAGE_SOFT = '#EBF5EE';

  const btnPrimary = (lg = false): React.CSSProperties => ({
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: lg ? 15 : 13,
    fontWeight: 500,
    padding: lg ? '12px 24px' : '6px 12px',
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
    padding: lg ? '12px 24px' : '6px 12px',
    borderRadius: 6,
    border: `1px solid ${BO}`,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    color: DS_INK2,
    transition: 'all 180ms',
  });

  const features = [
    { icon: <Microphone size={22} color={P} />,   title: 'Escuta inteligente',    desc: 'Distingue médico, paciente e acompanhante. Reconhece termos clínicos em português brasileiro com precisão de 97%.' },
    { icon: <FileText size={22} color={P} />,      title: 'Prontuário estruturado', desc: 'Auri separa queixa, HMA, exame físico, hipóteses e plano. Você revisa antes de salvar — controle total.' },
    { icon: <ShieldCheck size={22} color={P} />,   title: 'Privacidade primeiro',   desc: 'Conformidade com LGPD e CFM. Áudio nunca é armazenado. Transcrição processada localmente sempre que possível.' },
    { icon: <TrendUp size={22} color={P} />,       title: 'Curvas e vacinas',       desc: 'Crescimento, IMC e esquema vacinal calculados automaticamente. Alertas para próximas doses e retornos.' },
    { icon: <CalendarBlank size={22} color={P} />, title: 'Agenda integrada',       desc: 'Sincroniza com Google Calendar e os principais sistemas de clínicas brasileiras.' },
    { icon: <Baby size={22} color={P} />,          title: 'Pensado para pediatria', desc: 'Vocabulário, percentis e protocolos específicos da pediatria. Não é uma ferramenta genérica adaptada.' },
  ];

  const privacyItems = [
    { title: 'Conforme LGPD e CFM',         desc: 'Auditado por advogados especializados em saúde digital.' },
    { title: 'Áudio nunca é armazenado',     desc: 'A gravação é descartada assim que a transcrição termina.' },
    { title: 'Servidores no Brasil',         desc: 'Dados de pacientes nunca saem do território nacional.' },
    { title: 'Você é o dono',               desc: 'Exporte tudo a qualquer momento. Cancele e os dados são apagados.' },
  ];

  const statsData = [
    { v: '1', sub: 'h',   l: 'Economizadas por dia, em média, por pediatra ativo' },
    { v: '97', sub: '%',  l: 'Precisão na transcrição em PT-BR clínico' },
    { v: '+12k', sub: '', l: 'Consultas registradas com Auri este mês' },
    { v: '5', sub: 'min', l: 'Para configurar e iniciar a primeira consulta' },
  ];

  const essentialFeatures = ['Até 50 consultas por mês', 'Prontuário estruturado automático', 'Curvas de crescimento e vacinas', 'Exportação em PDF e CSV', 'Suporte por email'];
  const proFeatures = [
    { text: 'Até 120 consultas por mês', bold: true },
    { text: 'Tudo do plano Essencial', bold: false },
    { text: 'Modelos de prontuário customizados', bold: false },
    { text: 'Agenda integrada com Google Calendar', bold: false },
    { text: 'Suporte prioritário em até 4h', bold: false },
  ];

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: '"Inter", system-ui, sans-serif', color: INK, WebkitFontSmoothing: 'antialiased' }}>

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <div style={{ background: BG }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 32px', display: 'flex', alignItems: 'center', gap: 32 }}>
          <img src="/brand/auri-logo-full.svg" alt="Auri" style={{ height: 52 }} />
          {!mobile && (
            <div style={{ marginLeft: 32, display: 'flex', gap: 24 }}>
              {[{ l: 'Produto', href: '#produto' }, { l: 'Privacidade', href: '#privacidade' }, { l: 'Preços', href: '#precos' }].map(({ l, href }) => (
                <a key={l} href={href} style={{ color: DS_INK2, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button style={btnGhost()} onClick={onEnter}>Entrar</button>
            <button style={btnPrimary()} onClick={onEnter}>Testar grátis 14 dias</button>
          </div>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1120, margin: '40px auto 56px', padding: '0 32px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: ACCENT }}>
          Para pediatras
        </div>
        <h1 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 'clamp(48px, 7vw, 84px)', fontWeight: 400, lineHeight: 1.0, letterSpacing: '-0.025em', margin: '18px 0 24px', color: INK, fontVariationSettings: '"opsz" 144', maxWidth: '14ch' }}>
          Foque no paciente.<br />
          Auri cuida do{' '}
          <em style={{ fontStyle: 'italic', color: P, fontWeight: 500 }}>prontuário</em>.
        </h1>
        <p style={{ fontSize: 19, lineHeight: 1.55, color: DS_INK2, maxWidth: '56ch', margin: '0 0 24px' }}>
          Auri ouve a consulta, transcreve o que importa e organiza o prontuário automaticamente.{' '}
          <strong style={{ color: INK, fontWeight: 600 }}>Economize até 1 hora por dia</strong>{' '}
          — saia do consultório sem prontuários para digitar à noite.
        </p>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' as const }}>
          <button style={btnPrimary(true)} onClick={onEnter}>Testar grátis por 14 dias</button>
          <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: DS_INK2, fontSize: 14, textDecoration: 'none' }}>
            <PlayCircle size={20} color={DS_INK2} /> Ver demo de 90s
          </a>
        </div>
        {/* Microcopy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: DS_INK3, fontSize: 13, marginTop: 14, flexWrap: 'wrap' as const }}>
          <CheckCircle size={14} color={SUC} />
          <span>Sem cartão de crédito</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: MU, display: 'inline-block' }} />
          <span>Configure em menos de 5 minutos</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: MU, display: 'inline-block' }} />
          <span>Cancele quando quiser</span>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1120, margin: '0 auto 40px', padding: '0 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', borderTop: `1px solid ${BO}`, borderBottom: `1px solid ${BO}` }}>
          {statsData.map((s, i) => (
            <div key={i} style={{ padding: '22px 24px', borderRight: (!mobile && i < 3) || (mobile && i % 2 === 0) ? `1px solid ${BO}` : 'none', borderBottom: mobile && i < 2 ? `1px solid ${BO}` : 'none' }}>
              <div style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 32, fontWeight: 500, color: P, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {s.v}{s.sub && <sub style={{ fontSize: 16, fontWeight: 400, color: DS_INK2, marginLeft: 2 }}>{s.sub}</sub>}
              </div>
              <div style={{ fontSize: 13, color: DS_INK2, marginTop: 6, lineHeight: 1.35 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Hero visual ──────────────────────────────────────────────── */}
      <section id="produto" style={{ maxWidth: 1120, margin: '0 auto 100px', padding: '0 32px' }}>
        <div style={{ background: '#fff', border: `1px solid ${BO}`, borderRadius: 20, boxShadow: '0 16px 40px rgba(28,42,46,0.10), 0 4px 12px rgba(28,42,46,0.05)', padding: 32, display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 32, alignItems: 'center' }}>
          <div style={{ padding: 24, background: BG, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: ACCENTL, color: DES }}>
                <span className="live-dot" />
                Auri ouvindo
              </span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: DS_INK2 }}>04:21</span>
            </div>
            <div className="hero-wave">
              {Array.from({ length: 9 }).map((_, i) => <span key={i} />)}
            </div>
            <div style={{ marginTop: 14, fontSize: 13, color: DS_INK2 }}>
              Lara Mendes · 4 anos · tosse seca há 3 dias
            </div>
          </div>
          <div>
            <div style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 22, lineHeight: 1.4, color: INK, fontStyle: 'italic' }}>
              "Voltei a olhar nos olhos das mães. O prontuário se escreve sozinho."
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: DS_SAND, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>RM</div>
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
        <h2 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 48, fontWeight: 400, letterSpacing: '-0.02em', maxWidth: '16ch', margin: '0 0 56px', color: INK, lineHeight: 1.1 }}>
          Menos digitação. Mais consulta.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: 24 }}>
          {features.map((f, i) => (
            <div key={i} style={{ padding: 28, background: '#fff', border: `1px solid ${BO}`, borderRadius: 14, boxShadow: '0 1px 2px rgba(28,42,46,0.05)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: DS_PRISOFT, color: P, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.icon}</div>
              <h3 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 22, fontWeight: 500, margin: '18px 0 8px', color: INK, letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: DS_INK2, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Privacy ──────────────────────────────────────────────────── */}
      <section id="privacidade" style={{ maxWidth: 1120, margin: '0 auto 100px', padding: '0 32px' }}>
        <div style={{ padding: mobile ? '32px' : '40px 48px', background: DS_SAGE_SOFT, borderRadius: 20, display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1.4fr', gap: 40, alignItems: 'center' }}>
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#fff', color: SUC, borderRadius: 999, fontSize: 12, fontWeight: 600, letterSpacing: '0.02em' }}>
              <ShieldCheck size={14} color={SUC} /> Dados protegidos
            </span>
            <h2 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 36, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, color: INK, margin: '14px 0 0', maxWidth: '14ch' }}>
              Seus dados, e os do paciente, ficam onde devem ficar.
            </h2>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 14 }}>
            {privacyItems.map((item, i) => (
              <li key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12, alignItems: 'start', fontSize: 15, lineHeight: 1.5, color: INK }}>
                <CheckCircle size={20} color={SUC} style={{ marginTop: 1 } as React.CSSProperties} />
                <div>
                  <strong style={{ fontWeight: 600 }}>{item.title}</strong>
                  <span style={{ color: DS_INK2, display: 'block', marginTop: 2, fontSize: 13 }}>{item.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section id="precos" style={{ maxWidth: 1120, margin: '0 auto 100px', padding: '0 32px' }}>
        <div style={{ textAlign: 'center' as const, marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: ACCENT, marginBottom: 12 }}>Preços</div>
          <h2 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: mobile ? 34 : 48, fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 12px', color: INK, lineHeight: 1.1 }}>
            Simples. Por médico.
          </h2>
          <p style={{ fontSize: 16, color: DS_INK2, maxWidth: '50ch', margin: '0 auto', lineHeight: 1.5 }}>
            Economize horas por semana — o equivalente a várias consultas. Comece com 14 dias grátis, sem cartão.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2, minmax(0, 360px))', gap: 20, justifyContent: 'center', alignItems: 'stretch' }}>

          {/* Essencial */}
          <div style={{ padding: '32px 28px', background: '#fff', border: `1px solid ${BO}`, borderRadius: 16, display: 'flex', flexDirection: 'column' as const, position: 'relative' as const }}>
            <h3 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 22, fontWeight: 500, margin: '0 0 6px', color: INK }}>Essencial</h3>
            <p style={{ fontSize: 13, color: DS_INK2, margin: '0 0 24px', lineHeight: 1.4, minHeight: 36 }}>
              Para quem está começando e atende menor volume de pacientes. Perfeito para começar com segurança.
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 18, color: DS_INK2, fontWeight: 500 }}>R$</span>
              <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 56, fontWeight: 500, color: INK, letterSpacing: '-0.03em', lineHeight: 1 }}>149</span>
              <span style={{ fontSize: 14, color: DS_INK3, fontWeight: 500 }}>/mês</span>
            </div>
            <div style={{ fontSize: 12, color: DS_INK3, marginBottom: 24 }}>cobrança mensal · cancele quando quiser</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'grid', gap: 10, flexGrow: 1 }}>
              {essentialFeatures.map(item => (
                <li key={item} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 10, fontSize: 14, lineHeight: 1.45, color: INK, alignItems: 'start' }}>
                  <Check size={16} color={SUC} style={{ marginTop: 2 } as React.CSSProperties} />
                  {item}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 'auto' }}>
              <button onClick={onEnter} style={{ width: '100%', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 14, fontWeight: 500, padding: '11px 0', borderRadius: 8, border: `1px solid ${BO}`, cursor: 'pointer', background: '#fff', color: INK, transition: 'all 180ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = BG; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}>
                Testar grátis por 14 dias
              </button>
              <div style={{ fontSize: 11, color: DS_INK3, textAlign: 'center' as const, marginTop: 10, lineHeight: 1.4 }}>Sem cartão · sem compromisso</div>
            </div>
          </div>

          {/* Pro — featured */}
          <div style={{ padding: '32px 28px', background: '#fff', border: `2px solid ${P}`, borderRadius: 16, boxShadow: `0 0 0 3px rgba(15,76,92,0.08), 0 4px 16px rgba(28,42,46,0.10)`, display: 'flex', flexDirection: 'column' as const, position: 'relative' as const }}>
            <div style={{ position: 'absolute' as const, top: -12, left: '50%', transform: 'translateX(-50%)', background: P, color: '#fff', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }}>
              Mais popular
            </div>
            <h3 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 22, fontWeight: 500, margin: '0 0 6px', color: INK }}>Pro</h3>
            <p style={{ fontSize: 13, color: DS_INK2, margin: '0 0 24px', lineHeight: 1.4, minHeight: 36 }}>
              Para quem usa o Auri no dia a dia do consultório. Economize horas todos os dias sem mudar sua rotina.
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 18, color: DS_INK2, fontWeight: 500 }}>R$</span>
              <span style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 56, fontWeight: 500, color: INK, letterSpacing: '-0.03em', lineHeight: 1 }}>249</span>
              <span style={{ fontSize: 14, color: DS_INK3, fontWeight: 500 }}>/mês</span>
            </div>
            <div style={{ fontSize: 12, color: DS_INK3, marginBottom: 24 }}>menos que o valor de 2 consultas por mês — equivalente a poucos atendimentos</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'grid', gap: 10, flexGrow: 1 }}>
              {proFeatures.map(item => (
                <li key={item.text} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 10, fontSize: 14, lineHeight: 1.45, color: INK, alignItems: 'start' }}>
                  <Check size={16} color={SUC} style={{ marginTop: 2 } as React.CSSProperties} />
                  {item.bold ? <strong>{item.text}</strong> : item.text}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 'auto' }}>
              <button onClick={onEnter} style={{ width: '100%', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 14, fontWeight: 600, padding: '11px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: P, color: '#fff', transition: 'all 180ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
                Testar grátis por 14 dias
              </button>
              <div style={{ fontSize: 11, color: DS_INK3, textAlign: 'center' as const, marginTop: 10, lineHeight: 1.4 }}>Comece hoje com sua agenda real · cancele quando quiser</div>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center' as const, fontSize: 12, color: DS_INK3, marginTop: 32, marginBottom: 0, maxWidth: '48ch', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
          Uso dentro de padrões normais de consulta. Sem cobranças inesperadas.
        </p>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1120, margin: '0 auto 64px', padding: '0 32px' }}>
        <div style={{ padding: mobile ? '48px 32px' : '64px 48px', background: P, color: BG, borderRadius: 20, display: 'flex', flexDirection: mobile ? 'column' as const : 'row' as const, gap: 32, alignItems: mobile ? 'flex-start' : 'center' }}>
          <div>
            <h2 style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: mobile ? 32 : 44, fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 12px', color: '#fff', maxWidth: '14ch', lineHeight: 1.05 }}>
              Comece hoje. Sem cartão.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(220,233,236,0.85)', margin: '0 0 14px', maxWidth: '36ch' }}>
              14 dias grátis com sua agenda real. Configure em menos de 5 minutos.
            </p>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' as const, fontSize: 13, color: 'rgba(220,233,236,0.75)' }}>
              {['Sem cartão', 'Cancele quando quiser', 'Exporte tudo'].map(item => (
                <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={16} color={SUCL} />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: mobile ? 0 : 'auto', display: 'flex', flexDirection: 'column' as const, gap: 10, minWidth: 240 }}>
            <button onClick={onEnter} style={{ width: '100%', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 15, fontWeight: 500, padding: '12px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', background: BG, color: P, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
              Testar grátis por 14 dias
            </button>
            <button onClick={() => {}} style={{ width: '100%', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 15, fontWeight: 500, padding: '12px 20px', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: BG, border: '1px solid rgba(200,220,224,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
              Falar com vendas
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 32px 48px', display: 'flex', gap: 24, fontSize: 13, color: DS_INK3, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200 }}>© 2026 Auri Saúde Ltda · CNPJ 00.000.000/0001-00</div>
        {(['LGPD', 'Termos'] as const).map(l => (
          <a key={l} href="#" style={{ color: DS_INK3, textDecoration: 'none' }} onClick={e => { e.preventDefault(); toast.info('Documento em elaboração. Dúvidas: suporte@auri.com.br'); }}>{l}</a>
        ))}
        <a href="mailto:suporte@auri.com.br" style={{ color: DS_INK3, textDecoration: 'none' }}>Contato</a>
      </footer>

    </div>
  );
}


// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, action, onAction }: { icon: IconComponent; title: string; action?: string; onAction?: () => void }) => (
  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon size={16} color={P} />
      <span style={{ fontWeight: 500, fontSize: 15, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em' }}>{title}</span>
    </div>
    {action && <Btn size="sm" variant="ghost" onClick={onAction}>{action}</Btn>}
  </div>
);

const KpiCard = ({ label, value, sub, isMobile, bg, border, valueColor }: { label: string; value: React.ReactNode; sub: string; isMobile: boolean; bg?: string; border?: string; valueColor?: string }) => (
  <div style={{ background: bg ?? '#fff', border: `1px solid ${border ?? BO}`, borderRadius: 12, padding: isMobile ? '12px 14px' : '16px 20px' }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: MU, letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 700, color: valueColor ?? P, lineHeight: 1, fontFamily: '"JetBrains Mono", monospace', fontVariantNumeric: 'tabular-nums' as const }}>{value}</div>
    <div style={{ fontSize: 11, color: MU, marginTop: 5 }}>{sub}</div>
  </div>
);

function DashboardPage({ go, setActivePatient, onStartConsult, user, doctorName: doctorNameProp, specialty = 'Pediatria', setPresetPatientSearch, setPendingDetailTab }: { go: (s: string) => void; setActivePatient: (p: Patient) => void; onStartConsult: (type: 'retorno' | 'primeira vez', apptId?: string) => void; user: SupabaseUser | null; doctorName: string; specialty?: string; setPresetPatientSearch?: (s: string) => void; setPendingDetailTab?: (t: string | null) => void }) {
  // patients come from shared PatientContext (no individual fetch needed here)
  const { patients } = usePatients();
  const isClinicaGeral = specialty !== 'Pediatria';
  const [todayAppts, setTodayAppts] = useState<any[]>([]);
  const [overdueAppts, setOverdueAppts] = useState<{ patient_id: string; patient_name: string; scheduled_at: string }[]>([]);
  const [overdueVaccPatients, setOverdueVaccPatients] = useState<{ id: string; full_name: string; overdueCount: number; overdueNames: string[] }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ id: string; patient_id: string; patient_name: string; date: string; type: string }[]>([]);
  const [consultSummaries, setConsultSummaries] = useState<Record<string, { count: number; lastDate: string | null }>>({});
  const [dayBriefing, setDayBriefing] = useState<Record<string, DayBriefingItem>>({});
  const [lastPatient, setLastPatient] = useState<Patient | null>(null);
  const [chronicData, setChronicData] = useState<ChronicDashboardData | null>(null);
  const [recentExams, setRecentExams] = useState<db.RecentClinicalDocument[]>([]);
  const [thisMonthPatients, setThisMonthPatients] = useState(0);
  const [expandedPriority, setExpandedPriority] = useState<'retorno' | 'vacinas' | 'sem-consulta' | null>(null);
  const [showAttentionPoints, setShowAttentionPoints] = useState(true);
  const [dismissedPriorities, setDismissedPriorities] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('auri_dismissed_priorities');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const isMobile = useIsMobile();
  const doctorName = doctorNameProp || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Médico';

  function navToPatient(patientId: string) {
    const p = patients.find(x => x.id === patientId);
    if (p) { setActivePatient(p); go('patient-detail'); }
  }

  function dismissPriority(type: string, patientId: string) {
    const key = `${type}:${patientId}`;
    const next = new Set(dismissedPriorities);
    next.add(key);
    setDismissedPriorities(next);
    try { localStorage.setItem('auri_dismissed_priorities', JSON.stringify([...next])); } catch {}
  }

  function clearDismissedPriorities() {
    setDismissedPriorities(new Set());
    try { localStorage.removeItem('auri_dismissed_priorities'); } catch {}
  }

  // Load dashboard-specific data (no patient fetch — comes from PatientContext)
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      db.fetchTodayAppointments(),
      db.fetchDashboardStats(),
      db.fetchRecentActivity(),
      db.fetchConsultationSummaries(),
    ]).then(([appts, stats, activity, summaries]) => {
      if (cancelled) return;
      setTodayAppts(appts);
      setOverdueAppts(stats.overdueAppointments);
      setThisMonthPatients(stats.thisMonthPatients);
      setRecentActivity(activity);
      setConsultSummaries(summaries);
      const ids = appts.map((a) => a.patient_id).filter(Boolean);
      if (ids.length > 0) db.fetchDayBriefing(ids).then(b => { if (!cancelled) setDayBriefing(b); }).catch(() => {});
    }).catch(() => { if (!cancelled) toast.error('Erro ao carregar dados do painel'); });
    return () => { cancelled = true; };
  }, []);

  // Derive lastPatient once both recentActivity and patients are available
  useEffect(() => {
    if (recentActivity.length > 0 && patients.length > 0) {
      const lp = patients.find((p: Patient) => p.id === recentActivity[0].patient_id);
      if (lp) setLastPatient(lp);
    }
  }, [recentActivity, patients]);

  // Chronic dashboard data — Clínica Geral only
  useEffect(() => {
    if (specialty === 'Pediatria') return;
    db.fetchChronicDashboardData().then(data => setChronicData(data)).catch(() => {});
    db.fetchRecentClinicalDocuments(5).then(setRecentExams).catch(() => {});
  }, [specialty]);

  // Batch vaccine overdue calc — Pediatria only
  useEffect(() => {
    if (patients.length === 0 || specialty !== 'Pediatria') return;
    db.fetchAllVaccinesForDoctor().then(vaccMap => {
      const results: { id: string; full_name: string; overdueCount: number; overdueNames: string[] }[] = [];
      const now = new Date();
      patients.forEach((p: Patient) => {
        const bd = new Date(p.birth_date);
        const ageMonths = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
        const dbVs = vaccMap[p.id] || [];
        const overdue = PNI_SCHEDULE.filter(pni => {
          const done = dbVs.find((v) => v.name === pni.name && v.dose === pni.dose && v.status === 'done');
          return !done && pni.age_months < ageMonths; // strict: vacinas do mês atual ainda estão no prazo
        });
        if (overdue.length > 0) results.push({
          id: p.id,
          full_name: p.full_name,
          overdueCount: overdue.length,
          overdueNames: [...new Set(overdue.map(v => v.name))].slice(0, 3),
        });
      });
      setOverdueVaccPatients(results);
    }).catch(() => { /* vacinas: não bloqueia a tela se falhar */ });
  }, [patients, specialty]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const todayStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Computed metrics
  const firstTimePatients = patients.filter(p => !(consultSummaries[p.id]?.count > 0));
  const retornosPendentes = overdueAppts.length;
  const completedToday = todayAppts.filter(a => a.status === 'completed' || a.status === 'in_progress').length;
  const waitingToday = todayAppts.filter(a => a.status === 'confirmed').length;

  // Filtered by dismissed state
  const displayedOverdueAppts = overdueAppts.filter(a => !dismissedPriorities.has(`retorno:${a.patient_id}`));
  const displayedOverdueVaccPatients = overdueVaccPatients.filter(v => !dismissedPriorities.has(`vacinas:${v.id}`));
  const displayedFirstTimePatients = firstTimePatients.filter(p => !dismissedPriorities.has(`sem-consulta:${p.id}`));
  const hasDismissed = dismissedPriorities.size > 0;

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
  // Clínica Geral — pacientes sem consulta há muito tempo (>180d), com dias calculados
  const longInactivePatients = patients
    .map(p => {
      const lastDate = consultSummaries[p.id]?.lastDate;
      if (!lastDate) return null;
      const days = Math.floor((now.getTime() - new Date(lastDate).getTime()) / 86400000);
      return days > 180 ? { id: p.id, full_name: p.full_name, days } : null;
    })
    .filter((x): x is { id: string; full_name: string; days: number } => x !== null)
    .sort((a, b) => b.days - a.days);
  const longInactiveOver365 = longInactivePatients.filter(p => p.days > 365).length;

  // Clínica Geral — insights computáveis a partir de dados reais
  const clinicalInsights: string[] = [];
  if (chronicData) {
    const conditionNoReturnCount: Record<string, number> = {};
    chronicData.patientsWithoutReturn.forEach(p => p.conditions.forEach(c => { conditionNoReturnCount[c] = (conditionNoReturnCount[c] ?? 0) + 1; }));
    Object.entries(conditionNoReturnCount).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([cond, n]) => {
      clinicalInsights.push(`${n} paciente${n !== 1 ? 's' : ''} com ${cond} sem retorno agendado`);
    });
  }
  if (recentExams.length > 0) clinicalInsights.push(`${recentExams.length} exame${recentExams.length !== 1 ? 's' : ''} aguardando revisão`);
  if (longInactiveOver365 > 0) clinicalInsights.push(`${longInactiveOver365} paciente${longInactiveOver365 !== 1 ? 's' : ''} sem consulta há mais de 12 meses`);

  const attentionPoints: string[] = [];
  overdueVaccPatients.slice(0, 3).forEach(v => attentionPoints.push(`${v.full_name} — ${v.overdueCount} vacina${v.overdueCount > 1 ? 's' : ''} em atraso no PNI`));
  if (overdueVaccPatients.length > 3) attentionPoints.push(`+${overdueVaccPatients.length - 3} outros pacientes com vacinas em atraso`);
  noReturnIn30.slice(0, 3).forEach(p => attentionPoints.push(`${p.full_name} sem consulta há mais de 30 dias`));
  if (firstTimePatients.length > 0) attentionPoints.push(`${firstTimePatients.length} paciente${firstTimePatients.length > 1 ? 's' : ''} ainda sem consulta registrada`);

  const lastConsultDate = lastPatient ? consultSummaries[lastPatient.id]?.lastDate : null;

  // Calculate next appointment and context
  const nextAppt = todayAppts.length > 0 ? todayAppts[0] : null;
  const agendaStr = todayAppts.length === 0
    ? 'Nenhuma consulta agendada'
    : `${todayAppts.length} consulta${todayAppts.length !== 1 ? 's' : ''} agendada${todayAppts.length !== 1 ? 's' : ''}, próxima às ${nextAppt?.time || ''} com ${nextAppt?.patient_name || ''}`;

  const totalPrioridades = displayedOverdueAppts.length + displayedOverdueVaccPatients.length + displayedFirstTimePatients.length;

  // Helper: format relative timestamp
  const formatRelativeTime = (iso: string) => {
    const then = new Date(iso).getTime(), nowMs = new Date().getTime(), diff = (nowMs - then) / 1000;
    if (diff < 60) return 'há poucos segundos';
    if (diff < 3600) return `há ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    return `há ${Math.floor(diff / 86400)}d`;
  };

  const nextPending = todayAppts.find(a => a.status === 'scheduled' || a.status === 'confirmed');
  const firstName = doctorName.toLowerCase().includes('dr.') || doctorName.toLowerCase().startsWith('dr ')
    ? doctorName.split(' ').slice(1).join(' ').split(' ')[0]
    : doctorName.split(' ')[0];

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 32, fontWeight: 500, color: INK, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {greeting}, {firstName}
          </h1>
          <p style={{ margin: '4px 0 0', color: MU, fontSize: 13 }}>{todayStr}</p>
        </div>
        <a href="#" onClick={e => { e.preventDefault(); go('agenda'); }} style={{ fontSize: 13, color: P, fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' as const }}>
          Ver agenda da semana <CaretRight size={13} />
        </a>
      </div>

      {/* ── KPI strip ── */}
      {!isClinicaGeral ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          <KpiCard label="Hoje" value={todayAppts.length} sub={`consulta${todayAppts.length !== 1 ? 's' : ''} agendada${todayAppts.length !== 1 ? 's' : ''}`} isMobile={isMobile} bg={PL} border={`${P}20`} />
          <KpiCard label="Realizadas" value={completedToday} sub={`de ${todayAppts.length} hoje${waitingToday > 0 ? ` · ${waitingToday} na sala de espera` : ''}`} isMobile={isMobile} bg={completedToday > 0 ? SUCL : '#fff'} border={completedToday > 0 ? `${SUC}30` : BO} valueColor={completedToday > 0 ? SUC : MU} />
          <KpiCard label="Prioridades" value={totalPrioridades} sub={totalPrioridades === 0 ? 'tudo em dia ✓' : `pendência${totalPrioridades !== 1 ? 's' : ''}`} isMobile={isMobile} bg={totalPrioridades > 0 ? DESL : SUCL} border={totalPrioridades > 0 ? `${DES}30` : `${SUC}30`} valueColor={totalPrioridades > 0 ? DES : SUC} />
          <KpiCard label="Próxima" value={nextPending?.time || '—'} sub={nextPending ? nextPending.patient_name.split(' ')[0] : 'sem pendentes'} isMobile={isMobile} valueColor={nextPending ? P : MU} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
          <KpiCard label="Pacientes ativos" value={patients.length} sub={thisMonthPatients > 0 ? `+${thisMonthPatients} este mês` : 'sem novos este mês'} isMobile={isMobile} bg={PL} border={`${P}20`} />
          <KpiCard label="Crônicos acompanhados" value={chronicData?.patientsWithConditions ?? 0} sub={patients.length > 0 ? `${Math.round(((chronicData?.patientsWithConditions ?? 0) / patients.length) * 100)}% dos ativos` : '—'} isMobile={isMobile} />
          <KpiCard label="Exames pendentes" value={recentExams.length} sub="aguardando revisão" isMobile={isMobile} valueColor={recentExams.length > 0 ? WARN : MU} bg={recentExams.length > 0 ? WARNL : '#fff'} border={recentExams.length > 0 ? `${WARN}30` : BO} />
          <KpiCard label="Retornos vencidos" value={overdueAppts.length} sub="precisam de atenção" isMobile={isMobile} valueColor={overdueAppts.length > 0 ? DES : SUC} bg={overdueAppts.length > 0 ? DESL : SUCL} border={overdueAppts.length > 0 ? `${DES}30` : `${SUC}30`} />
          <KpiCard label="Próxima" value={nextPending?.time || '—'} sub={nextPending ? nextPending.patient_name.split(' ')[0] : 'sem pendentes'} isMobile={isMobile} valueColor={nextPending ? P : MU} />
        </div>
      )}

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: isMobile ? 12 : 20, alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 1. Consultas de hoje */}
          <Card>
            <SectionHeader
              icon={CalendarBlank}
              title={`Consultas de hoje${todayAppts.length > 0 ? ` (${completedToday}/${todayAppts.length})` : ''}`}
              action="Ver agenda"
              onAction={() => go('agenda')}
            />
            {todayAppts.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center' as const }}>
                <CalendarBlank size={28} color={BO} style={{ display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 500, fontSize: 15, color: INK, marginBottom: 4 }}>Nenhuma consulta hoje</div>
                <div style={{ fontSize: 13, color: MU, marginBottom: 20 }}>Sua agenda está livre.</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' as const }}>
                  <Btn variant="secondary" onClick={() => go('agenda')}><CalendarBlank size={14} /> Ver agenda da semana</Btn>
                  <Btn onClick={() => go('patients')}><Stethoscope size={14} /> Iniciar nova consulta</Btn>
                </div>
              </div>
            ) : (() => {
              const nextApptId = todayAppts.find(a => a.status !== 'completed')?.id;
              const sortedAppts = [...todayAppts].sort((a, b) => {
                const aDone = a.status === 'completed' ? 1 : 0;
                const bDone = b.status === 'completed' ? 1 : 0;
                return aDone - bDone;
              });
              return sortedAppts.map((appt) => (
                <TodayPatientCard
                  key={appt.id}
                  appt={appt}
                  patient={patients.find((p: Patient) => p.id === appt.patient_id)}
                  briefing={dayBriefing[appt.patient_id]}
                  defaultExpanded={appt.id === nextApptId}
                  specialty={specialty}
                  onStart={() => { db.updateAppointment(appt.id, { status: 'in_progress' }).catch(() => { toast.error('Erro ao atualizar status do agendamento'); }); const p = patients.find((x: Patient) => x.id === appt.patient_id); if (p) { setActivePatient(p); onStartConsult(appt.type as 'retorno' | 'primeira vez', appt.id); } }}
                  onRecord={() => { const p = patients.find((x: Patient) => x.id === appt.patient_id); if (p) { setActivePatient(p); go('patient-detail'); } }}
                  onImportExams={isClinicaGeral ? () => { const p = patients.find((x: Patient) => x.id === appt.patient_id); if (p) { setActivePatient(p); setPendingDetailTab?.('Evolução'); go('patient-detail'); } } : undefined}
                  onCreateProblem={isClinicaGeral ? () => { const p = patients.find((x: Patient) => x.id === appt.patient_id); if (p) { setActivePatient(p); setPendingDetailTab?.('Resumo'); go('patient-detail'); } } : undefined}
                />
              ));
            })()}
          </Card>

          {/* 2. Prioridades */}
          <Card style={{ border: totalPrioridades > 0 ? `1.5px solid ${DES}40` : `1px solid ${BO}` }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Warning size={16} color={totalPrioridades > 0 ? DES : SUC} />
              <span style={{ fontWeight: 500, fontSize: 15, fontFamily: '"Fraunces", Georgia, serif', flex: 1 }}>Prioridades</span>
              {hasDismissed && (
                <button onClick={clearDismissedPriorities} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: MU, padding: '2px 6px', borderRadius: 4 }}>
                  Restaurar ignorados
                </button>
              )}
              {totalPrioridades > 0 && <Badge color={DES} bg={DESL}>{totalPrioridades}</Badge>}
            </div>
            {totalPrioridades === 0 ? (
              <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle size={16} color={SUC} />
                <span style={{ fontSize: 14, color: MU }}>Sem pendências críticas hoje</span>
              </div>
            ) : (
              <div style={{ padding: '16px 20px' }}>
                {/* ── 3 chips visuais ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: expandedPriority ? 16 : 0 }}>
                  {/* Retornos vencidos */}
                  <div onClick={() => setExpandedPriority(expandedPriority === 'retorno' ? null : 'retorno')}
                    style={{ border: `1.5px solid ${displayedOverdueAppts.length > 0 ? DES+'40' : BO}`, borderRadius: 10, padding: '12px 14px', background: displayedOverdueAppts.length > 0 ? DESL : '#fff', cursor: displayedOverdueAppts.length > 0 ? 'pointer' : 'default', textAlign: 'center' as const, transition: 'opacity 0.15s', opacity: expandedPriority && expandedPriority !== 'retorno' ? 0.5 : 1 }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: displayedOverdueAppts.length > 0 ? DES : MU, lineHeight: 1, fontFamily: '"JetBrains Mono", monospace' }}>{displayedOverdueAppts.length}</div>
                    <div style={{ fontSize: 11, color: MU, marginTop: 5 }}>retorno{displayedOverdueAppts.length !== 1 ? 's' : ''} vencido{displayedOverdueAppts.length !== 1 ? 's' : ''}</div>
                  </div>
                  {/* Vacinas em atraso (Pediatria) / Sem retorno há 60d (Clínica Geral) */}
                  {specialty === 'Pediatria' ? (
                    <div onClick={() => setExpandedPriority(expandedPriority === 'vacinas' ? null : 'vacinas')}
                      style={{ border: `1.5px solid ${displayedOverdueVaccPatients.length > 0 ? ACCENT+'40' : BO}`, borderRadius: 10, padding: '12px 14px', background: displayedOverdueVaccPatients.length > 0 ? ACCENTL : '#fff', cursor: displayedOverdueVaccPatients.length > 0 ? 'pointer' : 'default', textAlign: 'center' as const, transition: 'opacity 0.15s', opacity: expandedPriority && expandedPriority !== 'vacinas' ? 0.5 : 1 }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: displayedOverdueVaccPatients.length > 0 ? ACCENT : MU, lineHeight: 1, fontFamily: '"JetBrains Mono", monospace' }}>{displayedOverdueVaccPatients.length}</div>
                      <div style={{ fontSize: 11, color: MU, marginTop: 5 }}>paciente{displayedOverdueVaccPatients.length !== 1 ? 's' : ''} c/ vacina em atraso</div>
                    </div>
                  ) : (
                    (() => {
                      const noReturn = chronicData?.patientsWithoutReturn.length ?? 0;
                      return (
                        <div style={{ border: `1.5px solid ${noReturn > 0 ? DES+'40' : BO}`, borderRadius: 10, padding: '12px 14px', background: noReturn > 0 ? DESL : '#fff', textAlign: 'center' as const }}>
                          <div style={{ fontSize: 28, fontWeight: 700, color: noReturn > 0 ? DES : MU, lineHeight: 1, fontFamily: '"JetBrains Mono", monospace' }}>{noReturn}</div>
                          <div style={{ fontSize: 11, color: MU, marginTop: 5 }}>crônico{noReturn !== 1 ? 's' : ''} sem retorno</div>
                        </div>
                      );
                    })()
                  )}
                  {/* Sem consulta */}
                  <div onClick={() => setExpandedPriority(expandedPriority === 'sem-consulta' ? null : 'sem-consulta')}
                    style={{ border: `1.5px solid ${displayedFirstTimePatients.length > 0 ? WARN+'40' : BO}`, borderRadius: 10, padding: '12px 14px', background: displayedFirstTimePatients.length > 0 ? WARNL : '#fff', cursor: displayedFirstTimePatients.length > 0 ? 'pointer' : 'default', textAlign: 'center' as const, transition: 'opacity 0.15s', opacity: expandedPriority && expandedPriority !== 'sem-consulta' ? 0.5 : 1 }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: displayedFirstTimePatients.length > 0 ? WARN : MU, lineHeight: 1, fontFamily: '"JetBrains Mono", monospace' }}>{displayedFirstTimePatients.length}</div>
                    <div style={{ fontSize: 11, color: MU, marginTop: 5 }}>sem consulta registrada</div>
                  </div>
                </div>

                {/* ── Detalhe expandido por chip ── */}
                {expandedPriority === 'retorno' && displayedOverdueAppts.length > 0 && (
                  <div style={{ background: DESL, borderRadius: 8, overflow: 'hidden' }}>
                    {displayedOverdueAppts.map((a, i) => {
                      const daysDiff = Math.floor((new Date().getTime() - new Date(a.scheduled_at).getTime()) / 86400000);
                      return (
                        <div key={a.patient_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: i < displayedOverdueAppts.length - 1 ? `1px solid ${DES}18` : 'none' }}>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, cursor: 'pointer', color: INK }} onClick={() => navToPatient(a.patient_id)}>{a.patient_name}</span>
                          <span style={{ fontSize: 11, color: DES, flexShrink: 0 }}>{daysDiff}d em atraso</span>
                          <button onClick={() => { navToPatient(a.patient_id); go('agenda'); }} style={{ background: `${P}14`, border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, color: P, cursor: 'pointer', fontWeight: 500 }}>Agendar</button>
                          <button onClick={() => dismissPriority('retorno', a.patient_id)} style={{ background: 'none', border: `1px solid ${BO}`, borderRadius: 4, padding: '3px 8px', fontSize: 11, color: MU, cursor: 'pointer' }}>Ignorar</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {expandedPriority === 'vacinas' && displayedOverdueVaccPatients.length > 0 && (
                  <div style={{ background: ACCENTL, borderRadius: 8, overflow: 'hidden' }}>
                    {displayedOverdueVaccPatients.map((v, i) => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: i < displayedOverdueVaccPatients.length - 1 ? `1px solid ${ACCENT}18` : 'none' }}>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, cursor: 'pointer', color: INK }} onClick={() => navToPatient(v.id)}>{v.full_name}</span>
                        <span style={{ fontSize: 11, color: ACCENT, flexShrink: 0 }}>{v.overdueCount} vacina{v.overdueCount !== 1 ? 's' : ''}</span>
                        <button onClick={() => navToPatient(v.id)} style={{ background: `${ACCENT}18`, border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, color: ACCENT, cursor: 'pointer', fontWeight: 500 }}>Ver</button>
                        <button onClick={() => dismissPriority('vacinas', v.id)} style={{ background: 'none', border: `1px solid ${BO}`, borderRadius: 4, padding: '3px 8px', fontSize: 11, color: MU, cursor: 'pointer' }}>Ignorar</button>
                      </div>
                    ))}
                  </div>
                )}
                {expandedPriority === 'sem-consulta' && displayedFirstTimePatients.length > 0 && (
                  <div style={{ background: WARNL, borderRadius: 8, overflow: 'hidden' }}>
                    {displayedFirstTimePatients.map((p, i) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: i < displayedFirstTimePatients.length - 1 ? `1px solid ${WARN}18` : 'none' }}>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, cursor: 'pointer', color: INK }} onClick={() => { setActivePatient(p); go('patient-detail'); }}>{p.full_name}</span>
                        <button onClick={() => { setActivePatient(p); go('patient-detail'); }} style={{ background: `${WARN}20`, border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, color: WARN, cursor: 'pointer', fontWeight: 500 }}>Iniciar</button>
                        <button onClick={() => dismissPriority('sem-consulta', p.id)} style={{ background: 'none', border: `1px solid ${BO}`, borderRadius: 4, padding: '3px 8px', fontSize: 11, color: MU, cursor: 'pointer' }}>Ignorar</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  {hasDismissed && <button onClick={clearDismissedPriorities} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: MU, padding: '2px 0' }}>Restaurar ignorados</button>}
                </div>
              </div>
            )}
          </Card>

          {/* 2b. Exames / Retornos próximos / Inatividade — Clínica Geral */}
          {isClinicaGeral && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 14 }}>
              <Card>
                <SectionHeader icon={Flask} title="Exames para revisar" action={recentExams.length > 0 ? 'Ver todos' : undefined} onAction={() => go('patients')} />
                {recentExams.length === 0 ? (
                  <div style={{ padding: '18px 20px', fontSize: 12, color: MU }}>Nenhum exame recente.</div>
                ) : recentExams.map((doc, i) => {
                  const days = Math.floor((new Date().getTime() - new Date(doc.created_at).getTime()) / 86400000);
                  return (
                    <div key={doc.id} onClick={() => { const p = patients.find(x => x.id === doc.patient_id); if (p) { setActivePatient(p); setPendingDetailTab?.('Evolução'); go('patient-detail'); } }}
                      style={{ padding: '10px 20px', borderBottom: i < recentExams.length - 1 ? `1px solid ${BO}` : 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = PL}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{doc.patient_name}</div>
                      <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>{doc.lab_name || doc.document_type}</div>
                      <div style={{ fontSize: 11, color: MU, marginTop: 2 }}>{days === 0 ? 'Enviado hoje' : `Enviado há ${days}d`}</div>
                    </div>
                  );
                })}
              </Card>
              <Card>
                <SectionHeader icon={CalendarBlank} title="Retornos próximos" action={chronicData && chronicData.upcomingReturns.length > 0 ? 'Ver todos' : undefined} onAction={() => go('patients')} />
                {!chronicData || chronicData.upcomingReturns.length === 0 ? (
                  <div style={{ padding: '18px 20px', fontSize: 12, color: MU }}>Nenhum retorno agendado.</div>
                ) : chronicData.upcomingReturns.slice(0, 5).map((r, i) => (
                  <div key={r.id} onClick={() => navToPatient(r.id)}
                    style={{ padding: '10px 20px', borderBottom: i < Math.min(chronicData.upcomingReturns.length, 5) - 1 ? `1px solid ${BO}` : 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = PL}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.full_name}</div>
                    <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>{r.conditions.slice(0, 2).join(', ') || '—'}</div>
                    <div style={{ fontSize: 11, color: P, marginTop: 2, fontWeight: 500 }}>{fmtDate(r.next_return)}</div>
                  </div>
                ))}
              </Card>
              <Card>
                <SectionHeader icon={ClockCounterClockwise} title="Sem consulta há muito tempo" action={longInactivePatients.length > 0 ? 'Ver todos' : undefined} onAction={() => go('patients')} />
                {longInactivePatients.length === 0 ? (
                  <div style={{ padding: '18px 20px', fontSize: 12, color: MU }}>Todos os pacientes em dia.</div>
                ) : longInactivePatients.slice(0, 5).map((p, i) => (
                  <div key={p.id} onClick={() => navToPatient(p.id)}
                    style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < Math.min(longInactivePatients.length, 5) - 1 ? `1px solid ${BO}` : 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = PL}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{p.full_name}</span>
                    <Badge color={p.days > 365 ? DES : WARN} bg={p.days > 365 ? DESL : WARNL}>{p.days} dias</Badge>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* 3b. Distribuição de condições — Clínica Geral */}
          {specialty !== 'Pediatria' && chronicData && chronicData.conditionDistribution.length > 0 && (
            <Card>
              <SectionHeader icon={ChartBar} title="Pacientes em acompanhamento" />
              <div style={{ padding: '8px 20px 16px' }}>
                {chronicData.conditionDistribution.map((cond, i) => {
                  const maxCount = chronicData.conditionDistribution[0].count;
                  const pct = Math.round((cond.count / maxCount) * 100);
                  return (
                    <div key={i} onClick={() => { setPresetPatientSearch?.(cond.name); go('patients'); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < chronicData.conditionDistribution.length - 1 ? `1px solid ${BO}` : 'none', cursor: 'pointer' }}>
                      <span style={{ fontSize: 13, color: INK, width: 160, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{cond.name}</span>
                      <div style={{ flex: 1, height: 8, background: BO, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: P, borderRadius: 4, transition: 'width 0.5s ease' }} />
                      </div>
                      <span style={{ fontSize: 12, color: MU, fontFamily: '"JetBrains Mono", monospace', width: 28, textAlign: 'right' as const }}>{cond.count}</span>
                    </div>
                  );
                })}
                {chronicData.patientsWithoutReturn.length > 0 && (
                  <div style={{ marginTop: 14, padding: '10px 14px', background: DESL, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Warning size={14} color={DES} />
                    <span style={{ fontSize: 13, color: DES, fontWeight: 500 }}>{chronicData.patientsWithoutReturn.length} paciente{chronicData.patientsWithoutReturn.length !== 1 ? 's' : ''} crônico{chronicData.patientsWithoutReturn.length !== 1 ? 's' : ''} sem retorno agendado</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* 3. Alertas clínicos por paciente */}
          {alertGroups.length > 0 && (
            <Card>
              <SectionHeader icon={Warning} title="Pacientes que precisam de atenção" action="Ver todos" onAction={() => go('patients')} />
              {alertGroups.map((g, i) => (
                <div key={i}
                  onClick={() => { if (g.patient) { setActivePatient(g.patient); go('patient-detail'); } }}
                  style={{ padding: '12px 20px', borderBottom: i < alertGroups.length - 1 ? `1px solid ${BO}` : 'none', cursor: g.patient ? 'pointer' : 'default' }}
                  onMouseEnter={e => g.patient && ((e.currentTarget as HTMLElement).style.background = PL)}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</span>
                    {g.patient && <CaretRight size={13} color={MU} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {g.issues.map((issue, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: MU }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: issue.color, flexShrink: 0 }} />
                        {issue.text}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* 4. Pacientes recentes */}
          <Card>
            <SectionHeader icon={Users} title="Pacientes recentes" action="Ver todos" onAction={() => go('patients')} />
            {patients.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center' as const }}>
                <Users size={28} color={BO} style={{ display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, color: MU, marginBottom: 16 }}>Nenhum paciente cadastrado.</div>
                <Btn onClick={() => go('patients')}><Plus size={14} /> Cadastrar paciente</Btn>
              </div>
            ) : patients.slice(0, 5).map((p, i) => {
              const isFirst = !(consultSummaries[p.id]?.count > 0);
              const lastDate = consultSummaries[p.id]?.lastDate;
              const nextReturn = (p as any).next_return as string | null;
              return (
                <div key={p.id} onClick={() => { setActivePatient(p); go('patient-detail'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: i < Math.min(patients.length, 5) - 1 ? `1px solid ${BO}` : 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = PL}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: p.gender === 'M' ? PL : FEMALEL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={15} color={p.gender === 'M' ? P : FEMALE} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{p.full_name}</span>
                      <span style={{ fontSize: 12, color: MU }}>{calcAge(p.birth_date)}</span>
                      {isFirst ? <Badge color={ACCENT} bg={ACCENTL}>1ª consulta</Badge> : <Badge color={SUC} bg={SUCL}>Retorno</Badge>}
                    </div>
                    <div style={{ fontSize: 11, color: MU, marginTop: 2, display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                      <span>{primaryGuardian(p)?.name || '—'}</span>
                      {lastDate && <span>· Última: {fmtDate(lastDate)}</span>}
                      {nextReturn && <span>· Retorno: {fmtDate(nextReturn)}</span>}
                    </div>
                  </div>
                  <Btn size="sm" variant="secondary" onClick={e => { e.stopPropagation(); setActivePatient(p); go('patient-detail'); }}>
                    Consultar
                  </Btn>
                </div>
              );
            })}
          </Card>

          {/* 5. Insights do dia (IA) — Clínica Geral */}
          {isClinicaGeral && (
            <Card>
              <SectionHeader icon={Sparkle} title="Insights do dia (IA)" action="Ver todos os insights" onAction={() => go('patients')} />
              <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 10 }}>
                {clinicalInsights.map((insight, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: WARNL, border: `1px solid ${WARN}30`, borderRadius: 8, fontSize: 13, color: INK }}>
                    <Warning size={14} color={WARN} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{insight}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: '#F3F4F6', border: `1px solid ${BO}`, borderRadius: 8, fontSize: 13, color: MU }}>
                  <Info size={14} color={MU} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Em breve: análise de exames e fatores de risco</span>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Iniciar consulta rápida */}
          <Card style={{ border: `1.5px solid ${P}40`, background: PL }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${P}25`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Stethoscope size={15} color={P} />
              <span style={{ fontWeight: 600, fontSize: 14, color: P }}>Iniciar consulta</span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {lastPatient ? (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: MU, letterSpacing: 0.6, textTransform: 'uppercase' as const, marginBottom: 6 }}>Último paciente</div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{lastPatient.full_name}</div>
                    <div style={{ fontSize: 12, color: MU }}>{calcAge(lastPatient.birth_date)}</div>
                  </div>
                  <Btn onClick={() => { setActivePatient(lastPatient); go('patient-detail'); }} style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}>
                    <Stethoscope size={14} /> Continuar com {lastPatient.full_name.split(' ')[0]}
                  </Btn>
                  <Btn variant="secondary" onClick={() => go('patients')} style={{ width: '100%', justifyContent: 'center' }}>
                    Selecionar outro paciente
                  </Btn>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: MU, marginBottom: 14 }}>Selecione um paciente para iniciar.</div>
                  <Btn onClick={() => go('patients')} style={{ width: '100%', justifyContent: 'center' }}>
                    <Users size={14} /> Selecionar paciente
                  </Btn>
                </>
              )}
            </div>
          </Card>

          {/* Pontos de atenção (IA leve) — Pediatria */}
          {!isClinicaGeral && attentionPoints.length > 0 && showAttentionPoints && (
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Info size={15} color={P} />
                  <span style={{ fontWeight: 500, fontSize: 15, fontFamily: '"Fraunces", Georgia, serif' }}>Pontos de atenção</span>
                </div>
                <Btn size="sm" variant="ghost" onClick={() => setShowAttentionPoints(false)} style={{ color: MU, fontSize: 12 }}><X size={14} /> Limpar</Btn>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {attentionPoints.slice(0, 5).map((pt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: INK }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: WARN, flexShrink: 0, marginTop: 5 }} />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Alertas Clínicos — Clínica Geral */}
          {isClinicaGeral && (() => {
            const rows: { label: string; count: number }[] = [
              { label: 'Retornos vencidos', count: overdueAppts.length },
              { label: 'Crônicos sem acompanhamento', count: chronicData?.patientsWithoutReturn.length ?? 0 },
              { label: 'Exames pendentes', count: recentExams.length },
              { label: 'Medicações sem renovação', count: -1 },
              { label: 'Sem consulta há >12 meses', count: longInactiveOver365 },
            ];
            return (
              <Card style={{ padding: 0 }}>
                <SectionHeader icon={Warning} title="Alertas Clínicos" />
                <div style={{ padding: '6px 0' }}>
                  {rows.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px', borderBottom: i < rows.length - 1 ? `1px solid ${BO}` : 'none' }}>
                      <span style={{ fontSize: 13, color: INK }}>{r.label}</span>
                      {r.count === -1 ? (
                        <span style={{ fontSize: 12, color: MU }} title="Em breve">—</span>
                      ) : (
                        <Badge color={r.count > 0 ? DES : SUC} bg={r.count > 0 ? DESL : SUCL}>{r.count}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ─── NEW PATIENT MODAL ────────────────────────────────────────────────────────
// Form row wrapper — defined at module scope so React doesn't create a new component
// type on every keystroke (which would unmount/remount the input and steal focus).
function FRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MU, marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>{label}</label>
      {children}
    </div>
  );
}

const NewPatientModal = React.memo(function NewPatientModal({ onClose, onCreated, specialty = 'Pediatria' }: { onClose: () => void; onCreated: (p: Patient) => void; specialty?: string }) {
  const [form, setForm] = useState({
    full_name: '', birth_date: '', gender: 'M' as 'M' | 'F',
    insurance_plan: '', insurance_card_number: '',
    guardian_name: '', guardian_relationship: 'Mãe', guardian_phone: '', guardian_email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Guardian obrigatório apenas para Pediatria ou menores de 18
  const calcAgeYears = (bd: string) => {
    if (!bd) return null;
    const now = new Date(); const b = new Date(bd);
    return now.getFullYear() - b.getFullYear() - (now < new Date(now.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
  };
  const patientAge = form.birth_date ? calcAgeYears(form.birth_date) : null;
  const showGuardianSection = specialty === 'Pediatria' || (patientAge !== null && patientAge < 18);

  async function handleSubmit() {
    if (!form.full_name.trim()) { setError('Nome completo é obrigatório.'); return; }
    if (!form.birth_date) { setError('Data de nascimento é obrigatória.'); return; }
    if (showGuardianSection && !form.guardian_name.trim()) { setError('Nome do responsável é obrigatório.'); return; }
    if (showGuardianSection && !form.guardian_phone.trim()) { setError('Telefone do responsável é obrigatório.'); return; }
    setLoading(true); setError('');
    try {
      const p = await db.createPatient(form);
      onCreated(p);
    } catch (e: any) {
      setError(e?.message || 'Erro ao cadastrar paciente. Tente novamente.');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <Card style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 16, color: INK }}>Novo paciente</span>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: MU }}>Dados clínicos detalhados serão coletados na 1ª consulta</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU, padding: 4, borderRadius: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Dados do paciente */}
          <section>
            <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Dados do paciente</p>
            <FRow label="Nome completo *">
              <input
                autoFocus
                value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                placeholder={specialty === 'Pediatria' ? 'Nome completo da criança' : 'Nome completo do paciente'}
                style={inputStyle}
              />
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
            </div>
          </section>

          {/* Plano de saúde */}
          <section>
            <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Plano de saúde</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FRow label="Operadora">
                <select value={form.insurance_plan} onChange={e => set('insurance_plan', e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                  <option value="">Particular / Sem plano</option>
                  {['Unimed','Bradesco Saúde','Amil','SulAmérica','Hapvida','NotreDame Intermédica','Porto Seguro Saúde','Prevent Senior','Golden Cross','Sompo Saúde','Mediservice','Omint','Cassi','Geap','Postal Saúde','Outro'].map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </FRow>
              <FRow label="Nº da carteirinha">
                <input value={form.insurance_card_number} onChange={e => set('insurance_card_number', e.target.value)} placeholder="Ex: 0012345678901" style={inputStyle} disabled={!form.insurance_plan} />
              </FRow>
            </div>
          </section>

          {/* Responsável — obrigatório em Pediatria ou para menores de 18 */}
          {showGuardianSection && (
            <section>
              <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>
                Responsável principal{specialty !== 'Pediatria' ? ' (menor de 18 anos)' : ''}
              </p>
              <FRow label="Nome *">
                <input value={form.guardian_name} onChange={e => set('guardian_name', e.target.value)} placeholder="Nome completo do responsável" style={inputStyle} />
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
            </section>
          )}
          {/* Contato do paciente — apenas para especialidades não-pediátricas (adultos) */}
          {!showGuardianSection && (
            <section>
              <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>Contato do paciente</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <FRow label="Telefone">
                  <input value={form.guardian_phone} onChange={e => set('guardian_phone', e.target.value)} placeholder="(11) 99999-9999" style={inputStyle} />
                </FRow>
                <FRow label="E-mail">
                  <input type="email" value={form.guardian_email} onChange={e => set('guardian_email', e.target.value)} placeholder="email@exemplo.com" style={inputStyle} />
                </FRow>
              </div>
            </section>
          )}

          {/* Erro + ações */}
          {error && (
            <div style={{ background: DESL, color: DES, borderRadius: 8, padding: '10px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <WarningCircle size={16} weight="fill" />{error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <Btn variant="secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancelar</Btn>
            <Btn onClick={handleSubmit} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? 'Cadastrando…' : <><UserPlus size={15} /> Cadastrar paciente</>}
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
});

// ─── PATIENTS ─────────────────────────────────────────────────────────────────
function PatientsPage({ go, setActivePatient, specialty = 'Pediatria', presetSearch, onConsumePresetSearch }: { go: (s: string) => void; setActivePatient: (p: Patient) => void; specialty?: string; presetSearch?: string; onConsumePresetSearch?: () => void }) {
  const [search, setSearch] = useState(presetSearch || '');
  // Defer filter computation so typing stays instant even with 200+ patients
  const deferredSearch = useDeferredValue(search);

  // Consome busca pré-definida vinda do Dashboard (ex.: clique em uma condição)
  useEffect(() => {
    if (presetSearch) {
      setSearch(presetSearch);
      onConsumePresetSearch?.();
    }
  }, [presetSearch]);
  // patients come from shared PatientContext
  const { patients, loading: patientsLoading, refetch: refetchPatients } = usePatients();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [consultSummaries, setConsultSummaries] = useState<Record<string, { count: number; lastDate: string | null }>>({});
  // Vacinas em atraso por paciente — batch query (substitui N+1 individual)
  const [vaccineOverdue, setVaccineOverdue] = useState<Record<string, number>>({});
  const isMobile = useIsMobile();
  // Ref for the virtualizer scroll container
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch consultation summaries once
  useEffect(() => {
    db.fetchConsultationSummaries().then(setConsultSummaries).catch(() => { /* background: não bloqueia listagem */ });
  }, []);

  // Batch vaccine overdue computation — fires once patients are available
  useEffect(() => {
    if (patients.length === 0) return;
    setLoading(true);
    db.fetchAllVaccinesForDoctor().then(vaccMap => {
      const now = new Date();
      const vcMap: Record<string, number> = {};
      patients.forEach((p: Patient) => {
        const bd = new Date(p.birth_date);
        const ageMonths = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
        const dbVs = vaccMap[p.id] || [];
        vcMap[p.id] = PNI_SCHEDULE.filter(pni => {
          const done = dbVs.find(v => v.name === pni.name && v.dose === pni.dose && v.status === 'done');
          return !done && pni.age_months < ageMonths;
        }).length;
      });
      setVaccineOverdue(vcMap);
    }).catch(() => { /* vacinas: badge omitido em caso de falha */ }).finally(() => setLoading(false));
  }, [patients]);

  const isLoading = patientsLoading || loading;

  const handleCloseModal = useCallback(() => setShowModal(false), []);
  const handlePatientCreated = useCallback(() => { setShowModal(false); refetchPatients(); }, [refetchPatients]);

  // Filter uses deferred search — UI stays responsive while filter computes
  const filtered = patients.filter(p => {
    if (!deferredSearch) return true;
    const q = deferredSearch.toLowerCase();
    return p.full_name.toLowerCase().includes(q) ||
      p.guardians.some(g => g.name.toLowerCase().includes(q));
  });

  // Row height estimates: mobile items ~82px, desktop ~66px (vaccine badge adds ~18px)
  const ROW_H = isMobile ? 82 : 66;

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_H,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div>
      {showModal && <NewPatientModal onClose={handleCloseModal} onCreated={handlePatientCreated} specialty={specialty} />}
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
      <Card style={{ overflow: 'hidden', overflowX: 'auto' }}>
        {!isMobile && (
          <div style={{ minWidth: 600, display: 'grid', gridTemplateColumns: '1fr 90px 170px 130px 120px 90px', gap: 16, padding: '10px 20px', borderBottom: `1px solid ${BO}`, fontSize: 11, fontWeight: 600, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
            <span>Paciente</span><span>Idade</span><span>Responsável</span><span>Última consulta</span><span>Próx. retorno</span><span>Ações</span>
          </div>
        )}
        {/* Virtualized scroll container — only renders visible rows */}
        <div
          ref={listRef}
          style={{
            height: isLoading || filtered.length === 0
              ? 'auto'
              : Math.min(filtered.length * ROW_H, isMobile ? 520 : 560),
            overflowY: 'auto',
            minWidth: isMobile ? undefined : 600,
          }}
        >
          {isLoading ? (
            <div style={{ padding: 40, textAlign: 'center' as const, color: MU }}>Carregando pacientes…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' as const, color: MU }}>
              {patients.length === 0 ? 'Nenhum paciente cadastrado ainda.' : 'Nenhum paciente encontrado.'}
            </div>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualItems.map(vRow => {
                const p = filtered[vRow.index];
                const g = primaryGuardian(p);
                const pend = vaccineOverdue[p.id] ?? 0;
                return (
                  <div
                    key={p.id}
                    data-index={vRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vRow.start}px)`,
                      borderBottom: `1px solid ${BO}`,
                    }}
                  >
                    {isMobile ? (
                      <div onClick={() => { setActivePatient(p); go('patient-detail'); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
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
                      <div onClick={() => { setActivePatient(p); go('patient-detail'); }}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 90px 170px 130px 120px 90px', gap: 16, padding: '14px 20px', alignItems: 'center', cursor: 'pointer' }}
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
function SectionLabel({ abbrev, full, right }: { abbrev: string; full: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: P, letterSpacing: 1.2, textTransform: 'uppercase' as const, fontFamily: 'monospace' }}>{abbrev}</span>
      <span style={{ fontSize: 11, color: MU, fontWeight: 500 }}>{full}</span>
      <div style={{ flex: 1, borderTop: `1px dashed ${BO}`, marginLeft: 4 }} />
      {right}
    </div>
  );
}

function ConsultationDetail({ consult, onBack, linkedDocuments = [], allConsultations = [], onExamSaved }: { consult: Consultation; onBack: () => void; linkedDocuments?: ClinicalDocument[]; allConsultations?: Consultation[]; onExamSaved?: () => void }) {
  const { format } = useContext(ProntuarioFormatCtx);
  const [markersByDoc, setMarkersByDoc] = useState<Record<string, LabMarker[]>>({});
  const [showExamForm, setShowExamForm] = useState(false);

  useEffect(() => {
    if (linkedDocuments.length === 0) { setMarkersByDoc({}); return; }
    db.fetchMarkersForDocuments(linkedDocuments.map(d => d.id)).then(setMarkersByDoc).catch(() => setMarkersByDoc({}));
  }, [linkedDocuments.map(d => d.id).join(',')]);

  if (format === 'escaneavel') {
    return <ScannableConsultationDetail consult={consult} onBack={onBack} />;
  }

  const s = consult.summary;
  const adultData = (s?.specialty_data as ConsultaAdultoData | null) ?? null;
  const isAdultConsult = !!(adultData && (adultData.vitals || adultData.active_problems || adultData.adult_intake));
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
            <div style={{ color: '#fff', fontSize: 11, marginTop: 4, opacity: 0.7 }}>{isAdultConsult ? 'Auri · Clínica Geral' : 'Auri · Pediatria'}</div>
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
            { l: 'Especialidade', v: isAdultConsult ? 'Clínica Geral' : 'Pediatria' },
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
              {(isAdultConsult
                ? [
                    { l: 'PA', v: adultData?.vitals?.pressao_arterial },
                    { l: 'FC', v: adultData?.vitals?.frequencia_cardiaca },
                    { l: 'SpO₂', v: adultData?.vitals?.saturacao },
                    { l: 'Temp', v: adultData?.vitals?.temperatura },
                    { l: 'Peso', v: adultData?.vitals?.peso },
                    { l: 'IMC', v: adultData?.vitals?.imc },
                  ]
                : [
                    { l: 'Peso', v: s.peso },
                    { l: 'Altura', v: s.altura },
                    ...(consult.physical_exam.includes('FR') ? [{ l: 'FR', v: consult.physical_exam.match(/FR\s+([\d]+)\s*irpm/)?.[1] ? `${consult.physical_exam.match(/FR\s+([\d]+)\s*irpm/)![1]} irpm` : '—' }] : []),
                    ...(consult.physical_exam.includes('FC') ? [{ l: 'FC', v: consult.physical_exam.match(/FC\s+([\d]+)\s*bpm/)?.[1] ? `${consult.physical_exam.match(/FC\s+([\d]+)\s*bpm/)![1]} bpm` : '—' }] : []),
                    ...(consult.physical_exam.includes('Temp') || consult.physical_exam.includes('T ') ? [{ l: 'Temp', v: consult.physical_exam.match(/T(?:emp)?\s+([\d,\.]+)°?C/)?.[1] ? `${consult.physical_exam.match(/T(?:emp)?\s+([\d,\.]+)°?C/)![1]}°C` : '—' }] : []),
                  ]
              ).filter(x => x.v && x.v !== '—').map(({ l, v }) => (
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

          {/* ── Exames — pedidos nesta consulta + resultados vinculados ── */}
          {((consult.requested_exams?.length ?? 0) > 0 || linkedDocuments.length > 0 || onExamSaved) && (
            <div>
              <SectionLabel abbrev="EX" full="Exames" right={onExamSaved ? (
                <button onClick={() => setShowExamForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: P, fontFamily: 'inherit', padding: 0 }}>
                  <Plus size={13} /> Adicionar resultado
                </button>
              ) : undefined} />
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, paddingLeft: 4 }}>
                {showExamForm && onExamSaved && (
                  <ExamUploadForm
                    patientId={consult.patient_id}
                    consultations={allConsultations}
                    documents={linkedDocuments}
                    defaultConsultId={consult.id}
                    lockConsult
                    onSaved={() => { setShowExamForm(false); onExamSaved(); }}
                  />
                )}
                {(consult.requested_exams ?? []).map((examName, i) => {
                  const fulfilled = linkedDocuments.length > 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14 }}>{examName}</span>
                      <Badge color={fulfilled ? SUC : WARN} bg={fulfilled ? SUCL : WARNL}>{fulfilled ? 'Resultado disponível' : 'Pendente'}</Badge>
                    </div>
                  );
                })}
                {linkedDocuments.map(doc => (
                  <ExamResultCard key={doc.id} document={doc} markers={markersByDoc[doc.id] ?? []} />
                ))}
                {(consult.requested_exams?.length ?? 0) === 0 && linkedDocuments.length === 0 && !showExamForm && (
                  <p style={{ margin: 0, fontSize: 13, color: MU }}>Nenhum exame pedido ou vinculado a esta consulta.</p>
                )}
              </div>
            </div>
          )}

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

          {/* ── Vacinas (Pediatria only) ── */}
          {!isAdultConsult && s.vacinas_mencionadas.length > 0 && (
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

          {/* ── Alertas Clínicos (Clínica Geral) ── */}
          {isAdultConsult && adultData?.clinical_insights && adultData.clinical_insights.length > 0 && (
            <div>
              <SectionLabel abbrev="AI" full="Alertas Clínicos — Gerado por IA" />
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, paddingLeft: 4 }}>
                {adultData.clinical_insights.map((insight, i) => {
                  const isPositive = insight.startsWith('✓') || insight.toLowerCase().includes('melhora') || insight.toLowerCase().includes('controla');
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 8, background: isPositive ? '#f0faf4' : '#fff8f0', border: `1px solid ${isPositive ? '#c3e6cb' : '#ffd6a5'}` }}>
                      <span style={{ fontSize: 16, flexShrink: 0, marginTop: -1 }}>{isPositive ? '✓' : '⚠'}</span>
                      <span style={{ fontSize: 13, lineHeight: 1.5, color: isPositive ? '#2d6a4f' : '#7d4e00' }}>{insight.replace(/^[✓⚠]\s*/, '')}</span>
                    </div>
                  );
                })}
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
  const adultDataS = (s?.specialty_data as ConsultaAdultoData | null) ?? null;
  const isAdultConsultS = !!(adultDataS && (adultDataS.vitals || adultDataS.active_problems || adultDataS.adult_intake));

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
            <div style={{ color: '#fff', fontSize: 11, marginTop: 4, opacity: 0.7 }}>{isAdultConsultS ? 'Auri · Clínica Geral · Formato Escaneável' : 'Auri · Pediatria · Formato Escaneável'}</div>
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
            { l: 'Especialidade', v: isAdultConsultS ? 'Clínica Geral' : 'Pediatria' },
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

// ─── PRIMEIRA CONSULTA — card + modal ────────────────────────────────────────

function PrimeiraConsultaModal({
  data, consultaDate, onClose,
}: {
  data: AnamnesePrimeiraConsultaData & { created_at: string };
  consultaDate: string;
  onClose: () => void;
}) {
  const bool = (v: boolean | null, sim = 'Sim', nao = 'Não') =>
    v === true ? sim : v === false ? nao : '—';

  function Row({ label, value }: { label: string; value: string }) {
    if (!value || value === '—') return null;
    return (
      <div style={{ padding: '10px 0', borderBottom: `1px solid ${BO}`, display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: MU }}>{label}</span>
        <span style={{ fontSize: 13, color: INK, lineHeight: 1.5 }}>{value}</span>
      </div>
    );
  }

  function Section({ title, icon: Icon, children }: { title: string; icon: IconComponent; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: `2px solid ${BO}`, marginBottom: 4 }}>
          <span style={{ width: 26, height: 26, borderRadius: 6, background: PL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={13} color={P} />
          </span>
          <span style={{ fontWeight: 700, fontSize: 13, color: P, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{title}</span>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 660, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ width: 28, height: 28, borderRadius: 6, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Star size={14} color="#1D4ED8" weight="fill" />
              </span>
              <span style={{ fontWeight: 700, fontSize: 16, color: INK }}>Anamnese — Primeira Consulta</span>
            </div>
            <span style={{ fontSize: 12, color: MU }}>{fmtDate(consultaDate)}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6 }}>
            <X size={20} color={MU} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>

          <Section title="História atual" icon={Heartbeat}>
            <Row label="Motivo da consulta" value={data.motivo_consulta} />
            <Row label="Queixa / duração" value={data.queixa_principal_duracao} />
            <Row label="Sintomas associados" value={data.sintomas_associados} />
          </Section>

          <Section title="História pregressa" icon={FileText}>
            <Row label="Internações" value={bool(data.internacoes)} />
            {data.internacoes === true && <Row label="Descrição" value={data.internacoes_desc} />}
            <Row label="Cirurgias" value={bool(data.cirurgias)} />
            {data.cirurgias === true && <Row label="Descrição" value={data.cirurgias_desc} />}
            <Row label="Alergias — medicamentos" value={data.alergias_medicamentos} />
            <Row label="Alergias — alimentos" value={data.alergias_alimentos} />
            <Row label="Outras alergias" value={data.alergias_outras} />
            <Row label="Histórico vacinal prévio" value={data.historico_vacinal} />
          </Section>

          <Section title="História gestacional" icon={Baby}>
            <Row label="Gestações (G_P_A)" value={data.gestacoes_gpa} />
            <Row label="Idade gestacional" value={data.idade_gestacional_semanas ? `${data.idade_gestacional_semanas} semanas` : ''} />
            <Row label="Tipo de parto" value={data.tipo_parto} />
            <Row label="Local do parto" value={data.local_parto} />
            <Row label="Intercorrências" value={bool(data.intercorrencias_gestacao)} />
            {data.intercorrencias_gestacao === true && <Row label="Descrição" value={data.intercorrencias_gestacao_desc} />}
            <Row label="Apgar 1º / 5º min" value={[data.apgar_1, data.apgar_5].filter(Boolean).join(' / ')} />
          </Section>

          <Section title="Triagens neonatais" icon={Syringe}>
            <Row label="Teste do pezinho" value={data.teste_pezinho} />
            <Row label="Teste da orelhinha" value={data.teste_orelhinha} />
            <Row label="Teste do olhinho" value={data.teste_olhinho} />
            <Row label="Teste do coraçãozinho" value={data.teste_coracaozinho} />
          </Section>

          <Section title="História familiar" icon={Users}>
            <Row label="Doenças crônicas" value={data.doencas_familia} />
            <Row label="Alergias na família" value={bool(data.alergia_familia)} />
            {data.alergia_familia === true && <Row label="Descrição" value={data.alergia_familia_desc} />}
            <Row label="Outras condições" value={data.outras_condicoes_familia} />
          </Section>

          <Section title="História socioeconômica" icon={House}>
            <Row label="Profissão dos responsáveis" value={data.profissao_responsaveis} />
            <Row label="Renda familiar" value={data.renda_familiar} />
            <Row label="Tabagismo passivo" value={bool(data.tabagismo_passivo)} />
            <Row label="Animal doméstico" value={data.animal_domestico === true ? `Sim — ${data.animal_domestico_qual || 'não especificado'}` : bool(data.animal_domestico)} />
            <Row label="Água e saneamento" value={bool(data.agua_saneamento, 'Com acesso', 'Sem acesso')} />
          </Section>

        </div>
      </div>
    </div>
  );
}

function PrimeiraConsultaCard({ patientId, refetchTrigger = 0 }: { patientId: string; refetchTrigger?: number }) {
  type AnamWithMeta = AnamnesePrimeiraConsultaData & { consulta_id: string; created_at: string };
  const [anam, setAnam] = useState<AnamWithMeta | null | 'loading'>('loading');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    db.fetchAnamnesePrimeiraConsultaByPatient(patientId)
      .then(d => setAnam(d ?? null))
      .catch(() => setAnam(null));
  }, [patientId, refetchTrigger]);

  if (anam === 'loading') return null;

  // ── No record ─────────────────────────────────────────────────────────────
  if (anam === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: BG, border: `1px solid ${BO}`, borderRadius: 10, marginBottom: 16, fontSize: 13, color: MU }}>
        <Info size={15} color={MU} />
        Nenhuma primeira consulta registrada ainda.
      </div>
    );
  }

  // ── Summary helpers ────────────────────────────────────────────────────────
  const allergies = [anam.alergias_medicamentos, anam.alergias_alimentos, anam.alergias_outras].filter(Boolean);

  // Triagem status: all filled / partial / none
  const triagemFields = [anam.teste_pezinho, anam.teste_orelhinha, anam.teste_olhinho, anam.teste_coracaozinho];
  const triagemDone  = triagemFields.filter(v => v && v !== 'não realizado').length;
  const triagemTotal = 4;
  const triagemPending = triagemFields.filter(v => v === 'não realizado' || v === 'falhou' || v === 'aguardando resultado').length;

  const gestInfo = [
    anam.tipo_parto && `Parto ${anam.tipo_parto}`,
    anam.idade_gestacional_semanas && `${anam.idade_gestacional_semanas} sem.`,
    anam.gestacoes_gpa && anam.gestacoes_gpa,
  ].filter(Boolean).join(' · ');

  return (
    <>
      {modalOpen && <PrimeiraConsultaModal data={anam} consultaDate={anam.created_at.slice(0, 10)} onClose={() => setModalOpen(false)} />}

      <div style={{ border: `1.5px solid #BFDBFE`, borderRadius: 12, background: '#F8FBFF', marginBottom: 20, overflow: 'hidden' }}>
        {/* Header strip */}
        <div style={{ padding: '12px 18px', background: '#EFF6FF', borderBottom: `1px solid #BFDBFE`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 6, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Star size={13} color="#1D4ED8" weight="fill" />
          </span>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#1D4ED8' }}>Primeira Consulta</span>
          <span style={{ fontSize: 12, color: MU, marginLeft: 4 }}>— {fmtDate(anam.created_at.slice(0, 10))}</span>
          <button onClick={() => setModalOpen(true)} style={{
            marginLeft: 'auto', background: 'none', border: `1px solid #BFDBFE`, borderRadius: 6,
            padding: '4px 12px', fontSize: 12, color: '#1D4ED8', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
          }}>Ver anamnese completa</button>
        </div>

        {/* Content grid */}
        <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>

          {/* Gestacional */}
          {gestInfo && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 5 }}>Gestação &amp; parto</div>
              <div style={{ fontSize: 13, color: INK }}>{gestInfo}</div>
              {anam.intercorrencias_gestacao === true && (
                <div style={{ marginTop: 3, fontSize: 12, color: WARN }}>⚠ Intercorrência gestacional</div>
              )}
            </div>
          )}

          {/* Triagens */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 5 }}>Triagens neonatais</div>
            {triagemFields.every(v => !v) ? (
              <div style={{ fontSize: 12, color: MU }}>Não informado</div>
            ) : triagemPending > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: WARN }}>
                <Warning size={13} color={WARN} />
                {triagemPending} pendência{triagemPending > 1 ? 's' : ''}
                <span style={{ color: MU, fontSize: 12 }}>({triagemDone}/{triagemTotal} realizadas)</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: SUC }}>
                <CheckCircle size={13} color={SUC} weight="fill" />
                Todas realizadas
              </div>
            )}
          </div>

          {/* Alergias */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 5 }}>Alergias conhecidas</div>
            {allergies.length === 0 ? (
              <div style={{ fontSize: 12, color: MU }}>Nenhuma registrada</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                {allergies.map(a => (
                  <span key={a} style={{ fontSize: 11, fontWeight: 600, background: DESL, color: DES, padding: '2px 8px', borderRadius: 99, border: `1px solid ${DES}30` }}>{a}</span>
                ))}
              </div>
            )}
          </div>

          {/* Familiar */}
          {(anam.doencas_familia || anam.alergia_familia_desc) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 5 }}>Histórico familiar</div>
              <div style={{ fontSize: 13, color: INK, lineHeight: 1.5 }}>
                {(anam.doencas_familia || anam.alergia_familia_desc || '').slice(0, 80)}
                {(anam.doencas_familia || '').length > 80 ? '…' : ''}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

// ─── CLÍNICA GERAL — COMPONENTES ─────────────────────────────────────────────

const inputStyle2 = { width: '100%', padding: '9px 12px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: '#fff', color: INK };

function AnamneseAdultaModal({ onClose, onSaved, existingData, consultaId }: {
  onClose: () => void;
  onSaved: (data: AnamneseAdultaData) => void;
  existingData: AnamneseAdultaData | null;
  consultaId: string | null;
}) {
  const [form, setForm] = useState<AnamneseAdultaData>(existingData ?? defaultAnamneseAdulta());
  const [saving, setSaving] = useState(false);
  const set = (k: keyof AnamneseAdultaData, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    setSaving(true);
    try {
      if (consultaId) await db.saveAnamneseAdulta(consultaId, form);
      onSaved(form);
      onClose();
    } catch { toast.error('Erro ao salvar anamnese.'); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <Card style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Anamnese — 1ª consulta</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU }}><X size={18} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <AnamneseAdultaFields form={form} set={set} />
        </div>
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${BO}`, display: 'flex', gap: 12 }}>
          <Btn variant="secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancelar</Btn>
          <Btn onClick={handleSave} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
            {saving ? 'Salvando…' : <><FloppyDisk size={15} /> Salvar anamnese</>}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

function MedicacoesAdultaTab({ medications, canEdit, onAdd, onSetStatus }: {
  medications: Medication[];
  canEdit: boolean;
  onAdd: (name: string, dosage: string, frequency: string) => void;
  onSetStatus: (idx: number, status: Medication['status']) => void;
}) {
  const statusLabel: Record<string, string> = { active: 'Ativo', paused: 'Suspenso', discontinued: 'Descontinuado' };
  const statusColors: Record<string, { bg: string; color: string }> = {
    active: { bg: SUCL, color: SUC },
    paused: { bg: WARNL, color: WARN },
    discontinued: { bg: SEC, color: MU },
  };
  const [draft, setDraft] = useState({ name: '', dosage: '', frequency: '' });

  function handleAdd() {
    if (!draft.name.trim()) return;
    onAdd(draft.name, draft.dosage, draft.frequency);
    setDraft({ name: '', dosage: '', frequency: '' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {medications.length === 0 ? (
        <Card>
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <Heartbeat size={28} color={MU} />
            <p style={{ margin: '10px 0 0', fontSize: 13, color: MU }}>Nenhuma medicação registrada para este paciente.</p>
          </div>
        </Card>
      ) : medications.map((med, i) => {
        const s = med.status ?? 'active';
        const sc = statusColors[s] ?? statusColors.active;
        return (
          <Card key={i}>
            <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: INK }}>{med.name}</div>
                {med.dosage && <div style={{ fontSize: 13, color: MU, marginTop: 2 }}>{med.dosage}{med.frequency ? ` · ${med.frequency}` : ''}</div>}
                {med.indication && <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>Indicação: {med.indication}</div>}
                {med.start_date && <div style={{ fontSize: 11, color: MU, marginTop: 2 }}>Início: {fmtDate(med.start_date)}</div>}
              </div>
              {canEdit ? (
                <select value={s} onChange={e => onSetStatus(i, e.target.value as Medication['status'])}
                  style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: sc.bg, color: sc.color, border: 'none', flexShrink: 0, cursor: 'pointer' }}>
                  <option value="active">Ativo</option>
                  <option value="paused">Suspenso</option>
                  <option value="discontinued">Descontinuado</option>
                </select>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 5, background: sc.bg, color: sc.color, flexShrink: 0 }}>
                  {statusLabel[s] ?? s}
                </span>
              )}
            </div>
          </Card>
        );
      })}
      {canEdit && (
        <Card>
          <div style={{ padding: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Medicamento"
              style={{ flex: 2, minWidth: 140, padding: '8px 10px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            <input value={draft.dosage} onChange={e => setDraft(d => ({ ...d, dosage: e.target.value }))} placeholder="Dose"
              style={{ flex: 1, minWidth: 80, padding: '8px 10px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            <input value={draft.frequency} onChange={e => setDraft(d => ({ ...d, frequency: e.target.value }))} placeholder="Frequência"
              style={{ flex: 1, minWidth: 100, padding: '8px 10px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            <Btn onClick={handleAdd}><Plus size={14} /> Adicionar</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

// Categorização client-side de marcadores de exame por palavra-chave (case/acento-insensível).
// Não depende de dados da IA — funciona inclusive para documentos já salvos antes desta mudança.
const MARKER_CATEGORIES: { category: string; keywords: string[] }[] = [
  { category: 'Hemograma', keywords: ['hemoglobina', 'hematocrito', 'eritrocito', 'leucocito', 'neutrofilo', 'eosinofilo', 'basofilo', 'linfocito', 'monocito', 'plaqueta', 'vcm', 'hcm', 'chcm', 'rdw', 'vpm', 'bastonete', 'segmentado'] },
  { category: 'Glicemia', keywords: ['glicose', 'hba1c', 'glicada', 'insulina', 'homa'] },
  { category: 'Lipidograma', keywords: ['colesterol', 'ldl', 'hdl', 'triglicer', 'apolipoproteina', 'vldl'] },
  { category: 'Função Renal', keywords: ['ureia', 'creatinina', 'egfr', 'filtracao glomerular'] },
  { category: 'Função Hepática', keywords: ['tgo', 'tgp', 'transaminase', 'gama-glutamil', 'gama glutamil', 'fosfatase alcalina', 'albumina', 'bilirrubina'] },
  { category: 'Eletrólitos e Minerais', keywords: ['potassio', 'sodio', 'cloro', 'magnesio', 'calcio', 'zinco', 'cobre', 'ferro', 'ferritina', 'transferrina', 'saturacao da transferrina', 'fixacao'] },
  { category: 'Vitaminas', keywords: ['vitamina', 'acido folico', 'folico', 'b-12', 'b12'] },
  { category: 'Hormônios Tireoidianos', keywords: ['tsh', 'tireoestimulante', 't3', 't4', 'tiroxina', 'triiodotironina'] },
  { category: 'Hormônios Sexuais e Adrenais', keywords: ['testosterona', 'estradiol', 'progesterona', 'fsh', 'foliculo estimulante', 'lh', 'luteinizante', 'prolactina', 'shbg', 'dehidroepiandrosterona', 'dheа', 'dht', 'dihidrotestosterona', 'cortisol'] },
  { category: 'Marcadores Inflamatórios e Outros', keywords: ['proteina c reativa', 'pcr', 'homocisteina', 'acido urico', 'psa', 'prostatico'] },
];

function categorizeMarker(name: string): string {
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // remove acentos
  for (const { category, keywords } of MARKER_CATEGORIES) {
    if (keywords.some(k => normalized.includes(k))) return category;
  }
  return 'Outros';
}

// Card de um laudo (documento + marcadores) — usado dentro da consulta que o pediu
// e também na aba Exames (histórico geral).
function ExamResultCard({ document: doc, markers }: { document: ClinicalDocument; markers: LabMarker[] }) {
  const statusColor = (s: string) => s === 'alto' ? WARN : s === 'critico' ? DES : s === 'baixo' ? '#3B82F6' : SUC;
  const statusBg = (s: string) => s === 'alto' ? WARNL : s === 'critico' ? DESL : s === 'baixo' ? '#EFF6FF' : SUCL;
  const altered = markers.filter(m => m.status !== 'normal');

  const grouped = markers.reduce<Record<string, LabMarker[]>>((acc, m) => {
    const cat = categorizeMarker(m.marker_name);
    (acc[cat] ??= []).push(m);
    return acc;
  }, {});

  return (
    <Card style={{ borderColor: altered.length > 0 ? WARN : BO }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>
            {doc.document_type.charAt(0).toUpperCase() + doc.document_type.slice(1)}
            {doc.lab_name ? ` — ${doc.lab_name}` : ''}
          </span>
          <span style={{ fontSize: 11, color: MU, marginLeft: 8 }}>{fmtDate(doc.result_date)}</span>
        </div>
        {markers.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: altered.length > 0 ? WARNL : SUCL, color: altered.length > 0 ? WARN : SUC }}>
            {altered.length > 0 ? `${altered.length} de ${markers.length} fora da faixa` : `${markers.length} normais`}
          </span>
        )}
      </div>
      <div style={{ padding: '12px 16px' }}>
        {doc.ai_summary && (
          <p style={{ margin: '0 0 10px', fontSize: 13, color: INK, lineHeight: 1.5 }}>{doc.ai_summary}</p>
        )}
        {Object.entries(grouped).map(([category, ms]) => (
          <div key={category} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 4 }}>{category}</div>
            {ms.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${BO}`, gap: 10 }}>
                <span style={{ fontSize: 13, color: INK }}>{m.marker_name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: statusColor(m.status), background: statusBg(m.status), padding: '2px 8px', borderRadius: 4 }}>
                  {m.value} {m.unit}
                </span>
              </div>
            ))}
          </div>
        ))}
        {doc.file_url && (
          <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: P, textDecoration: 'none' }}>Ver arquivo original</a>
        )}
      </div>
    </Card>
  );
}

// Tendência cross-consulta de marcadores laboratoriais — seção secundária da aba Evolução,
// complementar à visão por consulta (que mostra o exame no contexto de quando foi pedido).
function MarcadoresTrendCard({ latestMarkers }: { latestMarkers: Record<string, LabMarker> }) {
  const [expanded, setExpanded] = useState(false);
  const [onlyAltered, setOnlyAltered] = useState(false);

  const markerEntries = Object.entries(latestMarkers);
  if (markerEntries.length === 0) return null;

  const statusColor = (s: string) => s === 'alto' ? WARN : s === 'critico' ? DES : s === 'baixo' ? '#3B82F6' : SUC;
  const statusBg = (s: string) => s === 'alto' ? WARNL : s === 'critico' ? DESL : s === 'baixo' ? '#EFF6FF' : SUCL;
  const alteredEntries = markerEntries.filter(([, m]) => m.status !== 'normal');
  const visibleEntries = onlyAltered ? alteredEntries : markerEntries;
  const grouped = visibleEntries.reduce<Record<string, [string, LabMarker][]>>((acc, entry) => {
    const cat = categorizeMarker(entry[0]);
    (acc[cat] ??= []).push(entry);
    return acc;
  }, {});
  Object.values(grouped).forEach(entries => entries.sort((a, b) => {
    const aAlt = a[1].status !== 'normal' ? 0 : 1;
    const bAlt = b[1].status !== 'normal' ? 0 : 1;
    return aAlt !== bAlt ? aAlt - bAlt : a[0].localeCompare(b[0]);
  }));
  const categoryOrder = Object.keys(grouped).sort((a, b) => {
    const aAlt = grouped[a].filter(([, m]) => m.status !== 'normal').length;
    const bAlt = grouped[b].filter(([, m]) => m.status !== 'normal').length;
    return aAlt !== bAlt ? bAlt - aAlt : a.localeCompare(b);
  });

  return (
    <Card>
      <button onClick={() => setExpanded(v => !v)} style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>Ver tendência de marcadores ({markerEntries.length})</span>
        {expanded ? <CaretUp size={15} color={MU} /> : <CaretDown size={15} color={MU} />}
      </button>
      {expanded && (
        <div style={{ borderTop: `1px solid ${BO}` }}>
          <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: MU, cursor: 'pointer', userSelect: 'none' as const }}>
              <input type="checkbox" checked={onlyAltered} onChange={e => setOnlyAltered(e.target.checked)} />
              Somente alterados
            </label>
          </div>
          <div style={{ padding: '0 20px 14px' }}>
            {categoryOrder.map(category => (
              <div key={category} style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 6 }}>
                  {category}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {grouped[category].map(([name, marker]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${BO}`, gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: INK, fontWeight: 500 }}>{name}</div>
                        {marker.reference_text && (
                          <div style={{ fontSize: 11, color: MU, marginTop: 1 }}>Ref.: {marker.reference_text}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <div style={{ fontSize: 11, color: MU }}>{fmtDate(marker.result_date)}</div>
                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: statusColor(marker.status) }}>
                          {marker.value} {marker.unit}
                        </span>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: statusBg(marker.status), color: statusColor(marker.status), fontWeight: 600 }}>
                          {marker.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {onlyAltered && alteredEntries.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: MU }}>Nenhum marcador fora da faixa.</div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// Comparação real (2 últimos valores registrados) por marcador — complementa o
// MarcadoresTrendCard, que só mostra o valor mais recente.
function MarkerComparisonsCard({ comparisons }: { comparisons: db.MarkerComparison[] }) {
  if (comparisons.length === 0) return null;
  const trendColor = (t: db.MarkerComparison['trend']) => t === 'melhora' ? SUC : t === 'piora' ? DES : MU;
  const trendLabel = (t: db.MarkerComparison['trend']) => t === 'melhora' ? 'Melhora' : t === 'piora' ? 'Piora' : 'Estável';
  return (
    <Card>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}` }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>Exames comparativos ({comparisons.length})</span>
        <span style={{ fontSize: 11, color: MU, marginLeft: 8 }}>Últimos 2 resultados registrados por marcador</span>
      </div>
      <div style={{ padding: '10px 20px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {comparisons.map(c => (
          <div key={c.marker_name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${BO}` }}>
            <span style={{ fontSize: 13, color: INK, fontWeight: 500, flex: 1 }}>{c.marker_name}</span>
            <span style={{ fontSize: 12, color: MU, fontFamily: '"JetBrains Mono", monospace' }}>
              {c.previous.value}{c.previous.unit} → {c.current.value}{c.current.unit}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, color: trendColor(c.trend), background: trendColor(c.trend) + '1A' }}>
              {trendLabel(c.trend)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Formulário de upload/entrada manual de resultado de exame — usado no topo da aba Evolução
// (sempre visível, com sugestão de vínculo) e dentro de ConsultationDetail (vínculo pré-travado na consulta aberta).
function ExamUploadForm({ patientId, consultations, documents, defaultConsultId, lockConsult = false, onSaved }: {
  patientId: string;
  consultations: Consultation[];
  documents: ClinicalDocument[];
  defaultConsultId?: string;
  lockConsult?: boolean;
  onSaved: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [manualLab, setManualLab] = useState('');
  const [manualText, setManualText] = useState('');
  // Sugestão default: consulta mais recente com exames pedidos e ainda sem nenhum documento vinculado
  const suggestedConsultId = defaultConsultId ?? (consultations.find(c =>
    (c.requested_exams?.length ?? 0) > 0 && !documents.some(d => d.consultation_id === c.id)
  )?.id ?? '');
  const [linkConsultId, setLinkConsultId] = useState(suggestedConsultId);
  const [savingManual, setSavingManual] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(file: File) {
    if (!file) return;
    setUploading(true);
    setUploadStep('Enviando arquivo…');
    const sourceType = file.type.startsWith('image/') ? 'upload_image' : 'upload_pdf';
    try {
      const fileUrl = await db.uploadClinicalDocumentFile(patientId, file);

      let lab_name: string | null = null;
      let result_date: string | null = null;
      let summary: string | null = null;
      let markers: Omit<LabMarker, 'id' | 'clinical_document_id' | 'patient_id' | 'created_at'>[] = [];
      let extractionFailed = false;

      try {
        setUploadStep('Extraindo texto…');
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setUploadStep('Analisando marcadores…');
        const extracted = await ai.extractExamData(base64, file.type);
        lab_name = extracted.lab_name;
        result_date = extracted.result_date;
        summary = extracted.summary || null;
        markers = extracted.markers;
      } catch (e) {
        console.error('[handleFileUpload] extração via IA falhou:', e);
        extractionFailed = true;
      }

      const saved = await db.saveLabResult(
        patientId,
        'laboratorio',
        result_date ?? new Date().toISOString().slice(0, 10),
        lab_name,
        sourceType,
        fileUrl,
        null,
        summary,
        markers,
        linkConsultId || null
      );

      if (!saved) {
        toast.error('Erro ao salvar o exame. Verifique se as tabelas foram criadas no Supabase.');
      } else if (extractionFailed) {
        toast.success('Arquivo salvo, mas a extração automática falhou — revise manualmente.');
      } else {
        toast.success('Exame processado — marcadores extraídos automaticamente.');
      }
      onSaved();
    } catch {
      toast.error('Erro ao processar arquivo.');
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  }

  async function saveManual() {
    if (!manualDate || !manualText.trim()) return;
    setSavingManual(true);
    try {
      await db.saveLabResult(patientId, 'laboratorio', manualDate, manualLab || null, 'manual', null, manualText, null, [], linkConsultId || null);
      toast.success('Resultado salvo.');
      setManualOpen(false);
      setManualDate(''); setManualLab(''); setManualText('');
      onSaved();
    } catch {
      toast.error('Erro ao salvar. Verifique se as tabelas foram criadas no Supabase.');
    } finally { setSavingManual(false); }
  }

  const SH = ({ title, right }: { title: string; right?: React.ReactNode }) => (
    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 15, fontWeight: 600, fontFamily: '"Fraunces", Georgia, serif' }}>{title}</span>
      {right}
    </div>
  );

  return (
    <Card>
      <SH title="Adicionar resultado" />
      <div style={{ padding: '20px' }}>
        {uploading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 13, color: P, fontWeight: 500 }}>{uploadStep}</div>
            <div style={{ marginTop: 10, height: 4, background: BO, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: P, width: '60%', borderRadius: 2 }} />
            </div>
          </div>
        ) : (
          <>
            {!lockConsult && consultations.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Vincular à consulta</label>
                <select value={linkConsultId} onChange={e => setLinkConsultId(e.target.value)} style={inputStyle2}>
                  <option value="">Sem vínculo (histórico geral)</option>
                  {consultations.map(c => (
                    <option key={c.id} value={c.id}>
                      {fmtDate(c.scheduled_at.split('T')[0])}{(c.requested_exams?.length ?? 0) > 0 ? ' — exames pendentes' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
              <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
              <Btn variant="secondary" onClick={() => fileRef.current?.click()} style={{ gap: 6 }}>
                <FileText size={15} /> PDF
              </Btn>
              <Btn variant="secondary" onClick={() => fileRef.current?.click()} style={{ gap: 6 }}>
                <Brain size={15} /> Imagem
              </Btn>
              <Btn variant="secondary" onClick={() => setManualOpen(v => !v)} style={{ gap: 6 }}>
                <PencilSimple size={15} /> Manual
              </Btn>
            </div>
          </>
        )}
        {manualOpen && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Data do resultado *</label>
                <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} style={inputStyle2} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Laboratório</label>
                <input value={manualLab} onChange={e => setManualLab(e.target.value)} placeholder="Ex: Fleury, DASA" style={inputStyle2} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Resultados (texto livre) *</label>
              <textarea value={manualText} onChange={e => setManualText(e.target.value)} placeholder="Cole aqui os resultados dos exames…" rows={4} style={{ ...inputStyle2, resize: 'vertical' as const }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={saveManual} disabled={!manualDate || !manualText.trim() || savingManual} style={{ flex: 1, justifyContent: 'center' }}>
                {savingManual ? 'Salvando…' : <><FloppyDisk size={14} /> Salvar</>}
              </Btn>
              <Btn variant="secondary" onClick={() => setManualOpen(false)} style={{ flexShrink: 0 }}><X size={14} /></Btn>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── PATIENT DETAIL ───────────────────────────────────────────────────────────
function PatientDetailPage({ patient, go, onStartConsult, onOpenDraft, refetchTrigger = 0, specialty = 'Pediatria', pendingTab, onConsumePendingTab }: { patient: Patient; go: (s: string) => void; onStartConsult: (type: 'retorno' | 'primeira vez') => void; onOpenDraft: (draft: Consultation) => void; refetchTrigger?: number; specialty?: string; pendingTab?: string | null; onConsumePendingTab?: () => void }) {
  const [tab, setTab] = useState(pendingTab || 'Resumo');

  // Consome a aba pré-definida vinda do Dashboard (ex.: "Importar exames")
  useEffect(() => {
    if (pendingTab) {
      setTab(pendingTab);
      onConsumePendingTab?.();
    }
  }, [pendingTab]);
  const [selectedConsult, setSelectedConsult] = useState<Consultation | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loadingC, setLoadingC] = useState(true);
  const [pendingVaccinesCount, setPendingVaccinesCount] = useState(0);
  const [growthRecords, setGrowthRecords] = useState<any[]>([]);
  const [anamneseAdulta, setAnamneseAdulta] = useState<(AnamneseAdultaData & { consulta_id: string; created_at: string }) | null>(null);
  const [clinicalDocs, setClinicalDocs] = useState<ClinicalDocument[]>([]);
  const [latestMarkers, setLatestMarkers] = useState<Record<string, LabMarker>>({});
  const [markerComparisons, setMarkerComparisons] = useState<db.MarkerComparison[]>([]);
  const [lastRequestedExams, setLastRequestedExams] = useState<db.LastRequestedExamsInfo | null>(null);
  // Condições Ativas + Anamnese — geridas direto no Resumo (aba Saúde foi extinta)
  const [showAnamneseModal, setShowAnamneseModal] = useState(false);
  const [problems, setProblems] = useState<ProblemaAtivo[]>([]);
  const [showAddProblem, setShowAddProblem] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [showAddAllergy, setShowAddAllergy] = useState(false);
  const [newAllergyName, setNewAllergyName] = useState('');
  const [newAllergyReaction, setNewAllergyReaction] = useState('');
  const [newProblemName, setNewProblemName] = useState('');
  const guardian = primaryGuardian(patient);
  const isMobile = useIsMobile();
  const isDoctor = useRequireRole(['medico']);
  const { doctorId } = useAuthProfile();
  const isPediatria = specialty === 'Pediatria';
  const TABS_PEDIATRIA     = ['Resumo', 'Consultas', 'Crescimento', 'Vacinas', 'Desenvolvimento'];
  const TABS_CLINICA_GERAL = ['Resumo', 'Evolução', 'Vacinas', 'Medicações'];
  const visibleTabs = isDoctor
    ? (isPediatria ? TABS_PEDIATRIA : TABS_CLINICA_GERAL)
    : (isPediatria ? ['Resumo', 'Vacinas'] : ['Resumo']);

  useEffect(() => {
    setLoadingC(true);
    db.fetchConsultations(patient.id)
      .then(setConsultations)
      .catch(() => { toast.error('Erro ao carregar consultas do paciente'); })
      .finally(() => setLoadingC(false));
  }, [patient.id, refetchTrigger]);

  useEffect(() => {
    if (!isPediatria) return;
    db.fetchGrowthRecords(patient.id)
      .then(setGrowthRecords)
      .catch(() => setGrowthRecords([]));
  }, [patient.id, refetchTrigger, isPediatria]);

  useEffect(() => {
    if (!isPediatria) return;
    const bd = new Date(patient.birth_date);
    const now = new Date();
    const ageMonths = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
    db.fetchVaccines(patient.id)
      .then(dbVs => {
        const count = PNI_SCHEDULE.filter(pni => {
          const done = dbVs.find((v) => v.name === pni.name && v.dose === pni.dose && v.status === 'done');
          return !done;
        }).length;
        setPendingVaccinesCount(count);
      })
      .catch(() => setPendingVaccinesCount(0));
  }, [patient.id, refetchTrigger, isPediatria]);

  // Clínica Geral: carrega anamnese adulta + documentos clínicos
  useEffect(() => {
    if (isPediatria) return;
    db.fetchAnamneseAdulta(patient.id).then(setAnamneseAdulta).catch(() => null);
    db.fetchClinicalDocuments(patient.id).then(setClinicalDocs).catch(() => setClinicalDocs([]));
    db.fetchLatestMarkers(patient.id).then(setLatestMarkers).catch(() => setLatestMarkers({}));
    db.fetchLastRequestedExams(patient.id).then(setLastRequestedExams).catch(() => setLastRequestedExams(null));
    db.getMarkerComparisons(patient.id).then(setMarkerComparisons).catch(() => setMarkerComparisons([]));
  }, [patient.id, refetchTrigger, isPediatria]);

  // Drafts: awaiting doctor confirmation
  const draftConsultations = consultations.filter(c => c.status === 'draft');
  // consultations agora é tabela exclusiva de prontuários clínicos — todos os completed são reais
  const pastConsultations = consultations.filter(c => c.status === 'completed');

  // Última medida: growth_records primeiro; fallback para sum_peso/sum_altura do prontuário mais recente
  const lastMeasurement = (() => {
    if (growthRecords.length > 0) return growthRecords[growthRecords.length - 1];
    const parseM = (val: string) => { const m = val?.match(/[\d]+[.,]?[\d]*/); return m ? parseFloat(m[0].replace(',', '.')) : undefined; };
    for (const c of pastConsultations) {
      const weight = parseM(c.summary?.peso || '');
      const height = parseM(c.summary?.altura || '');
      const hc     = parseM(c.summary?.perimetro_cefalico || '');
      if (weight || height || hc) {
        const bd = new Date(patient.birth_date), cd = new Date(c.scheduled_at);
        const month = Math.max(0, (cd.getFullYear() - bd.getFullYear()) * 12 + (cd.getMonth() - bd.getMonth()));
        return { month, weight, height, hc, date: c.scheduled_at.slice(0, 10) };
      }
    }
    return null;
  })();
  const pend = pendingVaccinesCount;

  // Clínica Geral: extrai condições ativas da última consulta
  const lastConsultAdultData = !isPediatria && pastConsultations[0]
    ? (pastConsultations[0].summary?.specialty_data as ConsultaAdultoData | null)
    : null;
  const activeProblems = lastConsultAdultData?.active_problems?.filter(p => p.status === 'ativo') ?? [];
  const currentMedications = lastConsultAdultData?.current_medications ?? [];
  const currentAllergies = lastConsultAdultData?.allergies ?? [];

  const lastConsult = pastConsultations[0];

  useEffect(() => { setProblems(activeProblems); }, [activeProblems.map(p => `${p.name}:${p.status}`).join(',')]);
  useEffect(() => { setMedications(currentMedications); }, [currentMedications.map(m => `${m.name}:${m.status}`).join(',')]);
  useEffect(() => { setAllergies(currentAllergies); }, [currentAllergies.map(a => a.allergen).join(',')]);

  function addProblem() {
    if (!newProblemName.trim()) return;
    const updated: ProblemaAtivo[] = [...problems, { name: newProblemName.trim(), status: 'ativo', updated_at: new Date().toISOString() }];
    setProblems(updated);
    if (lastConsult?.id) db.updatePatientProblems(lastConsult.id, updated);
    setNewProblemName('');
    setShowAddProblem(false);
    toast.success('Condição adicionada.');
  }

  function toggleProblemStatus(idx: number) {
    const next = [...problems];
    next[idx] = { ...next[idx], status: next[idx].status === 'ativo' ? 'controlado' : next[idx].status === 'controlado' ? 'resolvido' : 'ativo', updated_at: new Date().toISOString() };
    setProblems(next);
    if (lastConsult?.id) db.updatePatientProblems(lastConsult.id, next);
  }

  function addMedication(name: string, dosage: string, frequency: string) {
    if (!name.trim() || !lastConsult?.id) return;
    const updated: Medication[] = [...medications, { name: name.trim(), dosage: dosage.trim() || undefined, frequency: frequency.trim() || undefined, status: 'active' }];
    setMedications(updated);
    db.updatePatientMedications(lastConsult.id, updated);
    toast.success('Medicação adicionada.');
  }

  function setMedicationStatus(idx: number, status: Medication['status']) {
    if (!lastConsult?.id) return;
    const next = medications.map((m, i) => i === idx ? { ...m, status } : m);
    setMedications(next);
    db.updatePatientMedications(lastConsult.id, next);
  }

  function addAllergy(allergen: string, reaction: string) {
    if (!allergen.trim() || !lastConsult?.id) return;
    const updated: Allergy[] = [...allergies, { allergen: allergen.trim(), reaction: reaction.trim() || undefined }];
    setAllergies(updated);
    db.updatePatientAllergies(lastConsult.id, updated);
    toast.success('Alergia adicionada.');
  }

  function removeAllergy(idx: number) {
    if (!lastConsult?.id) return;
    const next = allergies.filter((_, i) => i !== idx);
    setAllergies(next);
    db.updatePatientAllergies(lastConsult.id, next);
  }

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
                  ...(isPediatria || guardian
                    ? [{ l: isPediatria ? 'Responsável' : 'Contato', v: guardian?.name || '—' }, { l: 'Telefone', v: guardian?.phone || '—' }]
                    : []),
                ] : [
                  ...(guardian ? [{ l: isPediatria ? 'Responsável' : 'Contato', v: guardian.name }] : []),
                ]),
              ].map(({ l, v }) => (
                <div key={l}>
                  <div style={{ fontSize: 10, color: MU, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{l}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 1 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          {!isMobile && (
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <Btn variant="secondary" onClick={() => window.print()}><DownloadSimple size={15} /> Imprimir</Btn>
              <Btn variant="secondary"><User size={15} /> Compartilhar</Btn>
              <Btn onClick={() => onStartConsult(db.deriveConsultType(consultations))}><Stethoscope size={15} /> Iniciar consulta</Btn>
            </div>
          )}
        </div>
        {isMobile && (
          <Btn onClick={() => onStartConsult(db.deriveConsultType(consultations))} style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
            <Stethoscope size={15} /> Iniciar consulta
          </Btn>
        )}
        <div style={{ display: 'flex', gap: isMobile ? 8 : 16, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BO}`, flexWrap: 'wrap' as const }}>
          {(isPediatria
            ? [
                { l: 'Consultas', v: loadingC ? '…' : pastConsultations.length },
                { l: 'Última', v: lastConsult ? fmtDate(lastConsult.scheduled_at.split('T')[0]) : '—' },
                { l: 'Retorno', v: fmtDate(patient.next_return) },
                { l: 'Vacinas pend.', v: pend, warn: pend > 0 },
              ]
            : [
                { l: 'Consultas', v: loadingC ? '…' : pastConsultations.length },
                { l: 'Última', v: lastConsult ? fmtDate(lastConsult.scheduled_at.split('T')[0]) : '—' },
                { l: 'Retorno', v: fmtDate(patient.next_return) },
                { l: 'Condições', v: activeProblems.length, warn: activeProblems.length > 0 },
              ]
          ).map(({ l, v, warn }) => (
            <div key={l} style={{ textAlign: 'center', padding: isMobile ? '6px 12px' : '8px 20px', background: BG, borderRadius: 6, border: `1px solid ${BO}`, flex: isMobile ? 1 : undefined }}>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: warn ? WARN : INK, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-0.02em' }}>{v}</div>
              <div style={{ fontSize: 11, color: MU, marginTop: 2, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{l}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ overflowX: isMobile ? 'auto' as const : undefined }}>
        <Tabs tabs={visibleTabs} active={visibleTabs.includes(tab) ? tab : 'Resumo'} onChange={t => { setTab(t); setSelectedConsult(null); }} />
      </div>
      <div style={{ paddingTop: isMobile ? 14 : 24 }}>

        {tab === 'Resumo' && (() => {
          // ── Resumo Clínica Geral (adulto) ─────────────────────────────────────
          if (!isPediatria) {
            const adultData = lastConsult
              ? (lastConsult.summary?.specialty_data as ConsultaAdultoData | null)
              : null;
            const vitals = adultData?.vitals;
            const insights = adultData?.clinical_insights ?? [];
            const returnDate = patient.next_return ? new Date(patient.next_return) : null;
            const today = new Date();
            const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const returnDays = returnDate
              ? Math.floor((new Date(returnDate.getFullYear(), returnDate.getMonth(), returnDate.getDate()).getTime() - todayMidnight.getTime()) / 86400000)
              : null;

            const SH = ({ title, right }: { title: string; right?: React.ReactNode }) => (
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 15, fontWeight: 600, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em' }}>{title}</span>
                {right}
              </div>
            );

            return (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Últimos sinais vitais */}
                  {vitals && Object.values(vitals).some(Boolean) && (
                    <Card>
                      <SH title="Últimos sinais vitais" right={lastConsult ? <span style={{ fontSize: 11, color: MU }}>{fmtDate(lastConsult.scheduled_at.split('T')[0])}</span> : undefined} />
                      <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {[
                          { l: 'PA', v: vitals.pressao_arterial },
                          { l: 'FC', v: vitals.frequencia_cardiaca },
                          { l: 'SpO₂', v: vitals.saturacao },
                          { l: 'Temp', v: vitals.temperatura },
                          { l: 'Peso', v: vitals.peso },
                          { l: 'Altura', v: vitals.altura },
                          { l: 'IMC', v: vitals.imc },
                        ].filter(item => item.v).map(({ l, v }) => (
                          <div key={l} style={{ background: BG, border: `1px solid ${BO}`, borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{v}</div>
                            <div style={{ fontSize: 10, color: MU, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{l}</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Condições Ativas — completa e editável (aba Saúde foi extinta) */}
                  <Card>
                    <SH title="Condições Ativas" right={
                      <Btn variant="secondary" onClick={() => setShowAddProblem(true)} style={{ fontSize: 12, padding: '4px 10px' }}>
                        <Plus size={13} /> Adicionar
                      </Btn>
                    } />
                    {showAddProblem && (
                      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', gap: 8 }}>
                        <input autoFocus value={newProblemName} onChange={e => setNewProblemName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addProblem()}
                          placeholder="Nome da condição (ex: Hipertensão Arterial Sistêmica)"
                          style={{ ...inputStyle2, flex: 1 }} />
                        <Btn onClick={addProblem} style={{ flexShrink: 0 }}><Check size={14} /></Btn>
                        <Btn variant="secondary" onClick={() => setShowAddProblem(false)} style={{ flexShrink: 0 }}><X size={14} /></Btn>
                      </div>
                    )}
                    <div style={{ padding: '14px 20px' }}>
                      {problems.length === 0 ? (
                        <p style={{ margin: 0, fontSize: 13, color: MU }}>Nenhuma condição registrada. Clique em "Adicionar" para começar.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {problems.map((prob, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: BG, borderRadius: 8, border: `1px solid ${BO}` }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 500, color: INK }}>{prob.name}</div>
                                {prob.since && <div style={{ fontSize: 11, color: MU }}>Desde {fmtDate(prob.since)}</div>}
                                <div style={{ fontSize: 11, color: MU }}>Atualizado {fmtDate(prob.updated_at.slice(0, 10))}</div>
                              </div>
                              <button onClick={() => toggleProblemStatus(i)} style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 5, border: 'none',
                                background: prob.status === 'ativo' ? WARNL : prob.status === 'controlado' ? SUCL : SEC,
                                color: prob.status === 'ativo' ? WARN : prob.status === 'controlado' ? SUC : MU }}>
                                {prob.status.charAt(0).toUpperCase() + prob.status.slice(1)}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Alergias — completa e editável (aba Saúde foi extinta) */}
                  <Card>
                    <SH title="Alergias" right={
                      <Btn variant="secondary" onClick={() => setShowAddAllergy(true)} style={{ fontSize: 12, padding: '4px 10px' }}>
                        <Plus size={13} /> Adicionar
                      </Btn>
                    } />
                    {showAddAllergy && (
                      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', gap: 8 }}>
                        <input autoFocus value={newAllergyName} onChange={e => setNewAllergyName(e.target.value)}
                          placeholder="Substância (ex: Dipirona)" style={{ ...inputStyle2, flex: 1 }} />
                        <input value={newAllergyReaction} onChange={e => setNewAllergyReaction(e.target.value)}
                          placeholder="Reação (opcional)" style={{ ...inputStyle2, flex: 1 }} />
                        <Btn onClick={() => { addAllergy(newAllergyName, newAllergyReaction); setNewAllergyName(''); setNewAllergyReaction(''); setShowAddAllergy(false); }} style={{ flexShrink: 0 }}><Check size={14} /></Btn>
                        <Btn variant="secondary" onClick={() => setShowAddAllergy(false)} style={{ flexShrink: 0 }}><X size={14} /></Btn>
                      </div>
                    )}
                    <div style={{ padding: '14px 20px' }}>
                      {allergies.length === 0 ? (
                        <p style={{ margin: 0, fontSize: 13, color: MU }}>Nenhuma alergia registrada.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {allergies.map((a, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: DESL, borderRadius: 8, border: `1px solid ${DES}40` }}>
                              <div style={{ flex: 1, fontSize: 14, color: INK }}>{a.allergen}{a.reaction ? ` — ${a.reaction}` : ''}</div>
                              <button onClick={() => removeAllergy(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU, display: 'flex' }}>
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Plano atual */}
                  {lastConsult && (lastConsult.plan || lastConsult.prescription) && (
                    <Card>
                      <SH title="Plano atual" right={<span style={{ fontSize: 11, color: MU }}>{fmtDate(lastConsult.scheduled_at.split('T')[0])}</span>} />
                      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {lastConsult.plan && (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Conduta</div>
                            <p style={{ margin: 0, fontSize: 13, color: INK, lineHeight: 1.5 }}>{lastConsult.plan}</p>
                          </div>
                        )}
                        {lastConsult.prescription?.trim() && (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Medicações prescritas</div>
                            <p style={{ margin: 0, fontSize: 13, color: INK, lineHeight: 1.5, fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'pre-wrap' }}>{lastConsult.prescription}</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* Anamnese — completa e editável (aba Saúde foi extinta) */}
                  <Card>
                    <SH title="Anamnese — 1ª consulta" right={
                      <Btn variant="secondary" onClick={() => setShowAnamneseModal(true)} style={{ fontSize: 12, padding: '4px 10px' }}>
                        <PencilSimple size={13} /> {anamneseAdulta ? 'Editar' : 'Preencher'}
                      </Btn>
                    } />
                    <div style={{ padding: '14px 20px' }}>
                      {!anamneseAdulta ? (
                        <p style={{ margin: 0, fontSize: 13, color: MU }}>Anamnese não registrada. Preencha após a primeira consulta.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {anamneseAdulta.motivo_consulta && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Motivo</div>
                              <p style={{ margin: 0, fontSize: 13, color: INK }}>{anamneseAdulta.motivo_consulta}</p>
                            </div>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {[
                              { l: 'HAS', v: anamneseAdulta.hipertensao },
                              { l: 'DM', v: anamneseAdulta.diabetes },
                              { l: 'Dislipidemia', v: anamneseAdulta.dislipidemia },
                              { l: 'Cardiopatia', v: anamneseAdulta.cardiopatia },
                            ].filter(x => x.v === true).map(({ l }) => (
                              <span key={l} style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 5, background: WARNL, color: WARN }}>{l}</span>
                            ))}
                            {anamneseAdulta.tabagismo === 'fumante' && <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 5, background: DESL, color: DES }}>Tabagista</span>}
                          </div>
                          {anamneseAdulta.outras_comorbidades && <p style={{ margin: 0, fontSize: 12, color: MU }}>{anamneseAdulta.outras_comorbidades}</p>}
                          {anamneseAdulta.medicamentos_em_uso && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Medicamentos em uso</div>
                              <p style={{ margin: 0, fontSize: 13, color: INK, whiteSpace: 'pre-wrap' }}>{anamneseAdulta.medicamentos_em_uso}</p>
                            </div>
                          )}
                          {anamneseAdulta.historico_familiar && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Histórico familiar</div>
                              <p style={{ margin: 0, fontSize: 13, color: INK }}>{anamneseAdulta.historico_familiar}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>

                  {showAnamneseModal && (
                    <AnamneseAdultaModal
                      onClose={() => setShowAnamneseModal(false)}
                      onSaved={(data) => { setShowAnamneseModal(false); db.fetchAnamneseAdulta(patient.id).then(setAnamneseAdulta); }}
                      existingData={anamneseAdulta}
                      consultaId={anamneseAdulta?.consulta_id ?? (lastConsult?.id ?? null)}
                    />
                  )}
                </div>

                {/* Coluna direita */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Alertas clínicos */}
                  {insights.length > 0 && (
                    <Card>
                      <SH title="Alertas clínicos" />
                      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {insights.map((ins, i) => (
                          <div key={i} style={{ fontSize: 13, color: INK, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <Warning size={14} color={WARN} style={{ flexShrink: 0, marginTop: 1 }} />
                            {ins}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Retorno */}
                  {returnDays !== null && (
                    <Card style={{ borderLeft: `3px solid ${returnDays < 0 ? DES : returnDays <= 7 ? WARN : P}` }}>
                      <div style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Retorno</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: returnDays < 0 ? DES : returnDays <= 7 ? WARN : INK }}>
                          {returnDays < 0
                            ? `Vencido há ${Math.abs(returnDays)} dia${Math.abs(returnDays) !== 1 ? 's' : ''}`
                            : returnDays === 0 ? 'Hoje'
                            : `Em ${returnDays} dia${returnDays !== 1 ? 's' : ''}`}
                        </div>
                        <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>{fmtDate(patient.next_return!)}</div>
                      </div>
                    </Card>
                  )}

                  {/* Últimos marcadores laboratoriais */}
                  {Object.keys(latestMarkers).length > 0 && (() => {
                    const alteredEntries = Object.entries(latestMarkers).filter(([, m]) => m.status !== 'normal');
                    const latestDocWithSummary = clinicalDocs.find(d => d.ai_summary);
                    return (
                    <Card style={{ borderColor: alteredEntries.length > 0 ? WARN : BO }}>
                      <SH title="Últimos exames" right={
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: alteredEntries.length > 0 ? WARNL : SUCL, color: alteredEntries.length > 0 ? WARN : SUC }}>
                          {alteredEntries.length > 0 ? `${alteredEntries.length} fora da faixa` : 'tudo normal'}
                        </span>
                      } />
                      {latestDocWithSummary?.ai_summary && (
                        <div style={{ padding: '12px 20px 0' }}>
                          <p style={{ margin: 0, fontSize: 12, color: MU, lineHeight: 1.5, fontStyle: 'italic' }}>{latestDocWithSummary.ai_summary}</p>
                        </div>
                      )}
                      {alteredEntries.length > 0 && (
                        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {alteredEntries.map(([name, marker]) => (
                            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: 13, color: INK }}>{name}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: '"JetBrains Mono", monospace', color: marker.status === 'alto' ? WARN : marker.status === 'critico' ? DES : '#3B82F6' }}>
                                  {marker.value} {marker.unit}
                                </span>
                                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: marker.status === 'alto' ? WARNL : marker.status === 'critico' ? DESL : '#EFF6FF', color: marker.status === 'alto' ? WARN : marker.status === 'critico' ? DES : '#3B82F6', fontWeight: 600 }}>
                                  {marker.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                    );
                  })()}

                  {/* Alergias */}
                  {patient.notes && (
                    <Card style={{ borderLeft: `3px solid ${WARN}` }}>
                      <div style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: WARN, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Alergias</div>
                        <div style={{ fontSize: 13, color: INK }}>{patient.notes}</div>
                      </div>
                    </Card>
                  )}

                  {consultations.length === 0 && (
                    <Card>
                      <div style={{ padding: '20px', textAlign: 'center' }}>
                        <Stethoscope size={24} color={MU} />
                        <p style={{ margin: '8px 0 0', fontSize: 13, color: MU }}>Realize a primeira consulta para gerar o resumo clínico.</p>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            );
          }

          // ── Helpers (Pediatria) ───────────────────────────────────────────────
          const today = new Date();
          const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

          function consultDaysDiff(c: Consultation) {
            // Parse date portion directly from ISO string to avoid UTC→local timezone shift
            const [y, m, d] = c.scheduled_at.slice(0, 10).split('-').map(Number);
            return Math.floor((todayMidnight.getTime() - new Date(y, m - 1, d).getTime()) / 86400000);
          }

          // Parse texto corrido em bullets (split por ". " ou "\n")
          function toBullets(text: string): string[] {
            if (!text) return [];
            return text
              .split(/\.\s+|\n/)
              .map(s => s.replace(/^[-•]\s*/, '').trim())
              .filter(s => s.length > 3)
              .slice(0, 5);
          }

          // Tempo relativo
          function relativeTime(iso: string): string {
            const days = Math.floor((todayMidnight.getTime() - new Date(new Date(iso).toDateString()).getTime()) / 86400000);
            if (days === 0) return 'hoje';
            if (days === 1) return 'há 1 dia';
            if (days < 30) return `há ${days} dias`;
            const months = Math.floor(days / 30);
            return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
          }

          // Última consulta passada
          const pastConsults = consultations.filter(c => c.status !== 'draft' && consultDaysDiff(c) >= 0);
          const last = pastConsults[0] ?? null;

          // Prescrições: apenas consultas já realizadas
          const medsHistory = pastConsults
            .filter(c => c.prescription?.trim())
            .map(c => ({ rx: c.prescription, date: c.scheduled_at, complaint: c.chief_complaint }));
          const lastRx = medsHistory[0] ?? null;

          // Retorno
          const returnDate = patient.next_return ? new Date(patient.next_return) : null;
          const returnDays = returnDate
            ? Math.floor((new Date(returnDate.getFullYear(), returnDate.getMonth(), returnDate.getDate()).getTime() - todayMidnight.getTime()) / 86400000)
            : null;

          // ── Próxima vacina via PNI ────────────────────────────────────────────
          const bd = new Date(patient.birth_date);
          const ageMonths = Math.max(0, (today.getFullYear() - bd.getFullYear()) * 12 + (today.getMonth() - bd.getMonth()));
          const nextVacc = PNI_SCHEDULE
            .filter(v => v.age_months > ageMonths)
            .sort((a, b) => a.age_months - b.age_months)[0] ?? null;

          // ── Resumo clínico — bullets escaneáveis (máx 5, 1 linha cada) ───────
          const clinicalBullets: { text: string; highlight?: boolean }[] = [];
          if (consultations.length === 0) {
            clinicalBullets.push({ text: 'Nenhuma consulta registrada.' });
          } else {
            if (last?.chief_complaint) clinicalBullets.push({ text: `Última consulta: ${last.chief_complaint}.` });
            if (lastMeasurement?.weight) clinicalBullets.push({ text: `Peso ${lastMeasurement.weight} kg${lastMeasurement.height ? ` · Altura ${lastMeasurement.height} cm` : ''}.` });
            clinicalBullets.push(pend === 0
              ? { text: 'Vacinação em dia.' }
              : { text: `Vacinação com ${pend} pendência${pend > 1 ? 's' : ''}.`, highlight: true }
            );
            if (returnDate) clinicalBullets.push({ text: `Retorno previsto: ${fmtDate(patient.next_return!)}.` });
            if (patient.notes) clinicalBullets.push({ text: `Alergia: ${patient.notes}.`, highlight: true });
          }

          // ── Alertas ───────────────────────────────────────────────────────────
          type AlertItem = { text: string; level: 'danger' | 'warn' | 'info' };
          const alerts: AlertItem[] = [];
          if (pend > 0) alerts.push({ text: `${pend} vacina${pend > 1 ? 's' : ''} pendente${pend > 1 ? 's' : ''} no PNI.`, level: 'warn' });
          if (returnDays !== null && returnDays < 0) alerts.push({ text: `Retorno vencido há ${Math.abs(returnDays)} dia${Math.abs(returnDays) > 1 ? 's' : ''} — reagendar.`, level: 'danger' });
          else if (returnDays !== null && returnDays <= 7) alerts.push({ text: `Retorno em ${returnDays === 0 ? 'hoje' : `${returnDays} dia${returnDays > 1 ? 's' : ''}`} (${fmtDate(patient.next_return!)}).`, level: returnDays <= 2 ? 'danger' : 'warn' });
          else if (returnDate) alerts.push({ text: `Retorno previsto: ${fmtDate(patient.next_return!)}.`, level: 'info' });
          if (patient.notes) alerts.push({ text: `Alergia: ${patient.notes}. Considerar na prescrição.`, level: 'warn' });
          if (consultations.length === 0) alerts.push({ text: 'Sem consultas registradas. Inicie o acompanhamento.', level: 'info' });

          const alertColors = {
            danger: { bg: '#FEF2F2', border: '#FECACA', text: DES, icon: DES },
            warn:   { bg: WARNL, border: '#F3C07B', text: WARN, icon: WARN },
            info:   { bg: '#EFF6FF', border: '#BFDBFE', text: '#3B82F6', icon: '#3B82F6' },
          };

          // ── Crescimento — interpretação clínica em 2 linhas ──────────────────
          const sortedGrowth = [...growthRecords].sort((a, b) => a.month - b.month);
          const growthChartData = sortedGrowth.map(g => ({ date: `${g.month}m`, weight: g.weight }));
          let growthLine1 = '';
          let growthLine2 = '';
          if (sortedGrowth.length === 0) {
            growthLine1 = 'Nenhuma medição registrada.';
            growthLine2 = 'Adicione dados na aba Crescimento.';
          } else if (sortedGrowth.length === 1) {
            growthLine1 = `Peso atual: ${sortedGrowth[0].weight} kg.`;
            growthLine2 = 'Trajetória em formação — acompanhar na próxima consulta.';
          } else {
            const prev = sortedGrowth[sortedGrowth.length - 2];
            const curr = sortedGrowth[sortedGrowth.length - 1];
            const diff = ((curr.weight ?? 0) - (prev.weight ?? 0));
            growthLine1 = diff > 0
              ? `Ganho de ${diff.toFixed(2)} kg desde a última medição — peso adequado.`
              : diff === 0
              ? 'Peso estável na última medição.'
              : `Redução de ${Math.abs(diff).toFixed(2)} kg desde a última medição — acompanhar.`;
            growthLine2 = diff > 0 ? 'Trajetória estável.' : diff === 0 ? 'Acompanhar evolução na próxima consulta.' : 'Reavaliar peso na próxima consulta.';
          }

          // Costura crescimento → plano
          const growthNeedsAttention = sortedGrowth.length >= 2 && ((sortedGrowth[sortedGrowth.length-1].weight ?? 0) - (sortedGrowth[sortedGrowth.length-2].weight ?? 0)) <= 0;

          // ── Section header ────────────────────────────────────────────────────
          const SH = ({ title, right }: { title: string; right?: React.ReactNode }) => (
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 600, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em' }}>{title}</span>
              {right}
            </div>
          );

          // ── Bullet list helper ────────────────────────────────────────────────
          const BulletList = ({ items }: { items: string[] }) => (
            <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {items.map((b, i) => <li key={i} style={{ fontSize: 13, color: INK, lineHeight: 1.45 }}>{b}</li>)}
            </ul>
          );

          // ── Section label ─────────────────────────────────────────────────────
          const SLabel = ({ text }: { text: string }) => (
            <div style={{ fontSize: 10, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 7 }}>{text}</div>
          );

          return (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr', gap: 16 }}>

              {/* ══ COLUNA ESQUERDA ═══════════════════════════════════════════ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* 1. Resumo clínico */}
                <Card>
                  <SH title="Resumo clínico" right={<span style={{ fontSize: 11, color: MU }}>dados registrados</span>} />
                  <div style={{ padding: '14px 20px' }}>
                    {consultations.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: MU }}>Realize a primeira consulta para gerar o resumo.</p>
                    ) : (
                      <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {clinicalBullets.map((b, i) => (
                          <li key={i} style={{ fontSize: 13, color: b.highlight ? WARN : INK, fontWeight: b.highlight ? 500 : 400, lineHeight: 1.45 }}>{b.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>

                {/* 2. Plano atual — seções fixas com bullets */}
                <Card>
                  <SH title="Plano atual" right={last ? <span style={{ fontSize: 11, color: MU }}>{fmtDate(last.scheduled_at.split('T')[0])}</span> : undefined} />
                  <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {!last ? (
                      <p style={{ margin: 0, fontSize: 13, color: MU }}>Plano ainda não registrado.</p>
                    ) : (
                      <>
                        {last.plan && (
                          <div>
                            <SLabel text="Conduta" />
                            <BulletList items={toBullets(last.plan)} />
                          </div>
                        )}
                        {last.summary?.conduta && last.summary.conduta !== last.plan && (
                          <div>
                            <SLabel text="Orientações" />
                            <BulletList items={toBullets(last.summary.conduta)} />
                          </div>
                        )}
                        {last.prescription?.trim() && (
                          <div>
                            <SLabel text="Medicações" />
                            <BulletList items={toBullets(last.prescription)} />
                            {patient.notes && (
                              <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: WARN }}>
                                <Warning size={12} color={WARN} />
                                Alergia registrada: {patient.notes}. Revisar antes de prescrever.
                              </div>
                            )}
                          </div>
                        )}
                        {/* Costura: vacinas pendentes → plano */}
                        {pend > 0 && (
                          <div>
                            <SLabel text="Pendências identificadas" />
                            <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <li style={{ fontSize: 13, color: WARN, lineHeight: 1.45 }}>Atualizar esquema vacinal — {pend} pendência{pend > 1 ? 's' : ''} no PNI.</li>
                              {growthNeedsAttention && <li style={{ fontSize: 13, color: WARN, lineHeight: 1.45 }}>Reavaliar peso na próxima consulta.</li>}
                            </ul>
                          </div>
                        )}
                        {patient.next_return && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: PL, borderRadius: 8 }}>
                            <CalendarBlank size={14} color={P} />
                            <div>
                              <SLabel text="Retorno" />
                              <span style={{ fontSize: 13, color: P, fontWeight: 500 }}>{fmtDate(patient.next_return)}</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Card>

                {/* 3. Medicações — com contexto e último histórico */}
                <Card>
                  <SH title="Medicações" />
                  <div style={{ padding: '14px 20px' }}>
                    {/* Alerta de alergia se houver */}
                    {patient.notes && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, marginBottom: 14 }}>
                        <Warning size={13} color={DES} />
                        <span style={{ fontSize: 12, color: DES }}>Alergia registrada: {patient.notes}.</span>
                      </div>
                    )}
                    {medsHistory.length === 0 ? (
                      <div>
                        <div style={{ fontSize: 13, color: MU, marginBottom: 10 }}>Sem medicações em uso.</div>
                        <div style={{ fontSize: 12, color: MU }}>Nenhuma prescrição registrada no histórico.</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                          <SLabel text={`Última prescrição · ${relativeTime(lastRx!.date)}`} />
                          <div style={{ padding: '10px 14px', background: BG, borderRadius: 8, border: `1px solid ${BO}` }}>
                            <div style={{ fontSize: 11, color: MU, marginBottom: 6, fontFamily: '"JetBrains Mono", monospace' }}>
                              {fmtDate(lastRx!.date.split('T')[0])} · {lastRx!.complaint}
                            </div>
                            <BulletList items={toBullets(lastRx!.rx)} />
                          </div>
                        </div>
                        {medsHistory.length > 1 && (
                          <div style={{ fontSize: 12, color: MU }}>
                            + {medsHistory.length - 1} prescrição{medsHistory.length > 2 ? 'ões' : ''} anterior{medsHistory.length > 2 ? 'es' : ''} — ver aba Consultas.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>

                {/* 4. Dados antropométricos */}
                <Card>
                  <SH title="Dados antropométricos"
                    right={lastMeasurement ? <span style={{ fontSize: 11, color: MU }}>mês {lastMeasurement.month}</span> : undefined}
                  />
                  <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Peso', value: lastMeasurement?.weight, unit: 'kg', note: lastMeasurement?.weight ? 'Adequado' : '—' },
                      { label: 'Altura', value: lastMeasurement?.height, unit: 'cm', note: lastMeasurement?.height ? 'Acompanhar' : '—' },
                      { label: 'P. Cefálico', value: lastMeasurement?.hc, unit: 'cm', note: lastMeasurement?.hc ? 'Acompanhar' : '—' },
                    ].map(({ label, value, unit, note }) => (
                      <div key={label} style={{ textAlign: 'center', padding: '12px 8px', background: BG, borderRadius: 8, border: `1px solid ${BO}` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: INK, lineHeight: 1 }}>
                          {value ?? '—'}<span style={{ fontSize: 11, color: MU, marginLeft: 2 }}>{value ? unit : ''}</span>
                        </div>
                        <div style={{ fontSize: 11, color: MU, marginTop: 5 }}>{note}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* 5. Consultas recentes */}
                <Card>
                  <SH title="Consultas recentes" right={<Btn variant="ghost" size="sm" onClick={() => setTab('Consultas')}>Ver todas</Btn>} />
                  {pastConsults.length === 0 ? (
                    <div style={{ padding: '28px 20px', textAlign: 'center' as const }}>
                      <p style={{ margin: '0 0 12px', fontSize: 13, color: MU }}>Nenhuma consulta registrada.</p>
                      <Btn size="sm" onClick={() => onStartConsult('primeira vez')}><Plus size={14} /> Iniciar primeira consulta</Btn>
                    </div>
                  ) : pastConsults.slice(0, 3).map((c, i) => {
                    const dd = consultDaysDiff(c);
                    const isToday = dd === 0;
                    const statusLabel = isToday ? 'Hoje' : 'Concluída';
                    const statusColor = isToday ? ACCENT : SUC;
                    const timeLabel = isToday ? 'HOJE' : `HÁ ${dd} ${dd === 1 ? 'DIA' : 'DIAS'}`;
                    return (
                      <div key={c.id} style={{ padding: '14px 20px', borderBottom: i < Math.min(pastConsults.length, 3) - 1 ? `1px solid ${BO}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600, color: MU }}>{timeLabel}</div>
                          <span style={{ fontSize: 11, color: statusColor, fontWeight: 600, background: statusColor + '18', padding: '2px 8px', borderRadius: 99 }}>{statusLabel}</span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: INK }}>{c.chief_complaint}</div>
                        {c.diagnosis && <div style={{ fontSize: 12, color: MU, marginBottom: 2 }}>Hipótese: {c.diagnosis.slice(0, 65)}{c.diagnosis.length > 65 ? '…' : ''}</div>}
                        {c.plan && <div style={{ fontSize: 12, color: MU }}>Conduta: {c.plan.slice(0, 65)}{c.plan.length > 65 ? '…' : ''}</div>}
                        {c.prescription && (
                          <div style={{ marginTop: 6, padding: '5px 10px', background: BG, borderRadius: 6, border: `1px solid ${BO}`, fontSize: 12, color: INK }}>
                            Rx: {c.prescription.slice(0, 75)}{c.prescription.length > 75 ? '…' : ''}
                          </div>
                        )}
                        <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                          <Btn variant="ghost" size="sm" onClick={() => { setSelectedConsult(c); setTab('Consultas'); }}>Ver prontuário</Btn>
                        </div>
                      </div>
                    );
                  })}
                </Card>

                {/* 6. Curva de crescimento — interpretação clínica em 2 linhas */}
                <Card>
                  <SH title="Curva de crescimento" right={<Btn variant="ghost" size="sm" onClick={() => setTab('Crescimento')}>Ver completo</Btn>} />
                  <div style={{ padding: '12px 20px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, color: INK, fontWeight: 500 }}>{growthLine1}</span>
                    <span style={{ fontSize: 12, color: MU }}>{growthLine2}</span>
                  </div>
                  <div style={{ padding: '8px 16px 20px' }}>
                    {growthChartData.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '28px 0', color: MU, fontSize: 13 }}>Nenhuma medição registrada.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={190}>
                        <LineChart data={growthChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={BO} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: MU }} />
                          <YAxis tick={{ fontSize: 11, fill: MU }} />
                          <Tooltip contentStyle={{ background: '#fff', border: `1px solid ${BO}`, borderRadius: 8 }} formatter={(v: any) => [`${v} kg`, 'Peso']} />
                          <Line type="monotone" dataKey="weight" stroke={P} strokeWidth={2} dot={{ fill: P, r: 4 }} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>
              </div>

              {/* ══ COLUNA DIREITA ════════════════════════════════════════════ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Alertas */}
                <Card>
                  <SH title="Pontos de atenção"
                    right={alerts.length === 0
                      ? <CheckCircle size={14} color={SUC} />
                      : <span style={{ fontSize: 11, fontWeight: 700, color: alerts.some(a => a.level === 'danger') ? DES : WARN, background: alerts.some(a => a.level === 'danger') ? '#FEF2F2' : WARNL, padding: '2px 8px', borderRadius: 99, border: `1px solid ${alerts.some(a => a.level === 'danger') ? '#FECACA' : '#F3C07B'}` }}>{alerts.length}</span>
                    }
                  />
                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {alerts.length === 0 ? (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8 }}>
                        <CheckCircle size={14} color={SUC} />
                        <span style={{ fontSize: 13, color: SUC }}>Sem pontos críticos identificados.</span>
                      </div>
                    ) : alerts.map((a, i) => {
                      const ac = alertColors[a.level];
                      return (
                        <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '9px 12px', background: ac.bg, border: `1px solid ${ac.border}`, borderRadius: 8 }}>
                          <Warning size={13} color={ac.icon} style={{ marginTop: 2, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: ac.text, lineHeight: 1.45 }}>{a.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Vacinas — status + próxima dose */}
                <Card>
                  <SH title="Vacinas"
                    right={<Btn variant="ghost" size="sm" onClick={() => setTab('Vacinas')}>Ver</Btn>}
                  />
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Status em destaque */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: pend === 0 ? '#F0FDF4' : WARNL, border: `1px solid ${pend === 0 ? '#BBF7D0' : '#F3C07B'}`, borderRadius: 8 }}>
                      {pend === 0
                        ? <CheckCircle size={15} color={SUC} weight="fill" />
                        : <Warning size={15} color={WARN} weight="fill" />
                      }
                      <span style={{ fontSize: 13, fontWeight: 600, color: pend === 0 ? SUC : WARN }}>
                        {pend === 0 ? 'Vacinação em dia' : `Vacinação com pendências (${pend})`}
                      </span>
                    </div>
                    {/* Próxima dose */}
                    {nextVacc && (
                      <div style={{ fontSize: 13, color: INK }}>
                        <SLabel text="Próxima dose" />
                        <span style={{ fontWeight: 500 }}>{nextVacc.name} {nextVacc.dose}</span>
                        <span style={{ color: MU, fontSize: 12 }}> — {nextVacc.age_months > 12 ? `${Math.round(nextVacc.age_months / 12)} ano${Math.round(nextVacc.age_months / 12) > 1 ? 's' : ''}` : `${nextVacc.age_months} meses`}</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Alergias — com referência à prescrição */}
                <Card>
                  <SH title="Alergias e observações" />
                  <div style={{ padding: '12px 16px' }}>
                    {patient.notes ? (
                      <div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: WARNL, border: `1px solid #F3C07B`, borderRadius: 8 }}>
                          <Warning size={15} color={WARN} weight="fill" style={{ marginTop: 1, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: WARN, marginBottom: 3 }}>Alergia registrada</div>
                            <div style={{ fontSize: 13, color: INK, lineHeight: 1.5 }}>{patient.notes}</div>
                          </div>
                        </div>
                        {/* Costura → medicações */}
                        {lastRx && (
                          <div style={{ marginTop: 8, fontSize: 12, color: MU, display: 'flex', gap: 5, alignItems: 'center' }}>
                            <ArrowRight size={11} color={MU} />
                            Última prescrição {relativeTime(lastRx.date)} — verificar compatibilidade.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: MU }}>Nenhuma alergia registrada.</div>
                    )}
                  </div>
                </Card>

                {/* Insights longitudinais */}
                <Card>
                  <SH title="Histórico clínico" right={<span style={{ fontSize: 11, color: MU }}>observado</span>} />
                  <div style={{ padding: '12px 16px' }}>
                    {consultations.length < 2 ? (
                      <p style={{ margin: 0, fontSize: 13, color: MU }}>Disponível após mais consultas registradas.</p>
                    ) : (
                      <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {[
                          pend > 0
                            ? `Vacinação com pendências em ${consultations.length} consultas registradas.`
                            : 'Vacinação em dia no histórico.',
                          medsHistory.length > 0
                            ? `Prescrições em ${medsHistory.length} consulta${medsHistory.length > 1 ? 's' : ''}.`
                            : 'Sem prescrições no histórico.',
                          sortedGrowth.length >= 2 ? growthLine1 : null,
                          patient.notes ? `Alergia documentada — atenção em prescrições.` : null,
                        ].filter(Boolean).map((b, i) => (
                          <li key={i} style={{ fontSize: 13, color: INK, lineHeight: 1.45 }}>{b as string}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          );
        })()}

        {(tab === 'Consultas' || tab === 'Evolução') && (
          selectedConsult
            ? <RequireRole roles={['medico']} onBack={() => setSelectedConsult(null)}><ConsultationDetail consult={selectedConsult} onBack={() => setSelectedConsult(null)} linkedDocuments={clinicalDocs.filter(d => d.consultation_id === selectedConsult.id)} allConsultations={pastConsultations} onExamSaved={() => { db.fetchClinicalDocuments(patient.id).then(setClinicalDocs); db.fetchLatestMarkers(patient.id).then(setLatestMarkers); db.fetchLastRequestedExams(patient.id).then(setLastRequestedExams); }} /></RequireRole>
            : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <Btn size="sm" onClick={() => onStartConsult('retorno')}><Plus size={14} /> Nova consulta</Btn>
                </div>

                {/* Primeira Consulta — bloco fixo no topo */}
                <PrimeiraConsultaCard patientId={patient.id} refetchTrigger={refetchTrigger} />

                {/* Clínica Geral: upload de exames sempre acessível + pendências da última consulta */}
                {!isPediatria && (
                  <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {lastRequestedExams && (
                      <Card
                        style={{ cursor: 'pointer', border: `1.5px solid ${lastRequestedExams.linkedDocuments.length > 0 ? SUC : WARN}40`, background: lastRequestedExams.linkedDocuments.length > 0 ? SUCL : WARNL }}
                        onClick={() => { const c = pastConsultations.find(p => p.id === lastRequestedExams.consultationId); if (c) setSelectedConsult(c); }}
                      >
                        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                          <Flask size={20} color={lastRequestedExams.linkedDocuments.length > 0 ? SUC : WARN} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                              Pedido em {fmtDate(lastRequestedExams.date)}: {lastRequestedExams.requestedExams.join(', ')}
                            </div>
                            <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>
                              {lastRequestedExams.linkedDocuments.length > 0
                                ? `${lastRequestedExams.linkedDocuments.length} resultado${lastRequestedExams.linkedDocuments.length !== 1 ? 's' : ''} disponível${lastRequestedExams.linkedDocuments.length !== 1 ? 'eis' : ''}`
                                : 'Ainda sem resultado vinculado'}
                            </div>
                          </div>
                          <CaretRight size={16} color={MU} />
                        </div>
                      </Card>
                    )}
                    <ExamUploadForm
                      patientId={patient.id}
                      consultations={pastConsultations}
                      documents={clinicalDocs}
                      onSaved={() => {
                        db.fetchClinicalDocuments(patient.id).then(setClinicalDocs);
                        db.fetchLatestMarkers(patient.id).then(setLatestMarkers);
                        db.fetchLastRequestedExams(patient.id).then(setLastRequestedExams);
                      }}
                    />
                    {clinicalDocs.some(d => !d.consultation_id) && (
                      <Card style={{ border: `1px solid ${WARN}40`, background: WARNL }}>
                        <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Warning size={16} color={WARN} />
                          <span style={{ fontSize: 12, color: WARN }}>
                            {clinicalDocs.filter(d => !d.consultation_id).length} documento{clinicalDocs.filter(d => !d.consultation_id).length !== 1 ? 's' : ''} sem consulta vinculada — abra uma consulta para linkar.
                          </span>
                        </div>
                      </Card>
                    )}
                    <MarkerComparisonsCard comparisons={markerComparisons} />
                    <MarcadoresTrendCard latestMarkers={latestMarkers} />
                  </div>
                )}

                {/* Drafts section */}
                {draftConsultations.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: WARN, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Warning size={12} color={WARN} /> {draftConsultations.length} rascunho{draftConsultations.length !== 1 ? 's' : ''} aguardando confirmação
                    </div>
                    {draftConsultations.map(c => (
                      <Card key={c.id} style={{ marginBottom: 8, cursor: 'pointer', border: `1.5px solid ${WARN}40`, background: WARNL }} onClick={() => onOpenDraft(c)}>
                        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 8, background: `${WARN}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={18} color={WARN} /></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, fontSize: 14 }}>{fmtDateTime(c.scheduled_at)}</span>
                              <Badge color={WARN} bg={`${WARN}20`}>Rascunho</Badge>
                            </div>
                            <div style={{ fontSize: 13, color: INK }}>{c.chief_complaint || 'Sem queixa registrada'}</div>
                          </div>
                          <CaretRight size={18} color={WARN} />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Completed consultations */}
                {pastConsultations.length === 0 && draftConsultations.length === 0 && (
                  <Card style={{ padding: 40, textAlign: 'center' as const, color: MU }}>Nenhuma consulta registrada.</Card>
                )}
                {pastConsultations.map((c, i) => {
                  const linkedExamDocs = clinicalDocs.filter(d => d.consultation_id === c.id);
                  const hasRequestedExams = (c.requested_exams?.length ?? 0) > 0;
                  return (
                  <Card key={c.id} style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => setSelectedConsult(c)}>
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: PL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={18} color={P} /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' as const }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{fmtDateTime(c.scheduled_at)}</span>
                          <Pill type={c.type} />
                          <Badge color={MU} bg={SEC}>{c.duration_minutes} min</Badge>
                          {i === 0 && <Badge color={SUC} bg={SUCL}>Mais recente</Badge>}
                          {hasRequestedExams && (
                            <Badge color={linkedExamDocs.length > 0 ? SUC : WARN} bg={linkedExamDocs.length > 0 ? SUCL : WARNL}>
                              {linkedExamDocs.length > 0 ? 'Resultado disponível' : 'Exame pendente'}
                            </Badge>
                          )}
                        </div>
                        <div style={{ fontSize: 13, marginBottom: 2 }}>{c.chief_complaint}</div>
                        <div style={{ fontSize: 12, color: MU }}>{c.diagnosis}</div>
                      </div>
                      <CaretRight size={18} color={MU} />
                    </div>
                  </Card>
                  );
                })}
              </div>
            )
        )}

        {tab === 'Crescimento' && <RequireRole roles={['medico']}><GrowthChart patient={patient} consultations={consultations} /></RequireRole>}
        {tab === 'Vacinas' && (isPediatria ? <VaccinesTab patient={patient} /> : <AdultVaccinesTab patient={patient} />)}
        {tab === 'Desenvolvimento' && (
          <RequireRole roles={['medico']}>
            <DevelopmentTab
              patientId={patient.id}
              patientBirthDate={patient.birth_date}
              doctorId={doctorId ?? ''}
            />
          </RequireRole>
        )}

        {/* ── Clínica Geral tabs ─────────────────────────────────────────────── */}
        {tab === 'Medicações' && !isPediatria && (
          <MedicacoesAdultaTab medications={medications} canEdit={!!lastConsult?.id} onAdd={addMedication} onSetStatus={setMedicationStatus} />
        )}

        {/* Avaliação Capilar (Tricologia) — oculto na fase de validação de Pediatria */}
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
  const { patients } = usePatients();
  const [patientId, setPatientId] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('09:00');
  const [complaint, setComplaint] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!patientId) { setError('Selecione um paciente.'); return; }
    setSaving(true); setError('');
    try {
      await db.createAppointment({ patient_id: patientId, scheduled_at: new Date(`${date}T${time}:00`).toISOString(), chief_complaint: complaint });
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

// ─── APPOINTMENT DETAIL MODAL ─────────────────────────────────────────────────
function AppointmentDetailModal({
  appt, onClose, onUpdate, onStartConsult,
}: {
  appt: AppointmentRow; onClose: () => void; onUpdate: () => void; onStartConsult: (appt: AppointmentRow) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(appt.date);
  const [time, setTime] = useState(appt.time);
  const [complaint, setComplaint] = useState(appt.chief_complaint || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastExams, setLastExams] = useState<db.LastRequestedExamsInfo | null>(null);

  useEffect(() => {
    if (appt.type !== 'retorno') { setLastExams(null); return; }
    db.fetchLastRequestedExams(appt.patient_id).then(setLastExams).catch(() => setLastExams(null));
  }, [appt.patient_id, appt.type]);

  const inputSt: React.CSSProperties = { width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff', color: INK };
  const labelSt: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: MU, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 };

  const STATUS_LABEL: Record<string, string> = { scheduled: 'Aguardando confirmação', confirmed: 'Paciente chegou', in_progress: 'Em atendimento', completed: 'Realizada', cancelled: 'Cancelada' };
  const STATUS_COLOR: Record<string, string> = { scheduled: WARN, confirmed: ACCENT, in_progress: P, completed: SUC, cancelled: MU };
  const sColor = STATUS_COLOR[appt.status] || MU;

  async function save() {
    setSaving(true); setError('');
    try {
      await db.updateAppointment(appt.id, { scheduled_at: new Date(`${date}T${time}:00`).toISOString(), chief_complaint: complaint });
      onUpdate();
    } catch (e: any) { setError(e.message || 'Erro ao salvar.'); setSaving(false); }
  }
  async function confirm() {
    setSaving(true);
    try { await db.updateAppointment(appt.id, { status: 'confirmed' }); onUpdate(); }
    catch (e: any) { setError(e.message || 'Erro.'); setSaving(false); }
  }
  async function markDone() {
    setSaving(true);
    try { await db.updateAppointment(appt.id, { status: 'completed' }); onUpdate(); }
    catch (e: any) { setError(e.message || 'Erro.'); setSaving(false); }
  }
  async function cancel() {
    if (!window.confirm('Cancelar esta consulta?')) return;
    setSaving(true);
    try { await db.cancelAppointment(appt.id); onUpdate(); }
    catch (e: any) { setError(e.message || 'Erro.'); setSaving(false); }
  }

  const dateLabel = new Date(appt.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: PL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: P }}>{appt.patient_name[0]}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: INK }}>{appt.patient_name}</div>
            <div style={{ fontSize: 13, color: MU }}>{appt.age}{appt.guardian ? ` · ${appt.guardian}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU, padding: 4, flexShrink: 0 }}><X size={20} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: sColor, background: sColor + '18', padding: '4px 12px', borderRadius: 99, border: `1px solid ${sColor}30` }}>
              {STATUS_LABEL[appt.status] || appt.status}
            </span>
            {!editing && appt.status !== 'completed' && appt.status !== 'cancelled' && (
              <button onClick={() => setEditing(true)} style={{ background: 'none', border: `1px solid ${BO}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: MU, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                <PencilSimple size={13} /> Editar
              </button>
            )}
          </div>

          {!editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: '12px 16px', background: BG, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MU, letterSpacing: 0.5, marginBottom: 6 }}>DATA</div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: INK, textTransform: 'capitalize' as const }}>{dateLabel}</div>
                </div>
                <div style={{ padding: '12px 16px', background: BG, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MU, letterSpacing: 0.5, marginBottom: 6 }}>HORÁRIO</div>
                  <div style={{ fontWeight: 700, fontSize: 24, fontFamily: '"JetBrains Mono", monospace', color: P, letterSpacing: '-0.02em' }}>{appt.time}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: appt.chief_complaint ? '1fr 1fr' : '1fr', gap: 10 }}>
                <div style={{ padding: '12px 16px', background: BG, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MU, letterSpacing: 0.5, marginBottom: 6 }}>TIPO</div>
                  <div style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize' as const }}>{appt.type}</div>
                </div>
                {appt.chief_complaint && (
                  <div style={{ padding: '12px 16px', background: BG, borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: MU, letterSpacing: 0.5, marginBottom: 6 }}>MOTIVO</div>
                    <div style={{ fontSize: 13, color: INK }}>{appt.chief_complaint}</div>
                  </div>
                )}
              </div>

              {/* Exames pedidos na consulta anterior — para conferir o que o paciente trouxe */}
              {lastExams && (
                <div style={{ padding: '12px 16px', background: WARNL, border: `1px solid ${WARN}30`, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: WARN, letterSpacing: 0.5, marginBottom: 8 }}>
                    EXAMES PEDIDOS EM {fmtDate(lastExams.date)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {lastExams.requestedExams.map((exam, i) => {
                      const fulfilled = lastExams.linkedDocuments.length > 0;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {fulfilled ? <CheckCircle size={14} color={SUC} /> : <Warning size={14} color={WARN} />}
                          <span style={{ fontSize: 13, color: INK }}>{exam}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelSt}>Data</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Horário</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputSt} />
                </div>
              </div>
              <div>
                <label style={labelSt}>Motivo / observação</label>
                <input value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="Ex: Retorno pós-antibiótico" style={inputSt} />
              </div>
            </div>
          )}

          {error && <div style={{ marginTop: 12, fontSize: 13, color: DES, background: DESL, borderRadius: 8, padding: '8px 12px' }}>{error}</div>}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${BO}`, background: BG }}>
          {editing ? (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" onClick={() => setEditing(false)}>Cancelar</Btn>
              <Btn onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</Btn>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {appt.status !== 'completed' && appt.status !== 'cancelled' && (
                <Btn onClick={() => onStartConsult(appt)} style={{ width: '100%', justifyContent: 'center' }}>
                  <Stethoscope size={15} /> Iniciar consulta agora
                </Btn>
              )}
              {appt.status === 'scheduled' && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn variant="secondary" onClick={confirm} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                    <CheckCircle size={14} /> Confirmar presença
                  </Btn>
                  <Btn variant="secondary" onClick={markDone} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                    <CheckCircle size={14} /> Marcar realizada
                  </Btn>
                </div>
              )}
              {appt.status !== 'completed' && appt.status !== 'cancelled' && (
                <button onClick={cancel} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: DES, fontSize: 13, padding: '4px 0', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Trash size={13} /> Cancelar consulta
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgendaPage({ go, setActivePatient, onStartConsult }: { go: (s: string) => void; setActivePatient: (p: Patient) => void; onStartConsult: (type: 'retorno' | 'primeira vez', apptId?: string) => void }) {
  const { patients: allPatients } = usePatients();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(todayIso); // mobile only
  const [apptsByDate, setApptsByDate] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newModalDate, setNewModalDate] = useState(todayIso);
  const [selectedAppt, setSelectedAppt] = useState<AppointmentRow | null>(null);
  const isMobile = useIsMobile();

  const weekDays = getWeekDays(weekOffset);
  const gridDays = weekDays.slice(0, 5); // Mon–Fri
  const weekStart = weekDays[0].date;
  const weekEnd = weekDays[6].date;

  const loadWeekCancelRef = useRef(false);
  function loadWeek() {
    loadWeekCancelRef.current = false;
    setLoading(true);
    db.fetchAppointmentsForWeek(weekStart, weekEnd)
      .then(list => {
        if (loadWeekCancelRef.current) return;
        const byDate: Record<string, any[]> = {};
        list.forEach(a => { (byDate[a.date] = byDate[a.date] || []).push(a); });
        setApptsByDate(byDate);
      })
      .catch(console.error)
      .finally(() => { if (!loadWeekCancelRef.current) setLoading(false); });
  }

  useEffect(() => {
    loadWeek();
    return () => { loadWeekCancelRef.current = true; };
  }, [weekStart]);

  const allAppts = Object.values(apptsByDate).flat();
  const todayAppts = apptsByDate[todayIso] || [];
  const attendedCount = allAppts.filter(a => a.status === 'completed' || a.status === 'in_progress').length;
  const waitingCount = allAppts.filter(a => a.status === 'confirmed').length;
  const pending = allAppts.filter(a => a.status === 'scheduled').length;
  const nextAppt = todayAppts.find(a => a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'in_progress');

  // Collect all unique times from week, sorted
  const allTimes = [...new Set(allAppts.map(a => a.time))].sort();

  // Week label: "Abril · semana N"
  const weekLabel = (() => {
    const d = new Date(weekStart + 'T12:00:00');
    const month = d.toLocaleDateString('pt-BR', { month: 'long' });
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const wn = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    return `${month.charAt(0).toUpperCase() + month.slice(1)} · semana ${wn}`;
  })();

  // Appointment card colors
  function apptBg(a: AppointmentRow) {
    if (a.status === 'completed') return `${SUC}12`;
    if (a.status === 'confirmed') return `${WARN}14`;
    if (a.type === 'primeira vez') return `${ACCENT}14`;
    return `${P}10`;
  }
  function apptBorder(a: AppointmentRow) {
    if (a.status === 'completed') return SUC;
    if (a.status === 'confirmed') return WARN;
    if (a.type === 'primeira vez') return ACCENT;
    return P;
  }

  function handleStartConsult(appt: AppointmentRow) {
    const p = allPatients.find(p => p.id === appt.patient_id);
    if (p) {
      setActivePatient(p);
      db.updateAppointment(appt.id, { status: 'in_progress' }).catch(() => { toast.error('Erro ao iniciar consulta'); });
      onStartConsult(appt.type as 'retorno' | 'primeira vez', appt.id);
    }
    setSelectedAppt(null);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'none', border: `1px solid ${BO}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <CaretLeft size={14} color={MU} />
          </button>
          <h2 style={{ margin: 0, fontSize: isMobile ? 15 : 18, fontWeight: 600, fontFamily: '"Fraunces", Georgia, serif' }}>{weekLabel}</h2>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: 'none', border: `1px solid ${BO}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <CaretRight size={14} color={MU} />
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} style={{ background: 'none', border: `1px solid ${BO}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: MU, fontFamily: 'inherit' }}>Hoje</button>
          )}
        </div>
        <Btn onClick={() => { setNewModalDate(selectedDay); setShowNewModal(true); }}>
          <Plus size={14} /> {isMobile ? 'Novo' : 'Nova consulta'}
        </Btn>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: isMobile ? 10 : 16, marginBottom: 24 }}>
        <Card style={{ padding: isMobile ? 14 : '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MU, letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 8 }}>HOJE</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 32, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: INK, letterSpacing: '-0.02em' }}>{loading ? '—' : todayAppts.length}</span>
            <span style={{ fontSize: 13, color: MU }}>consultas</span>
          </div>
        </Card>
        <Card style={{ padding: isMobile ? 14 : '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MU, letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 8 }}>REALIZADAS</div>
          <span style={{ fontSize: 32, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: SUC, letterSpacing: '-0.02em' }}>{loading ? '—' : attendedCount}</span>
        </Card>
        <Card style={{ padding: isMobile ? 14 : '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MU, letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 8 }}>NA SALA DE ESPERA</div>
          <span style={{ fontSize: 32, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: waitingCount > 0 ? ACCENT : MU, letterSpacing: '-0.02em' }}>{loading ? '—' : waitingCount}</span>
        </Card>
        <Card style={{ padding: isMobile ? 14 : '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MU, letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 8 }}>AGUARDANDO</div>
          <span style={{ fontSize: 32, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: pending > 0 ? WARN : MU, letterSpacing: '-0.02em' }}>{loading ? '—' : pending}</span>
        </Card>
        <Card style={{ padding: isMobile ? 14 : '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MU, letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 8 }}>PRÓXIMA</div>
          {nextAppt ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: P }}>{nextAppt.time}</span>
              <span style={{ fontSize: 13, color: MU, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{nextAppt.patient_name.split(' ').slice(0, 2).join(' ')}</span>
            </div>
          ) : <span style={{ fontSize: 20, color: MU }}>—</span>}
        </Card>
      </div>

      {/* Weekly grid (desktop) / Day list (mobile) */}
      {!isMobile ? (
        <Card style={{ overflow: 'hidden' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(5, 1fr)', borderBottom: `1px solid ${BO}` }}>
            <div style={{ borderRight: `1px solid ${BO}` }} />
            {gridDays.map(({ date, short, day }, i) => {
              const isToday = date === todayIso;
              const cnt = (apptsByDate[date] || []).length;
              return (
                <div key={date} style={{ padding: '14px 16px', borderRight: i < 4 ? `1px solid ${BO}` : 'none', background: isToday ? PL : 'transparent', cursor: 'pointer' }}
                  onClick={() => { setNewModalDate(date); setShowNewModal(true); }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? P : MU, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{short}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: isToday ? P : 'transparent', color: isToday ? '#fff' : INK, fontSize: 18, fontWeight: isToday ? 700 : 600, marginTop: 4 }}>{day}</div>
                  {cnt > 0 && <div style={{ fontSize: 11, color: isToday ? P : MU, marginTop: 4 }}>{cnt} consulta{cnt > 1 ? 's' : ''}</div>}
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' as const, color: MU, fontSize: 13 }}>Carregando agenda…</div>
          ) : allTimes.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' as const }}>
              <CalendarBlank size={36} color={BO} style={{ display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600, color: INK, marginBottom: 6 }}>Nenhuma consulta esta semana</div>
              <div style={{ fontSize: 13, color: MU, marginBottom: 20 }}>Clique em um dia ou no botão para adicionar</div>
              <Btn onClick={() => setShowNewModal(true)}><Plus size={14} /> Nova consulta</Btn>
            </div>
          ) : allTimes.map((time, ti) => (
            <div key={time} style={{ display: 'grid', gridTemplateColumns: '64px repeat(5, 1fr)', borderBottom: ti < allTimes.length - 1 ? `1px solid ${BO}` : 'none', minHeight: 80 }}>
              <div style={{ padding: '16px 8px', borderRight: `1px solid ${BO}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: MU, fontWeight: 600 }}>{time}</span>
              </div>
              {gridDays.map(({ date }, ci) => {
                const appt = (apptsByDate[date] || []).find(a => a.time === time);
                const isToday = date === todayIso;
                return (
                  <div key={date} style={{ borderRight: ci < 4 ? `1px solid ${BO}` : 'none', padding: 8, background: isToday ? `${PL}60` : 'transparent' }}>
                    {appt && (
                      <div style={{ borderRadius: 8, padding: '8px 12px', background: apptBg(appt), borderLeft: `3px solid ${apptBorder(appt)}`, minHeight: 60, boxSizing: 'border-box' as const, transition: 'opacity 0.1s', cursor: 'pointer' }}
                        onClick={() => setSelectedAppt(appt)}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: INK }}>{appt.patient_name} · {appt.age}</div>
                        <div style={{ fontSize: 11, color: MU, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {appt.chief_complaint || appt.type}
                        </div>
                        {appt.status === 'completed' && (
                          <div style={{ fontSize: 10, color: SUC, fontWeight: 600, marginTop: 2 }}>✓ realizada</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </Card>
      ) : (
        /* Mobile: day tabs + list */
        <div>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {weekDays.map(({ date, short, day }, i) => {
                const cnt = (apptsByDate[date] || []).length;
                const isToday = date === todayIso;
                const isSel = date === selectedDay;
                return (
                  <button key={date} onClick={() => setSelectedDay(date)} style={{ padding: '10px 4px', background: isSel ? PL : 'transparent', border: 'none', borderBottom: isSel ? `2px solid ${P}` : '2px solid transparent', borderRight: i < 6 ? `1px solid ${BO}` : 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: isSel ? P : MU, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 4 }}>{short}</div>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px', background: isToday ? P : 'transparent', color: isToday ? '#fff' : INK, fontWeight: isToday ? 700 : 600, fontSize: 13 }}>{day}</div>
                    {cnt > 0 ? <span style={{ fontSize: 9, background: isSel ? P : BO, color: isSel ? '#fff' : MU, borderRadius: 99, padding: '1px 4px', fontWeight: 600 }}>{cnt}</span> : <span style={{ fontSize: 10, color: BO }}>·</span>}
                  </button>
                );
              })}
            </div>
          </Card>
          <Card>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' as const, color: MU, fontSize: 13 }}>Carregando…</div>
            ) : (apptsByDate[selectedDay] || []).length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' as const, color: MU }}>
                <CalendarBlank size={28} color={BO} style={{ display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Sem consultas</div>
                <Btn size="sm" style={{ marginTop: 8 }} onClick={() => { setNewModalDate(selectedDay); setShowNewModal(true); }}><Plus size={13} /> Adicionar</Btn>
              </div>
            ) : (apptsByDate[selectedDay] || []).map((appt, i, arr) => (
              <div key={appt.id} onClick={() => setSelectedAppt(appt)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${BO}` : 'none', cursor: 'pointer', background: 'transparent', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = PL}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <div style={{ width: 4, height: 36, borderRadius: 2, background: apptBorder(appt), flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: P, fontFamily: '"JetBrains Mono", monospace', width: 44, flexShrink: 0 }}>{appt.time}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{appt.patient_name}</div>
                  <div style={{ fontSize: 12, color: MU }}>{appt.age} · {appt.chief_complaint || appt.type}</div>
                </div>
                {appt.status === 'completed' && <Badge color={SUC} bg={SUCL}><CheckCircle size={10} /></Badge>}
                {appt.status === 'confirmed' && <Badge color={WARN} bg={WARNL}><Clock size={10} /></Badge>}
                {appt.status === 'in_progress' && <Badge color={P} bg={PL}><Heartbeat size={10} /></Badge>}
              </div>
            ))}
          </Card>
        </div>
      )}

      {showNewModal && <NewAppointmentModal defaultDate={newModalDate} onClose={() => setShowNewModal(false)} onSaved={() => { setShowNewModal(false); loadWeek(); }} />}
      {selectedAppt && <AppointmentDetailModal appt={selectedAppt} onClose={() => setSelectedAppt(null)} onUpdate={() => { setSelectedAppt(null); loadWeek(); }} onStartConsult={handleStartConsult} />}
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

function SettingsPage({ user }: { user: SupabaseUser | null }) {
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
      await db.updateProfile({ full_name: fullName, crm, phone });
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

  const { isDoctor: settingsIsDoctor } = useAuthProfile();
  const sections = [
    { id: 'perfil',       label: 'Perfil do médico',  icon: User },
    { id: 'consultorio',  label: 'Consultório',        icon: Buildings },
    { id: 'notificacoes', label: 'Notificações',       icon: Bell },
    { id: 'gravacao',     label: 'Gravação e IA',      icon: Brain },
    ...(settingsIsDoctor ? [{ id: 'equipe', label: 'Equipe e Acessos', icon: UsersThree }] : []),
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
                  <div style={{ width: '100%', padding: '10px 12px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 14, background: SEC, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' as const, gap: 8 }}>
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, minWidth: 0, flex: 1 }}>{specialty || '—'}</span>
                    <span style={{ fontSize: 11, color: MU, flexShrink: 0 }}>definido no cadastro</span>
                  </div>
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

          {section === 'equipe' && settingsIsDoctor && <TeamSection />}
          </div>
        </div>

    </div>
  );
}

// ─── PAINEL DO CONSULTÓRIO ─────────────────────────────────────────────────────
function MetricCard({ label, value, sub, subColor, footer }: { label: string; value: string | number; sub?: string; subColor?: string; footer?: React.ReactNode }) {
  return (
    <Card style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, color: MU, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: INK, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: subColor || MU, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>{sub}</div>}
      {footer && <div style={{ marginTop: 4 }}>{footer}</div>}
    </Card>
  );
}

function BlockHeader({ icon: Icon, title }: { icon: IconComponent; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <Icon size={17} color={P} />
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: INK, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em' }}>{title}</h2>
    </div>
  );
}

function PainelPage({ go, setActivePatient }: { go: (s: string) => void; setActivePatient: (p: Patient) => void }) {
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<import('./lib/db').ClinicPanelData | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    db.fetchClinicPanelData(period)
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  // ── Computed metrics ───────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const completedInPeriod = (data?.periodConsults || []).filter(c => c.status === 'completed');
  const pastScheduledInPeriod = (data?.periodConsults || []).filter(c => c.status === 'scheduled' && c.date < todayStr);
  const totalPastScheduled = completedInPeriod.length + pastScheduledInPeriod.length;
  const noShowRate = totalPastScheduled > 0 ? Math.round(pastScheduledInPeriod.length / totalPastScheduled * 100) : 0;
  const attendanceRate = 100 - noShowRate;

  const prevCount = data?.prevConsults.length || 0;
  const currentCount = completedInPeriod.length;
  const consultDelta = prevCount > 0 ? Math.round((currentCount - prevCount) / prevCount * 100) : null;

  const uniquePatientIds = new Set(completedInPeriod.map(c => c.patient_id));
  const uniquePatientCount = uniquePatientIds.size;
  const firstTimers = completedInPeriod.filter(c => c.type === 'primeira vez');
  const retornos = completedInPeriod.filter(c => c.type === 'retorno');
  const avgPerDay = period === 1 ? currentCount : Math.round(currentCount / period * 10) / 10;

  // Retention
  const allConsultsByPatient: Record<string, string[]> = {};
  (data?.allConsults || []).forEach(c => {
    if (!allConsultsByPatient[c.patient_id]) allConsultsByPatient[c.patient_id] = [];
    allConsultsByPatient[c.patient_id].push(c.date);
  });
  let returningInPeriod = 0;
  uniquePatientIds.forEach(pid => {
    const history = allConsultsByPatient[pid] || [];
    if (history.some(d => d < (data?.periodStart || todayStr))) returningInPeriod++;
  });
  const retentionRate = uniquePatientCount > 0 ? Math.round(returningInPeriod / uniquePatientCount * 100) : 0;

  // Patients seen before period but not in period
  const patientsSeenBeforePeriod = Object.entries(allConsultsByPatient)
    .filter(([pid, dates]) => dates.some(d => d < (data?.periodStart || todayStr)) && !uniquePatientIds.has(pid));

  // Average days between consultations
  let totalAvgDays = 0, multiCount = 0;
  Object.values(allConsultsByPatient).forEach(dates => {
    if (dates.length < 2) return;
    const sorted = [...dates].sort();
    let sum = 0;
    for (let i = 1; i < sorted.length; i++) sum += (new Date(sorted[i]).getTime() - new Date(sorted[i-1]).getTime()) / 86400000;
    totalAvgDays += sum / (sorted.length - 1);
    multiCount++;
  });
  const avgDaysBetween = multiCount > 0 ? Math.round(totalAvgDays / multiCount) : null;

  // Vaccination rates
  const overdueVaccPatients: { id: string; full_name: string }[] = [];
  let vaccOkCount = 0;
  (data?.patients || []).forEach(p => {
    const bd = new Date(p.birth_date);
    const ageMonths = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
    const patVacc = (data?.allVaccines || []).filter(v => v.patient_id === p.id);
    const overdue = PNI_SCHEDULE.filter(pni => {
      const done = patVacc.find(v => v.name === pni.name && v.dose === pni.dose && v.status === 'done');
      return !done && pni.age_months < ageMonths; // strict: vacinas do mês atual ainda estão no prazo
    });
    if (overdue.length > 0) overdueVaccPatients.push({ id: p.id, full_name: p.full_name });
    else vaccOkCount++;
  });
  const totalPatients = data?.patients.length || 0;
  const vaccOkRate = totalPatients > 0 ? Math.round(vaccOkCount / totalPatients * 100) : 0;

  // New patients in period
  const newPatientsInPeriod = (data?.patients || []).filter(p => p.created_at >= (data?.periodStart || todayStr));

  // Bar chart: consultations per day
  const chartData: { label: string; total: number }[] = [];
  if (period > 1 && data) {
    const dateMap: Record<string, number> = {};
    completedInPeriod.forEach(c => { dateMap[c.date] = (dateMap[c.date] || 0) + 1; });
    const startDate = new Date(data.periodStart);
    const endDate = new Date(todayStr);
    for (const d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      const [, m, day] = ds.split('-');
      chartData.push({ label: `${day}/${m}`, total: dateMap[ds] || 0 });
    }
  }

  // Patients without return list (last seen, sorted oldest first)
  const patientsWithoutReturn = patientsSeenBeforePeriod
    .map(([pid, dates]) => {
      const sorted = [...dates].sort().reverse();
      const patient = (data?.patients || []).find(p => p.id === pid);
      return patient ? { patient, lastDate: sorted[0] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a!.lastDate < b!.lastDate ? -1 : 1))
    .slice(0, 5) as { patient: { id: string; full_name: string; birth_date: string; created_at: string }; lastDate: string }[];

  // Insights
  type Insight = { color: string; bg: string; icon: IconComponent; text: string; action?: { label: string; fn: () => void } };
  const insights: Insight[] = [];
  if (consultDelta !== null && consultDelta <= -10) insights.push({ color: DES, bg: DESL, icon: ArrowDown, text: `Consultas caíram ${Math.abs(consultDelta)}% em relação ao período anterior.` });
  else if (consultDelta !== null && consultDelta >= 10) insights.push({ color: SUC, bg: SUCL, icon: ArrowUp, text: `Consultas cresceram ${consultDelta}% em relação ao período anterior.` });
  if (overdueVaccPatients.length > 0) insights.push({ color: WARN, bg: WARNL, icon: Syringe, text: `${overdueVaccPatients.length} paciente${overdueVaccPatients.length > 1 ? 's' : ''} com vacinas em atraso no calendário PNI.`, action: { label: 'Ver pacientes', fn: () => go('patients') } });
  if (patientsWithoutReturn.length > 0) insights.push({ color: WARN, bg: WARNL, icon: Users, text: `${patientsWithoutReturn.length} paciente${patientsWithoutReturn.length > 1 ? 's' : ''} não retornou no período selecionado.`, action: { label: 'Ver lista abaixo', fn: () => {} } });
  if (noShowRate > 20) insights.push({ color: DES, bg: DESL, icon: Warning, text: `Taxa de faltas de ${noShowRate}% — considere confirmar agendamentos por mensagem.` });
  if (newPatientsInPeriod.length > 0) insights.push({ color: SUC, bg: SUCL, icon: CheckCircle, text: `${newPatientsInPeriod.length} novo${newPatientsInPeriod.length > 1 ? 's' : ''} paciente${newPatientsInPeriod.length > 1 ? 's' : ''} cadastrado${newPatientsInPeriod.length > 1 ? 's' : ''} no período.` });
  if (retentionRate < 50 && uniquePatientCount > 3) insights.push({ color: WARN, bg: WARNL, icon: ArrowDown, text: `Retorno de pacientes baixo (${retentionRate}%) — verifique se há agendamentos de retorno pendentes.` });
  const shownInsights = insights.slice(0, 5);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const periodLabel = period === 1 ? 'hoje' : `últimos ${period} dias`;
  const deltaColor = (d: number | null, goodIsPositive = true) => {
    if (d === null) return MU;
    return (goodIsPositive ? d >= 0 : d <= 0) ? SUC : DES;
  };
  const deltaIcon = (d: number | null) => d !== null && d >= 0 ? ArrowUp : ArrowDown;
  // MetricCard and BlockHeader are defined at module scope above PainelPage

  // ── Render ─────────────────────────────────────────────────────────────────
  const periodOptions = [
    { label: 'Hoje', value: 1 },
    { label: '7 dias', value: 7 },
    { label: '30 dias', value: 30 },
    { label: '90 dias', value: 90 },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 14, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 600, color: INK, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.02em' }}>
            Painel do consultório
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: MU }}>Visão geral do desempenho e saúde dos pacientes — {periodLabel}</p>
        </div>
        {/* Period filter */}
        <div style={{ display: 'flex', background: SEC, borderRadius: 8, padding: 3, gap: 2, flexShrink: 0 }}>
          {periodOptions.map(opt => (
            <button key={opt.value} onClick={() => setPeriod(opt.value)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', transition: 'all 0.15s', background: period === opt.value ? '#fff' : 'transparent', color: period === opt.value ? P : MU, boxShadow: period === opt.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: MU, gap: 10 }}>
          <Clock size={20} />
          <span style={{ fontSize: 14 }}>Carregando dados...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── 1. Summary cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12 }}>
            <MetricCard
              label="Consultas"
              value={currentCount}
              sub={consultDelta !== null ? `${consultDelta >= 0 ? '↑' : '↓'} ${Math.abs(consultDelta)}% vs anterior` : 'sem dados anteriores'}
              subColor={deltaColor(consultDelta)}
            />
            <MetricCard
              label="Pacientes únicos"
              value={uniquePatientCount}
              sub={firstTimers.length > 0 ? `${firstTimers.length} primeiras consultas` : undefined}
            />
            <MetricCard
              label="Retorno"
              value={`${retentionRate}%`}
              sub={retentionRate >= 60 ? '✓ bom nível' : retentionRate >= 40 ? '⚠ atenção' : '↓ baixo'}
              subColor={retentionRate >= 60 ? SUC : retentionRate >= 40 ? WARN : DES}
            />
            <MetricCard
              label="Vacinação em dia"
              value={`${vaccOkRate}%`}
              sub={vaccOkRate >= 80 ? '✓ bom nível' : vaccOkRate >= 60 ? '⚠ atenção' : '↓ atenção necessária'}
              subColor={vaccOkRate >= 80 ? SUC : vaccOkRate >= 60 ? WARN : DES}
            />
          </div>

          {/* ── 2. Operação + Gráfico ── */}
          <Card>
            <div style={{ padding: '18px 20px 0' }}>
              <BlockHeader icon={CalendarBlank} title="Operação do consultório" />
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 0, borderTop: `1px solid ${BO}`, borderLeft: `1px solid ${BO}` }}>
                {[
                  { label: 'Consultas realizadas', value: currentCount },
                  { label: `Média por ${period === 1 ? 'turno' : 'dia'}`, value: avgPerDay },
                  { label: 'Comparecimento', value: totalPastScheduled > 0 ? `${attendanceRate}%` : '—' },
                  { label: 'Faltas', value: totalPastScheduled > 0 ? `${noShowRate}%` : '—' },
                ].map((s, i) => (
                  <div key={i} style={{ padding: '14px 18px', borderRight: `1px solid ${BO}`, borderBottom: `1px solid ${BO}` }}>
                    <div style={{ fontSize: 11, color: MU, fontWeight: 500, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: INK, fontFamily: '"JetBrains Mono", monospace' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
            {chartData.length > 1 && (
              <div style={{ padding: '16px 20px 20px' }}>
                <div style={{ fontSize: 12, color: MU, marginBottom: 10 }}>Consultas por dia</div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: MU }} tickLine={false} axisLine={false} interval={period <= 7 ? 0 : Math.floor(chartData.length / 7)} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: MU }} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                    <Tooltip formatter={(v: any) => [v, 'Consultas']} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${BO}` }} />
                    <Bar dataKey="total" fill={P} radius={[3, 3, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* ── 3. Retenção + 4. Qualidade (side by side on desktop) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

            {/* Retenção */}
            <Card style={{ padding: '18px 20px' }}>
              <BlockHeader icon={Users} title="Acompanhamento dos pacientes" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Retorno no período', value: `${retentionRate}%`, color: retentionRate >= 60 ? SUC : retentionRate >= 40 ? WARN : DES },
                  { label: 'Retornos realizados', value: returningInPeriod },
                  { label: 'Não retornaram', value: patientsSeenBeforePeriod.length, color: patientsSeenBeforePeriod.length > 0 ? WARN : SUC },
                  { label: 'Média entre consultas', value: avgDaysBetween ? `${avgDaysBetween} dias` : '—' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 3 ? `1px solid ${BO}` : 'none' }}>
                    <span style={{ fontSize: 13, color: MU }}>{row.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: (row as any).color || INK, fontFamily: '"JetBrains Mono", monospace' }}>{row.value}</span>
                  </div>
                ))}
              </div>
              {patientsWithoutReturn.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: MU, textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 8 }}>Não retornaram</div>
                  {patientsWithoutReturn.map(({ patient, lastDate }) => (
                    <div key={patient.id}
                      onClick={() => { setActivePatient(patient as unknown as Patient); go('patient-detail'); }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 3 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = PL}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{patient.full_name}</span>
                      <span style={{ fontSize: 12, color: MU }}>Última: {fmtDate(lastDate)}</span>
                    </div>
                  ))}
                </>
              )}
            </Card>

            {/* Qualidade clínica */}
            <Card style={{ padding: '18px 20px' }}>
              <BlockHeader icon={Syringe} title="Qualidade do acompanhamento" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Vacinação em dia', value: `${vaccOkCount} pacientes`, sub: `${vaccOkRate}%`, color: vaccOkRate >= 80 ? SUC : WARN },
                  { label: 'Vacinação em atraso', value: `${overdueVaccPatients.length} pacientes`, sub: `${100 - vaccOkRate}%`, color: overdueVaccPatients.length > 0 ? DES : SUC },
                  { label: 'Total de pacientes ativos', value: `${totalPatients}`, color: INK },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 2 ? `1px solid ${BO}` : 'none' }}>
                    <span style={{ fontSize: 13, color: MU }}>{row.label}</span>
                    <div style={{ textAlign: 'right' as const }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: row.color || INK }}>{row.value}</span>
                      {row.sub && <span style={{ fontSize: 12, color: MU, marginLeft: 6 }}>({row.sub})</span>}
                    </div>
                  </div>
                ))}
              </div>
              {/* Vaccine bar */}
              {totalPatients > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: MU, marginBottom: 6 }}>Distribuição de vacinação</div>
                  <div style={{ height: 10, borderRadius: 99, background: DESL, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${vaccOkRate}%`, background: SUC, borderRadius: '99px 0 0 99px', transition: 'width 0.5s' }} />
                    <div style={{ flex: 1, background: DES, borderRadius: '0 99px 99px 0' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: SUC }} /><span style={{ fontSize: 11, color: MU }}>Em dia ({vaccOkRate}%)</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: DES }} /><span style={{ fontSize: 11, color: MU }}>Em atraso ({100 - vaccOkRate}%)</span></div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* ── 5. Crescimento ── */}
          <Card style={{ padding: '18px 20px' }}>
            <BlockHeader icon={TrendUp} title="Crescimento" />
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 0, border: `1px solid ${BO}`, borderRadius: 8, overflow: 'hidden' }}>
              {[
                { label: 'Novos pacientes', value: newPatientsInPeriod.length, hint: 'no período' },
                { label: 'Primeiras consultas', value: firstTimers.length, hint: 'no período' },
                { label: 'Retornos', value: retornos.length, hint: 'no período' },
                { label: 'Base total', value: totalPatients, hint: 'pacientes ativos' },
              ].map((s, i) => (
                <div key={i} style={{ padding: '14px 18px', borderRight: i < 3 ? `1px solid ${BO}` : 'none', ...(isMobile && i >= 2 ? { borderTop: `1px solid ${BO}` } : {}) }}>
                  <div style={{ fontSize: 11, color: MU, fontWeight: 500, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: INK, fontFamily: '"JetBrains Mono", monospace' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: MU, marginTop: 2 }}>{s.hint}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* ── 6. Insights ── */}
          {shownInsights.length > 0 && (
            <Card style={{ padding: '18px 20px' }}>
              <BlockHeader icon={Lightbulb} title="O que precisa de atenção" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {shownInsights.map((ins, i) => {
                  const Icon = ins.icon;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: ins.bg, borderRadius: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ins.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={16} color={ins.color} />
                      </div>
                      <span style={{ flex: 1, fontSize: 13, color: INK, lineHeight: 1.4 }}>{ins.text}</span>
                      {ins.action && (
                        <button onClick={ins.action.fn}
                          style={{ background: 'none', border: `1px solid ${ins.color}40`, borderRadius: 5, padding: '4px 10px', fontSize: 12, color: ins.color, cursor: 'pointer', whiteSpace: 'nowrap' as const, fontFamily: 'inherit', fontWeight: 500 }}>
                          {ins.action.label} <ArrowRight size={10} style={{ verticalAlign: 'middle' }} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {shownInsights.length === 0 && (
            <Card style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircle size={20} color={SUC} />
              <span style={{ fontSize: 14, color: MU }}>Nenhum ponto crítico identificado no período. Continue assim!</span>
            </Card>
          )}

        </div>
      )}
    </div>
  );
}

// ─── ADMIN PAGE ──────────────────────────────────────────────────────────────

type AdminFilter = 'all' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
type AdminSort  = 'name' | 'consults' | 'cost' | 'last_active';

function AdminStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ fontSize: 11, color: MU, fontWeight: 500 }}>Sem plano</span>;
  const map: Record<string, { label: string; color: string; bg: string }> = {
    active:   { label: 'Ativo',       color: SUC,  bg: SUCL  },
    trialing: { label: 'Trial',       color: P,    bg: PL    },
    past_due: { label: 'Inadimplente',color: WARN, bg: WARNL },
    canceled: { label: 'Cancelado',   color: MU,   bg: SEC   },
    incomplete:{ label: 'Incompleto', color: MU,   bg: SEC   },
    unpaid:   { label: 'Não pago',    color: DES,  bg: DESL  },
  };
  const s = map[status] ?? { label: status, color: MU, bg: SEC };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 5, padding: '2px 7px' }}>
      {s.label}
    </span>
  );
}

function AdminStatsCard({ label, value, sub, subColor }: { label: string; value: string | number; sub?: string; subColor?: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BO}`, borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: INK, fontFamily: '"Fraunces", serif', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: subColor ?? MU, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── AdminChartsSection — evolução temporal do SaaS ───────────────────────────

function AdminChartsSection({ period }: { period: number }) {
  const isMobile = useIsMobile();
  const [chartData, setChartData]       = useState<db.AdminChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    setChartLoading(true);
    db.fetchAdminChartData(period)
      .then(setChartData)
      .catch(() => setChartData([]))
      .finally(() => setChartLoading(false));
  }, [period]);

  const axisStyle = { fontSize: 10, fill: MU };
  const gridProps = { strokeDasharray: '3 3' as const, stroke: BO, vertical: false };
  const tooltipStyle = { fontSize: 12, borderRadius: 6, border: `1px solid ${BO}`, fontFamily: 'Inter, sans-serif' };

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Header da seção */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Evolução</div>
        <div style={{ fontSize: 12, color: MU }}>Série temporal · últimos {period} {period === 1 ? 'mês' : 'meses'}</div>
      </div>

      {chartLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: MU, fontSize: 13 }}>
          Carregando…
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
          gap: 16,
        }}>
          {/* Gráfico 1 — Consultas por Mês */}
          <div style={{ background: '#fff', border: `1px solid ${BO}`, borderRadius: 10, padding: '16px 16px 8px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 12 }}>
              Consultas / mês
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) => [v, name === 'consults_total' ? 'Total' : 'Com IA']}
                />
                <Area
                  type="monotone" dataKey="consults_total" name="consults_total"
                  stroke={P} fill={PL} strokeWidth={2}
                  dot={false} isAnimationActive={false}
                />
                <Area
                  type="monotone" dataKey="consults_ai" name="consults_ai"
                  stroke={DES} fill={DESL} strokeWidth={2}
                  dot={false} isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 10, color: P, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 2, background: P, display: 'inline-block', borderRadius: 1 }} />
                Total
              </span>
              <span style={{ fontSize: 10, color: DES, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 2, background: DES, display: 'inline-block', borderRadius: 1 }} />
                Com IA
              </span>
            </div>
          </div>

          {/* Gráfico 2 — Novos Médicos por Mês */}
          <div style={{ background: '#fff', border: `1px solid ${BO}`, borderRadius: 10, padding: '16px 16px 8px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 12 }}>
              Novos médicos / mês
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [v, 'Novos médicos']}
                />
                <Bar dataKey="new_doctors" fill={P} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico 3 — Custo IA por Mês */}
          <div style={{ background: '#fff', border: `1px solid ${BO}`, borderRadius: 10, padding: '16px 16px 8px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 12 }}>
              Custo IA estimado / mês
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false}
                  tickFormatter={(v: number) => `R$${v}`} width={42} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Custo IA']}
                />
                <Bar dataKey="ai_cost_brl" fill={WARN} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 10, color: MU, marginTop: 6, textAlign: 'right' as const }}>
              ≈ R$0,80/consulta transcrita
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type PeriodPreset = 'hoje' | '3M' | '6M' | '12M' | 'custom';

function computeDateRange(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string,
): { from: string; to: string; chartMonths: number } {
  const now = new Date();
  const toISO = now.toISOString();
  if (preset === 'hoje') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    return { from, to: toISO, chartMonths: 1 };
  }
  if (preset !== 'custom') {
    const months = preset === '3M' ? 3 : preset === '6M' ? 6 : 12;
    const from = new Date(now.getFullYear(), now.getMonth() - months, 1).toISOString();
    return { from, to: toISO, chartMonths: months };
  }
  const f = customFrom || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const t = customTo   || toISO;
  const diffMs = new Date(t).getTime() - new Date(f).getTime();
  const chartMonths = Math.max(1, Math.min(12, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30))));
  return { from: f, to: t, chartMonths };
}

function AdminPage({ go: _go }: { go: (s: string) => void }) {
  const [doctors, setDoctors]       = useState<db.AdminDoctorRow[]>([]);
  const [stats, setStats]           = useState<db.AdminStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<AdminFilter>('all');
  const [search, setSearch]         = useState('');
  const [sortBy, setSortBy]         = useState<AdminSort>('last_active');
  const [actionTarget, setActionTarget] = useState<{ id: string; top: number; right: number } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [preset, setPreset]           = useState<PeriodPreset>('3M');
  const [customFrom, setCustomFrom]   = useState('');
  const [customTo,   setCustomTo]     = useState('');
  const dateRange = useMemo(
    () => computeDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const load = async (range: { from: string; to: string } = dateRange) => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([db.fetchAllDoctorsAdmin(range), db.fetchAdminStats(range)]);
      setDoctors(d);
      setStats({ ...s, total_patients: d.reduce((sum, doc) => sum + doc.patient_count, 0) });
    } catch {
      toast.error('Erro ao carregar dados de admin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(dateRange); }, [dateRange]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!actionTarget) return;
    const handler = () => setActionTarget(null);
    document.addEventListener('mousedown', handler);
    // Fecha ao scroll (dropdown é fixed, ficaria deslocado ao rolar)
    window.addEventListener('scroll', handler, { passive: true, capture: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', handler, { capture: true });
    };
  }, [actionTarget]);

  const filtered = doctors.filter(d => {
    if (filter === 'none' && d.subscription.status) return false;
    if (filter !== 'all' && filter !== 'none' && d.subscription.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.full_name.toLowerCase().includes(q) || d.crm.toLowerCase().includes(q) || d.email.toLowerCase().includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name')    return a.full_name.localeCompare(b.full_name);
    if (sortBy === 'consults')return b.consults_this_month - a.consults_this_month;
    if (sortBy === 'cost')    return b.estimated_ai_cost_brl - a.estimated_ai_cost_brl;
    // last_active (default)
    if (!a.last_consultation_at) return 1;
    if (!b.last_consultation_at) return -1;
    return new Date(b.last_consultation_at).getTime() - new Date(a.last_consultation_at).getTime();
  });

  async function doAction(doctorId: string, action: string) {
    setActionLoading(true);
    try {
      if (action === 'activate')  await db.adminUpdateSubscription(doctorId, { status: 'active' });
      if (action === 'suspend')   await db.adminSuspendDoctor(doctorId);
      if (action === 'trial7')    await db.adminExtendTrial(doctorId, 7);
      if (action === 'trial30')   await db.adminExtendTrial(doctorId, 30);
      if (action === 'essencial') await db.adminUpdateSubscription(doctorId, { plan: 'essencial', status: 'active' });
      if (action === 'pro')       await db.adminUpdateSubscription(doctorId, { plan: 'pro', status: 'active' });
      toast.success('Assinatura atualizada');
      setActionTarget(null);
      load();
    } catch {
      toast.error('Erro ao atualizar assinatura');
    } finally {
      setActionLoading(false);
    }
  }

  const filterOptions: Array<[AdminFilter, string]> = [
    ['all','Todos'], ['active','Ativo'], ['trialing','Trial'],
    ['past_due','Inadimplente'], ['canceled','Cancelado'], ['none','Sem plano'],
  ];

  const isMobile = useIsMobile();

  function fmtLastActive(d: string | null) {
    if (!d) return 'Nunca';
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    if (diff < 30)  return `${diff}d atrás`;
    return fmtDate(d.slice(0, 10));
  }

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 16, flexWrap: 'wrap' as const }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: INK, fontFamily: '"Fraunces", serif', letterSpacing: '-0.5px' }}>
            Gestão de Assinantes
          </div>
          <div style={{ fontSize: 13, color: MU, marginTop: 3 }}>
            Visão operacional do SaaS ·{' '}
            {preset === 'hoje' ? 'Hoje' : preset === 'custom' ? 'Período personalizado' : `Últimos ${preset}`}
          </div>
        </div>
        <Btn variant="secondary" onClick={() => load()} disabled={loading} style={{ flexShrink: 0 }}>
          <ArrowCounterClockwise size={14} /> {loading ? 'Carregando…' : 'Atualizar'}
        </Btn>
      </div>

      {/* Filtro de período global */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' as const }}>
        {(['hoje', '3M', '6M', '12M', 'custom'] as PeriodPreset[]).map(p => (
          <button key={p} onClick={() => setPreset(p)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${preset === p ? P : BO}`,
              background: preset === p ? P : '#fff',
              color: preset === p ? '#fff' : MU,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
            }}>
            {p === 'custom' ? 'Personalizado' : p === 'hoje' ? 'Hoje' : p}
          </button>
        ))}
        {preset === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ padding: '5px 8px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', color: INK, background: '#fff', outline: 'none' }} />
            <span style={{ fontSize: 12, color: MU }}>até</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ padding: '5px 8px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', color: INK, background: '#fff', outline: 'none' }} />
          </>
        )}
      </div>

      {/* Stats cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          <AdminStatsCard
            label="Médicos"
            value={stats.total_doctors}
            sub={`${stats.active} ativo${stats.active !== 1 ? 's' : ''} · ${stats.trialing} trial${stats.trialing !== 1 ? 's' : ''} · ${stats.past_due} inadimp.`}
          />
          <AdminStatsCard
            label="MRR"
            value={`R$ ${stats.mrr_brl.toLocaleString('pt-BR')}/mês`}
            sub={`Essencial R$${stats.mrr_essencial} · Pro R$${stats.mrr_pro}`}
            subColor={stats.mrr_brl > 0 ? SUC : MU}
          />
          <AdminStatsCard
            label="Consultas no período"
            value={stats.total_consults_this_month}
            sub={`${stats.total_ai_consults_this_month} com IA · ${stats.total_patients} pacientes total`}
          />
          <AdminStatsCard
            label="Custo IA estimado"
            value={`R$ ${stats.estimated_total_ai_cost_brl.toFixed(2)}`}
            sub={`≈ R$0,80/consulta transcrita`}
            subColor={stats.estimated_total_ai_cost_brl > 50 ? WARN : MU}
          />
        </div>
      )}

      {/* Analytics — evolução temporal */}
      <AdminChartsSection period={dateRange.chartMonths} />

      {/* Filters + search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, CRM ou email…"
          style={{ padding: '8px 12px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: INK, width: 240, flexShrink: 0 }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {filterOptions.map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1.5px solid ${filter === v ? P : BO}`, background: filter === v ? PL : '#fff', color: filter === v ? P : MU, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: MU }}>Ordenar por</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as AdminSort)}
            style={{ padding: '6px 10px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: '#fff', color: INK, outline: 'none', cursor: 'pointer' }}>
            <option value="last_active">Última atividade</option>
            <option value="consults">Consultas/mês</option>
            <option value="cost">Custo IA</option>
            <option value="name">Nome</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 56, textAlign: 'center' as const, color: MU, fontSize: 14 }}>Carregando assinantes…</div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: 56, textAlign: 'center' as const, color: MU, fontSize: 14 }}>Nenhum médico encontrado</div>
      ) : (
        <div style={{ background: '#fff', border: `1px solid ${BO}`, borderRadius: 12, overflow: 'hidden' }}>
          {/* Table header */}
          {!isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.7fr 1fr 1fr 1fr 1fr', gap: 0, padding: '10px 18px', borderBottom: `1px solid ${BO}`, background: BG }}>
              {['Médico', 'CRM', 'Plano', 'Status', 'Pacientes', 'Consultas/mês', 'IA/mês', 'Custo IA', 'Ações'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>{h}</div>
              ))}
            </div>
          )}
          {/* Table rows */}
          {sorted.map((d, i) => (
            <div key={d.id}
              style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.7fr 1fr 1fr 1fr 1fr', gap: 0, padding: isMobile ? '14px 16px' : '12px 18px', borderBottom: i < sorted.length - 1 ? `1px solid ${BO}` : 'none', alignItems: 'center' }}>
              {/* Médico */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: INK }}>{d.full_name || '—'}</div>
                <div style={{ fontSize: 11, color: MU, marginTop: 1 }}>{d.email}</div>
                {isMobile && <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                  <AdminStatusBadge status={d.subscription.status} />
                  <span style={{ fontSize: 11, color: MU }}>{d.specialty ?? '—'}</span>
                </div>}
              </div>
              {!isMobile && <>
                {/* CRM */}
                <div style={{ fontSize: 12, color: MU }}>{d.crm || '—'}</div>
                {/* Plano */}
                <div style={{ fontSize: 12, color: d.subscription.plan ? INK : MU, fontWeight: d.subscription.plan ? 600 : 400, textTransform: 'capitalize' as const }}>
                  {d.subscription.plan ?? '—'}
                </div>
                {/* Status */}
                <div><AdminStatusBadge status={d.subscription.status} /></div>
                {/* Pacientes */}
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{d.patient_count}</div>
                {/* Consultas/mês */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{d.consults_this_month}</div>
                  <div style={{ fontSize: 10, color: MU }}>{d.consults_total} total</div>
                </div>
                {/* IA/mês */}
                <div style={{ fontSize: 13, color: d.consults_ai_this_month > 0 ? INK : MU, fontWeight: d.consults_ai_this_month > 0 ? 600 : 400 }}>
                  {d.consults_ai_this_month}
                </div>
                {/* Custo IA */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: d.estimated_ai_cost_brl > 10 ? WARN : INK }}>
                    R$ {d.estimated_ai_cost_brl.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: MU }}>{fmtLastActive(d.last_consultation_at)}</div>
                </div>
                {/* Ações */}
                <div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (actionTarget?.id === d.id) { setActionTarget(null); return; }
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setActionTarget({ id: d.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                    }}
                    style={{ padding: '5px 10px', border: `1px solid ${BO}`, borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, color: MU, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                    ··· <CaretDown size={11} />
                  </button>
                  {actionTarget?.id === d.id && (
                    <div onMouseDown={e => e.stopPropagation()}
                      style={{ position: 'fixed' as const, top: actionTarget.top, right: actionTarget.right, zIndex: 9999, background: '#fff', border: `1px solid ${BO}`, borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.12)', minWidth: 200, overflow: 'hidden', padding: '6px 0' }}>
                      {[
                        { action: 'activate',  label: 'Marcar como pago',     color: SUC },
                        { action: 'essencial', label: 'Plano Essencial',       color: INK },
                        { action: 'pro',       label: 'Plano Pro',             color: P   },
                        { action: 'trial7',    label: 'Estender trial +7 dias',color: INK },
                        { action: 'trial30',   label: 'Estender trial +30 dias',color: INK},
                        { action: 'suspend',   label: 'Suspender conta',       color: DES },
                      ].map(opt => (
                        <button key={opt.action}
                          disabled={actionLoading}
                          onClick={() => doAction(d.id, opt.action)}
                          style={{ display: 'block', width: '100%', padding: '9px 16px', background: 'none', border: 'none', textAlign: 'left' as const, fontSize: 13, color: opt.color, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = BG}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                          {opt.label}
                        </button>
                      ))}
                      <div style={{ borderTop: `1px solid ${BO}`, margin: '4px 0' }} />
                      <button
                        onClick={() => { navigator.clipboard.writeText(d.email).then(() => toast.success('Email copiado')); setActionTarget(null); }}
                        style={{ display: 'block', width: '100%', padding: '9px 16px', background: 'none', border: 'none', textAlign: 'left' as const, fontSize: 13, color: MU, cursor: 'pointer', fontFamily: 'inherit' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = BG}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                        Copiar email
                      </button>
                    </div>
                  )}
                </div>
              </>}
              {/* Mobile: linha resumida */}
              {isMobile && (
                <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12, color: MU }}>
                  <span>{d.patient_count} pac.</span>
                  <span>{d.consults_this_month} cons./mês</span>
                  <span>{d.consults_ai_this_month} IA</span>
                  <span>R${d.estimated_ai_cost_brl.toFixed(2)}</span>
                  <span>{fmtLastActive(d.last_consultation_at)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legenda */}
      <div style={{ marginTop: 16, fontSize: 11, color: MU }}>
        Custo IA estimado: R$0,80/consulta transcrita (Whisper ~2min + GPT-4o ~1.5k tokens). Valores aproximados.
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export type AppNotification = { type: 'vaccine' | 'appointment'; title: string; subtitle: string; patientId?: string; };

export default function App() {
  const { isAdmin, isLoading: authProfileLoading } = useAuthProfile();
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [doctorSpecialty, setDoctorSpecialty] = useState<string>('Pediatria');
  const [presetPatientSearch, setPresetPatientSearch] = useState('');
  const [pendingDetailTab, setPendingDetailTab] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [screen, setScreen] = useState('dashboard');
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [flow, setFlow] = useState<'consent'|'recording'|'processing'|'done'|null>(null);
  const [consultType, setConsultType] = useState<'retorno' | 'primeira vez'>('retorno');
  const [recTime, setRecTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [realSummary, setRealSummary] = useState<StructuredSummary | null>(null);
  const [realTranscript, setRealTranscript] = useState('');
  const [realAnamnese, setRealAnamnese] = useState<AnamnesePrimeiraConsultaData | null>(null);
  const [realAnamneseAdulta, setRealAnamneseAdulta] = useState<AnamneseAdultaData | null>(null);
  const [realAnamneseError, setRealAnamneseError] = useState<string | null>(null);
  const [draftConsultationId, setDraftConsultationId] = useState<string | null>(null);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
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

  // Load profile — detect onboarding if profile not yet configured
  useEffect(() => {
    if (!user) { setProfileLoaded(false); setNeedsOnboarding(false); return; }
    db.fetchProfile().then(profile => {
      setProfileLoaded(true);
      if (!profile || !profile.specialty) {
        // Primeiro login ou perfil incompleto → onboarding obrigatório
        setNeedsOnboarding(true);
        // Pre-fill name from auth metadata if available
        if (user.user_metadata?.full_name) setDoctorName(user.user_metadata.full_name);
      } else {
        setNeedsOnboarding(false);
        setDoctorSpecialty(profile.specialty);
        if (profile.prontuario_format) {
          setProntuarioFormatState(profile.prontuario_format as ProntuarioFormat);
        }
      }
    }).catch(() => { setProfileLoaded(true); setNeedsOnboarding(true); });
  }, [user]);

  // Notificações globais
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const notifs: AppNotification[] = [];
      // Vaccine notifications only for Pediatria
      const isPediatria = doctorSpecialty === 'Pediatria';
      const basePromises: Promise<any>[] = [db.fetchPatients(), db.fetchDashboardStats()];
      if (isPediatria) basePromises.push(db.fetchAllVaccinesForDoctor());
      const [ps, stats, vaccMap] = await Promise.all(basePromises).catch(() => [[], { overdueAppointments: [] }, {}] as any);
      stats.overdueAppointments?.forEach((a: any) => {
        notifs.push({ type: 'appointment', title: `${a.patient_name} — consulta não realizada`, subtitle: `Agendada para ${a.scheduled_at?.slice(0,10)}`, patientId: a.patient_id });
      });
      // Batch vaccine check — single query replaces N+1 (Pediatria only)
      if (isPediatria) {
        const now = new Date();
        (ps || []).forEach((p: Patient) => {
          const bd = new Date(p.birth_date);
          const ageMonths = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
          const dbVs = ((vaccMap as Record<string, any[]>) || {})[p.id] || [];
          const overdue = PNI_SCHEDULE.filter(pni => !dbVs.find((v: any) => v.name === pni.name && v.dose === pni.dose && v.status === 'done') && pni.age_months < ageMonths).length;
          if (overdue > 0) notifs.push({ type: 'vaccine', title: `${p.full_name} — ${overdue} vacina${overdue > 1 ? 's' : ''} em atraso`, subtitle: 'Verificar calendário PNI', patientId: p.id });
        });
      }
      setNotifications(notifs);
    };
    load();
  }, [user, doctorSpecialty]);

  // Recording timer — only starts after microphone is granted (micReady)
  const [micReady, setMicReady] = useState(false);
  useEffect(() => {
    if (flow === 'recording' && micReady) {
      timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    if (flow !== 'recording') { setRecTime(0); setMicReady(false); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [flow, micReady]);

  // Admin: skip onboarding (admin não tem perfil clínico) + redireciona para tela admin
  useEffect(() => {
    if (isAdmin && !authProfileLoading) {
      setNeedsOnboarding(false);
      setScreen('admin');
    }
  }, [isAdmin, authProfileLoading]);

  const go = (s: string) => { setScreen(s); setFlow(null); };

  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' as const }}>
        <img src="/brand/auri-logo-full.svg" alt="Auri" style={{ height: 52, marginBottom: 16 }} />
        <div style={{ fontSize: 13, color: MU }}>Carregando…</div>
      </div>
    </div>
  );

  if (!user) return showLogin
    ? <LoginScreen onBack={() => setShowLogin(false)} />
    : <LandingPage onEnter={() => setShowLogin(true)} />;

  // Aguarda fetchProfile() resolver — evita flash de dashboard antes do onboarding
  if (!profileLoaded) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' as const }}>
        <img src="/brand/auri-logo-full.svg" alt="Auri" style={{ height: 52, marginBottom: 16 }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        <div style={{ fontSize: 13, color: MU }}>Carregando perfil…</div>
      </div>
    </div>
  );

  // Onboarding: bloqueia o dashboard até o médico configurar o perfil
  // Aguarda authProfileLoading para evitar race condition: se isAdmin ainda não carregou,
  // needsOnboarding=true mostraria esta tela indevidamente para admins (que não têm specialty)
  if (needsOnboarding && !isAdmin && !authProfileLoading) return (
    <OnboardingSetup
      user={user}
      onComplete={(specialty) => {
        setDoctorSpecialty(specialty);
        setNeedsOnboarding(false);
      }}
    />
  );

  if (flow === 'consent')    return <ConsentScreen consultType={consultType} onOk={() => setFlow('recording')} onCancel={() => { if (screen === 'dashboard') { go('patient-detail'); } else { setFlow(null); } }} />;
  if (flow === 'recording')  return <RecordingScreen time={recTime} patient={activePatient} consultType={consultType} onFinish={blob => { setAudioBlob(blob); setFlow('processing'); }} onCancel={() => { setFlow(null); setRecTime(0); setMicReady(false); }} onMicReady={() => setMicReady(true)} />;
  if (flow === 'processing') return <ProcessingScreen consultType={consultType} specialty={doctorSpecialty} audioBlob={audioBlob} patientId={activePatient?.id} onRetry={() => setFlow('recording')} onDone={(summary, transcript, anamnese, anamneseError, anamneseAdulta) => {
    setRealSummary(summary); setRealTranscript(transcript); setRealAnamnese(anamnese ?? null); setRealAnamneseAdulta(anamneseAdulta ?? null); setRealAnamneseError(anamneseError ?? null); setFlow('done');
    if (activePatient) {
      db.saveDraftConsultation(activePatient.id, summary, recTime, consultType)
        .then(id => setDraftConsultationId(id))
        .catch(err => console.error('Auto-save draft failed:', err));
    }
  }} />;
  if (flow === 'done' && realSummary) return <SummaryDoneScreen patient={activePatient} recTime={recTime} summary={realSummary} transcript={realTranscript} draftId={draftConsultationId} consultType={consultType} anamnese={realAnamnese} anamneseAdulta={realAnamneseAdulta} anamneseError={realAnamneseError} specialty={doctorSpecialty} onSave={() => { if (activeAppointmentId) db.updateAppointment(activeAppointmentId, { status: 'completed' }).catch(() => {}); setActiveAppointmentId(null); setFlow(null); setAudioBlob(null); setDraftConsultationId(null); setRealAnamnese(null); setRealAnamneseAdulta(null); setRealAnamneseError(null); setRefetchTrigger(t => t + 1); go('patient-detail'); }} />;

  const breadcrumbs: Record<string, string[]> = {
    dashboard:        ['Início', 'Dashboard'],
    patients:         ['Início', 'Pacientes'],
    'patient-detail': ['Início', 'Pacientes', activePatient?.full_name || ''],
    agenda:           ['Início', 'Agenda'],
    painel:           ['Início', 'Painel do consultório'],
    settings:         ['Início', 'Configurações'],
    admin:            ['Admin', 'Gestão de Assinantes'],
  };

  return (
    <MobileCtx.Provider value={isMobile}>
      <PatientProvider>
        <ProntuarioFormatCtx.Provider value={{ format: prontuarioFormat, setFormat: setProntuarioFormat }}>
          <Layout screen={screen} go={go} breadcrumb={breadcrumbs[screen]} onBack={screen === 'patient-detail' ? () => go('patients') : undefined} doctorName={doctorName} doctorSpecialty={doctorSpecialty} notifications={notifications} onNotificationClick={(patientId) => { if (patientId) { db.fetchPatients().then(ps => { const found = ps.find(x => x.id === patientId); if (found) { setActivePatient(found); go('patient-detail'); } }); } }} onClearNotifications={() => setNotifications([])}>
            {screen === 'dashboard' && (
              <RequireRole roles={['medico']}
                fallback={<SecretaryDashboard go={go} setActivePatient={setActivePatient} onNewPatient={() => go('patients')} />}
              >
                <DashboardPage go={go} setActivePatient={setActivePatient} onStartConsult={(type, apptId?) => { setConsultType(type); if (apptId) setActiveAppointmentId(apptId); setFlow('consent'); }} user={user} doctorName={doctorName} specialty={doctorSpecialty} setPresetPatientSearch={setPresetPatientSearch} setPendingDetailTab={setPendingDetailTab} />
              </RequireRole>
            )}
            {screen === 'patients'  && <PatientsPage go={go} setActivePatient={setActivePatient} specialty={doctorSpecialty} presetSearch={presetPatientSearch} onConsumePresetSearch={() => setPresetPatientSearch('')} />}
            {screen === 'patient-detail' && activePatient && <PatientDetailPage patient={activePatient} go={go} onStartConsult={(type) => { setConsultType(type); setFlow('consent'); }} specialty={doctorSpecialty} pendingTab={pendingDetailTab} onConsumePendingTab={() => setPendingDetailTab(null)} onOpenDraft={async (draft) => {
                setRealSummary(draft.summary);
                setRealTranscript('');
                setDraftConsultationId(draft.id);
                setConsultType(draft.type as 'retorno' | 'primeira vez');
                setRecTime(draft.duration_minutes * 60);
                if (draft.type === 'primeira vez' && doctorSpecialty !== 'Pediatria') {
                  const anamneseAdulta = await db.fetchAnamneseAdulta(activePatient.id).catch(() => null);
                  setRealAnamnese(null);
                  setRealAnamneseAdulta(anamneseAdulta);
                } else {
                  const anamnese = draft.type === 'primeira vez'
                    ? await db.fetchAnamnesePrimeiraConsultaByPatient(activePatient.id).catch(() => null)
                    : null;
                  setRealAnamnese(anamnese);
                  setRealAnamneseAdulta(null);
                }
                setRealAnamneseError(null);
                setFlow('done');
              }} refetchTrigger={refetchTrigger} />}
            {screen === 'agenda'   && <AgendaPage go={go} setActivePatient={setActivePatient} onStartConsult={(type, apptId?) => { setConsultType(type); if (apptId) setActiveAppointmentId(apptId); setFlow('consent'); }} />}
            {screen === 'painel'   && <RequireRole roles={['medico']} onBack={() => go('dashboard')}><PainelPage go={go} setActivePatient={setActivePatient} /></RequireRole>}
            {screen === 'settings' && <RequireRole roles={['medico']} onBack={() => go('dashboard')}><SettingsPage user={user} /></RequireRole>}
            {screen === 'admin'    && <RequireRole roles={['admin']}  onBack={() => go('admin')}><AdminPage go={go} /></RequireRole>}
          </Layout>
        </ProntuarioFormatCtx.Provider>
      </PatientProvider>
    </MobileCtx.Provider>
  );
}
