import React, { useState, useEffect, useCallback } from 'react';
import {
  Circle, CheckCircle, XCircle, Info, CaretDown, CaretUp,
  Warning, WarningCircle, CheckSquare, Spinner,
} from '@phosphor-icons/react';
import * as db from '../lib/db';
import type { MilestoneRecord } from '../lib/db';
import {
  MILESTONE_GROUPS, MCHAT_QUESTIONS, scoreMchat, mchatRiskLevel,
  type MilestoneStatus, type MilestoneDomain,
} from '../data/developmentMilestones';

// ── Design tokens (mirrors App.tsx) ──────────────────────────────────────────
const P      = '#0F4C5C';
const PL     = '#E8F4F7';
const INK    = '#1A1D1C';
const MU     = '#6B7280';
const BO     = '#E5E7EB';
const BG     = '#FAFAF9';
const SUC    = '#5B8A6F';
const SUCL   = '#EAF4EE';
const WARN   = '#C68B3E';
const WARNL  = '#FDF3E3';
const DANGER = '#D1646F';
const DANGERL= '#FDECEA';
const SAND   = '#E6D5B8';

// ── Helpers ───────────────────────────────────────────────────────────────────
function ageInMonths(birthDate: string): number {
  const bd = new Date(birthDate);
  const now = new Date();
  return (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
}

const CYCLE: MilestoneStatus[] = ['nao_verificado', 'presente', 'ausente'];
function nextStatus(s: MilestoneStatus): MilestoneStatus {
  return CYCLE[(CYCLE.indexOf(s) + 1) % CYCLE.length];
}

const DOMAIN_LABEL: Record<MilestoneDomain, string> = {
  motor_grosso:    'Motor grosso',
  motor_fino:      'Motor fino',
  linguagem:       'Linguagem',
  social_cognitivo:'Social/Cognitivo',
};
const DOMAIN_COLOR: Record<MilestoneDomain, string> = {
  motor_grosso:    '#0F4C5C',
  motor_fino:      '#5B8A6F',
  linguagem:       '#C68B3E',
  social_cognitivo:'#7C5C8A',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: MilestoneStatus }) {
  if (status === 'presente') return <CheckCircle size={20} weight="fill" color={SUC} />;
  if (status === 'ausente')  return <XCircle     size={20} weight="fill" color={DANGER} />;
  return <Circle size={20} color={BO} />;
}

function MilestoneRow({
  milestone, status, disabled, onToggle,
}: {
  milestone: typeof MILESTONE_GROUPS[0]['milestones'][0];
  status: MilestoneStatus;
  disabled: boolean;
  onToggle: () => void;
}) {
  const [showHow, setShowHow] = useState(false);

  return (
    <div style={{ borderBottom: `1px solid ${BO}`, padding: '10px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={disabled ? undefined : onToggle}
          disabled={disabled}
          style={{
            background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
            padding: 2, display: 'flex', flexShrink: 0,
            opacity: disabled ? 0.4 : 1,
          }}
          title={disabled ? 'Faixa futura — não disponível para marcação' : undefined}
        >
          <StatusIcon status={status} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 13, color: disabled ? MU : INK,
              fontWeight: status === 'ausente' ? 600 : 400,
            }}>
              {milestone.label}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, color: DOMAIN_COLOR[milestone.domain],
              background: `${DOMAIN_COLOR[milestone.domain]}15`,
              padding: '1px 6px', borderRadius: 4, letterSpacing: 0.3,
            }}>
              {DOMAIN_LABEL[milestone.domain]}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowHow(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: MU }}
          title="Como pesquisar"
        >
          <Info size={15} />
        </button>
      </div>

      {showHow && (
        <div style={{
          marginTop: 8, marginLeft: 30, padding: '8px 12px',
          background: SAND + '40', borderRadius: 6,
          fontSize: 12, color: INK, lineHeight: 1.6,
          borderLeft: `3px solid ${SAND}`,
        }}>
          {milestone.howToCheck}
        </div>
      )}
    </div>
  );
}

// ── Alert badges ──────────────────────────────────────────────────────────────
function AlertBadge({ color, bg, icon: Icon, text }: {
  color: string; bg: string; icon: any; text: string;
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: bg, color, fontSize: 11, fontWeight: 600,
      padding: '3px 8px', borderRadius: 4,
    }}>
      <Icon size={12} weight="fill" />
      {text}
    </div>
  );
}

// ── Faixa (group card) ────────────────────────────────────────────────────────
function GroupCard({
  group, records, isCurrent, isPast, isFuture, ageMonths,
  onToggle, defaultExpanded,
}: {
  group: typeof MILESTONE_GROUPS[0];
  records: Record<string, MilestoneRecord>;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  ageMonths: number;
  onToggle: (key: string) => void;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const statuses = group.milestones.map(m => records[m.key]?.status ?? 'nao_verificado');
  const ausentes       = statuses.filter(s => s === 'ausente').length;
  const presentes      = statuses.filter(s => s === 'presente').length;
  const naoVerificados = statuses.filter(s => s === 'nao_verificado').length;

  // Alert logic per caderneta (pág. 48)
  const alerts: React.ReactNode[] = [];
  if (isCurrent && ausentes >= 1) {
    alerts.push(
      <AlertBadge key="alerta" color={WARN} bg={WARNL} icon={Warning}
        text="Alerta para o desenvolvimento" />
    );
  }
  if (isPast && ausentes >= 2) {
    alerts.push(
      <AlertBadge key="atraso" color={DANGER} bg={DANGERL} icon={WarningCircle}
        text="Provável atraso — encaminhar avaliação" />
    );
  }
  if (isPast && naoVerificados > 0 && ausentes < 2) {
    alerts.push(
      <AlertBadge key="nv" color={WARN} bg={WARNL} icon={Warning}
        text="Marcos não avaliados" />
    );
  }

  const borderColor = isFuture ? BO
    : alerts.some(a => (a as any).key === 'atraso') ? DANGER
    : alerts.length > 0 ? WARN
    : isCurrent ? P
    : presentes === group.milestones.length ? SUC
    : BO;

  return (
    <div style={{
      border: `1px solid ${BO}`, borderLeft: `3px solid ${borderColor}`,
      borderRadius: 8, marginBottom: 10, background: '#fff',
      opacity: isFuture ? 0.6 : 1,
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', width: '100%',
          padding: '12px 16px', background: 'none', border: 'none',
          cursor: 'pointer', gap: 10, textAlign: 'left',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontWeight: 600, fontSize: 13, color: isFuture ? MU : INK,
              fontFamily: '"Fraunces", Georgia, serif',
            }}>
              {group.label}
            </span>
            {isCurrent && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: P, background: PL,
                padding: '2px 6px', borderRadius: 4, letterSpacing: 0.3,
              }}>
                FAIXA ATUAL
              </span>
            )}
            {isFuture && (
              <span style={{ fontSize: 10, color: MU }}>faixa futura</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
            {presentes > 0 && (
              <span style={{ fontSize: 11, color: SUC }}>✓ {presentes} presente{presentes > 1 ? 's' : ''}</span>
            )}
            {ausentes > 0 && (
              <span style={{ fontSize: 11, color: DANGER }}>✗ {ausentes} ausente{ausentes > 1 ? 's' : ''}</span>
            )}
            {naoVerificados > 0 && (
              <span style={{ fontSize: 11, color: MU }}>○ {naoVerificados} não verificado{naoVerificados > 1 ? 's' : ''}</span>
            )}
            {alerts}
          </div>
        </div>
        {expanded ? <CaretUp size={14} color={MU} /> : <CaretDown size={14} color={MU} />}
      </button>

      {/* Milestone rows */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${BO}` }}>
          {group.milestones.map(m => (
            <MilestoneRow
              key={m.key}
              milestone={m}
              status={records[m.key]?.status ?? 'nao_verificado'}
              disabled={isFuture}
              onToggle={() => onToggle(m.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── M-CHAT-R section ──────────────────────────────────────────────────────────
function MchatSection({
  records, onToggle,
}: {
  records: Record<string, MilestoneRecord>;
  onToggle: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const answered = MCHAT_QUESTIONS.filter(q => {
    const r = records[q.key]?.status;
    return r && r !== 'nao_verificado';
  });

  const mchatRecords: Record<string, MilestoneStatus> = {};
  MCHAT_QUESTIONS.forEach(q => {
    mchatRecords[q.key] = records[q.key]?.status ?? 'nao_verificado';
  });

  const score = scoreMchat(mchatRecords);
  const risk = answered.length === MCHAT_QUESTIONS.length ? mchatRiskLevel(score) : null;

  const riskColor = risk?.level === 'elevado' ? DANGER
    : risk?.level === 'medio' ? WARN
    : risk?.level === 'baixo' ? SUC
    : MU;
  const riskBg = risk?.level === 'elevado' ? DANGERL
    : risk?.level === 'medio' ? WARNL
    : risk?.level === 'baixo' ? SUCL
    : BG;

  return (
    <div style={{
      border: `1px solid ${BO}`, borderLeft: `3px solid #7C5C8A`,
      borderRadius: 8, marginBottom: 10, background: '#fff',
    }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', width: '100%',
          padding: '12px 16px', background: 'none', border: 'none',
          cursor: 'pointer', gap: 10, textAlign: 'left',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 13, fontFamily: '"Fraunces", Georgia, serif' }}>
              M-CHAT-R™
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#7C5C8A', background: '#7C5C8A15',
              padding: '2px 6px', borderRadius: 4,
            }}>
              Rastreio TEA — 16 a 30 meses
            </span>
          </div>
          <div style={{ marginTop: 5, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: MU }}>
              {answered.length}/{MCHAT_QUESTIONS.length} respondidas
            </span>
            {risk && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: riskColor,
                background: riskBg, padding: '2px 6px', borderRadius: 4,
              }}>
                {risk.label} (escore {score})
              </span>
            )}
          </div>
        </div>
        {expanded ? <CaretUp size={14} color={MU} /> : <CaretDown size={14} color={MU} />}
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${BO}` }}>
          {risk && (
            <div style={{
              margin: '12px 16px', padding: '10px 12px',
              background: riskBg, border: `1px solid ${riskColor}40`,
              borderRadius: 6, fontSize: 12, color: riskColor, fontWeight: 600,
            }}>
              {risk.label} — {risk.conduct}
            </div>
          )}

          {MCHAT_QUESTIONS.map(q => {
            const status = records[q.key]?.status ?? 'nao_verificado';
            const isRisk = status !== 'nao_verificado' && (
              (status === 'presente' ? 'sim' : 'nao') === q.riskAnswer
            );

            return (
              <div key={q.key} style={{
                borderBottom: `1px solid ${BO}`, padding: '10px 16px',
                background: isRisk ? `${DANGER}08` : 'transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 11, color: MU, fontWeight: 700, minWidth: 20, paddingTop: 2 }}>
                    {q.number}.
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: INK, lineHeight: 1.5 }}>
                    {q.text}
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {(['presente', 'ausente'] as const).map(s => {
                      const label = s === 'presente' ? 'SIM' : 'NÃO';
                      const active = status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => onToggle(q.key)}
                          style={{
                            padding: '3px 10px', fontSize: 11, fontWeight: 700,
                            borderRadius: 4, cursor: 'pointer',
                            border: active ? 'none' : `1px solid ${BO}`,
                            background: active
                              ? (s === 'presente' ? SUC : DANGER)
                              : '#fff',
                            color: active ? '#fff' : MU,
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                    {status !== 'nao_verificado' && (
                      <button
                        onClick={() => onToggle(q.key)}
                        style={{
                          padding: '3px 6px', fontSize: 11,
                          borderRadius: 4, cursor: 'pointer',
                          border: `1px solid ${BO}`, background: '#fff', color: MU,
                        }}
                        title="Limpar"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  patientId: string;
  patientBirthDate: string;
  doctorId: string;
  consultationId?: string | null;
}

export function DevelopmentTab({ patientId, patientBirthDate, doctorId, consultationId }: Props) {
  const [records, setRecords] = useState<Record<string, MilestoneRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ageMonths = ageInMonths(patientBirthDate);
  const showMchat = ageMonths >= 16 && ageMonths <= 30;

  useEffect(() => {
    setLoading(true);
    db.fetchDevelopmentMilestones(patientId)
      .then(setRecords)
      .catch(() => setError('Erro ao carregar marcos de desenvolvimento.'))
      .finally(() => setLoading(false));
  }, [patientId]);

  const handleToggle = useCallback(async (key: string) => {
    const current = records[key]?.status ?? 'nao_verificado';

    // M-CHAT-R uses binary SIM/NÃO: toggle presente↔ausente, limpar via × (sets to nao_verificado)
    const isMchat = key.startsWith('mchat_');
    let next: MilestoneStatus;
    if (isMchat) {
      next = current === 'presente' ? 'ausente'
           : current === 'ausente'  ? 'nao_verificado'
           : 'presente';
    } else {
      next = nextStatus(current);
    }

    // Optimistic update
    setRecords(prev => ({
      ...prev,
      [key]: { milestone_key: key, status: next, checked_at: next !== 'nao_verificado' ? new Date().toISOString() : null, notes: null },
    }));
    setSaving(key);

    try {
      await db.upsertMilestone({ patientId, doctorId, milestoneKey: key, status: next, consultationId });
    } catch {
      // Revert on error
      setRecords(prev => ({ ...prev, [key]: { milestone_key: key, status: current, checked_at: null, notes: null } }));
      setError('Erro ao salvar. Tente novamente.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(null);
    }
  }, [records, patientId, doctorId, consultationId]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: MU }}>
        <Spinner size={24} style={{ display: 'block', margin: '0 auto 8px' }} />
        Carregando marcos…
      </div>
    );
  }

  // Age too old for any milestone tracking
  if (ageMonths > 72) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: MU }}>
        <CheckSquare size={32} color={SUC} style={{ display: 'block', margin: '0 auto 12px' }} />
        <div style={{ fontWeight: 600, color: INK, marginBottom: 4 }}>Instrumento de vigilância até 72 meses</div>
        <div style={{ fontSize: 13 }}>A caderneta de vigilância do desenvolvimento cobre 0–72 meses. Continue acompanhamento pelo aprendizado escolar e socialização.</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Toast error */}
      {error && (
        <div style={{
          margin: '0 0 12px', padding: '10px 14px',
          background: DANGERL, border: `1px solid ${DANGER}40`,
          borderRadius: 6, fontSize: 12, color: DANGER, fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap',
        padding: '10px 14px', background: BG, borderRadius: 8, border: `1px solid ${BO}`,
      }}>
        <span style={{ fontSize: 12, color: MU, marginRight: 4 }}>
          Faixa atual: <strong style={{ color: INK }}>
            {MILESTONE_GROUPS.find(g => ageMonths >= g.minMonths && ageMonths < g.maxMonths)?.label ?? '—'}
          </strong>
          {' · '}
          <strong style={{ color: INK }}>{ageMonths} meses</strong>
        </span>
        {saving && (
          <span style={{ fontSize: 11, color: MU, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Spinner size={12} /> salvando…
          </span>
        )}
      </div>

      {/* Milestone groups */}
      {MILESTONE_GROUPS.map(group => {
        const isCurrent = ageMonths >= group.minMonths && ageMonths < group.maxMonths;
        const isPast    = group.maxMonths <= ageMonths;
        const isFuture  = group.minMonths > ageMonths;
        return (
          <GroupCard
            key={group.id}
            group={group}
            records={records}
            isCurrent={isCurrent}
            isPast={isPast}
            isFuture={isFuture}
            ageMonths={ageMonths}
            onToggle={handleToggle}
            defaultExpanded={isCurrent}
          />
        );
      })}

      {/* M-CHAT-R */}
      {showMchat && (
        <>
          <div style={{ margin: '20px 0 10px', fontSize: 11, fontWeight: 700, color: MU, letterSpacing: 1, textTransform: 'uppercase' }}>
            Rastreio complementar
          </div>
          <MchatSection records={records} onToggle={handleToggle} />
        </>
      )}

      <p style={{ fontSize: 11, color: MU, marginTop: 16, lineHeight: 1.6 }}>
        Fonte: Caderneta de Saúde da Criança (Menino), 7ª ed., Ministério da Saúde.
        M-CHAT-R™ © 2009 Robins, Fein &amp; Barton — tradução Losapio et al. 2020.
      </p>
    </div>
  );
}
