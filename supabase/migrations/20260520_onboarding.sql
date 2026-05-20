-- Migration: especialidade no onboarding, não em Settings
-- Remove o DEFAULT 'Pediatria' de profiles.specialty para distinguir
-- "perfil não configurado" (NULL) de "escolheu Pediatria".
-- Médicos existentes já têm 'Pediatria' salvo — não são afetados.

ALTER TABLE public.profiles ALTER COLUMN specialty DROP DEFAULT;
