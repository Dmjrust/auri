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
import * as db from '../lib/db';
import * as ai from '../lib/ai';
import {
  Baby, FileText, Heartbeat, House, Microphone, Syringe,
  Play, Square, CheckCircle, Warning, CaretUp, CaretDown,
  Star, ArrowCounterClockwise, TrendUp, Stethoscope,
  Users,
} from '@phosphor-icons/react';

import { P, PL, ACCENTL, ACCENT, INK, MU, BO, BG, SEC, SUCL, SUC, WARNL, WARN, DESL, DES } from '../lib/design';
import { fmtTimer } from '../lib/auri-utils';
import type { Patient, StructuredSummary, AnamnesePrimeiraConsultaData } from '../data/mock';
import { defaultAnamnesePrimeiraConsulta } from '../data/mock';
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

  function Lbl({ text, k }: { text: string; k?: string }) {
    return (
      <div style={{ fontSize: 12, fontWeight: 600, color: MU, marginBottom: 5, display: 'flex', gap: 5, alignItems: 'center' }}>
        {text}
        {k && aiFields.has(k) && (
          <span style={{ fontSize: 10, background: PL, color: P, padding: '1px 6px', borderRadius: 99 }}>✦ IA</span>
        )}
      </div>
    );
  }

  function Ta({ k, rows = 2 }: { k: keyof AnamnesePrimeiraConsultaData; rows?: number }) {
    return (
      <textarea rows={rows} value={data[k] as string}
        onChange={e => set(k, e.target.value as AnamnesePrimeiraConsultaData[typeof k])}
        style={{ ...inputBase, ...aiBorder(k) }}
        onFocus={e => { e.target.style.borderColor = P; }}
        onBlur={e => { e.target.style.borderColor = BO; }} />
    );
  }

  function Inp({ k }: { k: keyof AnamnesePrimeiraConsultaData }) {
    return (
      <input type="text" value={data[k] as string}
        onChange={e => set(k, e.target.value as AnamnesePrimeiraConsultaData[typeof k])}
        style={{ ...inputBase, resize: 'none', ...aiBorder(k), paddingTop: 7, paddingBottom: 7 }}
        onFocus={e => { e.target.style.borderColor = P; }}
        onBlur={e => { e.target.style.borderColor = BO; }} />
    );
  }

  function SectionHeader({ id, icon: Icon, title }: { id: SecId; icon: IconComponent; title: string }) {
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
        <SectionHeader id="atual" icon={Heartbeat} title="1. História atual" />
        {openSecs.has('atual') && (
          <div style={{ ...pad, ...g2 }}>
            <div><Lbl text="Motivo da consulta" k="motivo_consulta" /><Inp k="motivo_consulta" /></div>
            <div><Lbl text="Queixa principal e duração" k="queixa_principal_duracao" /><Inp k="queixa_principal_duracao" /></div>
            <div style={full}><Lbl text="Sintomas associados" k="sintomas_associados" /><Ta k="sintomas_associados" rows={3} /></div>
          </div>
        )}
      </Card>

      {/* 2 — História pregressa */}
      <Card style={{ marginBottom: 8, overflow: 'hidden' }}>
        <SectionHeader id="pregressa" icon={FileText} title="2. História pregressa" />
        {openSecs.has('pregressa') && (
          <div style={{ ...pad, ...g2 }}>
            <div style={col}>
              <div>
                <Lbl text="Internações anteriores" k="internacoes" />
                <AnamBoolSeg value={data.internacoes} onChange={v => set('internacoes', v)} />
                {data.internacoes === true && <div style={{ marginTop: 8 }}><Lbl text="Descreva" k="internacoes_desc" /><Ta k="internacoes_desc" /></div>}
              </div>
              <div>
                <Lbl text="Cirurgias anteriores" k="cirurgias" />
                <AnamBoolSeg value={data.cirurgias} onChange={v => set('cirurgias', v)} />
                {data.cirurgias === true && <div style={{ marginTop: 8 }}><Lbl text="Descreva" k="cirurgias_desc" /><Ta k="cirurgias_desc" /></div>}
              </div>
            </div>
            <div style={col}>
              <div><Lbl text="Alergias a medicamentos" k="alergias_medicamentos" /><Ta k="alergias_medicamentos" /></div>
              <div><Lbl text="Alergias alimentares" k="alergias_alimentos" /><Ta k="alergias_alimentos" /></div>
              <div><Lbl text="Outras alergias" k="alergias_outras" /><Inp k="alergias_outras" /></div>
              <div><Lbl text="Histórico vacinal prévio" k="historico_vacinal" /><Ta k="historico_vacinal" rows={3} /></div>
            </div>
          </div>
        )}
      </Card>

      {/* 3 — História gestacional */}
      <Card style={{ marginBottom: 8, overflow: 'hidden' }}>
        <SectionHeader id="gestacional" icon={Baby} title="3. História gestacional" />
        {openSecs.has('gestacional') && (
          <div style={{ ...pad, ...g2 }}>
            <div><Lbl text="Gestações (G_P_A)" k="gestacoes_gpa" /><Inp k="gestacoes_gpa" /></div>
            <div><Lbl text="Semanas de gestação ao nascer" k="idade_gestacional_semanas" /><Inp k="idade_gestacional_semanas" /></div>
            <div>
              <Lbl text="Tipo de parto" k="tipo_parto" />
              <AnamSelect value={data.tipo_parto} onChange={v => set('tipo_parto', v)} options={['vaginal', 'cesárea']} aiField={aiFields.has('tipo_parto')} />
            </div>
            <div><Lbl text="Local do parto (maternidade)" k="local_parto" /><Inp k="local_parto" /></div>
            <div style={{ ...full }}>
              <Lbl text="Intercorrências na gestação" k="intercorrencias_gestacao" />
              <AnamBoolSeg value={data.intercorrencias_gestacao} onChange={v => set('intercorrencias_gestacao', v)} />
              {data.intercorrencias_gestacao === true && (
                <div style={{ marginTop: 8 }}><Lbl text="Descreva" k="intercorrencias_gestacao_desc" /><Ta k="intercorrencias_gestacao_desc" /></div>
              )}
            </div>
            <div><Lbl text="Apgar 1º minuto" k="apgar_1" /><Inp k="apgar_1" /></div>
            <div><Lbl text="Apgar 5º minuto" k="apgar_5" /><Inp k="apgar_5" /></div>
          </div>
        )}
      </Card>

      {/* 4 — Triagens neonatais */}
      <Card style={{ marginBottom: 8, overflow: 'hidden' }}>
        <SectionHeader id="triagens" icon={Syringe} title="4. Triagens neonatais" />
        {openSecs.has('triagens') && (
          <div style={{ ...pad, ...g2 }}>
            <div>
              <Lbl text="Teste do pezinho" k="teste_pezinho" />
              <AnamSelect value={data.teste_pezinho} onChange={v => set('teste_pezinho', v)} options={['realizado', 'não realizado', 'aguardando resultado']} aiField={aiFields.has('teste_pezinho')} />
            </div>
            <div>
              <Lbl text="Teste da orelhinha" k="teste_orelhinha" />
              <AnamSelect value={data.teste_orelhinha} onChange={v => set('teste_orelhinha', v)} options={['passou', 'falhou', 'não realizado']} aiField={aiFields.has('teste_orelhinha')} />
            </div>
            <div>
              <Lbl text="Teste do olhinho" k="teste_olhinho" />
              <AnamSelect value={data.teste_olhinho} onChange={v => set('teste_olhinho', v)} options={['passou', 'falhou', 'não realizado']} aiField={aiFields.has('teste_olhinho')} />
            </div>
            <div>
              <Lbl text="Teste do coraçãozinho (oximetria)" k="teste_coracaozinho" />
              <AnamSelect value={data.teste_coracaozinho} onChange={v => set('teste_coracaozinho', v)} options={['passou', 'falhou', 'não realizado']} aiField={aiFields.has('teste_coracaozinho')} />
            </div>
          </div>
        )}
      </Card>

      {/* 5 — História familiar */}
      <Card style={{ marginBottom: 8, overflow: 'hidden' }}>
        <SectionHeader id="familiar" icon={Users} title="5. História familiar" />
        {openSecs.has('familiar') && (
          <div style={{ ...pad, ...g2 }}>
            <div><Lbl text="Doenças crônicas na família (por parente)" k="doencas_familia" /><Ta k="doencas_familia" rows={4} /></div>
            <div style={col}>
              <div>
                <Lbl text="Histórico de alergias na família" k="alergia_familia" />
                <AnamBoolSeg value={data.alergia_familia} onChange={v => set('alergia_familia', v)} />
                {data.alergia_familia === true && <div style={{ marginTop: 8 }}><Lbl text="Descreva" k="alergia_familia_desc" /><Ta k="alergia_familia_desc" /></div>}
              </div>
              <div><Lbl text="Outras condições relevantes" k="outras_condicoes_familia" /><Ta k="outras_condicoes_familia" rows={3} /></div>
            </div>
          </div>
        )}
      </Card>

      {/* 6 — História socioeconômica */}
      <Card style={{ marginBottom: 8, overflow: 'hidden' }}>
        <SectionHeader id="socioeconomica" icon={House} title="6. História socioeconômica" />
        {openSecs.has('socioeconomica') && (
          <div style={{ ...pad, ...g2 }}>
            <div><Lbl text="Profissão dos responsáveis" k="profissao_responsaveis" /><Inp k="profissao_responsaveis" /></div>
            <div><Lbl text="Renda familiar aproximada (opcional)" k="renda_familiar" /><Inp k="renda_familiar" /></div>
            <div>
              <Lbl text="Tabagismo passivo em casa" k="tabagismo_passivo" />
              <AnamBoolSeg value={data.tabagismo_passivo} onChange={v => set('tabagismo_passivo', v)} />
            </div>
            <div>
              <Lbl text="Animal doméstico em casa" k="animal_domestico" />
              <AnamBoolSeg value={data.animal_domestico} onChange={v => set('animal_domestico', v)} />
              {data.animal_domestico === true && <div style={{ marginTop: 8 }}><Lbl text="Qual animal" k="animal_domestico_qual" /><Inp k="animal_domestico_qual" /></div>}
            </div>
            <div style={full}>
              <Lbl text="Acesso a água encanada e saneamento básico" k="agua_saneamento" />
              <AnamBoolSeg value={data.agua_saneamento} onChange={v => set('agua_saneamento', v)} />
            </div>
          </div>
        )}
      </Card>
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
          • A gravação é processada localmente e descartada após a transcrição<br />
          • Apenas o texto estruturado é salvo no prontuário<br />
          • Dados protegidos conforme LGPD e CFM 2.454/2026<br />
          • O médico revisa e valida o resumo antes de salvar
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 28, fontSize: 14 }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: 2, accentColor: P, width: 16, height: 16 }} />
          <span>O responsável foi informado e concordou com a gravação desta consulta para fins de documentação médica.</span>
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

export function RecordingScreen({ time, patient, consultType, onFinish }: {
  time: number; patient: Patient | null;
  consultType: 'retorno' | 'primeira vez';
  onFinish: (blob: Blob) => void;
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
            <p style={{ color: MU, fontSize: 14, marginBottom: 32 }}>
              {paused ? 'Clique em continuar para retomar.' : 'O áudio está sendo capturado. Fale normalmente com o paciente.'}
            </p>
            {!paused && (
              <div className="recording-wave" style={{ justifyContent: 'center', marginBottom: 32 }}>
                {[16, 28, 20, 36, 24, 32, 18].map((_, i) => <span key={i} />)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
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

export function ProcessingScreen({ audioBlob, onDone, onRetry, consultType, specialty = 'Pediatria' }: {
  audioBlob: Blob | null;
  onDone: (summary: StructuredSummary, transcript: string, anamnese?: AnamnesePrimeiraConsultaData) => void;
  onRetry: () => void;
  consultType: 'retorno' | 'primeira vez';
  specialty?: string;
}) {
  const [step, setStep]   = useState(0);
  const [error, setError] = useState('');
  const isPrimeira = consultType === 'primeira vez';
  const steps = isPrimeira
    ? ['Enviando áudio para transcrição…', 'Transcrevendo consulta…', 'Estruturando prontuário…', 'Preenchendo ficha de puericultura…', 'Finalizando resumo clínico…']
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
        const summary = await ai.structureSummary(transcript, specialty);

        if (cancelled) return;

        if (isPrimeira) {
          setStep(3);
          const anamnese = await ai.extractAnamnesePrimeiraConsulta(transcript)
            .catch(() => defaultAnamnesePrimeiraConsulta());
          if (cancelled) return;
          setStep(4);
          await new Promise(r => setTimeout(r, 400));
          if (!cancelled) onDone(summary, transcript, anamnese);
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
              <Btn size="sm" onClick={onRetry} style={{ flex: 1 }}>Tentar novamente</Btn>
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

export function SummaryDoneScreen({ patient, recTime, summary, transcript, draftId, consultType, anamnese, onSave }: {
  patient: Patient | null; recTime: number;
  summary: StructuredSummary; transcript: string;
  draftId: string | null;
  consultType: 'retorno' | 'primeira vez';
  anamnese: AnamnesePrimeiraConsultaData | null;
  onSave: () => void;
}) {
  const isPrimeira = consultType === 'primeira vez';
  const [showTranscript, setShowTranscript] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [queixaPrincipal, setQueixaPrincipal] = useState(summary.queixa_principal);
  const [hda, setHda] = useState(summary.hda);
  const [exameFisico, setExameFisico] = useState(summary.exame_fisico);
  const [hipoteses, setHipoteses] = useState(summary.hipoteses.join('\n'));
  const [conduta, setConduta] = useState(summary.conduta);
  const [retorno, setRetorno] = useState(summary.retorno);

  const [editedAnamnese, setEditedAnamnese] = useState<AnamnesePrimeiraConsultaData>(
    () => anamnese ?? defaultAnamnesePrimeiraConsulta()
  );

  function buildEdited(): StructuredSummary {
    return {
      ...summary,
      queixa_principal: isPrimeira ? (editedAnamnese.motivo_consulta || queixaPrincipal) : queixaPrincipal,
      hda: isPrimeira ? (editedAnamnese.sintomas_associados || hda) : hda,
      exame_fisico: exameFisico,
      hipoteses: hipoteses.split('\n').map(h => h.trim()).filter(Boolean),
      conduta,
      retorno,
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
      if (isPrimeira) {
        await db.saveAnamnesePrimeiraConsulta(consultId, patient.id, editedAnamnese)
          .catch(e => console.error('Anamnese save failed (non-critical):', e));
      }
      onSave();
    } catch (e: unknown) {
      setSaveError((e as Error)?.message || 'Erro ao salvar consulta. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    if (!patient) { onSave(); return; }
    setSaving(true); setSaveError('');
    const edited = buildEdited();
    try {
      if (draftId) {
        await db.updateDraftConsultation(draftId, edited);
      } else {
        await db.saveDraftConsultation(patient.id, edited, recTime, consultType);
      }
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

        {/* Metrics strip */}
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

        {/* Vaccines */}
        {summary.vacinas_mencionadas.length > 0 && (
          <Card style={{ marginBottom: 16, background: SUCL }}>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: SUC, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Syringe size={13} /> Vacinas identificadas no áudio — serão adicionadas à aba Vacinas
              </div>
              {summary.vacinas_mencionadas.map(v => <div key={v} style={{ fontSize: 13 }}>{v}</div>)}
            </div>
          </Card>
        )}

        {/* Main form — branches on consultation type */}
        {isPrimeira ? (
          <RequireRole roles={['medico']}>
            <div style={{ marginBottom: 16 }}>
              <AnamnesePrimeiraConsulta data={editedAnamnese} onChange={setEditedAnamnese} />
            </div>
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
              { label: 'HDA', value: hda, onChange: setHda, rows: 5 },
              { label: 'Exame físico', value: exameFisico, onChange: setExameFisico, rows: 4 },
              { label: 'Hipóteses (uma por linha)', value: hipoteses, onChange: setHipoteses, rows: 3 },
              { label: 'Conduta', value: conduta, onChange: setConduta, rows: 4 },
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

        {/* Conduta e plano — always shown for primeira vez */}
        {isPrimeira && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Stethoscope size={15} color={P} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>Exame físico, conduta e retorno</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: MU }}>Todos os campos são editáveis</span>
            </div>
            {([
              { label: 'Exame físico', value: exameFisico, onChange: setExameFisico, rows: 4 },
              { label: 'Hipóteses (uma por linha)', value: hipoteses, onChange: setHipoteses, rows: 2 },
              { label: 'Conduta', value: conduta, onChange: setConduta, rows: 4 },
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
