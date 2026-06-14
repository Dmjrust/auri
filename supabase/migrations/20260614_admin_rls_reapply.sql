-- ============================================================
-- Catch-up migration: cria public.subscriptions (não aplicado em prod)
-- e reaplica políticas RLS cross-tenant do admin (admin_read_all_*).
--
-- Motivo: o painel "Gestão de Assinantes" só exibia o próprio médico
-- logado (admin via self-read), porque:
--   1. As políticas admin_read_all_* de 20260609_admin_role.sql
--      referenciam public.subscriptions, que nunca foi criada
--      (20260523_subscriptions.sql não foi aplicada em produção).
--   2. Isso causou erro 42P01 ao tentar reaplicar as políticas.
--
-- Este script é 100% idempotente: usa IF NOT EXISTS / IF EXISTS /
-- CREATE OR REPLACE / DROP+CREATE em toda parte. Seguro executar
-- quantas vezes for necessário, independente do que já foi aplicado.
-- ============================================================

-- ── 1. Tabela subscriptions (de 20260523_subscriptions.sql) ─────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id    text        UNIQUE,
  stripe_sub_id         text        UNIQUE,
  status                text        NOT NULL DEFAULT 'trialing'
                                    CHECK (status IN (
                                      'trialing','active','past_due','canceled','incomplete','unpaid'
                                    )),
  plan                  text        NOT NULL DEFAULT 'essencial'
                                    CHECK (plan IN ('essencial', 'pro')),
  trial_ends_at         timestamptz,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  canceled_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.subscriptions IS
  'Assinaturas Stripe por médico. Preenchida e mantida pelo webhook /api/webhooks/stripe.';

-- ── 2. Policy: médico lê/gerencia sua própria subscription ──────────────────
DROP POLICY IF EXISTS "doctor own subscription" ON public.subscriptions;
CREATE POLICY "doctor own subscription"
  ON public.subscriptions
  FOR ALL
  USING (doctor_id = auth.uid());

-- ── 3. Índices de subscriptions ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_doctor ON public.subscriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

-- ── 4. Trigger updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. user_profiles.role aceita 'admin' (de 20260609_admin_role.sql) ──────
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('medico', 'secretaria', 'admin'));

-- ── 6. get_my_role() — search_path seguro + active=true ─────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE user_id = auth.uid()
    AND active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_role() IS
  'Retorna o role (medico|secretaria|admin) do usuário autenticado atual, apenas se active=true. SECURITY DEFINER — não expõe a tabela inteira.';

-- ── 7. Policies admin_read_all_* / admin_update_all_* (cross-tenant) ────────
DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.profiles;
CREATE POLICY "admin_read_all_profiles"
  ON public.profiles FOR SELECT
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "admin_read_all_subscriptions" ON public.subscriptions;
CREATE POLICY "admin_read_all_subscriptions"
  ON public.subscriptions FOR SELECT
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "admin_update_all_subscriptions" ON public.subscriptions;
CREATE POLICY "admin_update_all_subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "admin_read_all_user_profiles" ON public.user_profiles;
CREATE POLICY "admin_read_all_user_profiles"
  ON public.user_profiles FOR SELECT
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "admin_read_all_consultations" ON public.consultations;
CREATE POLICY "admin_read_all_consultations"
  ON public.consultations FOR SELECT
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "admin_read_all_patients" ON public.patients;
CREATE POLICY "admin_read_all_patients"
  ON public.patients FOR SELECT
  USING (get_my_role() = 'admin');

-- ── 8. consultations.ai_transcribed (de 20260609_admin_role.sql) ───────────
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS ai_transcribed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_consultations_doctor_date
  ON public.consultations(doctor_id, created_at);

CREATE INDEX IF NOT EXISTS idx_consultations_ai_month
  ON public.consultations(doctor_id, ai_transcribed, created_at)
  WHERE ai_transcribed = true;
