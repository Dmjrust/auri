-- Migration: auto-criar user_profiles ao signup
-- Quando um novo usuário se cadastra via Supabase Auth, esta função
-- insere automaticamente uma linha em user_profiles com role='medico'.
-- Isso resolve o erro "Perfil não configurado" para novos médicos.

CREATE OR REPLACE FUNCTION public.handle_new_user_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, doctor_id, role, full_name, email, active)
  VALUES (
    NEW.id,
    NEW.id,
    'medico',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profiles ON auth.users;
CREATE TRIGGER on_auth_user_created_profiles
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profiles();
