import React, { useState, useEffect } from 'react';
import { Clock, UserCircle } from '@phosphor-icons/react';
import * as db from '../lib/db';
import type { AdminAlert } from '../lib/db';
import { useAuthProfile } from '../contexts/AuthProfileContext';
import { usePatients } from '../contexts/PatientContext';

// Design tokens (espelhados de App.tsx)
const P    = '#0F4C5C';
const PL   = '#E6F2F4';
const INK  = '#1A1D1C';
const MU   = '#6B7280';
const BO   = '#E5E7EB';
const SUC  = '#5B8A6F';
const SUCL = '#ECFDF5';
const WARN = '#C68B3E';
const WARNL = '#FFF8EC';

// ── Tipos ────────────────────────────────────────────────────────────────────

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

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color = status === 'completed' ? SUC : status === 'in_progress' ? P : MU;
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%',
      background: color, display: 'inline-block', flexShrink: 0,
    }} />
  );
}

function ApptTypeBadge({ type }: { type: string }) {
  const isPrimeira = type === 'primeira vez';
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
      background: isPrimeira ? WARNL : SUCL,
      color: isPrimeira ? WARN : SUC,
      whiteSpace: 'nowrap' as const,
    }}>
      {isPrimeira ? 'Primeira vez' : 'Retorno'}
    </span>
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

  const [appts, setAppts]               = useState<TodayAppt[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [alerts, setAlerts]             = useState<AdminAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

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

  const done      = appts.filter(a => a.status === 'completed').length;
  const pending   = appts.filter(a => a.status === 'scheduled').length;
  const inProgress = appts.find(a => a.status === 'in_progress');

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 4px' }}>

      {/* Saudação */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: INK }}>
          Olá, {fullName?.split(' ')[0] ?? 'Secretária'} 👋
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: MU, textTransform: 'capitalize' as const }}>
          {today}
        </p>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Consultas hoje',   value: appts.length, color: P,    bg: PL },
          { label: 'Realizadas',        value: done,          color: SUC,  bg: SUCL },
          { label: 'Aguardando',        value: pending,       color: WARN, bg: WARNL },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{
            background: '#fff', border: `1px solid ${BO}`, borderRadius: 10,
            padding: '18px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: '"JetBrains Mono", monospace' }}>
              {value}
            </div>
            <div style={{ fontSize: 13, color: MU, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* Agenda do dia */}
        <div style={{
          background: '#fff', border: `1px solid ${BO}`, borderRadius: 10,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 20px', borderBottom: `1px solid ${BO}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: INK }}>Agenda de hoje</span>
            <button onClick={() => go('agenda')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: P, fontWeight: 600, fontFamily: 'inherit',
            }}>
              Ver agenda completa →
            </button>
          </div>

          {loadingAppts ? (
            <div style={{ padding: 32, textAlign: 'center', color: MU, fontSize: 14 }}>
              Carregando…
            </div>
          ) : appts.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: MU, fontSize: 14 }}>
              Nenhuma consulta agendada para hoje.
            </div>
          ) : (
            <div>
              {appts.map((appt, i) => (
                <div
                  key={appt.id}
                  style={{
                    padding: '14px 20px',
                    borderBottom: i < appts.length - 1 ? `1px solid ${BO}` : 'none',
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: appt.status === 'in_progress' ? PL : '#fff',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => {
                    const p = patients.find(pt => pt.id === appt.patient_id);
                    if (p) { setActivePatient(p); go('patient-detail'); }
                  }}
                >
                  {/* Hora */}
                  <div style={{
                    minWidth: 44, fontSize: 13, fontWeight: 700,
                    color: P, fontFamily: '"JetBrains Mono", monospace',
                    fontFeatureSettings: '"tnum"',
                  }}>
                    {appt.time}
                  </div>

                  <StatusDot status={appt.status} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: INK,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                    }}>
                      {appt.patient_name}
                    </div>
                    <div style={{ fontSize: 12, color: MU }}>
                      {appt.age && `${appt.age} · `}
                      {appt.guardian && `Resp: ${appt.guardian}`}
                    </div>
                  </div>

                  <ApptTypeBadge type={appt.type} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Painel direito */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Em atendimento agora */}
          {inProgress && (
            <div style={{
              background: PL, border: `1px solid ${P}22`, borderRadius: 10,
              padding: '16px 18px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: P, textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 6 }}>
                Em atendimento agora
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>
                {inProgress.patient_name}
              </div>
              <div style={{ fontSize: 12, color: MU, marginTop: 2 }}>{inProgress.age}</div>
            </div>
          )}

          {/* Ações rápidas */}
          <div style={{
            background: '#fff', border: `1px solid ${BO}`, borderRadius: 10,
            padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 12 }}>
              Ações rápidas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: '+ Novo paciente',      action: onNewPatient },
                { label: 'Ver agenda completa',  action: () => go('agenda') },
                { label: 'Lista de pacientes',   action: () => go('patients') },
              ].map(({ label, action }) => (
                <button key={label} onClick={action} style={{
                  width: '100%', padding: '10px 14px', background: '#FAFAF8',
                  border: `1px solid ${BO}`, borderRadius: 8, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, color: INK, fontFamily: 'inherit',
                  textAlign: 'left', transition: 'background 0.15s',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Alertas administrativos */}
          <div style={{
            background: '#fff', border: `1px solid ${BO}`, borderRadius: 10,
            overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} color={WARN} />
              <span style={{ fontSize: 12, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.6 }}>
                Alertas administrativos
              </span>
              {alerts.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: WARNL, color: WARN, padding: '1px 7px', borderRadius: 99 }}>
                  {alerts.length}
                </span>
              )}
            </div>

            {loadingAlerts ? (
              <div style={{ padding: '14px 18px', fontSize: 13, color: MU }}>Verificando…</div>
            ) : alerts.length === 0 ? (
              <div style={{ padding: '14px 18px', fontSize: 13, color: SUC, display: 'flex', alignItems: 'center', gap: 6 }}>
                ✓ Nenhum alerta pendente
              </div>
            ) : (
              <div>
                {/* Sem telefone */}
                {(() => {
                  const semTel = patients.filter(p => !p.guardians?.some((g: any) => g.phone)).length;
                  return semTel > 0 ? (
                    <div style={{ padding: '10px 18px', borderBottom: `1px solid ${BO}`, fontSize: 13, color: WARN, background: WARNL }}>
                      ⚠️ {semTel} paciente{semTel > 1 ? 's' : ''} sem telefone cadastrado
                    </div>
                  ) : null;
                })()}
                {/* Pacientes sem retorno recente */}
                {alerts.slice(0, 5).map(a => (
                  <div key={a.patientId} style={{
                    padding: '10px 18px',
                    borderBottom: `1px solid ${BO}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <UserCircle size={18} color={MU} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1D1C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {a.patientName}
                      </div>
                      <div style={{ fontSize: 11, color: MU }}>
                        {a.lastConsultDate
                          ? `Última consulta há ${a.daysSince} dias`
                          : 'Sem consultas registradas'}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                      background: a.daysSince > 90 ? '#FEF2F2' : WARNL,
                      color: a.daysSince > 90 ? '#D1646F' : WARN,
                      flexShrink: 0,
                    }}>
                      {a.daysSince > 9000 ? 'Nunca' : `${a.daysSince}d`}
                    </span>
                  </div>
                ))}
                {alerts.length > 5 && (
                  <div style={{ padding: '10px 18px', fontSize: 12, color: MU, textAlign: 'center' as const }}>
                    +{alerts.length - 5} pacientes sem retorno recente
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
