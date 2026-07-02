-- Migration: bucket privado para áudio temporário de consulta
-- O cliente sobe o áudio gravado, gera signed URL curta para o proxy
-- server-side (/api/transcribe) e deleta o arquivo após a transcrição (LGPD).
-- Pasta "<doctor_id>/..." exigida pelas policies, como em clinical-documents.

INSERT INTO storage.buckets (id, name, public)
VALUES ('consult-audio', 'consult-audio', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "consult-audio: upload na própria pasta"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'consult-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "consult-audio: lê própria pasta"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'consult-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "consult-audio: deleta própria pasta"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'consult-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
