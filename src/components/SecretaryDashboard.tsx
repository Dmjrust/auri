import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock, UserCircle, CalendarBlank, CheckCircle, Warning,
  ArrowRight, Phone, Plus, CaretRight, Hourglass, XCircle,
  ArrowClockwise, Stethoscope,
} from '@phosphor-icons/react';
import * as db from '../lib/db';
import type { AdminAlert } from '../lib/db';
import { useAuthProfile } from '../contexts/AuthProfileContext';
import { usePatients } from '../contexts/PatientContext';

// ── Design tokens ─────────────────────────────────────────────────────────────
const P      = '#0F4C5C';
const PL     = '#E6F2F4';
const INK    = '#1A1D1C';
const MU     = '#6B7280';
const BO     = '#E5E7EB';
const SUC    = '#5B8A6F';
const SUCL   = '#ECFDF5';
const WARN   = '#C68B3E';
const WARNL  = '#FFF8EC';
const DANGER = '#D1646F';
const DANGERL = '#FEF2F2';
const BG     = '#FAFAF8';

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

// ── Status config ─────────────────────────────────────────────────────────────
function getStatusConfig(appt: TodayAppt) {
  if (appt.status === 'completed')   return { label: 'Realizada',          color: SUC,    bg: SUCL,    icon: <CheckCircle size={12} weight="fill" /> };
  if (appt.status === 'in_progress') return { label: 'Em consulta',        color: P,      bg: PL,      icon: <Stethoscope size={12} /> };
  if (isDelayed(appt))               return { label: 'Atrasado',           color: DANGER, bg: DANGERL, icon: <Warning size={12} weight="fill" /> };
  return                                    { label: 'Aguardando',         color: WARN,   bg: WARNL,   icon: <Hourglass size={12} /> };
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatusBadge({ appt }: { appt: TodayAppt }) {
  const cfg = getStatusConfig(appt);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' as const,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const isPrimeira = type === 'primeira vez';
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 99,
      background: isPrimeira ? WARNL : '#F3F4F6',
      color: isPrimeira ? WARN : MU,
    }}>
      {isPrimeira ? '1ª vez' : 'Retorno'}
    </span>
  );
}

function ActionBtn({ label, onClick, variant = 'ghost' }: {
  label: string; onClick: () => void; variant?: 'ghost' | 'primary' | 'danger';
}) {
  const styles: Record<string, React.CSSProperties> = {
    ghost:   { background: 'none', border: `1px solid ${BO}`, color: INK },
    primary: { background: P,      border: `1px solid ${P}`,  color: '#fff' },
    danger:  { background: DANGERL, border: `1px solid ${DANGER}22`, color: DANGER },
  };
  return (
    <button onClick={onClick} style={{
      ...styles[variant],
      fontSize: 11, fontWeight: 600, padding: '4px 10px',
      borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
      transition: 'opacity 0.15s', whiteSpace: 'nowrap' as const,
    }}>
      {label}
    </button>
  );
}

function SectionCard({ title, icon, count, children, onViewAll, empty }: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  children?: React.ReactNode;
  onViewAll?: () => void;
  empty?: React.ReactNode;
}) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${BO}`, borderRadius: 12,
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: `1px solid ${BO}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {icon && <span style={{ color: P }}>{icon}</span>}
        <span style={{ fontWeight: 700, fontSize: 14, color: INK, flex: 1 }}>{title}</span>
        {count !== undefined && count > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, background: WARNL, color: WARN,
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
      {children ?? empty}
    </div>
  );
}

function EmptyState({ message, cta, onCta }: { message: string; cta?: string; onCta?: () => void }) {
  return (
    <div style={{ padding: '24px 18px', textAlign: 'center' as const }}>
      <div style={{ fontSize: 13, color: MU, marginBottom: cta ? 12 : 0 }}>{message}</div>
      {cta && onCta && (
        <button onClick={onCta} style={{
          background: PL, border: `1px solid ${P}22`, borderRadius: 8,
          padding: '8px 16px', cursor: 'pointer', fontSize: 12,
          fontWeight: 600, color: P, fontFamily: 'inherit',
        }}>{cta}</button>
      )}
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

  const [appts, setAppts]                   = useState<TodayAppt[]>([]);
  const [loadingAppts, setLoadingAppts]     = useState(true);
  const [alerts, setAlerts]                 = useState<AdminAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts]   = useState(true);

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
  }, []);

  // ── Dados derivados ─────────────────────────────────────────────────────────
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

  function openPatient(patient_id: string) {
    const p = patients.find(pt => pt.id === patient_id);
    if (p) { setActivePatient(p); go('patient-detail'); }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: INK }}>
          Olá, {fullName?.split(' ')[0] ?? 'Secretária'} 👋
        </h1>
        <p style={{ margin: '3px 0 8px', fontSize: 13, color: MU, textTransform: 'capitalize' as const }}>
          {today}
        </p>
        {/* Resumo operacional */}
        {!loadingAppts && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 16,
            background: '#fff', border: `1px solid ${BO}`, borderRadius: 10,
            padding: '10px 16px', fontSize: 13,
          }}>
            <span style={{ fontWeight: 600, color: INK }}>
              {appts.length === 0
                ? 'Agenda livre hoje'
                : `${appts.length} consulta${appts.length > 1 ? 's' : ''} hoje`}
            </span>
            {appts.length > 0 && (
              <>
                <span style={{ color: BO }}>·</span>
                <span style={{ color: SUC, fontWeight: 600 }}>
                  <CheckCircle size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {completed.length} realizada{completed.length !== 1 ? 's' : ''}
                </span>
                {inProgress && (
                  <>
                    <span style={{ color: BO }}>·</span>
                    <span style={{ color: P, fontWeight: 600 }}>
                      <Stethoscope size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      Em consulta agora
                    </span>
                  </>
                )}
                {delayed.length > 0 && (
                  <>
                    <span style={{ color: BO }}>·</span>
                    <span style={{ color: DANGER, fontWeight: 600 }}>
                      <Warning size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} weight="fill" />
                      {delayed.length} atrasado{delayed.length !== 1 ? 's' : ''}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Grid principal ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* ═══ Coluna principal ═══════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Próximos atendimentos */}
          <div style={{
            background: '#fff', border: `1px solid ${BO}`, borderRadius: 12,
            overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              padding: '14px 18px', borderBottom: `1px solid ${BO}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Clock size={16} color={P} />
              <span style={{ fontWeight: 700, fontSize: 14, color: INK, flex: 1 }}>
                Próximos atendimentos
              </span>
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
              <div style={{ padding: '28px 18px', textAlign: 'center' as const }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🗓️</div>
                <div style={{ fontWeight: 600, color: INK, marginBottom: 4, fontSize: 14 }}>
                  Agenda livre no momento
                </div>
                <div style={{ fontSize: 13, color: MU, marginBottom: 16 }}>
                  Nenhuma consulta agendada para hoje.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={() => go('agenda')} style={{
                    background: PL, border: `1px solid ${P}22`, borderRadius: 8,
                    padding: '8px 16px', cursor: 'pointer', fontSize: 12,
                    fontWeight: 600, color: P, fontFamily: 'inherit',
                  }}>
                    + Agendar consulta
                  </button>
                  <button onClick={() => go('agenda')} style={{
                    background: 'none', border: `1px solid ${BO}`, borderRadius: 8,
                    padding: '8px 16px', cursor: 'pointer', fontSize: 12,
                    fontWeight: 600, color: MU, fontFamily: 'inherit',
                  }}>
                    Ver agenda completa
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {upcoming.length === 0 && completed.length > 0 && (
                  <div style={{ padding: '16px 18px', textAlign: 'center', color: SUC, fontSize: 13, fontWeight: 600 }}>
                    ✓ Todas as {completed.length} consultas de hoje foram realizadas!
                  </div>
                )}
                {upcoming.map((appt, i) => {
                  const delayed = isDelayed(appt);
                  return (
                    <div
                      key={appt.id}
                      style={{
                        padding: '14px 18px',
                        borderBottom: i < upcoming.length - 1 ? `1px solid ${BO}` : 'none',
                        display: 'flex', alignItems: 'center', gap: 14,
                        background: appt.status === 'in_progress' ? PL : delayed ? '#FFFBF5' : '#fff',
                      }}
                    >
                      {/* Hora */}
                      <div style={{
                        minWidth: 42, fontSize: 14, fontWeight: 700,
                        color: delayed ? DANGER : appt.status === 'in_progress' ? P : INK,
                        fontFamily: '"JetBrains Mono", monospace',
                        fontFeatureSettings: '"tnum"',
                      }}>
                        {appt.time}
                      </div>

                      {/* Info do paciente */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{
                            fontSize: 14, fontWeight: 600, color: INK,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                          }}>
                            {appt.patient_name}
                          </span>
                          {appt.age && (
                            <span style={{ fontSize: 12, color: MU, flexShrink: 0 }}>• {appt.age}</span>
                          )}
                          <TypeBadge type={appt.type} />
                        </div>
                        {appt.guardian && (
                          <div style={{ fontSize: 11, color: MU }}>
                            Resp: {appt.guardian}
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <StatusBadge appt={appt} />

                      {/* Ações */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <ActionBtn label="Abrir ficha" onClick={() => openPatient(appt.patient_id)} />
                        {appt.status === 'scheduled' && !delayed && (
                          <ActionBtn label="Confirmar" onClick={() => {}} variant="primary" />
                        )}
                        {delayed && (
                          <ActionBtn label="Reagendar" onClick={() => go('agenda')} variant="danger" />
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Realizadas resumidas */}
                {completed.length > 0 && upcoming.length > 0 && (
                  <div style={{
                    padding: '10px 18px', background: '#FAFAF8', borderTop: `1px solid ${BO}`,
                    fontSize: 12, color: MU, display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <CheckCircle size={13} color={SUC} />
                    {completed.length} consulta{completed.length !== 1 ? 's' : ''} realizadas hoje
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resumo da agenda */}
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
                  { label: 'Total',       value: appts.length,         color: P,      bg: PL },
                  { label: 'Realizadas',  value: completed.length,     color: SUC,    bg: SUCL },
                  { label: 'Aguardando',  value: pendingConfirm.length, color: WARN,   bg: WARNL },
                  { label: 'Atrasados',   value: delayed.length,       color: DANGER, bg: DANGERL },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} style={{
                    background: bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' as const,
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: '"JetBrains Mono", monospace' }}>
                      {value}
                    </div>
                    <div style={{ fontSize: 11, color: MU, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Retornos pendentes */}
          <SectionCard
            title="Retornos para agendar"
            icon={<ArrowClockwise size={16} />}
            count={alerts.length}
            onViewAll={alerts.length > 3 ? () => {} : undefined}
            empty={
              <EmptyState message="✓ Nenhum retorno pendente" />
            }
          >
            {alerts.length > 0 ? (
              <div>
                {alerts.slice(0, 5).map((a, i) => (
                  <div key={a.patientId} style={{
                    padding: '12px 18px',
                    borderBottom: i < Math.min(alerts.length, 5) - 1 ? `1px solid ${BO}` : 'none',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <UserCircle size={20} color={MU} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                        {a.patientName}
                      </div>
                      <div style={{ fontSize: 11, color: MU }}>
                        {a.lastConsultDate
                          ? `Último retorno há ${a.daysSince} dias`
                          : 'Sem consultas registradas'}
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
                  </div>
                ))}
                {alerts.length > 5 && (
                  <div style={{ padding: '10px 18px', textAlign: 'center', fontSize: 12, color: MU }}>
                    +{alerts.length - 5} pacientes sem retorno recente
                  </div>
                )}
              </div>
            ) : null}
          </SectionCard>

        </div>

        {/* ═══ Coluna lateral ═════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Em consulta agora */}
          {inProgress && (
            <div style={{
              background: PL, border: `1px solid ${P}33`, borderRadius: 12,
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: P, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6 }}>
                🩺 Em consulta agora
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{inProgress.patient_name}</div>
              <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>{inProgress.age} · {inProgress.time}</div>
              <button onClick={() => openPatient(inProgress.patient_id)} style={{
                marginTop: 10, width: '100%', padding: '7px', background: P, border: 'none',
                borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: '#fff', fontFamily: 'inherit',
              }}>
                Abrir ficha
              </button>
            </div>
          )}

          {/* Ações rápidas */}
          <div style={{
            background: '#fff', border: `1px solid ${BO}`, borderRadius: 12,
            padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 12 }}>
              Ações rápidas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: '+ Nova consulta',      action: () => go('agenda'),    primary: true },
                { label: '+ Novo paciente',       action: onNewPatient,          primary: false },
                { label: 'Ver agenda completa',   action: () => go('agenda'),    primary: false },
                { label: 'Lista de pacientes',    action: () => go('patients'),  primary: false },
              ].map(({ label, action, primary }) => (
                <button key={label} onClick={action} style={{
                  width: '100%', padding: '10px 12px',
                  background: primary ? P : BG,
                  border: `1px solid ${primary ? P : BO}`,
                  borderRadius: 8, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  color: primary ? '#fff' : INK,
                  fontFamily: 'inherit', textAlign: 'left',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  {label}
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
          </div>

          {/* Confirmações pendentes */}
          <SectionCard
            title="Confirmações"
            icon={<CheckCircle size={15} />}
            count={pendingConfirm.length}
            empty={
              <EmptyState message="✓ Todas as consultas confirmadas" />
            }
          >
            {pendingConfirm.length > 0 ? (
              <div>
                {pendingConfirm.slice(0, 4).map((appt, i) => (
                  <div key={appt.id} style={{
                    padding: '10px 16px',
                    borderBottom: i < Math.min(pendingConfirm.length, 4) - 1 ? `1px solid ${BO}` : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{appt.patient_name}</div>
                        <div style={{ fontSize: 11, color: MU }}>{appt.time} · {appt.age}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{
                        flex: 1, padding: '5px 8px', background: '#ECFDF5',
                        border: `1px solid ${SUC}33`, borderRadius: 6,
                        cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        color: SUC, fontFamily: 'inherit',
                      }}>
                        ✓ Confirmar
                      </button>
                      <button style={{
                        flex: 1, padding: '5px 8px', background: '#F0FDF4',
                        border: `1px solid ${BO}`, borderRadius: 6,
                        cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        color: MU, fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                      }}>
                        <Phone size={11} /> Ligar
                      </button>
                    </div>
                  </div>
                ))}
                {pendingConfirm.length > 4 && (
                  <div style={{ padding: '8px 16px', textAlign: 'center', fontSize: 12, color: MU }}>
                    +{pendingConfirm.length - 4} aguardando
                  </div>
                )}
              </div>
            ) : null}
          </SectionCard>

          {/* Alertas administrativos */}
          <div style={{
            background: '#fff', border: `1px solid ${BO}`, borderRadius: 12,
            overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              padding: '12px 16px', borderBottom: `1px solid ${BO}`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Warning size={14} color={WARN} />
              <span style={{ fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.8, flex: 1 }}>
                Alertas
              </span>
            </div>

            {loadingAlerts ? (
              <div style={{ padding: '12px 16px', fontSize: 12, color: MU }}>Verificando…</div>
            ) : (semTelefone === 0 && alerts.length === 0) ? (
              <div style={{ padding: '12px 16px', fontSize: 12, color: SUC }}>
                ✓ Nenhum alerta pendente
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {delayed.length > 0 && (
                  <AlertItem icon="⚠️" text={`${delayed.length} paciente${delayed.length > 1 ? 's' : ''} atrasado${delayed.length > 1 ? 's' : ''} hoje`} color={DANGER} bg={DANGERL} />
                )}
                {pendingConfirm.length > 0 && (
                  <AlertItem icon="📋" text={`${pendingConfirm.length} consulta${pendingConfirm.length > 1 ? 's' : ''} sem confirmação`} color={WARN} bg={WARNL} />
                )}
                {semTelefone > 0 && (
                  <AlertItem icon="📵" text={`${semTelefone} paciente${semTelefone > 1 ? 's' : ''} sem telefone`} color={WARN} bg={WARNL} />
                )}
                {alerts.length > 0 && (
                  <AlertItem icon="🔁" text={`${alerts.length} retorno${alerts.length > 1 ? 's' : ''} para agendar`} color={MU} bg={BG} />
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function AlertItem({ icon, text, color, bg }: {
  icon: string; text: string; color: string; bg: string;
}) {
  return (
    <div style={{
      padding: '8px 16px', fontSize: 12, color,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span>{icon}</span> {text}
    </div>
  );
}
