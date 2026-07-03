import { supabase } from './supabase';
import type { Patient, Consultation, StructuredSummary, AnamnesePrimeiraConsultaData, AnamneseAdultaData, ClinicalDocument, ClinicalDocumentType, LabMarker, ConsultaAdultoData } from '../data/mock';

// ── Raw Supabase row shapes (internal) ────────────────────────────────────────
// Represent the exact shape returned by Supabase before mapping.
// Not exported — consumers use the mapped output types below.

interface RawGuardianRow {
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
}

interface RawPatientRow {
  id: string;
  full_name: string;
  birth_date: string;
  gender: 'M' | 'F';
  blood_type: string | null;
  delivery_type: string | null;
  gestational_age_weeks: number | null;
  birth_weight_g: number | null;
  notes: string | null;
  insurance_plan: string | null;
  insurance_card_number: string | null;
  is_active: boolean;
  next_return: string | null;
  patient_guardians?: RawGuardianRow[];
}

interface RawConsultationRow {
  id: string;
  patient_id: string;
  scheduled_at: string;
  status: string;
  type: string;
  duration_minutes: number | null;
  chief_complaint: string | null;
  diagnosis: string | null;
  plan: string | null;
  prescription: string | null;
  anamnesis: string | null;
  physical_exam: string | null;
  sum_queixa_principal: string | null;
  sum_hda: string | null;
  sum_exame_fisico: string | null;
  sum_hipoteses: string[] | null;
  sum_conduta: string | null;
  sum_retorno: string | null;
  sum_peso: string | null;
  sum_altura: string | null;
  sum_perimetro_cefalico: string | null;
  sum_vacinas_mencionadas: string[] | null;
  specialty_data: Record<string, unknown> | null;
  requested_exams: string[] | null;
}

interface RawAppointmentRow {
  id: string;
  scheduled_at: string;
  status: string;
  type: string;
  chief_complaint: string | null;
  patient_id: string;
  patients: {
    full_name: string;
    birth_date: string;
    patient_guardians: Pick<RawGuardianRow, 'name' | 'phone' | 'is_primary'>[];
  } | null;
}

interface RawVaccineRow {
  patient_id: string;
  name: string;
  dose: string;
  status: string;
  applied_at: string | null;
  [key: string]: unknown;
}

interface RawGrowthRow {
  patient_id?: string;
  month_age?: number;
  weight_kg: number | string | null;
  height_cm: number | string | null;
  head_circumference_cm?: number | string | null;
  created_at: string | null;
}

interface RawDayBriefingConsultRow {
  id: string;
  patient_id: string;
  scheduled_at: string;
  type: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  plan: string | null;
  sum_retorno: string | null;
  sum_peso: string | null;
  sum_altura: string | null;
  status: string;
  specialty_data: ConsultaAdultoData | null;
}

interface RawRecentActivityRow {
  id: string;
  scheduled_at: string;
  type: string;
  patient_id: string;
  patients: { full_name: string } | null;
}

interface RawUserProfileRow {
  id: string;
  user_id: string;
  doctor_id: string;
  role: 'medico' | 'secretaria';
  full_name: string;
  email: string;
  active: boolean;
  created_at: string;
}

interface RawPatientSimple {
  id: string;
  full_name: string;
}

interface RawConsultationSimple {
  patient_id: string;
  created_at: string;
}

interface RawMilestoneRow {
  milestone_key: string;
  status: 'presente' | 'ausente' | 'nao_verificado';
  checked_at: string | null;
  notes: string | null;
}

interface RawPatientWithDates {
  id: string;
  birth_date: string;
  full_name: string;
  created_at: string;
}

interface RawConsultationWithType {
  scheduled_at: string;
  type: string;
  status: string;
  patient_id: string;
}

interface RawOverdueAppointmentRow {
  patient_id: string;
  scheduled_at: string;
  patients: { full_name: string } | null;
}

interface RawVaccineSimple {
  patient_id: string;
  name: string;
  dose: string;
  status: string;
}

interface RawConsultationSummaryRow {
  patient_id: string;
  scheduled_at: string;
}

// ── Exported output types (used by consumers of this module) ──────────────────

/** Shape returned by fetchAppointmentsForWeek — used in AgendaPage */
export interface AgendaAppointment {
  id: string;
  time: string;
  patient_id: string;
  patient_name: string;
  age: string;
  type: 'retorno' | 'primeira vez';
  status: 'completed' | 'confirmed' | 'in_progress' | 'scheduled';
  chief_complaint: string;
  guardian: string;
  date: string;
}

/** Shape returned by fetchTodayAppointments — used in Dashboard + SecretaryDashboard */
export interface TodayAppointment {
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

/** Shape returned by fetchRecentActivity */
export interface RecentActivityItem {
  id: string;
  patient_id: string;
  patient_name: string;
  date: string;
  type: 'retorno' | 'primeira vez';
}

/** Shape returned by fetchGrowthRecords */
export interface GrowthRecord {
  month: number;
  weight?: number;
  height?: number;
  hc?: number;
  date: string;
}

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

// Atualiza dados cadastrais do paciente + responsável primário (upsert).
export async function updatePatient(patientId: string, input: {
  full_name: string; birth_date: string; gender: 'M' | 'F';
  blood_type?: string;
  insurance_plan?: string; insurance_card_number?: string;
  guardian_name?: string; guardian_relationship?: string;
  guardian_phone?: string; guardian_email?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('patients')
    .update({
      full_name: input.full_name,
      birth_date: input.birth_date,
      gender: input.gender,
      blood_type: input.blood_type || null,
      insurance_plan: input.insurance_plan || null,
      insurance_card_number: input.insurance_card_number || null,
    })
    .eq('id', patientId);
  if (error) throw error;

  // Responsável/contato primário: atualiza se existe, cria se não.
  if (input.guardian_name || input.guardian_phone || input.guardian_email) {
    const { data: existing } = await supabase
      .from('patient_guardians')
      .select('id')
      .eq('patient_id', patientId)
      .eq('is_primary', true)
      .maybeSingle();

    const guardianRow = {
      name: input.guardian_name || '',
      relationship: input.guardian_relationship || null,
      phone: input.guardian_phone || null,
      email: input.guardian_email || null,
    };
    const { error: gErr } = existing
      ? await supabase.from('patient_guardians').update(guardianRow).eq('id', existing.id)
      : await supabase.from('patient_guardians').insert({ ...guardianRow, patient_id: patientId, is_primary: true });
    if (gErr) throw gErr;
  }
}

// Arquiva o paciente (soft delete): some das listas (fetchPatients filtra
// is_active), mas prontuário é preservado — retenção CFM/LGPD.
export async function archivePatient(patientId: string): Promise<void> {
  const { error } = await supabase
    .from('patients')
    .update({ is_active: false })
    .eq('id', patientId);
  if (error) throw error;
}

// Exclusão DEFINITIVA: remove o paciente e, via ON DELETE CASCADE, todo o
// histórico (consultas, exames, vacinas, responsáveis...). Irreversível —
// a UI exige confirmação forte (digitar o nome) antes de chamar.
export async function deletePatientPermanently(patientId: string): Promise<void> {
  const { error } = await supabase
    .from('patients')
    .delete()
    .eq('id', patientId);
  if (error) throw error;
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
    .select('*, specialty_data')
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
  aiTranscribed = false,
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
    specialty_data: summary.specialty_data ?? null,
    requested_exams: summary.requested_exams ?? null,
    ai_transcribed: aiTranscribed,
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
    specialty_data: summary.specialty_data ?? null,
    requested_exams: summary.requested_exams ?? null,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

// ─── CONSENTIMENTO LGPD ───────────────────────────────────────────────────────
// Versão do termo exibido no ConsentScreen. Incrementar sempre que o texto do
// termo mudar, para que o registro em consultation_consents reflita o que o
// responsável de fato leu (LGPD Art. 7º / Art. 50).
export const CONSENT_TERM_VERSION = '2026-07-02.v2';

export async function saveConsent(
  patientId: string,
  consultType: 'retorno' | 'primeira vez',
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { error } = await supabase.from('consultation_consents').insert({
    doctor_id: user.id,
    patient_id: patientId,
    term_version: CONSENT_TERM_VERSION,
    consult_type: consultType,
  });
  if (error) throw error;
}

// ── Confirm draft → completed (saves edited summary + growth records) ─────────
export async function confirmDraftConsultation(
  draftId: string,
  patientId: string,
  summary: StructuredSummary,
  durationSeconds: number,
  birthDate: string,
): Promise<void> {
  // FIX B3: filtro por status='draft' evita confirmar uma consulta já 'completed'
  // e impede duplicação de registros em growth_records
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
      specialty_data:           summary.specialty_data ?? null,
      requested_exams:          summary.requested_exams ?? null,
      ai_transcribed:           true, // drafts sempre vêm do fluxo de gravação + IA
    })
    .eq('id', draftId)
    .eq('status', 'draft'); // garante idempotência — sem efeito em consultas já confirmadas
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

// ── Update draft consultation (keeps status = 'draft', saves edited summary) ──
export async function updateDraftConsultation(
  draftId: string,
  summary: StructuredSummary,
): Promise<void> {
  const { error } = await supabase
    .from('consultations')
    .update({
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
      specialty_data:           summary.specialty_data ?? null,
      requested_exams:          summary.requested_exams ?? null,
    })
    .eq('id', draftId);
  if (error) throw error;
}

// Mesma regra de detectConsultType, mas client-side — para quando a lista de
// consultas do paciente já está carregada em memória (evita um round-trip).
export function deriveConsultType(consultations: Array<{ status: string }>): 'retorno' | 'primeira vez' {
  return consultations.some(c => c.status === 'completed') ? 'retorno' : 'primeira vez';
}

// ── Detect consultation type from patient history ─────────────────────────────
export async function detectConsultType(patientId: string): Promise<'retorno' | 'primeira vez'> {
  const { count } = await supabase
    .from('consultations')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('status', 'completed');
  return (count ?? 0) > 0 ? 'retorno' : 'primeira vez';
}

// ── Create Appointment ────────────────────────────────────────────────────────
export async function createAppointment(input: {
  patient_id: string;
  scheduled_at: string;
  chief_complaint?: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const type = await detectConsultType(input.patient_id);
  const { error } = await supabase.from('appointments').insert({
    patient_id:      input.patient_id,
    doctor_id:       user.id,
    scheduled_at:    input.scheduled_at,
    status:          'scheduled',
    type,
    chief_complaint: input.chief_complaint || '',
  });
  if (error) throw error;
}

// ── Appointments ──────────────────────────────────────────────────────────────
export async function fetchAppointmentsForWeek(from: string, to: string): Promise<AgendaAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, scheduled_at, status, type, chief_complaint, patient_id, patients(full_name, birth_date, patient_guardians(name, is_primary))')
    .gte('scheduled_at', from + 'T00:00:00')
    .lte('scheduled_at', to + 'T23:59:59')
    .order('scheduled_at', { ascending: true });
  if (error) throw error;

  return (data || []).map((c: RawAppointmentRow) => {
    const patient = c.patients;
    const guardians = patient?.patient_guardians || [];
    const primary = guardians.find((g) => g.is_primary) || guardians[0];
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
      status: (c.status || 'scheduled') as 'completed' | 'confirmed' | 'in_progress' | 'scheduled',
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
  status?: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
}): Promise<void> {
  const { error } = await supabase.from('appointments').update(input).eq('id', id);
  if (error) throw error;
}

export async function cancelAppointment(id: string): Promise<void> {
  const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw error;
}

// ── Today's appointments ──────────────────────────────────────────────────────
export async function fetchTodayAppointments(): Promise<TodayAppointment[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('appointments')
    .select('id, scheduled_at, status, type, patient_id, patients(full_name, birth_date, patient_guardians(name, phone, is_primary))')
    .gte('scheduled_at', today + 'T00:00:00')
    .lte('scheduled_at', today + 'T23:59:59')
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true });
  if (error) return [];
  return (data || []).map((c: RawAppointmentRow) => {
    const patient = c.patients;
    const guardians = patient?.patient_guardians || [];
    const primary = guardians.find((g) => g.is_primary) || guardians[0];
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
      status: (c.status || 'scheduled') as 'completed' | 'confirmed' | 'in_progress' | 'scheduled',
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
  // Clínica Geral — derivados da consulta mais recente (specialty_data)
  activeProblems?: string[];
  medicationsCount?: number;
  hasRecentExam?: boolean;
}

export async function fetchDayBriefing(patientIds: string[]): Promise<Record<string, DayBriefingItem>> {
  if (patientIds.length === 0) return {};

  const [consultsRes, vaccinesRes, growthRes] = await Promise.all([
    supabase
      .from('consultations')
      .select('id, patient_id, scheduled_at, type, chief_complaint, diagnosis, plan, sum_retorno, sum_peso, sum_altura, status, specialty_data')
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

  (consultsRes.data || []).forEach((c: RawDayBriefingConsultRow) => {
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
      item.activeProblems = (c.specialty_data?.active_problems ?? []).filter(p => p.status === 'ativo').map(p => p.name);
      item.medicationsCount = c.specialty_data?.current_medications?.length ?? 0;
      item.hasRecentExam = !!c.specialty_data?.exams_requested?.trim();
    }
  });

  const seenLastVacc = new Set<string>();
  (vaccinesRes.data || []).forEach((v: RawVaccineRow) => {
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
  (growthRes.data || []).forEach((r: RawGrowthRow) => {
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
export async function fetchRecentActivity(): Promise<RecentActivityItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('consultations')
    .select('id, scheduled_at, type, patient_id, patients(full_name)')
    .eq('doctor_id', user.id)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false })
    .limit(5);
  return (data || []).map((c: RawRecentActivityRow) => ({
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
  data.forEach((c: RawConsultationWithType) => {
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
  (data || []).forEach((c: RawConsultationSummaryRow) => {
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

  const patientIds = (patientsRes.data || []).map((p: RawPatientWithDates) => p.id);
  const vaccinesRes = patientIds.length > 0
    ? await supabase.from('patient_vaccines').select('patient_id, name, dose, status').in('patient_id', patientIds)
    : { data: [] };

  return {
    periodStart,
    patients: (patientsRes.data || []).map((p: RawPatientWithDates) => ({
      id: p.id,
      birth_date: p.birth_date,
      full_name: p.full_name,
      created_at: (p.created_at || '').slice(0, 10),
    })),
    periodConsults: (periodConsultsRes.data || []).map((c: RawConsultationWithType) => ({
      date: c.scheduled_at.slice(0, 10),
      type: c.type || 'retorno',
      status: c.status || 'scheduled',
      patient_id: c.patient_id,
    })),
    prevConsults: (prevConsultsRes.data || []).map((c: RawConsultationWithType) => ({
      date: c.scheduled_at.slice(0, 10),
      type: c.type || 'retorno',
      patient_id: c.patient_id,
    })),
    allConsults: (allConsultsRes.data || []).map((c: RawConsultationWithType) => ({
      date: c.scheduled_at.slice(0, 10),
      type: c.type || 'retorno',
      status: c.status,
      patient_id: c.patient_id,
    })),
    allVaccines: (vaccinesRes.data || []) as RawVaccineSimple[],
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
    supabase.from('appointments')
      .select('patient_id, scheduled_at, patients(full_name)')
      .eq('doctor_id', user.id)
      .eq('status', 'scheduled')
      .lt('scheduled_at', now.toISOString()),
  ]);

  return {
    totalConsultations: consResult.count || 0,
    thisMonthPatients: patResult.count || 0,
    overdueAppointments: (apptResult.data || []).map((r: RawOverdueAppointmentRow) => ({
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
      !done.find((v: RawVaccineSimple) => v.name === pni.name && v.dose === pni.dose && v.status === 'done')
    ).length;
    if (overdue > 0) results.push({ id: p.id, full_name: p.full_name, overdueCount: overdue });
  }));
  return results;
}

// PNI completo (sincronizado com VaccinesTab.tsx — SBP/MS 2024)
// Cobre do nascimento até 11 anos. Nomes devem corresponder exatamente
// ao que é gravado em patient_vaccines via createVaccine().
const PNI_SCHEDULE_NAMES = [
  // Nascimento
  { name: 'BCG',                    dose: '1ª dose',    age_months: 0   },
  { name: 'Hepatite B',             dose: '1ª dose',    age_months: 0   },
  // 2 meses
  { name: 'Penta (DTP+Hib+HepB)',   dose: '1ª dose',    age_months: 2   },
  { name: 'VIP (Polio inativada)',   dose: '1ª dose',    age_months: 2   },
  { name: 'Rotavírus Humano',        dose: '1ª dose',    age_months: 2   },
  { name: 'Pneumocócica 10V',        dose: '1ª dose',    age_months: 2   },
  // 3 meses
  { name: 'Meningocócica C',         dose: '1ª dose',    age_months: 3   },
  // 4 meses
  { name: 'Penta (DTP+Hib+HepB)',    dose: '2ª dose',    age_months: 4   },
  { name: 'VIP (Polio inativada)',    dose: '2ª dose',    age_months: 4   },
  { name: 'Rotavírus Humano',         dose: '2ª dose',    age_months: 4   },
  { name: 'Pneumocócica 10V',         dose: '2ª dose',    age_months: 4   },
  // 5 meses
  { name: 'Meningocócica C',          dose: '2ª dose',    age_months: 5   },
  // 6 meses
  { name: 'Penta (DTP+Hib+HepB)',     dose: '3ª dose',    age_months: 6   },
  { name: 'VIP (Polio inativada)',     dose: '3ª dose',    age_months: 6   },
  // 12 meses
  { name: 'Meningocócica ACWY',        dose: '1ª dose',    age_months: 12  },
  { name: 'Febre Amarela',             dose: '1ª dose',    age_months: 12  },
  { name: 'Tríplice Viral (SCR)',       dose: '1ª dose',    age_months: 12  },
  { name: 'Varicela',                  dose: '1ª dose',    age_months: 12  },
  { name: 'Pneumocócica 10V',          dose: 'Reforço',    age_months: 12  },
  { name: 'Meningocócica C',           dose: 'Reforço',    age_months: 12  },
  { name: 'Hepatite A',                dose: '1ª dose',    age_months: 12  },
  // 15 meses
  { name: 'DTP',                       dose: '1º Reforço', age_months: 15  },
  { name: 'VOP (Polio oral)',           dose: '1º Reforço', age_months: 15  },
  { name: 'Tríplice Viral (SCR)',       dose: '2ª dose',    age_months: 15  },
  // 4 anos
  { name: 'DTP',                       dose: '2º Reforço', age_months: 48  },
  { name: 'VOP (Polio oral)',           dose: '2º Reforço', age_months: 48  },
  { name: 'Varicela',                  dose: '2ª dose',    age_months: 48  },
  // 9 anos
  { name: 'HPV',                       dose: '1ª dose',    age_months: 108 },
  { name: 'HPV',                       dose: '2ª dose',    age_months: 114 },
  // 10 anos
  { name: 'Meningocócica ACWY',        dose: 'Reforço',    age_months: 120 },
  // 11 anos
  { name: 'dT (Difteria + Tétano)',    dose: 'Reforço',    age_months: 132 },
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
export async function fetchGrowthRecords(patientId: string): Promise<GrowthRecord[]> {
  const { data, error } = await supabase
    .from('growth_records')
    .select('month_age, weight_kg, height_cm, head_circumference_cm, created_at')
    .eq('patient_id', patientId)
    .order('month_age', { ascending: true });
  if (error) throw error;
  return (data || []).map((r: RawGrowthRow) => ({
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
  work_mode?: 'solo' | 'team';
}

export async function fetchProfile(): Promise<ProfileData | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles')
    .select('full_name, crm, specialty, phone, clinic_name, clinic_phone, clinic_email, clinic_address, clinic_hours_start, clinic_hours_end, prontuario_format, work_mode')
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
function mapPatient(p: RawPatientRow): Patient {
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
    guardians: (p.patient_guardians || []).map((g: RawGuardianRow) => ({
      name: g.name,
      relationship: g.relationship || 'Responsável',
      phone: g.phone || '',
      email: g.email,
      is_primary: g.is_primary,
    })),
  };
}

function mapConsultation(c: RawConsultationRow): Consultation {
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
      specialty_data: c.specialty_data ?? null,
      requested_exams: c.requested_exams ?? null,
    },
    requested_exams: c.requested_exams ?? null,
  };
}

// Busca TODAS as vacinas de todos os pacientes do médico em uma única query
// Retorna mapa: patient_id → lista de registros
// Segurança (defesa em profundidade):
//   1. Auth check explícito — retorna vazio se não autenticado
//   2. Busca explícita dos patient_ids do médico antes de filtrar vacinas
//   3. RLS em patient_vaccines também filtra via patients.doctor_id (dupla proteção)
export async function fetchAllVaccinesForDoctor(): Promise<Record<string, RawVaccineRow[]>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  // FIX B1: buscar explicitamente os IDs dos pacientes do médico (não depende só de RLS)
  const { data: patientsData } = await supabase
    .from('patients')
    .select('id')
    .eq('doctor_id', user.id)
    .eq('is_active', true);
  const patientIds = (patientsData || []).map((p: { id: string }) => p.id);
  if (patientIds.length === 0) return {};

  const { data, error } = await supabase
    .from('patient_vaccines')
    .select('*')
    .in('patient_id', patientIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const grouped: Record<string, RawVaccineRow[]> = {};
  (data || []).forEach((v: RawVaccineRow) => {
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
  if (!user) return []; // degradação segura — não lança erro para não quebrar TeamSection

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, user_id, doctor_id, role, full_name, email, active, created_at')
    .eq('doctor_id', user.id)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map((r: RawUserProfileRow) => ({
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
  (consultations || []).forEach((c: RawConsultationSimple) => {
    if (!lastConsult[c.patient_id]) lastConsult[c.patient_id] = c.created_at;
  });

  const alerts: AdminAlert[] = [];
  patients.forEach((p: RawPatientSimple) => {
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
  (data || []).forEach((r: RawMilestoneRow) => { map[r.milestone_key] = r; });
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

// ── Trichology Treatments ─────────────────────────────────────────────────────

export interface TrichologyTreatment {
  id: string;
  patient_id: string;
  doctor_id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  indication: string | null;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'paused' | 'completed' | 'discontinued';
  adherence_status: 'boa' | 'parcial' | 'baixa' | 'interrompida' | null;
  adherence_notes: string | null;
  created_at: string;
}

export async function fetchTrichologyTreatments(patientId: string): Promise<TrichologyTreatment[]> {
  const { data, error } = await supabase
    .from('trichology_treatments')
    .select('*')
    .eq('patient_id', patientId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return (data || []) as TrichologyTreatment[];
}

export async function createTrichologyTreatment(input: {
  patient_id: string;
  name: string;
  dose?: string;
  frequency?: string;
  indication?: string;
  start_date: string;
  end_date?: string | null;
  status?: 'active' | 'paused' | 'completed' | 'discontinued';
  adherence_status?: 'boa' | 'parcial' | 'baixa' | 'interrompida' | null;
  adherence_notes?: string;
}): Promise<TrichologyTreatment> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { data, error } = await supabase
    .from('trichology_treatments')
    .insert({
      patient_id:       input.patient_id,
      doctor_id:        user.id,
      name:             input.name,
      dose:             input.dose || null,
      frequency:        input.frequency || null,
      indication:       input.indication || null,
      start_date:       input.start_date,
      end_date:         input.end_date || null,
      status:           input.status || 'active',
      adherence_status: input.adherence_status || null,
      adherence_notes:  input.adherence_notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TrichologyTreatment;
}

export async function updateTrichologyTreatment(
  id: string,
  fields: Partial<Pick<TrichologyTreatment, 'dose' | 'frequency' | 'indication' | 'end_date' | 'status' | 'adherence_status' | 'adherence_notes'>>,
): Promise<void> {
  const { error } = await supabase
    .from('trichology_treatments')
    .update(fields)
    .eq('id', id);
  if (error) throw error;
}

// ── Admin: gestão de assinantes + métricas de custo ─────────────────────────

/** Custo médio estimado por consulta transcrita via IA (Whisper ~2min + GPT-4o ~1.5k tokens) */
const AI_COST_PER_CONSULT_BRL = 0.80; // ≈ USD 0,15 × 5,3 (câmbio estimado)

export interface AdminDoctorRow {
  id: string;
  full_name: string;
  crm: string;
  clinic_name: string | null;
  specialty: string | null;
  email: string;
  subscription: {
    status: string | null;           // 'trialing' | 'active' | 'past_due' | 'canceled' | null
    plan: string | null;             // 'essencial' | 'pro' | null
    trial_ends_at: string | null;
    current_period_end: string | null;
    stripe_customer_id: string | null;
  };
  patient_count: number;
  consults_total: number;            // total de consultas realizadas (all-time)
  consults_this_month: number;       // consultas no mês corrente
  consults_ai_this_month: number;    // consultas com IA transcrição este mês (custo OpenAI)
  estimated_ai_cost_brl: number;     // R$ estimado de custo OpenAI este mês
  last_consultation_at: string | null;
}

export interface AdminStats {
  total_doctors: number;
  active: number;
  trialing: number;
  past_due: number;
  canceled: number;
  no_subscription: number;
  total_patients: number;
  total_consults_this_month: number;
  total_ai_consults_this_month: number;
  estimated_total_ai_cost_brl: number;
  mrr_brl: number;
  mrr_essencial: number;
  mrr_pro: number;
}

/** Lista todos os médicos com status de assinatura + métricas de uso — apenas admin */
export async function fetchAllDoctorsAdmin(
  opts?: { from: string; to: string },
): Promise<AdminDoctorRow[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const now = new Date();
  const from = opts?.from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to   = opts?.to   ?? now.toISOString();

  const [
    { data: medicos, error: mErr },
    { data: profiles },
    { data: subs },
  ] = await Promise.all([
    // user_profiles é a fonte da verdade de "é médico": criada via trigger no signup,
    // mesmo que o registro em profiles ainda não exista (onboarding incompleto).
    supabase.from('user_profiles').select('user_id, full_name, email').eq('role', 'medico'),
    supabase.from('profiles').select('id, full_name, crm, clinic_name, specialty'),
    supabase.from('subscriptions').select('doctor_id, status, plan, trial_ends_at, current_period_end, stripe_customer_id'),
  ]);
  if (mErr) throw mErr;

  const subMap = Object.fromEntries((subs ?? []).map((s: Record<string, string>) => [s.doctor_id, s]));
  const profileMap = Object.fromEntries((profiles ?? []).map((p: Record<string, string | null>) => [p.id as string, p]));

  const rows = await Promise.all((medicos ?? []).map(async (m: Record<string, string>) => {
    const p = profileMap[m.user_id] ?? {};
    const [
      { count: patient_count },
      { count: consults_total },
      { count: consults_this_month },
      { count: consults_ai_this_month },
      { data: lastConsult },
    ] = await Promise.all([
      supabase.from('patients').select('*', { count: 'exact', head: true }).eq('doctor_id', m.user_id),
      supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('doctor_id', m.user_id).eq('status', 'completed'),
      supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('doctor_id', m.user_id).eq('status', 'completed').gte('created_at', from).lte('created_at', to),
      supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('doctor_id', m.user_id).eq('status', 'completed').eq('ai_transcribed', true).gte('created_at', from).lte('created_at', to),
      supabase.from('consultations').select('created_at').eq('doctor_id', m.user_id).eq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const ai = consults_ai_this_month ?? 0;
    return {
      id: m.user_id,
      full_name: p.full_name || m.full_name || '',
      crm: p.crm ?? '',
      clinic_name: p.clinic_name ?? null,
      specialty: p.specialty ?? null,
      email: m.email ?? '',
      subscription: subMap[m.user_id] ?? { status: null, plan: null, trial_ends_at: null, current_period_end: null, stripe_customer_id: null },
      patient_count: patient_count ?? 0,
      consults_total: consults_total ?? 0,
      consults_this_month: consults_this_month ?? 0,
      consults_ai_this_month: ai,
      estimated_ai_cost_brl: parseFloat((ai * AI_COST_PER_CONSULT_BRL).toFixed(2)),
      last_consultation_at: (lastConsult as Record<string, string> | null)?.created_at ?? null,
    };
  }));

  return rows;
}

/** Estatísticas globais do SaaS — apenas admin */
export async function fetchAdminStats(
  opts?: { from: string; to: string },
): Promise<AdminStats> {
  const now = new Date();
  const from = opts?.from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to   = opts?.to   ?? now.toISOString();

  const [
    { data: subs },
    { count: total_patients },
    { count: total_doctors },
    { count: total_consults_this_month },
    { count: total_ai_consults_this_month },
  ] = await Promise.all([
    supabase.from('subscriptions').select('status, plan'),
    supabase.from('patients').select('*', { count: 'exact', head: true }),
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'medico'),
    supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('created_at', from).lte('created_at', to),
    supabase.from('consultations').select('*', { count: 'exact', head: true }).eq('status', 'completed').eq('ai_transcribed', true).gte('created_at', from).lte('created_at', to),
  ]);

  const s = (subs ?? []) as Array<{ status: string; plan: string }>;
  const active          = s.filter(x => x.status === 'active').length;
  const trialing        = s.filter(x => x.status === 'trialing').length;
  const past_due        = s.filter(x => x.status === 'past_due').length;
  const canceled        = s.filter(x => x.status === 'canceled').length;
  const mrr_essencial   = s.filter(x => x.status === 'active' && x.plan === 'essencial').length * 89;
  const mrr_pro         = s.filter(x => x.status === 'active' && x.plan === 'pro').length * 149;
  const ai_total        = total_ai_consults_this_month ?? 0;

  return {
    total_doctors: total_doctors ?? 0,
    active, trialing, past_due, canceled,
    no_subscription: (total_doctors ?? 0) - s.length,
    total_patients: total_patients ?? 0,
    total_consults_this_month: total_consults_this_month ?? 0,
    total_ai_consults_this_month: ai_total,
    estimated_total_ai_cost_brl: parseFloat((ai_total * AI_COST_PER_CONSULT_BRL).toFixed(2)),
    mrr_brl: mrr_essencial + mrr_pro,
    mrr_essencial,
    mrr_pro,
  };
}

/** Atualiza plano/status de assinatura — apenas admin */
export async function adminUpdateSubscription(
  doctorId: string,
  updates: { plan?: string; status?: string; trial_ends_at?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('doctor_id', doctorId);
  if (error) throw error;
}

/** Suspende conta (status → 'canceled') — apenas admin */
export async function adminSuspendDoctor(doctorId: string): Promise<void> {
  await adminUpdateSubscription(doctorId, { status: 'canceled' });
}

/** Estende trial por N dias a partir da data atual ou da data de trial vigente — apenas admin */
export async function adminExtendTrial(doctorId: string, days: number): Promise<void> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('trial_ends_at')
    .eq('doctor_id', doctorId)
    .maybeSingle();

  const base = (sub as { trial_ends_at?: string } | null)?.trial_ends_at
    ? new Date((sub as { trial_ends_at: string }).trial_ends_at)
    : new Date();
  base.setDate(base.getDate() + days);
  await adminUpdateSubscription(doctorId, { trial_ends_at: base.toISOString(), status: 'trialing' });
}

// ── Admin: analytics de série temporal ───────────────────────────────────────

/** Ponto de dado mensal para gráficos de evolução do SaaS */
export interface AdminChartPoint {
  /** Label do eixo X, ex: "Jan/26" */
  month: string;
  /** Chave para ordenação, ex: "2026-01" */
  monthKey: string;
  /** Total de consultas completadas neste mês */
  consults_total: number;
  /** Consultas com transcrição IA neste mês (custo driver) */
  consults_ai: number;
  /** Custo IA estimado em R$ (consults_ai × R$0,80) */
  ai_cost_brl: number;
  /** Novos médicos cadastrados neste mês */
  new_doctors: number;
}

/**
 * Retorna série temporal mensal dos últimos N meses — apenas admin.
 * Agrega em TypeScript após queries brutas (volume admin é baixo).
 */
export async function fetchAdminChartData(months = 6): Promise<AdminChartPoint[]> {
  // 1. Gera os N buckets mensais (mais antigo → mais recente)
  const now = new Date();
  const buckets: AdminChartPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    // "jan. de 26" → "Jan/26"
    const month = monthLabel
      .replace(' de ', '/')
      .replace('.', '')
      .replace(/^(\w)/, (c) => c.toUpperCase());
    buckets.push({ month, monthKey, consults_total: 0, consults_ai: 0, ai_cost_brl: 0, new_doctors: 0 });
  }

  const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1).toISOString();

  // 2. Consultas completadas desde o cutoff
  const { data: consults } = await supabase
    .from('consultations')
    .select('created_at, ai_transcribed')
    .eq('status', 'completed')
    .gte('created_at', cutoff);

  for (const c of (consults ?? []) as Array<{ created_at: string; ai_transcribed: boolean }>) {
    const d = new Date(c.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.find(b => b.monthKey === key);
    if (!bucket) continue;
    bucket.consults_total += 1;
    if (c.ai_transcribed) {
      bucket.consults_ai += 1;
    }
  }

  // 3. Novos médicos (user_profiles role='medico') desde o cutoff
  const { data: doctors } = await supabase
    .from('user_profiles')
    .select('created_at')
    .eq('role', 'medico')
    .gte('created_at', cutoff);

  for (const d of (doctors ?? []) as Array<{ created_at: string }>) {
    const dt = new Date(d.created_at);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.find(b => b.monthKey === key);
    if (bucket) bucket.new_doctors += 1;
  }

  // 4. Calcula custo IA
  for (const b of buckets) {
    b.ai_cost_brl = parseFloat((b.consults_ai * AI_COST_PER_CONSULT_BRL).toFixed(2));
  }

  return buckets;
}

// ─── CLÍNICA GERAL — ANAMNESE ADULTA ─────────────────────────────────────────

export async function saveAnamneseAdulta(consultaId: string, data: AnamneseAdultaData): Promise<void> {
  // Lê specialty_data atual para não sobrescrever outros campos
  const { data: row } = await supabase
    .from('consultations')
    .select('specialty_data')
    .eq('id', consultaId)
    .single();

  const existing = (row?.specialty_data as ConsultaAdultoData | null) ?? {};
  await supabase
    .from('consultations')
    .update({ specialty_data: { ...existing, adult_intake: data } })
    .eq('id', consultaId);
}

export async function fetchAnamneseAdulta(
  patientId: string
): Promise<(AnamneseAdultaData & { consulta_id: string; created_at: string }) | null> {
  const { data } = await supabase
    .from('consultations')
    .select('id, created_at, specialty_data')
    .eq('patient_id', patientId)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false })
    .limit(10);

  if (!data) return null;
  for (const row of data as Array<{ id: string; created_at: string; specialty_data: ConsultaAdultoData | null }>) {
    const intake = row.specialty_data?.adult_intake;
    if (intake) return { ...intake, consulta_id: row.id, created_at: row.created_at };
  }
  return null;
}

export async function updatePatientProblems(
  consultaId: string,
  problems: ConsultaAdultoData['active_problems']
): Promise<void> {
  const { data: row } = await supabase
    .from('consultations')
    .select('specialty_data')
    .eq('id', consultaId)
    .single();

  const existing = (row?.specialty_data as ConsultaAdultoData | null) ?? {};
  await supabase
    .from('consultations')
    .update({ specialty_data: { ...existing, active_problems: problems } })
    .eq('id', consultaId);
}

export async function updatePatientMedications(
  consultaId: string,
  medications: ConsultaAdultoData['current_medications']
): Promise<void> {
  const { data: row } = await supabase
    .from('consultations')
    .select('specialty_data')
    .eq('id', consultaId)
    .single();

  const existing = (row?.specialty_data as ConsultaAdultoData | null) ?? {};
  await supabase
    .from('consultations')
    .update({ specialty_data: { ...existing, current_medications: medications } })
    .eq('id', consultaId);
}

export async function updatePatientAllergies(
  consultaId: string,
  allergies: ConsultaAdultoData['allergies']
): Promise<void> {
  const { data: row } = await supabase
    .from('consultations')
    .select('specialty_data')
    .eq('id', consultaId)
    .single();

  const existing = (row?.specialty_data as ConsultaAdultoData | null) ?? {};
  await supabase
    .from('consultations')
    .update({ specialty_data: { ...existing, allergies } })
    .eq('id', consultaId);
}

// Generaliza saveAnamneseAdulta/updatePatientProblems/updatePatientMedications:
// merge parcial de qualquer subconjunto de campos de ConsultaAdultoData sobre o
// specialty_data existente, num único read-modify-write. Usado pelo fluxo de
// gravação (primeira consulta e retorno) para persistir vitals/medicações/
// problemas/resumo/campos de retorno de uma vez, sem múltiplas chamadas.
export async function saveConsultaAdultoExtras(
  consultaId: string,
  data: Partial<ConsultaAdultoData>
): Promise<void> {
  const { data: row } = await supabase
    .from('consultations')
    .select('specialty_data')
    .eq('id', consultaId)
    .single();

  const existing = (row?.specialty_data as ConsultaAdultoData | null) ?? {};
  const { error } = await supabase
    .from('consultations')
    .update({ specialty_data: { ...existing, ...data } })
    .eq('id', consultaId);
  if (error) throw error;
}

// Estado clínico atual do paciente (problemas ativos, medicações, alergias),
// derivado da consulta completa mais recente — usado para dar contexto de
// "antes desta consulta" à extração de IA do retorno.
export async function fetchCurrentAdultState(patientId: string): Promise<{
  active_problems: ConsultaAdultoData['active_problems'];
  current_medications: ConsultaAdultoData['current_medications'];
  allergies: ConsultaAdultoData['allergies'];
}> {
  const { data } = await supabase
    .from('consultations')
    .select('specialty_data')
    .eq('patient_id', patientId)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false })
    .limit(1);

  const row = (data?.[0] as { specialty_data: ConsultaAdultoData | null } | undefined);
  const sd = row?.specialty_data ?? {};
  return {
    active_problems: sd.active_problems ?? [],
    current_medications: sd.current_medications ?? [],
    allergies: sd.allergies ?? [],
  };
}

export interface MarkerComparison {
  marker_name: string;
  previous: LabMarker;
  current: LabMarker;
  deltaPct: number | null;
  trend: 'melhora' | 'piora' | 'estavel';
}

// Compara os dois valores mais recentes de um marcador de exame já registrados
// no histórico do paciente. Puramente computado a partir de dados reais salvos
// (fetchLabMarkerHistory) — nunca pedido à IA, que não deve "lembrar" números
// de uma transcrição de áudio.
export async function getMarkerComparison(patientId: string, markerName: string): Promise<MarkerComparison | null> {
  const history = await fetchLabMarkerHistory(patientId, markerName);
  if (history.length < 2) return null;
  const previous = history[history.length - 2];
  const current = history[history.length - 1];
  const deltaPct = previous.value !== 0 ? ((current.value - previous.value) / Math.abs(previous.value)) * 100 : null;

  let trend: MarkerComparison['trend'] = 'estavel';
  if (deltaPct !== null && Math.abs(deltaPct) >= 5) {
    // Para a maioria dos marcadores, "menor melhor" não é universal — usamos o
    // status (normal/alto/baixo/critico) já calculado na extração do exame para
    // decidir a direção da melhora, não apenas o sinal da variação.
    const wasAltered = previous.status !== 'normal';
    const isAltered = current.status !== 'normal';
    if (wasAltered && !isAltered) trend = 'melhora';
    else if (!wasAltered && isAltered) trend = 'piora';
    else if (wasAltered && isAltered) {
      trend = Math.abs(current.value - (current.reference_min ?? current.value)) <
               Math.abs(previous.value - (previous.reference_min ?? previous.value))
        ? 'melhora' : 'piora';
    }
  }

  return { marker_name: markerName, previous, current, deltaPct, trend };
}

// Compara todos os marcadores do paciente que têm pelo menos 2 resultados
// registrados — usado na revisão de retorno e na aba Evolução.
export async function getMarkerComparisons(patientId: string): Promise<MarkerComparison[]> {
  const latest = await fetchLatestMarkers(patientId);
  const names = Object.keys(latest);
  const comparisons = await Promise.all(names.map(name => getMarkerComparison(patientId, name)));
  return comparisons.filter((c): c is MarkerComparison => c !== null);
}

// ─── CLÍNICA GERAL — DOCUMENTOS CLÍNICOS ─────────────────────────────────────

export async function fetchClinicalDocuments(patientId: string): Promise<ClinicalDocument[]> {
  const { data, error } = await supabase
    .from('clinical_documents')
    .select('*')
    .eq('patient_id', patientId)
    .order('result_date', { ascending: false });

  if (error || !data) return [];
  return data as ClinicalDocument[];
}

export async function fetchLabMarkerHistory(patientId: string, markerName: string): Promise<LabMarker[]> {
  const { data, error } = await supabase
    .from('lab_markers')
    .select('*')
    .eq('patient_id', patientId)
    .eq('marker_name', markerName)
    .order('result_date', { ascending: true });

  if (error || !data) return [];
  return data as LabMarker[];
}

export async function fetchMarkersForDocuments(documentIds: string[]): Promise<Record<string, LabMarker[]>> {
  if (documentIds.length === 0) return {};
  const { data, error } = await supabase
    .from('lab_markers')
    .select('*')
    .in('clinical_document_id', documentIds);
  if (error || !data) return {};
  const result: Record<string, LabMarker[]> = {};
  for (const row of data as LabMarker[]) {
    (result[row.clinical_document_id] ??= []).push(row);
  }
  return result;
}

export async function fetchLatestMarkers(patientId: string): Promise<Record<string, LabMarker>> {
  const { data, error } = await supabase
    .from('lab_markers')
    .select('*')
    .eq('patient_id', patientId)
    .order('result_date', { ascending: false });

  if (error || !data) return {};
  const result: Record<string, LabMarker> = {};
  for (const row of data as LabMarker[]) {
    if (!result[row.marker_name]) result[row.marker_name] = row;
  }
  return result;
}

export async function saveLabResult(
  patientId: string,
  docType: ClinicalDocumentType,
  resultDate: string,
  labName: string | null,
  sourceType: 'upload_pdf' | 'upload_image' | 'manual',
  fileUrl: string | null,
  rawText: string | null,
  aiSummary: string | null,
  markers: Omit<LabMarker, 'id' | 'clinical_document_id' | 'patient_id' | 'created_at'>[],
  consultationId: string | null = null
): Promise<ClinicalDocument | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: doc, error } = await supabase
    .from('clinical_documents')
    .insert({
      patient_id: patientId,
      doctor_id: user.id,
      consultation_id: consultationId,
      document_type: docType,
      result_date: resultDate,
      lab_name: labName,
      source_type: sourceType,
      file_url: fileUrl,
      raw_text: rawText,
      ai_summary: aiSummary,
    })
    .select()
    .single();

  if (error || !doc) return null;

  if (markers.length > 0) {
    await supabase.from('lab_markers').insert(
      markers.map(m => ({ ...m, clinical_document_id: doc.id, patient_id: patientId, doctor_id: user.id }))
    );
  }

  return doc as ClinicalDocument;
}

// Vincula um documento clínico já existente a uma consulta (ex.: usuário escolhe
// depois do upload, ou corrige o vínculo automático sugerido na UI).
export async function linkClinicalDocumentToConsultation(documentId: string, consultationId: string | null): Promise<void> {
  const { error } = await supabase
    .from('clinical_documents')
    .update({ consultation_id: consultationId })
    .eq('id', documentId);
  if (error) throw error;
}

// ── Exames pedidos na consulta anterior (para o médico checar no retorno) ─────
export interface LastRequestedExamsInfo {
  consultationId: string;
  date: string;
  requestedExams: string[];
  linkedDocuments: { id: string; lab_name: string | null; result_date: string }[];
}

export async function fetchLastRequestedExams(patientId: string): Promise<LastRequestedExamsInfo | null> {
  const { data, error } = await supabase
    .from('consultations')
    .select('id, scheduled_at, requested_exams')
    .eq('patient_id', patientId)
    .eq('status', 'completed')
    .not('requested_exams', 'is', null)
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || !data.requested_exams?.length) return null;

  const { data: docs } = await supabase
    .from('clinical_documents')
    .select('id, lab_name, result_date')
    .eq('consultation_id', data.id);

  return {
    consultationId: data.id,
    date: data.scheduled_at.slice(0, 10),
    requestedExams: data.requested_exams,
    linkedDocuments: docs || [],
  };
}

// Sobe o arquivo original (PDF/imagem) ao bucket privado "clinical-documents" e
// retorna uma signed URL de longa duração para popular clinical_documents.file_url.
// Pasta "<doctor_id>/<patient_id>/..." é exigida pela RLS policy do bucket.
export async function uploadClinicalDocumentFile(patientId: string, file: File): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const path = `${user.id}/${patientId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('clinical-documents')
    .upload(path, file, { contentType: file.type });
  if (uploadError) return null;

  const { data, error } = await supabase.storage
    .from('clinical-documents')
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10 anos
  if (error || !data) return null;

  return data.signedUrl;
}

// ─── CLÍNICA GERAL — DASHBOARD ────────────────────────────────────────────────

export interface ChronicDashboardData {
  patientsWithConditions: number;
  conditionDistribution: { name: string; count: number }[];
  patientsWithoutReturn: { id: string; full_name: string; conditions: string[] }[];
  pendingExams: { patient_id: string; full_name: string; exams: string }[];
  upcomingReturns: { id: string; full_name: string; conditions: string[]; next_return: string }[];
}

export async function fetchChronicDashboardData(): Promise<ChronicDashboardData> {
  const { data: consults } = await supabase
    .from('consultations')
    .select('patient_id, specialty_data, patients!inner(full_name, next_return)')
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false });

  if (!consults) return { patientsWithConditions: 0, conditionDistribution: [], patientsWithoutReturn: [], pendingExams: [], upcomingReturns: [] };

  // Deduplica: mantém só a consulta mais recente por paciente
  const seenPatients = new Set<string>();
  const latest: Array<{ patient_id: string; specialty_data: ConsultaAdultoData | null; full_name: string; next_return: string | null }> = [];
  for (const c of consults as Array<{ patient_id: string; specialty_data: ConsultaAdultoData | null; patients: { full_name: string; next_return: string | null } | null }>) {
    if (!seenPatients.has(c.patient_id)) {
      seenPatients.add(c.patient_id);
      latest.push({ patient_id: c.patient_id, specialty_data: c.specialty_data, full_name: c.patients?.full_name ?? '', next_return: c.patients?.next_return ?? null });
    }
  }

  const now = new Date();
  const conditionCount: Record<string, number> = {};
  const patientsWithConditions = new Set<string>();
  const patientsWithoutReturn: ChronicDashboardData['patientsWithoutReturn'] = [];
  const pendingExams: ChronicDashboardData['pendingExams'] = [];
  const upcomingReturns: ChronicDashboardData['upcomingReturns'] = [];

  for (const row of latest) {
    const problems = row.specialty_data?.active_problems?.filter(p => p.status === 'ativo') ?? [];
    if (problems.length > 0) {
      patientsWithConditions.add(row.patient_id);
      problems.forEach(p => { conditionCount[p.name] = (conditionCount[p.name] ?? 0) + 1; });
      const hasRetorno = row.next_return && new Date(row.next_return) >= now;
      if (!hasRetorno) {
        patientsWithoutReturn.push({ id: row.patient_id, full_name: row.full_name, conditions: problems.map(p => p.name) });
      } else if (row.next_return) {
        upcomingReturns.push({ id: row.patient_id, full_name: row.full_name, conditions: problems.map(p => p.name), next_return: row.next_return });
      }
    }
    const examsReq = row.specialty_data?.exams_requested?.trim();
    if (examsReq) {
      pendingExams.push({ patient_id: row.patient_id, full_name: row.full_name, exams: examsReq });
    }
  }

  const conditionDistribution = Object.entries(conditionCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  upcomingReturns.sort((a, b) => new Date(a.next_return).getTime() - new Date(b.next_return).getTime());

  return {
    patientsWithConditions: patientsWithConditions.size,
    conditionDistribution,
    patientsWithoutReturn: patientsWithoutReturn.slice(0, 20),
    pendingExams: pendingExams.slice(0, 20),
    upcomingReturns: upcomingReturns.slice(0, 20),
  };
}

// ─── CLÍNICA GERAL — EXAMES RECENTES (cross-paciente) ────────────────────────

export interface RecentClinicalDocument {
  id: string;
  patient_id: string;
  patient_name: string;
  document_type: ClinicalDocumentType;
  lab_name: string | null;
  created_at: string;
}

export async function fetchRecentClinicalDocuments(limit = 5): Promise<RecentClinicalDocument[]> {
  const { data, error } = await supabase
    .from('clinical_documents')
    .select('id, patient_id, document_type, lab_name, created_at, patients(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as Array<{ id: string; patient_id: string; document_type: ClinicalDocumentType; lab_name: string | null; created_at: string; patients: { full_name: string } | null }>).map(d => ({
    id: d.id,
    patient_id: d.patient_id,
    patient_name: d.patients?.full_name || 'Paciente',
    document_type: d.document_type,
    lab_name: d.lab_name,
    created_at: d.created_at,
  }));
}
