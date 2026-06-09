-- ── Área Admin: role 'admin' + RLS cross-tenant + rastreamento de custo IA ───
-- Migration: 20260609_admin_role.sql
-- Criação do superadmin não está aqui — feita diretamente no Supabase SQL Editor:
--   INSERT INTO public.user_profiles (user_id, doctor_id, role, full_name, email, active)
--   VALUES ((SELECT id FROM auth.users WHERE email = 'admin@auri.app'),
--           (SELECT id FROM auth.users WHERE email = 'admin@auri.app'),
--           'admin', 'Admin Auri', 'admin@auri.app', true);

-- 1. Adicionar 'admin' ao CHECK constraint de user_profiles.role
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('medico', 'secretaria', 'admin'));

-- 2. Atualizar função helper para incluir 'admin'
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. RLS: admin lê TODOS os profiles (cross-tenant)
CREATE POLICY "admin_read_all_profiles"
  ON public.profiles FOR SELECT
  USING (get_my_role() = 'admin');

-- 4. RLS: admin lê TODAS as subscriptions
CREATE POLICY "admin_read_all_subscriptions"
  ON public.subscriptions FOR SELECT
  USING (get_my_role() = 'admin');

-- 5. RLS: admin atualiza qualquer subscription (mudança manual de plano)
CREATE POLICY "admin_update_all_subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (get_my_role() = 'admin');

-- 6. RLS: admin lê TODOS os user_profiles
CREATE POLICY "admin_read_all_user_profiles"
  ON public.user_profiles FOR SELECT
  USING (get_my_role() = 'admin');

-- 7. RLS: admin lê TODAS as consultations (para métricas de uso e custo IA)
CREATE POLICY "admin_read_all_consultations"
  ON public.consultations FOR SELECT
  USING (get_my_role() = 'admin');

-- 8. RLS: admin lê TODOS os patients (para contagem por médico)
CREATE POLICY "admin_read_all_patients"
  ON public.patients FOR SELECT
  USING (get_my_role() = 'admin');

-- 9. Campo ai_transcribed em consultations — rastreia uso de IA por consulta
--    false = prontuário manual | true = transcrição via Whisper + GPT-4o (custo OpenAI)
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS ai_transcribed boolean NOT NULL DEFAULT false;

-- Índice para queries de métricas mensais por médico (evitar full scan)
CREATE INDEX IF NOT EXISTS idx_consultations_doctor_date
  ON public.consultations(doctor_id, created_at);

CREATE INDEX IF NOT EXISTS idx_consultations_ai_month
  ON public.consultations(doctor_id, ai_transcribed, created_at)
  WHERE ai_transcribed = true;
