-- Migration: módulo Tricologia
-- Adiciona coluna specialty_data em consultations e cria 3 novas tabelas
-- para fotos, exames laboratoriais e tratamentos (módulos tricológicos).
-- Nenhuma coluna existente é removida — compatível com Pediatria.

-- ── 1. specialty_data em consultations ───────────────────────────────────────
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS specialty_data jsonb;
-- Armazena o objeto "trichology" extraído pela IA (scalp_condition, scores, etc.)
-- Permanece NULL para consultas pediátricas.

-- ── 2. patient_photos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_photos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  consultation_id uuid REFERENCES public.consultations(id),
  doctor_id       uuid NOT NULL REFERENCES auth.users(id),
  angle           text NOT NULL CHECK (angle IN ('frontal','temporal_d','temporal_e','vertice','lateral_d','lateral_e')),
  storage_path    text NOT NULL,   -- caminho interno no bucket privado (nunca URL pública)
  taken_at        date NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctor own photos"
  ON public.patient_photos FOR ALL
  USING (doctor_id = auth.uid());

-- ── 3. lab_results ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  consultation_id uuid REFERENCES public.consultations(id),
  doctor_id       uuid NOT NULL REFERENCES auth.users(id),
  exam_date       date NOT NULL,
  source_path     text,            -- caminho no bucket privado (PDF/imagem)
  raw_text        text,            -- texto extraído pelo modelo
  -- markers JSONB: { "ferritina": { "value": 12.4, "unit": "ng/mL", "ref": "9–120", "status": "baixo" }, ... }
  markers         jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctor own labs"
  ON public.lab_results FOR ALL
  USING (doctor_id = auth.uid());

-- ── 4. trichology_treatments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trichology_treatments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id        uuid NOT NULL REFERENCES auth.users(id),
  name             text NOT NULL,
  dose             text,
  frequency        text,
  indication       text,           -- "AGA", "eflúvio telógeno", "alopecia areata"
  start_date       date NOT NULL,
  end_date         date,           -- null = em andamento
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','paused','completed','discontinued')),
  adherence_status text
                   CHECK (adherence_status IN ('boa','parcial','baixa','interrompida')),
  adherence_notes  text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trichology_treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctor own treatments"
  ON public.trichology_treatments FOR ALL
  USING (doctor_id = auth.uid());
