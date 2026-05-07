import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Clock, UserCircle, CalendarBlank, CheckCircle, Warning,
  ArrowRight, Phone, CaretRight, Hourglass, ArrowClockwise,
  Stethoscope, EnvelopeSimple, Heartbeat,
} from '@phosphor-icons/react';
import * as db from '../lib/db';
import type { AdminAlert } from '../lib/db';
import { useAuthProfile } from '../contexts/AuthProfileContext';
import { usePatients } from '../contexts/PatientContext';

// ── Design tokens ─────────────────────────────────────────────────────────────
const P       = '#0F4C5C';
const PL      = '#E6F2F4';
const INK     = '#1A1D1C';
const MU      = '#6B7280';
const BO      = '#E5E7EB';
const SUC     = '#5B8A6F';
const SUCL    = '#ECFDF5';
const WARN    = '#C68B3E';
const WARNL   = '#FFF8EC';
const DANGER  = '#D1646F';
const DANGERL = '#FEF2F2';
const BG      = '#FAFAF8';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface TodayAppt {
  id: string;
  time: string;
  patient_id: string;
  patient_name: string;
  age: string;
  type: 'retorno' | 'primeira vez';
  status: 'completed' | 'in_progress' | 'scheduled';
  guardian: string;
}

interface RecentItem {
  id: string;
  patient_name: string;
  patient_id: string;
  date: string;
  type: 'retorno' | 'primeira vez';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}
function nowMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}
function isDelayed(appt: TodayAppt) {
  return appt.status === 'scheduled' && timeToMinutes(appt.time) < nowMinutes() - 10;
}

// Status simulado de WhatsApp baseado em hash do ID (apenas visual)
type WAStatus = 'confirmed' | 'pending' | 'sent';
function getWAStatus(id: string): WAStatus {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  if (n % 3 === 0) return 'confirmed';
  if (n % 3 === 1) return 'sent';
  return 'pending';
}

const WA_STATUS_CONFIG: Record<WAStatus, { label: string; color: string; bg: string }> = {
  confirmed: { label: '✓ Confirmado',         color: SUC,  bg: SUCL  },
  sent:      { label: '⏳ Aguardando resposta', color: WARN, bg: WARNL },
  pending:   { label: '📲 Não enviado',         color: MU,   bg: '#F3F4F6' },
};

// ── Micro-interação: hover ────────────────────────────────────────────────────
function HoverRow({ children, highlight = false, style = {} }: {
  children: React.ReactNode;
  highlight?: boolean;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        transition: 'background 0.12s',
        background: hovered ? (highlight ? '#F0F9FF' : BG) : 'transparent',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function StatusBadge({ appt }: { appt: TodayAppt }) {
  const delayed = isDelayed(appt);
  if (appt.status === 'completed')
    return <Badge label="Realizada" color={SUC} bg={SUCL} icon={<CheckCircle size={11} weight="fill" />} />;
  if (appt.status === 'in_progress')
    return <Badge label="Em consulta" color={P} bg={PL} icon={<Stethoscope size={11} />} />;
  if (delayed)
    return <Badge label="Atrasado" color={DANGER} bg={DANGERL} icon={<Warning size={11} weight="fill" />} />;
  return <Badge label="Aguardando" color={WARN} bg={WARNL} icon={<Hourglass size={11} />} />;
}

function Badge({ label, color, bg, icon }: {
  label: string; color: string; bg: string; icon?: React.ReactNode;
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99,
      background: bg, color, whiteSpace: 'nowrap' as const, flexShrink: 0,
    }}>
      {icon} {label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const isPrimeira = type === 'primeira vez';
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 99,
      background: isPrimeira ? WARNL : '#F3F4F6',
      color: isPrimeira ? WARN : MU, flexShrink: 0,
    }}>
      {isPrimeira ? '1ª vez' : 'Retorno'}
    </span>
  );
}

function ActionBtn({ label, onClick, variant = 'ghost' }: {
  label: string; onClick: () => void; variant?: 'ghost' | 'primary' | 'danger' | 'success';
}) {
  const [hov, setHov] = useState(false);
  const base: Record<string, React.CSSProperties> = {
    ghost:   { background: hov ? '#F3F4F6' : 'none', border: `1px solid ${BO}`,          color: INK },
    primary: { background: hov ? '#0D3F4E' : P,       border: `1px solid ${P}`,           color: '#fff' },
    danger:  { background: hov ? '#FEE2E2' : DANGERL,  border: `1px solid ${DANGER}33`,   color: DANGER },
    success: { background: hov ? '#D1FAE5' : SUCL,     border: `1px solid ${SUC}33`,      color: SUC },
  };
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...base[variant],
        fontSize: 11, fontWeight: 600, padding: '4px 10px',
        borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.12s', whiteSpace: 'nowrap' as const,
      }}
    >
      {label}
    </button>
  );
}

// ── Card de seção ─────────────────────────────────────────────────────────────
function SectionCard({ title, icon, count, countColor, children, onViewAll, borderAccent }: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  countColor?: string;
  children?: React.ReactNode;
  onViewAll?: () => void;
  borderAccent?: string;
}) {
  return (
    <div style={{
      background: '#fff',
      border: borderAccent ? `1.5px solid ${borderAccent}` : `1px solid ${BO}`,
      borderRadius: 12, overflow: 'hidden',
      boxShadow: borderAccent
        ? `0 2px 8px ${borderAccent}22`
        : '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        padding: '13px 18px', borderBottom: `1px solid ${BO}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {icon && <span style={{ color: countColor ?? P }}>{icon}</span>}
        <span style={{ fontWeight: 700, fontSize: 14, color: INK, flex: 1 }}>{title}</span>
        {count !== undefined && count > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            background: countColor ? `${countColor}18` : WARNL,
            color: countColor ?? WARN,
            padding: '2px 8px', borderRadius: 99,
          }}>{count}</span>
        )}
        {onViewAll && (
          <button onClick={onViewAll} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: P, fontWeight: 600, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            Ver tudo <CaretRight size={12} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── SecretaryDashboard ────────────────────────────────────────────────────────
interface Props {
  go: (s: string) => void;
  setActivePatient: (p: any) => void;
  onNewPatient: () => void;
}

export function SecretaryDashboard({ go, setActivePatient, onNewPatient }: Props) {
  const { fullName } = useAuthProfile();
  const { patients } = usePatients();

  const [appts, setAppts]                 = useState<TodayAppt[]>([]);
  const [loadingAppts, setLoadingAppts]   = useState(true);
  const [alerts, setAlerts]               = useState<AdminAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentItem[]>([]);

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  useEffect(() => {
    setLoadingAppts(true);
    db.fetchTodayAppointments()
      .then((data: any[]) => setAppts(data as TodayAppt[]))
      .catch(() => {})
      .finally(() => setLoadingAppts(false));

    setLoadingAlerts(true);
    db.fetchAdminAlerts(60)
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoadingAlerts(false));

    db.fetchRecentActivity()
      .then((data: any[]) => setRecentActivity(data as RecentItem[]))
      .catch(() => {});
  }, []);

  const { completed, inProgress, upcoming, delayed, pendingConfirm } = useMemo(() => {
    const completed      = appts.filter(a => a.status === 'completed');
    const inProgress     = appts.find(a => a.status === 'in_progress') ?? null;
    const scheduled      = appts.filter(a => a.status === 'scheduled');
    const delayed        = scheduled.filter(a => isDelayed(a));
    const upcoming       = appts.filter(a => a.status !== 'completed').slice(0, 6);
    const pendingConfirm = scheduled.filter(a => !isDelayed(a));
    return { completed, inProgress, upcoming, delayed, pendingConfirm };
  }, [appts]);

  const semTelefone = useMemo(
    () => patients.filter(p => !p.guardians?.some((g: any) => g.phone)).length,
    [patients]
  );

  const openPatient = useCallback((patient_id: string) => {
    const p = patients.find(pt => pt.id === patient_id);
    if (p) { setActivePatient(p); go('patient-detail'); }
  }, [patients, setActivePatient, go]);

  // Ação primária contextual
  const primaryAction = useMemo(() => {
    if (delayed.length > 0)         return { label: '⚠ Reagendar atrasados',      action: () => go('agenda') };
    if (pendingConfirm.length > 0)  return { label: '📋 Enviar confirmações',       action: () => go('agenda') };
    if (alerts.length > 0)          return { label: '🔁 Organizar retornos',        action: () => go('patients') };
    if (appts.length === 0)         return { label: '+ Agendar consulta',           action: () => go('agenda') };
    return                                  { label: '+ Nova consulta',             action: () => go('agenda') };
  }, [delayed, pendingConfirm, alerts, appts, go]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: INK }}>
          Olá, {fullName?.split(' ')[0] ?? 'Secretária'} 👋
        </h1>
        <p style={{ margin: '3px 0 10px', fontSize: 13, color: MU, textTransform: 'capitalize' as const }}>
          {today}
        </p>

        {/* Resumo operacional vivo */}
        {!loadingAppts && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 14,
            background: '#fff', border: `1px solid ${BO}`, borderRadius: 10,
            padding: '10px 16px', fontSize: 13, flexWrap: 'wrap' as const,
          }}>
            <span style={{ fontWeight: 600, color: INK }}>
              {appts.length === 0 ? 'Agenda livre hoje' : `${appts.length} consulta${appts.length > 1 ? 's' : ''} hoje`}
            </span>
            {appts.length > 0 && <>
              <Dot />
              <span style={{ color: SUC, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={13} weight="fill" />
                {completed.length} realizada{completed.length !== 1 ? 's' : ''}
              </span>
              {inProgress && <><Dot /><span style={{ color: P, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Stethoscope size={13} /> Em consulta agora
              </span></>}
              {delayed.length > 0 && <><Dot /><span style={{ color: DANGER, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Warning size={13} weight="fill" /> {delayed.length} atrasado{delayed.length !== 1 ? 's' : ''}
              </span></>}
              {pendingConfirm.length > 0 && <><Dot /><span style={{ color: WARN, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Hourglass size={13} /> {pendingConfirm.length} sem confirmação
              </span></>}
            </>}
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* ═══ Coluna principal ═══════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Próximos atendimentos */}
          <div style={{
            background: '#fff',
            border: delayed.length > 0 ? `1.5px solid ${DANGER}` : `1px solid ${BO}`,
            borderRadius: 12, overflow: 'hidden',
            boxShadow: delayed.length > 0 ? `0 2px 8px ${DANGER}18` : '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              padding: '14px 18px', borderBottom: `1px solid ${BO}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Clock size={16} color={delayed.length > 0 ? DANGER : P} />
              <span style={{ fontWeight: 700, fontSize: 14, color: INK, flex: 1 }}>
                Próximos atendimentos
              </span>
              {delayed.length > 0 && (
                <Badge label={`${delayed.length} atrasado${delayed.length > 1 ? 's' : ''}`} color={DANGER} bg={DANGERL} icon={<Warning size={11} weight="fill" />} />
              )}
              <button onClick={() => go('agenda')} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: P, fontWeight: 600, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                Agenda completa <CaretRight size={12} />
              </button>
            </div>

            {loadingAppts ? (
              <div style={{ padding: '28px 18px', textAlign: 'center', color: MU, fontSize: 13 }}>
                Carregando agenda…
              </div>
            ) : upcoming.length === 0 && completed.length === 0 ? (
              /* Estado vazio orientado a oportunidade */
              <div style={{ padding: '32px 24px', textAlign: 'center' as const }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🗓️</div>
                <div style={{ fontWeight: 700, color: INK, marginBottom: 6, fontSize: 15 }}>
                  Nenhuma consulta agendada hoje
                </div>
                <div style={{
                  fontSize: 13, color: MU, marginBottom: 20,
                  maxWidth: 320, margin: '0 auto 20px',
                  lineHeight: 1.7,
                }}>
                  Você pode aproveitar para:<br />
                  <span style={{ color: WARN }}>• organizar retornos pendentes</span><br />
                  <span style={{ color: P }}>• confirmar consultas futuras</span><br />
                  <span style={{ color: SUC }}>• cadastrar novos pacientes</span>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={() => go('agenda')} style={{
                    background: P, border: 'none', borderRadius: 8,
                    padding: '9px 18px', cursor: 'pointer', fontSize: 13,
                    fontWeight: 600, color: '#fff', fontFamily: 'inherit',
                  }}>
                    + Agendar consulta
                  </button>
                  <button onClick={() => go('agenda')} style={{
                    background: 'none', border: `1px solid ${BO}`, borderRadius: 8,
                    padding: '9px 18px', cursor: 'pointer', fontSize: 13,
                    fontWeight: 600, color: MU, fontFamily: 'inherit',
                  }}>
                    Ver agenda completa
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {upcoming.length === 0 && completed.length > 0 && (
                  <div style={{
                    padding: '18px', textAlign: 'center', color: SUC, fontSize: 13,
                    fontWeight: 600, background: SUCL,
                  }}>
                    🎉 Todas as {completed.length} consultas de hoje foram realizadas!
                  </div>
                )}
                {upcoming.map((appt, i) => {
                  const late = isDelayed(appt);
                  const waStatus = appt.status === 'scheduled' ? getWAStatus(appt.id) : null;
                  return (
                    <HoverRow
                      key={appt.id}
                      highlight
                      style={{
                        padding: '13px 18px',
                        borderBottom: i < upcoming.length - 1 ? `1px solid ${BO}` : 'none',
                        display: 'flex', alignItems: 'center', gap: 14,
                        background: appt.status === 'in_progress' ? PL : late ? '#FFFBF5' : '#fff',
                        borderLeft: late ? `3px solid ${DANGER}` : appt.status === 'in_progress' ? `3px solid ${P}` : '3px solid transparent',
                      }}
                    >
                      {/* Hora */}
                      <div style={{
                        minWidth: 42, fontSize: 14, fontWeight: 700,
                        color: late ? DANGER : appt.status === 'in_progress' ? P : INK,
                        fontFamily: '"JetBrains Mono", monospace',
                        fontFeatureSettings: '"tnum"',
                      }}>
                        {appt.time}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{
                            fontSize: 14, fontWeight: 600, color: INK,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                          }}>
                            {appt.patient_name}
                          </span>
                          {appt.age && <span style={{ fontSize: 12, color: MU, flexShrink: 0 }}>• {appt.age}</span>}
                          <TypeBadge type={appt.type} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {appt.guardian && (
                            <span style={{ fontSize: 11, color: MU }}>Resp: {appt.guardian}</span>
                          )}
                          {waStatus && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                              background: WA_STATUS_CONFIG[waStatus].bg,
                              color: WA_STATUS_CONFIG[waStatus].color,
                            }}>
                              {WA_STATUS_CONFIG[waStatus].label}
                            </span>
                          )}
                        </div>
                      </div>

                      <StatusBadge appt={appt} />

                      {/* Ações */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <ActionBtn label="Abrir ficha" onClick={() => openPatient(appt.patient_id)} />
                        {appt.status === 'scheduled' && !late && (
                          <ActionBtn label="Confirmar" onClick={() => {}} variant="success" />
                        )}
                        {late && (
                          <ActionBtn label="Reagendar" onClick={() => go('agenda')} variant="danger" />
                        )}
                      </div>
                    </HoverRow>
                  );
                })}

                {completed.length > 0 && upcoming.length > 0 && (
                  <div style={{
                    padding: '9px 18px', background: BG, borderTop: `1px solid ${BO}`,
                    fontSize: 12, color: MU, display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <CheckCircle size={13} color={SUC} weight="fill" />
                    {completed.length} consulta{completed.length !== 1 ? 's' : ''} realizada{completed.length !== 1 ? 's' : ''} hoje
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resumo visual da agenda */}
          {appts.length > 0 && (
            <div style={{
              background: '#fff', border: `1px solid ${BO}`, borderRadius: 12,
              padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <CalendarBlank size={16} color={P} />
                <span style={{ fontWeight: 700, fontSize: 14, color: INK }}>Agenda de hoje</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { label: 'Total',      value: appts.length,          color: P,      bg: PL      },
                  { label: 'Realizadas', value: completed.length,      color: SUC,    bg: SUCL    },
                  { label: 'Aguardando', value: pendingConfirm.length, color: WARN,   bg: WARNL   },
                  { label: 'Atrasados',  value: delayed.length,        color: DANGER, bg: DANGERL },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} style={{
                    background: value > 0 && label !== 'Total' ? bg : '#F9FAFB',
                    borderRadius: 8, padding: '10px 12px', textAlign: 'center' as const,
                    border: `1px solid ${value > 0 && label !== 'Total' ? color + '22' : BO}`,
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: value > 0 ? color : MU, fontFamily: '"JetBrains Mono", monospace' }}>
                      {value}
                    </div>
                    <div style={{ fontSize: 11, color: MU, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Retornos para agendar */}
          <SectionCard
            title={alerts.length > 0 ? `${alerts.length} paciente${alerts.length > 1 ? 's' : ''} para agendar retorno` : 'Retornos para agendar'}
            icon={<ArrowClockwise size={16} />}
            count={alerts.length}
            countColor={alerts.length > 0 ? WARN : undefined}
            borderAccent={alerts.length > 3 ? WARN : undefined}
            onViewAll={alerts.length > 5 ? () => go('patients') : undefined}
          >
            {alerts.length === 0 ? (
              <div style={{ padding: '16px 18px', fontSize: 13, color: SUC, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={15} color={SUC} weight="fill" />
                Nenhum retorno pendente
              </div>
            ) : (
              <div>
                {alerts.slice(0, 5).map((a, i) => (
                  <HoverRow key={a.patientId} style={{
                    padding: '12px 18px',
                    borderBottom: i < Math.min(alerts.length, 5) - 1 ? `1px solid ${BO}` : 'none',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <UserCircle size={20} color={a.daysSince > 90 ? DANGER : MU} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{a.patientName}</div>
                      <div style={{ fontSize: 11, color: MU }}>
                        {a.lastConsultDate
                          ? `Sem retorno há ${a.daysSince} dias · Retorno sugerido: imediato`
                          : 'Nunca consultou — primeiro agendamento'}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                      background: a.daysSince > 90 ? DANGERL : WARNL,
                      color: a.daysSince > 90 ? DANGER : WARN, flexShrink: 0,
                    }}>
                      {a.daysSince > 9000 ? 'Nunca' : `${a.daysSince}d`}
                    </span>
                    <ActionBtn label="Agendar" onClick={() => go('agenda')} variant="primary" />
                  </HoverRow>
                ))}
                {alerts.length > 5 && (
                  <div style={{ padding: '10px 18px', textAlign: 'center', fontSize: 12, color: MU, borderTop: `1px solid ${BO}` }}>
                    +{alerts.length - 5} pacientes sem retorno —{' '}
                    <button onClick={() => go('patients')} style={{
                      background: 'none', border: 'none', color: P, fontWeight: 600,
                      cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                    }}>Ver todos</button>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

        </div>

        {/* ═══ Coluna lateral ═════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Em consulta agora */}
          {inProgress && (
            <div style={{
              background: `linear-gradient(135deg, ${PL}, #D4EEF2)`,
              border: `1.5px solid ${P}44`, borderRadius: 12, padding: '14px 16px',
              boxShadow: `0 4px 12px ${P}18`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: P, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: P, display: 'inline-block', animation: 'pulse 2s infinite' }} />
                Em consulta agora
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{inProgress.patient_name}</div>
              <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>{inProgress.age} · desde {inProgress.time}</div>
              <button onClick={() => openPatient(inProgress.patient_id)} style={{
                marginTop: 10, width: '100%', padding: '8px', background: P, border: 'none',
                borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: '#fff', fontFamily: 'inherit', transition: 'background 0.12s',
              }}>
                Abrir ficha
              </button>
            </div>
          )}

          {/* Ações rápidas com lógica contextual */}
          <div style={{
            background: '#fff', border: `1px solid ${BO}`, borderRadius: 12,
            padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 12 }}>
              Ações rápidas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Ação primária contextual */}
              <QuickBtn label={primaryAction.label} onClick={primaryAction.action} primary />
              {/* Ações secundárias */}
              {[
                { label: '+ Novo paciente',     action: onNewPatient },
                { label: 'Ver agenda completa', action: () => go('agenda') },
                { label: 'Lista de pacientes',  action: () => go('patients') },
              ].map(({ label, action }) => (
                <QuickBtn key={label} label={label} onClick={action} />
              ))}
            </div>
          </div>

          {/* Confirmações pendentes */}
          <SectionCard
            title="Confirmações pendentes"
            icon={<EnvelopeSimple size={15} />}
            count={pendingConfirm.length}
            countColor={pendingConfirm.length > 0 ? WARN : undefined}
            borderAccent={pendingConfirm.length > 2 ? WARN : undefined}
          >
            {pendingConfirm.length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: 12, color: SUC, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle size={13} color={SUC} weight="fill" />
                Todas as consultas confirmadas
              </div>
            ) : (
              <div>
                {pendingConfirm.slice(0, 4).map((appt, i) => {
                  const wa = getWAStatus(appt.id);
                  const waCfg = WA_STATUS_CONFIG[wa];
                  return (
                    <div key={appt.id} style={{
                      padding: '10px 16px',
                      borderBottom: i < Math.min(pendingConfirm.length, 4) - 1 ? `1px solid ${BO}` : 'none',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{appt.patient_name}</div>
                          <div style={{ fontSize: 11, color: MU }}>{appt.time} · {appt.age}</div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 99,
                          background: waCfg.bg, color: waCfg.color,
                        }}>
                          {waCfg.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{
                          flex: 1, padding: '5px 8px', background: SUCL,
                          border: `1px solid ${SUC}33`, borderRadius: 6,
                          cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          color: SUC, fontFamily: 'inherit', transition: 'background 0.12s',
                        }}>
                          ✓ Confirmar
                        </button>
                        <button style={{
                          flex: 1, padding: '5px 8px', background: BG,
                          border: `1px solid ${BO}`, borderRadius: 6,
                          cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          color: MU, fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                        }}>
                          <Phone size={10} /> Ligar
                        </button>
                      </div>
                    </div>
                  );
                })}
                {pendingConfirm.length > 4 && (
                  <div style={{ padding: '8px 16px', textAlign: 'center', fontSize: 12, color: MU, borderTop: `1px solid ${BO}` }}>
                    +{pendingConfirm.length - 4} aguardando confirmação
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* Alertas */}
          <SectionCard
            title="Alertas"
            icon={<Warning size={14} />}
            countColor={WARN}
          >
            {loadingAlerts ? (
              <div style={{ padding: '12px 16px', fontSize: 12, color: MU }}>Verificando…</div>
            ) : semTelefone === 0 && alerts.length === 0 && delayed.length === 0 && pendingConfirm.length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: 12, color: SUC, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle size={13} color={SUC} weight="fill" />
                Nenhum alerta pendente
              </div>
            ) : (
              <div style={{ padding: '6px 0' }}>
                {delayed.length > 0 && <AlertRow icon="⚠️" text={`${delayed.length} paciente${delayed.length > 1 ? 's' : ''} atrasado${delayed.length > 1 ? 's' : ''}`} color={DANGER} />}
                {pendingConfirm.length > 0 && <AlertRow icon="📋" text={`${pendingConfirm.length} sem confirmação`} color={WARN} />}
                {semTelefone > 0 && <AlertRow icon="📵" text={`${semTelefone} sem telefone cadastrado`} color={WARN} />}
                {alerts.length > 0 && <AlertRow icon="🔁" text={`${alerts.length} retorno${alerts.length > 1 ? 's' : ''} para agendar`} color={MU} />}
              </div>
            )}
          </SectionCard>

          {/* Atividade recente */}
          <SectionCard
            title="Atividade recente"
            icon={<Heartbeat size={14} />}
          >
            {recentActivity.length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: 12, color: MU }}>
                Nenhuma atividade recente.
              </div>
            ) : (
              <div style={{ padding: '6px 0' }}>
                {recentActivity.slice(0, 5).map((item, i) => {
                  const dateStr = item.date
                    ? new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                    : '';
                  const isToday = item.date === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={item.id} style={{
                      padding: '8px 16px',
                      borderBottom: i < Math.min(recentActivity.length, 5) - 1 ? `1px solid ${BO}` : 'none',
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}>
                      {/* Linha de tempo */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                          background: item.type === 'primeira vez' ? WARN : SUC,
                          display: 'block',
                        }} />
                        {i < Math.min(recentActivity.length, 5) - 1 && (
                          <span style={{ width: 1, flex: 1, background: BO, display: 'block', marginTop: 3, minHeight: 16 }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {item.type === 'primeira vez' ? '👶 Primeira consulta' : '✓ Consulta realizada'}
                        </div>
                        <div style={{ fontSize: 11, color: MU }}>{item.patient_name}</div>
                      </div>
                      <div style={{ fontSize: 10, color: MU, flexShrink: 0, paddingTop: 1 }}>
                        {isToday ? 'Hoje' : dateStr}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

        </div>
      </div>
    </div>
  );
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────
function Dot() {
  return <span style={{ color: '#D1D5DB', fontSize: 10 }}>•</span>;
}

function AlertRow({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <div style={{
      padding: '7px 16px', fontSize: 12, color,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span>{icon}</span> {text}
    </div>
  );
}

function QuickBtn({ label, onClick, primary = false }: {
  label: string; onClick: () => void; primary?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '10px 12px',
        background: primary ? (hov ? '#0D3F4E' : P) : (hov ? '#F3F4F6' : BG),
        border: `1px solid ${primary ? P : BO}`,
        borderRadius: 8, cursor: 'pointer',
        fontSize: 13, fontWeight: 600,
        color: primary ? '#fff' : INK,
        fontFamily: 'inherit', textAlign: 'left' as const,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'all 0.12s',
      }}
    >
      {label}
      <ArrowRight size={13} />
    </button>
  );
}
