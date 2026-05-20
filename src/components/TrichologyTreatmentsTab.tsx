import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, CheckCircle, PauseCircle, XCircle, Clock,
  PencilSimple, FloppyDisk, CaretDown, CaretUp, Pill,
} from '@phosphor-icons/react';
import * as db from '../lib/db';
import type { TrichologyTreatment } from '../lib/db';

// ── Design tokens ─────────────────────────────────────────────────────────────
const P     = '#0F4C5C';
const PL    = '#E8F4F7';
const INK   = '#1A1D1C';
const MU    = '#6B7280';
const BO    = '#E5E7EB';
const BG    = '#FAFAF9';
const SUC   = '#5B8A6F';
const SUCL  = '#EAF4EE';
const WARN  = '#C68B3E';
const WARNL = '#FDF3E3';
const DES   = '#D1646F';
const DESL  = '#FDECEA';
const SAND  = '#E6D5B8';
const SANDL = '#FAF6EE';

// ── Types ─────────────────────────────────────────────────────────────────────
type TreatmentStatus    = 'active' | 'paused' | 'completed' | 'discontinued';
type AdherenceStatus    = 'boa' | 'parcial' | 'baixa' | 'interrompida';

interface TreatmentFormState {
  name: string;
  dose: string;
  frequency: string;
  indication: string;
  start_date: string;
  end_date: string;
  status: TreatmentStatus;
  adherence_status: AdherenceStatus | '';
  adherence_notes: string;
}

const EMPTY_FORM: TreatmentFormState = {
  name: '', dose: '', frequency: '', indication: '',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '', status: 'active', adherence_status: '', adherence_notes: '',
};

const INDICATIONS = ['AGA', 'Eflúvio telógeno', 'Alopecia areata', 'Alopecia androgenética feminina', 'Dermatite seborreica', 'Tricotilomania', 'Outro'];
const FREQUENCIES = ['1x/dia', '2x/dia', 'Uso noturno', 'Uso em dias alternados', 'Semanal', 'Mensal', 'Contínuo', 'Conforme necessidade'];

// ── Status helpers ─────────────────────────────────────────────────────────────
function statusLabel(s: TreatmentStatus): string {
  return { active: 'Ativo', paused: 'Pausado', completed: 'Concluído', discontinued: 'Interrompido' }[s];
}
function statusColor(s: TreatmentStatus): { bg: string; color: string } {
  return {
    active:       { bg: SUCL,  color: SUC  },
    paused:       { bg: WARNL, color: WARN },
    completed:    { bg: PL,    color: P    },
    discontinued: { bg: DESL,  color: DES  },
  }[s];
}
function adherenceLabel(a: AdherenceStatus | null): string {
  if (!a) return '—';
  return { boa: 'Boa', parcial: 'Parcial', baixa: 'Baixa', interrompida: 'Interrompida' }[a];
}
function adherenceColor(a: AdherenceStatus | null): { bg: string; color: string } {
  if (!a) return { bg: '#F3F4F6', color: MU };
  return {
    boa:          { bg: SUCL,  color: SUC  },
    parcial:      { bg: WARNL, color: WARN },
    baixa:        { bg: DESL,  color: DES  },
    interrompida: { bg: DESL,  color: DES  },
  }[a];
}

// ── Status icon ───────────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: TreatmentStatus }) {
  const s = statusColor(status);
  if (status === 'active')       return <CheckCircle size={14} color={s.color} weight="fill" />;
  if (status === 'paused')       return <PauseCircle size={14} color={s.color} weight="fill" />;
  if (status === 'completed')    return <CheckCircle size={14} color={s.color} />;
  return <XCircle size={14} color={s.color} weight="fill" />;
}

// ── Duration helper ────────────────────────────────────────────────────────────
function durationStr(start: string, end: string | null): string {
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const days = Math.floor((e.getTime() - s.getTime()) / 86_400_000);
  if (days < 30)  return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}m`;
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return m > 0 ? `${y}a ${m}m` : `${y}a`;
}

// ── Form ──────────────────────────────────────────────────────────────────────
function TreatmentForm({
  initial, patientId, onSave, onCancel, isEdit = false,
}: {
  initial: TreatmentFormState;
  patientId: string;
  onSave: (t: TrichologyTreatment) => void;
  onCancel: () => void;
  isEdit?: boolean;
  editId?: string;
}) {
  const [form, setForm] = useState<TreatmentFormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k: keyof TreatmentFormState, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nome do tratamento é obrigatório.'); return; }
    if (!form.start_date)  { setError('Data de início é obrigatória.'); return; }
    setSaving(true);
    setError('');
    try {
      const saved = await db.createTrichologyTreatment({
        patient_id:       patientId,
        name:             form.name.trim(),
        dose:             form.dose.trim() || undefined,
        frequency:        form.frequency.trim() || undefined,
        indication:       form.indication.trim() || undefined,
        start_date:       form.start_date,
        end_date:         form.end_date || null,
        status:           form.status,
        adherence_status: (form.adherence_status as AdherenceStatus) || null,
        adherence_notes:  form.adherence_notes.trim() || undefined,
      });
      onSave(saved);
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar tratamento.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: `1px solid ${BO}`,
    borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
    outline: 'none', background: '#fff', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: MU, marginBottom: 4, display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.04em' };
  const fieldStyle: React.CSSProperties = { marginBottom: 12 };

  return (
    <form onSubmit={handleSubmit} style={{ padding: '16px', background: SANDL, borderRadius: 12, border: `1px solid ${SAND}`, marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: INK, marginBottom: 14 }}>
        {isEdit ? 'Editar tratamento' : 'Novo tratamento'}
      </div>

      {/* Name */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Nome do tratamento *</label>
        <input
          style={inputStyle} value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Ex: Minoxidil, Finasterida, PRP…"
          autoFocus
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {/* Dose */}
        <div>
          <label style={labelStyle}>Dose</label>
          <input style={inputStyle} value={form.dose} onChange={e => set('dose', e.target.value)} placeholder="Ex: 2%" />
        </div>
        {/* Frequency */}
        <div>
          <label style={labelStyle}>Frequência</label>
          <select style={inputStyle} value={form.frequency} onChange={e => set('frequency', e.target.value)}>
            <option value="">Selecionar…</option>
            {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Indication */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Indicação</label>
        <select style={inputStyle} value={form.indication} onChange={e => set('indication', e.target.value)}>
          <option value="">Selecionar…</option>
          {INDICATIONS.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {/* Start date */}
        <div>
          <label style={labelStyle}>Início *</label>
          <input type="date" style={inputStyle} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
        </div>
        {/* Status */}
        <div>
          <label style={labelStyle}>Status</label>
          <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value as TreatmentStatus)}>
            <option value="active">Ativo</option>
            <option value="paused">Pausado</option>
            <option value="completed">Concluído</option>
            <option value="discontinued">Interrompido</option>
          </select>
        </div>
      </div>

      {/* Adherence */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Adesão</label>
        <select style={inputStyle} value={form.adherence_status} onChange={e => set('adherence_status', e.target.value)}>
          <option value="">Não avaliada</option>
          <option value="boa">Boa</option>
          <option value="parcial">Parcial</option>
          <option value="baixa">Baixa</option>
          <option value="interrompida">Interrompida</option>
        </select>
      </div>
      {form.adherence_status && form.adherence_status !== 'boa' && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Observação de adesão</label>
          <input
            style={inputStyle} value={form.adherence_notes}
            onChange={e => set('adherence_notes', e.target.value)}
            placeholder="Motivo, dificuldades, observações…"
          />
        </div>
      )}

      {error && <div style={{ color: DES, fontSize: 12, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{
          padding: '8px 16px', borderRadius: 8, border: `1px solid ${BO}`,
          background: '#fff', cursor: 'pointer', fontSize: 13, color: MU, fontFamily: 'inherit',
        }}>Cancelar</button>
        <button type="submit" disabled={saving} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: saving ? MU : P, color: '#fff', cursor: saving ? 'default' : 'pointer',
          fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
        }}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  );
}

// ── Treatment Card ─────────────────────────────────────────────────────────────
function TreatmentCard({
  treatment,
  onStatusChange,
}: {
  treatment: TrichologyTreatment;
  onStatusChange: (id: string, status: TreatmentStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const sc = statusColor(treatment.status);
  const ac = adherenceColor(treatment.adherence_status as AdherenceStatus | null);

  async function handleStatus(s: TreatmentStatus) {
    setChangingStatus(true);
    try {
      const endDate = (s === 'completed' || s === 'discontinued')
        ? new Date().toISOString().slice(0, 10)
        : undefined;
      await db.updateTrichologyTreatment(treatment.id, { status: s, end_date: endDate });
      onStatusChange(treatment.id, s);
    } finally {
      setChangingStatus(false);
    }
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: `1px solid ${BO}`,
      marginBottom: 10, overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: PL,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Pill size={18} color={P} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: INK }}>{treatment.name}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: sc.bg, color: sc.color,
            }}>
              <StatusIcon status={treatment.status} />
              {statusLabel(treatment.status)}
            </span>
            {treatment.adherence_status && (
              <span style={{
                padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                background: ac.bg, color: ac.color,
              }}>
                Adesão: {adherenceLabel(treatment.adherence_status as AdherenceStatus)}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px 12px', fontSize: 12, color: MU }}>
            {treatment.dose     && <span>{treatment.dose}</span>}
            {treatment.frequency && <span>{treatment.frequency}</span>}
            {treatment.indication && (
              <span style={{ background: SANDL, color: WARN, padding: '1px 6px', borderRadius: 6, fontWeight: 500 }}>
                {treatment.indication}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} />
              {new Date(treatment.start_date).toLocaleDateString('pt-BR')}
              {treatment.end_date && ` → ${new Date(treatment.end_date).toLocaleDateString('pt-BR')}`}
              {!treatment.end_date && treatment.status === 'active' && (
                <span style={{ color: P, fontWeight: 600 }}>
                  · {durationStr(treatment.start_date, null)} em uso
                </span>
              )}
            </span>
          </div>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: MU, padding: 4, flexShrink: 0 }}
        >
          {expanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
        </button>
      </div>

      {/* Expanded actions + notes */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${BO}`, padding: '12px 16px', background: BG }}>
          {treatment.adherence_notes && (
            <div style={{ fontSize: 12, color: MU, marginBottom: 12, fontStyle: 'italic' }}>
              "{treatment.adherence_notes}"
            </div>
          )}

          {/* Status change actions */}
          {treatment.status === 'active' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
              <button
                onClick={() => handleStatus('paused')}
                disabled={changingStatus}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: `1px solid ${WARN}`,
                  background: WARNL, color: WARN, cursor: 'pointer', fontSize: 12,
                  fontWeight: 500, fontFamily: 'inherit',
                }}
              >Pausar</button>
              <button
                onClick={() => handleStatus('completed')}
                disabled={changingStatus}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: `1px solid ${P}`,
                  background: PL, color: P, cursor: 'pointer', fontSize: 12,
                  fontWeight: 500, fontFamily: 'inherit',
                }}
              >Concluir</button>
              <button
                onClick={() => handleStatus('discontinued')}
                disabled={changingStatus}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: `1px solid ${DES}`,
                  background: DESL, color: DES, cursor: 'pointer', fontSize: 12,
                  fontWeight: 500, fontFamily: 'inherit',
                }}
              >Interromper</button>
            </div>
          )}
          {treatment.status === 'paused' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
              <button
                onClick={() => handleStatus('active')}
                disabled={changingStatus}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: `1px solid ${SUC}`,
                  background: SUCL, color: SUC, cursor: 'pointer', fontSize: 12,
                  fontWeight: 500, fontFamily: 'inherit',
                }}
              >Retomar</button>
              <button
                onClick={() => handleStatus('discontinued')}
                disabled={changingStatus}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: `1px solid ${DES}`,
                  background: DESL, color: DES, cursor: 'pointer', fontSize: 12,
                  fontWeight: 500, fontFamily: 'inherit',
                }}
              >Interromper</button>
            </div>
          )}
          {(treatment.status === 'completed' || treatment.status === 'discontinued') && (
            <div style={{ fontSize: 12, color: MU }}>
              Encerrado em {treatment.end_date ? new Date(treatment.end_date).toLocaleDateString('pt-BR') : '—'}
              {' · '}Duração total: {durationStr(treatment.start_date, treatment.end_date)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function TrichologyTreatmentsTab({
  patientId,
  suggestedTreatments = [],
}: {
  patientId: string;
  suggestedTreatments?: string[];
}) {
  const [treatments, setTreatments] = useState<TrichologyTreatment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [filter, setFilter]         = useState<'all' | 'active'>('active');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.fetchTrichologyTreatments(patientId);
      setTreatments(data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  function handleSave(t: TrichologyTreatment) {
    setTreatments(prev => [t, ...prev]);
    setShowForm(false);
  }

  function handleStatusChange(id: string, status: TreatmentStatus) {
    setTreatments(prev => prev.map(t =>
      t.id === id
        ? { ...t, status, end_date: (status === 'completed' || status === 'discontinued') ? new Date().toISOString().slice(0, 10) : t.end_date }
        : t
    ));
  }

  const active  = treatments.filter(t => t.status === 'active');
  const paused  = treatments.filter(t => t.status === 'paused');
  const closed  = treatments.filter(t => t.status === 'completed' || t.status === 'discontinued');
  const visible = filter === 'active' ? [...active, ...paused] : treatments;

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Suggestions banner */}
      {suggestedTreatments.length > 0 && (
        <div style={{
          background: WARNL, border: `1px solid ${SAND}`, borderRadius: 12,
          padding: '12px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: WARN, marginBottom: 6 }}>
            Tratamentos mencionados na última consulta
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
            {suggestedTreatments.map(name => (
              <button
                key={name}
                onClick={() => setShowForm(true)}
                style={{
                  padding: '4px 10px', borderRadius: 20, border: `1px solid ${WARN}`,
                  background: '#fff', color: WARN, cursor: 'pointer', fontSize: 12,
                  fontFamily: 'inherit', fontWeight: 500,
                }}
              >+ {name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: INK }}>Tratamentos</div>
          <div style={{ fontSize: 12, color: MU }}>
            {active.length} ativo{active.length !== 1 ? 's' : ''}
            {paused.length > 0 && ` · ${paused.length} pausado${paused.length !== 1 ? 's' : ''}`}
            {closed.length > 0 && ` · ${closed.length} encerrado${closed.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {closed.length > 0 && (
            <button
              onClick={() => setFilter(f => f === 'all' ? 'active' : 'all')}
              style={{
                padding: '6px 12px', borderRadius: 8, border: `1px solid ${BO}`,
                background: filter === 'all' ? P : '#fff',
                color: filter === 'all' ? '#fff' : MU,
                cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
              }}
            >{filter === 'all' ? 'Ocultar encerrados' : 'Ver histórico'}</button>
          )}
          <button
            onClick={() => setShowForm(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10, border: 'none',
              background: P, color: '#fff', cursor: 'pointer', fontSize: 13,
              fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancelar' : 'Adicionar'}
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <TreatmentForm
          initial={EMPTY_FORM}
          patientId={patientId}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center' as const, padding: '32px 0', color: MU, fontSize: 13 }}>
          Carregando tratamentos…
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center' as const, padding: '40px 16px', color: MU }}>
          <Pill size={32} color={BO} style={{ display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 500, color: INK, marginBottom: 4, fontSize: 14 }}>
            {filter === 'active' ? 'Nenhum tratamento ativo' : 'Nenhum tratamento registrado'}
          </div>
          <div style={{ fontSize: 12 }}>
            {filter === 'active'
              ? 'Use o botão "Adicionar" para registrar o plano terapêutico.'
              : 'Clique em "Adicionar" para registrar o primeiro tratamento.'}
          </div>
        </div>
      ) : (
        <div>
          {visible.map(t => (
            <TreatmentCard
              key={t.id}
              treatment={t}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
