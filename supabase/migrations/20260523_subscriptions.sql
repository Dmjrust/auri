-- Migration: infraestrutura de billing (Stripe)
-- Ref: landing page menciona planos "Essencial / Pro" mas sem cobrança implementada.
--
-- Esta migration cria a tabela `subscriptions` que o webhook Stripe irá popular.
-- Nenhuma funcionalidade de cobrança é ativada ainda — é a fundação necessária
-- para a integração Stripe Checkout + webhook nas próximas sprints.

-- ── subscriptions ─────────────────────────────────────────────────────────────
-- Uma linha por médico. Criada pelo webhook Stripe após checkout bem-sucedido.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identificadores Stripe
  stripe_customer_id  text        UNIQUE,
  stripe_sub_id       text        UNIQUE,

  -- Estado atual da assinatura
  status              text        NOT NULL DEFAULT 'trialing'
                                  CHECK (status IN (
                                    'trialing',    -- período de teste
                                    'active',      -- ativo
                                    'past_due',    -- pagamento atrasado
                                    'canceled',    -- cancelado
                                    'incomplete',  -- checkout incompleto
                                    'unpaid'       -- inadimplente
                                  )),

  -- Plano
  plan                text        NOT NULL DEFAULT 'essencial'
                                  CHECK (plan IN ('essencial', 'pro')),

  -- Datas (preenchidas pelo webhook)
  trial_ends_at       timestamptz,
  current_period_start timestamptz,
  current_period_end  timestamptz,
  canceled_at         timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Médico lê e gerencia apenas a própria assinatura
CREATE POLICY "doctor own subscription"
  ON public.subscriptions
  FOR ALL
  USING (doctor_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_subscriptions_doctor ON public.subscriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.subscriptions IS
  'Assinaturas Stripe por médico. Preenchida e mantida pelo webhook /api/webhooks/stripe.';

-- ── Próximos passos (não implementados nesta migration) ───────────────────────
-- 1. Criar produto + preços no dashboard Stripe (ou via Stripe CLI)
-- 2. Implementar /api/webhooks/stripe (Supabase Edge Function ou Vercel API Route)
--    → Eventos: checkout.session.completed, customer.subscription.updated,
--               customer.subscription.deleted, invoice.payment_failed
-- 3. Criar endpoint de checkout: POST /api/billing/create-checkout-session
-- 4. Adicionar gating de features no frontend com base em profiles.subscription_status
--    (ou fazer join com esta tabela via RPC)
