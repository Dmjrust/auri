import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../lib/types';

// ── Tipos do contexto ─────────────────────────────────────────────────────────

interface AuthProfileCtxValue {
  profile:      UserProfile | null;
  role:         'medico' | 'secretaria' | 'admin' | null;
  doctorId:     string | null;
  fullName:     string | null;
  isDoctor:     boolean;
  isSecretary:  boolean;
  isAdmin:      boolean;
  isLoading:    boolean;
  /** true quando o usuário está autenticado mas não tem registro em user_profiles */
  profileMissing: boolean;
}

const defaultValue: AuthProfileCtxValue = {
  profile:        null,
  role:           null,
  doctorId:       null,
  fullName:       null,
  isDoctor:       false,
  isSecretary:    false,
  isAdmin:        false,
  isLoading:      true,
  profileMissing: false,
};

export const AuthProfileContext = createContext<AuthProfileCtxValue>(defaultValue);

// ── Helper: busca o perfil completo em user_profiles ─────────────────────────

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, user_id, doctor_id, role, full_name, email, active')
    .eq('user_id', userId)
    .eq('active', true)
    .single();

  if (error || !data) return null;

  return {
    id:        data.id,
    userId:    data.user_id,
    doctorId:  data.doctor_id,
    role:      data.role as 'medico' | 'secretaria' | 'admin',
    fullName:  data.full_name,
    email:     data.email,
    active:    data.active,
  };
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile]             = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading]         = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);

  const loadProfile = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      setProfileMissing(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const p = await fetchProfile(userId);
      if (p) {
        setProfile(p);
        setProfileMissing(false);
      } else {
        // Usuário autenticado mas sem registro em user_profiles
        setProfile(null);
        setProfileMissing(true);
      }
    } catch {
      setProfile(null);
      setProfileMissing(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carrega perfil na montagem e atualiza em cada mudança de sessão
  useEffect(() => {
    // Carrega sessão atual imediatamente
    supabase.auth.getSession().then(({ data }) => {
      loadProfile(data.session?.user.id ?? null);
    });

    // Escuta mudanças futuras (login, logout, refresh de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        loadProfile(session?.user.id ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo<AuthProfileCtxValue>(() => ({
    profile,
    role:           profile?.role         ?? null,
    doctorId:       profile?.doctorId     ?? null,
    fullName:       profile?.fullName     ?? null,
    isDoctor:       profile?.role         === 'medico',
    isSecretary:    profile?.role         === 'secretaria',
    isAdmin:        profile?.role         === 'admin',
    isLoading,
    profileMissing,
  }), [profile, isLoading, profileMissing]);

  // Tela de erro — usuário autenticado sem perfil configurado
  if (!isLoading && profileMissing) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#FAFAF8', fontFamily: 'Inter, sans-serif', padding: 24,
      }}>
        <div style={{
          maxWidth: 400, textAlign: 'center',
          background: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 12, padding: '40px 32px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1A1D1C' }}>
            Perfil não configurado
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>
            Sua conta não possui um perfil de acesso associado.
            Entre em contato com o médico responsável pelo consultório.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              background: '#0F4C5C', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 24px', fontSize: 14,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthProfileContext.Provider value={value}>
      {children}
    </AuthProfileContext.Provider>
  );
}

// ── Hook público ──────────────────────────────────────────────────────────────

export const useAuthProfile = () => useContext(AuthProfileContext);
