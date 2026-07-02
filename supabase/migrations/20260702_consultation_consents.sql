-- Migration: registro de consentimento LGPD para gravação de consulta
-- LGPD Art. 7º/Art. 50: consentimento para tratamento de dado sensível
-- (voz) deve ser registrado — quem, quando e sob qual versão do termo.

CREATE TABLE public.consultation_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES auth.users(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL,
  term_version text NOT NULL,
  consult_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_consents_patient ON public.consultation_consents (patient_id, created_at DESC);

ALTER TABLE public.consultation_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consents: médico insere"
  ON public.consultation_consents FOR INSERT
  WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "consents: médico lê"
  ON public.consultation_consents FOR SELECT
  USING (doctor_id = auth.uid());
