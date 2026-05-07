import { supabase } from './supabase';
import type { Patient, Consultation, StructuredSummary, AnamnesePrimeiraConsultaData } from '../data/mock';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const signUp = (email: string, password: string, fullName: string) =>
  supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });

export const signIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });

export const getSession = () => supabase.auth.getSession();

// ── Patients ──────────────────────────────────────────────────────────────────
export async function fetchPatients(): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('*, patient_guardians(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(p => mapPatient(p));
}

export async function createPatient(input: {
  full_name: string; birth_date: string; gender: 'M' | 'F';
  blood_type?: string; delivery_type?: string;
  gestational_age_weeks?: number; birth_weight_g?: number; notes?: string;
  insurance_plan?: string; insurance_card_number?: string;
  guardian_name: string; guardian_relationship: string;
  guardian_phone: string; guardian_email?: string;
}): Promise<Patient> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data: pat, error: e1 } = await supabase
    .from('patients')
    .insert({
      doctor_id: user.id,
      full_name: input.full_name,
      birth_date: input.birth_date,
      gender: input.gender,
      blood_type: input.blood_type || null,
      delivery_type: input.delivery_type || '',
      gestational_age_weeks: input.gestational_age_weeks || null,
      birth_weight_g: input.birth_weight_g || null,
      notes: input.notes || '',
      insurance_plan: input.insurance_plan || null,
      insurance_card_number: input.insurance_card_number || null,
    })
    .select()
    .single();
  if (e1) throw e1;

  const { error: e2 } = await supabase.from('patient_guardians').insert({
    patient_id: pat.id,
    name: input.guardian_name,
    relationship: input.guardian_relationship,
    phone: input.guardian_phone,
    email: input.guardian_email || null,
    is_primary: true,
  });
  if (e2) throw e2;

  return mapPatient({
    ...pat,
    patient_guardians: [{
      name: input.guardian_name, relationship: input.guardian_relationship,
      phone: input.guardian_phone, email: input.guardian_email || null, is_primary: true,
    }],
  });
}

// ── Consultations ─────────────────────────────────────────────────────────────
export async function fetchConsultations(patientId: string): Promise<Consultation[]> {
  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .eq('patient_id', patientId)
    .order('scheduled_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapConsultation);
}

function parseNum(val: string): number | null {
  if (!val) return null;
  const m = val.match(/[\d]+[.,]?[\d]*/);
  return m ? parseFloat(m[0].replace(',', '.')) : null;
}

export async function saveConsultation(
  patientId: string,
  summary: StructuredSummary,
  durationSeconds: number,
  birthDate: string,
  consultType: 'retorno' | 'primeira vez' = 'retorno',
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const now = new Date();

  const { data: saved, error } = await supabase.from('consultations').insert({
    patient_id: patientId,
    doctor_id: user.id,
    scheduled_at: now.toISOString(),
    status: 'completed',
    type: consultType,
    duration_minutes: Math.max(1, Math.round(durationSeconds / 60)),
    chief_complaint: summary.queixa_principal,
    diagnosis: summary.hipoteses[0] || '',
    plan: summary.conduta,
    prescription: '',
    anamnesis: summary.hda,
    physical_exam: summary.exame_fisico,
    sum_queixa_principal: summary.queixa_principal,
    sum_hda: summary.hda,
    sum_exame_fisico: summary.exame_fisico,
    sum_hipoteses: summary.hipoteses,
    sum_conduta: summary.conduta,
    sum_retorno: summary.retorno,
    sum_peso: summary.peso,
    sum_altura: summary.altura,
    sum_perimetro_cefalico: summary.perimetro_cefalico,
    sum_vacinas_mencionadas: summary.vacinas_mencionadas,
  }).select('id').single();
  if (error) throw error;

  // Grava em growth_records se houver alguma medida
  const bd = new Date(birthDate);
  const monthAge = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
  const weightKg = parseNum(summary.peso);
  const heightCm = parseNum(summary.altura);
  const hcCm = parseNum(summary.perimetro_cefalico);
  if (weightKg || heightCm || hcCm) {
    await supabase.from('growth_records').insert({
      patient_id: patientId,
      month_age: Math.max(0, monthAge),
      weight_kg: weightKg,
      height_cm: heightCm,
      head_circumference_cm: hcCm,
    });
  }
  return saved.id as string;
}

// ── Save draft consultation (auto-saved on processing complete) ───────────────
export async function saveDraftConsultation(
  patientId: string,
  summary: StructuredSummary,
  durationSeconds: number,
  consultType: 'retorno' | 'primeira vez' = 'retorno',
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const now = new Date();
  const { data, error } = await supabase.from('consultations').insert({
    patient_id: patientId,
    doctor_id: user.id,
    scheduled_at: now.toISOString(),
    status: 'draft',
    type: consultType,
    duration_minutes: Math.max(1, Math.round(durationSeconds / 60)),
    chief_complaint: summary.queixa_principal,
    diagnosis: summary.hipoteses[0] || '',
    plan: summary.conduta,
    prescription: '',
    anamnesis: summary.hda,
    physical_exam: summary.exame_fisico,
    sum_queixa_principal: summary.queixa_principal,
    sum_hda: summary.hda,
    sum_exame_fisico: summary.exame_fisico,
    sum_hipoteses: summary.hipoteses,
    sum_conduta: summary.conduta,
    sum_retorno: summary.retorno,
    sum_peso: summary.peso,
    sum_altura: summary.altura,
    sum_perimetro_cefalico: summary.perimetro_cefalico,
    sum_vacinas_mencionadas: summary.vacinas_mencionadas,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

// ── Confirm draft → completed (saves edited summary + growth records) ─────────
export async function confirmDraftConsultation(
  draftId: string,
  patientId: string,
  summary: StructuredSummary,
  durationSeconds: number,
  birthDate: string,
): Promise<void> {
  // Persiste o resumo editado pelo médico junto com a confirmação
  const { error } = await supabase
    .from('consultations')
    .update({
      status: 'completed',
      duration_minutes: Math.max(1, Math.round(durationSeconds / 60)),
      chief_complaint:          summary.queixa_principal,
      diagnosis:                summary.hipoteses[0] || '',
      plan:                     summary.conduta,
      anamnesis:                summary.hda,
      physical_exam:            summary.exame_fisico,
      sum_queixa_principal:     summary.queixa_principal,
      sum_hda:                  summary.hda,
      sum_exame_fisico:         summary.exame_fisico,
      sum_hipoteses:            summary.hipoteses,
      sum_conduta:              summary.conduta,
      sum_retorno:              summary.retorno,
      sum_peso:                 summary.peso,
      sum_altura:               summary.altura,
      sum_perimetro_cefalico:   summary.perimetro_cefalico,
      sum_vacinas_mencionadas:  summary.vacinas_mencionadas,
    })
    .eq('id', draftId);
  if (error) throw error;

  const now = new Date();
  const bd = new Date(birthDate);
  const monthAge = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
  const weightKg = parseNum(summary.peso);
  const heightCm = parseNum(summary.altura);
  const hcCm = parseNum(summary.perimetro_cefalico);
  if (weightKg || heightCm || hcCm) {
    await supabase.from('growth_records').insert({
      patient_id: patientId,
      month_age: Math.max(0, monthAge),
      weight_kg: weightKg,
      height_cm: heightCm,
      head_circumference_cm: hcCm,
    });
  }
}

// ── Create Appointment ────────────────────────────────────────────────────────
export async function createAppointment(input: {
  patient_id: string;
  scheduled_at: string;
  type: 'retorno' | 'primeira vez';
  chief_complaint?: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { error } = await supabase.from('consultations').insert({
    patient_id: input.patient_id,
    doctor_id: user.id,
    scheduled_at: input.scheduled_at,
    status: 'scheduled',
    type: input.type,
    chief_complaint: input.chief_complaint || '',
    duration_minutes: 0,
    diagnosis: '', plan: '', prescription: '', anamnesis: '', physical_exam: '',
    sum_queixa_principal: '', sum_hda: '', sum_exame_fisico: '',
    sum_hipoteses: [], sum_conduta: '', sum_retorno: '',
    sum_peso: '', sum_altura: '', sum_vacinas_mencionadas: [],
  });
  if (error) throw error;
}

// ── Appointments ──────────────────────────────────────────────────────────────
export async function fetchAppointmentsForWeek(from: string, to: string) {
  const { data, error } = await supabase
    .from('consultations')
    .select('id, scheduled_at, status, type, chief_complaint, patient_id, patients(full_name, birth_date, patient_guardians(name, is_primary))')
    .gte('scheduled_at', from + 'T00:00:00')
    .lte('scheduled_at', to + 'T23:59:59')
    .order('scheduled_at', { ascending: true });
  if (error) throw error;

  return (data || []).map((c: any) => {
    const patient = c.patients;
    const guardians: any[] = patient?.patient_guardians || [];
    const primary = guardians.find((g: any) => g.is_primary) || guardians[0];
    let age = '';
    if (patient?.birth_date) {
      const bd = new Date(patient.birth_date);
      const now = new Date();
      const months = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
      age = months < 24 ? `${months}m` : `${Math.floor(months / 12)}a`;
    }
    return {
      id: c.id,
      time: new Date(c.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      patient_id: c.patient_id,
      patient_name: patient?.full_name || 'Paciente',
      age,
      type: (c.type || 'retorno') as 'retorno' | 'primeira vez',
      status: (c.status || 'scheduled') as 'completed' | 'in_progress' | 'scheduled',
      chief_complaint: c.chief_complaint || '',
      guardian: primary?.name || '',
      date: c.scheduled_at.slice(0, 10),
    };
  });
}

export async function updateAppointment(id: string, input: {
  scheduled_at?: string;
  type?: 'retorno' | 'primeira vez';
  chief_complaint?: string;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}): Promise<void> {
  const { error } = await supabase.from('consultations').update(input).eq('id', id);
  if (error) throw error;
}

export async function cancelAppointment(id: string): Promise<void> {
  const { error } = await supabase.from('consultations').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw error;
}

// ── Today's appointments ──────────────────────────────────────────────────────
export async function fetchTodayAppointments() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('consultations')
    .select('id, scheduled_at, status, type, patient_id, patients(full_name, birth_date, patient_guardians(name, phone, is_primary))')
    .gte('scheduled_at', today + 'T00:00:00')
    .lte('scheduled_at', today + 'T23:59:59')
    .order('scheduled_at', { ascending: true });
  if (error) return [];
  return (data || []).map((c: any) => {
    const patient = c.patients;
    const guardians: any[] = patient?.patient_guardians || [];
    const primary = guardians.find((g: any) => g.is_primary) || guardians[0];
    let age = '';
    if (patient?.birth_date) {
      const bd = new Date(patient.birth_date), now = new Date();
      const months = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
      age = months < 24 ? `${months}m` : `${Math.floor(months / 12)}a ${months % 12 > 0 ? (months % 12) + 'm' : ''}`.trim();
    }
    return {
      id: c.id,
      time: new Date(c.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      patient_id: c.patient_id,
      patient_name: patient?.full_name || 'Paciente',
      patient_birth_date: patient?.birth_date || '',
      age,
      type: (c.type || 'retorno') as 'retorno' | 'primeira vez',
      status: (c.status || 'scheduled') as 'completed' | 'in_progress' | 'scheduled',
      guardian: primary?.name || '',
      guardian_phone: primary?.phone || '',
    };
  });
}

// ── Day Briefing (batch fetch para briefing clínico do dashboard) ─────────────
export interface DayBriefingItem {
  patientId: string;
  lastConsult: {
    date: string;
    type: string;
    chiefComplaint: string;
    diagnosis: string;
    plan: string;
    retorno: string;
    peso: string;
    altura: string;
  } | null;
  totalConsults: number;
  overdueVaccines: string[];
  lastVaccine: { name: string; appliedAt: string } | null;
  lastGrowth: { weight: number | null; height: number | null; date: string } | null;
}

export async function fetchDayBriefing(patientIds: string[]): Promise<Record<string, DayBriefingItem>> {
  if (patientIds.length === 0) return {};

  const [consultsRes, vaccinesRes, growthRes] = await Promise.all([
    supabase
      .from('consultations')
      .select('id, patient_id, scheduled_at, type, chief_complaint, diagnosis, plan, sum_retorno, sum_peso, sum_altura, status')
      .in('patient_id', patientIds)
      .eq('status', 'completed')
      .order('scheduled_at', { ascending: false }),
    supabase
      .from('patient_vaccines')
      .select('patient_id, name, dose, status, applied_at')
      .in('patient_id', patientIds)
      .order('applied_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('growth_records')
      .select('patient_id, weight_kg, height_cm, created_at')
      .in('patient_id', patientIds)
      .order('created_at', { ascending: false }),
  ]);

  const result: Record<string, DayBriefingItem> = {};
  patientIds.forEach(id => {
    result[id] = { patientId: id, lastConsult: null, totalConsults: 0, overdueVaccines: [], lastVaccine: null, lastGrowth: null };
  });

  (consultsRes.data || []).forEach((c: any) => {
    const item = result[c.patient_id];
    if (!item) return;
    item.totalConsults++;
    if (!item.lastConsult) {
      item.lastConsult = {
        date: c.scheduled_at?.slice(0, 10) || '',
        type: c.type || 'retorno',
        chiefComplaint: c.chief_complaint || '',
        diagnosis: c.diagnosis || '',
        plan: c.plan || '',
        retorno: c.sum_retorno || '',
        peso: c.sum_peso || '',
        altura: c.sum_altura || '',
      };
    }
  });

  const seenLastVacc = new Set<string>();
  (vaccinesRes.data || []).forEach((v: any) => {
    const item = result[v.patient_id];
    if (!item) return;
    if (!seenLastVacc.has(v.patient_id) && v.status === 'done' && v.applied_at) {
      item.lastVaccine = { name: v.name, appliedAt: v.applied_at.slice(0, 10) };
      seenLastVacc.add(v.patient_id);
    }
    if (v.status === 'overdue' && !item.overdueVaccines.includes(v.name)) {
      item.overdueVaccines.push(v.name);
    }
  });

  const seenGrowth = new Set<string>();
  (growthRes.data || []).forEach((r: any) => {
    if (seenGrowth.has(r.patient_id)) return;
    const item = result[r.patient_id];
    if (!item) return;
    item.lastGrowth = {
      weight: r.weight_kg ? parseFloat(r.weight_kg) : null,
      height: r.height_cm ? parseFloat(r.height_cm) : null,
      date: r.created_at?.slice(0, 10) || '',
    };
    seenGrowth.add(r.patient_id);
  });

  return result;
}

// ── Recent activity ───────────────────────────────────────────────────────────
export async function fetchRecentActivity() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('consultations')
    .select('id, scheduled_at, type, patient_id, patients(full_name)')
    .eq('doctor_id', user.id)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false })
    .limit(5);
  return (data || []).map((c: any) => ({
    id: c.id,
    patient_id: c.patient_id,
    patient_name: c.patients?.full_name || 'Paciente',
    date: c.scheduled_at?.slice(0, 10) || '',
    type: c.type as 'retorno' | 'primeira vez',
  }));
}

// ── Consultation Evolution (by date and type) ─────────────────────────────
export async function fetchConsultationEvolution(days: number): Promise<{ date: string; 'Primeira vez': number; 'Retorno': number }[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('consultations')
    .select('scheduled_at, type, status')
    .eq('doctor_id', user.id)
    .eq('status', 'completed')
    .gte('scheduled_at', startDate)
    .lte('scheduled_at', now.toISOString().slice(0, 10) + 'T23:59:59')
    .order('scheduled_at', { ascending: true });

  if (error || !data) return [];

  // Group by date and type
  const grouped: Record<string, { 'Primeira vez': number; 'Retorno': number }> = {};
  data.forEach((c: any) => {
    const date = c.scheduled_at.slice(0, 10);
    if (!grouped[date]) grouped[date] = { 'Primeira vez': 0, 'Retorno': 0 };
    const typeLabel = c.type === 'primeira vez' ? 'Primeira vez' : 'Retorno';
    grouped[date][typeLabel]++;
  });

  // Fill missing dates with zero
  const result: { date: string; 'Primeira vez': number; 'Retorno': number }[] = [];
  const current = new Date(startDate);
  while (current <= now) {
    const dateStr = current.toISOString().slice(0, 10);
    result.push({
      date: dateStr,
      'Primeira vez': grouped[dateStr]?.['Primeira vez'] || 0,
      'Retorno': grouped[dateStr]?.['Retorno'] || 0,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

// ── Consultation counts per patient ──────────────────────────────────────────
export async function fetchConsultationSummaries(): Promise<Record<string, { count: number; lastDate: string | null }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const { data, error } = await supabase
    .from('consultations')
    .select('patient_id, scheduled_at')
    .eq('doctor_id', user.id)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false });
  if (error) return {};
  const map: Record<string, { count: number; lastDate: string | null }> = {};
  (data || []).forEach((c: any) => {
    if (!map[c.patient_id]) map[c.patient_id] = { count: 0, lastDate: null };
    map[c.patient_id].count++;
    if (!map[c.patient_id].lastDate) map[c.patient_id].lastDate = c.scheduled_at.slice(0, 10);
  });
  return map;
}

// ── Clinic Panel Data ─────────────────────────────────────────────────────────
export interface ClinicPanelData {
  periodStart: string;
  patients: { id: string; birth_date: string; full_name: string; created_at: string }[];
  periodConsults: { date: string; type: string; status: string; patient_id: string }[];
  prevConsults: { date: string; type: string; patient_id: string }[];
  allConsults: { date: string; type: string; status: string; patient_id: string }[];
  allVaccines: { patient_id: string; name: string; dose: string; status: string }[];
}

export async function fetchClinicPanelData(days: number): Promise<ClinicPanelData | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const periodStartDate = days === 1
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : new Date(now.getTime() - (days - 1) * 86400000);
  const periodStart = periodStartDate.toISOString().slice(0, 10);

  const prevEndDate = new Date(periodStartDate.getTime() - 86400000);
  const prevEnd = prevEndDate.toISOString().slice(0, 10);
  const prevStartDate = new Date(periodStartDate.getTime() - days * 86400000);
  const prevStart = prevStartDate.toISOString().slice(0, 10);

  const [patientsRes, periodConsultsRes, prevConsultsRes, allConsultsRes] = await Promise.all([
    supabase.from('patients')
      .select('id, birth_date, full_name, created_at')
      .eq('doctor_id', user.id)
      .eq('is_active', true),
    supabase.from('consultations')
      .select('scheduled_at, type, status, patient_id')
      .eq('doctor_id', user.id)
      .gte('scheduled_at', periodStart + 'T00:00:00')
      .lte('scheduled_at', todayStr + 'T23:59:59'),
    supabase.from('consultations')
      .select('scheduled_at, type, patient_id')
      .eq('doctor_id', user.id)
      .eq('status', 'completed')
      .gte('scheduled_at', prevStart + 'T00:00:00')
      .lte('scheduled_at', prevEnd + 'T23:59:59'),
    supabase.from('consultations')
      .select('scheduled_at, type, status, patient_id')
      .eq('doctor_id', user.id)
      .in('status', ['completed', 'scheduled'])
      .order('scheduled_at', { ascending: false }),
  ]);

  const patientIds = (patientsRes.data || []).map((p: any) => p.id);
  const vaccinesRes = patientIds.length > 0
    ? await supabase.from('patient_vaccines').select('patient_id, name, dose, status').in('patient_id', patientIds)
    : { data: [] };

  return {
    periodStart,
    patients: (patientsRes.data || []).map((p: any) => ({
      id: p.id,
      birth_date: p.birth_date,
      full_name: p.full_name,
      created_at: (p.created_at || '').slice(0, 10),
    })),
    periodConsults: (periodConsultsRes.data || []).map((c: any) => ({
      date: c.scheduled_at.slice(0, 10),
      type: c.type || 'retorno',
      status: c.status || 'scheduled',
      patient_id: c.patient_id,
    })),
    prevConsults: (prevConsultsRes.data || []).map((c: any) => ({
      date: c.scheduled_at.slice(0, 10),
      type: c.type || 'retorno',
      patient_id: c.patient_id,
    })),
    allConsults: (allConsultsRes.data || []).map((c: any) => ({
      date: c.scheduled_at.slice(0, 10),
      type: c.type || 'retorno',
      status: c.status,
      patient_id: c.patient_id,
    })),
    allVaccines: (vaccinesRes.data || []) as { patient_id: string; name: string; dose: string; status: string }[],
  };
}

// ── Dashboard Stats ───────────────────────────────────────────────────────────
export async function fetchDashboardStats(): Promise<{
  totalConsultations: number;
  thisMonthPatients: number;
  overdueAppointments: { patient_id: string; patient_name: string; scheduled_at: string }[];
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { totalConsultations: 0, thisMonthPatients: 0, overdueAppointments: [] };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [consResult, patResult, apptResult] = await Promise.all([
    supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('doctor_id', user.id).eq('status', 'completed'),
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('doctor_id', user.id).gte('created_at', monthStart),
    supabase.from('consultations')
      .select('patient_id, scheduled_at, patients(full_name)')
      .eq('doctor_id', user.id)
      .eq('status', 'scheduled')
      .lt('scheduled_at', now.toISOString()),
  ]);

  return {
    totalConsultations: consResult.count || 0,
    thisMonthPatients: patResult.count || 0,
    overdueAppointments: (apptResult.data || []).map((r: any) => ({
      patient_id: r.patient_id,
      patient_name: r.patients?.full_name || 'Paciente',
      scheduled_at: r.scheduled_at,
    })),
  };
}

// ── Patient Vaccine Summary ────────────────────────────────────────────────────
export async function fetchPatientsOverdueVaccines(patients: { id: string; birth_date: string; full_name: string }[]): Promise<{ id: string; full_name: string; overdueCount: number }[]> {
  const results: { id: string; full_name: string; overdueCount: number }[] = [];
  await Promise.all(patients.map(async p => {
    const bd = new Date(p.birth_date);
    const now = new Date();
    const ageMonths = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
    const { data } = await supabase.from('patient_vaccines').select('name, dose, status').eq('patient_id', p.id);
    const done = data || [];
    const overdue = PNI_SCHEDULE_NAMES.filter(pni =>
      pni.age_months < ageMonths &&
      !done.find((v: any) => v.name === pni.name && v.dose === pni.dose && v.status === 'done')
    ).length;
    if (overdue > 0) results.push({ id: p.id, full_name: p.full_name, overdueCount: overdue });
  }));
  return results;
}

// PNI names needed for vaccine check (kept minimal to avoid circular dep)
const PNI_SCHEDULE_NAMES = [
  { name: 'BCG', dose: '1ª dose', age_months: 0 },
  { name: 'Hepatite B', dose: '1ª dose', age_months: 0 },
  { name: 'Penta (DTP+Hib+HepB)', dose: '1ª dose', age_months: 2 },
  { name: 'VIP (Poliomielite)', dose: '1ª dose', age_months: 2 },
  { name: 'Pneumocócica 10V', dose: '1ª dose', age_months: 2 },
  { name: 'Rotavírus', dose: '1ª dose', age_months: 2 },
  { name: 'Meningocócica C', dose: '1ª dose', age_months: 3 },
  { name: 'Penta (DTP+Hib+HepB)', dose: '2ª dose', age_months: 4 },
  { name: 'VIP (Poliomielite)', dose: '2ª dose', age_months: 4 },
  { name: 'Pneumocócica 10V', dose: '2ª dose', age_months: 4 },
  { name: 'Rotavírus', dose: '2ª dose', age_months: 4 },
  { name: 'Meningocócica C', dose: '2ª dose', age_months: 5 },
  { name: 'Penta (DTP+Hib+HepB)', dose: '3ª dose', age_months: 6 },
  { name: 'VIP (Poliomielite)', dose: '3ª dose', age_months: 6 },
  { name: 'Pneumocócica 10V', dose: '3ª dose', age_months: 6 },
  { name: 'Hepatite B', dose: '2ª dose', age_months: 6 },
  { name: 'Influenza', dose: 'Anual', age_months: 6 },
];

// ── Anamnese Primeira Consulta ────────────────────────────────────────────────
export async function saveAnamnesePrimeiraConsulta(
  consultaId: string,
  patientId: string,
  data: AnamnesePrimeiraConsultaData,
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { data: saved, error } = await supabase
    .from('anamnese_primeira_consulta')
    .insert({ consulta_id: consultaId, patient_id: patientId, doctor_id: user.id, ...data })
    .select('id')
    .single();
  if (error) throw error;
  return saved.id as string;
}

export async function fetchAnamnesePrimeiraConsulta(
  consultaId: string,
): Promise<AnamnesePrimeiraConsultaData | null> {
  const { data, error } = await supabase
    .from('anamnese_primeira_consulta')
    .select('*')
    .eq('consulta_id', consultaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as AnamnesePrimeiraConsultaData;
}

// Busca a anamnese de primeira consulta pelo patient_id (mais recente se houver mais de uma)
export async function fetchAnamnesePrimeiraConsultaByPatient(
  patientId: string,
): Promise<(AnamnesePrimeiraConsultaData & { consulta_id: string; created_at: string }) | null> {
  const { data, error } = await supabase
    .from('anamnese_primeira_consulta')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as AnamnesePrimeiraConsultaData & { consulta_id: string; created_at: string };
}

// ── Growth Records ────────────────────────────────────────────────────────────
export async function fetchGrowthRecords(patientId: string) {
  const { data, error } = await supabase
    .from('growth_records')
    .select('month_age, weight_kg, height_cm, head_circumference_cm, created_at')
    .eq('patient_id', patientId)
    .order('month_age', { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    month: r.month_age as number,
    weight: r.weight_kg ? parseFloat(r.weight_kg) : undefined,
    height: r.height_cm ? parseFloat(r.height_cm) : undefined,
    hc: r.head_circumference_cm ? parseFloat(r.head_circumference_cm) : undefined,
    date: r.created_at?.slice(0, 10) || '',
  }));
}

// ── Profile ───────────────────────────────────────────────────────────────────
export interface ProfileData {
  full_name: string; crm: string; specialty: string; phone: string;
  clinic_name: string; clinic_phone: string; clinic_email: string;
  clinic_address: string; clinic_hours_start: string; clinic_hours_end: string;
  prontuario_format?: 'narrativo' | 'escaneavel';
}

export async function fetchProfile(): Promise<ProfileData | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles')
    .select('full_name, crm, specialty, phone, clinic_name, clinic_phone, clinic_email, clinic_address, clinic_hours_start, clinic_hours_end, prontuario_format')
    .eq('id', user.id).single();
  return data || null;
}

export async function updateProfile(fields: Partial<ProfileData>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { error } = await supabase.from('profiles').upsert({ id: user.id, ...fields }, { onConflict: 'id' });
  if (error) throw error;
}

// ── Vaccines ──────────────────────────────────────────────────────────────────
export async function fetchVaccines(patientId: string) {
  const { data, error } = await supabase
    .from('patient_vaccines')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function updateVaccineStatus(vaccineId: string, status: 'done' | 'pending', appliedAt?: string): Promise<void> {
  const { error } = await supabase
    .from('patient_vaccines')
    .update({ status, applied_at: appliedAt || null })
    .eq('id', vaccineId);
  if (error) throw error;
}

export async function createVaccine(input: {
  patient_id: string; name: string; dose: string;
  status: 'done' | 'pending' | 'overdue'; age_label: string; applied_at?: string;
}): Promise<void> {
  const { error } = await supabase.from('patient_vaccines').insert(input);
  if (error) throw error;
}

// ── Mappers ───────────────────────────────────────────────────────────────────
function mapPatient(p: any): Patient {
  return {
    id: p.id,
    full_name: p.full_name,
    birth_date: p.birth_date,
    gender: p.gender,
    blood_type: p.blood_type,
    delivery_type: p.delivery_type || '',
    gestational_age_weeks: p.gestational_age_weeks || 0,
    birth_weight_g: p.birth_weight_g || 0,
    notes: p.notes || '',
    insurance_plan: p.insurance_plan || '',
    insurance_card_number: p.insurance_card_number || '',
    is_active: p.is_active ?? true,
    next_return: p.next_return,
    consultation_count: 0,
    guardians: (p.patient_guardians || []).map((g: any) => ({
      name: g.name,
      relationship: g.relationship || 'Responsável',
      phone: g.phone || '',
      email: g.email,
      is_primary: g.is_primary,
    })),
  };
}

function mapConsultation(c: any): Consultation {
  return {
    id: c.id,
    patient_id: c.patient_id,
    scheduled_at: c.scheduled_at,
    status: c.status,
    type: c.type || 'retorno',
    duration_minutes: c.duration_minutes || 0,
    chief_complaint: c.chief_complaint || '',
    diagnosis: c.diagnosis || '',
    plan: c.plan || '',
    prescription: c.prescription || '',
    anamnesis: c.anamnesis || '',
    physical_exam: c.physical_exam || '',
    summary: {
      queixa_principal: c.sum_queixa_principal || '',
      hda: c.sum_hda || '',
      exame_fisico: c.sum_exame_fisico || '',
      hipoteses: c.sum_hipoteses || [],
      conduta: c.sum_conduta || '',
      retorno: c.sum_retorno || '',
      peso: c.sum_peso || '',
      altura: c.sum_altura || '',
      perimetro_cefalico: c.sum_perimetro_cefalico || '',
      vacinas_mencionadas: c.sum_vacinas_mencionadas || [],
    },
  };
}

// Busca TODAS as vacinas de todos os pacientes do médico em uma única query
// Retorna mapa: patient_id → lista de registros
export async function fetchAllVaccinesForDoctor(): Promise<Record<string, any[]>> {
  const { data, error } = await supabase
    .from('patient_vaccines')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const grouped: Record<string, any[]> = {};
  (data || []).forEach((v: any) => {
    if (!grouped[v.patient_id]) grouped[v.patient_id] = [];
    grouped[v.patient_id].push(v);
  });
  return grouped;
}

// ── Equipe e Acessos ──────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  userId: string;
  doctorId: string;
  role: 'medico' | 'secretaria';
  fullName: string;
  email: string;
  active: boolean;
  createdAt: string;
}

/** Busca todos os perfis associados ao doctor_id do médico logado */
export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, user_id, doctor_id, role, full_name, email, active, created_at')
    .eq('doctor_id', user.id)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map((r: any) => ({
    id:        r.id,
    userId:    r.user_id,
    doctorId:  r.doctor_id,
    role:      r.role,
    fullName:  r.full_name,
    email:     r.email,
    active:    r.active,
    createdAt: r.created_at,
  }));
}

/** Desativa o acesso de um membro (active = false) */
export async function deactivateMember(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ active: false })
    .eq('user_id', userId);
  if (error) throw error;
}

/** Reativa o acesso de um membro (active = true) */
export async function reactivateMember(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ active: true })
    .eq('user_id', userId);
  if (error) throw error;
}

/** Convida secretária via Edge Function invite-secretary */
export async function inviteSecretary(email: string, fullName: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const res = await fetch(`${supabaseUrl}/functions/v1/invite-secretary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email, fullName }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Erro ao enviar convite');
}

// ── Alertas administrativos ───────────────────────────────────────────────────

export interface AdminAlert {
  patientId: string;
  patientName: string;
  lastConsultDate: string | null;
  daysSince: number;
  type: 'overdue_return' | 'inactive';
}

/**
 * Retorna pacientes sem consulta nos últimos `days` dias.
 * Apenas nome e data — sem dados clínicos.
 */
export async function fetchAdminAlerts(days = 60): Promise<AdminAlert[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();
  const today = new Date();

  // Busca todos os pacientes ativos
  const { data: patients, error: pErr } = await supabase
    .from('patients')
    .select('id, full_name')
    .eq('doctor_id', user.id)
    .eq('is_active', true);

  if (pErr || !patients?.length) return [];

  // Busca a consulta mais recente de cada paciente
  const { data: consultations, error: cErr } = await supabase
    .from('consultations')
    .select('patient_id, created_at')
    .eq('doctor_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (cErr) return [];

  // Mapeia última consulta por paciente
  const lastConsult: Record<string, string> = {};
  (consultations || []).forEach((c: any) => {
    if (!lastConsult[c.patient_id]) lastConsult[c.patient_id] = c.created_at;
  });

  const alerts: AdminAlert[] = [];
  patients.forEach((p: any) => {
    const last = lastConsult[p.id] ?? null;
    const lastDate = last ? new Date(last) : null;
    const daysSince = lastDate
      ? Math.floor((today.getTime() - lastDate.getTime()) / 86_400_000)
      : 9999;

    if (!lastDate || lastDate < cutoff) {
      alerts.push({
        patientId:      p.id,
        patientName:    p.full_name,
        lastConsultDate: last,
        daysSince,
        type: daysSince > 90 ? 'inactive' : 'overdue_return',
      });
    }
  });

  // Ordena por mais urgente primeiro
  return alerts.sort((a, b) => b.daysSince - a.daysSince).slice(0, 20);
}

// ── Development Milestones ────────────────────────────────────────────────────

export interface MilestoneRecord {
  milestone_key: string;
  status: 'presente' | 'ausente' | 'nao_verificado';
  checked_at: string | null;
  notes: string | null;
}

export async function fetchDevelopmentMilestones(
  patientId: string
): Promise<Record<string, MilestoneRecord>> {
  const { data, error } = await supabase
    .from('development_milestones')
    .select('milestone_key, status, checked_at, notes')
    .eq('patient_id', patientId);
  if (error) throw error;
  const map: Record<string, MilestoneRecord> = {};
  (data || []).forEach((r: any) => { map[r.milestone_key] = r; });
  return map;
}

export async function upsertMilestone(params: {
  patientId: string;
  doctorId: string;
  milestoneKey: string;
  status: 'presente' | 'ausente' | 'nao_verificado';
  consultationId?: string | null;
}): Promise<void> {
  const { patientId, doctorId, milestoneKey, status, consultationId } = params;
  const { error } = await supabase
    .from('development_milestones')
    .upsert(
      {
        patient_id:      patientId,
        doctor_id:       doctorId,
        milestone_key:   milestoneKey,
        status,
        checked_at:      status !== 'nao_verificado' ? new Date().toISOString() : null,
        consultation_id: consultationId ?? null,
      },
      { onConflict: 'patient_id,milestone_key' }
    );
  if (error) throw error;
}
