/**
 * billing.ts — Serviço de cobrança Stripe (skeleton)
 *
 * Status: SKELETON — funções retornam mock/placeholder até o webhook e
 * checkout serem implementados no backend.
 *
 * Para ativar:
 *   1. Executar migration 20260523_subscriptions.sql no Supabase SQL Editor
 *   2. Configurar STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET nas variáveis
 *      de ambiente server-side no Vercel (sem prefixo VITE_)
 *   3. Implementar a Edge Function ou Vercel API Route do webhook
 *   4. Descomentar as chamadas reais abaixo
 */

import { supabase } from './supabase';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid'
  | null;   // null = sem assinatura criada ainda

export type Plan = 'essencial' | 'pro';

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  plan: Plan | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

// ── Leitura ───────────────────────────────────────────────────────────────────

/**
 * Retorna a assinatura ativa do médico autenticado.
 * Retorna null se não houver assinatura (período de teste inicial, sem checkout).
 */
export async function fetchSubscription(): Promise<SubscriptionInfo | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, plan, trial_ends_at, current_period_end, stripe_customer_id')
    .eq('doctor_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    status: data.status as SubscriptionStatus,
    plan: data.plan as Plan,
    trialEndsAt: data.trial_ends_at ?? null,
    currentPeriodEnd: data.current_period_end ?? null,
    stripeCustomerId: data.stripe_customer_id ?? null,
  };
}

/**
 * Verifica se o médico tem acesso ativo ao produto.
 * Trialing e active = com acesso. Qualquer outro status = sem acesso.
 */
export async function hasActiveAccess(): Promise<boolean> {
  const sub = await fetchSubscription();
  if (!sub) return true; // sem assinatura = ainda no onboarding/trial implícito
  return sub.status === 'active' || sub.status === 'trialing';
}

// ── Checkout ──────────────────────────────────────────────────────────────────

/**
 * Redireciona o médico para o Stripe Checkout.
 *
 * TODO: implementar endpoint POST /api/billing/create-checkout-session
 *   → Recebe: { plan, doctorId, email, successUrl, cancelUrl }
 *   → Retorna: { url: 'https://checkout.stripe.com/...' }
 *   → Redirecionar o browser para url
 *
 * Por enquanto, abre a landing page de planos.
 */
export async function startCheckout(plan: Plan): Promise<void> {
  // TODO: substituir pelo endpoint real quando o backend estiver pronto
  console.warn('[billing] startCheckout não implementado. Plan:', plan);
  window.open('https://auri-git-main-dmjrust.vercel.app/#pricing', '_blank');
}

/**
 * Redireciona para o portal de gerenciamento Stripe (cancelar, trocar plano, etc.)
 *
 * TODO: implementar endpoint POST /api/billing/create-portal-session
 *   → Recebe: { stripeCustomerId, returnUrl }
 *   → Retorna: { url: 'https://billing.stripe.com/...' }
 */
export async function openBillingPortal(): Promise<void> {
  console.warn('[billing] openBillingPortal não implementado.');
}

// ── Constantes de Plano ───────────────────────────────────────────────────────

export const PLAN_FEATURES: Record<Plan, string[]> = {
  essencial: [
    'Prontuário SOAP completo',
    'Agenda + agendamentos',
    'Curvas de crescimento OMS',
    'Calendário vacinal PNI',
    'Até 50 pacientes ativos',
  ],
  pro: [
    'Tudo do Essencial',
    'AI Ambient Scribe (gravação + transcrição)',
    'Pacientes ilimitados',
    'Secretaria (usuário extra)',
    'Exportação PDF',
    'Suporte prioritário',
  ],
};

export const PLAN_PRICE: Record<Plan, string> = {
  essencial: 'R$ 89/mês',
  pro:       'R$ 149/mês',
};
