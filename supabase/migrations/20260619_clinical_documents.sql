-- Migration: tabelas referenciadas no código mas ausentes no banco
-- Causa: src/lib/db.ts usa clinical_documents/lab_markers (fetchClinicalDocuments,
-- fetchLatestMarkers, saveLabResult) mas nenhuma migration existia → upload de
-- exames falhava silenciosamente (fetch engole erro, retorna []).
-- Mesmo padrão de bug já corrigido em 20260521_missing_tables.sql.
-- Ref: src/data/mock.ts ClinicalDocument / LabMarker | src/lib/db.ts linhas 1771-1848

-- ── 1. clinical_documents ──────────────────────────────────────────────────────
-- Documento clínico (exame de laboratório, imagem, laudo, relatório) anexado
-- ao paciente, com ou sem extração automática via IA.

CREATE TABLE IF NOT EXISTS public.clinical_documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id     uuid        NOT NULL REFERENCES auth.users(id),

  document_type text        NOT NULL DEFAULT 'laboratorio'
                            CHECK (document_type IN ('laboratorio', 'imagem', 'laudo', 'relatorio')),
  result_date   date        NOT NULL,
  lab_name      text,
  source_type   text        NOT NULL
                            CHECK (source_type IN ('upload_pdf', 'upload_image', 'manual')),
  file_url      text,
  raw_text      text,
  ai_summary    text,

  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinical_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor own clinical_documents"
  ON public.clinical_documents
  FOR ALL
  USING (doctor_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_clinical_documents_patient ON public.clinical_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_documents_result_date ON public.clinical_documents(result_date);

COMMENT ON TABLE public.clinical_documents IS
  'Documentos clínicos (exames, laudos, imagens) anexados ao paciente. Um registro por upload/entrada manual.';


-- ── 2. lab_markers ──────────────────────────────────────────────────────────────
-- Marcadores individuais extraídos (por IA ou manualmente) de um clinical_document.

CREATE TABLE IF NOT EXISTS public.lab_markers (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinical_document_id  uuid        NOT NULL REFERENCES public.clinical_documents(id) ON DELETE CASCADE,
  patient_id            uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id             uuid        NOT NULL REFERENCES auth.users(id),

  result_date           date        NOT NULL,
  marker_name           text        NOT NULL,
  value                 numeric     NOT NULL,
  unit                  text        NOT NULL DEFAULT '',
  reference_text        text,
  reference_min         numeric,
  reference_max         numeric,
  status                text        NOT NULL DEFAULT 'normal'
                                    CHECK (status IN ('normal', 'alto', 'baixo', 'critico')),

  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor own lab_markers"
  ON public.lab_markers
  FOR ALL
  USING (doctor_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_lab_markers_patient ON public.lab_markers(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_markers_document ON public.lab_markers(clinical_document_id);
CREATE INDEX IF NOT EXISTS idx_lab_markers_name ON public.lab_markers(patient_id, marker_name);

COMMENT ON TABLE public.lab_markers IS
  'Marcadores de exame (ex.: hemoglobina, glicose) extraídos de um clinical_document, um registro por marcador por exame.';


-- ── 3. Storage bucket — arquivos originais (PDF/imagem) ────────────────────────
-- Bucket privado; arquivos organizados em pastas "<doctor_id>/<patient_id>/...".
-- Acesso restrito ao próprio médico via policy baseada na primeira pasta do path.

INSERT INTO storage.buckets (id, name, public)
VALUES ('clinical-documents', 'clinical-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "doctor manage own clinical-documents files"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'clinical-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'clinical-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
