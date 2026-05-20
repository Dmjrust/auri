-- Fix: trigger handle_new_user criava profiles com specialty='Pediatria' (DEFAULT)
-- impedindo a detecção de onboarding pendente no app.
--
-- 1. Recriar função explicitamente sem specialty
-- 2. Garantir DROP DEFAULT (idempotente)
-- 3. Zerar specialty de contas sem CRM (receberam o DEFAULT sem completar onboarding)

-- ── 1. Atualizar trigger para não inserir specialty ───────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  -- specialty intencionalmente omitida: será preenchida no OnboardingPage
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Garantir que o DEFAULT foi removido ────────────────────────────────────
ALTER TABLE public.profiles ALTER COLUMN specialty DROP DEFAULT;

-- ── 3. Zerar specialty de contas que receberam o DEFAULT sem fazer onboarding ─
-- Critério: CRM vazio = nunca completou o cadastro profissional
-- Contas com CRM preenchido (médicos reais) NÃO são afetadas.
UPDATE public.profiles
SET specialty = NULL
WHERE (crm IS NULL OR crm = '')
  AND specialty = 'Pediatria';
