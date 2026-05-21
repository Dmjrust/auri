-- Migration: acesso de secretaria a pacientes e agenda
-- Secretarias vinculadas a um médico via user_profiles podem:
--   • Ler a lista de pacientes do médico
--   • Ler, criar e atualizar agendamentos do médico
--   • Ler responsáveis dos pacientes (para contato ao agendar)
-- Consultas clínicas (consultations) permanecem restritas ao médico.

-- ── Patients: secretaria lê pacientes do seu médico ──────────────────────────
CREATE POLICY "patients: secretaria lê"
  ON public.patients
  FOR SELECT
  USING (
    doctor_id = (
      SELECT doctor_id FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'secretaria' AND active = true
      LIMIT 1
    )
  );

-- ── Appointments: secretaria gerencia agenda do seu médico ───────────────────
CREATE POLICY "appointments: secretaria lê"
  ON public.appointments
  FOR SELECT
  USING (
    doctor_id = (
      SELECT doctor_id FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'secretaria' AND active = true
      LIMIT 1
    )
  );

CREATE POLICY "appointments: secretaria insere"
  ON public.appointments
  FOR INSERT
  WITH CHECK (
    doctor_id = (
      SELECT doctor_id FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'secretaria' AND active = true
      LIMIT 1
    )
  );

CREATE POLICY "appointments: secretaria atualiza"
  ON public.appointments
  FOR UPDATE
  USING (
    doctor_id = (
      SELECT doctor_id FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'secretaria' AND active = true
      LIMIT 1
    )
  );

-- ── Patient guardians: secretaria lê (para contato ao agendar) ───────────────
CREATE POLICY "patient_guardians: secretaria lê"
  ON public.patient_guardians
  FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE doctor_id = (
        SELECT doctor_id FROM public.user_profiles
        WHERE user_id = auth.uid() AND role = 'secretaria' AND active = true
        LIMIT 1
      )
    )
  );

-- Tabelas que permanecem restritas ao médico (sem alteração):
--   consultations       — conteúdo clínico sensível
--   growth_records      — dados clínicos
--   patient_vaccines    — dados clínicos
--   trichology_treatments, patient_photos, lab_results — dados clínicos
