-- Migration: vincular exames à consulta que os pediu/discutiu + status "paciente chegou"
-- Motivo: feedback de uso (Dr. Marcos Rust) — médico quer ver, na consulta de uma data,
-- os exames pedidos naquele dia e os resultados vinculados, em vez de uma aba "Exames"
-- solta. Também quer distinguir "paciente confirmou presença / está na sala de espera"
-- de "consulta de fato em andamento" na agenda.

-- ── 1. clinical_documents → consulta de origem ──────────────────────────────────
ALTER TABLE public.clinical_documents
  ADD COLUMN IF NOT EXISTS consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_documents_consultation
  ON public.clinical_documents(consultation_id);

-- ── 2. consultations → lista estruturada de exames pedidos ─────────────────────
-- Substitui o texto livre em specialty_data.exams_requested como fonte de verdade
-- daqui pra frente; o campo antigo permanece intacto para não quebrar dados já salvos.
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS requested_exams text[];

-- ── 3. appointments → novo status "confirmed" (paciente chegou / sala de espera) ─
-- Hoje 'in_progress' é usado tanto para "confirmar presença" quanto para "consulta
-- de fato em atendimento". Separa os dois: 'confirmed' = chegou e está esperando;
-- 'in_progress' passa a significar exclusivamente "sendo atendido agora".
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'));
