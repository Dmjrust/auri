import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Verificar autenticação do chamador ──────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Não autenticado' }, 401);
    }

    // Cliente com anon key para verificar o JWT do chamador
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Token inválido' }, 401);
    }

    // ── 2. Verificar que o chamador tem role = 'medico' ────────────────────
    const { data: callerProfile, error: profileError } = await supabaseAnon
      .from('user_profiles')
      .select('role, doctor_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== 'medico') {
      return json({ error: 'Apenas médicos podem convidar secretárias' }, 403);
    }

    const doctorId = callerProfile.doctor_id;

    // ── 3. Ler payload ─────────────────────────────────────────────────────
    const { email, fullName } = await req.json();

    if (!email || !fullName) {
      return json({ error: 'email e fullName são obrigatórios' }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'E-mail inválido' }, 400);
    }

    // ── 4. Cliente admin com service_role key ──────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── 5. Verificar se já existe usuário com esse email em user_profiles ──
    const { data: existing } = await supabaseAdmin
      .from('user_profiles')
      .select('id, active')
      .eq('email', email)
      .eq('doctor_id', doctorId)
      .maybeSingle();

    if (existing) {
      return json({ error: 'Este e-mail já está cadastrado na equipe' }, 409);
    }

    // ── 6. Convidar usuário via Supabase Auth ──────────────────────────────
    const redirectTo = `${Deno.env.get('SITE_URL') ?? 'https://auri-git-main-dmjrust.vercel.app'}/`;

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
        data: { full_name: fullName },
      }
    );

    if (inviteError) {
      // Usuário já existe no auth mas não tem perfil — prosseguir com criação do perfil
      if (!inviteError.message.includes('already been registered')) {
        return json({ error: inviteError.message }, 500);
      }
    }

    // ── 7. Inserir em user_profiles ────────────────────────────────────────
    const invitedUserId = inviteData?.user?.id;

    if (invitedUserId) {
      const { error: insertError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id:    invitedUserId,
          doctor_id:  doctorId,
          role:       'secretaria',
          full_name:  fullName,
          email:      email,
          active:     true,
        });

      if (insertError) {
        return json({ error: 'Convite enviado, mas erro ao criar perfil: ' + insertError.message }, 500);
      }
    }

    return json({ success: true, email, message: `Convite enviado para ${email}` });

  } catch (err: any) {
    return json({ error: err.message ?? 'Erro interno' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
