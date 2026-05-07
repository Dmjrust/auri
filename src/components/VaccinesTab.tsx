import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Warning, X } from '@phosphor-icons/react';
import { P, MU, BO, SUC, SUCL, WARN, WARNL, DES, DESL } from '../lib/design';
import * as db from '../lib/db';
import { type Patient } from '../data/mock';
import { fmtDate } from '../lib/auri-utils';
import { useIsMobile } from '../contexts/MobileContext';
import { Card, Badge, Btn } from './auri-ui';

// ─── PNI SCHEDULE (Calendário Vacinal SBP/MS 2024) ───────────────────────────
export const PNI_SCHEDULE = [
  { name: 'BCG', dose: '1ª dose', age_months: 0, age_label: 'Ao nascer' },
  { name: 'Hepatite B', dose: '1ª dose', age_months: 0, age_label: 'Ao nascer' },
  { name: 'Penta (DTP+Hib+HepB)', dose: '1ª dose', age_months: 2, age_label: '2 meses' },
  { name: 'VIP (Polio inativada)', dose: '1ª dose', age_months: 2, age_label: '2 meses' },
  { name: 'Rotavírus Humano', dose: '1ª dose', age_months: 2, age_label: '2 meses' },
  { name: 'Pneumocócica 10V', dose: '1ª dose', age_months: 2, age_label: '2 meses' },
  { name: 'Meningocócica C', dose: '1ª dose', age_months: 3, age_label: '3 meses' },
  { name: 'Penta (DTP+Hib+HepB)', dose: '2ª dose', age_months: 4, age_label: '4 meses' },
  { name: 'VIP (Polio inativada)', dose: '2ª dose', age_months: 4, age_label: '4 meses' },
  { name: 'Rotavírus Humano', dose: '2ª dose', age_months: 4, age_label: '4 meses' },
  { name: 'Pneumocócica 10V', dose: '2ª dose', age_months: 4, age_label: '4 meses' },
  { name: 'Meningocócica C', dose: '2ª dose', age_months: 5, age_label: '5 meses' },
  { name: 'Penta (DTP+Hib+HepB)', dose: '3ª dose', age_months: 6, age_label: '6 meses' },
  { name: 'VIP (Polio inativada)', dose: '3ª dose', age_months: 6, age_label: '6 meses' },
  { name: 'Meningocócica ACWY', dose: '1ª dose', age_months: 12, age_label: '12 meses' },
  { name: 'Febre Amarela', dose: '1ª dose', age_months: 12, age_label: '12 meses' },
  { name: 'Tríplice Viral (SCR)', dose: '1ª dose', age_months: 12, age_label: '12 meses' },
  { name: 'Varicela', dose: '1ª dose', age_months: 12, age_label: '12 meses' },
  { name: 'Pneumocócica 10V', dose: 'Reforço', age_months: 12, age_label: '12 meses' },
  { name: 'Meningocócica C', dose: 'Reforço', age_months: 12, age_label: '12 meses' },
  { name: 'Hepatite A', dose: '1ª dose', age_months: 12, age_label: '12 meses' },
  { name: 'DTP', dose: '1º Reforço', age_months: 15, age_label: '15 meses' },
  { name: 'VOP (Polio oral)', dose: '1º Reforço', age_months: 15, age_label: '15 meses' },
  { name: 'Tríplice Viral (SCR)', dose: '2ª dose', age_months: 15, age_label: '15 meses' },
  { name: 'DTP', dose: '2º Reforço', age_months: 48, age_label: '4 anos' },
  { name: 'VOP (Polio oral)', dose: '2º Reforço', age_months: 48, age_label: '4 anos' },
  { name: 'Varicela', dose: '2ª dose', age_months: 48, age_label: '4 anos' },
  { name: 'HPV', dose: '1ª dose', age_months: 108, age_label: '9 anos' },
  { name: 'HPV', dose: '2ª dose', age_months: 114, age_label: '9a 6m' },
  { name: 'Meningocócica ACWY', dose: 'Reforço', age_months: 120, age_label: '10 anos' },
  { name: 'dT (Difteria + Tétano)', dose: 'Reforço', age_months: 132, age_label: '11 anos' },
];

// ─── VACCINES TAB ─────────────────────────────────────────────────────────────
export function VaccinesTab({ patient }: { patient: Patient }) {
  const [dbVaccines, setDbVaccines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [registerDate, setRegisterDate] = useState(new Date().toISOString().split('T')[0]);
  const isMobile = useIsMobile();

  const ageMonths = (() => {
    const bd = new Date(patient.birth_date), now = new Date();
    return (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
  })();

  function refetch() {
    db.fetchVaccines(patient.id).then(setDbVaccines).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { refetch(); }, [patient.id]);

  // Build merged list: PNI schedule + DB records
  const vaccines = PNI_SCHEDULE.map((pni, idx) => {
    const applied = dbVaccines.find(v => v.name === pni.name && v.dose === pni.dose && v.status === 'done');
    let status: 'done' | 'pending' | 'overdue';
    if (applied) {
      status = 'done';
    } else if (pni.age_months < ageMonths) {
      // Recomendada em mês anterior → em atraso
      status = 'overdue';
    } else {
      // Recomendada este mês ou futura → pendente (no prazo)
      status = 'pending';
    }
    return {
      id: applied?.id || `pni-${idx}`,
      name: pni.name,
      dose: pni.dose,
      age_label: pni.age_label,
      age_months: pni.age_months,
      status,
      date: applied?.applied_at || null,
      dbId: applied?.id || null,
    };
  });

  const done = vaccines.filter(v => v.status === 'done');
  const pending = vaccines.filter(v => v.status !== 'done');
  const overdue = pending.filter(v => v.status === 'overdue');
  const total = vaccines.length;
  const coverage = total > 0 ? Math.round(done.length / total * 100) : 0;

  async function handleRegister(v: typeof vaccines[0], date: string) {
    try {
      if (v.dbId) {
        await db.updateVaccineStatus(v.dbId, 'done', date);
      } else {
        await db.createVaccine({
          patient_id: patient.id, name: v.name, dose: v.dose,
          status: 'done', age_label: v.age_label, applied_at: date,
        });
      }
      setRegisteringId(null);
      refetch();
    } catch (e) { console.error(e); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' as const, color: MU }}>Carregando vacinas…</div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Doses aplicadas', value: done.length, color: SUC },
          { label: 'Pendentes/Atrasadas', value: pending.length, color: overdue.length > 0 ? DES : WARN },
          { label: 'Cobertura PNI', value: `${coverage}%`, color: P },
        ].map(({ label, value, color }) => (
          <Card key={label} style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: MU, fontWeight: 500, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </Card>
        ))}
      </div>
      {overdue.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Warning size={15} color={DES} /><span style={{ fontWeight: 600, fontSize: 14 }}>Vacinas em atraso</span>
            <Badge color={DES} bg={DESL}>{overdue.length}</Badge>
          </div>
          {overdue.map(v => (
            <div key={v.id}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 90px' : '1fr 120px 110px 130px', gap: 12, padding: '12px 20px', borderBottom: registeringId === v.id ? 'none' : `1px solid ${BO}`, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: MU }}>{v.dose} · {v.age_label}</div>
                </div>
                {!isMobile && <span style={{ fontSize: 13, color: MU }}>{v.age_label}</span>}
                {!isMobile && <Badge color={DES} bg={DESL}>Atrasada</Badge>}
                <Btn size="sm" onClick={() => setRegisteringId(registeringId === v.id ? null : v.id)}>
                  <CheckCircle size={13} /> Registrar
                </Btn>
              </div>
              {registeringId === v.id && (
                <div style={{ padding: '10px 20px 14px', background: SUCL, borderBottom: `1px solid ${BO}`, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: MU, flexShrink: 0 }}>Data de aplicação:</span>
                  <input type="date" value={registerDate} onChange={e => setRegisterDate(e.target.value)}
                    style={{ padding: '6px 10px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
                  <Btn size="sm" onClick={() => handleRegister(v, registerDate)}><CheckCircle size={13} /> Confirmar</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setRegisteringId(null)}><X size={13} /></Btn>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
      {pending.filter(v => v.status === 'pending').length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={15} color={WARN} /><span style={{ fontWeight: 600, fontSize: 14 }}>Próximas vacinas</span>
          </div>
          {pending.filter(v => v.status === 'pending').slice(0, 10).map(v => (
            <div key={v.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 90px' : '1fr 120px 110px 130px', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${BO}`, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div>
                <div style={{ fontSize: 12, color: MU }}>{v.dose}</div>
              </div>
              {!isMobile && <span style={{ fontSize: 13, color: MU }}>{v.age_label}</span>}
              {!isMobile && <Badge color={WARN} bg={WARNL}>Prevista</Badge>}
              <Btn size="sm" variant="secondary" onClick={() => setRegisteringId(registeringId === v.id ? null : v.id)}>Antecipar</Btn>
            </div>
          ))}
        </Card>
      )}
      <Card>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BO}`, fontWeight: 500, fontSize: 15, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em' }}>
          Vacinas aplicadas
        </div>
        {done.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' as const, color: MU, fontSize: 13 }}>
            Nenhuma vacina registrada ainda. Use o botão "Registrar" para marcar as vacinas aplicadas.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 100px' : '1fr 120px 150px', padding: '8px 20px', borderBottom: `1px solid ${BO}`, fontSize: 11, fontWeight: 600, color: MU, textTransform: 'uppercase' as const }}>
              <span>Vacina / Dose</span><span>Idade</span>{!isMobile && <span>Data aplicação</span>}
            </div>
            {[...done].sort((a, b) => b.age_months - a.age_months).map(v => (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 100px' : '1fr 120px 150px', gap: 16, padding: '11px 20px', borderBottom: `1px solid ${BO}`, alignItems: 'center' }}>
                <div><span style={{ fontWeight: 500, fontSize: 14 }}>{v.name}</span><span style={{ marginLeft: 8, fontSize: 12, color: MU }}>{v.dose}</span></div>
                <span style={{ fontSize: 13, color: MU }}>{v.age_label}</span>
                {!isMobile && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle size={13} color={SUC} /><span style={{ fontSize: 13 }}>{v.date ? fmtDate(v.date) : '—'}</span></div>}
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  );
}
