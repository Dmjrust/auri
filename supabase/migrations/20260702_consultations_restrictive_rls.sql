-- Migration: policy RESTRICTIVE em consultations
-- As policies existentes são PERMISSIVE (OR). Esta policy RESTRICTIVE (AND)
-- garante que, mesmo que uma futura policy permissiva seja criada por engano
-- (ex.: acesso de secretaria), o conteúdo clínico continua acessível apenas
-- ao médico dono do registro.

CREATE POLICY "consultations: somente médico dono (restritiva)"
  ON public.consultations
  AS RESTRICTIVE
  FOR ALL
  USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());
