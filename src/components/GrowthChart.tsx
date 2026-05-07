import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Heartbeat, TrendUp, Baby, ChartBar } from '@phosphor-icons/react';
import { P, MU, BO, INK, SUC, SUCL, WARN, WARNL, DES } from '../lib/design';
import { calcZScore, zToPercentile, _getLms } from '../lib/zscore';
import * as db from '../lib/db';
import {
  GROWTH_DATA,
  LMS_WEIGHT_BOY, LMS_WEIGHT_GIRL,
  LMS_HEIGHT_BOY, LMS_HEIGHT_GIRL,
  LMS_HC_BOY,    LMS_HC_GIRL,
  LMS_BMI_BOY,   LMS_BMI_GIRL,
  type Patient, type Consultation,
} from '../data/mock';
import { fmtDate } from '../lib/auri-utils';
import { useIsMobile } from '../contexts/MobileContext';
import { Card, ZBadge } from './auri-ui';

export type GrowthMetric = 'weight' | 'height' | 'hc' | 'bmi';

// Table cell showing a numeric value + Z-score badge — extracted to module scope
// to prevent React from creating a new component type on every render.
function GrowthTableCell({ val, unit: u, z }: { val: number | undefined; unit: string; z: number | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 13, fontFamily: '"JetBrains Mono", monospace', fontFeatureSettings: '"tnum"' }}>
        {val ? `${val} ${u}` : '—'}
      </span>
      {z !== null && <ZBadge z={z} />}
    </div>
  );
}

export function GrowthChart({ patient, consultations = [] }: { patient: Patient; consultations?: Consultation[] }) {
  const [metric, setMetric] = useState<GrowthMetric>('weight');
  const [dbGrowth, setDbGrowth] = useState<{ month: number; weight?: number; height?: number; hc?: number; date: string }[]>([]);

  useEffect(() => {
    db.fetchGrowthRecords(patient.id)
      .then(setDbGrowth)
      .catch(() => setDbGrowth([]));
  }, [patient.id]);

  // Fallback: extrai medidas das consultas onde não há growth_record
  function extractFromConsultations() {
    const result: { month: number; weight?: number; height?: number; hc?: number; date: string }[] = [];
    const dbMonths = new Set(dbGrowth.map(r => r.month));
    consultations.forEach(c => {
      const bd = new Date(patient.birth_date), cd = new Date(c.scheduled_at);
      const ageMonths = Math.max(0, (cd.getFullYear() - bd.getFullYear()) * 12 + (cd.getMonth() - bd.getMonth()));
      if (dbMonths.has(ageMonths)) return;
      let weight: number | undefined, height: number | undefined, hc: number | undefined;
      if (c.summary.peso) { const m = c.summary.peso.match(/[\d]+[.,]?[\d]*/); weight = m ? parseFloat(m[0].replace(',','.')) : undefined; }
      if (c.summary.altura) { const m = c.summary.altura.match(/[\d]+[.,]?[\d]*/); height = m ? parseFloat(m[0].replace(',','.')) : undefined; }
      if (c.summary.perimetro_cefalico) { const m = c.summary.perimetro_cefalico.match(/[\d]+[.,]?[\d]*/); hc = m ? parseFloat(m[0].replace(',','.')) : undefined; }
      else if (c.summary.exame_fisico) {
        const m = c.summary.exame_fisico.match(/[Pp][Cc][:\s]+(\d+[.,]?\d*)\s*cm/);
        const m2 = !m ? c.summary.exame_fisico.match(/[Pp]er[íi]metro\s+[Cc]ef[áa]lico[:\s]+(\d+[.,]?\d*)\s*cm/) : null;
        const matched = m || m2;
        if (matched) hc = parseFloat(matched[1].replace(',','.'));
      }
      if (weight || height || hc) result.push({ month: ageMonths, weight, height, hc, date: c.scheduled_at.slice(0,10) });
    });
    return result;
  }

  const allMeasurements = [...dbGrowth, ...extractFromConsultations()];
  const mockGrowth = GROWTH_DATA[patient.id] || [];
  const seenMonths = new Set(allMeasurements.map(m => m.month));
  mockGrowth.forEach(m => { if (!seenMonths.has(m.month)) allMeasurements.push({ month: m.month, weight: m.weight, height: m.height, hc: m.hc, date: '' }); });
  const growth = allMeasurements.sort((a, b) => a.month - b.month);

  const isM = patient.gender === 'M';
  const sex = patient.gender;

  // ── LMS lookup for current metric ────────────────────────────────────────────
  const lmsTable = {
    weight: isM ? LMS_WEIGHT_BOY : LMS_WEIGHT_GIRL,
    height: isM ? LMS_HEIGHT_BOY : LMS_HEIGHT_GIRL,
    hc:     isM ? LMS_HC_BOY    : LMS_HC_GIRL,
    bmi:    isM ? LMS_BMI_BOY   : LMS_BMI_GIRL,
  }[metric];

  // Inverse LMS: measurement value at Z=z for given age
  function inverseLmsAt(month: number, z: number): number | undefined {
    const lms = _getLms(lmsTable, month);
    if (!lms) return undefined;
    const { L, M, S } = lms;
    if (Math.abs(L) < 0.0001) return M * Math.exp(S * z);
    const inner = 1 + L * S * z;
    if (inner <= 0) return undefined;
    return parseFloat((M * Math.pow(inner, 1 / L)).toFixed(2));
  }

  // Extract patient's value for current metric
  function patientValueAt(g: typeof growth[0]): number | undefined {
    if (metric === 'weight') return g.weight;
    if (metric === 'height') return g.height;
    if (metric === 'hc')     return g.hc;
    if (metric === 'bmi' && g.weight && g.height && g.height > 0)
      return parseFloat((g.weight / Math.pow(g.height / 100, 2)).toFixed(1));
    return undefined;
  }

  // ── Build chart data ──────────────────────────────────────────────────────────
  const grMap = Object.fromEntries(growth.map(g => [g.month, g]));
  const patientMonths = growth.filter(g => patientValueAt(g) !== undefined).map(g => g.month);
  const chartMonths = Array.from(new Set([...lmsTable.map(l => l.month), ...patientMonths])).sort((a, b) => a - b);

  const chartData = chartMonths.map(month => {
    const g = grMap[month];
    const pv = g ? patientValueAt(g) : undefined;
    return {
      month,
      label: `${month}m`,
      'Z-3': inverseLmsAt(month, -3),
      'Z-2': inverseLmsAt(month, -2),
      'Z-1': inverseLmsAt(month, -1),
      'Z0':  inverseLmsAt(month,  0),
      'Z+1': inverseLmsAt(month, +1),
      'Z+2': inverseLmsAt(month, +2),
      'Z+3': inverseLmsAt(month, +3),
      patient: pv,
      _date:   g?.date || '',
    };
  });

  // ── KPI summary (always from last overall measurement, not metric-specific) ──
  const last = growth[growth.length - 1];
  const lastWeightZ = last?.weight ? calcZScore(last.weight, last.month, sex, 'weight') : null;
  const lastHeightZ = last?.height ? calcZScore(last.height, last.month, sex, 'height') : null;
  const lastHcZ     = last?.hc     ? calcZScore(last.hc,     last.month, sex, 'hc')     : null;
  const lastWeightP = lastWeightZ !== null ? zToPercentile(lastWeightZ) : null;
  const lastHeightP = lastHeightZ !== null ? zToPercentile(lastHeightZ) : null;
  const lastHcP     = lastHcZ     !== null ? zToPercentile(lastHcZ)     : null;

  const unitLabel: Record<GrowthMetric, string> = { weight: 'kg', height: 'cm', hc: 'cm', bmi: 'kg/m²' };
  const unit = unitLabel[metric];

  // Reference line visual config
  const zBands = [
    { key: 'Z-3' as const, stroke: '#F87171', dash: '3 3', w: 1   },
    { key: 'Z-2' as const, stroke: '#FCA351', dash: '4 4', w: 1   },
    { key: 'Z-1' as const, stroke: '#6EBF8B', dash: '4 4', w: 1   },
    { key: 'Z0'  as const, stroke: '#94A3B8', dash: '6 3', w: 1.5 },
    { key: 'Z+1' as const, stroke: '#6EBF8B', dash: '4 4', w: 1   },
    { key: 'Z+2' as const, stroke: '#FCA351', dash: '4 4', w: 1   },
    { key: 'Z+3' as const, stroke: '#F87171', dash: '3 3', w: 1   },
  ];

  // Custom tooltip (only activates on patient data points)
  const GrowthTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    if (!row || row.patient == null) return null;
    const z = calcZScore(row.patient, row.month, sex, metric);
    const perc = z !== null ? zToPercentile(z) : null;
    return (
      <div style={{ background: '#fff', border: `1px solid ${BO}`, borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.09)', minWidth: 160 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          {row._date && <span style={{ fontSize: 12, color: MU }}>{fmtDate(row._date)}</span>}
          <span style={{ fontSize: 12, fontWeight: 600, color: MU }}>{row.label} de idade</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: INK, fontFamily: '"JetBrains Mono", monospace', fontFeatureSettings: '"tnum"', marginBottom: 5 }}>
          {typeof row.patient === 'number' ? row.patient.toFixed(1) : row.patient} {unit}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const }}>
          {perc !== null && (
            <span style={{ fontSize: 11, background: '#F1F5F9', color: MU, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>P{perc}</span>
          )}
          {z !== null && <ZBadge z={z} />}
        </div>
      </div>
    );
  };

  // Metric selector tabs
  const metricTabs: { key: GrowthMetric; label: string; icon: React.ReactNode }[] = [
    { key: 'weight', label: 'Peso',    icon: <Heartbeat size={12} /> },
    { key: 'height', label: 'Altura',  icon: <TrendUp   size={12} /> },
    { key: 'hc',     label: 'P. Cef.', icon: <Baby      size={12} /> },
    { key: 'bmi',    label: 'IMC',     icon: <ChartBar  size={12} /> },
  ];

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap' as const, gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em' }}>Curva de crescimento</h3>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: MU }}>Referência OMS — Z-escores ({isM ? 'meninos' : 'meninas'})</p>
        </div>
        {/* 4-metric pill selector */}
        <div style={{ display: 'flex', gap: 2, background: '#F1F5F9', padding: 3, borderRadius: 8 }}>
          {metricTabs.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setMetric(key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px',
                borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: 600, fontSize: 12, transition: 'all 0.15s',
                background: metric === key ? '#fff'        : 'transparent',
                color:      metric === key ? P             : MU,
                boxShadow:  metric === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI summary cards (última medição) ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Último peso',   val: last?.weight ? `${last.weight} kg` : '—', z: lastWeightZ, p: lastWeightP },
          { label: 'Última altura', val: last?.height ? `${last.height} cm` : '—', z: lastHeightZ, p: lastHeightP },
          { label: 'P. cefálico',   val: last?.hc     ? `${last.hc} cm`     : '—', z: lastHcZ,     p: lastHcP     },
        ].map(({ label, val, z, p }) => (
          <Card key={label} style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: MU }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, fontFamily: '"JetBrains Mono", monospace', fontFeatureSettings: '"tnum"' }}>{val}</div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
              {p !== null && <span style={{ fontSize: 11, color: MU, background: '#F3F4F6', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>P{p}</span>}
              <ZBadge z={z} />
              {z === null && <span style={{ fontSize: 11, color: MU }}>mês {last?.month}</span>}
            </div>
          </Card>
        ))}
      </div>

      {/* ── Gráfico com Z-bands + trajetória do paciente ────────────────────── */}
      <Card style={{ padding: 20 }}>
        {growth.length === 0 ? (
          <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: MU }}>
            <TrendUp size={32} />
            <span style={{ fontSize: 13 }}>Nenhuma medição registrada ainda.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BO} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: MU }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: MU }} unit={` ${unit}`} width={55} axisLine={false} tickLine={false} />
              <Tooltip content={<GrowthTooltip />} />

              {/* Z-score reference bands (fundo) */}
              {zBands.map(({ key, stroke, dash, w }) => (
                <Line key={key} dataKey={key} stroke={stroke} strokeWidth={w}
                  strokeDasharray={dash} dot={false} isAnimationActive={false}
                  legendType="none" connectNulls />
              ))}

              {/* Trajetória do paciente */}
              <Line
                dataKey="patient"
                stroke={P}
                strokeWidth={2.5}
                dot={(props: any) => {
                  if (props.payload?.patient == null) return <g key={`nd-${props.index}`} />;
                  return (
                    <circle key={`d-${props.index}`}
                      cx={props.cx} cy={props.cy} r={5}
                      fill={P} stroke="#fff" strokeWidth={2} />
                  );
                }}
                activeDot={{ r: 7, fill: P, stroke: '#fff', strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Legenda */}
        <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' as const, alignItems: 'center', paddingTop: 10, borderTop: `1px solid ${BO}` }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Faixas OMS:</span>
          {[
            { label: 'Z ±1 — adequado',           stroke: '#6EBF8B' },
            { label: 'Z ±2 — atenção',             stroke: '#FCA351' },
            { label: 'Z ±3 — fora do padrão',      stroke: '#F87171' },
            { label: 'Z0 — mediana',               stroke: '#94A3B8' },
          ].map(({ label, stroke }) => (
            <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748B' }}>
              <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke={stroke} strokeWidth="2" strokeDasharray="4 2" /></svg>
              {label}
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: P }}>
            <svg width="20" height="8">
              <line x1="0" y1="4" x2="20" y2="4" stroke={P} strokeWidth="2.5" />
              <circle cx="10" cy="4" r="3.5" fill={P} stroke="#fff" strokeWidth="1.5" />
            </svg>
            Paciente
          </span>
        </div>
      </Card>

      {/* ── Histórico de medições com Z-escore ─────────────────────────────── */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, fontWeight: 500, fontSize: 15, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em' }}>
          Histórico de medições
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 1fr 1fr 1fr', padding: '7px 20px', borderBottom: `1px solid ${BO}`, fontSize: 10, fontWeight: 700, color: MU, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
          <span>Mês</span><span>Peso</span><span>Altura</span><span>P. Cefálico</span><span>IMC</span>
        </div>
        {[...growth].reverse().map(g => {
          const wZ  = g.weight ? calcZScore(g.weight, g.month, sex, 'weight') : null;
          const hZ  = g.height ? calcZScore(g.height, g.month, sex, 'height') : null;
          const hcZ = g.hc     ? calcZScore(g.hc,     g.month, sex, 'hc')     : null;
          const bmi = (g.weight && g.height && g.height > 0) ? g.weight / Math.pow(g.height / 100, 2) : null;
          const bmiZ = bmi ? calcZScore(bmi, g.month, sex, 'bmi') : null;

          return (
            <div key={g.month} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 1fr 1fr 1fr', padding: '10px 20px', borderBottom: `1px solid ${BO}`, alignItems: 'start' }}>
              <span style={{ fontWeight: 600, fontSize: 13, paddingTop: 2 }}>{g.month}m</span>
              <GrowthTableCell val={g.weight}        unit="kg"    z={wZ}  />
              <GrowthTableCell val={g.height}        unit="cm"    z={hZ}  />
              <GrowthTableCell val={g.hc}            unit="cm"    z={hcZ} />
              <GrowthTableCell val={bmi ?? undefined} unit="kg/m²" z={bmiZ} />
            </div>
          );
        })}
        {growth.length === 0 && (
          <div style={{ padding: '24px 20px', textAlign: 'center', color: MU, fontSize: 13 }}>Nenhuma medição registrada.</div>
        )}
      </Card>
    </div>
  );
}
