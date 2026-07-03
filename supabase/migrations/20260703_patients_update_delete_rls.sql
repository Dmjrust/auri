-- Migration: CRUD completo de pacientes
-- 1) Policies UPDATE/DELETE em patients e patient_guardians (médico dono).
-- 2) Garante ON DELETE CASCADE nas FKs para patients que não o declararam,
--    para que "Excluir definitivamente" não falhe por integridade referencial.

-- ── Patients: médico dono edita e exclui ─────────────────────────────────────
CREATE POLICY "patients: médico atualiza os seus"
  ON public.patients FOR UPDATE
  USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "patients: médico exclui os seus"
  ON public.patients FOR DELETE
  USING (doctor_id = auth.uid());

-- ── Patient guardians: médico dono do paciente gerencia ─────────────────────
CREATE POLICY "patient_guardians: médico atualiza"
  ON public.patient_guardians FOR UPDATE
  USING (patient_id IN (SELECT id FROM public.patients WHERE doctor_id = auth.uid()))
  WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE doctor_id = auth.uid()));

CREATE POLICY "patient_guardians: médico exclui"
  ON public.patient_guardians FOR DELETE
  USING (patient_id IN (SELECT id FROM public.patients WHERE doctor_id = auth.uid()));

CREATE POLICY "patient_guardians: médico insere"
  ON public.patient_guardians FOR INSERT
  WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE doctor_id = auth.uid()));

-- ── ON DELETE CASCADE nas FKs para patients ──────────────────────────────────
-- Recria como CASCADE toda FK de qualquer tabela → patients(id) que ainda não
-- seja CASCADE. DO block defensivo: descobre os nomes reais das constraints.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.table_schema, tc.table_name, tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'patients' AND ccu.column_name = 'id'
      AND tc.table_schema = 'public'
      AND rc.delete_rule <> 'CASCADE'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.patients(id) ON DELETE CASCADE',
      r.table_schema, r.table_name, r.constraint_name, r.constraint_name, r.column_name
    );
    RAISE NOTICE 'FK % em %.% recriada com ON DELETE CASCADE', r.constraint_name, r.table_schema, r.table_name;
  END LOOP;
END $$;
