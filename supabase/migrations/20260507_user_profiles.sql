-- ══════════════════════════════════════════════════════════════════
-- AURI — Infraestrutura de perfis de acesso (médico + secretaria)
-- Projeto: wxvrevuqyuxyugftcffs
-- Data: 2026-05-07
-- ══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- 1. TABELA user_profiles
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id   uuid        NOT NULL REFERENCES auth.users(id),
  -- doctor_id aponta para o médico "dono" da conta.
  -- Para role='medico': doctor_id = user_id (médico é dono de si mesmo)
  -- Para role='secretaria': doctor_id = uuid do médico ao qual ela pertence
  role        text        NOT NULL CHECK (role IN ('medico', 'secretaria')),
  full_name   text        NOT NULL,
  email       text        NOT NULL,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_profiles IS
  'Perfis de acesso: médico (dono) ou secretaria (associada a um médico).';
COMMENT ON COLUMN public.user_profiles.doctor_id IS
  'UUID do médico responsável. Para role=medico, igual ao user_id.';


-- ─────────────────────────────────────────────────────────────────
-- 2. HABILITAR RLS
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────
-- 3. POLICIES RLS
-- ─────────────────────────────────────────────────────────────────

-- 3a. Todo usuário lê seu próprio perfil
CREATE POLICY "user_profiles: leitura própria"
  ON public.user_profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- 3b. Médico lê todos os perfis associados ao seu doctor_id
--     (inclui secretarias vinculadas a ele)
CREATE POLICY "user_profiles: medico lê perfis do seu consultório"
  ON public.user_profiles
  FOR SELECT
  USING (
    doctor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'medico'
    )
  );

-- 3c. Médico insere novos perfis (apenas para o seu próprio doctor_id)
CREATE POLICY "user_profiles: medico insere"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (
    doctor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'medico'
    )
  );

-- 3d. Médico atualiza perfis do seu consultório
--     RESTRIÇÃO: role e doctor_id são imutáveis via policy
CREATE POLICY "user_profiles: medico atualiza (sem role/doctor_id)"
  ON public.user_profiles
  FOR UPDATE
  USING (
    doctor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'medico'
    )
  )
  WITH CHECK (
    role      = (SELECT role      FROM public.user_profiles WHERE id = user_profiles.id)
    AND doctor_id = (SELECT doctor_id FROM public.user_profiles WHERE id = user_profiles.id)
  );

-- 3e. Secretaria atualiza apenas seu próprio perfil
--     (ex: nome, email) — jamais role ou doctor_id
CREATE POLICY "user_profiles: secretaria atualiza próprio perfil"
  ON public.user_profiles
  FOR UPDATE
  USING (user_id = auth.uid() AND role = 'secretaria')
  WITH CHECK (
    role      = (SELECT role      FROM public.user_profiles WHERE id = user_profiles.id)
    AND doctor_id = (SELECT doctor_id FROM public.user_profiles WHERE id = user_profiles.id)
  );

-- 3f. Nenhum usuário deleta perfis via API (apenas admin/service role)
-- (sem policy de DELETE = bloqueado por padrão com RLS ativo)


-- ─────────────────────────────────────────────────────────────────
-- 4. FUNÇÃO HELPER get_my_role()
-- ─────────────────────────────────────────────────────────────────
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
  'Retorna o role (medico|secretaria) do usuário autenticado atual. SECURITY DEFINER — não expõe a tabela inteira.';


-- ─────────────────────────────────────────────────────────────────
-- 5. INSERIR PERFIL DO MÉDICO EXISTENTE
--    Busca o médico pelo email cadastrado em auth.users
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.user_profiles (user_id, doctor_id, role, full_name, email)
SELECT
  au.id,           -- user_id
  au.id,           -- doctor_id = user_id (médico é dono de si mesmo)
  'medico',
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  au.email
FROM auth.users au
WHERE au.email = 'dmjrust@gmail.com'
ON CONFLICT (user_id) DO NOTHING;  -- idempotente: seguro rodar mais de uma vez
