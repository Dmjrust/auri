import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CheckCircle, Clock, Warning, X, Info, Plus } from '@phosphor-icons/react';
import { P, MU, BO, SUC, SUCL, WARN, WARNL, DES, DESL } from '../lib/design';
import * as db from '../lib/db';
import { type Patient } from '../data/mock';
import { fmtDate } from '../lib/auri-utils';
import { useIsMobile } from '../contexts/MobileContext';
import { Card, Badge, Btn } from './auri-ui';
import { ADULT_VACCINE_SCHEDULE } from './VaccinesTab';

type VaccineStatus = 'done' | 'pending' | 'overdue';

interface MergedAdultVaccine {
  id: string;
  name: string;
  dose: string;
  status: VaccineStatus;
  date: string | null;
  nextDueDate: string | null;
}

// ─── ADULT VACCINES TAB ───────────────────────────────────────────────────────
export function AdultVaccinesTab({ patient }: { patient: Patient }) {
  const [dbVaccines, setDbVaccines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [registerDate, setRegisterDate] = useState(new Date().toISOString().split('T')[0]);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualDose, setManualDose] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingManual, setSavingManual] = useState(false);
  const isMobile = useIsMobile();

  const ageYears = (() => {
    const bd = new Date(patient.birth_date), now = new Date();
    let y = now.getFullYear() - bd.getFullYear();
    const m = now.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) y--;
    return y;
  })();

  function refetch() {
    db.fetchVaccines(patient.id).then(setDbVaccines).catch(() => { toast.error('Erro ao carregar vacinas'); }).finally(() => setLoading(false));
  }
  useEffect(() => { refetch(); }, [patient.id]);

  // Merge: calendário do adulto + registros do paciente
  const vaccines: MergedAdultVaccine[] = ADULT_VACCINE_SCHEDULE
    .map((item, idx) => {
      const eligible = ageYears >= (item.min_age_years ?? 0);
      if (!eligible) return null;

      const matches = dbVaccines.filter(v => v.name === item.name && v.dose === item.dose && v.status === 'done');
      const latest = matches.length > 0
        ? matches.reduce((a, b) => (new Date(a.applied_at) > new Date(b.applied_at) ? a : b))
        : null;

      if (item.type === 'once') {
        if (latest) {
          return { id: latest.id, name: item.name, dose: item.dose, status: 'done' as const, date: latest.applied_at, nextDueDate: null };
        }
        const overdue = item.max_age_years !== undefined && ageYears > item.max_age_years;
        return { id: `adult-${idx}`, name: item.name, dose: item.dose, status: (overdue ? 'overdue' : 'pending') as VaccineStatus, date: null, nextDueDate: null };
      }

      // recurring
      if (!latest) {
        return { id: `adult-${idx}`, name: item.name, dose: item.dose, status: 'pending' as const, date: null, nextDueDate: null };
      }
      const nextDue = new Date(latest.applied_at);
      nextDue.setFullYear(nextDue.getFullYear() + (item.interval_years ?? 1));
      const due = nextDue <= new Date();
      return {
        id: due ? `adult-${idx}` : latest.id,
        name: item.name, dose: item.dose,
        status: (due ? 'pending' : 'done') as VaccineStatus,
        date: latest.applied_at,
        nextDueDate: due ? null : nextDue.toISOString().split('T')[0],
      };
    })
    .filter((v): v is MergedAdultVaccine => v !== null);

  // Vacinas registradas manualmente — fora do calendário fixo (nome/dose não bate com nenhum item)
  const scheduleKeys = new Set(ADULT_VACCINE_SCHEDULE.map(i => `${i.name}|${i.dose}`));
  const manualVaccines: MergedAdultVaccine[] = dbVaccines
    .filter(v => v.status === 'done' && !scheduleKeys.has(`${v.name}|${v.dose}`))
    .map(v => ({ id: v.id, name: v.name, dose: v.dose || '—', status: 'done' as const, date: v.applied_at, nextDueDate: null }));

  const done = [...vaccines.filter(v => v.status === 'done'), ...manualVaccines];
  const pending = vaccines.filter(v => v.status !== 'done');
  const overdue = pending.filter(v => v.status === 'overdue');
  const total = vaccines.length;
  const coverage = total > 0 ? Math.round(done.length / total * 100) : 0;

  async function handleRegister(v: MergedAdultVaccine, date: string) {
    try {
      await db.createVaccine({
        patient_id: patient.id, name: v.name, dose: v.dose,
        status: 'done', age_label: '', applied_at: date,
      });
      setRegisteringId(null);
      refetch();
    } catch (e) { console.error(e); toast.error('Erro ao registrar vacina.'); }
  }

  async function handleManualAdd() {
    if (!manualName.trim() || !manualDate) return;
    setSavingManual(true);
    try {
      await db.createVaccine({
        patient_id: patient.id, name: manualName.trim(), dose: manualDose.trim() || 'Dose única',
        status: 'done', age_label: '', applied_at: manualDate,
      });
      toast.success('Vacina registrada.');
      setShowManualAdd(false);
      setManualName(''); setManualDose(''); setManualDate(new Date().toISOString().split('T')[0]);
      refetch();
    } catch (e) { console.error(e); toast.error('Erro ao registrar vacina.'); }
    finally { setSavingManual(false); }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' as const, color: MU }}>Carregando vacinas…</div>;

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px',
        background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, marginBottom: 16,
      }}>
        <Info size={15} color="#3B82F6" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12, color: MU, lineHeight: 1.5 }}>
          Calendário de referência do Ministério da Saúde — ajuste conforme avaliação clínica individual, comorbidades e grupos de risco.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Doses aplicadas', value: done.length, color: SUC },
          { label: 'Pendentes/Atrasadas', value: pending.length, color: overdue.length > 0 ? DES : WARN },
          { label: 'Cobertura', value: `${coverage}%`, color: P },
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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 90px' : '1fr 110px 130px', gap: 12, padding: '12px 20px', borderBottom: registeringId === v.id ? 'none' : `1px solid ${BO}`, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: MU }}>{v.dose}</div>
                </div>
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
            <Clock size={15} color={WARN} /><span style={{ fontWeight: 600, fontSize: 14 }}>Pendentes</span>
          </div>
          {pending.filter(v => v.status === 'pending').map(v => (
            <div key={v.id}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 90px' : '1fr 110px 130px', gap: 12, padding: '12px 20px', borderBottom: registeringId === v.id ? 'none' : `1px solid ${BO}`, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: MU }}>{v.dose}</div>
                </div>
                {!isMobile && <Badge color={WARN} bg={WARNL}>Pendente</Badge>}
                <Btn size="sm" variant="secondary" onClick={() => setRegisteringId(registeringId === v.id ? null : v.id)}>
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

      <Card>
        <div style={{ padding: '14px 20px', borderBottom: showManualAdd ? 'none' : `1px solid ${BO}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500, fontSize: 15, fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.01em' }}>Vacinas aplicadas</span>
          <Btn variant="secondary" size="sm" onClick={() => setShowManualAdd(v => !v)}>
            <Plus size={13} /> Adicionar vacina
          </Btn>
        </div>
        {showManualAdd && (
          <div style={{ padding: '12px 20px 16px', borderBottom: `1px solid ${BO}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 12, color: MU }}>Para vacinas fora do calendário de referência (ex.: dose de viagem, vacina específica).</span>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr', gap: 10 }}>
              <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Nome da vacina *"
                style={{ padding: '7px 10px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
              <input value={manualDose} onChange={e => setManualDose(e.target.value)} placeholder="Dose (opcional)"
                style={{ padding: '7px 10px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
              <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)}
                style={{ padding: '7px 10px', border: `1px solid ${BO}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" onClick={handleManualAdd} disabled={!manualName.trim() || !manualDate || savingManual}>
                {savingManual ? 'Salvando…' : <><CheckCircle size={13} /> Salvar</>}
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => setShowManualAdd(false)}><X size={13} /></Btn>
            </div>
          </div>
        )}
        {done.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' as const, color: MU, fontSize: 13 }}>
            Nenhuma vacina registrada ainda. Use o botão "Registrar" para marcar as vacinas aplicadas.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 100px' : '1fr 150px 150px', padding: '8px 20px', borderBottom: `1px solid ${BO}`, fontSize: 11, fontWeight: 600, color: MU, textTransform: 'uppercase' as const }}>
              <span>Vacina / Dose</span><span>Data aplicação</span>{!isMobile && <span>Próxima dose</span>}
            </div>
            {[...done].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map(v => (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 100px' : '1fr 150px 150px', gap: 16, padding: '11px 20px', borderBottom: `1px solid ${BO}`, alignItems: 'center' }}>
                <div><span style={{ fontWeight: 500, fontSize: 14 }}>{v.name}</span><span style={{ marginLeft: 8, fontSize: 12, color: MU }}>{v.dose}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle size={13} color={SUC} /><span style={{ fontSize: 13 }}>{v.date ? fmtDate(v.date) : '—'}</span></div>
                {!isMobile && <span style={{ fontSize: 13, color: MU }}>{v.nextDueDate ? fmtDate(v.nextDueDate) : '—'}</span>}
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  );
}
