-- ══════════════════════════════════════════════════════════════════
-- AURI — Separação de agendamentos e prontuários clínicos
-- Projeto: wxvrevuqyuxyugftcffs
-- Data: 2026-05-08
-- ══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- 1. CRIAR TABELA appointments
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id       uuid        NOT NULL REFERENCES auth.users(id),
  patient_id      uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  scheduled_at    timestamptz NOT NULL,
  status          text        NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  type            text        NOT NULL DEFAULT 'retorno'
                              CHECK (type IN ('retorno', 'primeira vez')),
  chief_complaint text        NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.appointments IS
  'Agendamentos da agenda do consultório. Separado de consultations (prontuários clínicos).';


-- ─────────────────────────────────────────────────────────────────
-- 2. HABILITAR RLS
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────
-- 3. POLÍTICAS RLS
-- ─────────────────────────────────────────────────────────────────

CREATE POLICY "appointments: médico lê os seus"
  ON public.appointments FOR SELECT
  USING (doctor_id = auth.uid());

CREATE POLICY "appointments: médico insere"
  ON public.appointments FOR INSERT
  WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "appointments: médico atualiza os seus"
  ON public.appointments FOR UPDATE
  USING (doctor_id = auth.uid());

-- DELETE bloqueado via RLS (cancelar = UPDATE status='cancelled')


-- ─────────────────────────────────────────────────────────────────
-- 4. MIGRAR DADOS: consultations → appointments
--    Discriminador: duration_minutes = 0 identifica agendamentos
--    criados por createAppointment (saveConsultation usa Math.max(1,...))
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.appointments (id, doctor_id, patient_id, scheduled_at, status, type, chief_complaint, created_at)
SELECT
  id,
  doctor_id,
  patient_id,
  scheduled_at,
  CASE
    WHEN status IN ('scheduled', 'in_progress', 'completed', 'cancelled') THEN status
    ELSE 'scheduled'
  END AS status,
  COALESCE(NULLIF(type, ''), 'retorno') AS type,
  COALESCE(chief_complaint, '')         AS chief_complaint,
  created_at
FROM public.consultations
WHERE duration_minutes = 0
  AND status IN ('scheduled', 'in_progress', 'completed', 'cancelled')
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────
-- 5. REMOVER AGENDAMENTOS DA TABELA consultations
--    Apenas rows sem dados clínicos (duration_minutes = 0)
--    status='draft' excluído por segurança (não deveria existir com 0 min)
-- ─────────────────────────────────────────────────────────────────
DELETE FROM public.consultations
WHERE duration_minutes = 0
  AND status IN ('scheduled', 'in_progress', 'completed', 'cancelled');
