-- Modo de trabalho do médico (solo vs com equipe), coletado no onboarding.
-- Usado para condicionar fluxo de convite de secretária e, futuramente,
-- segmentação de produto/planos.

ALTER TABLE public.profiles ADD COLUMN work_mode text CHECK (work_mode IN ('solo', 'team'));
