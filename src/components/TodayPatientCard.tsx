import React, { useState } from 'react';
import {
  CaretDown, CaretUp, Stethoscope, FileText, Warning,
  Phone, Syringe, ArrowClockwise, CalendarBlank,
  CheckCircle, Info, Pill, Flask, HeartHalf,
} from '@phosphor-icons/react';
import type { DayBriefingItem } from '../lib/db';
import type { Patient } from '../data/mock';

// ── Design tokens (espelhados de App.tsx) ─────────────────────────────────────
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
export interface TodayAppt {
  id: string;
  time: string;
  patient_id: string;
  patient_name: string;
  patient_birth_date: string;
  age: string;
  type: 'retorno' | 'primeira vez';
  status: 'completed' | 'confirmed' | 'in_progress' | 'scheduled';
  guardian: string;
  guardian_phone: string;
}

interface Props {
  appt: TodayAppt;
  patient: Patient | undefined;
  briefing: DayBriefingItem | undefined;
  defaultExpanded: boolean;
  onStart: () => void;
  onRecord: () => void;
  specialty?: string;
  onImportExams?: () => void;
  onCreateProblem?: () => void;
}

const CLINICA_GERAL_CHECKLIST = [
  'Queixa principal e história da doença atual',
  'Antecedentes pessoais e cirúrgicos',
  'Medicações em uso',
  'Alergias',
  'Hábitos de vida (atividade física, alimentação, sono, tabagismo, álcool)',
  'Histórico familiar relevante',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function retornoDays(retornoStr: string, lastConsultDate: string): number | null {
  if (!retornoStr || !lastConsultDate) return null;
  // Tenta parsear "30 dias", "2 semanas", etc.
  const m30 = retornoStr.match(/(\d+)\s*dia/i);
  const m2w = retornoStr.match(/(\d+)\s*semana/i);
  const m1m = retornoStr.match(/(\d+)\s*m[eê]s/i);
  let days: number | null = null;
  if (m30) days = parseInt(m30[1]);
  else if (m2w) days = parseInt(m2w[1]) * 7;
  else if (m1m) days = parseInt(m1m[1]) * 30;
  if (!days) return null;
  const base = new Date(lastConsultDate);
  const due = new Date(base.getTime() + days * 86400000);
  return Math.floor((new Date().getTime() - due.getTime()) / 86400000);
}

function detectAllergy(notes: string): string | null {
  if (!notes) return null;
  const m = notes.match(/alergi[a-z]*[^\n.;,]{0,60}/i);
  return m ? m[0].trim() : null;
}

// ── Sub-componentes menores ───────────────────────────────────────────────────
function SmallBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
      background: bg, color, whiteSpace: 'nowrap' as const, flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

function BlockTitle({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: MU, textTransform: 'uppercase' as const,
      letterSpacing: 0.8, marginBottom: 8, marginTop: 14,
    }}>
      {label}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 12, marginBottom: 4 }}>
      <span style={{ color: MU, flexShrink: 0 }}>{label}</span>
      <span style={{ color: INK, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ── TodayPatientCard ──────────────────────────────────────────────────────────
export function TodayPatientCard({ appt, patient, briefing, defaultExpanded, onStart, onRecord, specialty = 'Pediatria', onImportExams, onCreateProblem }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isDone       = appt.status === 'completed';
  const isInProgress = appt.status === 'in_progress';
  const isConfirmed  = appt.status === 'confirmed';
  const isPrimeira   = appt.type === 'primeira vez';
  const isClinicaGeral = specialty !== 'Pediatria';
  const allergy      = detectAllergy(patient?.notes || '');

  // Alertas clínicos
  const overdueVaccs   = briefing?.overdueVaccines ?? [];
  const retornoLag     = briefing?.lastConsult
    ? retornoDays(briefing.lastConsult.retorno, briefing.lastConsult.date)
    : null;
  const hasAlerts      = overdueVaccs.length > 0 || (retornoLag !== null && retornoLag > 0) || !!allergy;
  const alertCount     = (overdueVaccs.length > 0 ? 1 : 0) + (retornoLag !== null && retornoLag > 0 ? 1 : 0) + (allergy ? 1 : 0);

  // Cor da borda lateral por estado
  const borderColor = isDone ? SUC : isInProgress ? P : isConfirmed ? WARN : hasAlerts ? DANGER : BO;

  return (
    <div style={{
      borderBottom: `1px solid ${BO}`,
      borderLeft: `3px solid ${borderColor}`,
      background: isDone ? `${SUC}06` : isInProgress ? PL : isConfirmed ? WARNL : '#fff',
      transition: 'background 0.15s',
    }}>

      {/* ── Cabeçalho (sempre visível) ── */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '13px 18px 13px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer',
        }}
      >
        {/* Hora */}
        <span style={{
          fontSize: 14, fontWeight: 700, width: 44, flexShrink: 0,
          color: isDone ? MU : isInProgress ? P : INK,
          fontFamily: '"JetBrains Mono", monospace',
          fontFeatureSettings: '"tnum"',
        }}>
          {appt.time}
        </span>

        <div style={{ width: 1, height: 30, background: BO, flexShrink: 0 }} />

        {/* Nome + info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: INK }}>{appt.patient_name}</span>
            {appt.age && <span style={{ fontSize: 12, color: MU }}>· {appt.age}</span>}
            <SmallBadge
              label={isPrimeira ? '1ª Vez' : 'Retorno'}
              color={isPrimeira ? WARN : P}
              bg={isPrimeira ? WARNL : PL}
            />
            {isDone && <SmallBadge label="Realizada" color={SUC} bg={SUCL} />}
            {isInProgress && <SmallBadge label="Em consulta" color={P} bg={PL} />}
            {isConfirmed && <SmallBadge label="Na sala de espera" color={WARN} bg={WARNL} />}
            {hasAlerts && !isDone && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
                background: DANGERL, color: DANGER,
              }}>
                <Warning size={10} weight="fill" /> {alertCount} alerta{alertCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {!expanded && appt.guardian && (
            <div style={{ fontSize: 11, color: MU, marginTop: 2 }}>Resp: {appt.guardian}</div>
          )}
        </div>

        {/* Botões de ação + toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!isDone && !isInProgress && (
            <button
              onClick={e => { e.stopPropagation(); onStart(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', background: P, border: 'none',
                borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: '#fff', fontFamily: 'inherit',
              }}
            >
              <Stethoscope size={13} /> Iniciar consulta
            </button>
          )}
          {(isDone || isInProgress) && (
            <button
              onClick={e => { e.stopPropagation(); onRecord(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', background: 'none',
                border: `1px solid ${BO}`, borderRadius: 7,
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: INK, fontFamily: 'inherit',
              }}
            >
              <FileText size={13} /> Prontuário
            </button>
          )}
          <span style={{ color: MU }}>
            {expanded ? <CaretUp size={15} /> : <CaretDown size={15} />}
          </span>
        </div>
      </div>

      {/* ── Conteúdo expandido ── */}
      {expanded && (
        <div style={{ padding: '0 18px 16px 20px' }}>
          <div style={{ height: 1, background: BO, marginBottom: 2 }} />

          {/* BLOCO 1 — Identificação */}
          <BlockTitle label="Identificação" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {appt.guardian && <Row label="Responsável" value={appt.guardian} />}
            {appt.guardian_phone && (
              <div style={{ display: 'flex', gap: 6, fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: MU, flexShrink: 0 }}>Telefone</span>
                <a href={`tel:${appt.guardian_phone}`} style={{ color: P, fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Phone size={11} /> {appt.guardian_phone}
                </a>
              </div>
            )}
          </div>

          {/* BLOCO 2 — Alertas clínicos */}
          {!isDone && hasAlerts && (
            <>
              <BlockTitle label="⚠ Alertas clínicos" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {allergy && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', background: DANGERL,
                    border: `1px solid ${DANGER}33`, borderRadius: 7,
                    fontSize: 12, color: DANGER, fontWeight: 600,
                  }}>
                    <Warning size={13} weight="fill" />
                    ALERGIA: {allergy}
                  </div>
                )}
                {overdueVaccs.length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '7px 10px', background: `${WARN}12`,
                    border: `1px solid ${WARN}33`, borderRadius: 7,
                    fontSize: 12, color: WARN,
                  }}>
                    <Syringe size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      <strong>{overdueVaccs.length} vacina{overdueVaccs.length > 1 ? 's' : ''} em atraso:</strong>{' '}
                      {overdueVaccs.slice(0, 4).join(', ')}{overdueVaccs.length > 4 ? ` +${overdueVaccs.length - 4}` : ''}
                    </span>
                  </div>
                )}
                {retornoLag !== null && retornoLag > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', background: WARNL,
                    border: `1px solid ${WARN}33`, borderRadius: 7,
                    fontSize: 12, color: WARN,
                  }}>
                    <ArrowClockwise size={13} />
                    Retorno vencido há {retornoLag} dia{retornoLag !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </>
          )}

          {/* BLOCO 3 — Primeira vez */}
          {isPrimeira && !isClinicaGeral && (
            <>
              <BlockTitle label="Primeira consulta" />
              <div style={{
                padding: '10px 12px', background: WARNL,
                border: `1px solid ${WARN}33`, borderRadius: 7,
                fontSize: 12, color: WARN, fontWeight: 500,
              }}>
                📋 Este é o primeiro atendimento de {appt.patient_name.split(' ')[0]} no consultório.
                Colete anamnese completa e registre histórico familiar.
              </div>
            </>
          )}
          {isPrimeira && isClinicaGeral && (
            <>
              <BlockTitle label="IA sugere coletar" />
              <div style={{
                padding: '10px 12px', background: WARNL,
                border: `1px solid ${WARN}33`, borderRadius: 7,
              }}>
                <div style={{ fontSize: 12, color: WARN, fontWeight: 600, marginBottom: 6 }}>
                  Primeira consulta — Clínica Geral
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {CLINICA_GERAL_CHECKLIST.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: INK }}>
                      <CheckCircle size={12} color={WARN} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* BLOCO 3 — Última consulta (retorno) */}
          {!isPrimeira && briefing?.lastConsult && (
            <>
              <BlockTitle label="Última consulta" />
              <div style={{
                background: BG, border: `1px solid ${BO}`, borderRadius: 8,
                padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CalendarBlank size={13} color={MU} />
                  <span style={{ fontSize: 12, color: MU }}>
                    {fmtDate(briefing.lastConsult.date)} · {briefing.lastConsult.type === 'primeira vez' ? '1ª consulta' : 'Retorno'}
                  </span>
                  {(briefing.lastConsult.peso || briefing.lastConsult.altura) && (
                    <span style={{ fontSize: 11, color: MU, marginLeft: 'auto' }}>
                      {briefing.lastConsult.peso && `${briefing.lastConsult.peso}`}
                      {briefing.lastConsult.peso && briefing.lastConsult.altura && ' · '}
                      {briefing.lastConsult.altura && `${briefing.lastConsult.altura}`}
                    </span>
                  )}
                </div>
                {briefing.lastConsult.chiefComplaint && (
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: MU }}>Motivo: </span>
                    <span style={{ color: INK }}>{briefing.lastConsult.chiefComplaint}</span>
                  </div>
                )}
                {briefing.lastConsult.diagnosis && (
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: MU }}>Diagnóstico: </span>
                    <span style={{ color: INK }}>{briefing.lastConsult.diagnosis}</span>
                  </div>
                )}
                {briefing.lastConsult.plan && (
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: MU }}>Conduta: </span>
                    <span style={{ color: INK }}>{briefing.lastConsult.plan.slice(0, 120)}{briefing.lastConsult.plan.length > 120 ? '…' : ''}</span>
                  </div>
                )}
                {briefing.lastConsult.retorno && (
                  <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${BO}` }}>
                    <ArrowClockwise size={11} color={P} />
                    <span style={{ color: MU }}>Retorno previsto: </span>
                    <span style={{ color: P, fontWeight: 600 }}>{briefing.lastConsult.retorno}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* BLOCO 4 — Contexto rápido */}
          <BlockTitle label="Contexto" />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {!isClinicaGeral && (
              <>
                <ContextChip
                  icon={<Stethoscope size={11} />}
                  label={briefing ? `${briefing.totalConsults} consulta${briefing.totalConsults !== 1 ? 's' : ''}` : '—'}
                  color={P} bg={PL}
                />
                {briefing?.lastVaccine && (
                  <ContextChip
                    icon={<Syringe size={11} />}
                    label={`${briefing.lastVaccine.name} em ${fmtDate(briefing.lastVaccine.appliedAt)}`}
                    color={SUC} bg={SUCL}
                  />
                )}
                {!briefing?.lastVaccine && (
                  <ContextChip
                    icon={<Syringe size={11} />}
                    label="Nenhuma vacina registrada"
                    color={MU} bg="#F3F4F6"
                  />
                )}
                {briefing?.lastGrowth?.weight && (
                  <ContextChip
                    icon={<Info size={11} />}
                    label={`Último peso: ${briefing.lastGrowth.weight.toFixed(1)} kg`}
                    color={MU} bg="#F3F4F6"
                  />
                )}
              </>
            )}
            {isClinicaGeral && (
              <>
                <ContextChip
                  icon={<Stethoscope size={11} />}
                  label={isPrimeira ? 'Primeira consulta no consultório' : (briefing ? `${briefing.totalConsults} consulta${briefing.totalConsults !== 1 ? 's' : ''}` : '—')}
                  color={P} bg={PL}
                />
                <ContextChip
                  icon={<HeartHalf size={11} />}
                  label={briefing?.activeProblems && briefing.activeProblems.length > 0 ? briefing.activeProblems.join(', ') : 'Sem problemas ativos registrados'}
                  color={briefing?.activeProblems?.length ? WARN : MU}
                  bg={briefing?.activeProblems?.length ? WARNL : '#F3F4F6'}
                />
                <ContextChip
                  icon={<Pill size={11} />}
                  label={briefing?.medicationsCount ? `${briefing.medicationsCount} medicação${briefing.medicationsCount !== 1 ? 'ões' : ''} em uso` : 'Sem medicações registradas'}
                  color={briefing?.medicationsCount ? P : MU}
                  bg={briefing?.medicationsCount ? PL : '#F3F4F6'}
                />
                <ContextChip
                  icon={<Flask size={11} />}
                  label={briefing?.hasRecentExam ? 'Exame recente registrado' : 'Sem exames registrados'}
                  color={briefing?.hasRecentExam ? SUC : MU}
                  bg={briefing?.hasRecentExam ? SUCL : '#F3F4F6'}
                />
              </>
            )}
          </div>

          {/* BLOCO 5 — Ações rápidas (Clínica Geral) */}
          {isClinicaGeral && (onImportExams || onCreateProblem) && (
            <>
              <BlockTitle label="Ações rápidas" />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                <button
                  onClick={e => { e.stopPropagation(); onRecord(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'none', border: `1px solid ${BO}`, borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: INK, fontFamily: 'inherit' }}
                >
                  <FileText size={13} /> Anamnese completa
                </button>
                {onImportExams && (
                  <button
                    onClick={e => { e.stopPropagation(); onImportExams(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'none', border: `1px solid ${BO}`, borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: INK, fontFamily: 'inherit' }}
                  >
                    <Flask size={13} /> Importar exames
                  </button>
                )}
                {onCreateProblem && (
                  <button
                    onClick={e => { e.stopPropagation(); onCreateProblem(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'none', border: `1px solid ${BO}`, borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: INK, fontFamily: 'inherit' }}
                  >
                    <HeartHalf size={13} /> Criar problema ativo
                  </button>
                )}
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}

function ContextChip({ icon, label, color, bg }: {
  icon: React.ReactNode; label: string; color: string; bg: string;
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 500, padding: '4px 9px',
      borderRadius: 99, background: bg, color,
    }}>
      {icon} {label}
    </span>
  );
}
