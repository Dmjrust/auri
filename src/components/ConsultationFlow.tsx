/**
 * ConsultationFlow — telas do fluxo de gravação e revisão de consulta
 *
 * Extraído de App.tsx para habilitar code-splitting por rota e melhorar
 * a legibilidade do monolito principal.
 *
 * Componentes exportados:
 *   AnamBoolSeg            — segmented control Sim/Não/N.I.
 *   AnamSelect             — <select> com estilo de anamnese
 *   ConsultTypeBadge       — badge visual "Primeira consulta" | "Retorno"
 *   AnamnesePrimeiraConsulta — ficha completa de puericultura
 *   ConsentScreen          — consentimento LGPD para gravação
 *   RecordingScreen        — microfone + timer de gravação
 *   ProcessingScreen       — etapas de processamento de áudio pela IA
 *   SummaryDoneScreen      — revisão e salvamento do prontuário gerado
 */

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import * as db from '../lib/db';
import * as ai from '../lib/ai';
import {
  Baby, FileText, Heartbeat, House, Microphone, Syringe,
  Play, Square, CheckCircle, Warning, CaretUp, CaretDown,
  Star, ArrowCounterClockwise, TrendUp, TrendDown, Minus, Stethoscope,
  Users, ArrowLeft, Plus, X, Pill, ClipboardText,
} from '@phosphor-icons/react';

import { P, PL, ACCENTL, ACCENT, INK, MU, BO, BG, SEC, SUCL, SUC, WARNL, WARN, DESL, DES } from '../lib/design';
import { fmtTimer, calcImc } from '../lib/auri-utils';
import type {
  Patient, StructuredSummary, AnamnesePrimeiraConsultaData, AnamneseAdultaData,
  ConsultaAdultoData, VitaisAdulto, ProblemaAtivo, Medication, Allergy, MedicationChange, RespostaTratamento,
} from '../data/mock';
import { defaultAnamnesePrimeiraConsulta, defaultAnamneseAdulta } from '../data/mock';
import type { MarkerComparison } from '../lib/db';
import type { IconComponent } from '../lib/types';
import { Btn, Card } from './auri-ui';
import { RequireRole } from './RequireRole';

// ─── SEGMENTED BOOL ───────────────────────────────────────────────────────────

export function AnamBoolSeg({ value, onChange }: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const opts: { v: boolean | null; l: string }[] = [
    { v: true, l: 'Sim' }, { v: false, l: 'Não' }, { v: null, l: 'N/I' }
  ];
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {opts.map(({ v, l }) => {
        const active = value === v;
        let bg = '#fff', color = MU, border = BO;
        if (active) { bg = SEC; color = INK; border = BO; }
        if (active && v === true)  { bg = SUCL;  color = SUC; border = SUC; }
        if (active && v === false) { bg = DESL;  color = DES; border = DES; }
        return (
          <button key={l} type="button" onClick={() => onChange(v)} style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: active ? 600 : 400,
            background: bg, color, border: `1px solid ${border}`,
            cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
          }}>{l}</button>
        );
      })}
    </div>
  );
}

// ─── ANAMNESE SELECT ──────────────────────────────────────────────────────────

export function AnamSelect({ value, onChange, options, aiField }: {
  value: string; onChange: (v: string) => void; options: string[]; aiField?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 6,
        border: `1px solid ${BO}`, fontFamily: 'inherit', outline: 'none',
        cursor: 'pointer', boxSizing: 'border-box' as const,
        background: aiField && value ? '#EBF5F8' : '#fff',
        borderLeft: aiField && value ? `3px solid ${P}` : undefined,
        color: value ? INK : MU,
      }}
    >
      <option value="">Não informado</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── CONSULT TYPE BADGE ───────────────────────────────────────────────────────

export function ConsultTypeBadge({ type }: { type: 'retorno' | 'primeira vez' }) {
  const isPrimeira = type === 'primeira vez';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
      background: isPrimeira ? '#DBEAFE' : SEC,
      color: isPrimeira ? '#1D4ED8' : MU,
      border: `1px solid ${isPrimeira ? '#BFDBFE' : BO}`,
    }}>
      {isPrimeira
        ? <Star size={12} weight="fill" />
        : <ArrowCounterClockwise size={12} />}
      {isPrimeira ? 'Primeira consulta' : 'Retorno'}
    </span>
  );
}

// ─── ANAMNESE PRIMEIRA CONSULTA ───────────────────────────────────────────────

export function AnamnesePrimeiraConsulta({ data, onChange }: {
  data: AnamnesePrimeiraConsultaData;
  onChange: (d: AnamnesePrimeiraConsultaData) => void;
}) {
  const ALL_SECS = ['atual', 'pregressa', 'gestacional', 'triagens', 'familiar', 'socioeconomica'] as const;
  type SecId = typeof ALL_SECS[number];

  const [openSecs, setOpenSecs] = useState<Set<SecId>>(new Set(ALL_SECS));

  const [aiFields] = useState<Set<string>>(() => {
    const s = new Set<string>();
    const mark = (k: string, v: unknown) => { if (v !== null && v !== undefined && v !== '') s.add(k); };
    Object.keys(data).forEach(k => mark(k, (data as Record<string, unknown>)[k]));
    return s;
  });

  const set = <K extends keyof AnamnesePrimeiraConsultaData>(k: K, v: AnamnesePrimeiraConsultaData[K]) =>
    onChange({ ...data, [k]: v });

  const toggleSec = (id: SecId) => setOpenSecs(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const allOpen = openSecs.size === ALL_SECS.length;
  const toggleAll = () => setOpenSecs(allOpen ? new Set() : new Set(ALL_SECS));

  const aiBorder = (k: string): React.CSSProperties =>
    aiFields.has(k) ? { background: '#EBF5F8', borderLeft: `3px solid ${P}` } : {};

  const inputBase: React.CSSProperties = {
    width: '100%', fontSize: 13, lineHeight: 1.6, padding: '7px 10px',
    border: `1px solid ${BO}`, borderRadius: 6, fontFamily: 'inherit', color: INK,
    resize: 'vertical' as const, boxSizing: 'border-box' as const, outline: 'none',
    background: '#fff',
  };

  function Lbl(text: string, k?: string) {
    return (
      <div style={{ fontSize: 12, fontWeight: 600, color: MU, marginBottom: 5, display: 'flex', gap: 5, alignItems: 'center' }}>
        {text}
        {k && aiFields.has(k) && (
          <span style={{ fontSize: 10, background: PL, color: P, padding: '1px 6px', borderRadius: 99 }}>✦ IA</span>
        )}
      </div>
    );
  }

  function Ta(k: keyof AnamnesePrimeiraConsultaData, rows = 2) {
    return (
      <textarea rows={rows} value={data[k] as string}
        onChange={e => set(k, e.target.value as AnamnesePrimeiraConsultaData[typeof k])}
        style={{ ...inputBase, ...aiBorder(k) }}
        onFocus={e => { e.target.style.borderColor = P; }}
        onBlur={e => { e.target.style.borderColor = BO; }} />
    );
  }

  function Inp(k: keyof AnamnesePrimeiraConsultaData) {
    return (
      <input type="text" value={data[k] as string}
        onChange={e => set(k, e.target.value as AnamnesePrimeiraConsultaData[typeof k])}
        style={{ ...inputBase, resize: 'none', ...aiBorder(k), paddingTop: 7, paddingBottom: 7 }}
        onFocus={e => { e.target.style.borderColor = P; }}
        onBlur={e => { e.target.style.borderColor = BO; }} />
    );
  }

  function SectionHeader(id: SecId, Icon: IconComponent, title: string) {
    const isOpen = openSecs.has(id);
    const secFieldMap: Record<SecId, string[]> = {
      atual:         ['motivo_consulta','queixa_principal_duracao','sintomas_associados'],
      pregressa:     ['internacoes','internacoes_desc','cirurgias','cirurgias_desc','alergias_medicamentos','alergias_alimentos','alergias_outras','historico_vacinal'],
      gestacional:   ['gestacoes_gpa','idade_gestacional_semanas','intercorrencias_gestacao','intercorrencias_gestacao_desc','tipo_parto','local_parto','apgar_1','apgar_5'],
      triagens:      ['teste_pezinho','teste_orelhinha','teste_olhinho','teste_coracaozinho'],
      familiar:      ['doencas_familia','alergia_familia','alergia_familia_desc','outras_condicoes_familia'],
      socioeconomica:['profissao_responsaveis','renda_familiar','tabagismo_passivo','animal_domestico','animal_domestico_qual','agua_saneamento'],
    };
    const aiCount = secFieldMap[id].filter(f => aiFields.has(f)).length;
    return (
      <button onClick={() => toggleSec(id)} style={{
        width: '100%', padding: '13px 20px', display: 'flex', alignItems: 'center', gap: 10,
        background: isOpen ? '#fff' : BG, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        borderBottom: isOpen ? `1px solid ${BO}` : 'none',
      }}>
        <span style={{ width: 28, height: 28, borderRadius: 7, background: PL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={14} color={P} />
        </span>
        <span style={{ fontWeight: 600, fontSize: 14, color: INK, flex: 1, textAlign: 'left' as const }}>{title}</span>
        {aiCount > 0 && (
          <span style={{ fontSize: 11, background: PL, color: P, padding: '2px 8px', borderRadius: 99 }}>
            {aiCount} campo{aiCount !== 1 ? 's' : ''} preenchido{aiCount !== 1 ? 's' : ''} pela IA
          </span>
        )}
        {isOpen ? <CaretUp size={15} color={MU} /> : <CaretDown size={15} color={MU} />}
      </button>
    );
  }

  const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
  const full: React.CSSProperties = { gridColumn: '1 / -1' };
  const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };
  const pad: React.CSSProperties = { padding: '16px 20px' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={16} color={P} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Ficha de anamnese — primeira consulta</span>
        </div>
        <button onClick={toggleAll} style={{
          background: 'none', border: `1px solid ${BO}`, borderRadius: 6, padding: '5px 12px',
          fontSize: 12, color: MU, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          {allOpen ? 'Recolher tudo' : 'Expandir tudo'}
        </button>
      </div>

      {/* 1 — História atual */}
      <Card style={{ marginBottom: 8, overflow: 'hidden' }}>
        {SectionHeader('atual', Heartbeat, '1. História atual')}
        {openSecs.has('atual') && (
          <div style={{ ...pad, ...g2 }}>
            <div>{Lbl('Motivo da consulta', 'motivo_consulta')}{Inp('motivo_consulta')}</div>
            <div>{Lbl('Queixa principal e duração', 'queixa_principal_duracao')}{Inp('queixa_principal_duracao')}</div>
            <div style={full}>{Lbl('Sintomas associados', 'sintomas_associados')}{Ta('sintomas_associados', 3)}</div>
          </div>
        )}
      </Card>

      {/* 2 — História pregressa */}
      <Card style={{ marginBottom: 8, overflow: 'hidden' }}>
        {SectionHeader('pregressa', FileText, '2. História pregressa')}
        {openSecs.has('pregressa') && (
          <div style={{ ...pad, ...g2 }}>
            <div style={col}>
              <div>
                {Lbl('Internações anteriores', 'internacoes')}
                <AnamBoolSeg value={data.internacoes} onChange={v => set('internacoes', v)} />
                {data.internacoes === true && <div style={{ marginTop: 8 }}>{Lbl('Descreva', 'internacoes_desc')}{Ta('internacoes_desc')}</div>}
              </div>
              <div>
                {Lbl('Cirurgias anteriores', 'cirurgias')}
                <AnamBoolSeg value={data.cirurgias} onChange={v => set('cirurgias', v)} />
                {data.cirurgias === true && <div style={{ marginTop: 8 }}>{Lbl('Descreva', 'cirurgias_desc')}{Ta('cirurgias_desc')}</div>}
              </div>
            </div>
            <div style={col}>
              <div>{Lbl('Alergias a medicamentos', 'alergias_medicamentos')}{Ta('alergias_medicamentos')}</div>
              <div>{Lbl('Alergias alimentares', 'alergias_alimentos')}{Ta('alergias_alimentos')}</div>
              <div>{Lbl('Outras alergias', 'alergias_outras')}{Inp('alergias_outras')}</div>
              <div>{Lbl('Histórico vacinal prévio', 'historico_vacinal')}{Ta('historico_vacinal', 3)}</div>
            </div>
          </div>
        )}
      </Card>

      {/* 3 — História gestacional */}
      <Card style={{ marginBottom: 8, overflow: 'hidden' }}>
        {SectionHeader('gestacional', Baby, '3. História gestacional')}
        {openSecs.has('gestacional') && (
          <div style={{ ...pad, ...g2 }}>
            <div>{Lbl('Gestações (G_P_A)', 'gestacoes_gpa')}{Inp('gestacoes_gpa')}</div>
            <div>{Lbl('Semanas de gestação ao nascer', 'idade_gestacional_semanas')}{Inp('idade_gestacional_semanas')}</div>
            <div>
              {Lbl('Tipo de parto', 'tipo_parto')}
              <AnamSelect value={data.tipo_parto} onChange={v => set('tipo_parto', v)} options={['vaginal', 'cesárea']} aiField={aiFields.has('tipo_parto')} />
            </div>
            <div>{Lbl('Local do parto (maternidade)', 'local_parto')}{Inp('local_parto')}</div>
            <div style={{ ...full }}>
              {Lbl('Intercorrências na gestação', 'intercorrencias_gestacao')}
              <AnamBoolSeg value={data.intercorrencias_gestacao} onChange={v => set('intercorrencias_gestacao', v)} />
              {data.intercorrencias_gestacao === true && (
                <div style={{ marginTop: 8 }}>{Lbl('Descreva', 'intercorrencias_gestacao_desc')}{Ta('intercorrencias_gestacao_desc')}</div>
              )}
            </div>
            <div>{Lbl('Apgar 1º minuto', 'apgar_1')}{Inp('apgar_1')}</div>
            <div>{Lbl('Apgar 5º minuto', 'apgar_5')}{Inp('apgar_5')}</div>
          </div>
        )}
      </Card>

      {/* 4 — Triagens neonatais */}
      <Card style={{ marginBottom: 8, overflow: 'hidden' }}>
        {SectionHeader('triagens', Syringe, '4. Triagens neonatais')}
        {openSecs.has('triagens') && (
          <div style={{ ...pad, ...g2 }}>
            <div>
              {Lbl('Teste do pezinho', 'teste_pezinho')}
              <AnamSelect value={data.teste_pezinho} onChange={v => set('teste_pezinho', v)} options={['realizado', 'não realizado', 'aguardando resultado']} aiField={aiFields.has('teste_pezinho')} />
            </div>
            <div>
              {Lbl('Teste da orelhinha', 'teste_orelhinha')}
              <AnamSelect value={data.teste_orelhinha} onChange={v => set('teste_orelhinha', v)} options={['passou', 'falhou', 'não realizado']} aiField={aiFields.has('teste_orelhinha')} />
            </div>
            <div>
              {Lbl('Teste do olhinho', 'teste_olhinho')}
              <AnamSelect value={data.teste_olhinho} onChange={v => set('teste_olhinho', v)} options={['passou', 'falhou', 'não realizado']} aiField={aiFields.has('teste_olhinho')} />
            </div>
            <div>
              {Lbl('Teste do coraçãozinho (oximetria)', 'teste_coracaozinho')}
              <AnamSelect value={data.teste_coracaozinho} onChange={v => set('teste_coracaozinho', v)} options={['passou', 'falhou', 'não realizado']} aiField={aiFields.has('teste_coracaozinho')} />
            </div>
          </div>
        )}
      </Card>

      {/* 5 — História familiar */}
      <Card style={{ marginBottom: 8, overflow: 'hidden' }}>
        {SectionHeader('familiar', Users, '5. História familiar')}
        {openSecs.has('familiar') && (
          <div style={{ ...pad, ...g2 }}>
            <div>{Lbl('Doenças crônicas na família (por parente)', 'doencas_familia')}{Ta('doencas_familia', 4)}</div>
            <div style={col}>
              <div>
                {Lbl('Histórico de alergias na família', 'alergia_familia')}
                <AnamBoolSeg value={data.alergia_familia} onChange={v => set('alergia_familia', v)} />
                {data.alergia_familia === true && <div style={{ marginTop: 8 }}>{Lbl('Descreva', 'alergia_familia_desc')}{Ta('alergia_familia_desc')}</div>}
              </div>
              <div>{Lbl('Outras condições relevantes', 'outras_condicoes_familia')}{Ta('outras_condicoes_familia', 3)}</div>
            </div>
          </div>
        )}
      </Card>

      {/* 6 — História socioeconômica */}
      <Card style={{ marginBottom: 8, overflow: 'hidden' }}>
        {SectionHeader('socioeconomica', House, '6. História socioeconômica')}
        {openSecs.has('socioeconomica') && (
          <div style={{ ...pad, ...g2 }}>
            <div>{Lbl('Profissão dos responsáveis', 'profissao_responsaveis')}{Inp('profissao_responsaveis')}</div>
            <div>{Lbl('Renda familiar aproximada (opcional)', 'renda_familiar')}{Inp('renda_familiar')}</div>
            <div>
              {Lbl('Tabagismo passivo em casa', 'tabagismo_passivo')}
              <AnamBoolSeg value={data.tabagismo_passivo} onChange={v => set('tabagismo_passivo', v)} />
            </div>
            <div>
              {Lbl('Animal doméstico em casa', 'animal_domestico')}
              <AnamBoolSeg value={data.animal_domestico} onChange={v => set('animal_domestico', v)} />
              {data.animal_domestico === true && <div style={{ marginTop: 8 }}>{Lbl('Qual animal', 'animal_domestico_qual')}{Inp('animal_domestico_qual')}</div>}
            </div>
            <div style={full}>
              {Lbl('Acesso a água encanada e saneamento básico', 'agua_saneamento')}
              <AnamBoolSeg value={data.agua_saneamento} onChange={v => set('agua_saneamento', v)} />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── ANAMNESE ADULTA (CLÍNICA GERAL) — CAMPOS ─────────────────────────────────
// Compartilhado entre AnamneseAdultaModal (App.tsx, entrada manual) e
// SummaryDoneScreen (revisão do que a IA extraiu da gravação).

const inputStyleAdulta: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${BO}`, borderRadius: 6,
  fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const,
  background: '#fff', color: INK,
};

// ─── CLÍNICA GERAL — HELPERS DE APRESENTAÇÃO ─────────────────────────────────
// Compartilhados entre a tela de revisão (SummaryDoneScreen) e o prontuário
// salvo (ConsultationDetail em App.tsx): transformam a anamnese adulta em
// bullets exibindo apenas o que foi identificado pela IA.

export const COMORBIDADE_FIELDS: { field: keyof AnamneseAdultaData; label: string }[] = [
  { field: 'hipertensao', label: 'Hipertensão arterial' },
  { field: 'diabetes', label: 'Diabetes' },
  { field: 'dislipidemia', label: 'Dislipidemia' },
  { field: 'cardiopatia', label: 'Cardiopatia' },
  { field: 'asma_dpoc', label: 'Asma / DPOC' },
  { field: 'doenca_renal', label: 'Doença renal' },
  { field: 'doenca_cardiovascular', label: 'Doença cardiovascular' },
  { field: 'avc', label: 'AVC' },
  { field: 'cancer', label: 'Câncer' },
  { field: 'doencas_psiquiatricas', label: 'Doenças psiquiátricas' },
];

// Quebra texto livre ("losartana 50mg, sinvastatina; AAS") em itens de lista.
export const splitClinicalList = (s?: string | null): string[] =>
  (s ?? '').split(/\r?\n|;/).flatMap(part => part.split(/,(?![^(]*\))/)).map(x => x.trim()).filter(Boolean);

export function comorbidadesIdentificadas(a: AnamneseAdultaData): string[] {
  return COMORBIDADE_FIELDS.filter(({ field }) => a[field] === true).map(({ label }) => label);
}

export function habitosBullets(a: AnamneseAdultaData): string[] {
  const b: string[] = [];
  if (a.tabagismo) b.push(({ nunca: 'Nunca fumou', 'ex-fumante': 'Ex-fumante', fumante: 'Tabagista' } as const)[a.tabagismo] + (a.tabagismo_pack_years ? ` (${a.tabagismo_pack_years})` : ''));
  if (a.etilismo) b.push(({ nunca: 'Não consome álcool', ocasional: 'Consome álcool socialmente', regular: 'Consumo regular de álcool' } as const)[a.etilismo]);
  if (a.atividade_fisica === true) b.push(a.atividade_fisica_desc ? `Atividade física: ${a.atividade_fisica_desc}` : 'Pratica atividade física');
  if (a.atividade_fisica === false) b.push('Sedentário');
  if (a.sono) b.push(`Sono: ${a.sono}`);
  if (a.uso_drogas) b.push(`Drogas: ${a.uso_drogas}`);
  if (a.ocupacao) b.push(`Ocupação: ${a.ocupacao}`);
  if (a.nivel_estresse) b.push(`Estresse: ${a.nivel_estresse}`);
  return b;
}

export function rastreamentosBullets(a: AnamneseAdultaData): string[] {
  return [
    a.ultima_mamografia && `Mamografia: ${a.ultima_mamografia}`,
    a.ultimo_papanicolau && `Papanicolau: ${a.ultimo_papanicolau}`,
    a.ultima_colonoscopia && `Colonoscopia: ${a.ultima_colonoscopia}`,
    a.psa && `PSA: ${a.psa}`,
  ].filter(Boolean) as string[];
}

export type AnamneseSection = 'pregressa' | 'habitos' | 'meds' | 'familiar' | 'vacinal' | 'rastreamentos';

export function AnamneseAdultaFields({ form, set, sections }: {
  form: AnamneseAdultaData;
  set: (k: keyof AnamneseAdultaData, v: unknown) => void;
  sections?: AnamneseSection[]; // subconjunto de seções (per-card na revisão); omitido = todas (modal)
}) {
  const show = (s: AnamneseSection) => !sections || sections.includes(s);
  const BoolRow = ({ label, field }: { label: string; field: keyof AnamneseAdultaData }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${BO}` }}>
      <span style={{ fontSize: 13, color: INK }}>{label}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['Sim', 'Não'] as const).map(opt => (
          <button key={opt} type="button" onClick={() => set(field, opt === 'Sim' ? true : false)}
            style={{ padding: '4px 12px', borderRadius: 5, border: `1px solid ${BO}`, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              background: form[field] === (opt === 'Sim') ? P : '#fff', color: form[field] === (opt === 'Sim') ? '#fff' : INK }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Condições crônicas + cirurgias/internações = História Pregressa */}
      {show('pregressa') && (<>
      <section>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: 0.8 }}>Diagnósticos prévios</p>
        {COMORBIDADE_FIELDS.map(({ field, label }) => <BoolRow key={String(field)} label={label} field={field} />)}
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Outras comorbidades</label>
          <input value={form.outras_comorbidades} onChange={e => set('outras_comorbidades', e.target.value)} placeholder="Ex: hipotireoidismo, obesidade" style={inputStyleAdulta} />
        </div>
      </section>

      <section>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: 0.8 }}>Cirurgias e internações</p>
        <BoolRow label="Cirurgias prévias" field="cirurgias_previas" />
        {form.cirurgias_previas && (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <input value={form.cirurgias_desc} onChange={e => set('cirurgias_desc', e.target.value)} placeholder="Descreva as cirurgias" style={inputStyleAdulta} />
          </div>
        )}
        <BoolRow label="Internações prévias" field="internacoes_previas" />
        {form.internacoes_previas && (
          <div style={{ marginTop: 8 }}>
            <input value={form.internacoes_desc} onChange={e => set('internacoes_desc', e.target.value)} placeholder="Descreva as internações" style={inputStyleAdulta} />
          </div>
        )}
      </section>
      </>)}

      {/* Hábitos */}
      {show('habitos') && (
      <section>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: 0.8 }}>Hábitos de vida</p>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Tabagismo</label>
          <select value={form.tabagismo ?? ''} onChange={e => set('tabagismo', e.target.value || null)} style={{ ...inputStyleAdulta, background: '#fff' }}>
            <option value="">Não informado</option>
            <option value="nunca">Nunca fumou</option>
            <option value="ex-fumante">Ex-fumante</option>
            <option value="fumante">Fumante</option>
          </select>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Etilismo</label>
          <select value={form.etilismo ?? ''} onChange={e => set('etilismo', e.target.value || null)} style={{ ...inputStyleAdulta, background: '#fff' }}>
            <option value="">Não informado</option>
            <option value="nunca">Nunca</option>
            <option value="ocasional">Ocasional</option>
            <option value="regular">Regular</option>
          </select>
        </div>
        <BoolRow label="Atividade física regular" field="atividade_fisica" />
        {form.atividade_fisica && (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <input value={form.atividade_fisica_desc} onChange={e => set('atividade_fisica_desc', e.target.value)} placeholder="Ex: caminhada 3x/semana" style={inputStyleAdulta} />
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Sono</label>
          <input value={form.sono} onChange={e => set('sono', e.target.value)} placeholder="Ex: 6h/noite, sono fragmentado" style={inputStyleAdulta} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Uso de drogas</label>
          <input value={form.uso_drogas} onChange={e => set('uso_drogas', e.target.value)} placeholder="Ex: nega uso" style={inputStyleAdulta} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Ocupação</label>
          <input value={form.ocupacao} onChange={e => set('ocupacao', e.target.value)} placeholder="Ex: motorista de aplicativo" style={inputStyleAdulta} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Nível de estresse</label>
          <input value={form.nivel_estresse} onChange={e => set('nivel_estresse', e.target.value)} placeholder="Ex: alto, relacionado ao trabalho" style={inputStyleAdulta} />
        </div>
      </section>
      )}

      {/* Medicamentos e alergias */}
      {show('meds') && (
      <section>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: 0.8 }}>Medicamentos e alergias</p>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Medicamentos em uso</label>
          <textarea value={form.medicamentos_em_uso} onChange={e => set('medicamentos_em_uso', e.target.value)} placeholder="Liste os medicamentos atuais..." rows={3} style={{ ...inputStyleAdulta, resize: 'vertical' as const }} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Alergias a medicamentos</label>
          <input value={form.alergias_medicamentos} onChange={e => set('alergias_medicamentos', e.target.value)} placeholder="Ex: penicilina, dipirona" style={inputStyleAdulta} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Alergias alimentares</label>
          <input value={form.alergias_alimentares} onChange={e => set('alergias_alimentares', e.target.value)} placeholder="Ex: frutos do mar" style={inputStyleAdulta} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Outras alergias</label>
          <input value={form.alergias_outras} onChange={e => set('alergias_outras', e.target.value)} placeholder="Ex: látex" style={inputStyleAdulta} />
        </div>
      </section>
      )}

      {/* Histórico familiar */}
      {show('familiar') && (
      <section>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: 0.8 }}>Histórico familiar</p>
        <textarea value={form.historico_familiar} onChange={e => set('historico_familiar', e.target.value)} placeholder="Ex: DM2 materno, IAM paterno, CA de cólon" rows={2} style={{ ...inputStyleAdulta, resize: 'vertical' as const }} />
      </section>
      )}

      {/* Histórico vacinal */}
      {show('vacinal') && (
      <section>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: 0.8 }}>Histórico vacinal adulto</p>
        <input value={form.vacinacao_adulto} onChange={e => set('vacinacao_adulto', e.target.value)} placeholder="Ex: gripe (mês passado), COVID (2024)" style={inputStyleAdulta} />
        <p style={{ margin: '6px 0 0', fontSize: 11, color: MU }}>Menções feitas na consulta — o registro formal de cada dose fica na aba Vacinas.</p>
      </section>
      )}

      {/* Rastreamentos preventivos */}
      {show('rastreamentos') && (
      <section>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: 0.8 }}>Rastreamentos preventivos</p>
        {[
          { label: 'Última mamografia', field: 'ultima_mamografia' as keyof AnamneseAdultaData, placeholder: 'Ex: 2024 / não realizado' },
          { label: 'Último Papanicolau', field: 'ultimo_papanicolau' as keyof AnamneseAdultaData, placeholder: 'Ex: 2024' },
          { label: 'Última colonoscopia', field: 'ultima_colonoscopia' as keyof AnamneseAdultaData, placeholder: 'Ex: 2022 / nunca realizou' },
          { label: 'PSA', field: 'psa' as keyof AnamneseAdultaData, placeholder: 'Ex: 2024, 0.9 ng/mL' },
        ].map(({ label, field, placeholder }) => (
          <div key={String(field)} style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>{label}</label>
            <input value={(form[field] as string) || ''} onChange={e => set(field, e.target.value)} placeholder={placeholder} style={inputStyleAdulta} />
          </div>
        ))}
      </section>
      )}
    </div>
  );
}

// ─── CLÍNICA GERAL — EDITORES COMPARTILHADOS (problemas/medicações/alergias/vitais) ─
// Usados tanto na revisão de primeira consulta quanto na de retorno em SummaryDoneScreen.

const smallInputStyle: React.CSSProperties = {
  padding: '7px 10px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 13,
  fontFamily: 'inherit', outline: 'none', background: '#fff', color: INK, boxSizing: 'border-box' as const,
};

const statusColors: Record<ProblemaAtivo['status'], { bg: string; color: string }> = {
  ativo: { bg: WARNL, color: WARN },
  controlado: { bg: SUCL, color: SUC },
  resolvido: { bg: SEC, color: MU },
};

export function ProblemsEditor({ problems, onChange, novos }: {
  problems: ProblemaAtivo[];
  onChange: (p: ProblemaAtivo[]) => void;
  novos?: string[]; // nomes de problemas sinalizados pela IA como novos nesta consulta
}) {
  const [newName, setNewName] = useState('');
  const novosSet = new Set((novos ?? []).map(n => n.toLowerCase()));

  function addProblem() {
    if (!newName.trim()) return;
    onChange([...problems, { name: newName.trim(), status: 'ativo', updated_at: new Date().toISOString() }]);
    setNewName('');
  }
  function cycleStatus(idx: number) {
    const order: ProblemaAtivo['status'][] = ['ativo', 'controlado', 'resolvido'];
    const next = order[(order.indexOf(problems[idx].status) + 1) % order.length];
    onChange(problems.map((p, i) => i === idx ? { ...p, status: next, updated_at: new Date().toISOString() } : p));
  }
  function remove(idx: number) {
    if (!window.confirm(`Remover o problema "${problems[idx]?.name}"?`)) return;
    onChange(problems.filter((_, i) => i !== idx));
  }

  return (
    <div>
      {problems.length === 0 && <p style={{ fontSize: 13, color: MU, margin: '0 0 10px' }}>Nenhum problema ativo registrado.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {problems.map((p, i) => (
          <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${BO}`, borderRadius: 7 }}>
            <span style={{ fontSize: 13, flex: 1, color: INK }}>
              {p.name}
              {novosSet.has(p.name.toLowerCase()) && (
                <span style={{ marginLeft: 8, fontSize: 10, background: PL, color: P, padding: '1px 6px', borderRadius: 99 }}>novo</span>
              )}
            </span>
            <button type="button" onClick={() => cycleStatus(i)} style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: statusColors[p.status].bg, color: statusColors[p.status].color,
            }}>{p.status}</button>
            <button type="button" onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU, display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Adicionar problema, ex: Hipertensão arterial"
          onKeyDown={e => { if (e.key === 'Enter') addProblem(); }}
          style={{ ...smallInputStyle, flex: 1 }} />
        <Btn size="sm" variant="secondary" onClick={addProblem}><Plus size={14} /> Adicionar</Btn>
      </div>
    </div>
  );
}

export function MedicationsEditor({ medications, onChange }: {
  medications: Medication[];
  onChange: (m: Medication[]) => void;
}) {
  const [draft, setDraft] = useState({ name: '', dosage: '', frequency: '' });

  function add() {
    if (!draft.name.trim()) return;
    onChange([...medications, { name: draft.name.trim(), dosage: draft.dosage.trim() || undefined, frequency: draft.frequency.trim() || undefined, status: 'active' }]);
    setDraft({ name: '', dosage: '', frequency: '' });
  }
  function setStatus(idx: number, status: Medication['status']) {
    onChange(medications.map((m, i) => i === idx ? { ...m, status } : m));
  }
  function remove(idx: number) {
    if (!window.confirm(`Remover a medicação "${medications[idx]?.name}"?`)) return;
    onChange(medications.filter((_, i) => i !== idx));
  }

  return (
    <div>
      {medications.length === 0 && <p style={{ fontSize: 13, color: MU, margin: '0 0 10px' }}>Nenhuma medicação registrada.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {medications.map((m, i) => (
          <div key={`${m.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${BO}`, borderRadius: 7 }}>
            <Pill size={14} color={P} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, flex: 1, color: INK }}>
              {m.name}{m.dosage ? ` — ${m.dosage}` : ''}{m.frequency ? ` · ${m.frequency}` : ''}
            </span>
            <select value={m.status ?? 'active'} onChange={e => setStatus(i, e.target.value as Medication['status'])}
              style={{ ...smallInputStyle, padding: '3px 8px', fontSize: 11 }}>
              <option value="active">Ativo</option>
              <option value="paused">Suspenso</option>
              <option value="discontinued">Descontinuado</option>
            </select>
            <button type="button" onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU, display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Medicamento" style={{ ...smallInputStyle, flex: 2, minWidth: 140 }} />
        <input value={draft.dosage} onChange={e => setDraft(d => ({ ...d, dosage: e.target.value }))} placeholder="Dose" style={{ ...smallInputStyle, flex: 1, minWidth: 80 }} />
        <input value={draft.frequency} onChange={e => setDraft(d => ({ ...d, frequency: e.target.value }))} placeholder="Frequência" style={{ ...smallInputStyle, flex: 1, minWidth: 100 }} />
        <Btn size="sm" variant="secondary" onClick={add}><Plus size={14} /> Adicionar</Btn>
      </div>
    </div>
  );
}

export function AllergiesEditor({ allergies, onChange }: {
  allergies: Allergy[];
  onChange: (a: Allergy[]) => void;
}) {
  const [draft, setDraft] = useState({ allergen: '', reaction: '' });

  function add() {
    if (!draft.allergen.trim()) return;
    onChange([...allergies, { allergen: draft.allergen.trim(), reaction: draft.reaction.trim() || undefined }]);
    setDraft({ allergen: '', reaction: '' });
  }
  function remove(idx: number) {
    if (!window.confirm(`Remover a alergia "${allergies[idx]?.allergen}"?`)) return;
    onChange(allergies.filter((_, i) => i !== idx));
  }

  return (
    <div>
      {allergies.length === 0 && <p style={{ fontSize: 13, color: MU, margin: '0 0 10px' }}>Nenhuma alergia registrada.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {allergies.map((a, i) => (
          <div key={`${a.allergen}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${DES}40`, background: DESL, borderRadius: 7 }}>
            <span style={{ fontSize: 13, flex: 1, color: INK }}>
              {a.allergen}{a.reaction ? ` — ${a.reaction}` : ''}
            </span>
            <button type="button" onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU, display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={draft.allergen} onChange={e => setDraft(d => ({ ...d, allergen: e.target.value }))} placeholder="Substância" style={{ ...smallInputStyle, flex: 1 }} />
        <input value={draft.reaction} onChange={e => setDraft(d => ({ ...d, reaction: e.target.value }))} placeholder="Reação (opcional)" style={{ ...smallInputStyle, flex: 1 }} />
        <Btn size="sm" variant="secondary" onClick={add}><Plus size={14} /> Adicionar</Btn>
      </div>
    </div>
  );
}

// Grupos do Exame Objetivo: sinais vitais e antropometria são cards separados.
export const VITAL_SIGN_KEYS: (keyof VitaisAdulto)[] = ['pressao_arterial', 'frequencia_cardiaca', 'frequencia_respiratoria', 'saturacao', 'temperatura'];
export const ANTHRO_KEYS: (keyof VitaisAdulto)[] = ['peso', 'altura', 'imc', 'circunferencia_abdominal'];

export const VITAL_FIELD_DEFS: { key: keyof VitaisAdulto; label: string; placeholder: string }[] = [
  { key: 'pressao_arterial', label: 'Pressão arterial', placeholder: '130/85 mmHg' },
  { key: 'frequencia_cardiaca', label: 'Freq. cardíaca', placeholder: '78 bpm' },
  { key: 'frequencia_respiratoria', label: 'Freq. respiratória', placeholder: '18 irpm' },
  { key: 'saturacao', label: 'Saturação', placeholder: '97%' },
  { key: 'temperatura', label: 'Temperatura', placeholder: '36.8°C' },
  { key: 'peso', label: 'Peso', placeholder: '82 kg' },
  { key: 'altura', label: 'Altura', placeholder: '172 cm' },
  { key: 'circunferencia_abdominal', label: 'Circ. abdominal', placeholder: '98 cm' },
];

export function VitalsGrid({ vitals, onChange, fields }: {
  vitals: VitaisAdulto;
  onChange: (v: VitaisAdulto) => void;
  fields?: (keyof VitaisAdulto)[]; // subconjunto (ex.: só sinais vitais); omitido = todos
}) {
  const set = (k: keyof VitaisAdulto, val: string) => {
    const next = { ...vitals, [k]: val };
    if (k === 'peso' || k === 'altura') next.imc = calcImc(next.peso ?? '', next.altura ?? '') || undefined;
    onChange(next);
  };
  const visible = VITAL_FIELD_DEFS.filter(f => !fields || fields.includes(f.key));
  const showImc = !fields || fields.includes('imc');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
      {visible.map(({ key, label, placeholder }) => (
        <div key={key}>
          <label style={{ display: 'block', fontSize: 11, color: MU, marginBottom: 4 }}>{label}</label>
          <input value={vitals[key] ?? ''} onChange={e => set(key, e.target.value)} placeholder={placeholder} style={{ ...smallInputStyle, width: '100%' }} />
        </div>
      ))}
      {showImc && (
        <div>
          <label style={{ display: 'block', fontSize: 11, color: MU, marginBottom: 4 }}>IMC (calculado)</label>
          <div style={{ ...smallInputStyle, background: BG, color: MU }}>{vitals.imc || '—'}</div>
        </div>
      )}
    </div>
  );
}

// ─── REVIEW CARD — card com resumo identificado + edição expansível ──────────
// Padrão da tela de revisão: mostra bullets do que a IA identificou; o link
// "+ editar campos" expande o formulário completo daquele bloco.
export function ReviewCard({ icon: Icon, title, subtitle, children, editor, defaultOpen }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  editor?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [editing, setEditing] = useState(!!defaultOpen);
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={15} color={P} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11, color: MU }}>{subtitle}</span>}
        {editor && (
          <button type="button" onClick={() => setEditing(v => !v)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: P, fontWeight: 600 }}>
            {editing ? 'ocultar campos' : '+ editar campos'}
          </button>
        )}
      </div>
      <div style={{ padding: '14px 20px' }}>
        {children}
        {editing && editor && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px dashed ${BO}` }}>{editor}</div>
        )}
      </div>
    </Card>
  );
}

export function Bullets({ items, empty }: { items: React.ReactNode[]; empty?: string }) {
  if (items.length === 0) {
    return empty ? <p style={{ fontSize: 13, color: MU, margin: 0 }}>{empty}</p> : null;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((it, i) => <li key={i} style={{ fontSize: 13, color: INK, lineHeight: 1.5 }}>{it}</li>)}
    </ul>
  );
}

const RESPOSTA_LABELS: Record<RespostaTratamento, string> = {
  boa: 'Boa resposta', parcial: 'Resposta parcial', sem_resposta: 'Sem resposta',
  piora: 'Piora clínica', baixa_adesao: 'Baixa adesão', efeitos_adversos: 'Efeitos adversos',
};

export function MedicationChangesEditor({ changes, onChange }: {
  changes: MedicationChange[];
  onChange: (c: MedicationChange[]) => void;
}) {
  const actionLabels: Record<MedicationChange['action'], string> = {
    iniciada: 'Iniciada', aumentada: 'Aumentada', reduzida: 'Reduzida', suspensa: 'Suspensa', mantida: 'Mantida',
  };
  function remove(idx: number) { onChange(changes.filter((_, i) => i !== idx)); }
  if (changes.length === 0) return <p style={{ fontSize: 13, color: MU, margin: 0 }}>Nenhuma mudança de medicação identificada nesta consulta.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {changes.map((c, i) => (
        <div key={`${c.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${BO}`, borderRadius: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: PL, color: P, flexShrink: 0 }}>{actionLabels[c.action]}</span>
          <span style={{ fontSize: 13, flex: 1, color: INK }}>{c.name}{c.reason ? ` — ${c.reason}` : ''}</span>
          <button type="button" onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU, display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

const trendIcon = (trend: MarkerComparison['trend']) =>
  trend === 'melhora' ? <TrendDown size={14} color={SUC} /> : trend === 'piora' ? <TrendUp size={14} color={DES} /> : <Minus size={14} color={MU} />;

export function MarkerComparisonsCard({ comparisons }: { comparisons: MarkerComparison[] }) {
  if (comparisons.length === 0) {
    return <p style={{ fontSize: 13, color: MU, margin: 0 }}>Sem exames com pelo menos 2 resultados registrados para comparar.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {comparisons.map(c => (
        <div key={c.marker_name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: `1px solid ${BO}`, borderRadius: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: INK, flex: 1 }}>{c.marker_name}</span>
          <span style={{ fontSize: 13, color: MU, fontFamily: 'monospace' }}>
            {c.previous.value}{c.previous.unit} → {c.current.value}{c.current.unit}
          </span>
          {trendIcon(c.trend)}
        </div>
      ))}
    </div>
  );
}

// ─── CONSENT SCREEN ───────────────────────────────────────────────────────────

export function ConsentScreen({ onOk, onCancel, consultType }: {
  onOk: () => void; onCancel: () => void; consultType: 'retorno' | 'primeira vez';
}) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card style={{ maxWidth: 520, width: '90%', padding: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <ConsultTypeBadge type={consultType} />
        </div>
        <div style={{ textAlign: 'center' as const, marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: PL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Microphone size={24} color={P} />
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>Consentimento para gravação</h2>
          <p style={{ margin: '10px 0 0', color: MU, fontSize: 14, lineHeight: 1.6 }}>
            Esta consulta será gravada e transcrita por IA para gerar o resumo clínico automaticamente.
          </p>
        </div>
        <div style={{ background: SEC, borderRadius: 10, padding: 20, marginBottom: 24, fontSize: 13, lineHeight: 1.7, color: MU }}>
          <strong>O que acontece com o áudio:</strong><br />
          • O áudio é enviado de forma criptografada à OpenAI (EUA) para transcrição — transferência internacional de dados, conforme LGPD Art. 33<br />
          • A OpenAI pode reter o áudio por até 30 dias para fins de segurança; não o utiliza para treinar modelos<br />
          • Nossa cópia do áudio é apagada imediatamente após a transcrição; apenas o texto estruturado é salvo no prontuário<br />
          • O médico revisa e valida o resumo antes de salvar (IA como apoio, CFM 2.454/2026)<br />
          • Este consentimento fica registrado com data, hora e versão do termo<br />
          • É possível recusar e preencher o prontuário manualmente, sem gravação
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 28, fontSize: 14 }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: 2, accentColor: P, width: 16, height: 16 }} />
          <span>O paciente ou responsável foi informado sobre a gravação, a transcrição por IA (OpenAI/EUA) e o registro deste consentimento, e concordou com o uso para fins de documentação médica.</span>
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <Btn variant="secondary" onClick={onCancel} style={{ flex: 1, justifyContent: 'center' }}>Cancelar</Btn>
          <Btn onClick={onOk} disabled={!agreed} style={{ flex: 1, justifyContent: 'center' }}>
            <Microphone size={15} /> Iniciar gravação
          </Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── RECORDING SCREEN ─────────────────────────────────────────────────────────

export function RecordingScreen({ time, patient, consultType, onFinish, onCancel, onMicReady }: {
  time: number; patient: Patient | null;
  consultType: 'retorno' | 'primeira vez';
  onFinish: (blob: Blob) => void;
  onCancel: () => void;
  onMicReady?: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const [micError, setMicError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const streamRef   = useRef<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream;
        // Opus a 24kbps mantém boa qualidade de voz e cobre ~2h20 de consulta
        // dentro do limite de 25MB da API Whisper (ver MAX_AUDIO_BYTES em ai.ts).
        const recorder = new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
        recorderRef.current = recorder;
        recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.start(1000);
        onMicReady?.();
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
          <img src="/brand/auri-logo-full.svg" alt="Auri" style={{ height: 36 }} />
          <span style={{ color: BO }}>|</span>
          <span style={{ fontSize: 14, color: MU }}>Em consulta — {patient?.full_name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ConsultTypeBadge type={consultType} />
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 18, fontWeight: 600, color: P, letterSpacing: 2 }}>
            {fmtTimer(time)}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px', textAlign: 'center' as const }}>
        {micError ? (
          <div>
            <div style={{ background: DESL, color: DES, borderRadius: 12, padding: 24, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              <Warning size={24} style={{ marginBottom: 12 }} /><br />{micError}
            </div>
            <Btn variant="secondary" onClick={onCancel} size="lg">
              <ArrowLeft size={16} /> Voltar
            </Btn>
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
            <p style={{ color: MU, fontSize: 14, marginBottom: 32 }}>
              {paused ? 'Clique em continuar para retomar.' : 'O áudio está sendo capturado. Fale normalmente com o paciente.'}
            </p>
            {!paused && (
              <div className="recording-wave" style={{ justifyContent: 'center', marginBottom: 32 }}>
                {[16, 28, 20, 36, 24, 32, 18].map((_, i) => <span key={i} />)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const }}>
              <Btn variant="secondary" onClick={onCancel} size="lg">
                <ArrowLeft size={16} /> Cancelar
              </Btn>
              <Btn variant="secondary" onClick={togglePause} size="lg">
                {paused ? <><Play size={16} /> Continuar</> : <><Square size={16} /> Pausar</>}
              </Btn>
              <Btn variant="danger" onClick={handleFinish} size="lg">
                <CheckCircle size={16} /> Finalizar consulta
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── PROCESSING SCREEN ────────────────────────────────────────────────────────

export function ProcessingScreen({ audioBlob, onDone, onRetry, consultType, specialty = 'Pediatria', patientId }: {
  audioBlob: Blob | null;
  onDone: (summary: StructuredSummary, transcript: string, anamnese?: AnamnesePrimeiraConsultaData, anamneseError?: string | null, anamneseAdulta?: AnamneseAdultaData) => void;
  onRetry: () => void;
  consultType: 'retorno' | 'primeira vez';
  specialty?: string;
  patientId?: string;
}) {
  const [step, setStep]   = useState(0);
  const [error, setError] = useState('');
  const isPrimeira = consultType === 'primeira vez';
  const isAdultSpecialty = specialty !== 'Pediatria';
  const steps = isPrimeira
    ? ['Enviando áudio para transcrição…', 'Transcrevendo consulta…', 'Estruturando prontuário…', isAdultSpecialty ? 'Preenchendo ficha de anamnese…' : 'Preenchendo ficha de puericultura…', 'Finalizando resumo clínico…']
    : isAdultSpecialty
      ? ['Enviando áudio para transcrição…', 'Transcrevendo consulta…', 'Comparando com a última consulta…', 'Finalizando resumo clínico…']
      : ['Enviando áudio para transcrição…', 'Transcrevendo consulta…', 'Estruturando prontuário…', 'Finalizando resumo clínico…'];

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
        const isAdult = specialty !== 'Pediatria';
        const previousState = (!isPrimeira && isAdult && patientId)
          ? await db.fetchCurrentAdultState(patientId).catch(() => undefined)
          : undefined;
        const summary = await ai.structureSummary(transcript, specialty, consultType, previousState);

        if (cancelled) return;

        if (isPrimeira) {
          setStep(3);
          let anamneseError: string | null = null;
          if (isAdult) {
            const anamneseAdulta = await ai.extractAnamneseAdulta(transcript)
              .catch((e: unknown) => {
                anamneseError = (e as Error)?.message || 'Falha ao extrair a ficha de anamnese.';
                return defaultAnamneseAdulta();
              });
            if (cancelled) return;
            setStep(4);
            await new Promise(r => setTimeout(r, 400));
            if (!cancelled) onDone(summary, transcript, undefined, anamneseError, anamneseAdulta);
          } else {
            const anamnese = await ai.extractAnamnesePrimeiraConsulta(transcript)
              .catch((e: unknown) => {
                anamneseError = (e as Error)?.message || 'Falha ao extrair a ficha de anamnese.';
                return defaultAnamnesePrimeiraConsulta();
              });
            if (cancelled) return;
            setStep(4);
            await new Promise(r => setTimeout(r, 400));
            if (!cancelled) onDone(summary, transcript, anamnese, anamneseError);
          }
        } else {
          setStep(3);
          await new Promise(r => setTimeout(r, 400));
          if (!cancelled) onDone(summary, transcript);
        }
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error)?.message || 'Erro ao processar consulta.');
      }
    }
    run();
    return () => { cancelled = true; };
  }, [specialty]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape hatch: quando a IA falha (ex.: áudio acima de 25MB) e o paciente já
  // foi embora, "Tentar novamente" volta para a gravação — sem utilidade. Esta
  // opção segue para a revisão do prontuário em branco, para o médico preencher
  // manualmente com base na consulta.
  function handleContinueWithoutAI() {
    const emptySummary: StructuredSummary = {
      queixa_principal: '', hda: '', exame_fisico: '',
      hipoteses: [], conduta: '', retorno: '',
      peso: '', altura: '', perimetro_cefalico: '', vacinas_mencionadas: [],
      specialty_data: null,
    };
    const isAdult = specialty !== 'Pediatria';
    onDone(
      emptySummary, '',
      isPrimeira && !isAdult ? defaultAnamnesePrimeiraConsulta() : undefined,
      null,
      isPrimeira && isAdult ? defaultAnamneseAdulta() : undefined,
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' as const, maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <ConsultTypeBadge type={consultType} />
        </div>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: PL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Heartbeat size={28} color={P} />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 500 }}>Processando consulta</h2>
        <p style={{ color: MU, fontSize: 14, marginBottom: 28 }}>Aguarde enquanto a IA estrutura o prontuário…</p>
        {error ? (
          <div style={{ background: DESL, borderRadius: 10, padding: 20, fontSize: 13, lineHeight: 1.6, textAlign: 'left' as const }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
              <Warning size={20} color={DES} style={{ flexShrink: 0, marginTop: 1 } as React.CSSProperties} />
              <div>
                <strong style={{ color: DES }}>Erro ao processar</strong><br />
                <span style={{ color: DES }}>{error}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" variant="secondary" onClick={onRetry} style={{ flex: 1 }}>Tentar novamente</Btn>
              <Btn size="sm" onClick={handleContinueWithoutAI} style={{ flex: 1 }}>Continuar sem IA</Btn>
            </div>
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

// ─── SUMMARY DONE SCREEN ──────────────────────────────────────────────────────

export function SummaryDoneScreen({ patient, recTime, summary, transcript, draftId, consultType, anamnese, anamneseError, anamneseAdulta, specialty = 'Pediatria', onSave }: {
  patient: Patient | null; recTime: number;
  summary: StructuredSummary; transcript: string;
  draftId: string | null;
  consultType: 'retorno' | 'primeira vez';
  anamnese: AnamnesePrimeiraConsultaData | null;
  anamneseError?: string | null;
  anamneseAdulta?: AnamneseAdultaData | null;
  specialty?: string;
  onSave: () => void;
}) {
  const isPrimeira = consultType === 'primeira vez';
  const isAdult = specialty !== 'Pediatria';
  const [showTranscript, setShowTranscript] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [queixaPrincipal, setQueixaPrincipal] = useState(summary.queixa_principal);
  const [hda, setHda] = useState(summary.hda);
  const [exameFisico, setExameFisico] = useState(summary.exame_fisico);
  const [hipoteses, setHipoteses] = useState(summary.hipoteses.join('\n'));
  const [conduta, setConduta] = useState(summary.conduta);
  const [retorno, setRetorno] = useState(summary.retorno);
  const [examesSolicitados, setExamesSolicitados] = useState((summary.requested_exams ?? []).join('\n'));

  const [editedAnamnese, setEditedAnamnese] = useState<AnamnesePrimeiraConsultaData>(
    () => anamnese ?? defaultAnamnesePrimeiraConsulta()
  );
  const [editedAnamneseAdulta, setEditedAnamneseAdulta] = useState<AnamneseAdultaData>(
    () => anamneseAdulta ?? defaultAnamneseAdulta()
  );
  const [editedAdultData, setEditedAdultData] = useState<ConsultaAdultoData>(
    () => (summary.specialty_data as ConsultaAdultoData | null) ?? {}
  );
  const setAdult = <K extends keyof ConsultaAdultoData>(k: K, v: ConsultaAdultoData[K]) =>
    setEditedAdultData(d => ({ ...d, [k]: v }));

  const [markerComparisons, setMarkerComparisons] = useState<MarkerComparison[]>([]);
  useEffect(() => {
    if (!isAdult || isPrimeira || !patient) return;
    let cancelled = false;
    db.getMarkerComparisons(patient.id).then(c => { if (!cancelled) setMarkerComparisons(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isAdult, isPrimeira, patient]);

  function buildEdited(): StructuredSummary {
    return {
      ...summary,
      queixa_principal: queixaPrincipal,
      hda,
      exame_fisico: exameFisico,
      hipoteses: hipoteses.split('\n').map(h => h.trim()).filter(Boolean),
      conduta,
      retorno,
      requested_exams: examesSolicitados.split('\n').map(e => e.trim()).filter(Boolean),
    };
  }

  async function handleSave() {
    if (!patient) { onSave(); return; }
    setSaving(true); setSaveError('');
    const edited = buildEdited();
    try {
      let consultId: string;
      if (draftId) {
        await db.confirmDraftConsultation(draftId, patient.id, edited, recTime, patient.birth_date);
        consultId = draftId;
      } else {
        consultId = await db.saveConsultation(patient.id, edited, recTime, patient.birth_date, consultType);
      }
      await saveSecondaryData(consultId);
      onSave();
    } catch (e: unknown) {
      setSaveError((e as Error)?.message || 'Erro ao salvar consulta. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  // Salva anamnese e dados complementares. A consulta principal já foi salva;
  // aqui um erro não desfaz o fluxo, mas o médico precisa ser avisado de que
  // parte do prontuário não persistiu (nunca falhar em silêncio).
  async function saveSecondaryData(consultId: string) {
    if (!patient) return;
    if (isPrimeira) {
      if (isAdult) {
        await db.saveAnamneseAdulta(consultId, editedAnamneseAdulta)
          .catch(e => toast.error(`A anamnese não foi salva: ${(e as Error)?.message || 'erro de conexão'}. Reabra a consulta e salve novamente.`));
      } else {
        await db.saveAnamnesePrimeiraConsulta(consultId, patient.id, editedAnamnese)
          .catch(e => toast.error(`A anamnese não foi salva: ${(e as Error)?.message || 'erro de conexão'}. Reabra a consulta e salve novamente.`));
      }
    }
    if (isAdult) {
      await db.saveConsultaAdultoExtras(consultId, editedAdultData)
        .catch(e => toast.error(`Os dados de clínica geral não foram salvos: ${(e as Error)?.message || 'erro de conexão'}. Reabra a consulta e salve novamente.`));
    }
  }

  async function handleSaveDraft() {
    if (!patient) { onSave(); return; }
    setSaving(true); setSaveError('');
    const edited = buildEdited();
    try {
      let consultId: string;
      if (draftId) {
        await db.updateDraftConsultation(draftId, edited);
        consultId = draftId;
      } else {
        consultId = await db.saveDraftConsultation(patient.id, edited, recTime, consultType);
      }
      await saveSecondaryData(consultId);
      onSave();
    } catch (e: unknown) {
      setSaveError((e as Error)?.message || 'Erro ao salvar rascunho. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  const taStyle: React.CSSProperties = {
    width: '100%', fontSize: 14, lineHeight: 1.6,
    padding: '8px 10px', border: `1px solid ${BO}`, borderRadius: 6,
    fontFamily: 'inherit', background: '#fff', color: INK,
    resize: 'vertical' as const, boxSizing: 'border-box' as const, outline: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: SUCL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={22} color={SUC} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>Consulta processada</h2>
            <p style={{ margin: '4px 0 0', color: MU, fontSize: 14 }}>Revise e edite o resumo antes de confirmar.</p>
          </div>
          {draftId && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: SUC, background: SUCL, padding: '6px 12px', borderRadius: 99 }}>
              <CheckCircle size={13} color={SUC} weight="fill" />
              Rascunho salvo automaticamente
            </div>
          )}
        </div>

        {/* CFM disclaimer */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: WARNL, border: `1px solid ${WARN}40`, borderRadius: 8, marginBottom: 20, fontSize: 13, color: WARN }}>
          <Warning size={16} style={{ flexShrink: 0, marginTop: 1 } as React.CSSProperties} />
          <span>Revise e corrija os campos gerados pela IA antes de confirmar. Você é responsável pela validade clínica do prontuário (CFM 2.454/2026).</span>
        </div>

        {/* Metrics strip — pediatria/tricologia; no adulto os dados vivem nos cards do exame objetivo */}
        {!isAdult && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { l: 'Peso extraído', v: summary.peso || '—', icon: Heartbeat },
            { l: 'Altura extraída', v: summary.altura || '—', icon: TrendUp },
            { l: 'Vacinas identificadas', v: `${summary.vacinas_mencionadas.length} menção`, icon: Syringe },
          ].map(({ l, v, icon: Icon }) => (
            <Card key={l} style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon size={14} color={P} /><span style={{ fontSize: 12, color: MU }}>{l}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
            </Card>
          ))}
        </div>
        )}

        {/* Vaccines — no adulto/primeira o card fica na posição 7 (Histórico Vacinal) */}
        {!(isAdult && isPrimeira) && summary.vacinas_mencionadas.length > 0 && (
          <Card style={{ marginBottom: 16, background: SUCL }}>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: SUC, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Syringe size={13} /> Vacinas identificadas no áudio — serão adicionadas à aba Vacinas
              </div>
              {summary.vacinas_mencionadas.map(v => <div key={v} style={{ fontSize: 13 }}>{v}</div>)}
            </div>
          </Card>
        )}

        {/* 1. Resumo Clínico Inteligente — Clínica Geral, primeira ou retorno */}
        {isAdult && (
          <Card style={{ marginBottom: 16, background: PL }}>
            <div style={{ padding: '14px 20px' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: P, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClipboardText size={14} /> Resumo da consulta
              </div>
              <textarea value={editedAdultData.resumo_clinico ?? ''} onChange={e => setAdult('resumo_clinico', e.target.value)}
                rows={2} style={{ ...taStyle, background: '#fff' }}
                onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = P; }}
                onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = BO; }} />
              {/* Bullets derivados dos campos estruturados — leitura em <20s; edite nos cards abaixo */}
              {(() => {
                const vit = editedAdultData.vitals ?? {};
                const achados = VITAL_FIELD_DEFS.filter(f => vit[f.key]).map(f => `${f.label} ${vit[f.key]}`).join(' · ');
                const rows: { l: string; v: string }[] = [
                  { l: 'Motivo', v: queixaPrincipal },
                  { l: 'Diagnósticos', v: hipoteses.split('\n').filter(Boolean).join('; ') },
                  { l: 'Achados', v: achados },
                  { l: 'Conduta', v: conduta.split('\n').filter(Boolean)[0] ?? '' },
                  { l: 'Exames', v: examesSolicitados.split('\n').filter(Boolean).join(', ') },
                  { l: 'Retorno', v: retorno },
                ].filter(r => r.v);
                return rows.length > 0 && (
                  <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {rows.map(({ l, v }) => (
                      <li key={l} style={{ fontSize: 13, color: INK, lineHeight: 1.5 }}>
                        <strong style={{ color: P }}>{l}:</strong> {v}
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </Card>
        )}

        {/* Main form — branches on consultation type */}
        {isPrimeira ? (
          <RequireRole roles={['medico']}>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={15} color={P} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>{isAdult ? 'Anamnese (HDA)' : 'Anamnese narrativa'}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: MU }}>Revise a anamnese completa extraída da consulta</span>
              </div>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'start' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: MU, paddingTop: 10 }}>Queixa principal</span>
                <textarea value={queixaPrincipal} onChange={e => setQueixaPrincipal(e.target.value)} rows={2} style={taStyle}
                  onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = P; }}
                  onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = BO; }} />
              </div>
              <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'start' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: MU, paddingTop: 10 }}>Anamnese</span>
                <textarea value={hda} onChange={e => setHda(e.target.value)} rows={7} style={taStyle}
                  onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = P; }}
                  onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = BO; }} />
              </div>
            </Card>
            {anamneseError && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: WARNL, border: `1px solid ${WARN}40`, borderRadius: 8, marginBottom: 12, fontSize: 13, color: WARN }}>
                <Warning size={16} style={{ flexShrink: 0, marginTop: 1 } as React.CSSProperties} />
                <span>A ficha de anamnese não pôde ser extraída automaticamente pela IA ({anamneseError}). Preencha os campos abaixo manualmente com base na consulta.</span>
              </div>
            )}
            {isAdult ? (
              (() => {
                const anam = editedAnamneseAdulta;
                const setAnam = (k: keyof AnamneseAdultaData, v: unknown) => setEditedAnamneseAdulta(f => ({ ...f, [k]: v }));
                const anamEditor = (sections: AnamneseSection[]) => (
                  <AnamneseAdultaFields form={anam} set={setAnam} sections={sections} />
                );
                const sub = (t: string) => (
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: 0.6 }}>{t}</p>
                );

                const diagPrevios = [...comorbidadesIdentificadas(anam), ...splitClinicalList(anam.outras_comorbidades)];
                const cirurgias = anam.cirurgias_previas ? splitClinicalList(anam.cirurgias_desc) : [];
                const internacoes = anam.internacoes_previas ? splitClinicalList(anam.internacoes_desc) : [];
                const habitos = habitosBullets(anam);
                const medsStruct = editedAdultData.current_medications ?? [];
                const medsText = splitClinicalList(anam.medicamentos_em_uso);
                const allergStruct = editedAdultData.allergies ?? [];
                const allergText = [anam.alergias_medicamentos, anam.alergias_alimentares, anam.alergias_outras].flatMap(splitClinicalList);
                const familiar = splitClinicalList(anam.historico_familiar);
                const vacinal = [...splitClinicalList(anam.vacinacao_adulto), ...summary.vacinas_mencionadas];
                const vacPendente = (s: string) => /atrasad|pendente|não tomou|nunca|vencid/i.test(s);
                const rastreios = rastreamentosBullets(anam);

                return (
                  <>
                    {/* 3. História Pregressa */}
                    <ReviewCard icon={FileText} title="História Pregressa" editor={anamEditor(['pregressa'])}>
                      {diagPrevios.length + cirurgias.length + internacoes.length === 0 ? (
                        <p style={{ fontSize: 13, color: MU, margin: 0 }}>Nenhum antecedente relevante identificado.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {diagPrevios.length > 0 && <div>{sub('Diagnósticos prévios')}<Bullets items={diagPrevios} /></div>}
                          {cirurgias.length > 0 && <div>{sub('Cirurgias')}<Bullets items={cirurgias} /></div>}
                          {internacoes.length > 0 && <div>{sub('Internações')}<Bullets items={internacoes} /></div>}
                        </div>
                      )}
                    </ReviewCard>

                    {/* 4. Hábitos de Vida */}
                    <ReviewCard icon={Heartbeat} title="Hábitos de Vida" editor={anamEditor(['habitos'])}>
                      <Bullets items={habitos} empty="Nenhum hábito de vida identificado na consulta." />
                    </ReviewCard>

                    {/* 5. Medicações em Uso e Alergias */}
                    <ReviewCard icon={Pill} title="Medicações em Uso e Alergias"
                      editor={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                          <div>{sub('Medicações em uso')}
                            <MedicationsEditor medications={medsStruct} onChange={m => setAdult('current_medications', m)} />
                          </div>
                          <div>{sub('Alergias')}
                            <AllergiesEditor allergies={allergStruct} onChange={a => setAdult('allergies', a)} />
                          </div>
                        </div>
                      }>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>{sub('Medicações em uso')}
                          {medsStruct.length > 0 ? (
                            <Bullets items={medsStruct.map(m => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` — ${m.frequency}` : ''}`)} />
                          ) : (
                            <Bullets items={medsText} empty="Sem medicações contínuas relatadas." />
                          )}
                        </div>
                        <div>{sub('Alergias')}
                          {allergStruct.length > 0 ? (
                            <Bullets items={allergStruct.map(a => (
                              <span>{a.allergen}{a.reaction && <span style={{ color: MU }}> → {a.reaction}</span>}</span>
                            ))} />
                          ) : (
                            <Bullets items={allergText} empty="Sem alergias conhecidas." />
                          )}
                        </div>
                      </div>
                    </ReviewCard>

                    {/* 6. Histórico Familiar */}
                    <ReviewCard icon={Users} title="Histórico Familiar" editor={anamEditor(['familiar'])}>
                      <Bullets items={familiar} empty="Nenhuma doença familiar identificada." />
                    </ReviewCard>

                    {/* 7. Histórico Vacinal Adulto */}
                    <ReviewCard icon={Syringe} title="Vacinação"
                      subtitle="Menções na consulta — registro formal na aba Vacinas"
                      editor={anamEditor(['vacinal'])}>
                      <Bullets
                        items={vacinal.map(v => vacPendente(v)
                          ? <span style={{ color: WARN, fontWeight: 600 }}><Warning size={12} style={{ marginRight: 4, verticalAlign: 'middle' } as React.CSSProperties} />{v}</span>
                          : v)}
                        empty="Nenhuma menção vacinal na consulta." />
                    </ReviewCard>

                    {/* 8. Rastreamentos Preventivos */}
                    <ReviewCard icon={ClipboardText} title="Rastreamentos" editor={anamEditor(['rastreamentos'])}>
                      <Bullets items={rastreios} empty="Nenhum rastreamento preventivo mencionado." />
                    </ReviewCard>

                    {/* 9. Exame Objetivo — Sinais Vitais + Antropometria */}
                    <Card style={{ marginBottom: 16 }}>
                      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Heartbeat size={15} color={P} />
                        <span style={{ fontWeight: 600, fontSize: 15 }}>Sinais Vitais</span>
                      </div>
                      <div style={{ padding: 20 }}>
                        <VitalsGrid vitals={editedAdultData.vitals ?? {}} onChange={v => setAdult('vitals', v)} fields={VITAL_SIGN_KEYS} />
                      </div>
                    </Card>
                    <Card style={{ marginBottom: 16 }}>
                      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrendUp size={15} color={P} />
                        <span style={{ fontWeight: 600, fontSize: 15 }}>Dados Antropométricos</span>
                      </div>
                      <div style={{ padding: 20 }}>
                        <VitalsGrid vitals={editedAdultData.vitals ?? {}} onChange={v => setAdult('vitals', v)} fields={ANTHRO_KEYS} />
                      </div>
                    </Card>

                    {/* 10. Diagnósticos Ativos */}
                    <Card style={{ marginBottom: 16 }}>
                      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Stethoscope size={15} color={P} />
                        <span style={{ fontWeight: 600, fontSize: 15 }}>Diagnósticos Ativos</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: MU }}>Sugeridos pela IA — revise antes de confirmar</span>
                      </div>
                      <div style={{ padding: 20 }}>
                        <ProblemsEditor problems={editedAdultData.active_problems ?? []} onChange={p => setAdult('active_problems', p)} />
                      </div>
                    </Card>

                    {/* 11. Exame Físico */}
                    <Card style={{ marginBottom: 16 }}>
                      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Stethoscope size={15} color={P} />
                        <span style={{ fontWeight: 600, fontSize: 15 }}>Exame Físico</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: MU }}>Sem sinais vitais — eles ficam no Exame Objetivo</span>
                      </div>
                      <div style={{ padding: '14px 20px' }}>
                        <textarea value={exameFisico} onChange={e => setExameFisico(e.target.value)} rows={5} style={taStyle}
                          onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = P; }}
                          onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = BO; }} />
                      </div>
                    </Card>

                    {/* 12. Plano Terapêutico */}
                    <Card style={{ marginBottom: 16 }}>
                      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ClipboardText size={15} color={P} />
                        <span style={{ fontWeight: 600, fontSize: 15 }}>Plano Terapêutico</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: MU }}>Todos os campos são editáveis</span>
                      </div>
                      {([
                        { label: 'Hipóteses (uma por linha)', value: hipoteses, onChange: setHipoteses, rows: 2 },
                        { label: 'Conduta', value: conduta, onChange: setConduta, rows: 4 },
                        { label: 'Exames a pedir (um por linha)', value: examesSolicitados, onChange: setExamesSolicitados, rows: 2 },
                        { label: 'Retorno', value: retorno, onChange: setRetorno, rows: 1 },
                      ] as { label: string; value: string; onChange: (v: string) => void; rows: number }[]).map(({ label, value, onChange, rows }) => (
                        <div key={label} style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'start' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: MU, paddingTop: 10 }}>{label}</span>
                          <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} style={taStyle}
                            onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = P; }}
                            onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = BO; }} />
                        </div>
                      ))}
                    </Card>
                  </>
                );
              })()
            ) : (
              <div style={{ marginBottom: 16 }}>
                <AnamnesePrimeiraConsulta data={editedAnamnese} onChange={setEditedAnamnese} />
              </div>
            )}
          </RequireRole>
        ) : isAdult ? (
          <RequireRole roles={['medico']}>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={15} color={P} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>Motivo do retorno e evolução clínica</span>
              </div>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'start' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: MU, paddingTop: 10 }}>Motivo do retorno</span>
                <input value={editedAdultData.motivo_retorno ?? ''} onChange={e => setAdult('motivo_retorno', e.target.value)}
                  placeholder="Ex: acompanhamento, ajuste de tratamento, nova queixa" style={{ ...smallInputStyle, width: '100%' }} />
              </div>
              <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'start' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: MU, paddingTop: 10 }}>Evolução clínica</span>
                <textarea value={editedAdultData.evolucao_clinica ?? ''} onChange={e => setAdult('evolucao_clinica', e.target.value)}
                  rows={4} style={taStyle}
                  onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = P; }}
                  onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = BO; }} />
              </div>
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Stethoscope size={15} color={P} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>Problemas ativos</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: MU }}>Mantenha, resolva ou adicione problemas</span>
              </div>
              <div style={{ padding: 20 }}>
                <ProblemsEditor
                  problems={editedAdultData.active_problems ?? []}
                  onChange={p => setAdult('active_problems', p)}
                  novos={(editedAdultData.novos_problemas ?? []).map(p => p.name)}
                />
              </div>
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendUp size={15} color={P} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>Exames comparativos</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: MU }}>Comparação com o resultado anterior registrado</span>
              </div>
              <div style={{ padding: 20 }}>
                <MarkerComparisonsCard comparisons={markerComparisons} />
              </div>
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pill size={15} color={P} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>Mudanças de medicação e resposta ao tratamento</span>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <MedicationChangesEditor changes={editedAdultData.medication_changes ?? []} onChange={c => setAdult('medication_changes', c)} />
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: MU, marginBottom: 5 }}>Resposta ao tratamento</label>
                  <select value={editedAdultData.resposta_tratamento ?? ''} onChange={e => setAdult('resposta_tratamento', (e.target.value || null) as RespostaTratamento | null)}
                    style={{ ...smallInputStyle, width: '100%', maxWidth: 280 }}>
                    <option value="">Não classificada</option>
                    {(Object.keys(RESPOSTA_LABELS) as RespostaTratamento[]).map(k => (
                      <option key={k} value={k}>{RESPOSTA_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pill size={15} color={P} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>Medicações atuais e alergias</span>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: MU, textTransform: 'uppercase', letterSpacing: 0.6 }}>Medicações atuais</p>
                  <MedicationsEditor medications={editedAdultData.current_medications ?? []} onChange={m => setAdult('current_medications', m)} />
                </div>
                <div>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: MU, textTransform: 'uppercase', letterSpacing: 0.6 }}>Alergias</p>
                  <AllergiesEditor allergies={editedAdultData.allergies ?? []} onChange={a => setAdult('allergies', a)} />
                </div>
              </div>
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Heartbeat size={15} color={P} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>Exame clínico e sinais vitais</span>
              </div>
              <div style={{ padding: 20 }}>
                <VitalsGrid vitals={editedAdultData.vitals ?? {}} onChange={v => setAdult('vitals', v)} />
              </div>
            </Card>
          </RequireRole>
        ) : (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={15} color={P} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>Resumo estruturado</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: MU }}>Todos os campos são editáveis</span>
            </div>
            {([
              { label: 'Queixa principal', value: queixaPrincipal, onChange: setQueixaPrincipal, rows: 2 },
              { label: 'Anamnese', value: hda, onChange: setHda, rows: 7 },
              { label: 'Exame físico', value: exameFisico, onChange: setExameFisico, rows: 4 },
              { label: 'Hipóteses (uma por linha)', value: hipoteses, onChange: setHipoteses, rows: 3 },
              { label: 'Conduta', value: conduta, onChange: setConduta, rows: 4 },
              { label: 'Exames a pedir (um por linha)', value: examesSolicitados, onChange: setExamesSolicitados, rows: 2 },
              { label: 'Retorno', value: retorno, onChange: setRetorno, rows: 1 },
            ] as { label: string; value: string; onChange: (v: string) => void; rows: number }[]).map(({ label, value, onChange, rows }) => (
              <div key={label} style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'start' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: MU, paddingTop: 10 }}>{label}</span>
                <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} style={taStyle}
                  onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = P; }}
                  onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = BO; }} />
              </div>
            ))}
          </Card>
        )}

        {/* Conduta e plano — pediatria primeira (exame físico completo) ou retorno adulto (conduta atualizada).
            Adulto primeira consulta tem Exame Físico e Plano Terapêutico como cards próprios (11 e 12). */}
        {((isPrimeira && !isAdult) || (!isPrimeira && isAdult)) && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Stethoscope size={15} color={P} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>{isPrimeira ? 'Exame físico, conduta e retorno' : 'Conduta atualizada'}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: MU }}>Todos os campos são editáveis</span>
            </div>
            {([
              { label: 'Exame físico', value: exameFisico, onChange: setExameFisico, rows: 4 },
              { label: 'Hipóteses (uma por linha)', value: hipoteses, onChange: setHipoteses, rows: 2 },
              { label: 'Conduta', value: conduta, onChange: setConduta, rows: 4 },
              { label: 'Exames a pedir (um por linha)', value: examesSolicitados, onChange: setExamesSolicitados, rows: 2 },
              { label: 'Retorno', value: retorno, onChange: setRetorno, rows: 1 },
            ] as { label: string; value: string; onChange: (v: string) => void; rows: number }[]).map(({ label, value, onChange, rows }) => (
              <div key={label} style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'start' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: MU, paddingTop: 10 }}>{label}</span>
                <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} style={taStyle}
                  onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = P; }}
                  onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = BO; }} />
              </div>
            ))}
          </Card>
        )}

        {/* Transcript */}
        <Card style={{ marginBottom: 24 }}>
          <button onClick={() => setShowTranscript(v => !v)}
            style={{ width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 14 }}>
            <FileText size={15} color={MU} /> Transcrição completa do áudio
            {showTranscript ? <CaretUp size={16} style={{ marginLeft: 'auto' }} /> : <CaretDown size={16} style={{ marginLeft: 'auto' }} />}
          </button>
          {showTranscript && (
            <div style={{ padding: '4px 20px 20px', borderTop: `1px solid ${BO}` }}>
              <pre style={{ fontSize: 13, lineHeight: 1.7, color: MU, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                {transcript || '(transcrição não disponível)'}
              </pre>
            </div>
          )}
        </Card>

        {/* Save error */}
        {saveError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: DESL, border: `1px solid ${DES}40`, borderRadius: 8, marginBottom: 16, fontSize: 13, color: DES }}>
            <Warning size={16} style={{ flexShrink: 0 } as React.CSSProperties} />
            {saveError}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" size="lg" onClick={handleSaveDraft} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar como rascunho'}
          </Btn>
          <Btn size="lg" onClick={handleSave} disabled={saving}>
            {saving ? 'Confirmando…' : <><CheckCircle size={16} /> {draftId ? 'Confirmar prontuário' : 'Salvar no histórico'}</>}
          </Btn>
        </div>

      </div>
    </div>
  );
}
