-- Migration: tabelas referenciadas no código mas ausentes no banco
-- Causa: db.ts usa estas tabelas mas nenhuma migration existia → crash em produção.
-- Ambas com RLS habilitado e policy doctor_id = auth.uid().

-- ── 1. anamnese_primeira_consulta ─────────────────────────────────────────────
-- Armazena a anamnese completa da primeira consulta pediátrica.
-- Ref: src/lib/db.ts linhas 725–768 | src/data/mock.ts AnamnesePrimeiraConsultaData

CREATE TABLE IF NOT EXISTS public.anamnese_primeira_consulta (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id uuid        REFERENCES public.consultations(id) ON DELETE CASCADE,
  patient_id  uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id   uuid        NOT NULL REFERENCES auth.users(id),

  -- 1. História atual
  motivo_consulta               text NOT NULL DEFAULT '',
  queixa_principal_duracao      text NOT NULL DEFAULT '',
  sintomas_associados           text NOT NULL DEFAULT '',

  -- 2. História pregressa
  internacoes                   boolean,
  internacoes_desc              text NOT NULL DEFAULT '',
  cirurgias                     boolean,
  cirurgias_desc                text NOT NULL DEFAULT '',
  alergias_medicamentos         text NOT NULL DEFAULT '',
  alergias_alimentos            text NOT NULL DEFAULT '',
  alergias_outras               text NOT NULL DEFAULT '',
  historico_vacinal             text NOT NULL DEFAULT '',

  -- 3. História gestacional
  gestacoes_gpa                 text NOT NULL DEFAULT '',
  idade_gestacional_semanas     text NOT NULL DEFAULT '',
  intercorrencias_gestacao      boolean,
  intercorrencias_gestacao_desc text NOT NULL DEFAULT '',
  tipo_parto                    text NOT NULL DEFAULT '',
  local_parto                   text NOT NULL DEFAULT '',
  apgar_1                       text NOT NULL DEFAULT '',
  apgar_5                       text NOT NULL DEFAULT '',

  -- 4. Triagens neonatais
  teste_pezinho                 text NOT NULL DEFAULT '',
  teste_orelhinha               text NOT NULL DEFAULT '',
  teste_olhinho                 text NOT NULL DEFAULT '',
  teste_coracaozinho            text NOT NULL DEFAULT '',

  -- 5. História familiar
  doencas_familia               text NOT NULL DEFAULT '',
  alergia_familia               boolean,
  alergia_familia_desc          text NOT NULL DEFAULT '',
  outras_condicoes_familia      text NOT NULL DEFAULT '',

  -- 6. História socioeconômica
  profissao_responsaveis        text NOT NULL DEFAULT '',
  renda_familiar                text NOT NULL DEFAULT '',
  tabagismo_passivo             boolean,
  animal_domestico              boolean,
  animal_domestico_qual         text NOT NULL DEFAULT '',
  agua_saneamento               boolean,

  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.anamnese_primeira_consulta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor own anamnese"
  ON public.anamnese_primeira_consulta
  FOR ALL
  USING (doctor_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_anamnese_patient ON public.anamnese_primeira_consulta(patient_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_consulta ON public.anamnese_primeira_consulta(consulta_id);

COMMENT ON TABLE public.anamnese_primeira_consulta IS
  'Anamnese completa da primeira consulta pediátrica. Vinculada a consulta e paciente.';


-- ── 2. development_milestones ─────────────────────────────────────────────────
-- Marcos do desenvolvimento neuropsicomotor por paciente.
-- Ref: src/lib/db.ts linhas 1065–1100 | MilestoneRecord

CREATE TABLE IF NOT EXISTS public.development_milestones (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id       uuid        NOT NULL REFERENCES auth.users(id),
  milestone_key   text        NOT NULL,
  status          text        NOT NULL DEFAULT 'nao_verificado'
                              CHECK (status IN ('presente', 'ausente', 'nao_verificado')),
  checked_at      timestamptz,
  consultation_id uuid        REFERENCES public.consultations(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (patient_id, milestone_key)  -- upsert por (patient_id, milestone_key)
);

ALTER TABLE public.development_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor own milestones"
  ON public.development_milestones
  FOR ALL
  USING (doctor_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_milestones_patient ON public.development_milestones(patient_id);

COMMENT ON TABLE public.development_milestones IS
  'Marcos do desenvolvimento neuropsicomotor. Um registro por (patient_id, milestone_key).';
